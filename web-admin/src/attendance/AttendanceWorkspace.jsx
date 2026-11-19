import React, { useEffect, useState } from 'react';
import { can, newRequestId } from '../api';
const day = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export const attendanceStates = { NOT_CHECKED_IN: 'Chưa check-in', WORKING: 'Đang làm việc', COMPLETE: 'Đã hoàn thành', MISSING_CHECK_OUT: 'Thiếu check-out', MISSING_CHECK_IN: 'Thiếu check-in', ABSENT: 'Vắng mặt', ON_LEAVE: 'Nghỉ phép', DAY_OFF: 'Ngày nghỉ', HOLIDAY: 'Ngày lễ', NO_SCHEDULE: 'Chưa phân ca', LEGACY_UNVERIFIED: 'Lịch cũ chưa xác nhận' };
const previousDay = () => { const date = new Date(`${day()}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); };
const displayTime = (value, zone = 'Asia/Ho_Chi_Minh') => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: zone, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const keys = [['scheduled', 'Nhân viên có ca'], ['checkedIn', 'Đã check-in'], ['working', 'Đang làm việc'], ['late', 'Đi trễ'], ['early', 'Về sớm'], ['notPunched', 'Chưa chấm công'], ['onLeave', 'Nghỉ phép'], ['absent', 'Vắng mặt'], ['missingCheckOut', 'Thiếu check-out']];
export function AttendanceWorkspace({ api, permissions, employeeId, personal = false }) {
  const viewScreen = personal ? 'WEB_MY_ATTENDANCE' : 'WEB_ATTENDANCE';
  const view = can(permissions, viewScreen, 'VIEW');
  const [from, setFrom] = useState(personal ? previousDay : day), [to, setTo] = useState(day), [department, setDepartment] = useState(''), [team, setTeam] = useState(''), [employee, setEmployee] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [filters, setFilters] = useState(null), [filterError, setFilterError] = useState(''), [result, setResult] = useState(null), [stats, setStats] = useState(null), [loading, setLoading] = useState(false), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [message, setMessage] = useState('');
  const [detail, setDetail] = useState(null), [detailLoading, setDetailLoading] = useState(false), [drawer, setDrawer] = useState(false), [busy, setBusy] = useState(false), [adjust, setAdjust] = useState(false), [punch, setPunch] = useState(null), [gps, setGps] = useState(null);
  const query = new URLSearchParams({ from, to, page, pageSize: 20 });
  if (!personal) { if (department) query.set('departmentId', department); if (team) query.set('teamId', team); if (employee) query.set('employeeId', employee); if (search) query.set('search', search); }
  if (status) query.set('status', status);
  useEffect(() => { setPage(1); setDrawer(false); setAdjust(false); setPunch(null); }, [from, to, department, team, employee, search, status, personal]);
  useEffect(() => {
    if (!view || personal) return; const abort = new AbortController();
    setFilterError(''); api('/attendances/filters', { signal: abort.signal }).then(setFilters).catch(e => { if (!abort.signal.aborted) setFilterError(e.message); }); return () => abort.abort();
  }, [api, view, personal]);
  useEffect(() => {
    if (!view) return; const abort = new AbortController(); setLoading(true); setError(''); setResult(null); setStats(null);
    const calls = [api(`/attendances/${personal ? 'me' : 'daily'}?${query}`, { signal: abort.signal })]; if (!personal) calls.push(api(`/attendances/statistics?${query}`, { signal: abort.signal }));
    Promise.allSettled(calls).then(values => {
      if (abort.signal.aborted) return; const failures = [];
      if (values[0].status === 'fulfilled') setResult(values[0].value); else failures.push(values[0].reason.message);
      if (!personal && values[1].status === 'fulfilled') setStats(values[1].value); else if (!personal) failures.push(`Thống kê: ${values[1].reason.message}`);
      setError(failures.join(' · ')); setLoading(false);
    }); return () => abort.abort();
  }, [api, view, personal, from, to, department, team, employee, search, status, page, refresh]);
  async function open(row) {
    setDrawer(true); setAdjust(false); setDetail(null); setDetailLoading(true); setError('');
    const params = new URLSearchParams({ employeeId: row.employeeId, date: row.workDate }); if (row.scheduleId) params.set('scheduleId', row.scheduleId);
    try { setDetail(await api(`/attendances/daily/detail?${params}`)); } catch (e) { setError(e.message); } finally { setDetailLoading(false); }
  }
  async function exportExcel() {
    setBusy(true); setError('');
    try { const blob = await api(`/attendances/export?${query}`, { responseType: 'blob' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `attendance-${from}-${to}.xlsx`; link.click(); URL.revokeObjectURL(url); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function requestAdjustment(event) {
    event.preventDefault(); setBusy(true); setError(''); const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/attendance-adjustments', { method: 'POST', body: JSON.stringify({ ...(detail.attendance.attendanceId ? { attendanceId: detail.attendance.attendanceId } : { scheduleId: detail.attendance.scheduleId }), proposedCheckIn: form.checkIn ? new Date(`${form.checkIn}+07:00`).toISOString() : null, proposedCheckOut: form.checkOut ? new Date(`${form.checkOut}+07:00`).toISOString() : null, reason: form.reason }) });
      setMessage('Đã gửi phiếu điều chỉnh. Giờ công chỉ thay đổi sau khi duyệt cuối.'); setAdjust(false); setDrawer(false); setRefresh(n => n + 1);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function beginPunch(row, operation) { setPunch({ row, operation, key: newRequestId() }); setGps(null); setError(''); }
  function locate() {
    if (!navigator.geolocation) { setError('Thiết bị không hỗ trợ vị trí.'); return; }
    navigator.geolocation.getCurrentPosition(p => setGps({ latitude: p.coords.latitude, longitude: p.coords.longitude }), e => setError(e.message), { enableHighAccuracy: true, timeout: 15000 });
  }
  async function submitPunch(event) {
    event.preventDefault(); setBusy(true); setError(''); const fields = Object.fromEntries(new FormData(event.currentTarget));
    const body = { scheduleId: punch.row.scheduleId, requestKey: punch.key };
    if (punch.row.requireQr) { body.qrSessionId = Number(fields.qrSessionId); body.qrToken = fields.qrToken; }
    if (punch.row.requireGps && gps) Object.assign(body, gps);
    try { await api(`/attendances/${punch.operation}`, { method: 'POST', body: JSON.stringify(body) }); setMessage(punch.operation === 'check-in' ? 'Check-in thành công.' : 'Check-out thành công.'); setPunch(null); setRefresh(n => n + 1); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  const inWindow = (row, checkIn) => {
    const now = new Date(result?.asOfUtc).getTime(); const start = new Date(checkIn ? row.checkInOpenUtc : row.checkOutOpenUtc).getTime(); const end = new Date(checkIn ? row.checkInCloseUtc : row.checkOutCloseUtc).getTime();
    return !row.isPeriodLocked && !row.snapshotMissing && row.scheduleId && now >= start && now <= end && !row.isOnLeave;
  };
  if (!view) return <p role="alert">Bạn chưa có quyền {viewScreen} / VIEW.</p>;
  return <section className="attendance-management"><div className="page-title"><div><span className="eyebrow">ATTENDANCE & TIMEKEEPING</span><h1>{personal ? 'My Attendance' : 'Quản lý chấm công'}</h1><p>Giờ công được ghi nhận theo ca và snapshot. Yêu cầu điều chỉnh phải qua phê duyệt.</p>{personal && <p>Ca qua đêm thuộc ngày bắt đầu ca. Mặc định hiển thị cả hôm qua để check-out ca qua đêm.</p>}</div>{!personal && can(permissions, 'WEB_ATTENDANCE', 'EXPORT') && <button disabled={busy || loading} onClick={exportExcel}>Xuất Excel</button>}</div>
    <div className="toolbar"><label>Từ ngày<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} /></label><label>Đến ngày<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
      {!personal && <><label>Phòng ban<select value={department} onChange={e => setDepartment(e.target.value)}><option value="">Tất cả trong phạm vi</option>{filters?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Team<select value={team} onChange={e => setTeam(e.target.value)}><option value="">Tất cả Team</option>{filters?.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>ID nhân viên<input type="number" min="1" value={employee} onChange={e => setEmployee(e.target.value)} /></label><label>Tên hoặc mã nhân viên<input value={search} onChange={e => setSearch(e.target.value)} /></label></>}
      <label>Trạng thái<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{Object.entries(attendanceStates).map(([key, value]) => <option key={key} value={key}>{value}</option>)}<option value="LATE">Có đi trễ</option><option value="EARLY">Có về sớm</option></select></label><button disabled={loading || busy} onClick={() => setRefresh(n => n + 1)}>Tải lại chấm công</button></div>
    {filterError && <p role="alert" className="error">Bộ lọc: {filterError}</p>}{!drawer && !punch && error && <p role="alert" className="error">{error}</p>}{message && <p role="status">{message}</p>}
    {!personal && <><p>Thống kê số nhân viên phân biệt trong khoảng/bộ lọc đã chọn; một người có thể đồng thời đi trễ và về sớm.</p><div className="attendance-stats">{keys.map(([key, label]) => <div className="card" key={key}><span>{label}</span>{loading ? <div className="stat-skeleton" aria-label={`Đang tải ${label}`} /> : <strong>{stats ? stats[key] : '—'}</strong>}</div>)}</div></>}
    {loading ? <div className="card org-skeleton" role="status" aria-label="Đang tải chấm công"><div /><div /><div /></div> : result && <div className="card table-wrap"><table><thead><tr>{['Ngày / Nhân viên', 'Phòng ban / Team', 'Ca / Giờ ca', 'Check-in', 'Check-out', 'Làm việc (phút)', 'Đi trễ', 'Về sớm', 'Trạng thái', 'Thao tác'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.data.map(r => <tr key={`${r.employeeId}:${r.workDate}:${r.scheduleId || 'none'}`}><td>{r.workDate}<strong>{r.employeeName}</strong><small>{r.employeeCode}</small></td><td>{r.departmentName}<small>{r.teamName || 'Chưa phân Team'}</small></td><td>{r.shiftCode || '—'}{r.snapshotMissing && <small>Snapshot chưa xác nhận</small>}<small>{displayTime(r.shiftStartAtUtc, r.timezone || undefined)} → {displayTime(r.shiftEndAtUtc, r.timezone || undefined)}</small></td><td>{displayTime(r.checkInAtUtc, r.timezone || undefined)}</td><td>{displayTime(r.checkOutAtUtc, r.timezone || undefined)}</td><td>{r.workedMinutes ?? '—'}</td><td>{r.isLate ? <span className="violation">{r.lateMinutes} phút</span> : '—'}</td><td>{r.isEarly ? <span className="violation">{r.earlyMinutes} phút</span> : '—'}</td><td>{attendanceStates[r.status] || r.status}{r.isOnLeave && r.status !== 'ON_LEAVE' && <small>Nghỉ phép đã duyệt</small>}{r.isHoliday && <small>Ngày lễ</small>}{r.isPeriodLocked && <small>Kỳ công khóa</small>}</td><td>{can(permissions, 'WEB_ATTENDANCE', 'VIEW') && <button className="subtle" onClick={() => open(r)}>Chi tiết</button>}
      {personal && !r.checkInAtUtc && !r.checkOutAtUtc && can(permissions, 'WEB_MY_ATTENDANCE', 'UPDATE') && <button disabled={busy || !inWindow(r, true)} onClick={() => beginPunch(r, 'check-in')}>Check-in</button>}
      {personal && !r.checkOutAtUtc && (r.checkInAtUtc || r.missingPunchRule === 'INCOMPLETE') && can(permissions, 'WEB_MY_ATTENDANCE', 'UPDATE') && <button disabled={busy || !inWindow(r, false)} onClick={() => beginPunch(r, 'check-out')}>Check-out</button>}
      </td></tr>)}</tbody></table>{!result.data.length && <p className="empty">Không có dữ liệu chấm công trong phạm vi và khoảng ngày đã chọn.</p>}<div className="pager"><span>{result.total} dòng · Trang {page}</span><button disabled={page === 1 || busy} onClick={() => setPage(n => n - 1)}>Trang trước</button><button disabled={page * 20 >= result.total || busy} onClick={() => setPage(n => n + 1)}>Trang sau</button></div></div>}
    {drawer && <div className="attendance-overlay"><aside className="attendance-drawer" role="dialog" aria-label="Chi tiết chấm công"><button className="subtle" onClick={() => { setDrawer(false); setAdjust(false); }}>Đóng chi tiết</button>{error && <p role="alert" className="error">{error}</p>}{detailLoading ? <p role="status">Đang tải chi tiết…</p> : detail && <><h2>{detail.attendance.employeeName}</h2><p>{detail.attendance.employeeCode} · {detail.attendance.workDate}</p><p>{attendanceStates[detail.attendance.status]} · {detail.attendance.shiftCode || 'Chưa có ca'}</p><dl><dt>Check-in</dt><dd>{displayTime(detail.attendance.checkInAtUtc)}</dd><dt>Check-out</dt><dd>{displayTime(detail.attendance.checkOutAtUtc)}</dd><dt>Làm việc</dt><dd>{detail.attendance.workedMinutes ?? '—'} phút</dd><dt>Đi trễ / Về sớm</dt><dd>{detail.attendance.lateMinutes} / {detail.attendance.earlyMinutes} phút</dd></dl>
      {detail.rules ? <><h3>Quy tắc snapshot</h3><p>{detail.rules.shiftCode} · {detail.rules.timezone}</p><p>{displayTime(detail.rules.startAtUtc, detail.rules.timezone)} → {displayTime(detail.rules.endAtUtc, detail.rules.timezone)}</p><p>Cửa sổ check-in: {displayTime(detail.rules.checkInOpenUtc)} → {displayTime(detail.rules.checkInCloseUtc)}; check-out: {displayTime(detail.rules.checkOutOpenUtc)} → {displayTime(detail.rules.checkOutCloseUtc)}</p><p>Nghỉ {detail.rules.breakMinutes} phút; đi trễ cho phép {detail.rules.lateGraceMinutes} phút; về sớm cho phép {detail.rules.earlyLeaveGraceMinutes} phút.</p></> : <p>Không có snapshot ca đã xác nhận. Không suy lại giờ lịch sử từ cấu hình mới.</p>}
      <h3>Yêu cầu điều chỉnh gần nhất</h3>{detail.adjustments.length ? detail.adjustments.map(a => <p key={a.id}>#{a.id} · {a.status} · {a.reason}</p>) : <p>Chưa có yêu cầu điều chỉnh.</p>}
      {Number(employeeId) === detail.attendance.employeeId && detail.attendance.scheduleId && detail.rules && !detail.attendance.isPeriodLocked && can(permissions, 'WEB_ATTENDANCE_ADJUSTMENTS', 'NEW') && <button onClick={() => setAdjust(true)}>Tạo phiếu điều chỉnh</button>}
      {adjust && <form className="editor" onSubmit={requestAdjustment}><h3>Đề xuất giờ công (giờ Việt Nam)</h3><p>Nhập cả cặp giờ đề xuất; để trống một giờ để đề xuất xóa giờ đó. Không chỉnh trực tiếp dữ liệu công.</p><label>Check-in đề xuất<input name="checkIn" type="datetime-local" /></label><label>Check-out đề xuất<input name="checkOut" type="datetime-local" /></label><label>Lý do điều chỉnh<input name="reason" required maxLength="1000" /></label><button disabled={busy}>Gửi phiếu điều chỉnh</button></form>}
    </>}</aside></div>}
    {punch && <div className="attendance-overlay"><form className="card attendance-drawer" role="dialog" aria-label="Xác nhận chấm công" onSubmit={submitPunch}><h2>{punch.operation === 'check-in' ? 'Check-in' : 'Check-out'} · {punch.row.shiftCode}</h2>{error && <p role="alert" className="error">{error}</p>}<p>Giờ thực tế do server ghi nhận. Nếu lỗi mạng, gửi lại tại đây để tránh ghi trùng.</p>{punch.row.requireQr && <><label>Mã phiên QR<input name="qrSessionId" type="number" min="1" required /></label><label>Mã xác thực QR<input name="qrToken" required autoComplete="off" maxLength="512" /></label></>}{punch.row.requireGps && <><button type="button" onClick={locate}>Lấy vị trí hiện tại</button><p>{gps ? `Đã nhận vị trí (${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)})` : 'Cần vị trí để chấm công tại địa điểm hợp lệ.'}</p></>}<button disabled={busy || punch.row.requireGps && !gps}>Xác nhận chấm công</button><button type="button" disabled={busy} onClick={() => setPunch(null)}>Đóng chấm công</button></form></div>}
  </section>;
}
