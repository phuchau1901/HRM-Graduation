import React, { useEffect, useState } from 'react';
import { allPages, can } from './api';

export function EmployeeEditor({ api, permissions, employee, onClose, onSaved }) {
  const [departmentId, setDepartmentId] = useState(employee?.departmentId || ''), [teamId, setTeamId] = useState(employee?.teamId ?? '');
  const [departments, setDepartments] = useState([]), [teams, setTeams] = useState([]), [positions, setPositions] = useState([]);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false), [success, setSuccess] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (can(permissions, 'WEB_DEPARTMENTS', 'VIEW')) allPages(api, '/departments', controller.signal).then(setDepartments).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    if (can(permissions, 'WEB_POSITIONS', 'VIEW')) allPages(api, '/positions?isActive=true', controller.signal).then(setPositions).catch(err => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [api, permissions]);
  useEffect(() => {
    setTeams([]); setLoading(false);
    if (!departmentId || !can(permissions, 'WEB_TEAMS', 'VIEW')) return;
    const controller = new AbortController(); setLoading(true);
    allPages(api, `/teams?departmentId=${departmentId}&isActive=true`, controller.signal).then(rows => { if (!controller.signal.aborted) setTeams(rows); }).catch(err => { if (!controller.signal.aborted) setError(err.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, permissions, departmentId]);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { fullName: fields.fullName, email: fields.email, dateOfBirth: fields.dateOfBirth || null, phoneNumber: fields.phoneNumber || null, employmentStatus: fields.employmentStatus };
    // Omit catalog fields the editor cannot access so existing Team membership remains intact.
    if (can(permissions, 'WEB_TEAMS', 'VIEW') || !employee) payload.teamId = teamId ? Number(teamId) : null;
    payload.positionId = fields.positionId !== undefined ? (fields.positionId ? Number(fields.positionId) : null) : employee?.positionId ?? null;
    if (!employee) Object.assign(payload, { departmentId: Number(departmentId), hireDate: fields.hireDate });
    try {
      const result = await api(`/employees${employee ? `/${employee.id}` : ''}`, { method: employee ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setSuccess(`Đã lưu nhân viên ${result.employeeCode}.`); onSaved(result);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <section className="card editor"><div className="section-title"><h2>{employee ? 'Cập nhật nhân viên' : 'Thêm nhân viên'}</h2><button className="subtle" disabled={saving} onClick={onClose}>Đóng</button></div><form onSubmit={save}>
    {employee ? <label>Mã nhân viên<input value={employee.employeeCode} readOnly /></label> : <p className="muted">Mã nhân viên sẽ được hệ thống tự động tạo.</p>}
    <div className="form-grid"><label>Họ và tên<input name="fullName" defaultValue={employee?.fullName || ''} maxLength={150} required /></label><label>Email<input name="email" type="email" defaultValue={employee?.email || ''} maxLength={255} required /></label></div>
    <div className="form-grid"><label>Phòng ban<select aria-label="Phòng ban nhân viên" value={departmentId} disabled={!!employee} required onChange={e => { setDepartmentId(e.target.value); setTeamId(''); }}><option value="">Chọn phòng ban</option>{departments.filter(d => d.isActive || d.id === employee?.departmentId).map(d => <option key={d.id} value={d.id}>{d.departmentName}</option>)}{employee && !departments.some(d => d.id === employee.departmentId) && <option value={employee.departmentId}>{employee.departmentName || 'Phòng ban hiện tại'}</option>}</select></label>
    <label>Team<select aria-label="Team nhân viên" value={teamId} disabled={loading || !departmentId || !can(permissions, 'WEB_TEAMS', 'VIEW')} onChange={e => setTeamId(e.target.value)}><option value="">Chưa gán Team</option>{employee?.teamId && !teams.some(t => t.id === employee.teamId) && Number(teamId) === employee.teamId && <option value={employee.teamId}>{employee.teamName || 'Team hiện tại'}</option>}{teams.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}</select></label></div>
    <label>Vị trí<select name="positionId" defaultValue={employee?.positionId ?? ''} disabled={!can(permissions, 'WEB_POSITIONS', 'VIEW')}><option value="">Chưa gán vị trí</option>{employee?.positionId && !positions.some(p => p.id === employee.positionId) && <option value={employee.positionId}>{employee.positionName || 'Vị trí hiện tại'}</option>}{positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="form-grid"><label>Ngày vào làm<input name="hireDate" type="date" defaultValue={employee?.hireDate || ''} disabled={!!employee} required={!employee} /></label><label>Ngày sinh<input name="dateOfBirth" type="date" defaultValue={employee?.dateOfBirth || ''} /></label></div>
    <div className="form-grid"><label>Số điện thoại<input name="phoneNumber" defaultValue={employee?.phoneNumber || ''} maxLength={20} /></label><label>Trạng thái<select name="employmentStatus" defaultValue={employee?.employmentStatus || 'ACTIVE'}><option value="ACTIVE">Đang làm việc</option><option value="INACTIVE">Ngừng hoạt động</option><option value="TERMINATED">Đã nghỉ việc</option></select></label></div>
    {loading && <p role="status">Đang tải Teams…</p>}{error && <p className="error" role="alert">{error}</p>}{success && <p className="success" role="status">{success}</p>}<div className="actions"><button disabled={saving || loading}>{saving ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div>
  </form></section>;
}
