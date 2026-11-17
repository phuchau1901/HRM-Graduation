import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaveAccrualSettings } from './LeaveAccrualSettings';
import { SystemSettings } from './SystemSettings';
afterEach(cleanup);
const grants = [{ code: 'WEB_SYSTEM_SETTINGS', canView: 'Y', canUpdate: 'Y' }, { code: 'WEB_LEAVE_BALANCES', canView: 'Y', canUpdate: 'Y' }];
const data = { version: 2, settings: { enabled: true, effectiveFrom: '2027-01-01', accrualDay: 15, newHireEligibility: 'ACTIVE_ON_DATE', resetOn: '2028-01-01', repeatResetYearly: true, rules: [{ positionId: 3, leaveTypeId: 1, daysPerMonth: 1 }] } };
describe('LeaveAccrualSettings', () => {
  it('edits and saves positional monthly days and reset policy with version', async () => {
    const api = vi.fn(async () => data); render(<LeaveAccrualSettings api={api} permissions={grants} />);
    fireEvent.change(await screen.findByLabelText('Số ngày cộng mỗi tháng'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Ngày reset đầu tiên (không bắt buộc)'), { target: { value: '2028-04-01' } });
    fireEvent.click(screen.getByText('Lưu lịch phép'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/system-settings/leave-accrual', { method: 'PUT', body: JSON.stringify({ ...data, settings: { ...data.settings, resetOn: '2028-04-01', rules: [{ ...data.settings.rules[0], daysPerMonth: 1.5 }] } }) }));
    expect(await screen.findByText('Đã lưu lịch cộng/reset phép.')).toBeTruthy();
  });
  it('requires both permission flags for write controls and does not fetch without VIEW', async () => {
    const api = vi.fn(async () => data); render(<LeaveAccrualSettings api={api} permissions={[]} />); expect(api).not.toHaveBeenCalled(); cleanup();
    render(<LeaveAccrualSettings api={api} permissions={[{ code: 'WEB_SYSTEM_SETTINGS', canView: 'Y', canUpdate: 'Y' }]} />);
    await screen.findByLabelText('Ngày bắt đầu áp dụng'); expect(screen.queryByText('Lưu lịch phép')).toBeNull(); expect(screen.getByLabelText('Ngày bắt đầu áp dụng').closest('fieldset').disabled).toBe(true);
  });
  it('runs only due schedules and reports API errors without fabricated outcomes', async () => {
    const api = vi.fn(async (_path, options) => { if (options?.method === 'POST') throw new Error('Global scope required'); return data; });
    render(<LeaveAccrualSettings api={api} permissions={grants} />); fireEvent.click(await screen.findByText('Chạy lịch đến hạn'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Global scope required'); expect(screen.queryByText(/Đã xử lý lịch đến hạn:/)).toBeNull();
  });
  it('opens as a separate system settings tab using its own response format', async () => {
    const api = vi.fn(async path => path === '/system-settings/leave-accrual' ? data : { version: 'password-version', settings: { minimumLength: 12, maximumLength: 128, passwordHistoryCount: 0 } });
    render(<SystemSettings api={api} permissions={grants} />); fireEvent.click(screen.getByText('Leave Accrual Settings'));
    expect(await screen.findByLabelText('Số ngày cộng mỗi tháng')).toHaveProperty('value', '1');
    expect(api.mock.calls.some(([path]) => path === '/system-settings/leave-accrual')).toBe(true);
  });
});
