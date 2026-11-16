import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Contracts } from './Contracts';
afterEach(cleanup);
const permissions = [{ code: 'WEB_CONTRACTS', canView: 'Y', canNew: 'Y', canUpdate: 'Y' }];
const stats = { success: true, data: { active: 5, expiringSoon: 2, expired: 1, expiringWithinDays: 30, asOfDate: '2026-11-16' } };
const contract = { id: 1, employeeId: 7, contractNo: 'C001', contractType: 'FIXED', contractTypeName: 'Fixed term', startDate: '2020-01-01', endDate: '2027-01-01', status: 'ACTIVE', attachmentUrl: null };
function mockApi() {
  return vi.fn(async (path, options = {}) => {
    if (path.startsWith('/contracts/statistics')) return stats;
    if (options.method) return contract;
    if (path.startsWith('/employees/7/contracts?')) return { data: [contract], total: 1 };
    throw new Error('Unexpected request ' + path);
  });
}
describe('Contracts statistics', () => {
  it('shows skeleton while pending and displays only real API values', async () => {
    let resolve;
    const api = vi.fn(() => new Promise(done => { resolve = done; }));
    render(<Contracts api={api} permissions={permissions} />);
    expect(screen.getByRole('status', { name: 'Đang tải thống kê hợp đồng' })).toBeTruthy();
    expect(screen.queryByLabelText('Đang hiệu lực')).toBeNull();
    resolve(stats);
    expect(await screen.findByLabelText('Đang hiệu lực')).toHaveProperty('textContent', '5');
    expect(screen.getByLabelText('Sắp hết hạn').textContent).toBe('2'); expect(screen.getByLabelText('Đã hết hạn').textContent).toBe('1');
    expect(api).toHaveBeenCalledWith('/contracts/statistics?expiringWithinDays=30', expect.anything());
  });
  it('displays zero only when the API successfully returns zero', async () => {
    const api = vi.fn(async () => ({ success: true, data: { ...stats.data, active: 0, expiringSoon: 0, expired: 0 } }));
    render(<Contracts api={api} permissions={permissions} />);
    expect(await screen.findByLabelText('Đang hiệu lực')).toHaveProperty('textContent', '0');
    expect(screen.getByLabelText('Sắp hết hạn').textContent).toBe('0'); expect(screen.getByLabelText('Đã hết hạn').textContent).toBe('0');
  });
  it('shows an error and retry without fabricated zero or stale counts', async () => {
    const api = vi.fn().mockResolvedValueOnce(stats).mockRejectedValueOnce(new Error('Server unavailable')).mockResolvedValue(stats);
    render(<Contracts api={api} permissions={permissions} />);
    await screen.findByLabelText('Đang hiệu lực');
    fireEvent.change(screen.getByLabelText('Sắp hết hạn trong (ngày)'), { target: { value: '60' } });
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Server unavailable'));
    expect(screen.queryByLabelText('Đang hiệu lực')).toBeNull(); expect(screen.queryByLabelText('Đã hết hạn')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại thống kê' }));
    expect(await screen.findByLabelText('Đang hiệu lực')).toHaveProperty('textContent', '5');
    expect(api).toHaveBeenLastCalledWith('/contracts/statistics?expiringWithinDays=60', expect.anything());
  });
  it('treats an invalid success response as an error rather than mock data', async () => {
    render(<Contracts api={vi.fn(async () => ({}))} permissions={permissions} />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('không hợp lệ'));
    expect(screen.queryByLabelText('Đang hiệu lực')).toBeNull();
  });
  it('does not request statistics or employee data without contract VIEW', () => {
    const api = vi.fn(); render(<Contracts api={api} permissions={[]} initialEmployeeId={7} />);
    expect(screen.getByText('Bạn chưa có quyền xem hợp đồng.')).toBeTruthy(); expect(api).not.toHaveBeenCalled();
  });
  it.each(['Tạo hợp đồng', 'Sửa', 'Gia hạn', 'Chấm dứt'])('refetches statistics and the employee list after %s', async action => {
    const api = mockApi(), user = userEvent.setup();
    render(<Contracts api={api} permissions={permissions} initialEmployeeId={7} />);
    await screen.findByText('C001'); await screen.findByLabelText('Đang hiệu lực');
    await user.click(screen.getByRole('button', { name: action }));
    if (action === 'Tạo hợp đồng') {
      await user.type(screen.getByLabelText('Loại hợp đồng'), 'FIXED');
    }
    if (action === 'Gia hạn') fireEvent.change(screen.getByLabelText('Ngày kết thúc'), { target: { value: '2028-01-01' } });
    await user.click(screen.getByRole('button', { name: 'Lưu hợp đồng' }));
    await waitFor(() => expect(api.mock.calls.filter(([path]) => path.startsWith('/contracts/statistics'))).toHaveLength(2));
    expect(api.mock.calls.filter(([path]) => path.startsWith('/employees/7/contracts?'))).toHaveLength(2);
    const [, options] = api.mock.calls.find(([, options]) => options.method);
    expect(options.method).toBe(action === 'Tạo hợp đồng' ? 'POST' : 'PUT');
    expect(JSON.parse(options.body)).not.toHaveProperty('contractNo');
    const body = JSON.parse(options.body);
    if (action === 'Gia hạn') expect(body.endDate).toBe('2028-01-01');
    if (action === 'Chấm dứt') { expect(body.status).toBe('TERMINATED'); expect(body.endDate).toBe('2026-11-16'); }
    expect(await screen.findByText('Đã lưu hợp đồng.')).toBeTruthy();
  });
  it('does not pretend a failed mutation succeeded or refetch fabricated statistics', async () => {
    const base = mockApi(); const api = vi.fn((path, options = {}) => options.method ? Promise.reject(new Error('Save failed')) : base(path, options));
    const user = userEvent.setup(); render(<Contracts api={api} permissions={permissions} initialEmployeeId={7} />);
    await screen.findByText('C001'); await screen.findByLabelText('Đang hiệu lực');
    await user.click(screen.getByRole('button', { name: 'Sửa' })); await user.click(screen.getByRole('button', { name: 'Lưu hợp đồng' }));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Save failed');
    expect(api.mock.calls.filter(([path]) => path.startsWith('/contracts/statistics'))).toHaveLength(1);
    expect(screen.queryByText('Đã lưu hợp đồng.')).toBeNull();
  });
});
