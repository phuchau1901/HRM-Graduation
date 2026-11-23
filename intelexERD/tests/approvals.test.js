import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalTabs,visibleApprovalTabs,workflowGrant,workflowCreatePayload,workflowCanCancel,workflowRows,mountApprovals} from '../assets/js/pages/approval-center/approvals.js';
import {apiWorkflowList,apiWorkflowDetail,apiCreateWorkflow,apiWorkflowAction,login,apiLogout} from '../assets/js/api/client.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {roleMenuGroups,roleScreenCatalog,roleScopeSelect,rolePermissionPatch} from '../assets/js/pages/administration/roles.js';

const session=(code,extra={})=>({user:{employeeId:42,userId:'self'},permissions:[{platform:'WEB',code,canView:'Y',...extra}]});
test('each request tab requires its own screen grant and menu entry',()=>{
 for(const kind of ['leave','overtime','adjustment']){
  const current=session(approvalTabs[kind].screen,{canNew:'Y'});
  assert.deepEqual(visibleApprovalTabs(current),[kind]);assert.equal(workflowGrant(kind,'canNew',current),true);assert.equal(workflowGrant(kind,'canUpdate',current),false);
  assert.ok(screenRoutes['/approvals'].includes(approvalTabs[kind].screen));
 }
 assert.deepEqual(visibleApprovalTabs(session('WEB_APPROVALS')),['all']);
 assert.deepEqual(visibleApprovalTabs(session('WEB_LEAVE')),[]);
});
test('role menu lists request screens under My Workspace with independent view scopes',()=>{
 const screens=roleScreenCatalog([]),group=roleMenuGroups(screens).find(group=>group.name==='My Workspace');
 assert.equal(group.nested,true);assert.deepEqual(group.entries.filter(entry=>['WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS'].includes(entry.code)).map(entry=>entry.code),['WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS']);
 for(const code of group.entries.filter(entry=>['WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS'].includes(entry.code)).map(entry=>entry.code)){
  const html=roleScopeSelect(code,'VIEW','Xem','DEPARTMENT');for(const label of ['Chính mình','Cùng phòng ban','Tất cả'])assert.ok(html.includes(label));
  assert.equal(roleScopeSelect(code,'NEW','Thêm mới'), '');
 }
 const patch=rolePermissionPatch(new Map([['WEB_OVERTIME_REQUESTS',{VIEW:true,NEW:true}]]),new Set(['WEB_OVERTIME_REQUESTS']),new Set(),new Map([['WEB_OVERTIME_REQUESTS',{VIEW:'ALL'}]]));
 assert.deepEqual(patch[0].dataScopes,{VIEW:'ALL'});
});
test('request payloads follow separate contracts and send explicit Vietnam offsets',()=>{
 assert.deepEqual(workflowCreatePayload('leave',{leaveTypeId:'3',fromDate:'2027-01-04',toDate:'2027-01-05',reason:' Family '}),{leaveTypeId:3,fromDate:'2027-01-04',toDate:'2027-01-05',reason:'Family'});
 assert.deepEqual(workflowCreatePayload('overtime',{startAt:'2027-01-04T18:00',endAt:'2027-01-04T20:00',reason:'Work'}),{startAt:'2027-01-04T18:00:00+07:00',endAt:'2027-01-04T20:00:00+07:00',reason:'Work'});
 assert.deepEqual(workflowCreatePayload('adjustment',{attendanceId:'10',proposedCheckIn:'2026-11-16T08:00',proposedCheckOut:'',reason:'Forgot'}),{attendanceId:10,proposedCheckIn:'2026-11-16T08:00:00+07:00',proposedCheckOut:null,reason:'Forgot'});
 for(const values of [{leaveTypeId:0,fromDate:'2027-01-01',toDate:'2027-01-01',reason:'A'},{leaveTypeId:1,fromDate:'2027-02-30',toDate:'2027-03-01',reason:'A'},{leaveTypeId:1,fromDate:'2027-01-02',toDate:'2027-01-01',reason:'A'},{leaveTypeId:1,fromDate:'2027-01-01',toDate:'2027-01-01',reason:' '}])assert.throws(()=>workflowCreatePayload('leave',values));
 assert.throws(()=>workflowCreatePayload('overtime',{startAt:'2027-01-01T20:00',endAt:'2027-01-01T18:00',reason:'A'}));
 assert.throws(()=>workflowCreatePayload('adjustment',{attendanceId:1,reason:'A'}));
});
test('only own cancellable requests with UPDATE can expose cancel',()=>{
 const current=session('WEB_LEAVE_REQUESTS',{canUpdate:'Y'});
 assert.equal(workflowCanCancel('leave',{employeeId:42,status:'PENDING'},current),true);
 assert.equal(workflowCanCancel('leave',{employeeId:42,status:'APPROVED'},current),true);
 assert.equal(workflowCanCancel('leave',{employeeId:43,status:'PENDING'},current),false);
 assert.equal(workflowCanCancel('leave',{employeeId:42,status:'REJECTED'},current),false);
 assert.equal(workflowCanCancel('leave',{employeeId:42,status:'PENDING'},session('WEB_LEAVE_REQUESTS')),false);
 assert.equal(workflowCanCancel('overtime',{employeeId:42,status:'APPROVED'},session('WEB_OVERTIME_REQUESTS',{canUpdate:'Y'})),false);
});
test('workflow rows use API values and escape content; denied view never fetches',async()=>{
 const html=workflowRows('leave',[{employeeId:42,employeeName:'<img>',leaveTypeName:'Phép năm',reason:'<script>',fromDate:'2027-01-04',toDate:'2027-01-05',status:'PENDING'}]);
 assert.ok(html.includes('&lt;img&gt;'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('Phép năm'));assert.ok(html.includes('04/01/2027'));
 const previous=globalThis.fetch;let called=false;try{globalThis.fetch=()=>{called=true;};const root={innerHTML:''};await mountApprovals(root);assert.equal(called,false);assert.match(root.innerHTML,/chưa có quyền/);}finally{globalThis.fetch=previous;}
});
test('workflow API uses server pagination and action-specific POST with supplied request or approval version',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:1,version:2})};};
  await apiWorkflowList('leave',new URLSearchParams({page:2,pageSize:20,view:'MY',status:'PENDING'}).toString());
  const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/leave-requests');assert.equal(url.searchParams.get('view'),'MY');assert.equal(url.searchParams.get('page'),'2');
  await apiWorkflowDetail('overtime',7);assert.ok(calls[1].url.endsWith('/api/overtime-requests/7'));
  const payload=workflowCreatePayload('adjustment',{attendanceId:10,proposedCheckIn:'2026-11-16T08:00',reason:'Forgot'});
  await apiCreateWorkflow('adjustment',payload);assert.ok(calls[2].url.endsWith('/api/attendance-adjustments'));assert.equal(calls[2].options.method,'POST');assert.deepEqual(JSON.parse(calls[2].options.body),payload);
  await apiWorkflowAction('leave',4,'cancel',{version:3,reason:'Cancel'});assert.ok(calls[3].url.endsWith('/api/leave-requests/4/cancel'));assert.equal(JSON.parse(calls[3].options.body).version,3);
  await apiWorkflowAction('all',8,'approve',{version:9,reason:'Checked'});assert.ok(calls[4].url.endsWith('/api/approvals/8/approve'));assert.equal(JSON.parse(calls[4].options.body).version,9);
  assert.throws(()=>apiWorkflowDetail('adjustment',1));assert.throws(()=>apiWorkflowAction('leave',1,'approve',{}));
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Version changed; reload'})});
  await assert.rejects(apiWorkflowAction('leave',4,'cancel',{version:3,reason:'Cancel'}),/Version changed/);
 }finally{globalThis.fetch=previous;}
});

