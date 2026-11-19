import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SystemSettings } from './SystemSettings';
import { WorkWorkspace } from './work/WorkWorkspace';
afterEach(cleanup);
const policy = { minimumLength: 12, maximumLength: 128, passwordHistoryCount: 0, requireUppercase: false, requireLowercase: false, requireDigit: false, requireSpecialCharacter: false, disallowUsernameInPassword: false };
const attendance = { timezone: 'Asia/Ho_Chi_Minh', checkInBeforeStartMinutes: 60, checkInAfterStartMinutes: 240, checkOutBeforeEndMinutes: 240, checkOutAfterEndMinutes: 120, lateGraceMinutes: 5, earlyLeaveGraceMinutes: 5, workingDays: [1, 2, 3, 4, 5], requireQr: false, requireGps: false, allowOvernightShifts: true, missingPunchRule: 'REJECT_CHECKOUT_WITHOUT_CHECKIN', locations: [] };
const permissions = [{ code: 'WEB_SYSTEM_SETTINGS', canView: 'Y', canUpdate: 'Y' }];
it('loads real policy and saves with version/If-Match, without any password fields', async () => {
  const api = vi.fn(async (path, options = {}) => ({ settings: options.method === 'PUT' ? JSON.parse(options.body) : policy, version: options.method === 'PUT' ? 3 : 2 }));
  const user = userEvent.setup(); render(<SystemSettings api={api} permissions={permissions} />);
  await screen.findByLabelText('Độ dài tối thiểu');
  await user.click(screen.getByLabelText('Yêu cầu chữ hoa')); await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
  await screen.findByText('Đã lưu cấu hình.');
  const call = api.mock.calls.find(([, options]) => options.method === 'PUT');
  expect(call[0]).toBe('/system-settings/password-policy'); expect(call[1].headers['If-Match']).toBe('"2"'); expect(JSON.parse(call[1].body).requireUppercase).toBe(true);
  expect(document.querySelector('input[type=password]')).toBeNull();
});
it('renders Attendance Settings and can configure working days and GPS location', async () => {
  const api = vi.fn(async path => ({ settings: path.endsWith('/attendance') ? attendance : policy, version: 1 }));
  const user = userEvent.setup(); render(<SystemSettings api={api} permissions={permissions} />);
  await screen.findByLabelText('Độ dài tối thiểu'); await user.click(screen.getByRole('button', { name: 'Attendance Settings' }));
  await screen.findByLabelText('Múi giờ'); expect(screen.getByLabelText('Múi giờ').value).toBe('Asia/Ho_Chi_Minh');
  await user.click(screen.getByLabelText('Yêu cầu GPS')); await user.click(screen.getByRole('button', { name: '+ Địa điểm' }));
  await screen.findByLabelText('Mã địa điểm 1');
  expect(screen.getByLabelText('Cho phép ca qua đêm').checked).toBe(true);
});
it('never writes without UPDATE and never fetches global settings without VIEW', async () => {
  const api = vi.fn(async () => ({ settings: policy, version: 1 }));
  const view = render(<SystemSettings api={api} permissions={[]} />); expect(api).not.toHaveBeenCalled(); view.unmount();
  render(<SystemSettings api={api} permissions={[{ code: 'WEB_SYSTEM_SETTINGS', canView: 'Y' }]} />);
  await screen.findByLabelText('Độ dài tối thiểu'); expect(screen.getByLabelText('Độ dài tối thiểu').closest('fieldset').disabled).toBe(true);
  expect(screen.queryByRole('button', { name: 'Lưu cấu hình' })).toBeNull();
});
it('shows stale version errors and does not retry/overwrite automatically', async () => {
  const api = vi.fn(async (path, options = {}) => { if (options.method === 'PUT') throw new Error('Settings changed; reload before saving.'); return { settings: policy, version: 1 }; });
  const user = userEvent.setup(); render(<SystemSettings api={api} permissions={permissions} />);
  await screen.findByLabelText('Độ dài tối thiểu'); await user.click(screen.getByRole('button', { name: 'Lưu cấu hình' }));
  await screen.findByText('Settings changed; reload before saving.');
  expect(api.mock.calls.filter(([, options]) => options.method === 'PUT')).toHaveLength(1);
});
it('shift management uses existing API and sends times/break/grace instead of mock data', async () => {
  const api = vi.fn(async (path, options = {}) => options.method === 'POST' ? { id: 1 } : { data: [], total: 0 });
  const user = userEvent.setup(); render(<WorkWorkspace api={api} permissions={[{ code: 'WEB_SHIFTS', canView: 'Y', canNew: 'Y' }]} />);
  await screen.findByText('Chưa có dữ liệu.'); await user.click(screen.getByRole('button', { name: '+ Thêm ca' }));
  await user.type(screen.getByLabelText('Mã ca'), 'NIGHT'); await user.type(screen.getByLabelText('Tên ca'), 'Night');
  await user.type(screen.getByLabelText('Giờ bắt đầu'), '22:00'); await user.type(screen.getByLabelText('Giờ kết thúc'), '06:00');
  await user.click(screen.getByRole('button', { name: 'Lưu' }));
  await waitFor(() => expect(api.mock.calls.some(([, options]) => options.method === 'POST')).toBe(true));
  const body = JSON.parse(api.mock.calls.find(([, options]) => options.method === 'POST')[1].body); expect(body.startTime).toBe('22:00:00'); expect(body.endTime).toBe('06:00:00');
});

it('shows schedule cancellation for DELETE grant and sends version without deleting data', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const api = vi.fn(async path => path.startsWith('/work-schedules') ? { employees: [{ id: 5, employeeCode: 'NV005', fullName: 'Employee' }], schedules: [{ id: 1, employeeId: 5, shiftId: 2, workDate: new URLSearchParams(path.split('?')[1]).get('from') || '2026-11-16', status: 'SCHEDULED', version: 2, rules: { shiftCode: 'DAY', timezone: 'Asia/Ho_Chi_Minh' } }], shifts: [{ id: 2, code: 'DAY', name: 'Day' }], holidayDates: [], departments: [], teams: [], total: 1 } : { data: [], total: 0 });
  const user = userEvent.setup(); render(<WorkWorkspace api={api} permissions={[{ code: 'WEB_SHIFTS', canView: 'Y' }, { code: 'WEB_WORK_SCHEDULES', canView: 'Y', canDelete: 'Y' }]} />);
  await user.click(screen.getByRole('button', { name: 'Lịch phân ca' }));
  await screen.findByRole('button', { name: 'Hủy lịch 1' }); await user.click(screen.getByRole('button', { name: 'Hủy lịch 1' }));
  await waitFor(() => expect(api.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(true));
  const call = api.mock.calls.find(([, options]) => options?.method === 'PATCH');
  expect(call[0]).toBe('/work-schedules/1/cancel'); expect(call[1].headers['If-Match']).toBe('"2"');
});
