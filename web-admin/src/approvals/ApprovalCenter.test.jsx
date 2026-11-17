import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApprovalCenter } from './ApprovalCenter';
import { ApprovalsNavigation } from './ApprovalsNavigation';
afterEach(cleanup);
const permissions = [{ code: 'WEB_APPROVALS', canView: 'Y', canApprove: 'Y' }];
const request = { id: 4, referenceId: 9, requestType: 'LEAVE', employeeName: 'Alice', status: 'PENDING', currentStepNo: 1, version: 3 };
describe('Approvals parent module', () => {
  it('filters Leave on the server and resets pagination when switching submodule', async () => {
    const api = vi.fn(async () => ({ total: 21, data: [request] }));
    render(<ApprovalCenter api={api} permissions={permissions} module="LEAVE" />);
    expect(screen.getByLabelText('Đang tải phê duyệt')).toBeTruthy();
    await screen.findByText('Alice');
    expect(api.mock.calls.some(([path]) => path.includes('module=LEAVE'))).toBe(true);
    fireEvent.click(screen.getByText('Sau')); await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('page=2'))).toBe(true));
    await screen.findByText('Alice'); fireEvent.click(screen.getByRole('button', { name: 'Overtime' }));
    await waitFor(() => expect(api.mock.calls.some(([path]) => path.includes('module=OVERTIME') && path.includes('page=1'))).toBe(true));
    expect(screen.getByText('Approvals / Overtime')).toBeTruthy();
  });
  it('renders Leave details and only exposes decisions to the assigned user', async () => {
    const api = vi.fn(async (path, options) => options?.method ? {} : path === '/approvals/4' ? { request, steps: [{ id: 1, stepNo: 1, approverUserId: 'lead', approverEmployeeId: 12, decision: 'PENDING' }], details: { leaveTypeName: 'Annual', fromDate: '2027-01-04', toDate: '2027-01-05', requestedDays: 2, reason: 'Family' } } : path.includes('/history') ? { total: 0, data: [] } : { total: 1, data: [request] });
    const { rerender } = render(<ApprovalCenter api={api} permissions={permissions} userId="other" module="LEAVE" />);
    fireEvent.click(await screen.findByText('Chi tiết')); await screen.findByText('Family');
    expect(screen.getByText('2027-01-04 → 2027-01-05 · 2 ngày')).toBeTruthy(); expect(screen.queryByRole('button', { name: 'Duyệt' })).toBeNull();
    rerender(<ApprovalCenter api={api} permissions={permissions} userId="lead" module="LEAVE" />);
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Approved by assigned employee' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/approvals/4/approve', { method: 'POST', body: JSON.stringify({ version: 3, reason: 'Approved by assigned employee' }) }));
  });
  it('has an independent settings menu without requiring approval VIEW', () => {
    const navigate = vi.fn(); render(<ApprovalsNavigation permissions={[{ code: 'WEB_APPROVAL_SETTINGS', canView: 'Y' }]} page="approvalSettings" navigate={navigate} />);
    expect(screen.getByText('APPROVALS')).toBeTruthy(); expect(screen.queryByText('Leave')).toBeNull();
    fireEvent.click(screen.getByText('Cấu hình luồng duyệt ↗')); expect(navigate).toHaveBeenCalledWith('approvalSettings');
  });
  it('does not fetch without VIEW and shows failed list requests without fake rows', async () => {
    const api = vi.fn().mockRejectedValue(new Error('Approval API unavailable'));
    render(<ApprovalCenter api={api} permissions={[]} />); expect(api).not.toHaveBeenCalled(); cleanup();
    render(<ApprovalCenter api={api} permissions={permissions} module="LEAVE" />);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Approval API unavailable');
    expect(screen.queryByText(/Chưa có yêu cầu phê duyệt/)).toBeNull();
  });
});
