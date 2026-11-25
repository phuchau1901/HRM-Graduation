import test from 'node:test';
import assert from 'node:assert/strict';
import {apiDashboard,login,apiLogout} from '../assets/js/api/client.js';
import {dashboardSourceGrant,dashboardNumber,dashboardSummaryMarkup,dashboardTrendMarkup,dashboardPendingMarkup,dashboardMyMarkup} from '../assets/js/pages/dashboard/dashboard-api.js';
import {routeAllowed} from '../assets/js/permissions.js';

test('dashboard uses source VIEW grants rather than role names or a new screen',async()=>{
 assert.equal(dashboardSourceGrant('WEB_PAYROLL',{roles:['ADMIN'],permissions:[]}),false);
 assert.equal(dashboardSourceGrant('WEB_PAYROLL',{permissions:[{platform:'WEB',code:'WEB_PAYROLL',canView:'Y'}]}),true);
 const previous=globalThis.fetch;try{globalThis.fetch=async()=>({ok:true,json:async()=>({accessToken:'fixture',user:{userId:'employee'},permissions:[]})});await login('employee','fixture');assert.equal(routeAllowed({}, {},'/dashboard'),true);}finally{apiLogout();globalThis.fetch=previous;}
});
test('dashboard APIs use no-store, abort signals, whitelisted filters and no department for personal data',async()=>{
 const previous=globalThis.fetch,calls=[],signal=new AbortController().signal;
 try{globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url,'http://local'),options});return {ok:true,json:async()=>({success:true,data:{}})};};
 for(const key of ['summary','attendance-trend','department-distribution','pending-tasks','kpi-overview','payroll-overview','my-overview'])await apiDashboard(key,{year:2026,month:11,departmentId:3,employeeId:99},signal);
 for(const {url,options} of calls){assert.equal(options.signal,signal);assert.equal(options.cache,'no-store');assert.equal(url.searchParams.get('year'),'2026');assert.equal(url.searchParams.has('employeeId'),false);assert.equal(url.searchParams.has('departmentId'),!url.pathname.endsWith('my-overview'));}
 assert.throws(()=>apiDashboard('unknown'));
 globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Multiple currencies'})});await assert.rejects(apiDashboard('payroll-overview'),/Multiple currencies/);
 }finally{globalThis.fetch=previous;}
});
test('summary distinguishes real zeros, unavailable metrics and missing historical data',()=>{
 assert.equal(dashboardNumber(null),'—');assert.equal(dashboardNumber(0),'0');
 const html=dashboardSummaryMarkup({period:{periodKey:'2026-11',asOfDate:'2026-11-25'},employees:{active:0,newHires:0,departures:null,departuresNote:'Không có lịch sử nghỉ việc'},approvedLeaveRequests:null,expiringContracts:0});
 assert.match(html,/Nhân viên đang làm việc/);assert.match(html,/Không có lịch sử nghỉ việc/);assert.match(html,/—/);assert.doesNotMatch(html,/Đơn nghỉ phép đã duyệt/);
 assert.match(dashboardSummaryMarkup({employees:null,attendance:null}),/Chưa có quyền/);
});
test('attendance uses actual API days, empty state and nullable rates without invented denominators',()=>{
 assert.match(dashboardTrendMarkup({totals:{eligible:0,presenceRate:null},days:[]}),/Chưa có dữ liệu/);
 const html=dashboardTrendMarkup({totals:{eligible:2,present:1},days:[{date:'2026-11-25',metrics:{eligible:2,present:1,late:0}}]});assert.match(html,/data-dashboard-chart="attendance"/);assert.match(html,/2 ca đủ điều kiện/);assert.doesNotMatch(html,/height:/);
});
test('pending links use approval IDs and personal overview only displays supplied data',()=>{
 const html=dashboardPendingMarkup({total:1,items:[{id:7,requestType:'PAYROLL_PERIOD',employeeName:'<script>',stepNo:2,href:'javascript:alert(1)'}]});assert.match(html,/#\/approvals\?approvalId=7/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/javascript:/);
 const own=dashboardMyMarkup({employeeLinked:false,attendance:null,leave:null,kpi:null,payroll:null,unreadNotifications:0,notifications:[]});assert.match(own,/chưa liên kết/);assert.doesNotMatch(own,/Thực lĩnh/);
});

test('dashboard quick actions and stat navigation obey destination VIEW grants',async()=>{
 const {dashboardQuickActions}=await import('../assets/js/pages/dashboard/dashboard-api.js');
 const previous=globalThis.fetch;try{
 globalThis.fetch=async()=>({ok:true,json:async()=>({accessToken:'fixture',user:{userId:'personal'},permissions:[{platform:'WEB',code:'WEB_MY_ATTENDANCE',canView:'Y'}]})});await login('personal','fixture');
 assert.equal(dashboardQuickActions(),'');
 const html=dashboardSummaryMarkup({employees:{active:12,newHires:1,departures:null},attendance:{totals:{presenceRate:null,late:0}}});assert.doesNotMatch(html,/href=/);assert.match(html,/—/);assert.doesNotMatch(html,/—<small>%/);
 globalThis.fetch=async()=>({ok:true,json:async()=>({accessToken:'fixture',user:{userId:'hr'},permissions:[{platform:'WEB',code:'WEB_EMPLOYEES',canView:'Y'}]})});await login('hr','fixture');
 assert.match(dashboardQuickActions(),/#\/hr\/employees/);assert.doesNotMatch(dashboardQuickActions(),/payroll/);
 }finally{apiLogout();globalThis.fetch=previous;}
});