test('request scope editor labels controls and persists SELF defaults as displayed',async()=>{
 const {roleScopeDraft}=await import('../assets/js/pages/administration/roles.js');
 const screens=['WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS','WEB_APPROVALS'].map(code=>({code}));
 const scopes=roleScopeDraft(screens,[{screenCode:'WEB_LEAVE_REQUESTS',dataScopes:{VIEW:'DEPARTMENT'}},{screenCode:'WEB_APPROVALS',dataScopes:{VIEW:'ALL',APPROVE:'DEPARTMENT'}}]);
 assert.equal(scopes.get('WEB_LEAVE_REQUESTS').VIEW,'DEPARTMENT');assert.equal(scopes.get('WEB_OVERTIME_REQUESTS').VIEW,'SELF');assert.equal(scopes.get('WEB_ATTENDANCE_ADJUSTMENTS').VIEW,'SELF');assert.equal(scopes.get('WEB_APPROVALS').APPROVE,'DEPARTMENT');
 assert.ok(roleScopeSelect('WEB_LEAVE_REQUESTS','VIEW','Xem').includes('Phạm vi dữ liệu'));
 const patch=rolePermissionPatch(new Map([['WEB_OVERTIME_REQUESTS',{VIEW:true,NEW:true}]]),new Set(['WEB_OVERTIME_REQUESTS']),new Set(),scopes);
 assert.deepEqual(patch[0].dataScopes,{VIEW:'SELF'});
});

test('workspace request tabs use only their matching permission and always query MY without nested tabs',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{
 globalThis.fetch=async(url)=>{calls.push(url);return {ok:true,json:async()=>url.endsWith('/api/auth/login')?{accessToken:'test',user:{userId:'self'},permissions:['WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS'].map(code=>({platform:'WEB',code,canView:'Y',canNew:'Y'}))}:{success:true,total:0,data:[]}};};
 await login('self','test');
 for(const kind of ['leave','overtime','adjustment']){
 const control={elements:{status:{value:''}},addEventListener(){}},root={innerHTML:'',isConnected:true,querySelector:()=>control,querySelectorAll:()=>[]};
 await mountApprovals(root,{}, {kind,own:true});
 assert.equal(new URL(calls.at(-1)).searchParams.get('view'),'MY');assert.ok(!root.innerHTML.includes('name="view"'));assert.ok(!root.innerHTML.includes('role="tablist"'));assert.ok(root.innerHTML.includes('workflow-create'));
 }
 }finally{apiLogout();globalThis.fetch=previous;}
});

test('KPI approval tab requires approval and KPI VIEW grants and has no independent create grant',()=>{
 const current={permissions:[{platform:'WEB',code:'WEB_APPROVALS',canView:'Y',canApprove:'Y'},{platform:'WEB',code:'WEB_KPI_EVALUATION',canView:'Y',canApprove:'Y'}]};
 assert.equal(approvalTabs.kpi.label,'KPI');assert.deepEqual(visibleApprovalTabs(current),['all','kpi']);assert.equal(workflowGrant('kpi','canApprove',current),true);
 for(const code of ['WEB_APPROVALS','WEB_KPI_EVALUATION']){const denied={permissions:current.permissions.map(p=>p.code===code?{...p,canView:'N'}:p)};assert.ok(!visibleApprovalTabs(denied).includes('kpi'));}
 const noApprove={permissions:current.permissions.map(p=>p.code==='WEB_KPI_EVALUATION'?{...p,canApprove:'N'}:p)};assert.equal(workflowGrant('kpi','canApprove',noApprove),false);
});
