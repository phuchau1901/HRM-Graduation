import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalSettingsPayload,approvalSettingsGrant,mountApprovalWorkflowSettings} from '../assets/js/pages/administration/system-settings/approval-workflow-settings.js';
import {apiApprovalWorkflowSettings} from '../assets/js/api/client.js';
import {systemSettingTabs} from '../assets/js/pages/administration/system-settings/system-settings.js';
import {masterDataTabs} from '../assets/js/pages/administration/master-data/master-data.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {roleScreenCatalog,roleMenuGroups} from '../assets/js/pages/administration/roles.js';
const route=()=>({requestType:'LEAVE',allowSelfApproval:false,steps:[{approverType:'TEAM_LEAD'},{approverType:'DEPARTMENT_MANAGER'},{approverType:'HR',userId:' hr-user ',roleCode:'HR'}]});

test('System Settings owns attendance and workflow tabs with independent permission aliases',()=>{
 assert.deepEqual(Object.keys(systemSettingTabs),['password-policy','attendance','approval-workflow']);assert.equal(masterDataTabs.attendance,undefined);
 assert.ok(screenRoutes['/admin/settings'].includes('WEB_APPROVAL_SETTINGS'));assert.ok(!screenRoutes['/admin/master-data'].includes('WEB_SYSTEM_SETTINGS'));
 const screens=roleScreenCatalog([{id:10,code:'WEB_SYSTEM_SETTINGS',name:'Hệ thống',platform:'WEB'}]);
 const admin=roleMenuGroups(screens).find(group=>group.name==='Administration');
 assert.ok(admin.entries.some(screen=>screen.code==='WEB_APPROVAL_SETTINGS'&&screen.label.startsWith('System Settings')));
 assert.ok(!admin.subgroups.find(group=>group.name==='Master Data').entries.some(screen=>screen.code==='WEB_SYSTEM_SETTINGS'||screen.code==='WEB_APPROVAL_SETTINGS'));
});
test('workflow payload preserves route and step order with version zero and explicit users',()=>{
 const payload=approvalSettingsPayload(0,[route()]);
 assert.equal(payload.version,0);assert.deepEqual(payload.routes[0].steps,[{approverType:'TEAM_LEAD'},{approverType:'DEPARTMENT_MANAGER'},{approverType:'HR',userId:'hr-user',roleCode:'HR'}]);
 const second={...route(),requestType:'OVERTIME',steps:[{approverType:'HR',userId:'overtime-hr'}]};
 assert.deepEqual(approvalSettingsPayload(3,[second,route()]).routes.map(item=>item.requestType),['OVERTIME','LEAVE']);
 assert.throws(()=>approvalSettingsPayload(-1,[route()]));assert.throws(()=>approvalSettingsPayload(0,[]));assert.throws(()=>approvalSettingsPayload(1,[route(),route()]),/trùng/);
 for(const invalid of [{...route(),requestType:'UNKNOWN'},{...route(),steps:[]},{...route(),steps:Array.from({length:11},()=>({approverType:'HR'}))},{...route(),allowSelfApproval:'true'},{...route(),steps:[{approverType:'ADMIN'}]},{...route(),steps:[{approverType:'HR',userId:'A'.repeat(101)}]}])assert.throws(()=>approvalSettingsPayload(1,[invalid]));
});
test('workflow settings require their own view and update grants and denied mount does not fetch',async()=>{
 const permission={platform:'WEB',code:'WEB_APPROVAL_SETTINGS',canView:'Y',canUpdate:'N'};
 assert.equal(approvalSettingsGrant('canView',{permissions:[permission]}),true);assert.equal(approvalSettingsGrant('canUpdate',{permissions:[permission]}),false);
 assert.equal(approvalSettingsGrant('canView',{permissions:[{...permission,code:'WEB_SYSTEM_SETTINGS'}]}),false);
 const previous=globalThis.fetch;let called=false;
 try{globalThis.fetch=()=>{called=true;};const root={innerHTML:''};await mountApprovalWorkflowSettings(root);assert.match(root.innerHTML,/chưa có quyền/);assert.equal(called,false);}finally{globalThis.fetch=previous;}
});
test('workflow settings GET and PUT send version in body, replace routes, and never retry conflicts',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({version:1,routes:[route()]})};};
  await apiApprovalWorkflowSettings();const payload=approvalSettingsPayload(0,[route()]);await apiApprovalWorkflowSettings(payload);
  assert.ok(calls[0].url.endsWith('/api/approval-workflow-settings'));assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[1].options.method,'PUT');assert.deepEqual(JSON.parse(calls[1].options.body),payload);assert.equal(calls[1].options.headers.has('If-Match'),false);
  assert.throws(()=>apiApprovalWorkflowSettings({routes:[]}),/phiên bản/);
  let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status:409,json:async()=>({message:'Version changed'})};};
  await assert.rejects(apiApprovalWorkflowSettings(payload),/Version changed/);assert.equal(attempts,1);
 }finally{globalThis.fetch=previous;}
});

