import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { Organization } from './Organization';
afterEach(cleanup);
const permissions = ['WEB_ORGANIZATION'].map(code => ({ code, canView: 'Y' }));
const department = { id: 1, departmentName: 'Engineering', employeeCount: 21, teamCount: 1, unassignedCount: 1, manager: null, teams: [{ id: 2, teamName: 'Backend', employeeCount: 20, lead: null }] };
describe('Organization', () => {
  it('loads members only when expanded, paginates and opens profiles', async () => {
    const onEmployee = vi.fn();
    const api = vi.fn(async path => path === '/organization/tree' ? [department] : { total: 21, data: [{ id: 3, employeeCode: 'E3', fullName: 'Person', positionName: 'Developer', employmentStatus: 'ACTIVE' }] });
    render(<Organization api={api} permissions={permissions} onEmployee={onEmployee} />);
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Engineering/ }));
    expect(api).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Backend/ }));
    fireEvent.click(await screen.findByRole('link', { name: 'Xem hồ sơ' }));
    expect(onEmployee).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/teams/2/members?page=2&pageSize=20', expect.anything()));
    await screen.findByText('Person');
    fireEvent.click(screen.getByRole('button', { name: /Chưa phân nhóm/ }));
    await waitFor(() => expect(api).toHaveBeenCalledWith('/departments/1/unassigned-members?page=1&pageSize=20', expect.anything()));
  });
  it('retries errors and displays an empty tree', async () => {
    const api = vi.fn().mockRejectedValueOnce(new Error('Lỗi tải cây')).mockResolvedValue([]);
    render(<Organization api={api} permissions={permissions} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Chưa có phòng ban trong phạm vi được xem.')).toBeTruthy();
  });
  it('does not fetch without organization view grant', () => {
    const api = vi.fn(); render(<Organization api={api} permissions={[]} />);
    expect(api).not.toHaveBeenCalled();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });
});
