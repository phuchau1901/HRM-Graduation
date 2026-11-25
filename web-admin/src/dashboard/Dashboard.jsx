import React, { lazy, Suspense, useEffect, useState } from 'react';
import { can } from '../api';
import './dashboard.css';
const Charts = lazy(() => import('./DashboardCharts'));
const number = value => value == null ? '—' : new Intl.NumberFormat('vi-VN').format(value);
export const money = (value, currency = 'VND') => new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: currency === 'VND' ? 0 : 2 }).format(value);
const initialPeriod = () => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).formatToParts(new Date()).reduce((a,p)=>({...a,[p.type]:p.value}),{});
function Skeleton() { return <div className="dash-skeleton" role="status" aria-label="Đang tải Dashboard"><i/><i/><i/></div>; }
function Panel({title, state, children, className=''}) { return <section className={`dash-panel ${className}`}><h2>{title}</h2>{!state || state.loading ? <Skeleton/> : state.error ? <p role="alert" className="error">{state.error}</p> : children}</section>; }
function Card({label,value,note,href,accent=''}) { return <a className={`dash-card ${accent}`} href={href}><span>{label} <b aria-hidden="true">↗</b></span><strong>{value}</strong>{note&&<small>{note}</small>}</a>; }
const typeNames={LEAVE:'Nghỉ phép',LEAVE_CANCELLATION:'Hủy nghỉ phép',OVERTIME:'Tăng ca',ATTENDANCE_ADJUSTMENT:'Điều chỉnh công',KPI_EVALUATION:'Đánh giá KPI',PAYROLL_PERIOD:'Kỳ lương'};
export function Dashboard({api,permissions,user}) {
 const initial=initialPeriod();
 const [period,setPeriod]=useState(`${initial.year}-${initial.month}`),[department,setDepartment]=useState(''),[revision,setRevision]=useState(0),[data,setData]=useState({});
 const allowed=code=>can(permissions,code,'VIEW');
 const employeeView=allowed('WEB_EMPLOYEES'),payrollView=allowed('WEB_PAYROLL'),kpiView=allowed('WEB_KPI_EVALUATION'),approvalView=allowed('WEB_APPROVALS');
 useEffect(()=>{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))return;
  const controller=new AbortController();const [year,month]=period.split('-');const query=new URLSearchParams({year,month});if(department)query.set('departmentId',department);
  const sections=[['summary','summary'],['mine','my-overview'],...(employeeView?[['departments','department-distribution']]:[]),...(payrollView?[['payroll','payroll-overview']]:[]),...(kpiView?[['kpi','kpi-overview']]:[]),...(approvalView?[['pending','pending-tasks']]:[])];
  setData(Object.fromEntries(sections.map(([key])=>[key,{loading:true}])));
  for(const [key,path] of sections) { const sectionQuery=new URLSearchParams(query);if(key==='mine')sectionQuery.delete('departmentId');api(`/dashboard/${path}?${sectionQuery}`,{signal:controller.signal}).then(result=>{if(!controller.signal.aborted)setData(current=>({...current,[key]:{value:result.data}}));}).catch(e=>{if(!controller.signal.aborted)setData(current=>({...current,[key]:{error:e.message}}));}); }
  return()=>controller.abort();
 },[api,period,department,revision,employeeView,payrollView,kpiView,approvalView]);
 useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh);},[]);
 const summary=data.summary?.value,mine=data.mine?.value,departments=data.departments?.value??[];
 const attendance=summary?.attendance??mine?.attendance;
 const payroll=data.payroll?.value;
 const actions=[['WEB_MY_ATTENDANCE','VIEW','Chấm công','#/hr/my-attendance'],['WEB_LEAVE_REQUESTS','NEW','Tạo đơn nghỉ phép','#/hr/my-leave'],['WEB_WORK_SCHEDULES','VIEW','Lịch làm việc','#/hr/work-schedules'],['WEB_APPROVALS','VIEW','Approval Center','#/approvals'],['WEB_MY_PAYSLIPS','VIEW','Phiếu lương của tôi','#/payroll/my-payslips']].filter(([code,action])=>can(permissions,code,action));
 function goDepartment(id){setDepartment(String(id));}
 return <div className="dashboard">
  <div className="dash-heading"><div><span className="eyebrow">INTELEX WORKSPACE / OVERVIEW</span><h1>Xin chào, {mine?.employeeName||user?.userId||'bạn'} <span aria-hidden="true">☀</span></h1><p>Những điều cần biết để bắt đầu ngày làm việc.</p></div><div className="dash-filters"><label>Kỳ báo cáo<input aria-label="Kỳ báo cáo" type="month" min="2000-01" max="2100-12" value={period} onChange={e=>{if(e.target.value)setPeriod(e.target.value);}}/></label>{employeeView&&<label>Phòng ban<select aria-label="Phòng ban Dashboard" value={department} onChange={e=>setDepartment(e.target.value)}><option value="">Trong phạm vi được phép</option>{departments.map(d=><option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>)}</select></label>}<button type="button" className="subtle" onClick={()=>setRevision(v=>v+1)}>Làm mới ↻</button></div></div>
  <Panel title="Tổng quan trong phạm vi của bạn" state={data.summary} className="dash-overview">
   <div className="dash-cards">
    {summary?.employees&&<><Card label="Nhân viên đang làm việc" value={number(summary.employees.active)} note={`Tại ${summary.period.asOfDate}`} href="#/hr/employees" accent="mint"/><Card label="Nhân viên mới trong kỳ" value={number(summary.employees.newHires)} note={period} href="#/hr/employees"/><Card label="Nghỉ việc trong kỳ" value={number(summary.employees.departures)} note={summary.employees.departuresNote} href="#/hr/employees"/></>}
    {attendance&&<><Card label="Tỷ lệ có mặt" value={attendance.totals.presenceRate==null?'—':`${number(attendance.totals.presenceRate)}%`} note="Trên lượt ca đủ điều kiện tính" href={summary?.attendance?'#/hr/attendance':'#/hr/my-attendance'} accent="blue"/><Card label="Vắng mặt" value={number(attendance.totals.absent)} note="Đã hết cửa sổ chấm công, không nghỉ phép" href={summary?.attendance?'#/hr/attendance':'#/hr/my-attendance'}/><Card label="Thiếu lượt chấm" value={number(attendance.totals.missingCheckIn+attendance.totals.missingCheckOut)} note="Thiếu vào hoặc thiếu ra" href={summary?.attendance?'#/hr/attendance':'#/hr/my-attendance'}/></>}
    {summary?.approvedLeaveRequests!=null&&<Card label="Đơn nghỉ đã duyệt" value={number(summary.approvedLeaveRequests)} note="Đơn giao với kỳ đang chọn" href={allowed('WEB_LEAVE_MANAGEMENT')?'#/hr/leave-management':'#/hr/my-leave'}/>}
    {summary?.expiringContracts!=null&&<Card label="Hợp đồng sắp hết hạn" value={number(summary.expiringContracts)} note="Trong 30 ngày từ hôm nay" href="#/hr/contracts" accent="peach"/>}
   </div>
   {summary&&!summary.employees&&!summary.attendance&&summary.approvedLeaveRequests==null&&summary.expiringContracts==null&&<p className="dash-empty">Dữ liệu tổng hợp theo quyền hiện tại. Xem thông tin cá nhân bên dưới.</p>}
  </Panel>
  <div className="dash-grid">
   <Panel title="Xu hướng chấm công" state={summary?.attendance?data.summary:data.mine} className="dash-wide">
    {!attendance||attendance.totals.scheduled===0?<p className="dash-empty">Chưa có lịch làm việc trong kỳ được phép xem.</p>:<><div className="dash-metrics"><span>Đi trễ <b>{number(attendance.totals.late)}</b></span><span>Về sớm <b>{number(attendance.totals.early)}</b></span><span>Nghỉ phép <b>{number(attendance.totals.onLeave)}</b></span></div><Suspense fallback={<Skeleton/>}><Charts kind="attendance" data={attendance.days.map(d=>({date:d.date.slice(5),...d.metrics}))}/></Suspense><small>Đơn vị: lượt ca/ngày. Không kết luận vắng khi còn trong cửa sổ hợp lệ. {attendance.totals.unverified>0&&`${attendance.totals.unverified} ca thiếu snapshot, chưa đưa vào tỷ lệ.`}</small></>}
   </Panel>
   {employeeView&&<Panel title="Nhân sự theo phòng ban" state={data.departments}>{departments.length?<Suspense fallback={<Skeleton/>}><Charts kind="department" data={departments} onDepartment={goDepartment}/></Suspense>:<p className="dash-empty">Chưa có nhân viên đang làm việc trong phạm vi này.</p>}</Panel>}
   {kpiView&&<Panel title="Kết quả KPI" state={data.kpi}><div className="dash-metrics"><span>Đã giao <b>{number(data.kpi?.value?.assigned)}</b></span><span>Điểm đã duyệt <b>{number(data.kpi?.value?.averageApprovedScore)}</b></span><a href="#/performance/evaluation">Chi tiết ↗</a></div>{data.kpi?.value?.assigned?<Suspense fallback={<Skeleton/>}><Charts kind="kpi" data={data.kpi.value.statuses}/></Suspense>:<p className="dash-empty">Chưa có KPI trong kỳ.</p>}</Panel>}
   {payrollView&&<Panel title="Quỹ lương thực tế" state={data.payroll}><p className="dash-caption">Kết quả đã tính; phân biệt trạng thái duyệt, phát hành và thanh toán.</p><strong className="dash-money">{payroll?money(payroll.net,payroll.currency):'—'}</strong><span>Thực lĩnh · {number(payroll?.employees)} phiếu lương</span><div className="dash-metrics"><span>Thu nhập <b>{payroll?money(payroll.gross,payroll.currency):'—'}</b></span><span>Khấu trừ <b>{payroll?money(payroll.deductions,payroll.currency):'—'}</b></span></div>{payroll?.statuses.length?<ul className="dash-list">{payroll.statuses.map(s=><li key={s.status}><span>{s.status}</span><b>{money(s.net,payroll.currency)}</b></li>)}</ul>:<p className="dash-empty">Chưa có kết quả lương hợp lệ trong kỳ.</p>}<a href="#/payroll/management">Quản lý kỳ lương ↗</a></Panel>}
   {approvalView&&<Panel title={`Chờ bạn phê duyệt${data.pending?.value?` · ${data.pending.value.total}`:''}`} state={data.pending}>{data.pending?.value?.items.length?<ul className="dash-list">{data.pending.value.items.map(t=><li key={t.id}><a href={t.href}><strong>{typeNames[t.requestType]||t.requestType}</strong><span>{t.employeeName} · Bước {t.stepNo}</span></a><span>↗</span></li>)}</ul>:<p className="dash-empty">Bạn không có công việc đang đến lượt duyệt.</p>}<small>Danh sách chờ hiện tại, bao gồm các kỳ trước.</small><a href="#/approvals">Mở Approval Center ↗</a></Panel>}
   <Panel title="Không gian cá nhân" state={data.mine}>
    {mine&&!mine.employeeLinked?<p className="dash-empty">Tài khoản chưa liên kết nhân viên. Liên hệ HR để xem dữ liệu cá nhân.</p>:<><div className="dash-metrics">{mine?.leave&&<><span>Phép còn lại <b>{number(mine.leave.remaining)} ngày</b></span><span>Đang chờ <b>{number(mine.leave.reserved)} ngày</b></span><span>Khả dụng <b>{number(mine.leave.available)} ngày</b></span></>}{mine?.kpi&&<span>KPI đã duyệt <b>{number(mine.kpi.averageApprovedScore)}</b></span>}</div>{mine?.payroll&&<p><a href="#/payroll/my-payslips">Lương đã phát hành: <strong>{money(mine.payroll.net,mine.payroll.currency)}</strong> ↗</a></p>}{!mine?.leave&&!mine?.kpi&&!mine?.payroll&&<p className="dash-empty">Các chỉ tiêu cá nhân hiển thị khi được cấp quyền tương ứng.</p>}</>}
    <div className="dash-actions">{actions.map(([, ,label,href])=><a key={href} href={href}>{label} ↗</a>)}</div>
   </Panel>
   <Panel title={`Thông báo mới${mine?` · ${mine.unreadNotifications} chưa đọc`:''}`} state={data.mine}>{mine?.notifications.length?<ul className="dash-list dash-notifications">{mine.notifications.map(n=><li key={n.id}><article><strong>{n.title}</strong><p>{n.content}</p><time>{new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(n.publishedAt||n.createdAt))}</time>{!n.readAt&&<button className="subtle" onClick={async()=>{try{await api(`/notifications/${n.id}/read`,{method:'PATCH'});setRevision(v=>v+1);}catch(e){setData(v=>({...v,mine:{error:e.message}}));}}}>Đánh dấu đã đọc</button>}</article></li>)}</ul>:<p className="dash-empty">Chưa có thông báo.</p>}</Panel>
  </div>
 </div>;
}
