import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AttendanceWorkspace } from './AttendanceWorkspace';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const permissions = [{ code: 'WEB_MY_ATTENDANCE', canView: 'Y', canUpdate: 'Y' }, { code: 'WEB_ATTENDANCE', canView: 'Y', canExport: 'Y', canNew: 'Y', canUpdate: 'Y' }, { code: 'WEB_ATTENDANCE_ADJUSTMENTS', canNew: 'Y' }];
const row = { employeeId: 1, employeeCode: 'NV001', employeeName: 'Alice', departmentName: 'Engineering', teamName: 'Core', workDate: '2026-11-23', scheduleId: 7, attendanceId: 11, shiftCode: 'DAY', timezone: 'Asia/Ho_Chi_Minh', shiftStartAtUtc: '2026-11-23T01:00:00Z', shiftEndAtUtc: '2026-11-23T10:00:00Z', checkInOpenUtc: '2026-11-23T00:00:00Z', checkInCloseUtc: '2026-11-23T05:00:00Z', checkOutOpenUtc: '2026-11-23T06:00:00Z', checkOutCloseUtc: '2026-11-23T12:00:00Z', checkInAtUtc: '2026-11-23T01:10:00Z', checkOutAtUtc: null, workedMinutes: null, lateMinutes: 5, earlyMinutes: 10, isLate: true, isEarly: true, status: 'WORKING' };
const page = { total: 21, asOfUtc: '2026-11-23T08:30:00Z', data: [row] };
const stats = { scheduled: 3, checkedIn: 2, working: 1, late: 2, early: 1, notPunched: 1, onLeave: 0, absent: 0, missingCheckOut: 0 };
const filters = { departments: [{ id: 4, name: 'Engineering' }], teams: [{ id: 5, name: 'Core' }] };
function defaultApi(path) { return path.startsWith('/attendances/filters') ? filters : path.startsWith('/attendances/statistics') ? stats : page; }
describe('AttendanceWorkspace', () => {
  it('loads real daily rows with names, independent violations, filters and pagination', async () => {
    const api = vi.fn(async path => defaultApi(path)); render(<AttendanceWorkspace api={api} permissions={permissions} employeeId={1} />);
    await screen.findByText('Alice'); expect(screen.getByText('NV001')).toBeTruthy(); expect(screen.getByText('5 phút')).toBeTruthy(); expect(screen.getByText('10 phút')).toBeTruthy();
    expect(screen.getByText('Nhân viên có ca').parentElement.textContent).toContain('3');
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'LATE' } });
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('/statistics?') && path.includes('status=LATE'))).toBe(true));
    await screen.findByText('Alice'); fireEvent.change(screen.getByLabelText('Phòng ban'), { target: { value: '4' } });
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('/daily?') && path.includes('departmentId=4'))).toBe(true));
    await screen.findByText('Alice'); fireEvent.click(screen.getByText('Trang sau'));
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('/daily?') && path.includes('page=2'))).toBe(true));
  });
  it('shows statistics failure without invented zeroes while retaining successful list data', async () => {
    const api = vi.fn(async path => { if (path.includes('/statistics?')) throw new Error('Stats unavailable'); return defaultApi(path); });
    render(<AttendanceWorkspace api={api} permissions={permissions} />); await screen.findByText('Alice'); expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Thống kê: Stats unavailable');
    expect([...document.querySelectorAll('.attendance-stats strong')].every(element => element.textContent === '—')).toBe(true);
  });
  it('opens a drawer and submits a correction request rather than modifying punches', async () => {
    const api = vi.fn(async (path, options) => path.includes('/daily/detail?') ? { attendance: row, rules: { shiftCode: 'DAY', timezone: 'Asia/Ho_Chi_Minh', breakMinutes: 60 }, adjustments: [] } : options?.method ? {} : defaultApi(path));
    render(<AttendanceWorkspace api={api} permissions={permissions} employeeId={1} />);
    fireEvent.click(await screen.findByText('Chi tiết')); const drawer = await screen.findByRole('dialog', { name: 'Chi tiết chấm công' });
    fireEvent.click(await within(drawer).findByText('Tạo phiếu điều chỉnh'));
    fireEvent.change(within(drawer).getByLabelText('Check-in đề xuất'), { target: { value: '2026-11-23T08:05' } });
    fireEvent.change(within(drawer).getByLabelText('Lý do điều chỉnh'), { target: { value: 'Device issue' } });
    fireEvent.click(within(drawer).getByText('Gửi phiếu điều chỉnh')); await screen.findByText('Đã gửi phiếu điều chỉnh. Giờ công chỉ thay đổi sau khi duyệt cuối.');
    const write = api.mock.calls.find(([, options]) => options?.method); expect(write[0]).toBe('/attendance-adjustments'); expect(write[1].method).toBe('POST'); expect(JSON.parse(write[1].body)).toEqual({ attendanceId: 11, proposedCheckIn: '2026-11-23T01:05:00.000Z', proposedCheckOut: null, reason: 'Device issue' });
  });
  it('uses only personal endpoint and preserves punch requestKey on network retry', async () => {
    let fail = true;
    const api = vi.fn(async (path, options) => { if (options?.method) { if (fail) throw new Error('Network unavailable'); return {}; } return { ...page, asOfUtc: '2026-11-23T01:30:00Z', data: [{ ...row, attendanceId: null, checkInAtUtc: null, status: 'NOT_CHECKED_IN' }] }; });
    render(<AttendanceWorkspace api={api} permissions={permissions} employeeId={1} personal />); fireEvent.click(await screen.findByRole('button', { name: 'Check-in' }));
    const punch = screen.getByRole('dialog', { name: 'Xác nhận chấm công' }); fireEvent.click(within(punch).getByText('Xác nhận chấm công')); await screen.findByText('Network unavailable');
    fail = false; fireEvent.click(within(punch).getByText('Xác nhận chấm công')); await screen.findByText('Check-in thành công.');
    const writes = api.mock.calls.filter(([, options]) => options?.method); expect(writes).toHaveLength(2); expect(writes[0][1].body).toBe(writes[1][1].body); expect(writes[0][0]).toBe('/attendances/check-in'); expect(JSON.parse(writes[0][1].body)).toEqual({ scheduleId: 7, requestKey: expect.any(String) });
    expect(api.mock.calls.filter(([, options]) => !options?.method).every(([path]) => path.startsWith('/attendances/me?'))).toBe(true);
  });
  it('checks out using existing endpoint and disables controls outside server window', async () => {
    const api = vi.fn(async (_path, options) => options?.method ? {} : page);
    render(<AttendanceWorkspace api={api} permissions={permissions} employeeId={1} personal />);
    fireEvent.click(await screen.findByRole('button', { name: 'Check-out' })); fireEvent.click(screen.getByText('Xác nhận chấm công', { selector: 'button' })); await screen.findByText('Check-out thành công.');
    expect(api.mock.calls.some(([path]) => path === '/attendances/check-out')).toBe(true); cleanup();
    render(<AttendanceWorkspace api={vi.fn(async () => ({ ...page, asOfUtc: '2026-11-23T13:00:00Z' }))} permissions={permissions} employeeId={1} personal />);
    expect(await screen.findByRole('button', { name: 'Check-out' })).toHaveProperty('disabled', true);
  });
  it('does not fetch without VIEW and displays an honest empty state', async () => {
    const api = vi.fn(async () => page); render(<AttendanceWorkspace api={api} permissions={[]} />); expect(api).not.toHaveBeenCalled(); cleanup();
    render(<AttendanceWorkspace api={vi.fn(async path => path.includes('statistics') ? Object.fromEntries(Object.keys(stats).map(key => [key, 0])) : path.includes('filters') ? filters : { ...page, total: 0, data: [] })} permissions={[{ code: 'WEB_ATTENDANCE', canView: 'Y' }]} />);
    expect(await screen.findByText('Không có dữ liệu chấm công trong phạm vi và khoảng ngày đã chọn.')).toBeTruthy(); expect(screen.queryByText('Xuất Excel')).toBeNull(); expect(screen.queryByText('Tạo phiếu điều chỉnh')).toBeNull();
  });
  it('downloads a real Excel response only through the EXPORT endpoint', async () => {
    const create = vi.fn(() => 'blob:attendance'); const revoke = vi.fn(); Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create }); Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke }); vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const api = vi.fn(async path => path.includes('/export?') ? new Blob(['xlsx']) : defaultApi(path));
    render(<AttendanceWorkspace api={api} permissions={permissions} />); await screen.findByText('Alice'); fireEvent.click(screen.getByText('Xuất Excel'));
    await waitFor(() => expect(api.mock.calls.some(([path, options]) => path.startsWith('/attendances/export?') && options.responseType === 'blob')).toBe(true)); expect(create).toHaveBeenCalled(); expect(revoke).toHaveBeenCalledWith('blob:attendance');
  });
  it('requests correction by schedule when no attendance row exists', async () => {
    const emptyRow = { ...row, attendanceId: null, checkInAtUtc: null, checkOutAtUtc: null, status: 'NOT_CHECKED_IN' };
    const api = vi.fn(async (path, options) => path.includes('/daily/detail?') ? { attendance: emptyRow, rules: { shiftCode: 'DAY', timezone: 'Asia/Ho_Chi_Minh' }, adjustments: [] } : options?.method ? {} : path.includes('/daily?') ? { ...page, data: [emptyRow] } : defaultApi(path));
    render(<AttendanceWorkspace api={api} permissions={permissions} employeeId={1} />); fireEvent.click(await screen.findByText('Chi tiết'));
    const drawer = await screen.findByRole('dialog', { name: 'Chi tiết chấm công' }); fireEvent.click(await within(drawer).findByText('Tạo phiếu điều chỉnh'));
    fireEvent.change(within(drawer).getByLabelText('Check-in đề xuất'), { target: { value: '2026-11-23T08:00' } }); fireEvent.change(within(drawer).getByLabelText('Lý do điều chỉnh'), { target: { value: 'Missing punch' } }); fireEvent.click(within(drawer).getByText('Gửi phiếu điều chỉnh'));
    await screen.findByText('Đã gửi phiếu điều chỉnh. Giờ công chỉ thay đổi sau khi duyệt cuối.'); const write = api.mock.calls.find(([path]) => path === '/attendance-adjustments'); const body = JSON.parse(write[1].body); expect(body.scheduleId).toBe(7); expect(body).not.toHaveProperty('attendanceId');
  });

  it('opens personal history with only WEB_MY_ATTENDANCE VIEW', async () => {
    const api = vi.fn(async () => page);
    render(<AttendanceWorkspace api={api} permissions={[{ code: 'WEB_MY_ATTENDANCE', canView: 'Y' }]} personal employeeId={1} />);
    await screen.findByText('Alice'); expect(api.mock.calls.every(([path]) => path.startsWith('/attendances/me?'))).toBe(true);
    expect(screen.getByText('Chi tiết')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Check-out' })).toBeNull(); cleanup(); api.mockClear();
    render(<AttendanceWorkspace api={api} permissions={[{ code: 'WEB_ATTENDANCE', canView: 'Y' }]} personal employeeId={1} />);
    expect(api).not.toHaveBeenCalled();
  });

  it('shows both punch actions with personal UPDATE and no management grants', async () => {
    const grants = [{ code: 'WEB_MY_ATTENDANCE', canView: 'Y', canUpdate: 'Y' }];
    render(<AttendanceWorkspace api={vi.fn(async () => ({ ...page, asOfUtc: '2026-11-23T01:30:00Z', data: [{ ...row, attendanceId: null, checkInAtUtc: null }] }))} permissions={grants} personal employeeId={1} />);
    expect(await screen.findByRole('button', { name: 'Check-in' })).toHaveProperty('disabled', false); cleanup();
    render(<AttendanceWorkspace api={vi.fn(async () => page)} permissions={grants} personal employeeId={1} />);
    expect(await screen.findByRole('button', { name: 'Check-out' })).toHaveProperty('disabled', false); cleanup();
    render(<AttendanceWorkspace api={vi.fn(async () => page)} permissions={[{ code: 'WEB_MY_ATTENDANCE', canView: 'Y' }, { code: 'WEB_ATTENDANCE', canUpdate: 'Y', canNew: 'Y' }]} personal employeeId={1} />);
    await screen.findByText('Alice'); expect(screen.queryByRole('button', { name: 'Check-out' })).toBeNull();
  });

  it('opens the personal detail drawer with only WEB_MY_ATTENDANCE VIEW', async () => {
    const api = vi.fn(async path => path.includes('/daily/detail?') ? { attendance: row, rules: { shiftCode: 'DAY', timezone: 'Asia/Ho_Chi_Minh' }, adjustments: [] } : page);
    render(<AttendanceWorkspace api={api} permissions={[{ code: 'WEB_MY_ATTENDANCE', canView: 'Y' }]} personal employeeId={1} />);
    fireEvent.click(await screen.findByText('Chi tiết')); const drawer = await screen.findByRole('dialog', { name: 'Chi tiết chấm công' });
    expect(await within(drawer).findByText('Alice')).toBeTruthy(); expect(within(drawer).queryByText('Tạo phiếu điều chỉnh')).toBeNull();
    expect(api.mock.calls.some(([path]) => path.startsWith('/attendances/daily/detail?employeeId=1'))).toBe(true);
  });

});
