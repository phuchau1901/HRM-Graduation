import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaveWorkspace } from './LeaveWorkspace';
afterEach(cleanup);
const grants = [{ code: 'WEB_LEAVE_REQUESTS', canView: 'Y', canNew: 'Y', canUpdate: 'Y' }];
const leave = { id: 1, employeeName: 'Alice', leaveTypeName: 'Annual', fromDate: '2026-12-01', toDate: '2026-12-02', requestedDays: 2, reason: 'Family', status: 'PENDING', version: 3 };
describe('LeaveWorkspace', () => {
  it('loads scoped pages, opens details and cancels with the current resource version', async () => {
    const api = vi.fn(async (path, options) => options?.method === 'POST' ? {} : path === '/leave-requests/1' ? leave : { total: 21, data: [leave] });
    render(<LeaveWorkspace api={api} permissions={grants} userId="alice" mode="my" />);
    expect(screen.getByLabelText('Đang tải')).toBeTruthy();
    fireEvent.click(await screen.findByText('Chi tiết')); await screen.findByText('Family');
    fireEvent.change(screen.getByLabelText('Lý do hủy'), { target: { value: 'Changed plans' } });
    fireEvent.click(screen.getByText('Hủy / Yêu cầu hủy'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/leave-requests/1/cancel', { method: 'POST', body: JSON.stringify({ version: 3, reason: 'Changed plans' }) }));
    fireEvent.click(screen.getByText('Sau'));
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('page=2') && path.includes('view=MY'))).toBe(true));
  });
  it('shows errors without inventing empty data and retries', async () => {
    const api = vi.fn().mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValue({ total: 0, data: [] });
    render(<LeaveWorkspace api={api} permissions={grants} mode="my" />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unavailable');
    expect(screen.queryByText(/Chưa có dữ liệu/)).toBeNull();
    fireEvent.click(screen.getByText('Tải lại'));
    expect(await screen.findByText(/Chưa có dữ liệu/)).toBeTruthy();
  });
  it('does not call APIs without a view grant', () => {
    const api = vi.fn(); render(<LeaveWorkspace api={api} permissions={[]} mode="my" />);
    expect(api).not.toHaveBeenCalled();
  });
  it('offers approval only to the assigned current approver and sends approval version', async () => {
    const request = { id: 4, status: 'PENDING', version: 7, currentStepNo: 2, employeeName: 'Alice', requestType: 'LEAVE' };
    const api = vi.fn(async (path, options) => options?.method === 'POST' ? {} : path === '/approvals/4' ? { request, steps: [{ id: 1, stepNo: 2, approverUserId: 'lead', decision: 'PENDING' }], details: { reason: 'Family' } } : path.includes('/history') ? { total: 0, data: [] } : { total: 1, data: [request] });
    const permissions = [{ code: 'WEB_APPROVALS', canView: 'Y', canApprove: 'Y' }];
    const { rerender } = render(<LeaveWorkspace api={api} permissions={permissions} userId="other" mode="approvals" />);
    fireEvent.click(await screen.findByText('Chi tiết')); await screen.findByText('Family');
    expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
    rerender(<LeaveWorkspace api={api} permissions={permissions} userId="lead" mode="approvals" />);
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'OK' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/approvals/4/approve', { method: 'POST', body: JSON.stringify({ version: 7, reason: 'OK' }) }));
  });
  it('configures a USER approver without requiring an HR role', async () => {
    const settings = { version: 2, routes: [{ requestType: 'LEAVE', allowSelfApproval: false, steps: [{ approverType: 'USER', employeeId: 12 }] }] };
    const api = vi.fn(async () => settings);
    render(<LeaveWorkspace api={api} permissions={[{ code: 'WEB_APPROVAL_SETTINGS', canView: 'Y', canUpdate: 'Y' }]} mode="manage" />);
    const input = await screen.findByLabelText('Approver Employee ID');
    expect(screen.queryByText('Bạn chưa có quyền xem màn hình này.')).toBeNull();
    expect(api.mock.calls.every(([path]) => path === '/approval-workflow-settings')).toBe(true);
    expect(screen.queryByLabelText('HR Role code')).toBeNull();
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.click(screen.getByText('Lưu cấu hình'));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/approval-workflow-settings', { method: 'PUT', body: JSON.stringify({ ...settings, routes: [{ ...settings.routes[0], steps: [{ approverType: 'USER', employeeId: 25, userId: null }] }] }) }));
  });

  it('keeps workflow settings read only with VIEW and hides them without VIEW', async () => {
    const settings = { version: 1, routes: [{ requestType: 'LEAVE', allowSelfApproval: false, steps: [{ approverType: 'USER', employeeId: 12 }] }] };
    const api = vi.fn(async () => settings);
    render(<LeaveWorkspace api={api} permissions={[{ code: 'WEB_APPROVAL_SETTINGS', canView: 'Y' }]} mode="manage" />);
    await screen.findByLabelText('Approver Employee ID');
    expect(screen.queryByText('Lưu cấu hình')).toBeNull();
    expect(screen.getByLabelText('Approver Employee ID').closest('fieldset').disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
    cleanup(); api.mockClear();
    render(<LeaveWorkspace api={api} permissions={[{ code: 'WEB_APPROVAL_SETTINGS', canUpdate: 'Y' }]} mode="manage" />);
    expect(api).not.toHaveBeenCalled();
    expect(screen.queryByText('Cấu hình luồng duyệt')).toBeNull();
  });

});
