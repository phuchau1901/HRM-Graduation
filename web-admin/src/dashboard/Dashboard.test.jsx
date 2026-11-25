import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,act} from '@testing-library/react';
import {Dashboard,money} from './Dashboard';
vi.mock('./DashboardCharts',()=>({default:({kind})=><div aria-label={`chart-${kind}`}/> }));
afterEach(cleanup);
const view=code=>({code,canView:'Y'});
const period={periodKey:'2026-10',asOfDate:'2026-11-25'};
const summary={period,employees:{active:0,newHires:0,departures:null,departuresNote:'Chưa có ngày nghỉ việc'},attendance:null,approvedLeaveRequests:null,expiringContracts:null};
const mine={period,employeeLinked:true,employeeName:'Nguyễn An',attendance:null,leave:null,kpi:null,payroll:null,unreadNotifications:0,notifications:[]};
function apiMock(override={}){return vi.fn(async path=>{
 const key=path.split('?')[0].split('/').at(-1);
 if(override[key] instanceof Error)throw override[key];
 return {success:true,data:override[key]??({'summary':summary,'my-overview':mine,'department-distribution':[],'kpi-overview':{assigned:0,averageApprovedScore:null,statuses:[]},'pending-tasks':{total:0,items:[]},'payroll-overview':{employees:0,gross:0,net:0,deductions:0,currency:'VND',statuses:[]}}[key])};
});}
describe('Dashboard',()=>{
 it('loads live values and supports zero/empty states with links and period filter',async()=>{
  const api=apiMock();render(<Dashboard api={api} permissions={[view('WEB_EMPLOYEES')]} user={{userId:'an'}}/>);
  expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  const card=await screen.findByRole('link',{name:/Nhân viên đang làm việc/});expect(card.textContent).toContain('0');expect(card.getAttribute('href')).toBe('#/hr/employees');
  expect(await screen.findByText('Chưa có nhân viên đang làm việc trong phạm vi này.')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Kỳ báo cáo'),{target:{value:'2026-10'}});
  await waitFor(()=>expect(api.mock.calls.some(([path])=>path.includes('year=2026&month=10'))).toBe(true));
 });
 it('never requests managed payroll without VIEW and only renders personal published totals',async()=>{
  const api=apiMock({'my-overview':{...mine,payroll:{net:300,currency:'VND'}}});
  render(<Dashboard api={api} permissions={[view('WEB_MY_PAYSLIPS')]} user={{userId:'an'}}/>);
  expect(await screen.findByText(/Lương đã phát hành:/)).toBeTruthy();
  expect(api.mock.calls.some(([path])=>path.includes('/payroll-overview'))).toBe(false);
  expect(screen.queryByText('Quỹ lương thực tế')).toBeNull();
 });
 it('shows a payroll error without substituting fake zero while other sections remain available',async()=>{
  const api=apiMock({'payroll-overview':new Error('Không tải được lương')});
  render(<Dashboard api={api} permissions={[view('WEB_PAYROLL')]} user={{userId:'an'}}/>);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent','Không tải được lương');
  expect(screen.queryByText('Chưa có kết quả lương hợp lệ trong kỳ.')).toBeNull();
  expect(await screen.findByText('Nhân viên đang làm việc')).toBeTruthy();
 });
 it('links assigned tasks directly to approval details and supports notification read',async()=>{
  const api=apiMock({'pending-tasks':{total:1,items:[{id:6,requestType:'PAYROLL_PERIOD',employeeName:'Nguyễn An',stepNo:1,href:'#/approvals?approvalId=6'}]},'my-overview':{...mine,unreadNotifications:1,notifications:[{id:2,title:'Đã phân ca',content:'Lịch đã cập nhật',createdAt:'2026-11-25T01:00:00Z',readAt:null}]}});
  render(<Dashboard api={api} permissions={[view('WEB_APPROVALS')]} user={{userId:'an'}}/>);
  expect((await screen.findByRole('link',{name:/Kỳ lương/})).getAttribute('href')).toBe('#/approvals?approvalId=6');
  fireEvent.click(await screen.findByText('Đánh dấu đã đọc'));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/notifications/2/read',{method:'PATCH'}));
 });
 it('ignores responses from the old filter after changing month',async()=>{
  let release;const old=new Promise(resolve=>{release=resolve;});
  let first=true;const api=vi.fn((path)=>{if(path.includes('/summary?')&&first){first=false;return old;}return Promise.resolve({data:path.includes('/summary?')?{...summary,employees:{...summary.employees,active:7}}:mine});});
  render(<Dashboard api={api} permissions={[]} user={{userId:'an'}}/>);
  fireEvent.change(screen.getByLabelText('Kỳ báo cáo'),{target:{value:'2026-10'}});
  await waitFor(()=>expect(screen.getByRole('link',{name:/Nhân viên đang làm việc/}).textContent).toContain('7'));
  await act(async()=>release({data:{...summary,employees:{...summary.employees,active:999}}}));
  expect(screen.getByRole('link',{name:/Nhân viên đang làm việc/}).textContent).toContain('7');expect(screen.queryByText('999')).toBeNull();
 });
 it('formats VND without fractional money',()=>{expect(money(12500000)).toContain('12.500.000');});
});
