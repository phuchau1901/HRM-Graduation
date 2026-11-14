import React, { useEffect, useState } from 'react';
import { can } from './api';
const passwordNumbers = [['minimumLength', 'Độ dài tối thiểu', 1, 1024], ['maximumLength', 'Độ dài tối đa', 1, 1024], ['passwordHistoryCount', 'Số mật khẩu cũ cần ghi nhớ', 0, 100]];
const passwordChecks = [['requireUppercase', 'Yêu cầu chữ hoa'], ['requireLowercase', 'Yêu cầu chữ thường'], ['requireDigit', 'Yêu cầu chữ số'], ['requireSpecialCharacter', 'Yêu cầu ký tự đặc biệt'], ['disallowUsernameInPassword', 'Không chứa tên tài khoản']];
const attendanceNumbers = [['checkInBeforeStartMinutes', 'Check-in trước giờ bắt đầu (phút)', 0, 1440], ['checkInAfterStartMinutes', 'Check-in sau giờ bắt đầu (phút)', 0, 1440], ['checkOutBeforeEndMinutes', 'Check-out trước giờ kết thúc (phút)', 0, 1440], ['checkOutAfterEndMinutes', 'Check-out sau giờ kết thúc (phút)', 0, 1440], ['lateGraceMinutes', 'Đi trễ cho phép — mặc định khi tạo ca (phút)', 0, 240], ['earlyLeaveGraceMinutes', 'Về sớm cho phép (phút)', 0, 240]];
const attendanceChecks = [['requireQr', 'Yêu cầu QR'], ['requireGps', 'Yêu cầu GPS'], ['allowOvernightShifts', 'Cho phép ca qua đêm']];
export function SystemSettings({ api, permissions }) {
  const [tab, setTab] = useState('password-policy'), [view, setView] = useState(null), [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState(''), [reload, setReload] = useState(0);
  const allowed = can(permissions, 'WEB_SYSTEM_SETTINGS', 'VIEW'), editable = can(permissions, 'WEB_SYSTEM_SETTINGS', 'UPDATE');
  useEffect(() => {
    setView(null); setSettings(null); setError(''); setSuccess('');
    if (!allowed) return;
    const controller = new AbortController(); setLoading(true);
    api(`/system-settings/${tab}`, { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setView({ ...value, section: tab }); setSettings(value.settings); } })
      .catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, allowed, tab, reload]);
  function field(key, value) { setSettings(current => ({ ...current, [key]: value })); }
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const value = await api(`/system-settings/${tab}`, { method: 'PUT', headers: { 'If-Match': `"${view.version}"` }, body: JSON.stringify(settings) });
      setView({ ...value, section: tab }); setSettings(value.settings); setSuccess('Đã lưu cấu hình.');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  const password = tab === 'password-policy';
  return <><div className="page-title"><div><span className="eyebrow">SYSTEM SETTINGS</span><h1>Cấu hình hệ thống</h1><p>Chính sách mật khẩu và quy tắc chấm công dùng chung.</p></div></div>
    <div className="tabs"><button className={password ? 'selected' : ''} disabled={saving} onClick={() => setTab('password-policy')}>Password Policy</button><button className={!password ? 'selected' : ''} disabled={saving} onClick={() => setTab('attendance')}>Attendance Settings</button></div>
    {!allowed ? <p>Bạn chưa có quyền xem cấu hình hệ thống.</p> : (loading || settings && view?.section !== tab) ? <p role="status">Đang tải cấu hình…</p> : settings && <form className="card editor settings-editor" onSubmit={save}>
      <h2>{password ? 'Chính sách mật khẩu' : 'Cấu hình chấm công'}</h2><p>{password ? 'Áp dụng khi tạo hoặc đổi mật khẩu. Mật khẩu hiện tại và các phiên đăng nhập được giữ nguyên.' : 'Quy tắc được lưu theo lịch phân ca để bảo toàn kết quả lịch sử. Mỗi ca có mức đi trễ riêng; giá trị ở đây là mặc định cho ca mới.'}</p>
      <fieldset disabled={!editable || saving}><div className="form-grid">{(password ? passwordNumbers : attendanceNumbers).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" min={min} max={max} step="1" required value={settings[key]} onChange={e => field(key, e.target.value === '' ? '' : Number(e.target.value))} /></label>)}</div>
      {(password ? passwordChecks : attendanceChecks).map(([key, label]) => <label className="checkbox" key={key}><input type="checkbox" checked={settings[key]} onChange={e => field(key, e.target.checked)} />{label}</label>)}
      {!password && <><label>Múi giờ<input value={settings.timezone} maxLength={100} required onChange={e => field('timezone', e.target.value)} /></label>
        <label>Thiếu lần chấm công<select value={settings.missingPunchRule} onChange={e => field('missingPunchRule', e.target.value)}><option value="REJECT_CHECKOUT_WITHOUT_CHECKIN">Yêu cầu check-in trước check-out</option><option value="INCOMPLETE">Cho phép ghi nhận check-out và đánh dấu thiếu check-in</option></select></label>
        <h3>Ngày làm việc</h3><div className="weekdays">{['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map((day, i) => <label className="checkbox" key={day}><input type="checkbox" checked={settings.workingDays.includes(i + 1)} onChange={e => field('workingDays', e.target.checked ? [...settings.workingDays, i + 1].sort() : settings.workingDays.filter(x => x !== i + 1))} />{day}</label>)}</div>
        <div className="section-title"><h3>Địa điểm chấm công</h3><button type="button" className="subtle" disabled={settings.locations.length >= 20} onClick={() => field('locations', [...settings.locations, { code: '', name: '', latitude: 0, longitude: 0, radiusMeters: 100 }])}>+ Địa điểm</button></div>
        {settings.locations.map((location, index) => {
          const change = (key, value) => field('locations', settings.locations.map((row, i) => i === index ? { ...row, [key]: value } : row));
          return <section className="location" key={index}><div className="form-grid"><label>Mã địa điểm<input aria-label={`Mã địa điểm ${index + 1}`} value={location.code} maxLength={50} pattern="[A-Z0-9][A-Z0-9_-]*" required onChange={e => change('code', e.target.value.toUpperCase())} /></label><label>Tên địa điểm<input value={location.name} maxLength={150} required onChange={e => change('name', e.target.value)} /></label></div><div className="form-grid">{[['latitude', 'Vĩ độ', -90, 90], ['longitude', 'Kinh độ', -180, 180], ['radiusMeters', 'Bán kính (m)', 10, 10000]].map(([key, label, min, max]) => <label key={key}>{label}<input type="number" step={key === 'radiusMeters' ? '1' : 'any'} min={min} max={max} required value={location[key]} onChange={e => change(key, e.target.value === '' ? '' : Number(e.target.value))} /></label>)}</div><button type="button" className="subtle" onClick={() => field('locations', settings.locations.filter((_, i) => i !== index))}>Gỡ địa điểm</button></section>;
        })}</>}
      </fieldset><div className="actions"><button type="button" className="subtle" disabled={saving} onClick={() => setReload(x => x + 1)}>Tải lại</button>{editable && <button disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu cấu hình'}</button>}</div>
    </form>}{error && <p className="error" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}
    {allowed && !loading && !view && error && <button className="subtle" onClick={() => setReload(x => x + 1)}>Thử tải lại</button>}
  </>;
}
