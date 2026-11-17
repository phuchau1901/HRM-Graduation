import React, { useEffect, useState } from 'react';
import { allPages, can } from './api';
const businessYear = () => new Intl.DateTimeFormat('en', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric' }).format(new Date());
function newOperationId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // getRandomValues is also available on HTTP development origins.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function LeaveBalances({ api, permissions, view = 'ALL', embedded = false }) {
  const screen = view === 'MY' ? 'WEB_LEAVE_BALANCES' : 'WEB_LEAVE_MANAGEMENT';
  const visible = can(permissions, screen, 'VIEW');
  const manage = view === 'ALL' && can(permissions, 'WEB_LEAVE_MANAGEMENT', 'UPDATE');
  const [year, setYear] = useState(businessYear), [department, setDepartment] = useState(''), [type, setType] = useState(''), [search, setSearch] = useState(''), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [summary, setSummary] = useState(null);
  const [result, setResult] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null), [target, setTarget] = useState('EMPLOYEE'), [types, setTypes] = useState(null), [history, setHistory] = useState(null), [historyId, setHistoryId] = useState(null), [historyPage, setHistoryPage] = useState(1);
  useEffect(() => { setPage(1); setHistory(null); setHistoryId(null); }, [year, department, type, search, view]);
  useEffect(() => {
    if (!visible) { setResult(null); return; }
    const abort = new AbortController(); setLoading(true); setError(''); setResult(null); setSummary(null);
    const q = new URLSearchParams({ view, year, page, pageSize: 20 });
    if (department) q.set('departmentId', department);
    if (type) q.set('leaveTypeId', type);
    if (search.trim()) q.set('search', search.trim());
    const mine = new URLSearchParams({ year }); if (type) mine.set('leaveTypeId', type);
    api(view === 'MY' ? `/leave-balances/me?${mine}` : `/leave-balances?${q}`, { signal: abort.signal }).then(value => { if (view === 'MY') { setSummary(value.data); setResult({ total: value.data.balances.length, data: value.data.balances.slice((page - 1) * 20, page * 20) }); } else setResult(value); }).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [api, visible, permissions, view, year, department, type, search, page, refresh]);
  useEffect(() => {
    if (!form || !can(permissions, 'WEB_LEAVE_TYPES', 'VIEW')) return;
    const abort = new AbortController(); setTypes(null);
    allPages(api, '/leave-types', abort.signal).then(setTypes).catch(e => { if (!abort.signal.aborted) setError(e.message); }); return () => abort.abort();
  }, [api, !!form, permissions]);
  function openForm(kind, row) { setForm({ kind, row, operationId: kind === 'grant' ? newOperationId() : null }); setTarget('EMPLOYEE'); setError(''); setSuccess(''); }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setSuccess(''); const values = Object.fromEntries(new FormData(event.currentTarget)); let path, method, body;
    if (form.kind === 'grant') {
      path = '/leave-balances/grants'; method = 'POST'; body = { operationId: form.operationId, target, leaveTypeId: Number(values.leaveTypeId), year: Number(values.year), entitledDays: Number(values.entitledDays), carriedOverDays: Number(values.carriedOverDays), reason: values.reason };
      if (target === 'EMPLOYEE') body.employeeId = Number(values.employeeId);
      if (target === 'DEPARTMENT') body.departmentId = Number(values.departmentId);
    } else if (form.kind === 'adjust') {
      path = `/leave-balances/${form.row.id}/adjustments`; method = 'POST'; body = { version: form.row.version, days: Number(values.days), reason: values.reason };
    } else {
      path = '/leave-balances'; method = 'PUT'; body = { employeeId: form.row.employeeId, leaveTypeId: form.row.leaveTypeId, year: form.row.year, version: form.row.version, entitledDays: Number(values.entitledDays), carriedOverDays: Number(values.carriedOverDays), reason: values.reason };
    }
    try {
      const response = await api(path, { method, body: JSON.stringify(body) });
      setSuccess(form.kind === 'grant' ? `Đã cấp ${response.created}/${response.selected} nhân viên; bỏ qua ${response.skipped} số dư đã tồn tại.` : 'Đã cập nhật số dư phép.');
      setForm(null); setHistory(null); setHistoryId(null); setRefresh(n => n + 1);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function loadHistory(id, next = 1) {
    setBusy(true); setError(''); setHistory(null);
    try { setHistory(await api(`/leave-balances/${id}/history?page=${next}&pageSize=20`)); setHistoryId(id); setHistoryPage(next); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!visible) return <p role="alert">Bạn chưa có quyền {screen} / VIEW.</p>;
  return <section className="leave-workspace"><div className="page-title"><div><span className="eyebrow">HUMAN RESOURCES</span><h1>{embedded ? 'Số dư phép' : 'Leave Balance Management'}</h1><p>Còn lại = được cấp + chuyển năm + điều chỉnh − đã dùng. Khả dụng = còn lại − đang chờ duyệt.</p></div>{manage && <button onClick={() => openForm('grant')}>Cấp phép</button>}</div>
    <div className="toolbar"><label>Năm số dư<input type="number" min="1900" max="9999" value={year} onChange={e => setYear(e.target.value)} /></label><label>ID loại phép lọc<input type="number" min="1" value={type} onChange={e => setType(e.target.value)} /></label>{view !== 'MY' && <><label>ID phòng ban lọc<input type="number" min="1" value={department} onChange={e => setDepartment(e.target.value)} /></label><label>Tìm nhân viên<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tên hoặc mã nhân viên" maxLength="150" /></label></>}<button className="subtle" onClick={() => setRefresh(n => n + 1)}>Tải lại số dư</button></div>
    {summary && <div className="contract-statistics">{[['Hiện có (tổng cấp)', summary.totalDays], ['Đã sử dụng', summary.usedDays], ['Còn lại', summary.remainingDays]].map(([label, value]) => <div key={label}>{label}<output>{value}</output></div>)}</div>}
    {error && <p className="error" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}
    {form && manage && <form className="card editor" onSubmit={save}><h2>{form.kind === 'grant' ? 'Cấp phép mới' : form.kind === 'adjust' ? 'Điều chỉnh số dư' : 'Sửa cấp phép / chuyển năm'}</h2>
      {form.row && <p>{form.row.employeeName} · {form.row.leaveTypeName} · {form.row.year}</p>}
      {form.kind === 'grant' && <><label>Đối tượng cấp<select value={target} onChange={e => setTarget(e.target.value)}><option value="EMPLOYEE">Một nhân viên</option><option value="DEPARTMENT">Một phòng ban</option><option value="ALL">Toàn bộ nhân viên trong phạm vi quản lý</option></select></label>{target === 'EMPLOYEE' && <NumberField label="ID nhân viên nhận phép" name="employeeId" min="1" />}{target === 'DEPARTMENT' && <NumberField label="ID phòng ban nhận phép" name="departmentId" min="1" />}{can(permissions, 'WEB_LEAVE_TYPES', 'VIEW') ? <label>Loại phép cấp<select name="leaveTypeId" required disabled={!types}><option value="">{types ? 'Chọn loại phép' : 'Đang tải…'}</option>{types?.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.code} · {t.name}</option>)}</select></label> : <NumberField label="ID loại phép cấp" name="leaveTypeId" min="1" />}<NumberField label="Năm cấp phép" name="year" min="1900" max="9999" defaultValue={year} /><p>Chỉ tạo số dư chưa tồn tại. Số dư cũ được giữ nguyên. Nếu lỗi mạng, gửi lại cùng nội dung để tránh cấp trùng.</p></>}
      {form.kind === 'adjust' ? <NumberField label="Số ngày điều chỉnh (+ / −)" name="days" min="-99999" max="99999" step="0.01" /> : <><NumberField label="Số ngày được cấp" name="entitledDays" min="0" max="99999" step="0.01" defaultValue={form.row?.entitledDays ?? ''} /><NumberField label="Số ngày chuyển năm" name="carriedOverDays" min="0" max="99999" step="0.01" defaultValue={form.row?.carriedOverDays ?? 0} /><p>Chuyển năm được nhập theo chính sách đã duyệt, không tự chuyển hoặc tự hết hạn.</p></>}
      <label>Lý do<input name="reason" required maxLength="1000" /></label><div className="toolbar"><button disabled={busy || (form.kind === 'grant' && can(permissions, 'WEB_LEAVE_TYPES', 'VIEW') && !types)}>Lưu số dư</button><button type="button" className="subtle" disabled={busy} onClick={() => setForm(null)}>Đóng biểu mẫu</button></div></form>}
    {loading ? <div role="status" aria-label="Đang tải số dư" className="card org-skeleton"><div /><div /><div /></div> : result && <div className="card table-wrap"><table><thead><tr>{['Nhân viên', 'Năm / Loại phép', 'Được cấp', 'Chuyển năm', 'Điều chỉnh', 'Đã dùng', 'Đang chờ duyệt', 'Còn lại', 'Khả dụng', 'Thao tác'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{result.data.map(r => <tr key={r.id}><td>{r.employeeName}<small>ID {r.employeeId}</small></td><td>{r.year} / {r.leaveTypeName}</td><td>{r.entitledDays}</td><td>{r.carriedOverDays}</td><td>{r.adjustmentDays}</td><td>{r.usedDays}</td><td>{r.reservedDays}</td><td>{r.remainingDays}</td><td>{r.availableDays}</td><td>{can(permissions, 'WEB_LEAVE_MANAGEMENT', 'VIEW') && <button className="subtle" disabled={busy} onClick={() => loadHistory(r.id)}>Lịch sử</button>}{manage && <><button className="subtle" disabled={busy} onClick={() => openForm('edit', r)}>Sửa cấp phép</button><button className="subtle" disabled={busy} onClick={() => openForm('adjust', r)}>Điều chỉnh</button></>}</td></tr>)}</tbody></table>{!result.data.length && <p className="empty">Chưa có số dư phép trong phạm vi được xem.</p>}<Pages page={page} total={result.total} change={setPage} busy={busy} /></div>}
    {history && <div className="card editor"><h2>Lịch sử số dư #{historyId}</h2>{!history.data.length && <p>Chưa có lịch sử.</p>}{history.data.map(h => <div key={h.id}><p>{new Date(`${h.createdAt}${h.createdAt.endsWith('Z') ? '' : 'Z'}`).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · {h.actorUserId} · {h.action}</p><details><summary>Dữ liệu trước / sau và lý do</summary><pre>{h.beforeJson || '—'}{'\n'}{h.afterJson || '—'}</pre></details></div>)}<Pages page={historyPage} total={history.total} change={next => loadHistory(historyId, next)} busy={busy} /><button className="subtle" onClick={() => setHistory(null)}>Đóng lịch sử</button></div>}
  </section>;
}
function NumberField({ label, ...props }) { return <label>{label}<input type="number" required {...props} /></label>; }
function Pages({ page, total, change, busy }) { return <div className="toolbar"><button className="subtle" disabled={busy || page <= 1} onClick={() => change(page - 1)}>Trang trước</button><span>Trang {page}/{Math.max(1, Math.ceil(total / 20))} · {total} kết quả</span><button className="subtle" disabled={busy || page * 20 >= total} onClick={() => change(page + 1)}>Trang sau</button></div>; }
