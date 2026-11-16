import React, { useEffect, useState } from 'react';
import { can } from './api';

function Skeleton() { return <div role="status" aria-label="Đang tải" className="org-skeleton"><div /><div /><div /></div>; }
function ErrorState({ error, retry }) { return <div role="alert" className="error">{error} <button className="subtle" onClick={retry}>Thử lại</button></div>; }
function Members({ api, path, onEmployee }) {
  const [page, setPage] = useState(1), [result, setResult] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setResult(null); setError('');
    api(`${path}?page=${page}&pageSize=20`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [api, path, page, revision]);
  if (error) return <ErrorState error={error} retry={() => setRevision(x => x + 1)} />;
  if (!result) return <Skeleton />;
  return <div className="org-members"><div className="table-wrap"><table><thead><tr><th>Mã nhân viên</th><th>Họ tên</th><th>Chức vụ</th><th>Trạng thái</th><th>Hồ sơ</th></tr></thead><tbody>{result.data.map(e => <tr key={e.id}><td className="code">{e.employeeCode}</td><td>{e.fullName}</td><td>{e.positionName || 'Chưa có chức vụ'}</td><td>{e.employmentStatus}</td><td><a href={`#employees/${e.id}`} onClick={event => { if (onEmployee) { event.preventDefault(); onEmployee(e.id); } }}>Xem hồ sơ</a></td></tr>)}</tbody></table></div>{!result.data.length && <p className="empty">Chưa có nhân viên trong phạm vi được xem.</p>}<div className="pager"><span>Trang {page} · {result.total} nhân viên</span><button className="subtle" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</button><button className="subtle" disabled={page * 20 >= result.total} onClick={() => setPage(p => p + 1)}>Sau</button></div></div>;
}
function TeamNode({ api, team, departmentId, onEmployee }) {
  const [open, setOpen] = useState(false);
  const name = team?.teamName || 'Chưa phân nhóm';
  return <div className="org-team"><button className="subtle org-node" aria-expanded={open} onClick={() => setOpen(x => !x)}><span aria-hidden="true">{open ? '▾' : '▸'}</span><strong>{name}</strong>{team && <span>Team Lead: {team.lead?.fullName ?? ''}</span>}<span>{team?.employeeCount ?? departmentId.count} nhân viên</span></button>{open && <Members api={api} path={team ? `/teams/${team.id}/members` : `/departments/${departmentId.id}/unassigned-members`} onEmployee={onEmployee} />}</div>;
}
function DepartmentNode({ api, department: d, onEmployee }) {
  const [open, setOpen] = useState(false);
  return <section className="card org-department"><button className="subtle org-node" aria-expanded={open} onClick={() => setOpen(x => !x)}><span aria-hidden="true">{open ? '▾' : '▸'}</span><strong>{d.departmentName}</strong><span>Trưởng phòng: {d.manager?.fullName ?? ''}</span><span>{d.employeeCount} nhân viên</span><span>{d.teamCount} Team</span></button>{open && <div className="org-branches">{d.teams.map(t => <TeamNode key={t.id} api={api} team={t} onEmployee={onEmployee} />)}{d.unassignedCount > 0 && <TeamNode api={api} departmentId={{ id: d.id, count: d.unassignedCount }} onEmployee={onEmployee} />}{!d.teams.length && !d.unassignedCount && <p className="empty">Chưa có Team hoặc nhân viên trong phạm vi được xem.</p>}</div>}</section>;
}
function Catalog({ api, tab }) {
  const [page, setPage] = useState(1), [result, setResult] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setResult(null); setError('');
    api(`/${tab}?page=${page}&pageSize=20`, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setResult(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [api, tab, page, revision]);
  if (error) return <ErrorState error={error} retry={() => setRevision(x => x + 1)} />;
  if (!result) return <Skeleton />;
  return <section className="card"><div className="table-wrap"><table><thead><tr><th>Mã</th><th>Tên</th>{tab === 'teams' && <th>Phòng ban</th>}<th>Trạng thái</th></tr></thead><tbody>{result.data.map(row => <tr key={row.id}><td>{row.teamCode || row.code}</td><td>{row.teamName || row.name}</td>{tab === 'teams' && <td>{row.departmentName}</td>}<td>{row.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}</td></tr>)}</tbody></table></div>{!result.data.length && <p className="empty">Chưa có dữ liệu.</p>}<div className="pager"><span>Trang {page}</span><button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Trước</button><button disabled={page * 20 >= result.total} onClick={() => setPage(p => p + 1)}>Sau</button></div></section>;
}
export function Organization({ api, permissions, onEmployee }) {
  const [tab, setTab] = useState('departments'), [tree, setTree] = useState(null), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const treeAllowed = can(permissions, 'WEB_ORGANIZATION', 'VIEW');
  useEffect(() => {
    if (tab !== 'departments' || !treeAllowed) return;
    const controller = new AbortController(); setTree(null); setError('');
    api('/organization/tree', { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setTree(data); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [api, tab, treeAllowed, permissions, revision]);
  return <><div className="page-title"><div><span className="eyebrow">HUMAN RESOURCES / ORGANIZATION</span><h1>Cơ cấu tổ chức</h1><p>Phòng ban, Teams và nhân viên trong phạm vi bạn được xem.</p></div></div><div role="tablist" aria-label="Organization" className="toolbar">{[['departments', 'Phòng ban'], ['teams', 'Teams'], ['positions', 'Chức vụ']].map(([key, name]) => <button role="tab" aria-selected={tab === key} className={tab === key ? '' : 'subtle'} key={key} onClick={() => setTab(key)}>{name}</button>)}</div><div role="tabpanel">{tab === 'departments' ? !treeAllowed ? <p className="empty">Cần quyền WEB_ORGANIZATION / VIEW.</p> : error ? <ErrorState error={error} retry={() => setRevision(x => x + 1)} /> : !tree ? <Skeleton /> : tree.length ? tree.map(d => <DepartmentNode key={d.id} api={api} department={d} onEmployee={onEmployee} />) : <p className="empty">Chưa có phòng ban trong phạm vi được xem.</p> : can(permissions, tab === 'teams' ? 'WEB_TEAMS' : 'WEB_POSITIONS', 'VIEW') ? <Catalog key={tab} api={api} tab={tab} /> : <p className="empty">Bạn chưa có quyền xem.</p>}</div></>;
}
