import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Employees } from './Employees';
import { EmployeeEditor } from './EmployeeEditor';
afterEach(cleanup);
const permissions = [{ code: 'WEB_EMPLOYEES', canView: 'Y', canNew: 'Y', canUpdate: 'Y' }];
const employee = { id: 7, employeeCode: 'NV000007', fullName: 'Actual employee', email: 'employee@example.invalid', departmentId: 3, departmentName: 'Backend Department', teamId: 9, teamName: 'Backend Team', positionId: 2, positionName: 'Backend Position', employmentStatus: 'ACTIVE', hireDate: '2020-01-01' };
function mockApi(row = employee) {
  return vi.fn(async (path, options = {}) => {
    if (path.startsWith('/employees?')) return { success: true, data: [row], total: 1, page: 1, pageSize: 20 };
    if (path === '/employees/7') return row;
    if (path.startsWith('/departments')) return { data: [{ id: 3, departmentName: 'Dropdown Department', isActive: true }], total: 1 };
    if (path.startsWith('/teams')) return { data: [{ id: 9, departmentId: 3, teamName: 'Dropdown Team' }], total: 1 };
    if (path.startsWith('/positions')) return { data: [{ id: 2, name: 'Dropdown Position', isActive: true }], total: 1 };
    throw new Error('Unexpected API request');
  });
}
describe('Employee names from response', () => {
  it('renders all three backend names without fetching or joining catalogs', async () => {
    const api = mockApi(); render(<Employees api={api} permissions={permissions} />);
    await screen.findByText('Backend Department'); screen.getByText('Backend Team'); screen.getByText('Backend Position');
    expect(api.mock.calls).toHaveLength(1); expect(api.mock.calls[0][0]).toMatch(/^\/employees\?/);
    expect(api.mock.calls.some(([path]) => /^\/(departments|teams|positions)/.test(path))).toBe(false);
  });
  it('renders null names safely without inventing names or looking up IDs', async () => {
    const api = mockApi({ ...employee, departmentName: null, teamId: null, teamName: null, positionId: null, positionName: null });
    render(<Employees api={api} permissions={permissions} />);
    await screen.findByText('Chưa gán phòng ban'); screen.getByText('Chưa gán Team'); screen.getByText('Chưa gán vị trí');
    expect(api.mock.calls).toHaveLength(1);
  });
  it('loads detail with the same names and readonly code, still without catalog requests', async () => {
    const api = mockApi(), user = userEvent.setup(); render(<Employees api={api} permissions={permissions} />);
    await screen.findByText('Actual employee'); await user.click(screen.getByRole('button', { name: 'Chi tiết' }));
    await screen.findByRole('heading', { name: 'Chi tiết nhân viên' });
    expect(screen.getAllByText('Backend Department')).toHaveLength(2); expect(screen.getAllByText('Backend Position')).toHaveLength(2);
    expect(screen.getByLabelText('Mã nhân viên').readOnly).toBe(true);
    expect(api.mock.calls.map(([path]) => path)).toEqual([expect.stringMatching(/^\/employees\?/), '/employees/7']);
  });
  it('loads Departments, Teams, Positions only when editor opens for dropdowns', async () => {
    const api = mockApi(), user = userEvent.setup();
    const editorPermissions = [...permissions, ...['WEB_DEPARTMENTS', 'WEB_TEAMS', 'WEB_POSITIONS'].map(code => ({ code, canView: 'Y' }))];
    render(<Employees api={api} permissions={editorPermissions} />);
    await screen.findByText('Backend Department'); expect(api.mock.calls).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Sửa' }));
    await screen.findByRole('option', { name: 'Dropdown Department' }); await screen.findByRole('option', { name: 'Dropdown Position' }); await screen.findByRole('option', { name: 'Dropdown Team' });
    expect(api.mock.calls.some(([path]) => path.startsWith('/departments'))).toBe(true);
    expect(api.mock.calls.some(([path]) => path.startsWith('/teams?departmentId=3'))).toBe(true);
    expect(api.mock.calls.some(([path]) => path.startsWith('/positions'))).toBe(true);
    // List labels remain backend response names even when dropdown labels differ.
    screen.getByText('Backend Department'); screen.getByText('Backend Position');
  });
  it('does not fetch employee data without VIEW and hides edits without UPDATE', async () => {
    const api = mockApi(); const view = render(<Employees api={api} permissions={[]} />);
    await screen.findByText('Bạn chưa có quyền xem nhân viên.'); expect(api).not.toHaveBeenCalled(); view.unmount();
    render(<Employees api={api} permissions={[{ code: 'WEB_EMPLOYEES', canView: 'Y' }]} />);
    await screen.findByText('Backend Team'); expect(screen.queryByRole('button', { name: 'Sửa' })).toBeNull();
  });
  it('supports clearing optional PositionId while keeping names out of write payload', async () => {
    const api = mockApi(), user = userEvent.setup();
    const editorPermissions = [...permissions, ...['WEB_DEPARTMENTS', 'WEB_TEAMS', 'WEB_POSITIONS'].map(code => ({ code, canView: 'Y' }))];
    render(<EmployeeEditor api={api} permissions={editorPermissions} employee={employee} onClose={() => {}} onSaved={() => {}} />);
    await screen.findByRole('option', { name: 'Dropdown Position' }); await screen.findByRole('option', { name: 'Dropdown Team' });
    await user.selectOptions(screen.getByLabelText('Vị trí'), ''); await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }));
    await waitFor(() => expect(api.mock.calls.some(([, options]) => options.method === 'PUT')).toBe(true));
    const body = JSON.parse(api.mock.calls.find(([, options]) => options.method === 'PUT')[1].body);
    expect(body.positionId).toBeNull(); expect(body).not.toHaveProperty('positionName'); expect(body).not.toHaveProperty('departmentName'); expect(body).not.toHaveProperty('employeeCode');
  });
});