test('USER approver is chosen by employeeId and never by supplied userId',()=>{
 const configured={...route(),steps:[{approverType:'USER',employeeId:'12',userId:'ignored-account',roleCode:'IGNORED'}]};
 assert.deepEqual(approvalSettingsPayload(3,[configured]).routes[0].steps,[{approverType:'USER',employeeId:12}]);
 for(const employeeId of [null,'',0,-1,1.5,'account-name'])assert.throws(()=>approvalSettingsPayload(3,[{...route(),steps:[{approverType:'USER',employeeId,userId:'not-a-substitute'}]}]),/nhân viên/);
});
test('manager steps discard account configuration and HR legacy keeps explicit account and role',()=>{
 const configured={...route(),steps:[{approverType:'TEAM_LEAD',employeeId:42,userId:'wrong-user',roleCode:'ADMIN'},{approverType:'DEPARTMENT_MANAGER',employeeId:43,userId:'wrong-manager'},{approverType:'HR',userId:' legacy-hr ',roleCode:' HR '} ]};
 assert.deepEqual(approvalSettingsPayload(2,[configured]).routes[0].steps,[{approverType:'TEAM_LEAD'},{approverType:'DEPARTMENT_MANAGER'},{approverType:'HR',userId:'legacy-hr',roleCode:'HR'}]);
 assert.throws(()=>approvalSettingsPayload(2,[{...route(),steps:[{approverType:'HR',roleCode:'HR'}]}]),/tài khoản/);
});
test('step fields show employee selection only for USER and legacy account fields only for HR',async()=>{
 const {approvalStepFields,approvalStepForType}=await import('../assets/js/pages/administration/system-settings/approval-workflow-settings.js');
 const employees=[{id:12,fullName:'Nguyễn A',employeeCode:'NV12',employmentStatus:'ACTIVE'}];
 const selected=approvalStepFields({approverType:'USER',employeeId:12,userId:'ignored-user'},0,0,employees);
 assert.ok(selected.includes('data-step-field="employeeId"'));assert.ok(selected.includes('Nguyễn A'));assert.ok(selected.includes('value="12" selected'));assert.ok(!selected.includes('data-step-field="userId"'));assert.ok(!selected.includes('ignored-user'));
 const manual=approvalStepFields({approverType:'USER'},0,0,null);assert.ok(manual.includes('type="number"'));assert.ok(manual.includes('ID nhân viên duyệt'));
 for(const approverType of ['TEAM_LEAD','DEPARTMENT_MANAGER']){const fields=approvalStepFields({approverType},0,0,employees);assert.ok(!fields.includes('data-step-field="employeeId"'));assert.ok(!fields.includes('data-step-field="userId"'));assert.ok(fields.includes('Tự lấy'));}
 const legacy=approvalStepFields({approverType:'HR',userId:'legacy'},0,0,employees);assert.ok(legacy.includes('data-step-field="userId"'));assert.ok(legacy.includes('data-step-field="roleCode"'));
 assert.deepEqual(approvalStepForType({userId:'old',roleCode:'HR'},'USER'),{approverType:'USER',employeeId:null});
 assert.deepEqual(approvalStepForType({employeeId:12,userId:'old'},'TEAM_LEAD'),{approverType:'TEAM_LEAD'});
});

test('designated employee search matches names and codes without accents and retains the selected employee',async()=>{
 const {approvalEmployeeOptions,approvalStepFields}=await import('../assets/js/pages/administration/system-settings/approval-workflow-settings.js');
 const employees=[{id:12,fullName:'Nguyễn Đăng An',employeeCode:'NV000012'},{id:13,fullName:'Trần Bình',employeeCode:'NV000013'}];
 const name=approvalEmployeeOptions(employees,null,'nguyen dang');assert.ok(name.includes('Nguyễn Đăng An'));assert.ok(!name.includes('Trần Bình'));
 const code=approvalEmployeeOptions(employees,null,' nv000013 ');assert.ok(code.includes('Trần Bình'));assert.ok(!code.includes('Nguyễn Đăng An'));
 const retained=approvalEmployeeOptions(employees,12,'binh');assert.ok(retained.includes('value="12" selected'));assert.ok(retained.includes('Trần Bình'));
 assert.ok(approvalEmployeeOptions(employees,null,'khong co').includes('Không tìm thấy nhân viên phù hợp'));
 assert.ok(approvalEmployeeOptions(employees,99,'khong co').includes('value="99" selected'));
 const fields=approvalStepFields({approverType:'USER',employeeId:12},0,1,employees,'nguyen');assert.ok(fields.includes('data-approval-employee-search'));assert.ok(fields.includes('value="nguyen"'));assert.ok(!fields.includes('Trần Bình'));
});
