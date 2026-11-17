import React, { useEffect, useState } from 'react';
import { can } from './api';
export function LeaveAccrualSettings({ api, permissions }) {
  const allowed = can(permissions, 'WEB_SYSTEM_SETTINGS', 'VIEW');
  const editable = can(permissions, 'WEB_SYSTEM_SETTINGS', 'UPDATE');
  const [data, setData] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  useEffect(() => {
    if (!allowed) return; const abort = new AbortController(); setData(null); setError('');
    api('/system-settings/leave-accrual', { signal: abort.signal }).then(setData).catch(e => { if (!abort.signal.aborted) setError(e.message); }); return () => abort.abort();
  }, [api, allowed, reload]);
  function field(key, value) { setData(d => ({ ...d, settings: { ...d.settings, [key]: value } })); }
  function rule(index, key, value) { field('rules', data.settings.rules.map((r, i) => i === index ? { ...r, [key]: value } : r)); }
  async function save(event) {
    event.preventDefault(); if (!editable) return; setBusy(true); setError(''); setMessage('');
    try { setData(await api('/system-settings/leave-accrual', { method: 'PUT', body: JSON.stringify(data) })); setMessage('Đã lưu lịch cộng/reset phép.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function run() {
    setBusy(true); setError(''); setMessage('');
    try { const result = await api('/system-settings/leave-accrual/run', { method: 'POST' }); setMessage(`Đã xử lý lịch đến hạn: cộng ${result.creditedBalances} số dư; reset ${result.expiredBalances} số dư.`); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!allowed) return <p role="alert">Bạn chưa có quyền xem cấu hình hệ thống.</p>;
  return <section className="leave-workspace"><h2>Tự động cộng và reset phép</h2><p>Lịch theo giờ Việt Nam. Người lưu/chạy lịch cần WEB_SYSTEM_SETTINGS / UPDATE; không áp dụng Data Scope.</p><p>Reset chỉ hết phần phép khả dụng, giữ lịch sử đã dùng và phép đang chờ duyệt. Ngày 01/01 đóng số dư năm trước; ngày khác áp dụng năm hiện tại. Lịch cộng không chạy bù các tháng đã bỏ lỡ. Chạy lịch đến hạn dùng cấu hình đã lưu.</p>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    {!data ? <div className="card org-skeleton" role="status" aria-label="Đang tải lịch phép"><div /><div /></div> : <form className="card editor" onSubmit={save}><fieldset disabled={!editable || busy}>
      <label className="checkbox"><input type="checkbox" checked={data.settings.enabled} onChange={e => field('enabled', e.target.checked)} />Bật tự động cộng/reset phép</label>
      <label>Ngày bắt đầu áp dụng<input type="date" required value={data.settings.effectiveFrom} onChange={e => field('effectiveFrom', e.target.value)} /></label>
      <label>Ngày cộng phép hằng tháng<input type="number" min="1" max="31" required value={data.settings.accrualDay} onChange={e => field('accrualDay', Number(e.target.value))} /></label><p>Tháng không có ngày đã chọn sẽ dùng ngày cuối tháng.</p>
      <label>Điều kiện nhân viên mới<select value={data.settings.newHireEligibility} onChange={e => field('newHireEligibility', e.target.value)}><option value="ACTIVE_ON_DATE">Đang làm việc tại ngày cộng phép</option><option value="ONE_MONTH">Đã làm đủ một tháng tại ngày cộng phép</option></select></label>
      <label>Ngày reset đầu tiên (không bắt buộc)<input type="date" value={data.settings.resetOn || ''} onChange={e => field('resetOn', e.target.value || null)} /></label>
      <label className="checkbox"><input type="checkbox" checked={data.settings.repeatResetYearly} onChange={e => field('repeatResetYearly', e.target.checked)} />Lặp reset cùng ngày/tháng hằng năm</label>
      <h3>Phép cộng theo chức vụ</h3>{data.settings.rules.map((r, i) => <div className="location" key={i}><label>ID chức vụ<input type="number" min="1" required value={r.positionId || ''} onChange={e => rule(i, 'positionId', Number(e.target.value))} /></label><label>ID loại phép tự động<input type="number" min="1" required value={r.leaveTypeId || ''} onChange={e => rule(i, 'leaveTypeId', Number(e.target.value))} /></label><label>Số ngày cộng mỗi tháng<input type="number" min="0.01" max="31" step="0.01" required value={r.daysPerMonth} onChange={e => rule(i, 'daysPerMonth', Number(e.target.value))} /></label><button type="button" className="subtle" onClick={() => field('rules', data.settings.rules.filter((_, n) => n !== i))}>Xóa quy tắc</button></div>)}
      <button type="button" disabled={data.settings.rules.length >= 200} onClick={() => field('rules', [...data.settings.rules, { positionId: 0, leaveTypeId: 0, daysPerMonth: 1 }])}>Thêm chức vụ</button>
    </fieldset><div className="toolbar">{editable && <><button disabled={busy}>Lưu lịch phép</button><button type="button" className="subtle" disabled={busy} onClick={run}>Chạy lịch đến hạn</button></>}<button type="button" className="subtle" disabled={busy} onClick={() => setReload(n => n + 1)}>Tải lại lịch phép</button></div></form>}
  </section>;
}
