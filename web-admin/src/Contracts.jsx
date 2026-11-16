import React, { useEffect, useState } from 'react';
import { allPages, can } from './api';

function Skeleton({ label }) {
  return <div role="status" aria-label={label} className="org-skeleton"><div /><div /><div /></div>;
}
function ContractEditor({ api, employeeId, editor, permissions, types, asOfDate, onClose, onSaved }) {
  const [saving, setSaving] = useState(false), [error, setError] = useState('');
  const contract = editor.contract;
  const terminating = editor.kind === 'terminate';
  const title = { create: 'Tạo hợp đồng', edit: 'Sửa hợp đồng', renew: 'Gia hạn hợp đồng', terminate: 'Chấm dứt hợp đồng' }[editor.kind];
  async function save(event) {
    event.preventDefault(); setSaving(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { contractNo: fields.contractNo, contractType: fields.contractType, startDate: fields.startDate,
      endDate: fields.endDate || null, status: fields.status, attachmentUrl: fields.attachmentUrl || null };
    try {
      await api(`/employees/${employeeId}/contracts${contract ? `/${contract.id}` : ''}`, { method: contract ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      onSaved();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }
  return <section className="card editor"><div className="section-title"><h2>{title}</h2><button type="button" className="subtle" disabled={saving} onClick={onClose}>Đóng</button></div><form onSubmit={save}>
    <label>Số hợp đồng<input name="contractNo" defaultValue={contract?.contractNo || ''} maxLength={50} required /></label>
    <label>Loại hợp đồng{can(permissions, 'WEB_CONTRACT_TYPES', 'VIEW') ? <select name="contractType" defaultValue={contract?.contractType || ''} required><option value="">Chọn loại hợp đồng</option>{contract && !types.some(t => t.code === contract.contractType) && <option value={contract.contractType}>{contract.contractTypeName || contract.contractType}</option>}{types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}</select> : <input name="contractType" defaultValue={contract?.contractType || ''} maxLength={30} required />}</label>
    <div className="form-grid"><label>Ngày bắt đầu<input name="startDate" type="date" defaultValue={contract?.startDate || asOfDate || ''} required /></label><label>Ngày kết thúc<input name="endDate" type="date" defaultValue={terminating ? asOfDate || '' : contract?.endDate || ''} required={terminating} /></label></div>
    <label>Trạng thái<select name="status" defaultValue={terminating ? 'TERMINATED' : contract?.status || 'DRAFT'}>{(contract?.status === 'ACTIVE' ? ['ACTIVE', 'EXPIRED', 'TERMINATED'] : ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED']).map(status => <option key={status} value={status}>{status}</option>)}</select></label>
    <label>Link tài liệu<input name="attachmentUrl" type="url" defaultValue={contract?.attachmentUrl || ''} maxLength={500} /></label>
    {error && <p role="alert" className="error">{error}</p>}<div className="actions"><button disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu hợp đồng'}</button></div>
  </form></section>;
}
export function Contracts({ api, permissions, initialEmployeeId }) {
  const allowed = can(permissions, 'WEB_CONTRACTS', 'VIEW');
  const [days, setDays] = useState(30), [revision, setRevision] = useState(0);
  const [stats, setStats] = useState(null), [statsLoading, setStatsLoading] = useState(true), [statsError, setStatsError] = useState('');
  const [employeeInput, setEmployeeInput] = useState(initialEmployeeId ? String(initialEmployeeId) : ''), [employeeId, setEmployeeId] = useState(initialEmployeeId || null);
  const [page, setPage] = useState(1), [list, setList] = useState(null), [listLoading, setListLoading] = useState(false), [listError, setListError] = useState('');
  const [editor, setEditor] = useState(null), [notice, setNotice] = useState(''), [types, setTypes] = useState([]), [typesError, setTypesError] = useState('');
  const typesAllowed = can(permissions, 'WEB_CONTRACT_TYPES', 'VIEW');
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController(); setStats(null); setStatsLoading(true); setStatsError('');
    api(`/contracts/statistics?expiringWithinDays=${days}`, { signal: controller.signal }).then(result => {
      if (controller.signal.aborted) return;
      if (result?.success !== true || !['active', 'expiringSoon', 'expired'].every(key => Number.isInteger(result.data?.[key]) && result.data[key] >= 0) || !result.data?.asOfDate) throw new Error('Dữ liệu thống kê không hợp lệ.');
      setStats(result.data);
    }).catch(e => { if (!controller.signal.aborted) setStatsError(e.message); }).finally(() => { if (!controller.signal.aborted) setStatsLoading(false); });
    return () => controller.abort();
  }, [api, allowed, days, revision]);
  useEffect(() => {
    if (!allowed || !employeeId) return;
    const controller = new AbortController(); setList(null); setListLoading(true); setListError('');
    api(`/employees/${employeeId}/contracts?page=${page}&pageSize=20`, { signal: controller.signal }).then(result => { if (!controller.signal.aborted) setList(result); })
      .catch(e => { if (!controller.signal.aborted) setListError(e.message); }).finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [api, allowed, employeeId, page, revision]);
  useEffect(() => {
    if (!allowed || !typesAllowed) return;
    const controller = new AbortController(); setTypes([]); setTypesError('');
    allPages(api, '/contract-types?isActive=true', controller.signal).then(rows => { if (!controller.signal.aborted) setTypes(rows); }).catch(e => { if (!controller.signal.aborted) setTypesError(e.message); });
    return () => controller.abort();
  }, [api, allowed, typesAllowed]);
  if (!allowed) return <p className="empty">Bạn chưa có quyền xem hợp đồng.</p>;
  return <><div className="page-title"><div><span className="eyebrow">HUMAN RESOURCES / CONTRACTS</span><h1>Hợp đồng lao động</h1><p>Thống kê hợp đồng trong phạm vi bạn được phép xem.</p></div></div>
    <section className="card" aria-label="Thống kê hợp đồng"><div className="toolbar"><label>Sắp hết hạn trong (ngày)<input type="number" min="1" max="365" value={days} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 1 && value <= 365) setDays(value); }} /></label>{stats && <small>Ngày thống kê: {stats.asOfDate} · Asia/Ho_Chi_Minh</small>}</div>
      {statsLoading ? <Skeleton label="Đang tải thống kê hợp đồng" /> : statsError ? <div className="error" role="alert">Không tải được thống kê: {statsError} <button className="subtle" onClick={() => setRevision(v => v + 1)}>Thử lại thống kê</button></div> : stats && <div className="contract-statistics">{[['active', 'Đang hiệu lực'], ['expiringSoon', 'Sắp hết hạn'], ['expired', 'Đã hết hạn']].map(([key, label]) => <div key={key}><span>{label}</span><output aria-label={label}>{stats[key]}</output></div>)}</div>}
    </section>
    <section className="card contract-list"><form className="toolbar" onSubmit={e => { e.preventDefault(); setEmployeeId(Number(employeeInput)); setPage(1); setEditor(null); setNotice(''); }}><label>ID nhân viên<input type="number" min="1" max="2147483647" value={employeeInput} onChange={e => setEmployeeInput(e.target.value)} required /></label><button>Xem hợp đồng nhân viên</button>{employeeId && can(permissions, 'WEB_CONTRACTS', 'NEW') && <button type="button" onClick={() => setEditor({ kind: 'create', contract: null })}>Tạo hợp đồng</button>}</form>
      {!employeeId ? <p className="empty">Chọn nhân viên để xem và quản lý hợp đồng.</p> : listLoading ? <Skeleton label="Đang tải danh sách hợp đồng" /> : listError ? <div className="error" role="alert">{listError} <button className="subtle" onClick={() => setRevision(v => v + 1)}>Thử lại danh sách</button></div> : list && <><div className="table-wrap"><table><thead><tr><th>Số hợp đồng</th><th>Loại hợp đồng</th><th>Bắt đầu</th><th>Kết thúc</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{list.data.map(c => <tr key={c.id}><td>{c.contractNo}</td><td>{c.contractTypeName || c.contractType}</td><td>{c.startDate}</td><td>{c.endDate || 'Không xác định thời hạn'}</td><td>{c.status}</td><td>{can(permissions, 'WEB_CONTRACTS', 'UPDATE') && ['DRAFT', 'ACTIVE'].includes(c.status) && <><button className="subtle" onClick={() => setEditor({ kind: 'edit', contract: c })}>Sửa</button>{c.status === 'ACTIVE' && <><button className="subtle" onClick={() => setEditor({ kind: 'renew', contract: c })}>Gia hạn</button><button className="subtle" onClick={() => setEditor({ kind: 'terminate', contract: c })}>Chấm dứt</button></>}</>}</td></tr>)}</tbody></table></div>{!list.data.length && <p className="empty">Nhân viên chưa có hợp đồng trong phạm vi được xem.</p>}<div className="pager"><span>Trang {page}</span><button className="subtle" disabled={page === 1} onClick={() => setPage(v => v - 1)}>Trước</button><button className="subtle" disabled={page * 20 >= list.total} onClick={() => setPage(v => v + 1)}>Sau</button></div></>}
    </section>{notice && <p className="success" role="status">{notice}</p>}{typesError && <p className="error" role="alert">Không tải được loại hợp đồng: {typesError}</p>}
    {editor && <ContractEditor key={`${employeeId}-${editor.kind}-${editor.contract?.id || 'new'}`} api={api} employeeId={employeeId} editor={editor} permissions={permissions} types={types} asOfDate={stats?.asOfDate} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('Đã lưu hợp đồng.'); setRevision(v => v + 1); }} />}
  </>;
}
