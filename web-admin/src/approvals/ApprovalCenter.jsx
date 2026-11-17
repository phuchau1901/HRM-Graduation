import React, { useEffect, useRef, useState } from 'react';
import { can } from '../api';
import { approvalModules } from './modules';
import { approvalTime } from './date';
export function ApprovalCenter({ api, permissions, userId, module = '', onModuleChange }) {
  const [selected, setSelected] = useState(module), [status, setStatus] = useState(''), [view, setView] = useState('ALL'), [employee, setEmployee] = useState(''), [page, setPage] = useState(1);
  const [result, setResult] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState(null), [history, setHistory] = useState(null), [historyPage, setHistoryPage] = useState(1), [reason, setReason] = useState('');
  const sequence = useRef(0), allowed = can(permissions, 'WEB_APPROVALS', 'VIEW');
  useEffect(() => setSelected(module), [module]);
  useEffect(() => { setPage(1); setDetail(null); setHistory(null); sequence.current++; }, [selected, status, view, employee]);
  useEffect(() => {
    if (!allowed) { setResult(null); return; }
    const abort = new AbortController(); setResult(null); setLoading(true); setError('');
    const query = new URLSearchParams({ page, pageSize: 20, view });
    if (selected) query.set('module', selected); if (status) query.set('status', status); if (employee) query.set('employeeId', employee);
    api(`/approvals?${query}`, { signal: abort.signal }).then(setResult).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [api, allowed, selected, status, view, employee, page, revision]);
  useEffect(() => () => { sequence.current++; }, []);
  async function open(id) {
    const request = ++sequence.current; setBusy(true); setError(''); setDetail(null); setHistory(null); setReason(''); setHistoryPage(1);
    try {
      const next = await api(`/approvals/${id}`); if (request !== sequence.current) return; setDetail(next);
      const rows = await api(`/approvals/${id}/history?page=1&pageSize=20`); if (request === sequence.current) setHistory(rows);
    } catch (e) { if (request === sequence.current) setError(e.message); } finally { setBusy(false); }
  }
  async function decide(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api(`/approvals/${detail.request.id}/${event.nativeEvent.submitter.value}`, { method: 'POST', body: JSON.stringify({ version: detail.request.version, reason }) }); setDetail(null); setHistory(null); setRevision(n => n + 1); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function loadHistory(next) {
    setBusy(true); setError('');
    try { setHistory(await api(`/approvals/${detail.request.id}/history?page=${next}&pageSize=20`)); setHistoryPage(next); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const current = detail?.steps.find(step => step.stepNo === detail.request.currentStepNo);
  const assigned = detail?.request.status === 'PENDING' && current?.approverUserId === userId && can(permissions, 'WEB_APPROVALS', 'APPROVE');
  const registered = approvalModules.find(item => item.requestTypes.includes(detail?.request.requestType));
  const Details = registered?.Details;
  const title = approvalModules.find(item => item.code === selected)?.label;
  if (!allowed) return <p role="alert">Bạn chưa có quyền WEB_APPROVALS / VIEW.</p>;
  return <section className="leave-workspace"><div className="page-title"><div><span className="eyebrow">APPROVALS{title ? ` / ${title.toUpperCase()}` : ''}</span><h1>{title ? `Approvals / ${title}` : 'Approval Center'}</h1><p>Trung tâm phê duyệt dùng chung. Mỗi module xử lý nghiệp vụ và chi tiết yêu cầu riêng.</p></div></div>
    <div className="tabs">{[{ code: '', label: 'Tất cả' }, ...approvalModules].map(item => <button disabled={busy} className={selected === item.code ? 'selected' : ''} key={item.code} onClick={() => onModuleChange ? onModuleChange(item.code) : setSelected(item.code)}>{item.label}</button>)}</div>
    <div className="toolbar"><label>Trạng thái<select disabled={busy} value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả</option>{['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map(value => <option key={value}>{value}</option>)}</select></label><label>Phạm vi<select disabled={busy} value={view} onChange={e => setView(e.target.value)}><option value="ALL">Trong phạm vi được xem</option><option value="MY">Của tôi</option><option value="TEAM">Phòng ban</option></select></label><label>ID nhân viên<input type="number" min="1" disabled={busy} value={employee} onChange={e => setEmployee(e.target.value)} /></label><button className="subtle" disabled={busy} onClick={() => setRevision(n => n + 1)}>Tải lại</button></div>
    {error && <p className="error" role="alert">{error}</p>}
    {loading ? <div role="status" className="card org-skeleton" aria-label="Đang tải phê duyệt"><div /><div /><div /></div> : result && <div className="card table-wrap"><table><thead><tr><th>Yêu cầu</th><th>Nhân viên</th><th>Loại / Bước</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{result.data.map(row => <tr key={row.id}><td>#{row.id} · hồ sơ #{row.referenceId}</td><td>{row.employeeName}</td><td>{row.requestType} · {row.currentStepNo ?? '—'}</td><td>{row.status}</td><td><button className="subtle" disabled={busy} onClick={() => open(row.id)}>Chi tiết</button></td></tr>)}</tbody></table>{!result.data.length && <p className="empty">Chưa có yêu cầu phê duyệt trong module/phạm vi được xem.</p>}<Pager page={page} total={result.total} change={setPage} busy={busy} /></div>}
    {detail && <div className="card editor"><h2>Chi tiết #{detail.request.id}</h2><p>{detail.request.employeeName} · {detail.request.requestType} · {detail.request.status}</p>{Details ? <Details details={detail.details} /> : <><p>{detail.details?.reason}</p><details><summary>Chi tiết yêu cầu</summary><pre>{JSON.stringify(detail.details, null, 2)}</pre></details></>}
      <ol>{detail.steps.map(step => <li key={step.id}>{step.approverUserId}{step.approverEmployeeId ? ` · Employee ${step.approverEmployeeId}` : ''} · {step.decision} · {step.comment || '—'} · {approvalTime(step.decidedAt)}</li>)}</ol>
      {assigned && <form onSubmit={decide}><label>Lý do<input required maxLength="1000" value={reason} onChange={e => setReason(e.target.value)} /></label><button disabled={busy} value="approve">Duyệt</button> <button disabled={busy} value="reject">Từ chối</button></form>}
      <h3>Lịch sử</h3>{history?.data.map(item => <div key={item.id}><p>{approvalTime(item.createdAt)} · {item.actorUserId} · {item.action}</p><details><summary>Dữ liệu trước / sau</summary><pre>{item.beforeJson || '—'}{'\n'}{item.afterJson || '—'}</pre></details></div>)}{history && <Pager page={historyPage} total={history.total} change={loadHistory} busy={busy} />}<button className="subtle" disabled={busy} onClick={() => { sequence.current++; setDetail(null); setHistory(null); }}>Đóng</button>
    </div>}
  </section>;
}
function Pager({ page, total, change, busy }) { return <div className="toolbar"><button className="subtle" disabled={busy || page <= 1} onClick={() => change(page - 1)}>Trước</button><span>Trang {page}/{Math.max(1, Math.ceil(total / 20))} · {total} kết quả</span><button className="subtle" disabled={busy || page * 20 >= total} onClick={() => change(page + 1)}>Sau</button></div>; }
