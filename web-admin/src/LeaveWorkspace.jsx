import React, { useEffect, useState } from 'react';
import { can, allPages } from './api';
import { LeaveBalances } from './LeaveBalances';
import { ApprovalCenter } from './approvals/ApprovalCenter';
import { WorkflowSettings } from './approvals/WorkflowSettings';
const screens = { leave: 'WEB_LEAVE_REQUESTS', overtime: 'WEB_OVERTIME_REQUESTS', adjustments: 'WEB_ATTENDANCE_ADJUSTMENTS', balances: 'WEB_LEAVE_BALANCES', types: 'WEB_LEAVE_TYPES' };
const paths = { leave: 'leave-requests', overtime: 'overtime-requests', adjustments: 'attendance-adjustments', balances: 'leave-balances', types: 'leave-types' };
const labels = { leave: 'Nghỉ phép', overtime: 'Tăng ca', adjustments: 'Điều chỉnh công', balances: 'Số dư phép', types: 'Loại nghỉ phép' };
const yearNow = () => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
const dateTime = value => value ? new Date(`${value}${/Z$|[+-]\d\d:\d\d$/.test(value) ? '' : 'Z'}`).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
export function LeaveWorkspace(props) {
  // Compatibility for callers using the former embedded Approval Center.
  return props.mode === 'approvals' ? <ApprovalCenter {...props} /> : <LeaveRequestsWorkspace {...props} />;
}
function LeaveRequestsWorkspace({ api, permissions, userId, mode }) {
  const allowed = key => can(permissions, key === 'balances' && mode !== 'my' ? 'WEB_LEAVE_MANAGEMENT' : screens[key], 'VIEW');
  const hasSettingsView = mode === 'manage' && can(permissions, 'WEB_APPROVAL_SETTINGS', 'VIEW');
  const keys = mode === 'manage' ? ['leave', 'overtime', 'adjustments', 'balances', 'types'] : ['leave', 'overtime', 'adjustments', 'balances'];
  const [tab, setTab] = useState(keys.find(allowed) || keys[0]), [page, setPage] = useState(1), [status, setStatus] = useState(''), [year, setYear] = useState(yearNow), [employee, setEmployee] = useState('');
  const [result, setResult] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [form, setForm] = useState(null), [busy, setBusy] = useState(false), [detail, setDetail] = useState(null), [reason, setReason] = useState('');
  const [types, setTypes] = useState(null);
  const view = mode === 'my' ? 'MY' : mode === 'team' ? 'TEAM' : 'ALL';
  useEffect(() => { setPage(1); setDetail(null); setForm(null); }, [tab, status, year, employee]);
  useEffect(() => {
    if (tab === 'balances' || !allowed(tab)) { setResult(null); setLoading(false); return; }
    const abort = new AbortController(); setLoading(true); setError(''); setResult(null);
    const query = new URLSearchParams({ page, pageSize: 20, view });
    if (status && !['types', 'balances'].includes(tab)) query.set('status', status);
    if (['balances', 'leave'].includes(tab)) query.set('year', year);
    if (employee && view !== 'MY') query.set('employeeId', employee);
    api(`/${paths[tab]}?${query}`, { signal: abort.signal }).then(setResult).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [api, tab, page, status, year, employee, revision, view, permissions]);
  useEffect(() => {
    if (!form || !['leave', 'balances'].includes(tab) || !allowed('types')) return;
    const abort = new AbortController(); setTypes(null);
    allPages(api, '/leave-types', abort.signal).then(setTypes).catch(e => { if (!abort.signal.aborted) setError(e.message); });
    return () => abort.abort();
  }, [api, !!form, tab, revision, permissions]);
  function typeField(value) {
    return allowed('types') ? <label>Loại phép<select name="leaveTypeId" required defaultValue={value || ''} disabled={!types}><option value="">{types ? 'Chọn loại phép' : 'Đang tải loại phép…'}</option>{types?.filter(t => t.isActive || t.id === value).map(t => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}</select></label> : <Field name="leaveTypeId" label="ID loại phép" type="number" min="1" defaultValue={value} />;
  }
  async function perform(path, method, body) {
    setBusy(true); setError('');
    try { const value = await api(path, { method, body: JSON.stringify(body) }); setForm(null); setDetail(null); setRevision(n => n + 1); return value; }
    catch (e) { setError(e.message); return null; } finally { setBusy(false); }
  }
  async function open(row) {
    setBusy(true); setError(''); setDetail(null); setReason('');
    try {
      setDetail({ record: ['leave', 'overtime'].includes(tab) ? await api(`/${paths[tab]}/${row.id}`) : row });
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault(); const fields = Object.fromEntries(new FormData(event.currentTarget)); let body = fields;
    if (tab === 'leave') body = { ...fields, leaveTypeId: Number(fields.leaveTypeId) };
    if (tab === 'overtime') body = { ...fields, startAt: new Date(fields.startAt).toISOString(), endAt: new Date(fields.endAt).toISOString() };
    if (tab === 'adjustments') body = { ...fields, attendanceId: Number(fields.attendanceId), proposedCheckIn: fields.proposedCheckIn ? new Date(fields.proposedCheckIn).toISOString() : null, proposedCheckOut: fields.proposedCheckOut ? new Date(fields.proposedCheckOut).toISOString() : null };
    if (tab === 'balances') body = { employeeId: Number(fields.employeeId), leaveTypeId: Number(fields.leaveTypeId), year: Number(fields.year), entitledDays: Number(fields.entitledDays), version: form.version || 0 };
    if (tab === 'types') body = { ...fields, paid: fields.paid === 'on', requiresBalance: fields.requiresBalance === 'on', isActive: fields.isActive === 'on' };
    await perform(`/${paths[tab]}${tab === 'types' && form.id ? `/${form.id}` : ''}`, tab === 'balances' || form.id ? 'PUT' : 'POST', body);
  }
  const title = { my: 'My Leave', team: 'Team Leave', manage: 'Leave Management' }[mode];
  const row = detail?.record;
  return <section className="leave-workspace"><div className="page-title"><div><span className="eyebrow">HUMAN RESOURCES</span><h1>{title}</h1><p>Yêu cầu và phê duyệt theo phạm vi được phân quyền.</p></div></div>
    <div className="toolbar">{keys.filter(allowed).map(key => <button className={key === tab ? '' : 'subtle'} key={key} onClick={() => setTab(key)}>{labels[key]}</button>)}</div>
    {!keys.some(allowed) ? (!hasSettingsView && <p role="alert">Bạn chưa có quyền xem màn hình này.</p>) : tab === 'balances' ? <LeaveBalances api={api} permissions={permissions} view={view} embedded /> : <>
    <div className="toolbar">{!['types', 'balances'].includes(tab) && <label>Trạng thái<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả</option>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'CANCELLATION_PENDING'].map(s => <option key={s}>{s}</option>)}</select></label>}{['leave', 'balances'].includes(tab) && <label>Năm<input type="number" min="1900" max="9999" value={year} onChange={e => setYear(e.target.value)} /></label>}{view !== 'MY' && tab !== 'types' && <label>ID nhân viên<input type="number" min="1" value={employee} onChange={e => setEmployee(e.target.value)} /></label>}
    {((mode === 'my' && ['leave', 'overtime', 'adjustments'].includes(tab) && can(permissions, screens[tab], 'NEW')) || (mode === 'manage' && can(permissions, screens[tab], tab === 'balances' ? 'UPDATE' : 'NEW') && ['types', 'balances'].includes(tab))) && <button onClick={() => { setForm({}); setDetail(null); setError(''); }}>Tạo {labels[tab].toLowerCase()}</button>}
    <button className="subtle" onClick={() => setRevision(n => n + 1)}>Tải lại</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {form && <form className="card editor" onSubmit={submit}><h2>{form.id ? 'Chỉnh sửa' : 'Tạo'} {labels[tab]}</h2>
      {tab === 'leave' && <>{typeField()}<Field name="fromDate" label="Từ ngày" type="date" /><Field name="toDate" label="Đến ngày" type="date" /></>}
      {tab === 'overtime' && <><Field name="startAt" label="Bắt đầu (giờ địa phương trình duyệt)" type="datetime-local" /><Field name="endAt" label="Kết thúc (giờ địa phương trình duyệt)" type="datetime-local" /></>}
      {tab === 'adjustments' && <><Field name="attendanceId" label="ID bản ghi chấm công" type="number" min="1" /><Field name="proposedCheckIn" label="Giờ vào đề xuất (giờ địa phương)" type="datetime-local" required={false} /><Field name="proposedCheckOut" label="Giờ ra đề xuất (giờ địa phương)" type="datetime-local" required={false} /><p>Đề xuất là toàn bộ cặp giờ vào/ra; bỏ trống một giờ để xóa giờ đó.</p></>}
      {['leave', 'overtime', 'adjustments'].includes(tab) && <Field name="reason" label="Lý do" maxLength="1000" />}
      {tab === 'balances' && <><Field name="employeeId" label="ID nhân viên" type="number" min="1" defaultValue={form.employeeId} />{typeField(form.leaveTypeId)}<Field name="year" label="Năm" type="number" min="1900" max="9999" defaultValue={form.year || year} /><Field name="entitledDays" label="Tổng ngày được cấp" type="number" min="0" step="0.5" defaultValue={form.entitledDays} /><p>Đã dùng và đang giữ chỗ được hệ thống quản lý.</p></>}
      {tab === 'types' && <><Field name="code" label="Mã loại phép" pattern="[A-Z0-9][A-Z0-9_-]*" defaultValue={form.code} /><Field name="name" label="Tên" defaultValue={form.name} />{[['paid', 'Có lương'], ['requiresBalance', 'Kiểm tra số dư'], ['isActive', 'Đang hoạt động']].map(([name, label]) => <label className="checkbox" key={name}><input type="checkbox" name={name} defaultChecked={form[name] ?? name !== 'paid'} />{label}</label>)}</>}
      <div className="toolbar"><button disabled={busy || (['leave', 'balances'].includes(tab) && allowed('types') && !types)}>Lưu</button><button type="button" className="subtle" onClick={() => setForm(null)}>Đóng</button></div></form>}
    {loading ? <div className="card org-skeleton" aria-label="Đang tải" role="status"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div> : result && <div className="card table-wrap"><table><thead><tr><th>ID / Nhân viên</th><th>Nội dung</th><th>Trạng thái / Số dư</th><th>Thao tác</th></tr></thead><tbody>{result.data.map(r => <tr key={r.id}><td>{r.id}{r.employeeName && <><br />{r.employeeName}</>}</td><td>{tab === 'leave' ? `${r.leaveTypeName}: ${r.fromDate} → ${r.toDate} (${r.requestedDays} ngày)` : tab === 'overtime' ? `${dateTime(r.startAt)} → ${dateTime(r.endAt)} (${r.requestedHours} giờ; duyệt ${r.approvedHours ?? '—'})` : tab === 'adjustments' ? `Công #${r.attendanceId}: ${dateTime(r.proposedCheckIn)} → ${dateTime(r.proposedCheckOut)}` : tab === 'balances' ? `${r.leaveTypeName} / ${r.year}` : `${r.code} · ${r.name}`}</td><td>{tab === 'balances' ? `Còn ${r.availableDays} / ${r.entitledDays}; giữ ${r.reservedDays}; dùng ${r.usedDays}` : tab === 'types' ? r.isActive ? 'Hoạt động' : 'Ngừng' : r.status}</td><td>{['types', 'balances'].includes(tab) ? mode === 'manage' && can(permissions, screens[tab], 'UPDATE') && <button className="subtle" onClick={() => setForm(r)}>Sửa</button> : <button className="subtle" disabled={busy} onClick={() => open(r)}>Chi tiết</button>}</td></tr>)}</tbody></table>{!result.data.length && <p>Chưa có dữ liệu trong phạm vi được xem.</p>}<Pager page={page} total={result.total} onChange={setPage} /></div>}
    {detail && <div className="card editor"><h2>Chi tiết #{row?.id}</h2><><p>{row.reason}</p><p>{row.status} · phiên bản {row.version}</p>{row.fromDate && <p>{row.fromDate} → {row.toDate} · {row.requestedDays} ngày</p>}{row.startAt && <p>{dateTime(row.startAt)} → {dateTime(row.endAt)}</p>}{row.attendanceId && <p>Công #{row.attendanceId}: {dateTime(row.proposedCheckIn)} → {dateTime(row.proposedCheckOut)}</p>}{mode === 'my' && can(permissions, screens[tab], 'UPDATE') && (row.status === 'PENDING' || (tab === 'leave' && row.status === 'APPROVED')) && <form onSubmit={e => { e.preventDefault(); perform(`/${paths[tab]}/${row.id}/cancel`, 'POST', { version: row.version, reason }); }}><label>Lý do hủy<input required maxLength="1000" value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={busy}>Hủy / Yêu cầu hủy</button></form>}</><button className="subtle" onClick={() => setDetail(null)}>Đóng</button></div>}
    </>}{mode === 'manage' && !keys.some(allowed) && <WorkflowSettings api={api} permissions={permissions} />}</section>;
}
function Field({ label, required = true, ...props }) { return <label>{label}<input required={required} {...props} /></label>; }
function Pager({ page, total, onChange }) { return <div className="toolbar"><button className="subtle" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(total / 20))} · {total} kết quả</span><button className="subtle" disabled={page * 20 >= total} onClick={() => onChange(page + 1)}>Sau</button></div>; }
