import React, { useEffect, useState } from 'react';
import { can } from './api';
import { EmployeeEditor } from './EmployeeEditor';

export function Employees({ api, permissions }) {
  const [data, setData] = useState({ data: [], total: 0 }), [page, setPage] = useState(1), [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0), [editor, setEditor] = useState(null), [detail, setDetail] = useState(null);
  useEffect(() => {
    if (!can(permissions, 'WEB_EMPLOYEES', 'VIEW')) return;
    const controller = new AbortController(); setLoading(true); setError('');
    const query = new URLSearchParams({ page, pageSize: 20, search });
    api(`/employees?${query}`, { signal: controller.signal }).then(setData).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, permissions, page, search, revision]);
  async function open(row, edit) {
    setError('');
    try { const employee = await api(`/employees/${row.id}`); if (edit) setEditor({ employee }); else setDetail(employee); }
    catch (err) { setError(err.message); }
  }
  return <><div className="page-title"><div><span className="eyebrow">EMPLOYEES</span><h1>Đội ngũ nhân sự</h1><p>Hồ sơ và vị trí của mỗi người trong tổ chức.</p></div>{can(permissions, 'WEB_EMPLOYEES', 'NEW') && <button onClick={() => setEditor({ employee: null })}>+ Thêm nhân viên</button>}</div>
    <section className="card"><div className="toolbar"><input aria-label="Tìm nhân viên" placeholder="Tìm mã, tên hoặc email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /><small>{data.total} nhân viên</small></div>
      {error && <p className="error" role="alert">{error}</p>}{!can(permissions, 'WEB_EMPLOYEES', 'VIEW') ? <p className="empty">Bạn chưa có quyền xem nhân viên.</p> : loading ? <p role="status" className="empty">Đang tải nhân viên…</p> : <div className="table-wrap"><table><thead><tr><th>Mã nhân viên</th><th>Họ và tên</th><th>Phòng ban</th><th>Team</th><th>Vị trí</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.data.map(employee => <tr key={employee.id}>
        <td className="code">{employee.employeeCode}</td><td><strong>{employee.fullName}</strong><small>{employee.email}</small></td><td>{employee.departmentName ?? 'Chưa gán phòng ban'}</td><td>{employee.teamName ?? 'Chưa gán Team'}</td><td>{employee.positionName ?? 'Chưa gán vị trí'}</td><td>{employee.employmentStatus}</td><td><button className="subtle" onClick={() => open(employee, false)}>Chi tiết</button>{can(permissions, 'WEB_EMPLOYEES', 'UPDATE') && <button className="subtle" onClick={() => open(employee, true)}>Sửa</button>}</td>
      </tr>)}</tbody></table>{!data.data.length && <p className="empty">Chưa có dữ liệu phù hợp.</p>}</div>}
      <div className="pager"><span>Trang {page}</span><button className="subtle" disabled={loading || page <= 1} onClick={() => setPage(x => x - 1)}>Trước</button><button className="subtle" disabled={loading || page * 20 >= data.total} onClick={() => setPage(x => x + 1)}>Sau</button></div></section>
    {detail && <section className="card editor"><div className="section-title"><h2>Chi tiết nhân viên</h2><button className="subtle" onClick={() => setDetail(null)}>Đóng</button></div><label>Mã nhân viên<input value={detail.employeeCode} readOnly /></label><dl><dt>Họ và tên</dt><dd>{detail.fullName}</dd><dt>Email</dt><dd>{detail.email}</dd><dt>Phòng ban</dt><dd>{detail.departmentName ?? 'Chưa gán phòng ban'}</dd><dt>Team</dt><dd>{detail.teamName ?? 'Chưa gán Team'}</dd><dt>Vị trí</dt><dd>{detail.positionName ?? 'Chưa gán vị trí'}</dd></dl></section>}
    {editor && <EmployeeEditor key={editor.employee?.id || 'new'} api={api} permissions={permissions} employee={editor.employee} onClose={() => setEditor(null)} onSaved={() => setRevision(x => x + 1)} />}
  </>;
}
