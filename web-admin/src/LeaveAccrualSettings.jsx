import React, { useEffect, useState } from 'react';
import { can } from './api';
function businessDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function schedule(startDate, unit = 'MONTH') { return { startDate, interval: 1, unit }; }
function editor(value) {
  const source = value.settings, today = value.asOfDate || businessDate(), legacy = source.scheduleVersion !== 2;
  return { ...value, legacy, settings: { scheduleVersion: 2, enabled: source.enabled, defaultDaysPerCycle: source.defaultDaysPerCycle ?? 1,
    accrualSchedule: legacy ? schedule(today) : source.accrualSchedule,
    resetSchedule: legacy ? source.resetOn ? schedule(source.resetOn < today ? today : source.resetOn, 'YEAR') : null : source.resetSchedule,
    newHireEligibility: source.newHireEligibility,
    rules: source.rules.map(r => ({ positionId: r.positionId, leaveTypeId: r.leaveTypeId ?? null, daysPerCycle: r.daysPerCycle ?? r.daysPerMonth ?? 1 })) } };
}
function firstDate(value) {
  if (!value?.startDate || value.interval < 1 || value.interval > 120) return '—';
  const [year, month, day] = value.startDate.split('-').map(Number); const months = year * 12 + month - 1 + value.interval * (value.unit === 'YEAR' ? 12 : 1);
  const nextYear = Math.floor(months / 12), nextMonth = months % 12;
  if (year < 1900 || nextYear > 9999) return '—';
  const nextDay = Math.min(day, new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate());
  return `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
}
export function LeaveAccrualSettings({ api, permissions }) {
  const allowed = can(permissions, 'WEB_SYSTEM_SETTINGS', 'VIEW'), editable = can(permissions, 'WEB_SYSTEM_SETTINGS', 'UPDATE');
  const [data, setData] = useState(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  useEffect(() => {
    if (!allowed) return; const abort = new AbortController(); setData(null); setError('');
    api('/system-settings/leave-accrual', { signal: abort.signal }).then(value => setData(editor(value))).catch(e => { if (!abort.signal.aborted) setError(e.message); }); return () => abort.abort();
  }, [api, allowed, reload]);
  function field(key, value) { setData(d => ({ ...d, settings: { ...d.settings, [key]: value } })); }
  function rule(index, key, value) { field('rules', data.settings.rules.map((r, i) => i === index ? { ...r, [key]: value } : r)); }
  async function save(event) {
    event.preventDefault(); if (!editable) return; setBusy(true); setError(''); setMessage('');
    try { setData(editor(await api('/system-settings/leave-accrual', { method: 'PUT', body: JSON.stringify({ version: data.version, settings: data.settings }) }))); setMessage('Đã lưu lịch cấp/thu hồi phép.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function run() {
    setBusy(true); setError(''); setMessage('');
    try { const result = await api('/system-settings/leave-accrual/run', { method: 'POST' }); setMessage(result.message || `Đã xử lý lịch đến hạn: cấp ${result.creditedBalances} số dư; thu hồi ${result.expiredBalances} số dư.`); setData(d => ({ ...d, nextAccrualDate: result.nextAccrualDate, nextResetDate: result.nextResetDate })); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!allowed) return <p role="alert">Bạn chưa có quyền xem cấu hình hệ thống.</p>;
  const incomplete = data?.settings.enabled && !data.settings.accrualSchedule && !data.settings.resetSchedule;
  return <section className="leave-workspace"><h2>Tự động cấp và thu hồi phép</h2><p>Quyền WEB_SYSTEM_SETTINGS / UPDATE; không áp dụng Data Scope. Loại phép mặc định: Nghỉ phép năm (ANNUAL).</p><p>Ngày bắt đầu là mốc tính: chọn 2 tháng thì lần đầu chạy sau 2 tháng, không cấp ngay ngày bắt đầu. Thu hồi chỉ hết phần khả dụng, giữ lịch sử đã dùng và phần đang chờ duyệt; nhân viên chưa có số dư sẽ được bỏ qua.</p>
    {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    {!data ? <div className="card org-skeleton" role="status" aria-label="Đang tải lịch phép"><div /><div /></div> : <form className="card editor" onSubmit={save}>
      <p>Ngày cấp kế tiếp (lịch đã lưu): <output>{data.nextAccrualDate || '—'}</output> · Ngày thu hồi kế tiếp: <output>{data.nextResetDate || '—'}</output></p>
      {data.legacy && <p>Cấu hình đang dùng lịch cũ. Khi lưu, các mốc bên dưới sẽ áp dụng theo chu kỳ mới; cần kiểm tra ngày bắt đầu.</p>}
      <fieldset disabled={!editable || busy}><label className="checkbox"><input type="checkbox" checked={data.settings.enabled} onChange={e => field('enabled', e.target.checked)} />Bật tự động cấp/thu hồi phép</label>
      <Recurrence label="cấp phép" value={data.settings.accrualSchedule} change={value => field('accrualSchedule', value)} start={data.asOfDate || businessDate()} />
      <Recurrence label="thu hồi" value={data.settings.resetSchedule} change={value => field('resetSchedule', value)} start={data.asOfDate || businessDate()} defaultUnit="YEAR" />
      <label>Điều kiện nhân viên mới<select value={data.settings.newHireEligibility} onChange={e => field('newHireEligibility', e.target.value)}><option value="ACTIVE_ON_DATE">Đang làm việc tại ngày cấp phép</option><option value="ONE_MONTH">Đã làm đủ một tháng tại ngày cấp phép</option></select></label>
      <label>Số ngày phép mặc định mỗi chu kỳ<input type="number" min="0.01" max="99999" step="0.01" required value={data.settings.defaultDaysPerCycle} onChange={e => field('defaultDaysPerCycle', Number(e.target.value))} /></label><p>Nhân viên không có quy tắc chức vụ dùng mức mặc định cho phép năm. Có quy tắc chức vụ thì dùng mức riêng, không cộng thêm mức mặc định.</p><h3>Đối tượng theo chức vụ</h3><p>Để trống ID loại phép để dùng Nghỉ phép năm (ANNUAL){data.defaultLeaveTypeId ? ` · ID ${data.defaultLeaveTypeId}` : ''}.</p>
      {data.settings.rules.map((r, i) => <div className="location" key={i}><label>ID chức vụ<input type="number" min="1" required value={r.positionId || ''} onChange={e => rule(i, 'positionId', Number(e.target.value))} /></label><label>ID loại phép (mặc định ANNUAL)<input type="number" min="1" value={r.leaveTypeId ?? ''} onChange={e => rule(i, 'leaveTypeId', e.target.value ? Number(e.target.value) : null)} /></label>{data.settings.accrualSchedule && <label>Số ngày cấp mỗi chu kỳ<input type="number" min="0.01" max="99999" step="0.01" required value={r.daysPerCycle ?? ''} onChange={e => rule(i, 'daysPerCycle', Number(e.target.value))} /></label>}<button type="button" className="subtle" onClick={() => field('rules', data.settings.rules.filter((_, n) => n !== i))}>Xóa quy tắc</button></div>)}
      <button type="button" disabled={data.settings.rules.length >= 200} onClick={() => field('rules', [...data.settings.rules, { positionId: 0, leaveTypeId: null, daysPerCycle: 1 }])}>Thêm chức vụ</button>
      </fieldset>{incomplete && <p className="error">Cần bật ít nhất một lịch cấp hoặc thu hồi.</p>}<p>Chạy lịch đến hạn dùng cấu hình đã lưu. Số dư vẫn phân theo năm dương lịch; không tự chuyển phép sang năm mới.</p>
      <div className="toolbar">{editable && <><button disabled={busy || incomplete}>Lưu lịch phép</button><button type="button" className="subtle" disabled={busy} onClick={run}>Chạy lịch đến hạn</button></>}<button type="button" className="subtle" disabled={busy} onClick={() => setReload(n => n + 1)}>Tải lại lịch phép</button></div>
    </form>}
  </section>;
}
function Recurrence({ label, value, change, start, defaultUnit = 'MONTH' }) {
  return <div className="location"><label className="checkbox"><input type="checkbox" checked={!!value} onChange={e => change(e.target.checked ? schedule(start, defaultUnit) : null)} />Bật lịch {label}</label>{value && <>
    <label>Ngày bắt đầu {label}<input type="date" min="1900-01-01" required value={value.startDate} onChange={e => change({ ...value, startDate: e.target.value })} /></label>
    <label>Tần suất {label}<input type="number" min="1" max="120" required value={value.interval} onChange={e => change({ ...value, interval: Number(e.target.value) })} /></label>
    <label>Đơn vị {label}<select value={value.unit} onChange={e => change({ ...value, unit: e.target.value })}><option value="MONTH">Tháng</option><option value="YEAR">Năm</option></select></label><p>Lần đầu {label}: <output>{firstDate(value)}</output>. Ngày cuối tháng được điều chỉnh theo lịch thực tế.</p>
  </>}</div>;
}
