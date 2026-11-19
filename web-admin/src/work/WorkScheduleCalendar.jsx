import React, { useEffect, useState } from 'react';
import { can } from '../api';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function add(value, n) { const d = new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function period(value, mode) {
  const date = new Date(`${value}T12:00:00Z`);
  if (mode === 'month') { const first = `${value.slice(0, 7)}-01`; const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10); return [first, last]; }
  const first = add(value, -((date.getUTCDay() + 6) % 7)); return [first, add(first, 6)];
}
const color = id => `hsl(${(Number(id) * 137.508) % 360} 65% 88%)`;
const reasons = { READY: 'Có thể phân', INACTIVE: 'NV ngừng làm', BEFORE_HIRE: 'Trước ngày tuyển', PAST_DATE: 'Ngày quá khứ', HOLIDAY: 'Ngày lễ', NON_WORKING_DAY: 'Ngày nghỉ', PERIOD_LOCKED: 'Kỳ công khóa', APPROVED_LEAVE: 'Đã duyệt phép', SOURCE_MISSING_OR_MULTIPLE: 'Nguồn thiếu/nhiều ca', SHIFT_INACTIVE: 'Ca không hoạt động', MULTIPLE_SCHEDULES: 'Đã có nhiều ca', ATTENDANCE_OR_CLOSED: 'Đã có công/đóng', EXISTS: 'Đã có lịch', STARTED_OR_LEGACY: 'Đã bắt đầu/chưa xác nhận', STARTED: 'Ca đã bắt đầu', OVERLAP: 'Trùng giờ', OVERLAP_OR_LEGACY: 'Trùng lịch/chưa xác nhận' };
export function WorkScheduleCalendar({ api, permissions }) {
  const allowed = action => can(permissions, 'WEB_WORK_SCHEDULES', action);
  const [mode, setMode] = useState('week'), [anchor, setAnchor] = useState(today), [page, setPage] = useState(1), [department, setDepartment] = useState(''), [team, setTeam] = useState(''), [search, setSearch] = useState('');
  const [data, setData] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [reload, setReload] = useState(0), [selected, setSelected] = useState([]);
  const [form, setForm] = useState(null), [preview, setPreview] = useState(null), [busy, setBusy] = useState(false);
  const [from, to] = period(anchor || today(), mode), days = []; for (let day = from; day <= to; day = add(day, 1)) days.push(day);
  const query = new URLSearchParams({ from, to, page, pageSize: 20 }); if (department) query.set('departmentId', department); if (team) query.set('teamId', team); if (search) query.set('search', search);
  useEffect(() => { setPage(1); setSelected([]); setForm(null); setPreview(null); }, [from, to, department, team, search]);
  useEffect(() => {
    if (!allowed('VIEW')) return; const abort = new AbortController(); setLoading(true); setError(''); setData(null);
    api(`/work-schedules/calendar?${query}`, { signal: abort.signal }).then(setData).catch(e => { if (!abort.signal.aborted) setError(e.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [api, permissions, from, to, page, department, team, search, reload]);
  function open(employee, date, existing) {
    setPreview(null); setError(''); setMessage('');
    if (existing) {
      if (!allowed('UPDATE')) return;
      setForm({ single: true, id: existing.id, version: existing.version, employeeId: employee.id, workDate: date, shiftId: existing.shiftId }); return;
    }
    setForm({ operationId: crypto.randomUUID(), target: 'EMPLOYEE', employeeIds: employee ? [employee.id] : selected, shiftId: existing?.shiftId || data?.shifts.find(s => s.isActive)?.id || '', from: date || from, to: date || to, weekdays: [1, 2, 3, 4, 5, 6, 7], excludeHolidays: true, overwrite: !!existing, copyFrom: null });
  }
  function change(key, value) { setForm(f => ({ ...f, [key]: value })); setPreview(null); }
  async function inspect(event) {
    event.preventDefault(); setBusy(true); setError(''); setPreview(null);
    try {
      if (form.single) {
        await api(`/work-schedules/${form.id}`, { method: 'PUT', headers: { 'If-Match': `"${form.version}"` }, body: JSON.stringify({ employeeId: form.employeeId, shiftId: Number(form.shiftId), workDate: form.workDate }) });
        setMessage('Đã thay đổi ca.'); setForm(null); setReload(n => n + 1);
      } else setPreview(await api('/work-schedules/bulk/preview', { method: 'POST', body: JSON.stringify({ ...form, shiftId: form.copyFrom ? null : Number(form.shiftId) }) }));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true); setError('');
    try {
      const result = await api(form.copyFrom ? '/work-schedules/copy' : '/work-schedules/bulk', { method: 'POST', body: JSON.stringify({ ...form, shiftId: form.copyFrom ? null : Number(form.shiftId), previewToken: preview.previewToken }) });
      setMessage(`Đã tạo ${result.created}, cập nhật ${result.updated}, bỏ qua ${result.skipped} lịch.`); setForm(null); setPreview(null); setSelected([]); setReload(n => n + 1);
    } catch (e) { setError(e.message); setPreview(null); } finally { setBusy(false); }
  }
  async function cancel(row) {
    if (!window.confirm('Hủy lịch phân ca này?')) return; setBusy(true); setError('');
    try { await api(`/work-schedules/${row.id}/cancel`, { method: 'PATCH', headers: { 'If-Match': `"${row.version}"` } }); setReload(n => n + 1); setMessage('Đã hủy lịch.'); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function exportPage() {
    setBusy(true); setError('');
    try { const blob = await api(`/work-schedules/export?${query}`, { responseType: 'blob' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'work-schedules.csv'; a.click(); URL.revokeObjectURL(url); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  if (!allowed('VIEW')) return <p role="alert">Bạn chưa có quyền WEB_WORK_SCHEDULES / VIEW.</p>;
  return <section className="schedule-workspace">
    <div className="toolbar"><label>Chế độ<select value={mode} onChange={e => setMode(e.target.value)}><option value="week">Tuần</option><option value="month">Tháng</option></select></label><label>Ngày xem<input type="date" min="1900-01-01" max="9998-12-01" value={anchor} onChange={e => { if (e.target.value) setAnchor(e.target.value); }} /></label><button onClick={() => setAnchor(add(from, mode === 'week' ? -7 : -1))}>Kỳ trước</button><button onClick={() => setAnchor(add(to, 1))}>Kỳ sau</button><button disabled={busy || loading} onClick={() => setReload(n => n + 1)}>Tải lại lịch</button></div>
    <div className="toolbar"><label>Phòng ban<select value={department} onChange={e => setDepartment(e.target.value)}><option value="">Tất cả phòng ban trong phạm vi</option>{data?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Team<select value={team} onChange={e => setTeam(e.target.value)}><option value="">Tất cả Team trong phạm vi</option>{data?.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Nhân viên<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã hoặc tên nhân viên" /></label>{allowed('NEW') && <button disabled={loading || busy || !data} onClick={() => open()}>Phân ca hàng loạt ({selected.length} đã chọn)</button>}{allowed('EXPORT') && <button disabled={busy || loading} onClick={exportPage}>Xuất CSV (trang này)</button>}</div>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    {loading ? <div className="card org-skeleton" role="status" aria-label="Đang tải lịch phân ca"><div /><div /><div /></div> : data && <>
      <div className="schedule-legend">{data.shifts.map(s => <span key={s.id} style={{ background: color(s.id) }}>{s.code} · {s.name}</span>)}</div>
      <div className="card table-wrap schedule-grid"><table><thead><tr><th className="schedule-employee">Nhân viên</th>{days.map(d => <th key={d} className={data.holidayDates.includes(d) ? 'schedule-holiday' : ''}>{d.slice(8)}/{d.slice(5, 7)}<small>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(`${d}T12:00:00Z`).getUTCDay()]}</small></th>)}</tr></thead><tbody>{data.employees.map(employee => <tr key={employee.id}><th scope="row" className="schedule-employee">{allowed('NEW') && <input aria-label={`Chọn ${employee.employeeCode}`} type="checkbox" checked={selected.includes(employee.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, employee.id] : ids.filter(id => id !== employee.id))} />} {employee.fullName}<small>{employee.employeeCode}</small></th>{days.map(day => {
        const rows = data.schedules.filter(s => s.employeeId === employee.id && s.workDate === day && s.status !== 'CANCELLED');
        return <td key={day} className={data.holidayDates.includes(day) ? 'schedule-holiday' : ''}>{rows.length ? rows.map(row => <div key={row.id}><button className="schedule-shift" style={{ background: color(row.shiftId) }} disabled={busy || !allowed('UPDATE') || row.status !== 'SCHEDULED'} onClick={() => open(employee, day, row)} title={`${row.rules?.timezone || 'Chưa xác nhận'} · ${row.status}`}>{row.rules?.shiftCode || data.shifts.find(s => s.id === row.shiftId)?.code || 'Ca cũ'}</button>{allowed('DELETE') && row.status === 'SCHEDULED' && <button aria-label={`Hủy lịch ${row.id}`} className="subtle schedule-cancel" disabled={busy} onClick={() => cancel(row)}>×</button>}</div>) : allowed('NEW') ? <button aria-label={`Phân ca ${employee.employeeCode} ${day}`} className="subtle schedule-empty" disabled={busy} onClick={() => open(employee, day)}>+</button> : '—'}</td>;
      })}</tr>)}</tbody></table>{!data.employees.length && <p className="empty">Không có nhân viên trong phạm vi hoặc bộ lọc.</p>}</div>
      <div className="pager"><span>{data.total} nhân viên · Trang {page}</span><button disabled={loading || page === 1} onClick={() => setPage(n => n - 1)}>Trang trước</button><button disabled={loading || page * 20 >= data.total} onClick={() => setPage(n => n + 1)}>Trang sau</button></div>
    </>}
    {form && <form className="card editor" onSubmit={inspect}><h2>{form.single ? 'Thay đổi ca' : 'Phân ca / sao chép lịch'}</h2><fieldset disabled={busy}>
      {!form.single && <><label>Đối tượng<select value={form.target} onChange={e => change('target', e.target.value)}><option value="EMPLOYEE">Nhân viên đã chọn</option><option value="ALL">Tất cả trong phạm vi NEW</option><option value="DEPARTMENT">Phòng ban</option><option value="TEAM">Team</option></select></label>
        {form.target === 'EMPLOYEE' && <p>{form.employeeIds.length} nhân viên đã chọn. Chọn bằng ô checkbox trên lịch hoặc đóng và click vào ô ngày.</p>}
        {form.target === 'DEPARTMENT' && <label>Phòng ban nhận lịch<select required value={form.departmentId || ''} onChange={e => change('departmentId', Number(e.target.value))}><option value="">Chọn phòng ban</option>{data?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>}
        {form.target === 'TEAM' && <label>Team nhận lịch<select required value={form.teamId || ''} onChange={e => change('teamId', Number(e.target.value))}><option value="">Chọn Team</option>{data?.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}
        <label>Từ ngày<input type="date" required value={form.from} onChange={e => change('from', e.target.value)} /></label><label>Đến ngày<input type="date" required value={form.to} onChange={e => change('to', e.target.value)} /></label>
        <label className="checkbox"><input type="checkbox" checked={!!form.copyFrom} onChange={e => change('copyFrom', e.target.checked ? add(form.from, -7) : null)} />Sao chép lịch có sẵn</label>{form.copyFrom && <label>Bắt đầu lịch nguồn<input type="date" required value={form.copyFrom} onChange={e => change('copyFrom', e.target.value)} /></label>}
      </>}
      {!form.copyFrom && <label>Ca phân<select required value={form.shiftId} onChange={e => change('shiftId', Number(e.target.value))}><option value="">Chọn ca</option>{data?.shifts.filter(s => s.isActive).map(s => <option key={s.id} value={s.id}>{s.code} · {s.name} ({s.startTime}–{s.endTime})</option>)}</select></label>}
      {!form.single && <><div className="toolbar">{[1, 2, 3, 4, 5, 6, 7].map(d => <label className="checkbox" key={d}><input type="checkbox" checked={form.weekdays.includes(d)} onChange={e => change('weekdays', e.target.checked ? [...form.weekdays, d].sort() : form.weekdays.filter(x => x !== d))} />{d === 7 ? 'CN' : `T${d + 1}`}</label>)}</div><label className="checkbox"><input type="checkbox" checked={form.excludeHolidays} onChange={e => change('excludeHolidays', e.target.checked)} />Loại trừ ngày lễ (theo cấu hình Attendance)</label><label className="checkbox"><input type="checkbox" disabled={!allowed('UPDATE')} checked={form.overwrite} onChange={e => change('overwrite', e.target.checked)} />Ghi đè lịch chưa phát sinh nghiệp vụ (cần UPDATE)</label></>}
      </fieldset><div className="toolbar"><button disabled={busy || (!form.single && (form.weekdays.length === 0 || form.target === 'EMPLOYEE' && form.employeeIds.length === 0))}>{form.single ? 'Lưu thay đổi' : 'Xem trước'}</button><button type="button" disabled={busy} onClick={() => { setForm(null); setPreview(null); }}>Đóng phân ca</button></div>
      {preview && <section><h3>Preview: {preview.ready} có thể phân · {preview.skipped} bỏ qua</h3><p>Chỉ những dòng “Có thể phân” được ghi. Dữ liệu thay đổi sẽ yêu cầu preview lại.</p><div className="table-wrap schedule-preview"><table><thead><tr><th>Nhân viên</th><th>Ngày</th><th>Ca</th><th>Kết quả</th></tr></thead><tbody>{preview.items.map((p, i) => <tr key={i}><td>{p.employeeCode} · {p.employeeName}</td><td>{p.workDate}</td><td>{p.rules?.shiftCode || '—'}</td><td>{reasons[p.outcome] || p.outcome}</td></tr>)}</tbody></table></div><button type="button" disabled={busy || !preview.ready} onClick={confirm}>Xác nhận phân ca</button></section>}
    </form>}
  </section>;
}
