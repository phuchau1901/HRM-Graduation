import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaveAccrualSettings } from './LeaveAccrualSettings';
import { SystemSettings } from './SystemSettings';
afterEach(cleanup);
const grants = [{ code: 'WEB_SYSTEM_SETTINGS', canView: 'Y', canUpdate: 'Y' }];
const data = { version: 2, asOfDate: '2027-01-01', defaultLeaveTypeId: 1, settings: { scheduleVersion: 2, enabled: true,
  accrualSchedule: { startDate: '2027-01-01', interval: 1, unit: 'MONTH' }, resetSchedule: { startDate: '2027-01-01', interval: 1, unit: 'YEAR' },
  newHireEligibility: 'ACTIVE_ON_DATE', rules: [{ positionId: 3, leaveTypeId: null, daysPerCycle: 1 }] } };
describe('LeaveAccrualSettings', () => {
  it('saves independent grant/reset intervals, annual default and days per cycle', async () => {
    const api = vi.fn(async () => data); render(<LeaveAccrualSettings api={api} permissions={grants} />);
    fireEvent.change(await screen.findByLabelText('Số ngày cấp mỗi chu kỳ'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Tần suất cấp phép'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Ngày bắt đầu thu hồi'), { target: { value: '2027-04-01' } });
    fireEvent.click(screen.getByText('Lưu lịch phép'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/system-settings/leave-accrual', { method: 'PUT', body: JSON.stringify({ version: data.version, settings: { ...data.settings,
      accrualSchedule: { ...data.settings.accrualSchedule, interval: 2 }, resetSchedule: { ...data.settings.resetSchedule, startDate: '2027-04-01' }, rules: [{ ...data.settings.rules[0], daysPerCycle: 1.5 }] } }) }));
    expect(await screen.findByText('Đã lưu lịch cấp/thu hồi phép.')).toBeTruthy();
  });
  it('uses only system-settings permissions and does not fetch without VIEW', async () => {
    const api = vi.fn(async () => data); render(<LeaveAccrualSettings api={api} permissions={[]} />); expect(api).not.toHaveBeenCalled(); cleanup();
    const { rerender } = render(<LeaveAccrualSettings api={api} permissions={[{ code: 'WEB_SYSTEM_SETTINGS', canView: 'Y' }]} />);
    await screen.findByLabelText('Ngày bắt đầu cấp phép'); expect(screen.queryByText('Lưu lịch phép')).toBeNull(); expect(screen.getByLabelText('Ngày bắt đầu cấp phép').closest('fieldset').disabled).toBe(true);
    rerender(<LeaveAccrualSettings api={api} permissions={grants} />);
    expect(screen.getByText('Lưu lịch phép')).toBeTruthy(); expect(screen.getByLabelText('Ngày bắt đầu cấp phép').closest('fieldset').disabled).toBe(false);
  });
  it('runs due schedules and reports API errors without fabricated outcomes', async () => {
    const api = vi.fn(async (_path, options) => { if (options?.method === 'POST') throw new Error('System settings UPDATE required'); return data; });
    render(<LeaveAccrualSettings api={api} permissions={grants} />); fireEvent.click(await screen.findByText('Chạy lịch đến hạn'));
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'System settings UPDATE required'); expect(screen.queryByText(/Đã xử lý lịch đến hạn:/)).toBeNull();
  });
  it('opens as a separate system settings tab', async () => {
    const api = vi.fn(async path => path === '/system-settings/leave-accrual' ? data : { version: 'password-version', settings: { minimumLength: 12, maximumLength: 128, passwordHistoryCount: 0 } });
    render(<SystemSettings api={api} permissions={grants} />); fireEvent.click(screen.getByText('Leave Accrual Settings'));
    expect(await screen.findByLabelText('Số ngày cấp mỗi chu kỳ')).toHaveProperty('value', '1');
  });
  it('previews full calendar intervals rather than immediate execution', async () => {
    const api = vi.fn(async () => ({ ...data, settings: { ...data.settings, accrualSchedule: { startDate: '2027-01-31', interval: 1, unit: 'MONTH' } } }));
    render(<LeaveAccrualSettings api={api} permissions={grants} />);
    expect(await screen.findByText('2027-02-28')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tần suất cấp phép'), { target: { value: '2' } }); expect(screen.getByText('2027-03-31')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Đơn vị cấp phép'), { target: { value: 'YEAR' } }); expect(screen.getByText('2029-01-31')).toBeTruthy();
    expect(screen.getByLabelText('ID loại phép (mặc định ANNUAL)').value).toBe('');
  });
  it('converts legacy configuration only on explicit save and can configure reset alone', async () => {
    const legacy = { version: 1, asOfDate: '2026-11-17', settings: { enabled: true, effectiveFrom: '2026-01-01', accrualDay: 15, newHireEligibility: 'ACTIVE_ON_DATE', resetOn: '2027-01-01', repeatResetYearly: true, rules: [{ positionId: 3, leaveTypeId: 1, daysPerMonth: 1 }] } };
    const api = vi.fn(async () => legacy); render(<LeaveAccrualSettings api={api} permissions={grants} />);
    await screen.findByText(/Cấu hình đang dùng lịch cũ/); expect(api).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Ngày bắt đầu cấp phép').value).toBe('2026-11-17');
    fireEvent.click(screen.getByLabelText('Bật lịch cấp phép')); expect(screen.queryByLabelText('Số ngày cấp mỗi chu kỳ')).toBeNull();
    fireEvent.click(screen.getByText('Lưu lịch phép'));
    await waitFor(() => expect(api.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
    const saved = JSON.parse(api.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body);
    expect(saved.settings.scheduleVersion).toBe(2); expect(saved.settings.accrualSchedule).toBeNull(); expect(saved.settings.resetSchedule.unit).toBe('YEAR');
    expect(saved.settings).not.toHaveProperty('accrualDay'); expect(saved.settings.rules[0]).not.toHaveProperty('daysPerMonth');
  });
});
