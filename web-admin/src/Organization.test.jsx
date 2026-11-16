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
  it('shows empty departments and teams with blank manager and lead names', async () => {
    const api = vi.fn(async path => path === '/organization/tree' ? [
      { id: 1, departmentName: 'Empty department', manager: null, employeeCount: 0, teamCount: 0, unassignedCount: 0, teams: [] },
      { id: 2, departmentName: 'Operations', manager: null, employeeCount: 0, teamCount: 1, unassignedCount: 0, teams: [{ id: 3, teamName: 'Empty team', lead: null, employeeCount: 0 }] }
    ] : { total: 0, data: [] });
    render(<Organization api={api} permissions={permissions} />);
    fireEvent.click(await screen.findByRole('button', { name: /Empty department/ }));
    expect(screen.getByText('Chưa có Team hoặc nhân viên trong phạm vi được xem.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Operations/ }));
    expect(screen.getAllByText('Trưởng phòng:').every(node => node.textContent.trim() === 'Trưởng phòng:')).toBe(true);
    expect(screen.getByText('Team Lead:').textContent.trim()).toBe('Team Lead:');
    expect(screen.queryByText(/Chưa có \/ ngoài phạm vi/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Empty team/ }));
    expect(await screen.findByText('Chưa có nhân viên trong phạm vi được xem.')).toBeTruthy();
  });
  it('displays manager and lead position names when provided', async () => {
    const api = vi.fn(async () => [{ ...department,
      manager: { id: 10, fullName: 'Alice', positionName: 'Engineering Manager' },
      teams: [{ ...department.teams[0], lead: { id: 11, fullName: 'Bob', positionName: 'Technical Lead' } }]
    }]);
    render(<Organization api={api} permissions={permissions} />);
    fireEvent.click(await screen.findByRole('button', { name: /Engineering/ }));
    expect(screen.getByText('Trưởng phòng: Alice · Engineering Manager')).toBeTruthy();
    expect(screen.getByText('Team Lead: Bob · Technical Lead')).toBeTruthy();
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
