import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkScheduleCalendar } from './WorkScheduleCalendar';
afterEach(cleanup);
const permissions = [{ code: 'WEB_WORK_SCHEDULES', canView: 'Y', canNew: 'Y', canUpdate: 'Y', canDelete: 'Y', canExport: 'Y' }];
const data = { total: 21, employees: [{ id: 1, employeeCode: 'NV001', fullName: 'Alice' }], schedules: [], shifts: [{ id: 2, code: 'DAY', name: 'Day', startTime: '08:00:00', endTime: '17:00:00', isActive: true }], departments: [{ id: 4, name: 'Engineering' }], teams: [{ id: 5, name: 'Core' }], holidayDates: [] };
const preview = { previewToken: 'confirmed-preview', ready: 1, skipped: 1, items: [{ employeeId: 1, employeeCode: 'NV001', employeeName: 'Alice', workDate: '2026-11-23', outcome: 'READY', rules: { shiftCode: 'DAY' } }, { employeeId: 1, employeeCode: 'NV001', employeeName: 'Alice', workDate: '2026-11-24', outcome: 'APPROVED_LEAVE' }] };
describe('WorkScheduleCalendar', () => {
  it('filters and paginates employees with weekly/monthly columns', async () => {
    const api = vi.fn(async () => data); render(<WorkScheduleCalendar api={api} permissions={permissions} />);
    await screen.findByText('Alice'); expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    fireEvent.change(screen.getByLabelText('Ngày xem'), { target: { value: '2026-11-23' } }); fireEvent.change(screen.getByLabelText('Chế độ'), { target: { value: 'month' } });
    await waitFor(() => expect(screen.getAllByRole('columnheader')).toHaveLength(31));
    fireEvent.change(screen.getByLabelText('Phòng ban'), { target: { value: '4' } });
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('departmentId=4'))).toBe(true));
    await screen.findByText('Alice'); fireEvent.click(screen.getByText('Trang sau'));
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('page=2'))).toBe(true));
  });
  it('requires preview and shows skipped rows before batch confirmation', async () => {
    const api = vi.fn(async (path, options) => path === '/work-schedules/bulk/preview' ? preview : options?.method === 'POST' ? { created: 1, updated: 0, skipped: 1 } : data);
    render(<WorkScheduleCalendar api={api} permissions={permissions} />); fireEvent.click(await screen.findByLabelText('Chọn NV001'));
    fireEvent.click(screen.getByText(/Phân ca hàng loạt/)); expect(screen.queryByText('Xác nhận phân ca')).toBeNull();
    fireEvent.click(screen.getByText('Xem trước')); await screen.findByText('Đã duyệt phép');
    expect(api.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    fireEvent.click(screen.getByText('Xác nhận phân ca')); await screen.findByText('Đã tạo 1, cập nhật 0, bỏ qua 1 lịch.');
    const write = api.mock.calls.find(([path]) => path === '/work-schedules/bulk'); const body = JSON.parse(write[1].body);
    expect(body.employeeIds).toEqual([1]); expect(body.previewToken).toBe(preview.previewToken); expect(body.operationId).toBeTruthy();
  });
  it('invalidates preview when changing parameters and routes copy to copy endpoint', async () => {
    const api = vi.fn(async path => path === '/work-schedules/bulk/preview' ? preview : path === '/work-schedules/copy' ? { created: 1, updated: 0, skipped: 1 } : data);
    render(<WorkScheduleCalendar api={api} permissions={permissions} />); fireEvent.click(await screen.findByLabelText('Chọn NV001')); fireEvent.click(screen.getByText(/Phân ca hàng loạt/));
    fireEvent.click(screen.getByText('Xem trước')); await screen.findByText('Xác nhận phân ca');
    fireEvent.click(screen.getByLabelText('Sao chép lịch có sẵn')); expect(screen.queryByText('Xác nhận phân ca')).toBeNull();
    fireEvent.click(screen.getByText('Xem trước')); await screen.findByText('Xác nhận phân ca'); fireEvent.click(screen.getByText('Xác nhận phân ca'));
    await waitFor(() => expect(api.mock.calls.some(([path]) => path === '/work-schedules/copy')).toBe(true));
  });
  it('does not fetch without VIEW, hides writes, and renders API errors', async () => {
    const api = vi.fn(async () => data); render(<WorkScheduleCalendar api={api} permissions={[]} />); expect(api).not.toHaveBeenCalled(); cleanup();
    render(<WorkScheduleCalendar api={api} permissions={[{ code: 'WEB_WORK_SCHEDULES', canView: 'Y' }]} />);
    await screen.findByText('Alice'); expect(screen.queryByText(/Phân ca hàng loạt/)).toBeNull(); expect(screen.queryByText(/Xuất CSV/)).toBeNull(); cleanup();
    render(<WorkScheduleCalendar api={vi.fn().mockRejectedValue(new Error('Schedule unavailable'))} permissions={permissions} />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Schedule unavailable'); expect(screen.queryByText('Alice')).toBeNull();
  });
  it('shows a real empty state and stale-preview errors without pretending success', async () => {
    const api = vi.fn(async (path, options) => { if (path === '/work-schedules/bulk/preview') return preview; if (options?.method === 'POST') throw new Error('Schedule preview changed'); return data; });
    render(<WorkScheduleCalendar api={api} permissions={permissions} />); fireEvent.click(await screen.findByLabelText('Chọn NV001')); fireEvent.click(screen.getByText(/Phân ca hàng loạt/)); fireEvent.click(screen.getByText('Xem trước'));
    await screen.findByText('Xác nhận phân ca'); fireEvent.click(screen.getByText('Xác nhận phân ca')); await screen.findByText('Schedule preview changed'); expect(screen.queryByText('Xác nhận phân ca')).toBeNull(); cleanup();
    render(<WorkScheduleCalendar api={vi.fn(async () => ({ ...data, employees: [], total: 0 }))} permissions={permissions} />);
    expect(await screen.findByText('Không có nhân viên trong phạm vi hoặc bộ lọc.')).toBeTruthy();
  });
  it('changes an existing cell using UPDATE without requiring NEW', async () => {
    const api = vi.fn(async (path, options) => options?.method ? {} : { ...data, schedules: [{ id: 9, employeeId: 1, shiftId: 2, workDate: new URLSearchParams(path.split('?')[1]).get('from'), version: 3, status: 'SCHEDULED', rules: { shiftCode: 'DAY' } }] });
    render(<WorkScheduleCalendar api={api} permissions={[{ code: 'WEB_WORK_SCHEDULES', canView: 'Y', canUpdate: 'Y' }]} />);
    fireEvent.click(await screen.findByRole('button', { name: 'DAY' })); fireEvent.click(screen.getByText('Lưu thay đổi'));
    await waitFor(() => expect(api.mock.calls.some(([path, options]) => path === '/work-schedules/9' && options?.method === 'PUT' && options.headers['If-Match'] === '"3"')).toBe(true));
    expect(api.mock.calls.some(([path]) => path === '/work-schedules/bulk/preview')).toBe(false);
  });

});
