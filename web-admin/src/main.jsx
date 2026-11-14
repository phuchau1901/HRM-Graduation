import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createApi, can } from './api';
import { SystemSettings } from './SystemSettings';
import { AttendanceSetup } from './AttendanceSetup';
import { Employees } from './Employees';
import './styles.css';
function App() {
  const [session, setSession] = useState(null), [error, setError] = useState(''), [pending, setPending] = useState(false);
  const [page, setPage] = useState('employees');
  const api = useMemo(() => createApi(session?.accessToken, () => setSession(null)), [session?.accessToken]);
  async function login(event) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setPending(true); setError('');
    try { setSession(await api('/auth/login', { method: 'POST', body: JSON.stringify({ userId: fields.get('userId'), password: fields.get('password') }) })); }
    catch (err) { setError(err.message); } finally { setPending(false); }
  }
  if (!session) return <main className="login"><form className="card editor" onSubmit={login}><span className="eyebrow">HRM / PEOPLE</span><h1>Kết nối con người.</h1><p>Đăng nhập để xem và quản lý hồ sơ nhân viên.</p><label>Tài khoản<input name="userId" autoComplete="username" required /></label><label>Mật khẩu<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="error" role="alert">{error}</p>}<button disabled={pending}>{pending ? 'Đang đăng nhập…' : 'Đăng nhập'}</button></form></main>;
  return <div className="app"><aside><a className="brand" href="#">H<span>HRM / PEOPLE</span></a><span className="eyebrow">KHÔNG GIAN NHÂN SỰ</span><nav><button className={page === 'employees' ? 'active' : ''} onClick={() => setPage('employees')}>Nhân viên ↗</button>{can(session.permissions, 'WEB_SYSTEM_SETTINGS', 'VIEW') && <button className={page === 'settings' ? 'active' : ''} onClick={() => setPage('settings')}>Cấu hình hệ thống ↗</button>}{(can(session.permissions, 'WEB_SHIFTS', 'VIEW') || can(session.permissions, 'WEB_WORK_SCHEDULES', 'VIEW')) && <button className={page === 'attendance' ? 'active' : ''} onClick={() => setPage('attendance')}>Ca & lịch làm việc ↗</button>}</nav><div className="account"><strong>{session.user.userId}</strong><small>{session.user.email}</small><button className="subtle" onClick={() => setSession(null)}>Đăng xuất</button></div></aside><main className="workspace"><header>HRM Workspace / {page === 'settings' ? 'System Settings' : page === 'attendance' ? 'Attendance' : 'Employees'}</header>{page === 'settings' ? <SystemSettings api={api} permissions={session.permissions} /> : page === 'attendance' ? <AttendanceSetup api={api} permissions={session.permissions} /> : <Employees api={api} permissions={session.permissions} />}</main></div>;
}
createRoot(document.getElementById('root')).render(<App />);
