import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaveBalances } from './LeaveBalances';
import { LeaveWorkspace } from './LeaveWorkspace';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const permissions = [{ code: 'WEB_LEAVE_BALANCES', canView: 'Y' }, { code: 'WEB_LEAVE_MANAGEMENT', canView: 'Y', canUpdate: 'Y' }];
const balance = { id: 2, employeeId: 10, employeeName: 'Alice', year: 2026, leaveTypeId: 3, leaveTypeName: 'Annual', entitledDays: 12, carriedOverDays: 2, adjustmentDays: -1, usedDays: 3, reservedDays: 2, remainingDays: 10, availableDays: 8, version: 4 };
describe('LeaveBalances', () => {
  it('shows all balance components, filters and pages scoped results', async () => {
    const api = vi.fn(async () => ({ total: 21, data: [balance] }));
    render(<LeaveBalances api={api} permissions={permissions} />);
    expect(screen.getByLabelText('Đang tải số dư')).toBeTruthy();
    await screen.findByText('Alice');
    for (const label of ['Được cấp', 'Chuyển năm', 'Điều chỉnh', 'Đã dùng', 'Đang chờ duyệt', 'Còn lại', 'Khả dụng']) expect(screen.getByRole('columnheader', { name: label })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Năm số dư'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('ID phòng ban lọc'), { target: { value: '9' } });
    await screen.findByText('Alice'); fireEvent.click(screen.getByText('Trang sau'));
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('page=2') && path.includes('departmentId=9') && path.includes('view=ALL'))).toBe(true));
  });
  it('submits signed adjustment with reason and version and refreshes', async () => {
    const api = vi.fn(async (_path, options) => options?.method ? balance : { total: 1, data: [balance] });
    render(<LeaveBalances api={api} permissions={permissions} />);
    await screen.findByText('Alice'); fireEvent.click(screen.getByRole('button', { name: 'Điều chỉnh' }));
    fireEvent.change(screen.getByLabelText('Số ngày điều chỉnh (+ / −)'), { target: { value: '-0.5' } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Correct carryover' } });
    fireEvent.click(screen.getByText('Lưu số dư'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/leave-balances/2/adjustments', { method: 'POST', body: JSON.stringify({ version: 4, days: -0.5, reason: 'Correct carryover' }) }));
    expect(await screen.findByText('Đã cập nhật số dư phép.')).toBeTruthy();
  });
  it('reuses the bulk operation ID and payload after a network error', async () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    let fail = true;
    const api = vi.fn(async (_path, options) => {
      if (options?.method) { if (fail) throw new Error('Network interrupted'); return { selected: 3, created: 2, skipped: 1 }; }
      return { total: 0, data: [] };
    });
    render(<LeaveBalances api={api} permissions={permissions} />);
    fireEvent.click(screen.getByText('Cấp phép'));
    fireEvent.change(screen.getByLabelText('Đối tượng cấp'), { target: { value: 'ALL' } });
    fireEvent.change(screen.getByLabelText('ID loại phép cấp'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Số ngày được cấp'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Annual grant' } });
    fireEvent.click(screen.getByText('Lưu số dư')); await screen.findByText('Network interrupted');
    fail = false; fireEvent.click(screen.getByText('Lưu số dư'));
    expect(await screen.findByText('Đã cấp 2/3 nhân viên; bỏ qua 1 số dư đã tồn tại.')).toBeTruthy();
    const writes = api.mock.calls.filter(([, options]) => options?.method);
    expect(writes).toHaveLength(2); expect(writes[0][1].body).toBe(writes[1][1].body);
    const body = JSON.parse(writes[0][1].body); expect(body.operationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/); expect(body.target).toBe('ALL'); expect(body).not.toHaveProperty('employeeId');
  });
  it('integrates a read-only balance tab in My Leave and Team Leave', async () => {
    const api = vi.fn(async path => path.includes('/me?') ? { success: true, data: { totalDays: 13, usedDays: 3, remainingDays: 10, balances: [balance] } } : { total: 1, data: [balance] });
    const { unmount } = render(<LeaveWorkspace api={api} permissions={permissions} mode="my" />);
    await screen.findByText('Alice'); expect(screen.queryByRole('button', { name: 'Cấp phép' })).toBeNull(); expect(screen.queryByRole('button', { name: 'Điều chỉnh' })).toBeNull();
    expect(api.mock.calls.some(([path]) => path.startsWith('/leave-balances/me?'))).toBe(true);
    unmount(); api.mockClear(); render(<LeaveWorkspace api={api} permissions={permissions} mode="team" />);
    await screen.findByText('Alice'); expect(api.mock.calls.some(([path]) => path.includes('view=TEAM'))).toBe(true);
    expect(screen.queryByRole('button', { name: 'Cấp phép' })).toBeNull();
  });
  it('paginates balance history without employee APIs and shows load errors honestly', async () => {
    const api = vi.fn(async path => path.includes('/history') ? { total: 21, data: [{ id: 8, actorUserId: 'hr', action: 'LEAVE_BALANCE_ADJUSTED', beforeJson: '{}', afterJson: '{"reason":"Correct"}', createdAt: '2026-11-17T05:00:00' }] } : { total: 1, data: [balance] });
    render(<LeaveBalances api={api} permissions={permissions} />);
    await screen.findByText('Alice'); fireEvent.click(screen.getByText('Lịch sử')); await screen.findByText(/LEAVE_BALANCE_ADJUSTED/);
    fireEvent.click(screen.getAllByText('Trang sau').find(button => !button.disabled));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/leave-balances/2/history?page=2&pageSize=20'));
    cleanup(); const broken = vi.fn().mockRejectedValue(new Error('Balance API unavailable'));
    render(<LeaveBalances api={broken} permissions={permissions} />);
    await screen.findByText('Balance API unavailable'); expect(screen.queryByText('Chưa có số dư phép trong phạm vi được xem.')).toBeNull();
  });
  it('does not fetch without VIEW and hides write controls without UPDATE', async () => {
    const api = vi.fn(async () => ({ total: 0, data: [] }));
    render(<LeaveBalances api={api} permissions={[]} />); expect(api).not.toHaveBeenCalled(); cleanup();
    render(<LeaveBalances api={api} permissions={[{ code: 'WEB_LEAVE_MANAGEMENT', canView: 'Y' }]} />);
    await screen.findByText('Chưa có số dư phép trong phạm vi được xem.'); expect(screen.queryByText('Cấp phép')).toBeNull();
  });
  it('keeps personal VIEW separate from management VIEW', async () => {
    const personal = [{ code: 'WEB_LEAVE_BALANCES', canView: 'Y', canUpdate: 'Y' }];
    const api = vi.fn(async () => ({ success: true, data: { totalDays: 13, usedDays: 3, remainingDays: 10, balances: [balance] } }));
    render(<LeaveBalances api={api} permissions={personal} />); expect(api).not.toHaveBeenCalled(); cleanup();
    render(<LeaveBalances api={api} permissions={personal} view="MY" />);
    await screen.findByText('Alice'); expect(api.mock.calls.every(([path]) => path.startsWith('/leave-balances/me?'))).toBe(true);
    expect(screen.queryByText('Lịch sử')).toBeNull(); cleanup(); api.mockClear();
    render(<LeaveBalances api={api} permissions={[{ code: 'WEB_LEAVE_MANAGEMENT', canView: 'Y' }]} view="MY" />);
    expect(api).not.toHaveBeenCalled();
  });

});
