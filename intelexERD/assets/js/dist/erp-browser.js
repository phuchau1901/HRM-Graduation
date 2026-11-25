// Generated file. Edit source modules, then run node scripts/build-browser.js.
(()=>{
"use strict";
// Source: api/client.js
const SESSION_KEY = 'intelex-erp-api-session:v1';
const DEFAULT_BASE_URL = typeof location!=='undefined' && /^https?:$/.test(location.protocol) ? '' : 'https://hrm-graduation.up.railway.app';

function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY))||null;}catch{return null;}}
let session = readSession();

function apiBaseUrl(){return globalThis.window?.INTELEX_API_BASE ?? DEFAULT_BASE_URL;}
function apiSession(){
 if(session?.expiresAtUtc&&Date.parse(session.expiresAtUtc)<=Date.now())apiLogout();
 return session?.accessToken?session:null;
}
function apiLogout(){session=null;try{localStorage.removeItem(SESSION_KEY);}catch{}
 globalThis.window?.dispatchEvent?.(new Event('auth-change'));
}

function reportApiMutation(path,options,ok,message=''){
 const method=options.method||'GET';if(!['POST','PUT','PATCH','DELETE'].includes(method)||path==='/api/auth/login'||path.startsWith('/api/notifications')||path.endsWith('/bulk/preview'))return;
 if(typeof globalThis.window?.dispatchEvent==='function'&&typeof CustomEvent==='function')globalThis.window.dispatchEvent(new CustomEvent('api-mutation',{detail:{path,method,ok,message}}));
}

async function request(path,options={}){
 const headers=new Headers(options.headers||{});
 headers.set('Accept','application/json');
 if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 const requestToken=path!=='/api/auth/login'?apiSession()?.accessToken:null;
 if(requestToken)headers.set('Authorization',`Bearer ${requestToken}`);
 const transport=globalThis['fetch'];
 if(typeof transport!=='function')throw Error('Trình duyệt hiện tại không hỗ trợ kết nối API.');
 const {responseType,...fetchOptions}=options;
 let response;try{response=await transport(apiBaseUrl()+path,{...fetchOptions,headers});}catch(error){reportApiMutation(path,options,false,'Không kết nối được API. Vui lòng thử lại.');throw error;}
 if(response.ok&&response.status===204){reportApiMutation(path,options,true);return null;}
 if(response.ok&&responseType==='blob')return response.blob();
 let body=null;try{body=await response.json();}catch{}
 if(!response.ok){if(response.status===401&&requestToken&&session?.accessToken===requestToken)apiLogout();const error=Error(body?.message||body?.error?.message||`API lỗi HTTP ${response.status}`);error.status=response.status;reportApiMutation(path,options,false,error.message);throw error;}
 reportApiMutation(path,options,true);return responseType==='etag'?{...body,etag:response.headers?.get('ETag')??null}:body;
}

async function login(userId,password){
 const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify({userId,password})});
 if(!result?.accessToken||!result.user||!Array.isArray(result.permissions))throw Error('Phản hồi đăng nhập không hợp lệ.');
 session={...result};
 try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch{}
 globalThis.window?.dispatchEvent?.(new Event('session-change'));
 return session;
}

function me(){return request('/api/auth/me');}
function permissions(){return request('/api/auth/me/permissions');}
function apiEmployees(query='',signal){return request('/api/employees'+(query?`?${query}`:''),{signal});}
function apiEmployeeDetail(employeeId){return request(`/api/employees/${encodeURIComponent(employeeId)}`);}
function apiUnlinkedEmployees(query=''){return request('/api/employees/unlinked'+(query?`?${query}`:''));}
function apiDepartments(query=''){return request('/api/departments'+(query?`?${query}`:''));}
function apiPositions(query=''){return request('/api/positions'+(query?`?${query}`:''));}
function apiNotifications(limit=30,beforeId=null){
 const query=new URLSearchParams({limit});if(beforeId!==null)query.set('beforeId',beforeId);
 return request('/api/notifications?'+query,{cache:'no-store'});
}
function apiNotificationUnreadCount(){return request('/api/notifications/unread-count',{cache:'no-store'});}
function apiReadNotification(id){return request(`/api/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'});}
function apiReadAllNotifications(){return request('/api/notifications/read-all',{method:'PATCH'});}

function apiRoles(page=1,search=''){return request('/api/roles?'+new URLSearchParams({page,pageSize:30,search}));}
function apiCreateRole(payload){return request('/api/roles',{method:'POST',body:JSON.stringify(payload)});}
function apiRoleDetail(roleId){return request(`/api/roles/${encodeURIComponent(roleId)}`);}
function apiUpdateRole(roleId,version,payload){
 if(!version)throw Error('Thiếu version của role. Vui lòng tải lại.');
 return request(`/api/roles/${encodeURIComponent(roleId)}`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify(payload)});
}
async function apiAllScreens(){
 const screens=[];let page=1,total;
 do{const result=await request('/api/screens?'+new URLSearchParams({page,pageSize:100}));
 if(!Array.isArray(result?.data))throw Error('Danh sách màn hình không hợp lệ.');
 screens.push(...result.data);total=result.total;if(!result.data.length)break;page++;
 }while(screens.length<total);
 return screens;
}
function apiRolePermissions(roleId){return request(`/api/roles/${encodeURIComponent(roleId)}/permissions`);}
function apiSaveRolePermissions(roleId,version,screens){
 if(!version)throw Error('Thiếu version của role. Vui lòng tải lại.');
 return request(`/api/roles/${encodeURIComponent(roleId)}/permissions`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify({screens})});
}

function apiUsers(page=1,search=''){return request('/api/users?'+new URLSearchParams({page,pageSize:30,search}));}
function apiCreateUser(payload){return request('/api/users',{method:'POST',body:JSON.stringify(payload)});}
function apiCreateEmployee(payload){return request('/api/employees',{method:'POST',body:JSON.stringify(payload)});}
async function apiAllRoles(){
 const items=[];let page=1;
 while(true){const result=await apiRoles(page);if(!Array.isArray(result?.data))throw Error('Danh sách role không hợp lệ.');items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;}
 return items;
}
async function apiActiveDepartments(){
 const items=[];let page=1;
 while(true){const result=await apiDepartments(new URLSearchParams({page,pageSize:100,isActive:true}).toString());if(!Array.isArray(result?.data))throw Error('Danh sách phòng ban không hợp lệ.');items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;}
 return items.filter(item=>item.isActive);
}

async function apiActivePositions(){
 const items=[];let page=1;
 while(true){const result=await apiPositions(new URLSearchParams({page,pageSize:100,isActive:true}).toString());
 if(!Array.isArray(result?.data))throw Error('Danh sách chức danh không hợp lệ.');
 items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;
 }
 return items.filter(position=>position.isActive);
}

async function apiActiveTeams(departmentId){
 const items=[];let page=1;
 while(true){const result=await request('/api/teams?'+new URLSearchParams({page,pageSize:100,departmentId,isActive:true}));
 if(!Array.isArray(result?.data))throw Error('Danh sách team không hợp lệ.');
 items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;
 }
 return items.filter(team=>team.isActive&&Number(team.departmentId)===Number(departmentId));
}

function apiUserDetail(userId){return request(`/api/users/${encodeURIComponent(userId)}`);}
function apiUpdateUser(userId,version,payload){
 if(!version)throw Error('Thiếu version tài khoản. Vui lòng tải lại.');
 return request(`/api/users/${encodeURIComponent(userId)}`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify(payload)});
}
function apiSetUserStatus(userId,version,status){
 if(!['ACTIVE','LOCKED','INACTIVE'].includes(status))throw Error('Trạng thái tài khoản không hợp lệ.');
 if(!version)throw Error('Thiếu phiên bản tài khoản. Vui lòng tải lại.');
 return request(`/api/users/${encodeURIComponent(userId)}/status`,{method:'PATCH',headers:{'If-Match':`"${version}"`},body:JSON.stringify({status})});
}
function apiUpdateUserRoles(userId,version,roleIds){
 if(!version)throw Error('Thiếu version tài khoản. Vui lòng tải lại.');
 return request(`/api/users/${encodeURIComponent(userId)}/roles`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify({roleIds})});
}

function apiResetUserPassword(userId,version,payload){
 if(!['SELF_CHANGE','ADMIN_RESET'].includes(payload?.type))throw Error('Loại thay đổi mật khẩu không hợp lệ.');
 const body={type:payload.type,newPassword:payload.newPassword,...(payload.type==='SELF_CHANGE'?{oldPassword:payload.oldPassword}:{})};
 return request(`/api/users/${encodeURIComponent(userId)}/reset-password`,{method:'POST',body:JSON.stringify(body)});
}

function apiOrganization(kind,id=null,payload=null,query=''){
 if(!['departments','positions','teams'].includes(kind))throw Error('Danh mục không hợp lệ.');
 const path=`/api/${kind}`+(id===null?'':`/${encodeURIComponent(id)}`)+(query?`?${query}`:'');
 return request(path,payload===null?{}:{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});
}

function apiSystemSettings(kind,settings=null,version=null){
 if(!['password-policy','attendance'].includes(kind))throw Error('Loại cấu hình hệ thống không hợp lệ.');
 if(settings===null)return request(`/api/system-settings/${kind}`);
 if(!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản cấu hình hợp lệ. Vui lòng tải lại.');
 return request(`/api/system-settings/${kind}`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify(settings)});
}

function apiShifts(page=1,search=''){return request('/api/shifts?'+new URLSearchParams({page,pageSize:30,search}));}
function apiShiftDetail(id){return request(`/api/shifts/${encodeURIComponent(id)}`);}
function apiSaveShift(id,payload,version=null){
 const headers={};
 if(id!==null){
 if(version===null||version===undefined||!String(version)||!/^[A-Za-z0-9_-]+$/.test(String(version)))throw Error('Thiếu phiên bản ca làm việc. Vui lòng tải lại.');
 headers['If-Match']=`"${version}"`;
 }
 return request('/api/shifts'+(id===null?'':`/${encodeURIComponent(id)}`),{method:id===null?'POST':'PUT',headers,body:JSON.stringify(payload)});
}

function apiAuditLogs(query=''){return request('/api/audit-logs'+(query?`?${query}`:''),{cache:'no-store'});}
function apiAuditLogDetail(id){return request(`/api/audit-logs/${encodeURIComponent(id)}`,{cache:'no-store'});}

// Keep connected browser tabs aligned when a login/logout replaces the stored JWT.
globalThis.window?.addEventListener?.('storage',event=>{
 if(event.key===SESSION_KEY||event.key===null){session=readSession();globalThis.window.dispatchEvent(new Event('auth-change'));}
});

function apiOrganizationTree(signal){return request('/api/organization/tree',{signal,cache:'no-store'});}
function apiOrganizationMembers(kind,id,page=1,signal){
 if(!['team','unassigned'].includes(kind))throw Error('Nhóm nhân viên không hợp lệ.');
 const path=kind==='team'?`/api/teams/${encodeURIComponent(id)}/members`:`/api/departments/${encodeURIComponent(id)}/unassigned-members`;
 return request(path+'?'+new URLSearchParams({page,pageSize:20}),{signal,cache:'no-store'});
}

function apiUpdateEmployee(employeeId,payload){return request(`/api/employees/${encodeURIComponent(employeeId)}`,{method:"PUT",body:JSON.stringify(payload)});}

function apiTransferEmployeeDepartment(employeeId,payload){return request(`/api/employees/${encodeURIComponent(employeeId)}/department`,{method:'PATCH',body:JSON.stringify(payload)});}

function apiContractTypes(query=''){return request('/api/contract-types'+(query?`?${query}`:''));}
function apiContractType(code){return request(`/api/contract-types/${encodeURIComponent(code)}`);}
function apiSaveContractType(code,payload){return request('/api/contract-types'+(code===null?'':`/${encodeURIComponent(code)}`),{method:code===null?'POST':'PUT',body:JSON.stringify(payload)});}
function apiDeleteContractType(code){return request(`/api/contract-types/${encodeURIComponent(code)}`,{method:'DELETE'});}

function apiCreateScreen(payload){return request('/api/screens',{method:'POST',body:JSON.stringify(payload)});}

function apiEmployeeContracts(employeeId,query='',signal){return request(`/api/employees/${encodeURIComponent(employeeId)}/contracts`+(query?`?${query}`:''),{signal});}
function apiEmployeeContract(employeeId,contractId){return request(`/api/employees/${encodeURIComponent(employeeId)}/contracts/${encodeURIComponent(contractId)}`);}
function apiSaveEmployeeContract(employeeId,contractId,payload){return request(`/api/employees/${encodeURIComponent(employeeId)}/contracts`+(contractId===null?'':`/${encodeURIComponent(contractId)}`),{method:contractId===null?'POST':'PUT',body:JSON.stringify(payload)});}
async function apiActiveContractTypes(){
 const items=[];let page=1;
 while(true){const result=await apiContractTypes(new URLSearchParams({page,pageSize:100,isActive:true}).toString());
 if(!Array.isArray(result?.data))throw Error('Danh sách loại hợp đồng không hợp lệ.');
 items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;
 }
 return items.filter(item=>item.isActive);
}

function apiContractStatistics(expiringWithinDays=30){return request('/api/contracts/statistics?'+new URLSearchParams({expiringWithinDays}),{cache:'no-store'});}

function apiCreateContract(payload){return request('/api/contracts',{method:'POST',body:JSON.stringify(payload)});}

const workflowResources={leave:'leave-requests',overtime:'overtime-requests',adjustment:'attendance-adjustments',all:'approvals'};
function workflowPath(kind,id=null){if(!workflowResources[kind])throw Error('Loại yêu cầu không hợp lệ.');return '/api/'+workflowResources[kind]+(id===null?'':`/${encodeURIComponent(id)}`);}
function apiWorkflowList(kind,query=''){return request(workflowPath(kind)+(query?`?${query}`:''),{cache:'no-store'});}
function apiWorkflowDetail(kind,id){if(kind==='adjustment')throw Error('API điều chỉnh công không có endpoint chi tiết.');return request(workflowPath(kind,id),{cache:'no-store'});}
function apiCreateWorkflow(kind,payload){if(kind==='all')throw Error('Chọn loại yêu cầu để tạo.');return request(workflowPath(kind),{method:'POST',body:JSON.stringify(payload)});}
function apiWorkflowAction(kind,id,action,payload){if(kind==='all'?!['approve','reject'].includes(action):action!=='cancel')throw Error('Thao tác yêu cầu không hợp lệ.');return request(workflowPath(kind,id)+'/'+action,{method:'POST',body:JSON.stringify(payload)});}
function apiWorkflowLeaveTypes(query=''){return request('/api/leave-types'+(query?`?${query}`:''),{cache:'no-store'});}

function apiSaveLeaveType(id,payload){return request('/api/leave-types'+(id===null?'':`/${encodeURIComponent(id)}`),{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});}

function apiApprovalWorkflowSettings(payload=null){
 if(payload!==null&&(!Number.isSafeInteger(payload.version)||payload.version<0))throw Error('Thiếu phiên bản cấu hình quy trình hợp lệ.');
 return request('/api/approval-workflow-settings',payload===null?{cache:'no-store'}:{method:'PUT',body:JSON.stringify(payload)});
}

function apiMyLeaveBalances({year=null,leaveTypeId=null}={}){
 const query=new URLSearchParams();
 if(year!==null){if(!Number.isInteger(year)||year<1900||year>9999)throw Error('Năm phải từ 1900 đến 9999.');query.set('year',year);}
 if(leaveTypeId!==null){if(!Number.isSafeInteger(leaveTypeId)||leaveTypeId<=0)throw Error('Loại nghỉ phép không hợp lệ.');query.set('leaveTypeId',leaveTypeId);}
 return request('/api/leave-balances/me'+(query.size?'?'+query:''),{cache:'no-store'});
}

function apiLeaveAccrualSettings(payload=null){
 if(payload!==null&&(!Number.isSafeInteger(payload.version)||payload.version<0))throw Error('Phiên bản cấu hình không hợp lệ.');
 return request('/api/system-settings/leave-accrual',payload===null?{cache:'no-store'}:{method:'PUT',body:JSON.stringify(payload)});
}
function apiRunLeaveAccrual(){return request('/api/system-settings/leave-accrual/run',{method:'POST'});}

function apiLeaveBalances(filters={},signal){
 const query=new URLSearchParams();
 for(const key of ['page','pageSize','view','year','employeeId','departmentId','leaveTypeId','search'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);
 return request('/api/leave-balances?'+query,{cache:'no-store',signal});
}
function apiGrantLeaveBalances(payload){return request('/api/leave-balances/grants',{method:'POST',body:JSON.stringify(payload)});}
function apiSaveLeaveBalance(payload){return request('/api/leave-balances',{method:'PUT',body:JSON.stringify(payload)});}
function apiAdjustLeaveBalance(id,payload){return request(`/api/leave-balances/${encodeURIComponent(id)}/adjustments`,{method:'POST',body:JSON.stringify(payload)});}
function apiLeaveBalanceHistory(id,page=1){return request(`/api/leave-balances/${encodeURIComponent(id)}/history?`+new URLSearchParams({page,pageSize:20}),{cache:'no-store'});}

function workScheduleQuery(filters){const query=new URLSearchParams();for(const key of ['from','to','page','pageSize','departmentId','teamId','employeeId','search'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return query.toString();}
function apiWorkScheduleCalendar(filters,signal){return request('/api/work-schedules/calendar?'+workScheduleQuery(filters),{cache:'no-store',signal});}
function apiWorkScheduleDetail(id){return request(`/api/work-schedules/${encodeURIComponent(id)}`,{cache:'no-store'});}
function workScheduleVersion(version){if(!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản lịch hợp lệ. Vui lòng tải lại.');return {'If-Match':`"${version}"`};}
function apiSaveWorkSchedule(id,payload,version=null){return request('/api/work-schedules'+(id===null?'':`/${encodeURIComponent(id)}`),{method:id===null?'POST':'PUT',headers:id===null?{}:workScheduleVersion(version),body:JSON.stringify(payload)});}
function apiCancelWorkSchedule(id,version){return request(`/api/work-schedules/${encodeURIComponent(id)}/cancel`,{method:'PATCH',headers:workScheduleVersion(version)});}
function apiPreviewWorkSchedules(payload){return request('/api/work-schedules/bulk/preview',{method:'POST',body:JSON.stringify(payload)});}
function apiAssignWorkSchedules(payload){if(!payload.previewToken)throw Error('Cần xem trước phân ca trước khi xác nhận.');return request('/api/work-schedules/'+(payload.copyFrom?'copy':'bulk'),{method:'POST',body:JSON.stringify(payload)});}
function apiExportWorkSchedules(filters){return request('/api/work-schedules/export?'+workScheduleQuery(filters),{cache:'no-store',responseType:'blob'});}

function attendanceManagementQuery(filters={},own=false){const query=new URLSearchParams();for(const key of ['date','from','to','page','pageSize','departmentId','teamId','employeeId','search','status'])if((!own||!['employeeId','departmentId','teamId','search'].includes(key))&&filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return query.toString();}
function apiAttendanceDaily(filters={},signal){return request('/api/attendances/daily?'+attendanceManagementQuery(filters),{cache:'no-store',signal});}
function apiMyAttendance(filters={},signal){return request('/api/attendances/me?'+attendanceManagementQuery(filters,true),{cache:'no-store',signal});}
function apiAttendanceStatistics(filters={}){return request('/api/attendances/statistics?'+attendanceManagementQuery(filters),{cache:'no-store'});}
function apiAttendanceFilters(){return request('/api/attendances/filters',{cache:'no-store'});}
function apiAttendanceDetail(row){const query=new URLSearchParams({employeeId:row.employeeId,date:row.workDate});if(row.scheduleId)query.set('scheduleId',row.scheduleId);return request('/api/attendances/daily/detail?'+query,{cache:'no-store'});}
function apiAttendancePunch(action,payload){if(!['check-in','check-out'].includes(action))throw Error('Thao tác chấm công không hợp lệ.');return request('/api/attendances/'+action,{method:'POST',body:JSON.stringify(payload)});}
function apiAttendanceExport(filters={}){const {page,pageSize,...query}=filters;return request('/api/attendances/export?'+attendanceManagementQuery(query),{cache:'no-store',responseType:'blob'});}

function kpiEvaluationQuery(filters={}){const query=new URLSearchParams();for(const key of ['periodId','departmentId','teamId','employeeId','status','search','page','pageSize'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return query.toString();}
function apiKpiEvaluations(filters={}){return request('/api/kpi/evaluations?'+kpiEvaluationQuery(filters),{cache:'no-store'});}
function apiKpiStatistics(filters={}){const {page,pageSize,...query}=filters;return request('/api/kpi/evaluations/statistics?'+kpiEvaluationQuery(query),{cache:'no-store'});}
function apiKpiLookups(){return request('/api/kpi/evaluations/lookups',{cache:'no-store'});}
function apiKpiPeriods(page=1){return request('/api/kpi/evaluations/periods?'+new URLSearchParams({page,pageSize:100}),{cache:'no-store'});}
function apiKpiEmployees(search='',page=1){return request('/api/kpi/evaluations/employees?'+new URLSearchParams({page,pageSize:20,search}),{cache:'no-store'});}
function apiKpiEvaluationDetail(id){return request(`/api/kpi/evaluations/${encodeURIComponent(id)}`,{cache:'no-store'});}
function apiKpiEvaluationAction(id,action,payload){if(!['start','results','submit','review'].includes(action))throw Error('Thao tác KPI không hợp lệ.');if(!Number.isSafeInteger(payload?.version)||payload.version<1)throw Error('Thiếu phiên bản KPI. Vui lòng tải lại.');return request(`/api/kpi/evaluations/${encodeURIComponent(id)}/${action}`,{method:action==='results'?'PUT':'POST',body:JSON.stringify(payload)});}
function apiKpiExport(filters={}){const {page,pageSize,...query}=filters;return request('/api/kpi/evaluations/export?'+kpiEvaluationQuery(query),{cache:'no-store',responseType:'blob'});}

function apiTerminalLoggingSettings(settings=null,etag=null){
 if(settings===null)return request('/api/system-settings/terminal-logging',{cache:'no-store',responseType:'etag'});
 if(typeof etag!=='string'||!/^"(?:0|[1-9]\d*)"$/.test(etag))throw Error('Thiếu phiên bản cấu hình log. Vui lòng tải lại.');
 return request('/api/system-settings/terminal-logging',{method:'PUT',headers:{'If-Match':etag},body:JSON.stringify(settings),responseType:'etag'});
}
function apiTerminalLoggingModules(){return request('/api/system-settings/terminal-logging/modules',{cache:'no-store'});}

function apiKpiConfigurationList(kind,filters={}){if(!['templates','metrics','periods','employees','units'].includes(kind))throw Error('Danh mục KPI không hợp lệ.');const query=new URLSearchParams();for(const key of ['page','pageSize','search',...(kind==='units'?['isActive']:[])])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request('/api/kpi/configuration/'+kind+'?'+query,{cache:'no-store'});}
function apiKpiConfigurationLookups(){return request('/api/kpi/configuration/lookups',{cache:'no-store'});}
function apiKpiTemplateDetail(id){return request('/api/kpi/configuration/templates/'+encodeURIComponent(id),{cache:'no-store'});}
function apiKpiConfigurationSave(kind,payload,id=null){if(!['templates','metrics','periods','assignments','units'].includes(kind)||id!==null&&!['templates','metrics','units'].includes(kind))throw Error('Thao tác cấu hình KPI không hợp lệ.');if(id!==null&&(!Number.isSafeInteger(payload?.version)||payload.version<1))throw Error('Thiếu phiên bản KPI. Vui lòng tải lại.');return request('/api/kpi/configuration/'+kind+(id===null?'':'/'+encodeURIComponent(id)),{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});}
function apiKpiConfigurationAction(kind,id,version){if(!['templates','periods'].includes(kind)||!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản KPI. Vui lòng tải lại.');return request('/api/kpi/configuration/'+kind+'/'+encodeURIComponent(id)+'/'+(kind==='templates'?'publish':'close'),{method:'POST',body:JSON.stringify({version})});}

function apiKpiUnitDetail(id){return request('/api/kpi/configuration/units/'+encodeURIComponent(id),{cache:'no-store'});}

function compensationBase(area){if(!['payroll','salary-configuration'].includes(area))throw Error('Phân hệ lương không hợp lệ.');return '/api/'+area;}
function apiCompensationList(area,resource,filters={}){const allowed=area==='payroll'?['employees','policies','timesheets','periods','payslips']:['employees','components','policies','profiles'];if(!allowed.includes(resource))throw Error('Danh mục lương không hợp lệ.');const query=new URLSearchParams();for(const key of ['page','pageSize','search','periodKey','status','employeeId','departmentId','teamId'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request(compensationBase(area)+'/'+resource+'?'+query,{cache:'no-store'});}
function apiCompensationLookups(area){return request(compensationBase(area)+'/lookups',{cache:'no-store'});}
function apiPayrollStatistics(filters={}){const {page,pageSize,...values}=filters;const query=new URLSearchParams();for(const key of ['search','periodKey','status','employeeId','departmentId','teamId'])if(values[key]!==undefined&&values[key]!==null&&values[key]!=='')query.set(key,values[key]);return request('/api/payroll/statistics?'+query,{cache:'no-store'});}
function apiPayrollDetail(resource,id){if(!['timesheets','payslips'].includes(resource))throw Error('Chi tiết lương không hợp lệ.');return request('/api/payroll/'+resource+'/'+encodeURIComponent(id),{cache:'no-store'});}
function apiCompensationSave(area,resource,payload,id=null){const allowed=area==='payroll'?['periods','timesheets']:['profiles','components','policies'];if(!allowed.includes(resource)||id!==null&&(area!=='salary-configuration'||!['components','policies'].includes(resource)))throw Error('Thao tác lương không hợp lệ.');if(id!==null&&(!Number.isSafeInteger(payload?.version)||payload.version<1))throw Error('Thiếu phiên bản. Vui lòng tải lại.');return request(compensationBase(area)+'/'+resource+(id===null?'':'/'+encodeURIComponent(id)),{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});}
function apiPayrollAction(resource,id,action,payload){const allowed=resource==='timesheets'?['calculate','lock']:resource==='periods'?['calculate','submit','lock','paid']:[];if(!allowed.includes(action)||!Number.isSafeInteger(payload?.version)||payload.version<1)throw Error('Thao tác hoặc phiên bản kỳ không hợp lệ.');if(action==='calculate'&&!/^[A-Za-z0-9_-]{8,100}$/.test(payload.requestKey||''))throw Error('Thiếu mã lần tính.');return request('/api/payroll/'+resource+'/'+encodeURIComponent(id)+'/'+action,{method:'POST',body:JSON.stringify(payload)});}
function apiPayrollAdjustments(periodId,payload=null){return request('/api/payroll/periods/'+encodeURIComponent(periodId)+'/adjustments',payload===null?{cache:'no-store'}:{method:'POST',body:JSON.stringify(payload)});}
function apiPayrollCancelAdjustment(periodId,adjustmentId,version){if(!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản điều chỉnh.');return request(`/api/payroll/periods/${encodeURIComponent(periodId)}/adjustments/${encodeURIComponent(adjustmentId)}/cancel`,{method:'POST',body:JSON.stringify({version})});}
function apiPayrollPublishPolicy(id,payload){if(!Number.isSafeInteger(payload?.version)||payload.version<1)throw Error('Thiếu phiên bản chính sách.');return request('/api/salary-configuration/policies/'+encodeURIComponent(id)+'/publish',{method:'POST',body:JSON.stringify(payload)});}
function apiPayrollExport(filters={}){const query=new URLSearchParams();for(const key of ['search','periodKey','status','employeeId','departmentId','teamId'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request('/api/payroll/export?'+query,{cache:'no-store',responseType:'blob'});}

function apiMyPayslips(filters={}){const query=new URLSearchParams();for(const key of ['periodKey','status','page','pageSize'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request('/api/payslips/me?'+query,{cache:'no-store'});}
function apiMyPayslipDetail(id){return request('/api/payslips/me/'+encodeURIComponent(id),{cache:'no-store'});}
function apiMyPayslipPdf(id){return request('/api/payslips/me/'+encodeURIComponent(id)+'/pdf',{cache:'no-store',responseType:'blob'});}


const {HubConnectionBuilder,LogLevel}=globalThis.signalR||{};

// Source: services/notification-service.js

function notificationError(error){return error?.status===401?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':error?.status===403?'Bạn không có quyền thực hiện thao tác này.':error?.status===404?'Thông báo không tồn tại hoặc không thuộc tài khoản này.':'Không tải được thông báo. Kiểm tra kết nối và thử lại.';}
function createNotificationConnection({url,accessTokenFactory,isActive}){
 return new HubConnectionBuilder().withUrl(url,{accessTokenFactory,logMessageContent:false})
 .withAutomaticReconnect({nextRetryDelayInMilliseconds:context=>isActive()?Math.min(30000,1000*2**Math.min(context.previousRetryCount,5)):null})
 .configureLogging(LogLevel.None).build();
}
class NotificationService{
 constructor({getSession=apiSession,baseUrl=apiBaseUrl,logout=apiLogout,rest={list:apiNotifications,count:apiNotificationUnreadCount,read:apiReadNotification,readAll:apiReadAllNotifications},createConnection=createNotificationConnection,timers={setTimeout:(...args)=>globalThis.setTimeout(...args),clearTimeout:id=>globalThis.clearTimeout(id),setInterval:(...args)=>globalThis.setInterval(...args),clearInterval:id=>globalThis.clearInterval(id)}}={}){
 this.getSession=getSession;this.baseUrl=baseUrl;this.logout=logout;this.rest=rest;this.createConnection=createConnection;this.timers=timers;
 this.listeners=new Set();this.generation=0;this.identity='';this.connection=null;this.lifecycle=Promise.resolve();this.retryTimer=null;this.pollTimer=null;this.refreshTask=null;this.refreshAgain=false;this.seenEvents=new Set();this.state=this.emptyState();
 }
 emptyState(){return {generation:this.generation,items:[],nextBeforeId:null,count:null,loading:false,loaded:false,error:'',realtime:'disconnected',revision:0};}
 snapshot(){return {...this.state,items:this.state.items.map(item=>({...item}))};}
 subscribe(listener){this.listeners.add(listener);listener(this.snapshot());return ()=>this.listeners.delete(listener);}
 emit(){const state=this.snapshot();for(const listener of [...this.listeners])listener(state);}
 key(){const session=this.getSession();return session?.accessToken?JSON.stringify([session.user?.userId,session.accessToken]):'';}
 current(generation){return generation===this.generation&&!!this.identity&&this.identity===this.key();}
 clearTimers(){if(this.retryTimer!==null)this.timers.clearTimeout(this.retryTimer);if(this.pollTimer!==null)this.timers.clearInterval(this.pollTimer);this.retryTimer=null;this.pollTimer=null;}
 syncAuth(){
 const identity=this.key();if(identity===this.identity)return this.lifecycle;
 this.identity=identity;const generation=++this.generation;this.clearTimers();this.seenEvents.clear();this.refreshAgain=false;this.refreshTask=null;
 const old=this.connection;this.connection=null;
 const stopped=old?Promise.resolve().then(()=>old.stop()).catch(()=>{}):Promise.resolve();
 this.state=this.emptyState();this.emit();
 // Stop a connection (including an in-progress start) immediately; serialize replacement starts.
 this.lifecycle=this.lifecycle.catch(()=>{}).then(async()=>{
 await stopped;if(!this.current(generation))return;
 this.pollTimer=this.timers.setInterval(()=>{void this.syncAuth();if(this.current(generation))void this.refresh();},30000);
 void this.refresh();
 const connection=this.createConnection({url:this.baseUrl().replace(/\/$/,'')+'/hubs/notifications',accessTokenFactory:()=>this.current(generation)?this.getSession().accessToken:'',isActive:()=>this.current(generation)});
 if(!this.current(generation)){await connection.stop().catch(()=>{});return;}
 this.connection=connection;
 connection.on('notification.available',event=>{
 if(!this.current(generation))return;
 if(typeof event?.eventId==='string'||typeof event?.eventId==='number'){
 const key=String(event.eventId);if(this.seenEvents.has(key))return;this.seenEvents.add(key);
 if(this.seenEvents.size>1000)this.seenEvents.delete(this.seenEvents.values().next().value);
 }
 void this.refresh();
 });
 connection.onreconnecting(()=>{if(this.current(generation)){this.state.realtime='reconnecting';this.emit();}});
 connection.onreconnected(()=>{if(this.current(generation)){this.state.realtime='connected';this.emit();void this.refresh();}});
 connection.onclose(()=>{if(this.current(generation)){this.state.realtime='offline';this.emit();this.scheduleRetry(connection,generation);}});

 await this.startConnection(connection,generation);
 }).catch(()=>{if(this.current(generation)){this.state.realtime='offline';this.emit();}});
 return this.lifecycle;
 }
 async startConnection(connection,generation){
 if(!this.current(generation)||connection!==this.connection)return;
 this.state.realtime='connecting';this.emit();
 try{await connection.start();if(this.current(generation)){this.state.realtime='connected';this.emit();void this.refresh();}}
 catch(error){if(!this.current(generation))return;this.state.realtime='offline';this.emit();
 if(error?.statusCode===401){this.logout();void this.syncAuth();return;}
 this.scheduleRetry(connection,generation);
 }
 }
 scheduleRetry(connection,generation){
 if(this.retryTimer!==null||!this.current(generation))return;
 this.retryTimer=this.timers.setTimeout(()=>{this.retryTimer=null;void this.startConnection(connection,generation);},10000);
 }
 async page(beforeId=null,limit=30){
 const generation=this.generation;if(!this.current(generation))throw Object.assign(Error('Session changed'),{status:401});
 const result=await this.rest.list(limit,beforeId);
 if(!this.current(generation))throw Error('Session changed');
 if(!Array.isArray(result?.items))throw Error('Invalid notifications response');
 return result;
 }
 refresh(){
 const generation=this.generation;if(!this.current(generation))return Promise.resolve();
 if(this.refreshTask?.generation===generation){this.refreshAgain=true;return this.refreshTask.promise;}
 this.state.loading=true;this.state.error='';this.emit();
 const task={generation,promise:null};this.refreshTask=task;
 task.promise=(async()=>{
 const [inbox,count]=await Promise.allSettled([this.rest.list(30,null),Promise.resolve().then(()=>this.rest.count()).then(result=>{if(this.current(generation)&&Number.isSafeInteger(result?.count)&&result.count>=0){this.state.count=result.count;this.emit();}return result;})]);
 if(!this.current(generation))return;
 let error=null;
 if(inbox.status==='fulfilled'&&Array.isArray(inbox.value?.items)){
 this.state.items=inbox.value.items;this.state.nextBeforeId=inbox.value.nextBeforeId??null;this.state.loaded=true;this.state.revision++;
 }else error=inbox.status==='rejected'?inbox.reason:Error('Invalid inbox');
 if(count.status==='fulfilled'&&Number.isSafeInteger(count.value?.count)&&count.value.count>=0)this.state.count=count.value.count;
 else error=count.status==='rejected'?count.reason:Error('Invalid count');
 if(error?.status===401){this.logout();void this.syncAuth();return;}
 this.state.error=error?notificationError(error):'';this.state.loading=false;this.emit();
 })().catch(error=>{if(this.current(generation)){this.state.loading=false;this.state.error=notificationError(error);this.emit();}}).finally(()=>{
 if(this.refreshTask!==task)return;this.refreshTask=null;
 if(this.refreshAgain&&this.current(generation)){this.refreshAgain=false;void this.refresh();}
 });return task.promise;
 }
 async read(id){
 const generation=this.generation;if(!this.current(generation))throw Object.assign(Error(),{status:401});
 await this.rest.read(id);if(this.current(generation))await this.refresh();
 }
 async readAll(){
 const generation=this.generation;if(!this.current(generation))throw Object.assign(Error(),{status:401});
 await this.rest.readAll();if(this.current(generation))await this.refresh();
 }
 async stop(){this.identity='';++this.generation;this.clearTimers();this.seenEvents.clear();this.refreshTask=null;this.refreshAgain=false;const connection=this.connection;this.connection=null;this.state=this.emptyState();this.emit();if(connection)await connection.stop().catch(()=>{});await this.lifecycle.catch(()=>{});}
}
const notificationService=new NotificationService();


// Source: services/approval-count-service.js

class ApprovalCountService{
 constructor({getSession=apiSession,fetchCount=()=>apiWorkflowList('all','status=PENDING&page=1&pageSize=1'),timers={setInterval:(...args)=>globalThis.setInterval(...args),clearInterval:id=>globalThis.clearInterval(id)}}={}){this.getSession=getSession;this.fetchCount=fetchCount;this.timers=timers;this.listeners=new Set();this.identity='';this.generation=0;this.timer=null;this.task=null;this.count=null;}
 key(){const session=this.getSession();return session?.accessToken&&session.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y')?JSON.stringify([session.user?.userId,session.accessToken]):'';}
 snapshot(){return {count:this.count};}
 subscribe(listener){this.listeners.add(listener);listener(this.snapshot());return ()=>this.listeners.delete(listener);}
 emit(){for(const listener of this.listeners)listener(this.snapshot());}
 syncAuth(){const identity=this.key();if(identity===this.identity)return this.task?.promise||Promise.resolve();this.stop();this.identity=identity;if(!identity)return Promise.resolve();this.timer=this.timers.setInterval(()=>{void this.syncAuth();void this.refresh();},30000);return this.refresh();}
 refresh(){
 const generation=this.generation;if(!this.identity||this.identity!==this.key())return Promise.resolve();if(this.task?.generation===generation)return this.task.promise;
 const task={generation,promise:null};this.task=task;
 task.promise=(async()=>{try{const response=await this.fetchCount();if(generation!==this.generation||this.identity!==this.key())return;if(!Number.isSafeInteger(response?.total)||response.total<0)throw Error('Số yêu cầu chờ duyệt không hợp lệ.');this.count=response.total;this.emit();}catch{if(generation===this.generation&&this.identity===this.key()){this.count=null;this.emit();}}finally{if(this.task===task)this.task=null;}})();return task.promise;
 }
 stop(){++this.generation;if(this.timer!==null)this.timers.clearInterval(this.timer);this.timer=null;this.identity='';this.task=null;this.count=null;this.emit();}
}
const approvalCountService=new ApprovalCountService();


// Source: utils.js
const escapeHtml=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const e=escapeHtml;
const initials=n=>n.split(' ').slice(-2).map(x=>x[0]).join('');
const dateLabel=d=>d?d.slice(0,10).split('-').reverse().join('/'):'—';
const timeLabel=d=>d?d.slice(11,16):'—';
const pct=(a,b)=>b?Math.round(a/b*100):0;
const id=p=>`${p}-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)}`;
const labels={todo:'Chưa bắt đầu',in_progress:'Đang thực hiện',review:'Chờ review',done:'Hoàn thành',high:'Cao',medium:'Trung bình',low:'Thấp',on_track:'Đúng kế hoạch',at_risk:'Có nguy cơ',pending_leader:'Chờ Leader',pending_manager:'Chờ Manager',pending_hr:'Chờ HR',pending_admin:'Chờ Admin',approved:'Đã duyệt',rejected:'Từ chối',cancelled:'Đã hủy',leave:'Nghỉ phép',overtime:'Tăng ca',adjustment:'Điều chỉnh công',general:'Yêu cầu khác',active:'Đang làm việc',locked:'Đã khóa',ontime:'Đúng giờ',late:'Đi trễ',absent:'Chưa check-in'};
function workDays(start,end){let total=0;for(let d=new Date(start+'T12:00:00+07:00');d<=new Date(end+'T12:00:00+07:00');d.setDate(d.getDate()+1))if(![0,6].includes(d.getDay()))total++;return total;}
function workMinutes(a,shift={shiftStart:'08:30',shiftEnd:'17:30'}){if(!a?.checkIn||!a?.checkOut)return 0;const minutes=t=>parseInt(t.slice(0,2))*60+parseInt(t.slice(3,5));const start=Math.max(minutes(shift.shiftStart),minutes(a.checkIn.slice(11,16))),end=Math.min(minutes(shift.shiftEnd),minutes(a.checkOut.slice(11,16)));return Math.max(0,end-start-Math.max(0,Math.min(end,780)-Math.max(start,720)));}
function hours(a,shift){if(!a?.checkIn||!a?.checkOut)return '—';return (workMinutes(a,shift)/60).toFixed(1)+'h';}
function csvDownload(name,headers,rows){const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const blob=new Blob(['\uFEFF'+[headers,...rows].map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}


// Source: data/seed.js
const DEMO_DATE='2026-10-19';
const NOW='2026-10-19T10:00:00+07:00';
function createSeed(){
 const names=['Trần Đức Anh','Nguyễn Hoàng Nam','Lê Thảo Nguyên','Phạm Minh Tuấn','Võ Ngọc Linh','Đặng Quang Huy','Bùi Hải Đăng','Nguyễn Khánh Vy','Trần Gia Bảo','Lê Minh Khang','Phạm Ngọc Anh','Đỗ Thanh Tùng','Nguyễn Phương Anh','Trần Tuấn Kiệt','Lê Hoàng Phúc','Võ Thu Hà','Phạm Quốc Bảo','Bùi Thảo My','Ngô Đức Minh','Đặng Ngọc Mai','Trương Minh Trí','Lý Hoàng Yến','Đỗ Anh Khoa','Huỳnh Nhật Linh'];
 const teams=[{id:'backend',name:'Backend',leaderId:'usr-01',managerId:'usr-manager',departmentId:'engineering'},{id:'frontend',name:'Frontend',leaderId:'usr-13',managerId:'usr-manager',departmentId:'engineering'},{id:'qa',name:'Quality Assurance',leaderId:null,managerId:'usr-admin',departmentId:'engineering'}];
 const users=names.map((name,i)=>({id:`usr-${String(i+1).padStart(2,'0')}`,employeeCode:`ITX${String(i+1).padStart(3,'0')}`,name,email:`member${i+1}@intelex.demo`,role:i===0||i===12?'Leader':'Dev',teamId:i<12?'backend':'frontend',departmentId:'engineering',status:'active',position:i===0||i===12?'Technical Lead':i<12?'Backend Developer':'Frontend Developer',joinedAt:'2025-04-15',managedTeamIds:[]}));
 users.push({id:'usr-manager',employeeCode:'ITX025',name:'Nguyễn Quang Minh',email:'minh@intelex.demo',role:'Manager',teamId:null,managedTeamIds:['backend','frontend'],departmentId:'engineering',status:'active',position:'Engineering Manager',joinedAt:'2024-03-01'}, {id:'usr-hr',employeeCode:'ITX026',name:'Trần Thanh Hương',email:'huong@intelex.demo',role:'HR',teamId:null,managedTeamIds:[],departmentId:'people',status:'active',position:'People Operations',joinedAt:'2024-06-01'}, {id:'usr-admin',employeeCode:'ITX027',name:'Lê Hoàng Duy',email:'duy@intelex.demo',role:'Admin',teamId:null,managedTeamIds:[],departmentId:'engineering',status:'active',position:'System Administrator',joinedAt:'2024-01-01'});
 ['Phan Thanh Sơn','Vũ Mai Chi','Lê Quốc Việt'].forEach((name,i)=>users.push({id:`usr-qa-${i}`,employeeCode:`ITX0${28+i}`,name,email:`qa${i}@intelex.demo`,role:'Dev',teamId:'qa',departmentId:'engineering',status:'active',managedTeamIds:[],position:'QA Engineer',joinedAt:'2025-08-01'}));
 const projects=['ERP Core','Customer Portal','Mobile App','Internal Tools','QA Automation'].map((name,i)=>({id:`prj-${i+1}`,code:['ERP','PORTAL','APP','TOOLS','QA'][i],name,description:['Nền tảng quản lý nhân sự và vận hành nội bộ Intelex.','Cổng kết nối khách hàng và dịch vụ số.','Trải nghiệm di động cho nhân viên và khách hàng.','Bộ công cụ giúp đội ngũ làm việc hiệu quả hơn.','Tự động hóa kiểm thử sản phẩm.'][i],managerId:i===4?'usr-admin':'usr-manager',teamIds:i===4?['qa']:i===0?['backend']:i===1?['frontend']:['backend','frontend'],memberIds:users.filter(u=>i===4?u.teamId==='qa':i===0?u.teamId==='backend':i===1?u.teamId==='frontend':['backend','frontend'].includes(u.teamId)).map(u=>u.id),status:'in_progress',health:i===2?'at_risk':i===3?'review':'on_track',startDate:'2026-10-01',dueDate:['2026-11-15','2026-11-01','2026-11-30','2026-10-30','2026-12-01'][i],color:['blue','purple','orange','teal','pink'][i]}));
 const taskTitles=['Thiết kế kiến trúc hệ thống','Xây dựng API người dùng','Hoàn thiện giao diện dashboard','Thiết lập môi trường phát triển','Tối ưu truy vấn dữ liệu','Kiểm thử luồng đăng nhập','Cập nhật tài liệu kỹ thuật','Xây dựng bộ component UI','Review và refactor mã nguồn','Hoàn thiện giao diện chấm công','Tích hợp bộ lọc báo cáo','Kiểm thử và nghiệm thu'];
 const tasks=projects.flatMap((p,pi)=>Array.from({length:12},(_,j)=>({id:`tsk-${pi*12+j+1}`,code:`${p.code}-${String(j+1).padStart(3,'0')}`,title:taskTitles[j],projectId:p.id,assigneeId:p.memberIds[j%p.memberIds.length],status:j<[9,9,6,12,4][pi]?'done':j%3===0?'in_progress':j%3===1?'review':'todo',priority:j%3===0?'high':j%3===1?'medium':'low',startDate:'2026-10-01',dueDate:`2026-10-${j===9?'18':j===10?'20':j===11?'22':String(20+j).padStart(2,'0')}`,description:'Hoàn thiện chức năng theo thiết kế, kiểm tra các trường hợp biên và cập nhật tài liệu trước khi gửi review.'})));
 const openTasks=tasks.filter(t=>t.projectId!=='prj-5'&&t.status!=='done');
 openTasks.forEach((t,i)=>t.status=i<6?'in_progress':i<9?'review':'todo');
 const attendance=[];
 for(let d=1;d<=19;d++){const date=`2026-10-${String(d).padStart(2,'0')}`;if([0,6].includes(new Date(date+'T12:00:00+07:00').getDay()))continue; users.forEach((u,i)=>{const leave=d===19&&[21,22].includes(i),absent=d===19&&i===23,late=d===19?[19,20].includes(i):i%11===0;attendance.push({id:`att-${u.id}-${date}`,userId:u.id,date,shiftId:'standard',checkIn:leave||absent?null:`${date}T${late?'08:45':'08:15'}:00+07:00`,checkOut:leave||absent||d===19?null:`${date}T17:30:00+07:00`,leaveRequestId:leave?`req-leave-${i}`:null});});}
 const requests=Array.from({length:12},(_,i)=>({id:`req-${i+1}`,type:['leave','overtime','adjustment','general'][i%4],requesterId:users[i+1].id,startDate:`2026-10-${String(20+i).padStart(2,'0')}`,endDate:`2026-10-${String(20+i).padStart(2,'0')}`,reason:['Nghỉ phép giải quyết việc gia đình','Hoàn thành milestone dự án','Bổ sung chấm công ngày làm việc','Đề nghị cấp thiết bị làm việc'][i%4],status:['pending_leader','pending_manager','pending_hr','approved','rejected'][i%5],currentApproverId:['usr-01','usr-manager','usr-hr',null,null][i%5],history:[{label:'Đã gửi yêu cầu',actorId:users[i+1].id,at:NOW}]}));
 const notifications=users.flatMap((u)=>Array.from({length:4},(_,i)=>({id:`ntf-${u.id}-${i}`,recipientId:u.id,type:['task','leave','system','attendance'][i],title:['Sprint mới đã sẵn sàng','Yêu cầu nghỉ phép cần xử lý','Chào tuần mới, Intelex!','Đừng quên kiểm tra chấm công'][i],body:['Cùng đội ngũ hoàn thành những mục tiêu tuần này.','Xem trạng thái và chi tiết yêu cầu trong trung tâm phê duyệt.','Cập nhật chính sách làm việc và tài liệu nội bộ mới nhất.','Kiểm tra lịch sử và gửi điều chỉnh nếu có sai lệch.'][i],targetRoute:['/workspace/tasks','/approvals','/documents','/workspace/attendance'][i],readAt:i>1?NOW:null,createdAt:`2026-10-19T0${9-i}:00:00+07:00`})));
 const activities=Array.from({length:15},(_,i)=>({id:`act-${i}`,actorId:users[i].id,action:['đã hoàn thành task','đã cập nhật tiến độ','đã gửi yêu cầu nghỉ phép','đã thêm tài liệu dự án'][i%4],entityType:'project',entityId:projects[i%4].id,teamId:users[i].teamId,projectId:projects[i%4].id,createdAt:`2026-10-19T0${9-Math.floor(i/4)}:${String(50-i*2).padStart(2,'0')}:00+07:00`}));
 const documents=Array.from({length:8},(_,i)=>({id:`doc-${i}`,name:['Sổ tay nhân viên Intelex','Chính sách nghỉ phép','Quy trình phát triển sản phẩm','Hướng dẫn bảo mật thông tin','ERP Core · Tài liệu thiết kế','Customer Portal · API Guidelines','Mobile App · UI Guidelines','Hợp đồng nhân sự mẫu'][i],category:['company','policies','shared','policies','project','project','project','hr'][i],ownerId:'usr-hr',projectId:i>=4&&i<=6?`prj-${i-3}`:null,visibility:i===7?'hr':i>=4&&i<=6?'project':'company',fileUrl:'assets/documents/intelex-handbook.md',updatedAt:'2026-10-16'}));
 return {version:1,currentUserId:'usr-manager',users,teams,projects,tasks,attendance,requests,notifications,activities,documents,leaveBalances:users.map(u=>({userId:u.id,year:2026,allowanceDays:12,usedDays:4})),contracts:users.slice(0,6).map((u,i)=>({id:`ctr-${i}`,employeeId:u.id,type:'Hợp đồng lao động',startDate:'2025-11-01',endDate:i<2?'2026-11-01':'2027-11-01',status:'active'})),departments:[{id:'engineering',name:'Engineering'},{id:'people',name:'People & Operations'}],positions:['Backend Developer','Frontend Developer','Technical Lead','Engineering Manager','People Operations'],leaveTypes:['Phép năm','Nghỉ không lương','Nghỉ ốm'],settings:{companyName:'Intelex',shiftStart:'08:30',shiftEnd:'17:30'},rolePermissions:{},auditLogs:[]};
}


// Source: data/document-content.js
// Generated by scripts/build-browser.js from assets/documents/.
const DOCUMENT_CONTENTS={
  "assets/documents/intelex-handbook.md": "# Intelex · Sổ tay đội ngũ (tài liệu mẫu)\n\nChào mừng bạn đến với Intelex!\n\n## Cách chúng ta làm việc\n\nTôn trọng đồng đội, chủ động trao đổi và chịu trách nhiệm với cam kết.\nMỗi task có người phụ trách, deadline và tiêu chí hoàn thành rõ ràng.\nCode cần được review trước khi chuyển sang trạng thái hoàn thành.\n\n## Thời gian làm việc mô phỏng\n\nThứ Hai đến thứ Sáu, 08:30–17:30. Nghỉ trưa 12:00–13:00.\nGửi yêu cầu nghỉ phép trong My Workspace và theo dõi tiến trình ở Approval Center.\n\nĐây là tài liệu giả lập để kiểm tra preview và tải file, không phải chính sách chính thức.\n"
};


// Source: permissions.js
function scopedTeams(s,u){return u.role==='Admin'||u.role==='HR'?s.teams.map(t=>t.id):u.role==='Manager'?u.managedTeamIds:u.role==='Leader'?[u.teamId]:[];}
function employees(s,u){if(['Admin','HR'].includes(u.role))return s.users;if(u.role==='Dev')return s.users.filter(x=>x.id===u.id);const teams=scopedTeams(s,u);return s.users.filter(x=>teams.includes(x.teamId));}
function projects(s,u){return s.projects.filter(p=>['Admin','HR'].includes(u.role)||u.role==='Manager'&&p.managerId===u.id||u.role==='Leader'&&p.teamIds.includes(u.teamId)||p.memberIds.includes(u.id));}
function tasks(s,u){const ps=new Set(projects(s,u).map(p=>p.id));const ids=new Set(employees(s,u).map(x=>x.id));return u.role==='HR'?[]:s.tasks.filter(t=>ps.has(t.projectId)&&(u.role==='Admin'||ids.has(t.assigneeId)));}
function documents(s,u){return s.documents.filter(d=>d.visibility==='company'||d.visibility==='hr'&&['HR','Admin'].includes(u.role)||d.visibility==='project'&&projects(s,u).some(p=>p.id===d.projectId)&&u.role!=='HR');}
function requests(s,u){const ids=new Set(employees(s,u).map(x=>x.id));return s.requests.filter(r=>['HR','Admin'].includes(u.role)||r.requesterId===u.id||u.role!=='Dev'&&ids.has(r.requesterId));}
function can(s,u,action,resource){if(apiSession()){
 const path=(globalThis.location?.hash?.slice(1).split('?')[0]||'/dashboard');
 const flag={'project.create':'canNew','task.create':'canNew','task.edit':'canUpdate','approve':'canApprove','hr':'canNew','admin':'canUpdate'}[action];
 return screenAllowed(path,flag||'canView');
}const override=s.rolePermissions?.[u.role]?.[action];if(override===false&&!(u.role==='Admin'&&action==='admin'))return false;
 const r=u.role;switch(action){case 'admin':return r==='Admin';case 'hr':return ['Admin','HR'].includes(r);case 'team':return r!=='Dev';case 'project.create':return ['Admin','Manager'].includes(r);case 'task.create':return ['Admin','Manager','Leader'].includes(r);case 'task.edit':return tasks(s,u).some(t=>t.id===resource?.id)&&(r!=='Dev'||resource.assigneeId===u.id);case 'approve':return resource?.requesterId!==u.id&&resource?.status?.startsWith('pending_')&&(resource.currentApproverId===u.id||r==='Admin');default:return false;}}
function routeAllowed(s,u,path){if(apiSession())return path==='/notifications'?true:path==='/admin/users/register'?screenAllowed('/admin/users','canNew'):screenAllowed(path);if(path.startsWith('/admin'))return can(s,u,'admin');if(path.startsWith('/hr'))return u.role!=='Dev'&&(['Admin','HR'].includes(u.role)||path==='/hr/employees'||/^\/hr\/employees\/[^/]+$/.test(path));if(path.startsWith('/team'))return u.role==='HR'?['/team/overview','/team/members'].includes(path):can(s,u,'team');if(u.role==='HR'&&['/projects/tasks','/projects/workload','/projects/reports','/projects/timeline'].includes(path))return false;return true;}

// Explicit aliases for screen codes supplied by the backend. Unknown codes deny access.
const screenRoutes={
 '/dashboard':['WEB_DASHBOARD'],
 '/workspace/tasks':['WEB_MY_TASKS'],
 '/workspace/projects':['WEB_MY_PROJECTS'],
 '/workspace/attendance':['WEB_MY_ATTENDANCE'],
 '/workspace/payslips':['WEB_MY_PAYSLIPS'],
 '/workspace/leave':['WEB_LEAVE_BALANCES','WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS'],
 '/workspace/leave-requests':['WEB_LEAVE_REQUESTS'],
 '/workspace/overtime':['WEB_OVERTIME_REQUESTS'],
 '/workspace/attendance-adjustments':['WEB_ATTENDANCE_ADJUSTMENTS'],
 '/projects':['WEB_PROJECTS'],
 '/approvals':['WEB_APPROVALS','WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS'],
 '/reports':['WEB_REPORTS'],
 '/documents':['WEB_DOCUMENTS'],
 '/notifications':['WEB_NOTIFICATIONS'],
 '/payroll/management':['WEB_PAYROLL'],
 '/payroll/timesheets':['WEB_PAYROLL'],
 '/payroll/configuration':['WEB_SALARY_CONFIGURATION'],
 '/performance/kpi-templates':['WEB_KPI_CONFIGURATION'],
 '/performance/kpi-results':['WEB_KPI_EVALUATION'],
 '/work/schedules':['WEB_WORK_SCHEDULES'],
 '/hr/employees':['WEB_EMPLOYEES'],
 '/hr/organization':['WEB_ORGANIZATION'],
 '/hr/contracts':['WEB_CONTRACTS'],
 '/hr/attendance':['WEB_ATTENDANCE'],
 '/hr/attendance-reports':['WEB_ATTENDANCE_REPORTS'],
 '/hr/leave':['WEB_LEAVE_MANAGEMENT'],
 '/hr/reports':['WEB_HR_REPORTS'],
 '/admin/users':['WEB_USERS'],
 '/admin/roles':['WEB_ROLES'],
 '/admin/permissions':['WEB_PERMISSIONS'],
 '/admin/audit-logs':['WEB_AUDIT_LOGS'],
 '/admin/settings':['WEB_SYSTEM_SETTINGS','WEB_APPROVAL_SETTINGS'],
 '/admin/master-data':['WEB_MASTER_DATA','WEB_DEPARTMENTS','WEB_POSITIONS','WEB_TEAMS','WEB_CONTRACT_TYPES','WEB_LEAVE_TYPES','WEB_SHIFTS']
};
// Permission editor placement follows menu ownership, independently of route access aliases.
const roleScreenRoutes={...screenRoutes,
 '/admin/roles':['WEB_ROLES','WEB_PERMISSIONS'],
 '/workspace/attendance':['WEB_MY_ATTENDANCE'],
 '/workspace/leave':['WEB_LEAVE_BALANCES','WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS'],
 '/hr/leave':['WEB_LEAVE_MANAGEMENT'],
 '/hr/organization':['WEB_ORGANIZATION'],
 '/admin/master-data':['WEB_MASTER_DATA','WEB_DEPARTMENTS','WEB_POSITIONS','WEB_TEAMS','WEB_CONTRACT_TYPES','WEB_LEAVE_TYPES','WEB_SHIFTS']
};
function screenAllowed(path,flag='canView'){
 const current=apiSession();if(!current)return false;
 let route=path;
 const dynamic=/^\/screens\/(WEB_[A-Z0-9_]+)$/.exec(path);
 if(dynamic)return current.permissions.some(p=>p.platform==='WEB'&&p.code===dynamic[1]&&p.canView==='Y'&&p[flag]==='Y');
 if(/^\/hr\/employees\/.+/.test(path))route='/hr/employees';
 if(/^\/projects\/prj-/.test(path))route='/projects';
 const codes=screenRoutes[route]||(/^\/(team|projects)\//.test(route)?['WEB_'+route.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()]:[]);
 return current.permissions.some(p=>p.platform==='WEB'&&codes.includes(p.code)&&p.canView==='Y'&&p[flag]==='Y');
}


const scope=Object.freeze({scopedTeams,employees,projects,tasks,documents,requests,can,routeAllowed});

// Source: screen-navigation.js

const screenLabels={SALARY:'Thiết lập lương nhân viên',EMPLOYEE_SALARIES:'Thiết lập lương nhân viên',PAYROLLS:'Quản lý bảng lương',KPI_CRITERIA:'Thiết lập KPI',SALARY_PROFILES:'Thiết lập lương nhân viên',SALARY_PROFILE:'Thiết lập lương nhân viên',SALARY_SETTINGS:'Thiết lập lương nhân viên',SALARY_SETUP:'Thiết lập lương nhân viên',PAYROLL:'Quản lý bảng lương',PAYROLL_PERIODS:'Quản lý bảng lương',PAYROLL_MANAGEMENT:'Quản lý bảng lương',KPI_TEMPLATES:'Thiết lập KPI',KPI_SETTINGS:'Thiết lập KPI',KPI_SETUP:'Thiết lập KPI',KPI_TARGETS:'Mục tiêu KPI',KPI_RESULTS:'Đánh giá KPI',KPI_REVIEWS:'Đánh giá KPI',KPI_EVALUATIONS:'Đánh giá KPI',PERFORMANCE_REVIEWS:'Đánh giá hiệu suất'};
function screenNavigationLabel(screen){if(screen.code==='WEB_LEAVE_BALANCES')return 'Số dư phép';const short=String(screen.code||'').replace(/^(WEB|MOBILE)_/,'');return screen.name||screen.screenName||screenLabels[short]||short.replaceAll('_',' ');}
function screenNavigationGroup(code){
 const short=String(code||'').replace(/^(WEB|MOBILE)_/,'');
 if(/(^|_)(SALARY|SALARIES|PAYROLL|PAYROLLS|COMPENSATION|TIMESHEET|TIMESHEETS)(_|$)/.test(short))return {name:'Payroll & Compensation',icon:'briefcase',description:'Quản lý tiền lương'};
 if(/(^|_)(KPI|PERFORMANCE)(_|$)/.test(short))return {name:'Performance Management',icon:'chart',description:'Quản lý hiệu suất'};
 if(/^MY_/.test(short))return {name:'My Workspace',icon:'briefcase'};
 if(/^TEAM_/.test(short))return {name:'Team Management',icon:'users'};
 if(/^(PROJECT|TASK|MILESTONE)(_|$)/.test(short))return {name:'Project Management',icon:'folder'};
 if(/^APPROVAL/.test(short))return {name:'Approval Center',icon:'approval'};
 if(/^(EMPLOYEE|ATTENDANCE|WORK_SCHEDULE|LEAVE|CONTRACT|DEPARTMENT|POSITION|SHIFT)(_|S_|S$|$)/.test(short))return {name:'Human Resources',icon:'person'};
 if(/^REPORT/.test(short))return {name:'Reports & Analytics',icon:'chart'};
 return {name:'Administration',icon:'settings'};
}
function navigationForScreens(base,catalog,platform='WEB'){
 const groups=base.map(group=>({...group,children:group.children?.map(child=>[...child])}));
 const assigned=new Set(Object.values(screenRoutes).flat().map(code=>platform==='MOBILE'?code.replace(/^WEB_/,'MOBILE_'):code));
 for(const group of base)for(const [,path] of group.children||[[group.name,group.route]]){
  const codes=screenRoutes[path]||['WEB_'+path.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()];
  for(const code of codes)assigned.add(platform==='MOBILE'?code.replace(/^WEB_/,'MOBILE_'):code);
 }
 const seen=new Set();
 for(const screen of catalog){
  if(screen.platform&&screen.platform!==platform||!new RegExp('^'+platform+'_[A-Z0-9_]+$').test(screen.code||'')||['WEB_SALARY_PROFILES','WEB_TIMESHEETS','WEB_KPI_TEMPLATES','WEB_KPI_RESULTS','WEB_LEAVE','WEB_MY_LEAVE','WEB_MY_ATTENDANCE'].includes(screen.code)||assigned.has(screen.code)||seen.has(screen.code))continue;
  seen.add(screen.code);
  const metadata=screenNavigationGroup(screen.code),path='/screens/'+screen.code;
  let group=groups.find(group=>group.name===metadata.name);
  if(!group){group={...metadata,route:path,children:[]};const insertion=groups.findIndex(item=>item.name==='Approval Center');groups.splice(insertion<0?groups.length:insertion,0,group);}
  if(!group.children)group.children=[[group.name,group.route]];
  group.children.push([screenNavigationLabel(screen),path]);
 }
 return groups;
}


// Source: store.js
const KEY='intelex-erp-demo:v1';
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s?.version===1&&['tasks','users','teams','projects','attendance','requests','notifications','activities','documents','contracts','leaveBalances','departments','positions','leaveTypes','auditLogs'].every(k=>Array.isArray(s[k]))&&s.settings&&s.rolePermissions&&s.users.some(u=>u.id===s.currentUserId&&u.status==='active'))return s;}catch{}return createSeed();}
const state=load();
const user=()=>state.users.find(u=>u.id===state.currentUserId);
function demoNow(){const offset=Number(state.clockOffset)||0;state.clockOffset=offset+1;return new Date(Date.parse(NOW)+(420+offset)*60000).toISOString().slice(0,19)+'+07:00';}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch{console.warn('Không lưu được dữ liệu demo vào trình duyệt.');}}
function reset(){for(const key of Object.keys(state))delete state[key];Object.assign(state,createSeed());save();}
function switchUser(userId){if(state.users.some(u=>u.id===userId&&u.status==='active')){state.currentUserId=userId;save();}}
function log(action,projectId=null){const record={id:id('act'),actorId:user().id,action,entityId:projectId,entityType:'project',projectId,teamId:user().teamId,createdAt:NOW};state.activities.unshift(record);state.auditLogs.unshift({...record});save();}
function updateTask(taskId,status){const t=state.tasks.find(t=>t.id===taskId);if(!can(state,user(),'task.edit',t))throw Error('Bạn không có quyền cập nhật task này.');if(!['todo','in_progress','review','done'].includes(status))throw Error('Trạng thái không hợp lệ.');t.status=status;log('đã cập nhật '+t.code,t.projectId);}
function attendanceStatus(a){return a?.leaveRequestId?'leave':!a?.checkIn?'absent':a.checkIn.slice(11,16)>state.settings.shiftStart?'late':'ontime';}
function createRequest(data){const u=user();if(!['leave','overtime','adjustment','general'].includes(data.type))throw Error('Loại yêu cầu không hợp lệ.');if(!data.reason?.trim())throw Error('Vui lòng nhập lý do.');if(data.type==='overtime'&&(!(Number(data.hours)>0)||Number(data.hours)>12))throw Error('Số giờ tăng ca phải lớn hơn 0 và không quá 12.');if(data.endDate<data.startDate)throw Error('Ngày kết thúc phải từ ngày bắt đầu trở đi.');if(data.startDate<'2026-10-19')throw Error('Chọn ngày từ ngày demo 19/10/2026.');if(data.type==='leave'){const days=workDays(data.startDate,data.endDate);if(!days)throw Error('Khoảng ngày không có ngày làm việc.');const balance=state.leaveBalances.find(b=>b.userId===u.id);if(data.leaveType==='Phép năm'&&balance&&days>balance.allowanceDays-balance.usedDays)throw Error('Số ngày vượt quá số dư phép năm.');if(state.requests.some(r=>r.type==='leave'&&r.requesterId===u.id&&!['rejected','cancelled'].includes(r.status)&&r.startDate<=data.endDate&&r.endDate>=data.startDate))throw Error('Khoảng ngày trùng với một đơn đã gửi.');}
 const team=state.teams.find(t=>t.id===u.teamId);const role=u.role==='Dev'&&team?.leaderId?'leader':u.role==='Dev'||u.role==='Leader'?'manager':u.role==='Manager'?'hr':'admin';const approver=role==='leader'?team.leaderId:role==='manager'?(team?.managerId||'usr-manager'):role==='hr'?'usr-hr':'usr-admin';state.requests.unshift({...data,id:id('req'),requesterId:u.id,status:'pending_'+role,currentApproverId:approver,history:[{label:'Đã gửi yêu cầu',actorId:u.id,at:NOW}]});log('đã gửi yêu cầu '+data.type);}
function decideRequest(requestId,approve,reason=''){const r=state.requests.find(r=>r.id===requestId);const u=user();if(!can(state,u,'approve',r))throw Error('Bạn không có quyền duyệt ở bước này.');if(!approve&&!reason.trim())throw Error('Vui lòng nhập lý do từ chối.');if(u.role==='Admin'&&r.currentApproverId!==u.id&&!reason.trim())throw Error('Nhập lý do Admin xử lý thay thế.');let next=r.status==='pending_leader'?'pending_manager':r.status==='pending_manager'?'pending_hr':'approved';if(!approve)next='rejected';if(next==='approved'&&r.type==='leave'&&(r.leaveType||'Phép năm')==='Phép năm'){const b=state.leaveBalances.find(b=>b.userId===r.requesterId),days=workDays(r.startDate,r.endDate);if(b&&days>b.allowanceDays-b.usedDays)throw Error('Số dư phép không đủ khi duyệt.');if(b)b.usedDays+=days;}
 r.status=next;r.currentApproverId=next==='pending_manager'?(state.teams.find(t=>t.id===state.users.find(x=>x.id===r.requesterId)?.teamId)?.managerId||'usr-manager'):next==='pending_hr'?'usr-hr':null;r.history.push({label:(approve?'Đồng ý':'Từ chối')+(reason?' · '+reason:''),actorId:u.id,at:NOW});log('đã xử lý yêu cầu '+r.id);}
function cancelRequest(requestId){const r=state.requests.find(r=>r.id===requestId);if(r?.requesterId!==user().id||!r.status.startsWith('pending_'))throw Error('Chỉ hủy được đơn đang chờ của bạn.');r.status='cancelled';r.currentApproverId=null;r.history.push({label:'Đã hủy đơn',actorId:user().id,at:NOW});log('đã hủy yêu cầu');}


const s=state;

// Source: components/ui.js
const paths={grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',briefcase:'M8 6V4h8v2 M3 7h18v13H3z M3 12c6 3 12 3 18 0 M10 13h4',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3a4 4 0 0 1 0 8',folder:'M3 5h7l2 3h9v12H3z',person:'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2 M12 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8',check:'m5 12 4 4L19 6',approval:'M9 3H5v18h14V3h-4 M9 2h6v4H9z M8 13l3 3 5-6',chart:'M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-9',file:'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h6',bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',search:'m21 21-5-5 M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14',menu:'M4 6h16 M4 12h16 M4 18h16',chevron:'m9 5 7 7-7 7',down:'m6 9 6 6 6-6',arrow:'M4 12h16 M15 7l5 5-5 5',clock:'M12 8v5l3 2 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20',calendar:'M4 5h16v16H4z M8 2v6 M16 2v6 M4 10h16',plus:'M12 5v14 M5 12h14',download:'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',refresh:'M20 7a9 9 0 1 0 1 9 M20 2v6h-6',more:'M5 12h.01 M12 12h.01 M19 12h.01',close:'m6 6 12 12 M18 6 6 18',sun:'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1 M16 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0',help:'M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0',logout:'M9 3H3v18h6 M8 12h13 m-5-5 5 5-5 5',edit:'m15 4 5 5 M4 16 17 3l4 4L8 20H4z',shield:'m12 2 9 4v7c0 5-9 9-9 9S3 18 3 13V6z m-5 10 3 3 5-6',print:'M6 9V3h12v6 M6 18H3V9h18v9h-3 M6 14h12v7H6z',heart:'M20 4a5 5 0 0 0-8 2 5 5 0 0 0-8-2c-4 4 0 10 8 16 8-6 12-12 8-16'};
const icon=(name,size=18)=>`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.grid}"/></svg>`;
const tones=['blue','purple','teal','orange','pink'];
const avatar=(u,size='')=>`<span class="avatar ${tones[(u?.name?.charCodeAt(0)||0)%5]} ${size}" aria-label="${e(u?.name||'Chưa phân công')}">${e(initials(u?.name||'?'))}</span>`;
const person=u=>`<span class="person">${avatar(u)}<span><span class="person-name">${e(u?.name||'Chưa phân công')}</span><span class="person-sub" style="display:block">${e(u?.employeeCode||u?.position||'')}</span></span></span>`;
const badge=(status,label)=>`<span class="badge ${e(status)}">${e(label||labels[status]||status)}</span>`;
const button=(label,action,ico='',kind='',attrs='')=>`<button class="btn ${kind}" data-action="${action}" ${attrs}>${ico?icon(ico,14):''}${label}</button>`;
const link=(label,route)=>`<a class="card-link" href="#${route}">${label}${icon('arrow',13)}</a>`;
const empty=(title='Chưa có dữ liệu',body='Thử thay đổi bộ lọc hoặc tạo bản ghi mới.')=>`<div class="empty"><div class="icon-tile blue">${icon('folder',24)}</div><h3>${e(title)}</h3><p>${e(body)}</p></div>`;
const card=(title,subtitle,body,extra='',cls='')=>`<section class="card ${cls}"><div class="card-header"><div><h2>${title}</h2>${subtitle?`<p>${subtitle}</p>`:''}</div>${extra}</div>${body}</section>`;
const tabs=(items,selected)=>`<div class="tabs" role="tablist">${items.map(([key,label])=>`<button class="tab ${selected===key?'active':''}" role="tab" aria-selected="${selected===key}" data-tab="${key}">${label}</button>`).join('')}</div>`;
function table(headers,rows,{page=1,size=10}={}){const pages=Math.max(1,Math.ceil(rows.length/size));page=Math.min(page,pages);return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.slice((page-1)*size,page*size).map(cells=>`<tr>${cells.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${!rows.length?empty('Không tìm thấy kết quả','Thử bỏ bớt bộ lọc để xem dữ liệu.'):''}<div class="table-footer"><span>${rows.length?`${(page-1)*size+1}–${Math.min(page*size,rows.length)} trong ${rows.length} bản ghi`:'0 bản ghi'}</span><div class="pagination"><button aria-label="Trang trước" data-page="${page-1}" ${page===1?'disabled':''}>‹</button>${Array.from({length:Math.min(5,pages)},(_,i)=>`<button data-page="${i+1}" class="${i+1===page?'active':''}">${i+1}</button>`).join('')}<button aria-label="Trang sau" data-page="${page+1}" ${page>=pages?'disabled':''}>›</button></div></div>`;}
const searchToolbar=(f,extra='')=>`<div class="toolbar"><input data-filter="search" value="${e(f.search)}" placeholder="Tìm tên, mã hoặc nội dung…" aria-label="Tìm trong danh sách">${extra}</div>`;
const statusSelect=(f,options)=>`<select aria-label="Lọc trạng thái" data-filter="status"><option value="">Tất cả trạng thái</option>${options.map(k=>`<option value="${k}" ${f.status===k?'selected':''}>${labels[k]||k}</option>`).join('')}</select>`;
const progress=p=>`<div class="progress"><span style="width:${p}%"></span></div>`;
function kpi(title,value,unit,note,ico,tone='blue'){return `<div class="kpi ${tone}"><div class="kpi-top"><span>${title}</span><div class="icon-tile ${tone}">${icon(ico,17)}</div></div><div class="kpi-value">${value}<span>${unit}</span></div><div class="kpi-bottom"><span class="kpi-note">${note}</span><svg class="mini-chart" viewBox="0 0 80 25" aria-hidden="true"><path d="M1 23 10 19 16 20 24 12 32 15 40 8 46 12 55 5 63 9 70 3 79 4" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M1 23 10 19 16 20 24 12 32 15 40 8 46 12 55 5 63 9 70 3 79 4V25H1Z" fill="currentColor" opacity=".07"/></svg></div></div>`;}
const field=(label,name,type='text',value='',attrs='')=>`<label>${label}<input name="${name}" type="${type}" value="${e(value)}" ${attrs}></label>`;
const selectField=(label,name,options,value='')=>`<label>${label}<select name="${name}">${options.map(([v,l])=>`<option value="${e(v)}" ${v===value?'selected':''}>${e(l)}</option>`).join('')}</select></label>`;
const notesField=(label='Mô tả',name='description',value='')=>`<label class="full">${label}<textarea name="${name}" required>${e(value)}</textarea></label>`;
const formFooter=(submit='Lưu thay đổi')=>`<p class="form-error" role="alert"></p><div class="form-actions">${button('Hủy','close')}<button type="submit" class="btn primary">${submit}</button></div>`;
const matches=(text,q)=>!q||text.toLocaleLowerCase('vi').includes(q.toLocaleLowerCase('vi'));
const details=(pairs)=>`<div class="detail-list">${pairs.map(([k,v])=>`<div><small>${k}</small><strong>${v}</strong></div>`).join('')}</div>`;
const downloadLink=(url,label='Tải tài liệu')=>`<a class="btn small" href="${e(url)}" download>${icon('download',14)}${label}</a>`;


// Source: components/dialog.js
let returnFocus;
function openDialog(title,body){const dialog=document.getElementById('modal');returnFocus=document.activeElement;dialog.innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Đóng">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;if(!dialog.open)dialog.showModal();}
function closeDialog(){document.getElementById('modal').close();returnFocus?.isConnected&&returnFocus.focus();}
let toastVersion=0;
function toastRevision(){return toastVersion;}
function clearToasts(){const container=document.getElementById('toast');container?.replaceChildren();}
function toast(text,{type='success',duration=5000,automatic=false}={}){
 const container=document.getElementById('toast');if(!container)return;
 if(!automatic)toastVersion++;container.className='toast-stack';container.setAttribute('aria-live','polite');
 if(typeof container.showPopover==='function'){container.setAttribute('popover','manual');try{container.showPopover();}catch{}}
 const item=document.createElement('div');item.className='toast-message toast-'+type;item.setAttribute('role',type==='error'?'alert':'status');
 const message=document.createElement('span');message.textContent=String(text);const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='toast-dismiss';dismiss.setAttribute('aria-label','Đóng thông báo');dismiss.textContent='×';
 item.append(message,dismiss);container.prepend(item);
 const timer=setTimeout(()=>item.remove(),duration);dismiss.onclick=()=>{clearTimeout(timer);item.remove();};
}

function confirmDialog({title='Xác nhận',message='',confirmLabel='Xác nhận',cancelLabel='Hủy',role='dialog'}={}){
 const previousFocus=document.activeElement,dialog=document.createElement('dialog');dialog.className='app-confirm-dialog';dialog.setAttribute('role',role);dialog.setAttribute('aria-labelledby','app-confirm-title');dialog.setAttribute('aria-describedby','app-confirm-message');
 dialog.innerHTML=`<div class="app-confirm-content"><span class="app-confirm-icon" aria-hidden="true">${icon('shield',24)}</span><h2 id="app-confirm-title"></h2><p id="app-confirm-message"></p></div><div class="app-confirm-actions"><button type="button" class="btn" data-confirm-cancel autofocus></button><button type="button" class="btn primary" data-confirm-accept></button></div>`;
 dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=message;dialog.querySelector('[data-confirm-cancel]').textContent=cancelLabel;dialog.querySelector('[data-confirm-accept]').textContent=confirmLabel;if(cancelLabel===null){dialog.querySelector('[data-confirm-cancel]').hidden=true;dialog.querySelector('[data-confirm-cancel]').removeAttribute('autofocus');dialog.querySelector('[data-confirm-accept]').setAttribute('autofocus','');}
 return new Promise(resolve=>{let settled=false;function finish(accepted){if(settled)return;settled=true;if(dialog.open)dialog.close();dialog.remove();if(previousFocus?.isConnected&&!previousFocus.disabled)previousFocus.focus();resolve(accepted);}
 dialog.querySelector('[data-confirm-cancel]').onclick=()=>finish(false);dialog.querySelector('[data-confirm-accept]').onclick=()=>finish(true);dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}});dialog.addEventListener('keyup',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}});dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.addEventListener('close',()=>finish(false));document.body.appendChild(dialog);dialog.showModal();});
}

function alertDialog({title='Thông báo',message='',buttonLabel='OK'}={}){
 // A dedicated popup replaces the automatic mutation toast for this handled error.
 toastVersion++;return confirmDialog({title,message,confirmLabel:buttonLabel,cancelLabel:null,role:'alertdialog'});
}


// Source: pages/dashboard/dashboard.js
function teamOptions(f){return `<select data-filter="team" aria-label="Lọc team"><option value="">Tất cả team${user().role==='Manager'?' quản lý':''}</option>${s.teams.filter(t=>scope.scopedTeams(s,user()).includes(t.id)).map(t=>`<option value="${t.id}" ${f.team===t.id?'selected':''}>${e(t.name)}</option>`).join('')}</select>`;}
function visibleEmployees(f){return scope.employees(s,user()).filter(u=>(!f.team||u.teamId===f.team)&&u.status==='active');}
function visibleTasks(f){const people=new Set(visibleEmployees(f).map(u=>u.id));return scope.tasks(s,user()).filter(t=>!f.team||people.has(t.assigneeId));}
function attendanceRows(f){if([0,6].includes(new Date(f.date+'T12:00:00+07:00').getDay()))return [];return visibleEmployees(f).map(u=>({u,a:s.attendance.find(a=>a.userId===u.id&&a.date===f.date)})).filter(({u,a})=>matches(u.name+u.employeeCode,f.search)&&(!f.status||attendanceStatus(a)===f.status));}
function attendanceTable(f,dashboard=false){const rows=attendanceRows(f);if(f.sort==='name')rows.sort((a,b)=>a.u.name.localeCompare(b.u.name,'vi'));if(f.sort==='time')rows.sort((a,b)=>(a.a?.checkIn||'z').localeCompare(b.a?.checkIn||'z'));return table([`<button class="btn text" data-sort="name">Nhân viên ↕</button>`,'Team',`<button class="btn text" data-sort="time">Check-in ↕</button>`,'Check-out',...(dashboard?[]:['Giờ công']), 'Trạng thái'],rows.map(({u,a})=>[`<a href="#/hr/employees/${u.id}" data-open="employee" data-id="${u.id}">${person(u)}</a>`,e(s.teams.find(t=>t.id===u.teamId)?.name||'Office'),`<span style="color:${attendanceStatus(a)==='late'?'#c38f49':'#5a6d89'}">${timeLabel(a?.checkIn)}</span>`,timeLabel(a?.checkOut),...(dashboard?[]:[hours(a,s.settings)]),badge(attendanceStatus(a))]),{page:f.page,size:dashboard?5:Number(f.size)||10});}
function projectChart(f){const ts=visibleTasks(f);const ps=scope.projects(s,user()).filter(p=>!f.team||p.teamIds.includes(f.team));return `<div class="card-body project-chart">${ps.map(p=>{const all=ts.filter(t=>t.projectId===p.id),done=all.filter(t=>t.status==='done').length;return `<a class="chart-row ${p.health==='at_risk'?'orange':p.color}" href="#/projects/${p.id}" title="${e(p.name)}: ${done}/${all.length} task, hạn ${dateLabel(p.dueDate)}"><span class="chart-name">${e(p.name)}</span><span class="chart-track"><span class="chart-fill" style="width:${pct(done,all.length)}%;display:block"></span></span><span class="chart-percent">${pct(done,all.length)}%</span></a>`;}).join('')||empty()}<div class="chart-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div class="chart-footer"><span>${icon('clock',10)} Cập nhật từ dữ liệu công việc</span><strong>${ts.filter(t=>t.status==='done').length}/${ts.length} task hoàn thành</strong></div></div>`;}
function attendanceChart(f){const weekend=[0,6].includes(new Date(f.date+'T12:00:00+07:00').getDay());if(weekend)return `<div class="card-body">${empty('Không có lịch làm việc','Ngày đã chọn là ngày nghỉ cuối tuần.')}</div>`;const rows=attendanceRows({...f,search:'',status:''}),n=rows.length;const counts=['ontime','late','leave','absent'].map(st=>rows.filter(({a})=>attendanceStatus(a)===st).length),sum=counts[0]+counts[1];return `<div class="card-body"><div class="attendance-chart"><div class="donut" style="--a:${pct(counts[0],n)}%;--b:${pct(sum,n)}%;--c:${pct(sum+counts[2],n)}%" role="img" aria-label="${sum}/${n} đã check-in"><div class="donut-center"><strong>${sum}<span>/${n}</span></strong><small>Đã check-in</small></div></div><div class="attendance-legend">${['Đúng giờ','Đi trễ','Nghỉ phép','Chưa check-in'].map((name,i)=>`<li><span class="legend-key" style="--tone:${['#5296ec','#e9b667','#a58ad9','#d8dee9'][i]}">${name}</span><strong>${counts[i]}</strong></li>`).join('')}</div></div><div class="attendance-summary"><strong>${n?(sum/n*100).toLocaleString('vi-VN',{maximumFractionDigits:1}):0}%</strong> nhân sự đã có mặt · ${dateLabel(f.date)}</div></div>`;}
function taskList(f){const tasks=visibleTasks(f).filter(t=>t.status!=='done'&&t.dueDate<='2026-10-26').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));return `<div class="card-body" style="padding-top:5px">${tasks.slice(0,5).map(t=>{const u=s.users.find(u=>u.id===t.assigneeId),over=t.dueDate<'2026-10-19';return `<a class="task-item" href="#/workspace/tasks" data-open="task" data-id="${t.id}"><span class="task-check"></span><div><h3>${e(t.title)}</h3><p>${e(t.code)} <span>·</span> ${badge(t.priority)}</p><div class="due ${over?'overdue':''}">${icon('calendar',10)} ${over?'Quá hạn · ':''}${dateLabel(t.dueDate)}</div></div>${avatar(u)}</a>`;}).join('')||empty('Không có task sắp đến hạn','Bạn đã hoàn thành các công việc trong tuần.')}</div>`;}
function notifications(limit=99,filter='all'){if(apiSession()){const current=notificationService.snapshot();return `<div data-notification-feed="${limit}">${current.items.length?notificationRows(current.items.slice(0,limit)):current.loading?'<p>Đang tải thông báo…</p>':'<p>Chưa có thông báo.</p>'}</div>`;}let ns=s.notifications.filter(n=>n.recipientId===user().id&&(filter==='all'||filter==='unread'&&!n.readAt||n.type===filter));return ns.slice(0,limit).map(n=>`<a href="#${n.targetRoute}" class="notification-row ${!n.readAt?'unread':''}" data-notification="${n.id}"><div class="icon-tile ${n.type==='leave'?'purple':n.type==='system'?'orange':'blue'}">${icon(n.type==='task'?'check':n.type==='leave'?'calendar':n.type==='system'?'file':'clock',15)}</div><div><h3>${e(n.title)}</h3><p>${e(n.body)}</p><p>${timeLabel(n.createdAt)} · ${dateLabel(n.createdAt)}</p></div></a>`).join('')||empty('Không có thông báo','Bạn đã cập nhật mọi thông tin.');}
function activityList(f,limit=6){const us=new Set(visibleEmployees(f).map(u=>u.id));return `<div class="card-body">${s.activities.filter(a=>us.has(a.actorId)||a.actorId===user().id).slice(0,limit).map(a=>{const u=s.users.find(u=>u.id===a.actorId),p=s.projects.find(p=>p.id===a.projectId);return `<div class="timeline-row">${avatar(u)}<div><p><strong>${e(u?.name)}</strong> ${e(a.action)}</p><small>${p?e(p.name)+' · ':''}${timeLabel(a.createdAt)} · ${dateLabel(a.createdAt)}</small></div></div>`;}).join('')||empty('Chưa có hoạt động','Các cập nhật của bạn sẽ xuất hiện tại đây.')}</div>`;}
function dashboard(f){const u=user(),us=visibleEmployees(f),ps=scope.projects(s,u).filter(p=>!f.team||p.teamIds.includes(f.team)),ts=visibleTasks(f),done=ts.filter(t=>t.status==='done').length,ars=attendanceRows({...f,search:'',status:''}),check=ars.filter(({a})=>!!a?.checkIn).length;const admin=u.role==='Admin',hr=u.role==='HR';let metrics=admin?kpi('Tài khoản hoạt động',s.users.filter(x=>x.status==='active').length,'users','Toàn bộ hệ thống','users','blue')+kpi('Nhóm quyền',5,'roles','Phân quyền theo phạm vi','shield','purple')+kpi('Nhật ký thao tác',s.auditLogs.length,'','Ghi nhận trong bản demo','file','orange')+kpi('Phòng ban',s.departments.length,'','Engineering & People','briefcase','teal'):hr?kpi('Nhân sự công ty',us.length,'người','Đang làm việc tại Intelex','users','blue')+kpi('Hợp đồng sắp hết',s.contracts.filter(c=>c.endDate<'2026-11-19').length,'','Trong 30 ngày tới','file','purple')+kpi('Yêu cầu cần xử lý',s.requests.filter(r=>r.currentApproverId===u.id).length,'','Đang chờ HR phê duyệt','approval','orange')+kpi('Chấm công hôm nay',check,`/ ${us.length}`,'Có mặt trong ngày','clock','teal'):kpi(u.role==='Dev'?'Thành viên':'Nhân sự quản lý',us.length,'người',u.role==='Dev'?'Không gian cá nhân':`${new Set(us.map(x=>x.teamId)).size} team trong phạm vi`,'users','blue')+kpi('Dự án đang chạy',ps.length,'dự án','Đang trong giai đoạn triển khai','folder','purple')+kpi('Task hoàn thành',done,`/ ${ts.length}`,`${pct(done,ts.length)}% công việc đã hoàn tất`,'check','orange')+kpi('Chấm công hôm nay',check,`/ ${us.length}`,'Nhân sự đã check-in','clock','teal');return `<div class="welcome-banner"><div class="welcome-icon">${icon('sun',21)}</div><div><strong>Một tuần mới, những ý tưởng mới.</strong><p>${u.role==='Dev'?'Sẵn sàng cùng Intelex tạo nên những điều có ý nghĩa.':`Bạn có ${scope.requests(s,u).filter(r=>r.currentApproverId===u.id).length} yêu cầu đang chờ xử lý. Cùng giữ nhịp làm việc của đội ngũ nhé!`}</p></div><a href="#/approvals" class="btn small">Xem yêu cầu ${icon('arrow',13)}</a></div><div class="kpis">${metrics}</div><div class="dashboard-grid">${hr||admin?card('Nhịp làm việc Intelex','Hoạt động mới nhất trong công ty',activityList(f,5),link('Xem nhân sự','/hr/employees')):card('Tiến độ dự án','Tổng quan tiến độ các dự án đang triển khai',projectChart(f),`<div class="chart-meta"><span class="legend-key blue">Đúng kế hoạch</span><span class="legend-key orange">Có nguy cơ</span></div>`)}${card('Chấm công hôm nay','Tình hình hiện diện của đội ngũ',attendanceChart(f),button('','refresh','refresh','text','aria-label="Làm mới chấm công"'))}</div><div class="dashboard-grid">${card('Báo cáo chấm công',`${dateLabel(f.date)} · Theo dõi check-in của đội ngũ`,`<div class="table-toolbar"><input placeholder="Tìm nhân viên…" aria-label="Tìm nhân viên chấm công" data-filter="search" value="${e(f.search)}"><select data-filter="status" aria-label="Lọc chấm công"><option value="">Tất cả trạng thái</option>${['ontime','late','leave','absent'].map(k=>`<option value="${k}" ${f.status===k?'selected':''}>${labels[k]}</option>`).join('')}</select></div>${attendanceTable(f,true)}`,link('Xem tất cả',u.role==='Dev'?'/workspace/attendance':'/reports'))}${hr||admin?card('Thông báo','Thông tin dành cho bạn',`<div class="card-body" style="padding-top:4px">${notifications(4)}</div>`,link('Tất cả','/notifications')):card('Task sắp đến hạn','Ưu tiên hôm nay và trong 7 ngày tới',taskList(f),link('Xem tất cả',u.role==='Dev'?'/workspace/tasks':'/projects/tasks'))}</div><div class="dashboard-grid">${card('Hoạt động gần đây','Những cập nhật mới nhất từ đội ngũ',activityList(f,5),`<span class="tag">Hôm nay</span>`)}${card('Bảng tin Intelex','Kết nối và cập nhật thông tin',`<div class="card-body" style="padding-top:4px">${notifications(3)}</div>`,link('Xem tất cả','/notifications'))}</div>`;}


// Source: pages/payroll/payroll-common.js

const payrollStatuses={DRAFT:'Bản nháp',OPEN:'Đang mở',REVIEW:'Đang đối soát',APPROVED:'Đã duyệt',LOCKED:'Đã chốt',PAID:'Đã thanh toán',PUBLISHED:'Đã phát hành'};
const payrollPayBases={MONTH:'Theo tháng',DAY:'Theo ngày',HOUR:'Theo giờ'};
function payrollGrant(screen,flag='canView',{global=false,session=apiSession()}={}){
 const action={canView:'VIEW',canNew:'NEW',canUpdate:'UPDATE',canApprove:'APPROVE',canExport:'EXPORT'}[flag];
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code===screen&&p.canView==='Y'&&p[flag]==='Y'&&(flag==='canView'||flag==='canExport'||p.dataScopes?.[action]==null||(global?p.dataScopes[action]==='ALL':['ALL','DEPARTMENT'].includes(p.dataScopes[action]))));
}
function payrollPageData(response){if(response?.success!==true||!Array.isArray(response.data)||!Number.isSafeInteger(response.total)||response.total<0)throw Error('Danh sách lương trả về không hợp lệ.');return response;}
function payrollObject(response){if(response?.success!==true||!response.data||typeof response.data!=='object')throw Error('Dữ liệu trả về không hợp lệ. Vui lòng tải lại.');return response.data;}
function payrollJson(value,fallback){if(value===null||value===undefined||value==='')return fallback;try{return typeof value==='string'?JSON.parse(value):value;}catch{throw Error('Dữ liệu cấu hình đã lưu không hợp lệ. Vui lòng đối soát trước khi sửa.');}}
function payrollId(value){const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw Error('Chọn bản ghi hợp lệ.');return id;}
function payrollMoney(value){const text=String(value??'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(text)||Number(text)>1000000000000)throw Error('Số tiền phải từ 0 đến 1.000.000.000.000, tối đa hai số lẻ.');return Number(text);}
function payrollDecimal(value,{min=0,max=1000000000000,integer=false}={}){const text=String(value??'').trim(),n=Number(text);if(!text||!Number.isFinite(n)||n<min||n>max||integer&&!Number.isInteger(n))throw Error('Giá trị số ngoài phạm vi cho phép.');return n;}
function payrollDate(value,optional=false){if(optional&&!value)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(value||'')||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||Number(value.slice(0,4))<2000||Number(value.slice(0,4))>2100)throw Error('Ngày phải hợp lệ trong khoảng năm 2000–2100.');return value;}
function payrollDates(from,to){const effectiveFrom=payrollDate(from),effectiveTo=payrollDate(to,true);if(effectiveTo&&effectiveTo<effectiveFrom)throw Error('Ngày kết thúc không được trước ngày bắt đầu.');return {effectiveFrom,effectiveTo};}
function payrollMonth(value){if(!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value||''))throw Error('Chọn tháng hợp lệ trong khoảng 2000–2100.');return value;}
function payrollLocalDate(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),part=type=>parts.find(item=>item.type===type).value;return part('year')+'-'+part('month')+'-'+part('day');}
function payrollOperationKey(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();return 'payroll-'+Date.now()+'-'+Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('');}
function payrollAmount(value,currency=''){return value===null||value===undefined?'—':Number(value).toLocaleString('vi-VN',{maximumFractionDigits:2})+(currency?' '+currency:'');}
function payrollBadge(status){return `<span class="badge ${['APPROVED','LOCKED','PAID','PUBLISHED'].includes(status)?'active':status==='REVIEW'?'review':''}">${e(payrollStatuses[status]||status)}</span>`;}
function payrollSelect(name,label,items,selected='',{empty='Chọn…',required=false,disabled=false}={}){return `<label>${label}<select name="${name}" ${required?'required':''} ${disabled?'disabled':''}><option value="">${e(empty)}</option>${items.map(item=>`<option value="${e(item.id)}" ${String(item.id)===String(selected)?'selected':''}>${e(item.label??item.name??item.code)}</option>`).join('')}</select></label>`;}
function payrollSwitch(name,label,on=false){return `<label class="role-toggle-row payroll-switch"><span>${label}</span><span class="role-switch"><input role="switch" type="checkbox" name="${name}" ${on?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;}
function payrollFooter(editable,label='Lưu'){return `<div class="form-actions">${editable?`<button class="btn primary" type="submit">${label}</button>`:''}<button class="btn" type="button" data-payroll-reload>Tải lại</button></div><p class="form-error" role="alert" data-payroll-feedback></p>`;}
function payrollIssueMessage(value){
 let message=String(value??''),prefix='';const date=/^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}):\s*/.exec(message);
 if(date){const parts=date[1].split(/[\/-]/);prefix=(date[1].includes('-')?[parts[2],parts[1],parts[0]]:(Number(parts[0])>12?[parts[0].padStart(2,'0'),parts[1].padStart(2,'0'),parts[2]]:[parts[1].padStart(2,'0'),parts[0].padStart(2,'0'),parts[2]])).join('/')+': ';message=message.slice(date[0].length);}
 const translations={
 'incomplete attendance; request an adjustment before locking.':'Quên điểm danh',
 'duplicate work schedules.':'Có nhiều lịch làm việc trùng ngày. Kiểm tra và xử lý lịch phân ca bị trùng trước khi tổng hợp lại.',
 'overlapping approved leave.':'Các đơn nghỉ phép đã duyệt bị trùng thời gian. Đối soát đơn nghỉ phép trước khi tổng hợp lại.',
 'duplicate attendance rows.':'Có nhiều bản ghi chấm công cho cùng lịch làm việc. Kiểm tra và xử lý bản ghi bị trùng.',
 'schedule has no verified rule snapshot.':'Lịch làm việc chưa có quy tắc ca được xác nhận. Kiểm tra lại lịch phân ca.',
 'invalid attendance interval.':'Khoảng giờ chấm công không hợp lệ: giờ ra phải sau giờ vào. Cần điều chỉnh công trước khi chốt.',
 'overlapping attendance intervals.':'Các khoảng chấm công bị trùng thời gian. Đối soát và điều chỉnh công trước khi chốt.',
 'overlapping approved overtime.':'Các khoảng tăng ca đã duyệt bị trùng thời gian. Kiểm tra và xử lý đơn tăng ca.',
 'work and approved leave exceed one day; reconcile leave/attendance.':'Tổng công làm và phép đã duyệt vượt quá một ngày. Đối soát dữ liệu chấm công và nghỉ phép.'
 };
 const overtime=/^Overtime (\d+): approved quantity is missing\.$/i.exec(message);
 return prefix+(translations[message.toLowerCase()]||(overtime?'Yêu cầu tăng ca #'+overtime[1]+' chưa có số giờ được duyệt. Kiểm tra lại phê duyệt tăng ca.':message));
}
function payrollIssues(value,employees=[]){
 const issues=payrollJson(value,[]);if(!Array.isArray(issues))throw Error('Danh sách lỗi không hợp lệ.');if(!issues.length)return '';
 const byId=new Map(employees.map(employee=>[String(employee.id),employee])),groups=new Map();
 for(const issue of issues){const translated=payrollIssueMessage(issue.message??issue),date=/^(\d{2}\/\d{2}\/\d{4}):\s*/.exec(translated),message=date?translated.slice(date[0].length):translated,employee=byId.get(String(issue.employeeId)),code=issue.employeeCode||employee?.employeeCode,name=issue.employeeName||employee?.fullName||employee?.employeeName,label=code?'Mã nhân viên: '+code+(name?' · '+name:''):issue.employeeId?'Nhân viên (chưa tải được mã)':'';
 if(!groups.has(message))groups.set(message,[]);if(label||date)groups.get(message).push({label,date:date?.[1]});}
 return `<section class="payroll-issues"><h3>Cần đối soát (${issues.length})</h3>${[...groups].map(([message,rows])=>`<div class="payroll-issue-group"><p class="payroll-issue-guidance">${e(message)}</p>${rows.length?`<ul>${rows.map(row=>`<li>${row.label?`<strong>${e(row.label)}</strong>`:''}${row.date?`<span>${row.label?' · ':''}Ngày ${e(row.date)}</span>`:''}</li>`).join('')}</ul>`:''}</div>`).join('')}</section>`;
}

async function payrollAllRows(area,resource,{filters={},alive=()=>true}={}){const rows=[];for(let page=1;alive();page++){const response=payrollPageData(await apiCompensationList(area,resource,{...filters,page,pageSize:100}));if(!alive())return [];rows.push(...response.data);if(rows.length>=response.total)return rows;if(!response.data.length)throw Error('Chưa tải đủ danh mục. Vui lòng thử lại.');}return [];}
function payrollPagination(host,{page,total,pageSize=20,onPage}){host.innerHTML=`<span>${total} mục · Trang ${page}/${Math.max(1,Math.ceil(total/pageSize))}</span><div><button class="btn" type="button" data-prev ${page<=1?'disabled':''}>Trang trước</button><button class="btn" type="button" data-next ${page*pageSize>=total?'disabled':''}>Trang sau</button></div>`;host.querySelector('[data-prev]').onclick=()=>onPage(page-1);host.querySelector('[data-next]').onclick=()=>onPage(page+1);}
function payrollController(root){let disposed=false,dialogGeneration=0,host=null;const active=()=>!disposed&&root.isConnected;
 return {active,dispose:()=>{disposed=true;++dialogGeneration;if(host?.isConnected)closeDialog();},dialog:async(title,prepare)=>{const current=++dialogGeneration;openDialog(title,'<div id="payroll-dialog"><p role="status">Đang tải…</p></div>');host=document.getElementById('payroll-dialog');const panel=host,alive=()=>active()&&panel.isConnected&&current===dialogGeneration;try{await prepare(panel,alive);}catch(err){if(alive()){panel.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;panel.querySelector('button').onclick=()=>{if(alive())prepare(panel,alive).catch(error=>{if(alive())panel.querySelector('[role=alert]').textContent=error.message;});};}}}};
}
function payrollBindForm(form,{canSave=()=>true,save,onSaved,reload,success='Đã lưu thay đổi.',alive=()=>form.isConnected}){
 let busy=false,stale=false;const feedback=form.querySelector('[data-payroll-feedback]');form.noValidate=true;form.querySelector('[data-payroll-reload]')?.addEventListener('click',()=>{if(!busy)reload();});
 form.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy)return;if(stale){feedback.textContent='Tải lại dữ liệu trước khi tiếp tục.';return;}if(!canSave()){feedback.textContent='Bạn chưa có quyền thực hiện thao tác này.';return;}if(!form.checkValidity()){const invalid=form.querySelector('input:invalid,select:invalid,textarea:invalid');feedback.textContent='Vui lòng kiểm tra các trường bắt buộc.';toast(feedback.textContent,{type:'error'});invalid?.focus();return;}
 const values=Object.fromEntries(new FormData(form)),controls=[...form.querySelectorAll('input,select,textarea,button')].map(control=>[control,control.disabled]);busy=true;controls.forEach(([control])=>control.disabled=true);feedback.textContent='Đang xử lý…';
 try{const result=await save(values,event.submitter?.value);if(!alive()||!form.isConnected)return;if(result===null){feedback.textContent='';return;}if(result?.success!==true&&result?.success!==false)throw Error('Chưa nhận xác nhận hợp lệ. Tải lại dữ liệu trước khi tiếp tục.');if(result.success===false)toast('Chưa hoàn tất: có '+(result.errors??'')+' lỗi cần đối soát. Chưa thể chốt hoặc phát hành.',{type:'error'});else toast(success);await onSaved(result);}
 catch(err){stale=err.status===409;if(form.isConnected&&alive()){feedback.textContent=err.message+(stale?' Tải lại để lấy phiên bản mới; thao tác không được tự gửi lại.':'');if(!err.status)toast(feedback.textContent,{type:'error'});}}
 finally{busy=false;if(form.isConnected){controls.forEach(([control,disabled])=>{if(control.isConnected)control.disabled=disabled||stale;});const reloadButton=form.querySelector('[data-payroll-reload]');if(reloadButton)reloadButton.disabled=false;}}
 };return ()=>busy;
}
function payrollEmployeePicker(host,{area,selected=null,locked=false,alive=()=>host.isConnected}){
 let page=1,generation=0,timer;const chosen=selected?{...selected}:null;
 host.innerHTML=`${locked?'<p class="muted">Nhân viên giữ nguyên khi thay đổi hồ sơ lương.</p>':'<label>Tìm nhân viên<input type="search" data-payroll-employee-search placeholder="Mã hoặc tên nhân viên" maxlength="150"></label>'}<label>Nhân viên<select name="employeeId" required ${locked?'disabled data-payroll-locked':''}></select></label><div class="payroll-picker-pages"></div><p role="status" data-picker-error></p>`;
 const select=host.querySelector('select');if(chosen)select.innerHTML=`<option value="${e(chosen.id)}">${e(chosen.employeeCode)} · ${e(chosen.fullName)}</option>`;else select.innerHTML='<option value="">Chọn nhân viên</option>';
 async function load(){const current=++generation;try{const result=payrollPageData(await apiCompensationList(area,'employees',{page,pageSize:20,search:host.querySelector('input')?.value.trim()||''}));if(!alive()||current!==generation)return;const old=select.selectedOptions[0],value=select.value;select.innerHTML='<option value="">Chọn nhân viên</option>'+result.data.map(item=>`<option value="${e(item.id)}">${e(item.employeeCode)} · ${e(item.fullName)}</option>`).join('');if(value&&!result.data.some(item=>String(item.id)===value)&&old)select.appendChild(old.cloneNode(true));select.value=value;const pages=host.querySelector('.payroll-picker-pages');payrollPagination(pages,{page,total:result.total,onPage:next=>{page=next;load();}});host.querySelector('[data-picker-error]').textContent='';}
 catch(err){if(alive()&&current===generation)host.querySelector('[data-picker-error]').textContent=err.message;}}
 if(!locked){host.querySelector('input').oninput=()=>{clearTimeout(timer);++generation;page=1;timer=setTimeout(()=>{if(alive())load();},300);};void load();}
 return {id:()=>chosen&&locked?chosen.id:payrollId(select.value)};
}


// Source: pages/payroll/salary-configuration.js

const salaryConfigurationTabs={profiles:'Hồ sơ lương',components:'Khoản lương',policies:'Chính sách lương'};
function salaryProfilePayload(values,items,components,previous=null){
 const payload={employeeId:previous?payrollId(previous.employeeID??previous.employeeId):payrollId(values.employeeId),baseSalary:payrollMoney(values.baseSalary),allowanceAmount:payrollMoney(values.allowanceAmount),insuranceBase:payrollMoney(values.insuranceBase),dependents:payrollDecimal(values.dependents,{max:30,integer:true}),kpiBonusAmount:payrollMoney(values.kpiBonusAmount),payBasis:values.payBasis,currencyCode:String(values.currencyCode||'').trim(),...payrollDates(values.effectiveFrom,values.effectiveTo),reason:String(values.reason||'').trim(),items:[],supersedeProfileId:null,supersedeVersion:null};
 if(!payrollPayBases[payload.payBasis]||!/^[A-Z]{3}$/.test(payload.currencyCode)||!payload.reason||payload.reason.length>1000)throw Error('Chọn hình thức lương, mã tiền tệ 3 chữ hoa và nhập lý do.');const seen=new Set();if(items.length>100)throw Error('Tối đa 100 khoản lương.');
 for(const item of items){const componentId=payrollId(item.componentId);if(seen.has(componentId)||!components.some(c=>c.id===componentId&&c.isActive))throw Error('Khoản lương phải đang hoạt động và không được trùng.');seen.add(componentId);payload.items.push({componentId,amount:payrollMoney(item.amount),prorate:!!item.prorate});}
 if(previous){if(payload.effectiveFrom<=previous.effectiveFrom||previous.effectiveTo&&payload.effectiveFrom>previous.effectiveTo)throw Error('Ngày thay đổi phải sau ngày bắt đầu và trong hiệu lực hồ sơ cũ.');payload.supersedeProfileId=payrollId(previous.id);payload.supersedeVersion=payrollId(previous.version);}
 return payload;
}
function salaryComponentPayload(values,previous=null){
 const payload={code:String(values.code||'').trim(),name:String(values.name||'').trim(),kind:previous?.kind||values.kind,taxable:!!values.taxable,taxDeductible:!!values.taxDeductible,overtimeIncluded:!!values.overtimeIncluded,isActive:!!values.isActive,version:previous?.version||0};
 if(!/^[A-Z0-9_]{1,30}$/.test(payload.code)||!payload.name||payload.name.length>150||!['EARNING','DEDUCTION'].includes(payload.kind))throw Error('Nhập mã, tên và loại khoản lương hợp lệ.');if(['BASE','ALLOWANCE','NIGHT','OVERTIME','KPI','TAX'].includes(payload.code)||payload.code.startsWith('INS_'))throw Error('Mã khoản này dành riêng cho hệ thống tính lương.');if(previous&&payload.code!==previous.code)throw Error('Không được đổi mã khoản lương.');
 if(payload.kind==='DEDUCTION'&&(payload.taxable||payload.overtimeIncluded)||payload.kind==='EARNING'&&payload.taxDeductible)throw Error('Cờ thuế/tăng ca không phù hợp loại khoản lương.');return payload;
}
const salaryOvertimeKinds={NORMAL:'Ngày thường',NORMAL_NIGHT:'Đêm ngày thường',REST:'Ngày nghỉ',REST_NIGHT:'Đêm ngày nghỉ',HOLIDAY:'Ngày lễ',HOLIDAY_NIGHT:'Đêm ngày lễ'};
function salaryPolicyPayload(values,rules,previous=null){
 const payload={code:String(values.code||'').trim(),name:String(values.name||'').trim(),...payrollDates(values.effectiveFrom,values.effectiveTo),legalReference:String(values.legalReference||'').trim(),rules,version:previous?.version||0};
 if(!/^[A-Z0-9_]{1,40}$/.test(payload.code)||!payload.name||payload.name.length>150||!payload.legalReference||payload.legalReference.length>1000||!/^[A-Z]{3}$/.test(rules.currencyCode))throw Error('Nhập mã, tên, căn cứ áp dụng và mã tiền tệ hợp lệ.');if(previous&&previous.status!=='DRAFT')throw Error('Chính sách đã phát hành không thể chỉnh sửa.');
 if(rules.taxMode==='PROGRESSIVE'){if(!rules.taxBrackets.length||rules.taxBrackets.at(-1).upTo!==null)throw Error('Thuế lũy tiến cần bậc cuối không giới hạn.');let before=0;for(const bracket of rules.taxBrackets.slice(0,-1)){if(bracket.upTo===null||bracket.upTo<=before)throw Error('Giới hạn bậc thuế phải tăng dần.');before=bracket.upTo;}}
 if(new Set(rules.insurance.map(item=>item.code)).size!==rules.insurance.length)throw Error('Mã bảo hiểm không được trùng.');return payload;
}

function mountSalaryConfiguration(root){
 const screen='WEB_SALARY_CONFIGURATION';if(!root)return ()=>{};if(!payrollGrant(screen)){root.innerHTML='<p>Bạn cần quyền WEB_SALARY_CONFIGURATION/VIEW.</p>';return ()=>{};}
 const controller=payrollController(root),active=controller.active;let tab='profiles',page=1,filters={},generation=0,timer,org={departments:[],teams:[],components:[]};
 const grant=(flag,global=false)=>payrollGrant(screen,flag,{global});
 function shell(){root.innerHTML=`<div class="tabs">${Object.entries(salaryConfigurationTabs).map(([key,label])=>`<button class="tab ${key===tab?'active':''}" type="button" data-salary-tab="${key}">${label}</button>`).join('')}</div><form class="payroll-filters" data-salary-filters><label>Tìm kiếm<input type="search" name="search" maxlength="150" placeholder="${tab==='profiles'?'Mã hoặc tên nhân viên':'Mã hoặc tên danh mục'}"></label>${tab==='profiles'?payrollSelect('departmentId','Phòng ban',org.departments,'',{empty:'Tất cả phòng ban'})+payrollSelect('teamId','Team',org.teams,'',{empty:'Tất cả team'}):''}<button class="btn" type="submit">Lọc</button><button class="btn" type="button" data-salary-refresh>Làm mới</button>${grant('canNew',tab!=='profiles')?`<button class="btn primary" type="button" data-salary-new>Thêm ${tab==='profiles'?'hồ sơ lương':tab==='components'?'khoản lương':'chính sách'}</button>`:''}</form><p role="alert" data-salary-lookup-error></p><div data-salary-content></div><div class="user-pagination" data-salary-pages></div>`;
 root.querySelectorAll('[data-salary-tab]').forEach(button=>button.onclick=()=>{clearTimeout(timer);++generation;tab=button.dataset.salaryTab;page=1;filters={};shell();});const form=root.querySelector('form');function apply(){filters=Object.fromEntries([...new FormData(form)].filter(([,value])=>String(value).trim()));page=1;load();}form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(timer);apply();};form.elements.search.oninput=()=>{clearTimeout(timer);timer=setTimeout(apply,300);};
 form.elements.departmentId?.addEventListener('change',()=>{form.elements.teamId.innerHTML='<option value="">Tất cả team</option>'+org.teams.filter(item=>!form.elements.departmentId.value||String(item.departmentId)===form.elements.departmentId.value).map(item=>`<option value="${item.id}">${e(item.name)}</option>`).join('');apply();});form.elements.teamId?.addEventListener('change',apply);
 root.querySelector('[data-salary-refresh]').onclick=load;root.querySelector('[data-salary-new]')?.addEventListener('click',()=>tab==='profiles'?profileDialog():tab==='components'?componentDialog():policyDialog());void load();}
 async function load(){const current=++generation,kind=tab,content=root.querySelector('[data-salary-content]'),pages=root.querySelector('[data-salary-pages]');content.innerHTML='<p role="status">Đang tải cấu hình lương…</p>';pages.innerHTML='';try{const result=payrollPageData(await apiCompensationList('salary-configuration',kind,{...filters,page,pageSize:20}));if(!active()||current!==generation)return;
 const headers=kind==='profiles'?['Nhân viên','Lương cơ bản','Hình thức','Hiệu lực','']:kind==='components'?['Mã / Tên','Loại khoản','Trạng thái','']:['Mã / Tên','Hiệu lực','Trạng thái',''];content.innerHTML=`<div class="table-wrap"><table><thead><tr>${headers.map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${result.data.map((item,index)=>{const row=kind==='profiles'?item.profile:item;return `<tr>${kind==='profiles'?`<td><strong>${e(item.employeeName)}</strong><small>${e(item.employeeCode)}</small></td><td>${e(payrollAmount(row.baseSalary,row.currencyCode))}</td><td>${e(payrollPayBases[row.payBasis]||'Chưa xác nhận')}</td><td>${e(dateLabel(row.effectiveFrom))} – ${row.effectiveTo?e(dateLabel(row.effectiveTo)):'Không giới hạn'}</td>`:kind==='components'?`<td><strong>${e(row.code)}</strong><small>${e(row.name)}</small></td><td>${row.kind==='EARNING'?'Thu nhập':'Khấu trừ'}</td><td><span class="badge ${row.isActive?'active':''}">${row.isActive?'Hoạt động':'Ngừng dùng'}</span></td>`:`<td><strong>${e(row.code)}</strong><small>${e(row.name)}</small></td><td>${e(dateLabel(row.effectiveFrom))} – ${row.effectiveTo?e(dateLabel(row.effectiveTo)):'Không giới hạn'}</td><td>${payrollBadge(row.status)}</td>`}<td><button class="btn small" type="button" data-salary-detail="${index}">Chi tiết</button></td></tr>`;}).join('')}</tbody></table></div>${result.data.length?'':'<p class="empty">Chưa có dữ liệu theo bộ lọc.</p>'}`;
 content.querySelectorAll('[data-salary-detail]').forEach(button=>button.onclick=()=>{const item=result.data[Number(button.dataset.salaryDetail)];if(kind==='profiles')profileDetails(item);else if(kind==='components')componentDialog(item);else policyDialog(item);});payrollPagination(pages,{page,total:result.total,onPage:next=>{page=next;load();}});
 }catch(err){if(active()&&current===generation){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}}}
 async function metadata(){try{const result=await apiCompensationLookups('salary-configuration');if(!active())return;if(!['departments','teams','components'].every(key=>Array.isArray(result[key])))throw Error('Danh mục cấu hình lương không hợp lệ.');org=result;const form=root.querySelector('form');for(const key of ['departmentId','teamId'])if(form.elements.namedItem(key)){const select=form.elements.namedItem(key),value=select.value;select.innerHTML='<option value="">Tất cả</option>'+org[key==='departmentId'?'departments':'teams'].map(item=>`<option value="${item.id}">${e(item.name)}</option>`).join('');select.value=value;}}catch(err){if(active())root.querySelector('[data-salary-lookup-error]').textContent=err.message;}}
 async function latestProfile(item){const rows=await payrollAllRows('salary-configuration','profiles',{filters:{employeeId:item.profile.employeeID??item.profile.employeeId},alive:active});const current=rows.find(row=>row.profile.id===item.profile.id);if(!current)throw Error('Không tìm thấy hồ sơ trong phạm vi quyền.');return current;}
 function profileDetails(item){return controller.dialog('Hồ sơ lương',async(host,alive)=>{if(!alive())return;const row=item.profile,items=payrollJson(row.itemsJson,[]);host.innerHTML=`<h3>${e(item.employeeName)} · ${e(item.employeeCode)}</h3><div class="payroll-detail-grid">${[['Lương cơ bản',payrollAmount(row.baseSalary,row.currencyCode)],['Phụ cấp',payrollAmount(row.allowanceAmount,row.currencyCode)],['Căn cứ bảo hiểm',payrollAmount(row.insuranceBase,row.currencyCode)],['Thưởng KPI tiềm năng',payrollAmount(row.kpiBonusAmount,row.currencyCode)],['Người phụ thuộc',row.dependents],['Hình thức',payrollPayBases[row.payBasis]||'Chưa xác nhận'],['Từ ngày',dateLabel(row.effectiveFrom)],['Đến ngày',row.effectiveTo?dateLabel(row.effectiveTo):'Không giới hạn']].map(([label,value])=>`<div><span>${label}</span><strong>${e(value)}</strong></div>`).join('')}</div><p class="payroll-reason">${e(row.reason||'Chưa có lý do thay đổi')}</p>${items.map(value=>`<p>${e(value.code)} · ${e(value.name)}: ${e(payrollAmount(value.amount,row.currencyCode))} ${value.prorate?'(Theo công)':''}</p>`).join('')}${grant('canNew')&&grant('canUpdate')?'<button class="btn primary" type="button" data-replace-profile>Thay đổi lương</button>':''}`;host.querySelector('[data-replace-profile]')?.addEventListener('click',()=>profileDialog(item));});}
 function profileDialog(previousItem=null){return controller.dialog(previousItem?'Thay đổi lương':'Thêm hồ sơ lương',async(host,alive)=>{
 const components=await payrollAllRows('salary-configuration','components',{alive});if(!alive())return;const previous=previousItem?.profile,editable=grant('canNew')&&(!previous||grant('canUpdate'));let items=previous?payrollJson(previous.itemsJson,[]).map(item=>({componentId:item.componentId,amount:item.amount,prorate:item.prorate})):[];
 host.innerHTML=`<form class="payroll-form"><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div data-profile-employee></div><div class="form-grid">${field('Lương cơ bản','baseSalary','number',previous?.baseSalary??'','required min="0" max="1000000000000" step="0.01"')}${payrollSelect('payBasis','Hình thức',Object.entries(payrollPayBases).map(([id,label])=>({id,label})),previous?previous.payBasis:'MONTH',{required:true})}${field('Tiền tệ','currencyCode','text',previous?previous.currencyCode:'VND','required pattern="[A-Z]{3}" maxlength="3"')}${field('Phụ cấp cố định','allowanceAmount','number',previous?.allowanceAmount??0,'required min="0" max="1000000000000" step="0.01"')}${field('Căn cứ bảo hiểm','insuranceBase','number',previous?.insuranceBase??0,'required min="0" max="1000000000000" step="0.01"')}${field('Số người phụ thuộc','dependents','number',previous?.dependents??0,'required min="0" max="30" step="1"')}${field('Thưởng KPI tiềm năng','kpiBonusAmount','number',previous?.kpiBonusAmount??0,'required min="0" max="1000000000000" step="0.01"')}${field('Hiệu lực từ','effectiveFrom','date',payrollLocalDate(),'required')}${field('Hiệu lực đến','effectiveTo','date',previous?.effectiveTo||'')}</div><label>Lý do thay đổi<textarea name="reason" maxlength="1000" required></textarea></label><h3>Các khoản lương</h3><div data-profile-items></div><button class="btn" type="button" data-profile-add>Thêm khoản lương</button></fieldset>${payrollFooter(editable)}</form>`;
 const form=host.querySelector('form'),picker=payrollEmployeePicker(host.querySelector('[data-profile-employee]'),{area:'salary-configuration',selected:previous?{id:previous.employeeID??previous.employeeId,employeeCode:previousItem.employeeCode,fullName:previousItem.employeeName}:null,locked:!!previous,alive}),itemsHost=host.querySelector('[data-profile-items]');
 function collect(){items=[...itemsHost.querySelectorAll('[data-profile-item]')].map(section=>({componentId:section.querySelector('[name=componentId]').value,amount:section.querySelector('[name=amount]').value,prorate:section.querySelector('[name=prorate]').checked}));}
 function renderItems(){itemsHost.innerHTML=items.map((item,index)=>`<section class="payroll-item" data-profile-item><div class="form-grid">${payrollSelect('componentId','Khoản lương',components.filter(c=>c.isActive||c.id===Number(item.componentId)).map(c=>({id:c.id,label:c.code+' · '+c.name})),item.componentId,{required:true})}${field('Số tiền','amount','number',item.amount,'required min="0" max="1000000000000" step="0.01"')}${payrollSwitch('prorate','Phân bổ theo công',item.prorate)}</div><button class="btn small danger" type="button" data-item-remove="${index}">Xóa khoản</button></section>`).join('');itemsHost.querySelectorAll('[data-item-remove]').forEach(button=>button.onclick=()=>{collect();items.splice(Number(button.dataset.itemRemove),1);renderItems();});}renderItems();host.querySelector('[data-profile-add]').onclick=()=>{collect();if(items.length>=100)return;items.push({componentId:'',amount:'',prorate:true});renderItems();};
 payrollBindForm(form,{alive,canSave:()=>grant('canNew')&&(!previous||grant('canUpdate')),reload:async()=>{try{profileDialog(previousItem?await latestProfile(previousItem):null);}catch(err){toast(err.message,{type:'error'});}},save:values=>{collect();return apiCompensationSave('salary-configuration','profiles',salaryProfilePayload({...values,employeeId:picker.id()},items,components,previous));},onSaved:()=>{closeDialog();load();}});
 });}
 function componentDialog(row=null){return controller.dialog(row?'Khoản lương':'Thêm khoản lương',async(host,alive)=>{if(!alive())return;const editable=grant(row?'canUpdate':'canNew',true);
 host.innerHTML=`<form class="payroll-form"><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div class="form-grid">${field('Mã khoản','code','text',row?.code||'',`required maxlength="30" pattern="[A-Z0-9_]+" ${row?'readonly':''}`)}${field('Tên khoản','name','text',row?.name||'','required maxlength="150"')}${payrollSelect('kind','Loại khoản',[{id:'EARNING',label:'Thu nhập'},{id:'DEDUCTION',label:'Khấu trừ'}],row?.kind||'EARNING',{required:true,disabled:!!row})}${payrollSwitch('isActive','Hoạt động',row?.isActive??true)}${payrollSwitch('taxable','Chịu thuế',row?.taxable??true)}${payrollSwitch('taxDeductible','Giảm thu nhập tính thuế',row?.taxDeductible??false)}${payrollSwitch('overtimeIncluded','Tính vào lương tăng ca',row?.overtimeIncluded??false)}</div></fieldset>${payrollFooter(editable)}</form>`;const form=host.querySelector('form');form.elements.kind.onchange=()=>{const deduction=form.elements.kind.value==='DEDUCTION';if(deduction){form.elements.taxable.checked=false;form.elements.overtimeIncluded.checked=false;}else form.elements.taxDeductible.checked=false;};
 payrollBindForm(form,{alive,canSave:()=>grant(row?'canUpdate':'canNew',true),reload:async()=>{try{const fresh=row?(await payrollAllRows('salary-configuration','components',{alive})).find(item=>item.id===row.id):null;if(row&&!fresh)throw Error('Không tìm thấy khoản lương.');componentDialog(fresh);}catch(err){toast(err.message,{type:'error'});}},save:values=>apiCompensationSave('salary-configuration','components',salaryComponentPayload({...values,...Object.fromEntries(['taxable','taxDeductible','overtimeIncluded','isActive'].map(key=>[key,form.elements.namedItem(key).checked]))},row),row?.id??null),onSaved:()=>{closeDialog();load();metadata();}});
 });}
 function policyDialog(row=null){return controller.dialog(row?'Chính sách lương':'Thêm chính sách lương',async(host,alive)=>{if(!alive())return;const editable=grant(row?'canUpdate':'canNew',true)&&(!row||row.status==='DRAFT'),rules=row?payrollJson(row.rulesJson,{}):{};let brackets=rules.taxBrackets||[],insurance=rules.insurance||[],dirty=false;
 const ruleNumber=(label,name,min,max,step='0.0001',optional=false)=>field(label,name,'number',rules[name]??'',`${optional?'':'required'} min="${min}" max="${max}" step="${step}"`),ruleChoice=(label,name,options)=>payrollSelect(name,label,options.map(([id,label])=>({id,label})),rules[name]||'',{required:true});
 host.innerHTML=`<form class="payroll-form"><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div class="form-grid">${field('Mã chính sách','code','text',row?.code||'','required maxlength="40" pattern="[A-Z0-9_]+"')}${field('Tên chính sách','name','text',row?.name||'','required maxlength="150"')}${field('Hiệu lực từ','effectiveFrom','date',row?.effectiveFrom||'','required')}${field('Hiệu lực đến','effectiveTo','date',row?.effectiveTo||'')}</div><label>Căn cứ áp dụng<textarea name="legalReference" required maxlength="1000">${e(row?.legalReference||'')}</textarea></label><h3>Quy tắc tính lương</h3><div class="form-grid">${field('Tiền tệ','currencyCode','text',rules.currencyCode||'','required pattern="[A-Z]{3}" maxlength="3"')}${ruleNumber('Ngày công chuẩn (trống: theo lịch)','standardDays',0.0001,31,'0.0001',true)}${ruleNumber('Giờ công mỗi ngày','hoursPerDay',0.0001,24)}${ruleNumber('Bước làm tròn','roundingStep',0.01,100000,'0.01')}${ruleChoice('Cách làm tròn','roundingMode',[['AWAY_FROM_ZERO','Nửa lên'],['TO_EVEN','Nửa về số chẵn'],['DOWN','Xuống'],['UP','Lên']])}${field('Giờ đêm bắt đầu','nightStart','time',rules.nightStart||'','required step="1"')}${field('Giờ đêm kết thúc','nightEnd','time',rules.nightEnd||'','required step="1"')}${ruleNumber('Tỷ lệ phụ trội làm đêm','nightWorkPremiumRate',0,10)}${payrollSwitch('payPublicHolidays','Hưởng lương ngày lễ',rules.payPublicHolidays)}${payrollSwitch('includeLegacyAllowanceInOvertime','Tính phụ cấp cố định vào lương tăng ca',rules.includeLegacyAllowanceInOvertime)}</div><h3>Hệ số tăng ca</h3><div class="form-grid">${Object.entries(salaryOvertimeKinds).map(([key,label])=>field(label,'ot-'+key,'number',rules.overtimeMultipliers?.[key]??'','required min="0.0001" max="100" step="0.0001"')).join('')}${ruleChoice('Thuế đối với tăng ca','overtimeTaxMode',[['FULL','Toàn bộ'],['BASE_ONLY','Chỉ phần lương cơ sở'],['EXEMPT','Miễn thuế']])}</div><h3>Thuế và giảm trừ</h3><div class="form-grid">${ruleChoice('Cách tính thuế','taxMode',[['NONE','Không tính'],['FLAT','Tỷ lệ cố định'],['PROGRESSIVE','Lũy tiến']])}${ruleNumber('Thuế suất cố định (0–1)','flatTaxRate',0,1)}${ruleNumber('Giảm trừ cá nhân','personalDeduction',0,1000000000000,'0.01')}${ruleNumber('Giảm trừ mỗi người phụ thuộc','dependentDeduction',0,1000000000000,'0.01')}</div><div data-tax-brackets></div><button class="btn" type="button" data-add-bracket>Thêm bậc thuế</button><h3>Bảo hiểm</h3><div class="form-grid">${ruleNumber('Số công tối thiểu tính bảo hiểm','minimumPaidDaysForInsurance',0,31)}${ruleChoice('Căn cứ bảo hiểm','insuranceBaseMode',[['WEIGHTED','Theo hiệu lực từng ngày'],['MONTH_END','Cuối tháng']])}</div><div data-insurance></div><button class="btn" type="button" data-add-insurance>Thêm bảo hiểm</button><h3>Thưởng KPI</h3><div class="form-grid">${ruleChoice('Chu kỳ KPI','kpiPeriodType',[['MONTH','Tháng'],['QUARTER','Quý'],['YEAR','Năm']])}${ruleNumber('Giới hạn điểm KPI','kpiScoreCap',0.0001,200)}${payrollSwitch('prorateKpiBonus','Phân bổ thưởng theo công',rules.prorateKpiBonus)}</div></fieldset>${payrollFooter(editable)}</form>${row?.status==='DRAFT'&&grant('canUpdate',true)?'<button class="btn" type="button" data-publish-policy>Phát hành chính sách</button>':''}`;
 const form=host.querySelector('form'),taxHost=host.querySelector('[data-tax-brackets]'),insuranceHost=host.querySelector('[data-insurance]');
 function collect(){brackets=[...taxHost.querySelectorAll('[data-bracket]')].map(section=>({upTo:section.querySelector('[name=upTo]').value,rate:section.querySelector('[name=rate]').value}));insurance=[...insuranceHost.querySelectorAll('[data-insurance-rule]')].map(section=>Object.fromEntries(['code','employeeRate','employerRate','baseFloor','baseCap','taxDeductible'].map(key=>{const input=section.querySelector('[name='+key+']');return [key,key==='taxDeductible'?input.checked:input.value];})));}
 function renderArrays(){taxHost.innerHTML=brackets.map((item,index)=>`<section class="payroll-item" data-bracket><div class="form-grid">${field('Đến mức (trống: không giới hạn)','upTo','number',item.upTo??'','min="0.01" max="1000000000000" step="0.01"')}${field('Thuế suất (0–1)','rate','number',item.rate,'required min="0" max="1" step="0.0001"')}</div><button class="btn small danger" type="button" data-remove-bracket="${index}">Xóa bậc</button></section>`).join('');insuranceHost.innerHTML=insurance.map((item,index)=>`<section class="payroll-item" data-insurance-rule><div class="form-grid">${field('Mã bảo hiểm','code','text',item.code||'','required maxlength="30"')}${field('Tỷ lệ nhân viên (0–1)','employeeRate','number',item.employeeRate??'','required min="0" max="1" step="0.0001"')}${field('Tỷ lệ doanh nghiệp (0–1)','employerRate','number',item.employerRate??'','required min="0" max="1" step="0.0001"')}${field('Căn cứ tối thiểu','baseFloor','number',item.baseFloor??'','required min="0" max="1000000000000" step="0.01"')}${field('Căn cứ tối đa (trống: không giới hạn)','baseCap','number',item.baseCap??'','min="0.01" max="1000000000000" step="0.01"')}${payrollSwitch('taxDeductible','Giảm thu nhập tính thuế',item.taxDeductible)}</div><button class="btn small danger" type="button" data-remove-insurance="${index}">Xóa bảo hiểm</button></section>`).join('');taxHost.querySelectorAll('[data-remove-bracket]').forEach(button=>button.onclick=()=>{collect();brackets.splice(Number(button.dataset.removeBracket),1);dirty=true;renderArrays();});insuranceHost.querySelectorAll('[data-remove-insurance]').forEach(button=>button.onclick=()=>{collect();insurance.splice(Number(button.dataset.removeInsurance),1);dirty=true;renderArrays();});}renderArrays();
 form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});host.querySelector('[data-add-bracket]').onclick=()=>{collect();if(brackets.length>=30)return;brackets.push({upTo:'',rate:''});dirty=true;renderArrays();};host.querySelector('[data-add-insurance]').onclick=()=>{collect();if(insurance.length>=20)return;insurance.push({code:'',employeeRate:'',employerRate:'',baseFloor:'',baseCap:'',taxDeductible:false});dirty=true;renderArrays();};
 payrollBindForm(form,{alive,canSave:()=>editable&&grant(row?'canUpdate':'canNew',true),reload:async()=>{try{const fresh=row?(await payrollAllRows('salary-configuration','policies',{alive})).find(item=>item.id===row.id):null;if(row&&!fresh)throw Error('Không tìm thấy chính sách.');policyDialog(fresh);}catch(err){toast(err.message,{type:'error'});}},save:values=>{collect();const result={currencyCode:values.currencyCode,standardDays:values.standardDays?payrollDecimal(values.standardDays,{min:0.0001,max:31}):null,hoursPerDay:payrollDecimal(values.hoursPerDay,{min:0.0001,max:24}),roundingStep:payrollMoney(values.roundingStep),roundingMode:values.roundingMode,nightStart:values.nightStart.length===5?values.nightStart+':00':values.nightStart,nightEnd:values.nightEnd.length===5?values.nightEnd+':00':values.nightEnd,nightWorkPremiumRate:payrollDecimal(values.nightWorkPremiumRate,{max:10}),overtimeMultipliers:Object.fromEntries(Object.keys(salaryOvertimeKinds).map(key=>[key,payrollDecimal(values['ot-'+key],{min:0.0001,max:100})])),overtimeTaxMode:values.overtimeTaxMode,taxMode:values.taxMode,flatTaxRate:payrollDecimal(values.flatTaxRate,{max:1}),personalDeduction:payrollMoney(values.personalDeduction),dependentDeduction:payrollMoney(values.dependentDeduction),taxBrackets:brackets.map(item=>({upTo:item.upTo===''||item.upTo===null?null:payrollMoney(item.upTo),rate:payrollDecimal(item.rate,{max:1})})),insurance:insurance.map(item=>({code:String(item.code).trim(),employeeRate:payrollDecimal(item.employeeRate,{max:1}),employerRate:payrollDecimal(item.employerRate,{max:1}),baseFloor:payrollMoney(item.baseFloor),baseCap:item.baseCap===''||item.baseCap===null?null:payrollMoney(item.baseCap),taxDeductible:item.taxDeductible})),minimumPaidDaysForInsurance:payrollDecimal(values.minimumPaidDaysForInsurance,{max:31}),insuranceBaseMode:values.insuranceBaseMode,kpiPeriodType:values.kpiPeriodType,kpiScoreCap:payrollDecimal(values.kpiScoreCap,{min:0.0001,max:200}),...Object.fromEntries(['payPublicHolidays','includeLegacyAllowanceInOvertime','prorateKpiBonus'].map(key=>[key,form.elements.namedItem(key).checked]))};return apiCompensationSave('salary-configuration','policies',salaryPolicyPayload(values,result,row),row?.id??null);},onSaved:()=>{closeDialog();load();}});
 host.querySelector('[data-publish-policy]')?.addEventListener('click',()=>{if(dirty){toast('Lưu thay đổi chính sách trước khi phát hành.',{type:'error'});return;}publishPolicy(row);});
 });}
 function publishPolicy(row){return controller.dialog('Phát hành chính sách',async(host,alive)=>{const policies=await payrollAllRows('salary-configuration','policies',{alive});if(!alive())return;host.innerHTML=`<form class="payroll-form"><p>Phát hành <strong>${e(row.code)}</strong>? Chính sách đã phát hành không thể sửa quy tắc.</p>${payrollSelect('supersedePolicyId','Thay thế chính sách đang dùng',policies.filter(item=>item.status==='PUBLISHED'&&item.id!==row.id).map(item=>({id:item.id,label:item.code+' · '+item.name})),'',{empty:'Không thay thế'})}${payrollFooter(grant('canUpdate',true),'Phát hành')}</form>`;const form=host.querySelector('form');payrollBindForm(form,{alive,canSave:()=>grant('canUpdate',true),reload:()=>publishPolicy(row),save:values=>{const previous=values.supersedePolicyId?policies.find(item=>String(item.id)===values.supersedePolicyId):null;return apiPayrollPublishPolicy(row.id,{version:row.version,supersedePolicyId:previous?.id??null,supersedeVersion:previous?.version??null});},onSaved:()=>{closeDialog();load();}});});}
 shell();void metadata();return ()=>{++generation;clearTimeout(timer);controller.dispose();};
}


// Source: pages/payroll/payroll-management.js

function payrollPeriodCapabilities(row,{timesheets=false,session}={}){
 const grant=flag=>payrollGrant('WEB_PAYROLL',flag,{global:timesheets,session}),open=timesheets?['OPEN','DRAFT'].includes(row.status):['OPEN','REVIEW'].includes(row.status)&&row.approvalId==null;
 return {calculate:open&&grant('canUpdate'),adjust:!timesheets&&open&&grant('canUpdate'),submit:!timesheets&&row.status==='REVIEW'&&row.approvalId==null&&!!row.inputHash&&grant('canUpdate'),lock:(timesheets?row.status==='OPEN':row.status==='APPROVED')&&grant('canApprove'),paid:!timesheets&&row.status==='LOCKED'&&grant('canApprove')};
}
function payrollTimesheetCalculateNotice(row,session=apiSession()){
 if(!['OPEN','DRAFT'].includes(row.status))return '';
 const permission=session?.permissions?.find(item=>item.platform==='WEB'&&item.code==='WEB_PAYROLL'&&item.canView==='Y');
 if(permission?.canUpdate!=='Y')return 'Cần bật quyền Chỉnh sửa (UPDATE) của WEB_PAYROLL để tổng hợp công.';
 if(permission.dataScopes?.UPDATE!=null&&permission.dataScopes.UPDATE!=='ALL')return 'Tổng hợp công cần phạm vi Chỉnh sửa (UPDATE) là Tất cả (ALL).';
 return '';
}
function payrollApprovalCanDecide(period,approval,session=apiSession()){
 const request=approval?.request;
 return !!(payrollGrant('WEB_PAYROLL','canApprove',{session})&&session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y'&&p.canApprove==='Y')&&period.status==='REVIEW'&&request?.id===period.approvalId&&request.requestType==='PAYROLL_PERIOD'&&Number(request.referenceId??request.referenceID)===Number(period.id)&&request.status==='PENDING'&&session?.user?.userId&&request.requestedByUserId!==session.user.userId&&approval.steps?.some(step=>Number(step.stepNo)===Number(request.currentStepNo)&&step.approverUserId===session.user.userId&&step.decision==='PENDING'));
}
function payrollPaymentPayload(values,row){
 const reference=String(values.reference||'').trim();if(!reference||reference.length>150||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(values.paidAt||''))throw Error('Nhập mã chứng từ và thời gian thanh toán hợp lệ.');
 payrollDate(values.paidAt.slice(0,10));const paidAt=values.paidAt+(values.paidAt.length===16?':00':'')+'+07:00',instant=Date.parse(paidAt);if(!Number.isFinite(instant)||instant>Date.now())throw Error('Thời gian thanh toán không được trong tương lai.');if(row.lockedAt){const lock=/(?:Z|[+-]\d{2}:\d{2})$/i.test(row.lockedAt)?row.lockedAt:row.lockedAt+'Z';if(instant<Date.parse(lock))throw Error('Thời gian thanh toán phải sau thời điểm chốt.');}
 return {version:payrollId(row.version),reference,paidAt};
}
function payrollStatisticsMarkup(response=null,error=''){
 let data=null;if(response){data=payrollObject(response);if(!Number.isInteger(data.employees)||data.employees<0||!['gross','deductions','net'].every(key=>typeof data[key]==='number'&&Number.isFinite(data[key])))throw Error('Thống kê lương không hợp lệ.');}
 return `${error?`<p role="alert">${e(error)}</p>`:''}<div class="payroll-statistics">${[['employees','Số phiếu lương'],['gross','Tổng thu nhập'],['deductions','Tổng khấu trừ'],['net','Tổng thực lĩnh']].map(([key,label])=>`<article class="card"><span>${label}</span><strong>${data?e(key==='employees'?data[key]:payrollAmount(data[key],data.currencyCode)):'—'}</strong></article>`).join('')}</div>`;
}
function payrollPayslipMarkup(data){
 const {row,result}=data;if(!row||!result||!Array.isArray(result.lines))throw Error('Chi tiết phiếu lương không hợp lệ.');
 return `<h3>${e(row.employeeName)} · ${e(row.employeeCode)}</h3><p>${e(row.periodKey)} · ${payrollBadge(row.status)}</p><div class="payroll-detail-grid">${[['Lương cơ bản','baseSalary'],['Phụ cấp','allowances'],['Tiền tăng ca','overtimePay'],['Thưởng KPI','kpiBonus'],['Tổng thu nhập','gross'],['Thuế','tax'],['Bảo hiểm nhân viên','insurance'],['Bảo hiểm doanh nghiệp','employerInsurance'],['Khấu trừ','deductions'],['Thực lĩnh','net']].map(([label,key])=>`<div><span>${label}</span><strong>${e(payrollAmount(result[key],row.currencyCode))}</strong></div>`).join('')}</div><div class="table-wrap"><table><thead><tr><th>Khoản</th><th>Loại</th><th>Số tiền</th><th>Căn cứ tính</th></tr></thead><tbody>${result.lines.map(line=>`<tr><td><strong>${e(line.code)}</strong><small>${e(line.name)}</small></td><td>${line.kind==='EARNING'?'Thu nhập':'Khấu trừ'}</td><td>${e(payrollAmount(line.amount,row.currencyCode))}</td><td>${e(line.formula)}</td></tr>`).join('')}</tbody></table></div>`;
}

function payrollXlsxZip(files){
 const encoder=new TextEncoder(),parts=[],central=[];let offset=0;
 const crc=bytes=>{let value=0xffffffff;for(const byte of bytes){value^=byte;for(let bit=0;bit<8;bit++)value=(value>>>1)^((value&1)?0xedb88320:0);}return (value^0xffffffff)>>>0;};
 const header=(length,values)=>{const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);for(const [at,value,size] of values)size===2?view.setUint16(at,value,true):view.setUint32(at,value,true);return bytes;};
 for(const [path,text] of Object.entries(files)){
  const name=encoder.encode(path),data=encoder.encode(text),checksum=crc(data);
  const local=header(30,[[0,0x04034b50,4],[4,20,2],[14,checksum,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);
  parts.push(local,name,data);
  central.push(header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[16,checksum,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]),name);
  offset+=local.length+name.length+data.length;
 }
 const centralLength=central.reduce((sum,part)=>sum+part.length,0),count=Object.keys(files).length;
 parts.push(...central,header(22,[[0,0x06054b50,4],[8,count,2],[10,count,2],[12,centralLength,4],[16,offset,4]]));
 const output=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let position=0;for(const part of parts){output.set(part,position);position+=part.length;}return output;
}
function payrollTimesheetWorkbook(periodKey,rows){
 if(!Array.isArray(rows)||!rows.length)throw Error('Bảng công chưa có dữ liệu để xuất. Vui lòng tổng hợp công trước.');
 const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
 const headings=['Kỳ công','Mã nhân viên','Họ tên','Công làm','Phép hưởng lương','Tăng ca (giờ)','Trễ (phút)'];
 const values=[headings,...rows.map(item=>[periodKey,item.employeeCode,item.fullName||item.employeeName,...['workedDays','paidLeaveDays','overtimeHours','lateMinutes'].map(key=>item[key])])];
 const body=values.map((row,index)=>`<row r="${index+1}">${row.map((value,column)=>{const ref=String.fromCharCode(65+column)+(index+1),numeric=index>0&&column>=3&&value!=null&&value!==''&&Number.isFinite(Number(value));return numeric?`<c r="${ref}"><v>${Number(value)}</v></c>`:`<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('');
 return payrollXlsxZip({
 '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Bảng công" sheetId="1" r:id="rId1"/></sheets></workbook>',
 'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
 'xl/worksheets/sheet1.xml':'<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="2" width="18" customWidth="1"/><col min="3" max="3" width="32" customWidth="1"/><col min="4" max="7" width="20" customWidth="1"/></cols><sheetData>'+body+'</sheetData><autoFilter ref="A1:G'+values.length+'"/></worksheet>'
 });
}

function payrollNoAttendanceWarnings(rows){
 const warnings=[],seen=new Set();
 for(const [index,row] of rows.entries()){
 const snapshot=payrollJson(row.snapshotJson,null);if(!snapshot||!Array.isArray(snapshot.days))continue;
 for(const day of snapshot.days){
 const noAttendance=day.scheduleId!=null&&day.workedMinutes===0&&(day.payableWorkedMinutes??0)===0&&day.paidLeave===0&&day.unpaidLeave===0;
 if(!noAttendance)continue;const key=String(row.employeeCode||snapshot.employeeId||index)+':'+day.date;if(seen.has(key))continue;seen.add(key);warnings.push({employeeCode:row.employeeCode,employeeName:row.fullName||row.employeeName,date:day.date});
 }}return warnings;
}
function payrollNoAttendanceMarkup(rows){
 const warnings=payrollNoAttendanceWarnings(rows);return warnings.length?`<section class="payroll-warnings" data-timesheet-no-attendance><h3>Không chấm công (${warnings.length})</h3><ul>${warnings.map(item=>`<li><strong>${item.employeeCode?'Mã nhân viên: '+e(item.employeeCode):'Chưa có mã nhân viên'}${item.employeeName?' · '+e(item.employeeName):''}</strong> · Ngày ${e(dateLabel(item.date))}</li>`).join('')}</ul></section>`:'';
}

function payrollPinDetail(host){
 host.dataset.payrollScroll='';const toolbar=document.createElement('div'),content=document.createElement('div');toolbar.className='payroll-detail-toolbar';content.className='payroll-detail-scroll';
 const heading=host.querySelector('.payroll-period-heading'),form=host.querySelector('form.payroll-form'),adjustment=host.querySelector('[data-new-adjustment]'),approval=host.querySelector('[data-payroll-approval]');
 if(heading){const scope=heading.nextElementSibling;if(scope?.matches('[data-period-scope]'))heading.appendChild(scope);toolbar.appendChild(heading);}if(form)toolbar.appendChild(form);const actions=form?.querySelector('.form-actions');if(adjustment&&actions)actions.appendChild(adjustment);if(approval&&actions){const paragraph=approval.parentElement;actions.appendChild(approval);if(paragraph?.tagName==='P')paragraph.remove();}
 while(host.firstChild)content.appendChild(host.firstChild);host.append(toolbar,content);
}

function mountPayrollManagement(root,{timesheets=false}={}){
 const screen='WEB_PAYROLL';if(!root)return ()=>{};if(!payrollGrant(screen)){root.innerHTML='<p>Bạn cần quyền WEB_PAYROLL/VIEW.</p>';return ()=>{};}
 const routeQuery=new URLSearchParams(globalThis.location?.hash?.split('?')[1]||''),requestedPeriodId=Number(routeQuery.get('periodId'));
 const controller=payrollController(root),active=controller.active;let periodOptions=[],tab=timesheets?'timesheets':requestedPeriodId>0?'periods':'payslips',page=1,filters={},generation=0,timer,org={departments:[],teams:[],components:[]};const grant=(flag,global=false)=>payrollGrant(screen,flag,{global});
 function shell(){root.innerHTML=`${timesheets?'':`<div class="tabs"><button class="tab ${tab==='payslips'?'active':''}" type="button" data-payroll-tab="payslips">Phiếu lương</button><button class="tab ${tab==='periods'?'active':''}" type="button" data-payroll-tab="periods">Kỳ lương</button></div>`}<form class="payroll-filters" data-payroll-filters>${!timesheets?`${payrollSelect('periodKey','Chọn kỳ lương',periodOptions,filters.periodKey||'',{empty:'Tất cả kỳ lương'})}${payrollSelect('departmentId','Phòng ban',org.departments,filters.departmentId||'',{empty:'Tất cả phòng ban'})}${tab==='payslips'?`${payrollSelect('teamId','Team',org.teams,filters.teamId||'',{empty:'Tất cả team'})}<label>Tìm nhân viên<input type="search" name="search" maxlength="150" value="${e(filters.search||'')}" placeholder="Mã hoặc tên nhân viên"></label>`:''}${payrollSelect('status','Trạng thái',Object.entries(payrollStatuses).filter(([id])=>!['DRAFT','PUBLISHED'].includes(id)).map(([id,label])=>({id,label})),filters.status||'',{empty:'Tất cả trạng thái'})}<button class="btn" type="submit">Lọc</button>`:''}<button class="btn" type="button" data-payroll-refresh>Làm mới</button>${(timesheets||tab==='periods')&&grant('canNew',timesheets)?`<button class="btn primary" type="button" data-payroll-new>Tạo ${timesheets?'bảng công':'kỳ lương'}</button>`:''}${!timesheets&&tab==='payslips'&&grant('canExport')?'<button class="btn" type="button" data-payroll-export>Xuất Excel</button>':''}</form><p role="alert" data-payroll-lookup-error></p><div data-payroll-stats></div><div data-payroll-content></div><div class="user-pagination" data-payroll-pages></div>`;
 root.querySelectorAll('[data-payroll-tab]').forEach(button=>button.onclick=()=>{clearTimeout(timer);++generation;tab=button.dataset.payrollTab;page=1;filters={};shell();});const form=root.querySelector('form');function apply(){filters=Object.fromEntries([...new FormData(form)].filter(([,value])=>String(value).trim()));page=1;load();}form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(timer);apply();};form.elements.search?.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(apply,300);});for(const key of ['periodKey','status','teamId'])form.elements.namedItem(key)?.addEventListener('change',apply);form.elements.departmentId?.addEventListener('change',()=>{if(form.elements.teamId){form.elements.teamId.innerHTML='<option value="">Tất cả team</option>'+org.teams.filter(item=>!form.elements.departmentId.value||String(item.departmentId)===form.elements.departmentId.value).map(item=>`<option value="${item.id}">${e(item.name)}</option>`).join('');}apply();});
 root.querySelector('[data-payroll-refresh]').onclick=load;root.querySelector('[data-payroll-new]')?.addEventListener('click',createPeriod);root.querySelector('[data-payroll-export]')?.addEventListener('click',async event=>{if(!grant('canExport'))return;const button=event.currentTarget;button.disabled=true;try{const blob=await apiPayrollExport(filters),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='payroll.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất bảng lương.');}catch(err){toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}});void load();}
 async function load(){if(!active())return;const current=++generation,resource=tab,content=root.querySelector('[data-payroll-content]'),pages=root.querySelector('[data-payroll-pages]'),stats=root.querySelector('[data-payroll-stats]');content.innerHTML='<p role="status">Đang tải dữ liệu…</p>';pages.innerHTML='';stats.innerHTML=resource==='payslips'?payrollStatisticsMarkup():'';
 const listTask=apiCompensationList('payroll',resource,{...filters,page,pageSize:20}).then(response=>{if(!active()||current!==generation)return;const result=payrollPageData(response);const headers=resource==='payslips'?['Nhân viên','Phòng ban / Team','Tháng','Thu nhập','Khấu trừ','Thực lĩnh','Trạng thái','']:['Tháng',...(timesheets?[]:['Phạm vi']),'Trạng thái',''];content.innerHTML=`<div class="table-wrap"><table><thead><tr>${headers.map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${result.data.map((row,index)=>`<tr>${resource==='payslips'?`<td><strong>${e(row.employeeName)}</strong><small>${e(row.employeeCode)}</small></td><td>${e(row.departmentName)}<small>${e(row.teamName||'—')}</small></td><td>${e(row.periodKey)}</td><td>${e(payrollAmount(row.gross,row.currencyCode))}</td><td>${e(payrollAmount(row.deductions,row.currencyCode))}</td><td><strong>${e(payrollAmount(row.net,row.currencyCode))}</strong></td>`:`<td><strong>${e(row.periodKey)}</strong></td>${timesheets?'':`<td>${row.departmentId?e(org.departments.find(item=>item.id===row.departmentId)?.name||'Phòng ban #'+row.departmentId):'Toàn công ty'}</td>`}`}<td>${payrollBadge(row.status)}${row.approvalId?`<small>Yêu cầu duyệt #${e(row.approvalId)}</small>`:''}</td><td><button class="btn small" type="button" data-payroll-detail="${index}">Chi tiết</button></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p class="empty">Chưa có dữ liệu theo bộ lọc.</p>'}`;content.querySelectorAll('[data-payroll-detail]').forEach(button=>button.onclick=()=>{const row=result.data[Number(button.dataset.payrollDetail)];if(resource==='payslips')payslipDialog(row.id);else periodDialog(row);});payrollPagination(pages,{page,total:result.total,onPage:next=>{page=next;load();}});}).catch(err=>{if(active()&&current===generation){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}});
 const statsTask=resource==='payslips'?apiPayrollStatistics(filters).then(response=>{if(active()&&current===generation)stats.innerHTML=payrollStatisticsMarkup(response);}).catch(err=>{if(active()&&current===generation)stats.innerHTML=payrollStatisticsMarkup(null,err.message);}):Promise.resolve();await Promise.allSettled([listTask,statsTask]);}
 async function metadata(){try{const result=await apiCompensationLookups('payroll');if(!active())return;if(!['departments','teams','components'].every(key=>Array.isArray(result[key])))throw Error('Danh mục lương không hợp lệ.');org=result;const form=root.querySelector('form');for(const key of ['departmentId','teamId']){const select=form.elements.namedItem(key);if(!select)continue;const value=select.value;select.innerHTML='<option value="">Tất cả</option>'+org[key==='departmentId'?'departments':'teams'].map(item=>`<option value="${item.id}">${e(item.name)}</option>`).join('');select.value=value;}}catch(err){if(active())root.querySelector('[data-payroll-lookup-error]').textContent=err.message;}}
 async function freshPeriod(row,alive=active){const rows=await payrollAllRows('payroll',timesheets?'timesheets':'periods',{filters:timesheets?{}:{periodKey:row.periodKey},alive});const found=rows.find(item=>item.id===row.id);if(!found)throw Error('Không tìm thấy kỳ trong phạm vi quyền hiện tại.');return found;}
 function createPeriod(){return controller.dialog(timesheets?'Tạo bảng công tháng':'Tạo kỳ lương',async(host,alive)=>{if(!alive())return;host.innerHTML=`<form class="payroll-form"><div class="form-grid">${field('Tháng','periodKey','month',payrollLocalDate().slice(0,7),'required')}${timesheets?'':payrollSelect('departmentId','Phạm vi kỳ lương',org.departments,'',{empty:grant('canNew',true)?'Toàn công ty':'Chọn phòng ban',required:!grant('canNew',true)})}</div>${timesheets?'':'<p class="muted">Bảng công tháng phải được tổng hợp và chốt trước khi tạo kỳ lương.</p>'}${payrollFooter(grant('canNew',timesheets),'Tạo')}</form>`;const form=host.querySelector('form');payrollBindForm(form,{alive,canSave:()=>grant('canNew',timesheets),reload:createPeriod,save:values=>apiCompensationSave('payroll',timesheets?'timesheets':'periods',{periodKey:payrollMonth(values.periodKey),...(timesheets?{}:{departmentId:values.departmentId?payrollId(values.departmentId):null})}),onSaved:response=>{closeDialog();if(!timesheets)tab='periods';shell();periodDialog(payrollObject(response));}});});}
 function payslipDialog(id){return controller.dialog('Chi tiết phiếu lương',async(host,alive)=>{const data=payrollObject(await apiPayrollDetail('payslips',id));if(!alive())return;host.innerHTML=payrollPayslipMarkup(data);});}
 function timesheetRowDialog(row,parentPeriod){return controller.dialog('Chi tiết công nhân viên',async(host,alive)=>{if(!alive())return;const snapshot=payrollJson(row.snapshotJson,null);if(!snapshot)throw Error('Dữ liệu công cũ chưa được xác nhận. Cần đối soát trước khi sử dụng.');host.innerHTML=`<div class="payroll-period-heading"><div><h3>${e(row.fullName)} · ${e(row.employeeCode)}</h3><p class="muted">Kỳ công ${e(parentPeriod.periodKey)}</p></div><button class="btn" type="button" data-payroll-back>← Quay lại chi tiết bảng công</button></div>${payrollIssues(snapshot.errors)}${(snapshot.warnings||[]).length?`<section class="payroll-warnings"><h3>Cảnh báo</h3>${snapshot.warnings.map(item=>`<p>${e(payrollIssueMessage(item))}</p>`).join('')}</section>`:''}<div class="table-wrap"><table><thead><tr><th>Ngày</th><th>Phút chuẩn</th><th>Phút làm</th><th>Phép hưởng lương</th><th>Phép không lương</th><th>Đi trễ (phút)</th></tr></thead><tbody>${(snapshot.days||[]).map(day=>`<tr><td>${e(dateLabel(day.date))}</td><td>${e(day.scheduledMinutes)}</td><td>${e(day.workedMinutes)}</td><td>${e(day.paidLeave)}</td><td>${e(day.unpaidLeave)}</td><td>${e(day.lateMinutes)}</td></tr>`).join('')}</tbody></table></div>`;payrollPinDetail(host);host.querySelector('[data-payroll-back]').onclick=()=>periodDialog(parentPeriod);});}
 function periodDialog(initial){return controller.dialog(timesheets?'Chi tiết bảng công':'Chi tiết kỳ lương',async(host,alive)=>{
 const row=await freshPeriod(initial,alive);const data=timesheets?payrollObject(await apiPayrollDetail('timesheets',row.id)):null;const policies=!timesheets&&['OPEN','REVIEW'].includes(row.status)?await payrollAllRows('payroll','policies',{alive}):[];
 let issueEmployees=[],issueEmployeeError='';const issues=payrollJson(row.errorsJson,[]);if(Array.isArray(issues)&&issues.some(issue=>issue.employeeId&&!issue.employeeCode)){try{issueEmployees=await payrollAllRows('payroll','employees',{alive});}catch(err){issueEmployeeError='Chưa tải được mã nhân viên: '+err.message;}}if(!alive())return;const capabilities=payrollPeriodCapabilities(row,{timesheets}),calculateNotice=timesheets?payrollTimesheetCalculateNotice(row):'',hasAction=Object.values(capabilities).some(Boolean),resource=timesheets?'timesheets':'periods';let operationKey=payrollOperationKey();
 host.innerHTML=`<div class="payroll-period-heading"><h3>${e(row.periodKey)}</h3>${payrollBadge(row.status)}</div>${!timesheets?`<p data-period-scope>${row.departmentId?e(org.departments.find(item=>item.id===row.departmentId)?.name||'Phòng ban #'+row.departmentId):'Toàn công ty'}</p>`:''}${payrollIssues(row.errorsJson,issueEmployees)}${issueEmployeeError?`<p role="alert">${e(issueEmployeeError)}</p><button class="btn" type="button" data-payroll-reload-employees>Tải lại mã nhân viên</button>`:''}${row.approvalId?`<p><a class="btn" data-payroll-approval href="#/approvals?module=PAYROLL&approvalId=${row.approvalId}">Theo dõi phê duyệt #${e(row.approvalId)}</a></p>`:''}${timesheets?payrollNoAttendanceMarkup(data.data||[]):''}${timesheets?`<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Công làm</th><th>Phép hưởng lương</th><th>Tăng ca (giờ)</th><th>Trễ (phút)</th><th></th></tr></thead><tbody>${(data.data||[]).map((item,index)=>`<tr><td><strong>${e(item.fullName)}</strong><small>${e(item.employeeCode)}</small></td><td>${e(item.workedDays)}</td><td>${e(item.paidLeaveDays)}</td><td>${e(item.overtimeHours)}</td><td>${e(item.lateMinutes)}</td><td><button class="btn small" type="button" data-timesheet-person="${index}">Theo ngày</button></td></tr>`).join('')}</tbody></table></div>${data.data?.length?'':'<p class="empty">Chưa có dữ liệu công trong phạm vi quyền. Tổng hợp trước khi chốt.</p>'}`:''}<form class="payroll-form">${capabilities.calculate&&!timesheets?payrollSelect('policyId','Chính sách áp dụng',policies.filter(policy=>policy.status==='PUBLISHED'&&policy.effectiveFrom<=row.periodKey+'-01'&&(!policy.effectiveTo||policy.effectiveTo>=new Date(Date.UTC(Number(row.periodKey.slice(0,4)),Number(row.periodKey.slice(5,7)),0)).toISOString().slice(0,10))).map(policy=>({id:policy.id,label:policy.code+' · '+policy.name})),row.policyId||'',{empty:'Tự chọn nếu chỉ có một chính sách phù hợp'}):''}${calculateNotice?`<p class="muted" data-timesheet-calculate-notice>${e(calculateNotice)}</p>`:''}<div class="form-actions">${capabilities.calculate||timesheets&&['OPEN','DRAFT'].includes(row.status)?`<button class="btn primary" type="submit" value="calculate" ${capabilities.calculate?'':`disabled title="${e(calculateNotice)}"`}>${timesheets?'Tổng hợp công':'Tính lương'}</button>`:''}${capabilities.submit?'<button class="btn" type="submit" value="submit">Gửi phê duyệt</button>':''}${capabilities.lock?`<button class="btn" type="submit" value="lock">${timesheets?'Chốt công':'Phát hành bảng lương'}</button>`:''}${!timesheets?'<button class="btn" type="button" data-period-payslips>Xem chi tiết phiếu lương</button>':''}${capabilities.paid?'<button class="btn primary" type="button" data-payment>Ghi nhận thanh toán</button>':''}${timesheets&&grant('canExport')?'<button class="btn" type="button" data-timesheet-export>Xuất Excel</button>':''}<button class="btn" type="button" data-payroll-reload>Tải lại</button></div><p role="alert" data-payroll-feedback></p></form>${!timesheets?'<section data-period-adjustments><h3>Điều chỉnh thu nhập / Khấu trừ</h3><div data-adjustment-list></div></section>':''}${capabilities.adjust?'<button class="btn" type="button" data-new-adjustment>Thêm điều chỉnh</button>':''}`;
 payrollPinDetail(host);
 if(!timesheets&&row.approvalId)void loadPeriodApproval(row,host,alive);
 host.querySelector('[data-period-payslips]')?.addEventListener('click',()=>{if(!alive())return;closeDialog();tab='payslips';page=1;filters={periodKey:row.periodKey,...(row.departmentId?{departmentId:row.departmentId}:{})};shell();});
 host.querySelector('[data-timesheet-export]')?.addEventListener('click',async event=>{if(!grant('canExport')||!alive())return;const button=event.currentTarget;button.disabled=true;try{const latest=payrollObject(await apiPayrollDetail('timesheets',row.id));if(!grant('canExport'))return;const blob=new Blob([payrollTimesheetWorkbook(row.periodKey,latest.data)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});if(!alive())return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='bang-cong-'+row.periodKey+'.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất Excel kỳ '+row.periodKey+'.');}catch(err){if(alive())toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}});
 host.querySelector('[data-payroll-reload-employees]')?.addEventListener('click',()=>periodDialog(row));host.querySelector('[data-payroll-approval]')?.addEventListener('click',closeDialog);host.querySelectorAll('[data-timesheet-person]').forEach(button=>button.onclick=()=>timesheetRowDialog(data.data[Number(button.dataset.timesheetPerson)],row));const form=host.querySelector('form');form.oninput=()=>{operationKey=payrollOperationKey();};form.onchange=()=>{operationKey=payrollOperationKey();};
 payrollBindForm(form,{alive,canSave:()=>hasAction,reload:()=>periodDialog(row),save:async(values,action)=>{const current=payrollPeriodCapabilities(row,{timesheets});if(!['calculate','submit','lock'].includes(action)||!current[action])throw Error('Thao tác không hợp lệ với trạng thái hoặc quyền hiện tại.');if(action==='lock'){const accepted=await confirmDialog({title:timesheets?'Chốt bảng công?':'Phát hành bảng lương?',message:timesheets?'Sau khi chốt, dữ liệu công tháng này không thể thay đổi.':'Chốt sẽ phát hành phiếu lương cho nhân viên. Kỳ đã chốt không thể mở lại.',confirmLabel:timesheets?'Chốt công':'Phát hành'});if(!accepted||!alive())return null;}return apiPayrollAction(resource,row.id,action,{version:row.version,...(action==='calculate'?{requestKey:operationKey,...(!timesheets&&values.policyId?{policyId:payrollId(values.policyId)}:{})}:{})});},onSaved:async()=>{void load();await periodDialog(row);},success:'Đã cập nhật kỳ.'});
 host.querySelector('[data-payment]')?.addEventListener('click',()=>paymentDialog(row));host.querySelector('[data-new-adjustment]')?.addEventListener('click',()=>adjustmentDialog(row));if(!timesheets)void loadAdjustments(row,host,alive,capabilities.adjust);
 });}
 async function loadPeriodApproval(row,host,alive){
 const panel=document.createElement('section');panel.dataset.payrollDecision='';panel.className='payroll-approval-panel';host.querySelector('.payroll-detail-scroll').prepend(panel);
 if(!apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y'))return;
 async function fetchApproval(){
 panel.innerHTML='<p role="status">Đang tải phê duyệt kỳ lương…</p>';
 try{
 const approval=await apiWorkflowDetail('all',row.approvalId);if(!alive())return;
 const request=approval?.request;if(request?.id!==row.approvalId||request.requestType!=='PAYROLL_PERIOD'||Number(request.referenceId??request.referenceID)!==Number(row.id)||!Array.isArray(approval.steps))throw Error('Thông tin phê duyệt không khớp kỳ lương.');
 panel.innerHTML=`<h3>Phê duyệt kỳ lương</h3>${payrollApprovalCanDecide(row,approval)?'<form class="payroll-form" data-payroll-decision-form><label>Lý do / Nhận xét<textarea name="reason" rows="3" placeholder="Nhập lý do hoặc nhận xét phê duyệt…" required maxlength="1000"></textarea></label><div class="form-actions"><button class="btn danger" type="submit" value="reject">Từ chối</button><button class="btn primary" type="submit" value="approve">Phê duyệt</button></div><p role="alert"></p></form>':'<p class="muted">Chỉ người được phân công ở bước đang chờ và có quyền phê duyệt mới được duyệt kỳ lương.</p>'}`;
 const form=panel.querySelector('form');if(!form)return;let busy=false,stale=false;
 form.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||stale)return;const feedback=form.querySelector('[role=alert]'),action=event.submitter?.value,reason=form.elements.reason.value.trim();
 if(!payrollApprovalCanDecide(row,approval)||!['approve','reject'].includes(action)){feedback.textContent='Bạn không có quyền duyệt ở bước hiện tại.';return;}if(!reason||reason.length>1000){feedback.textContent='Nhập lý do hoặc nhận xét, tối đa 1000 ký tự.';return;}
 busy=true;form.querySelectorAll('button,textarea').forEach(control=>control.disabled=true);
 try{await apiWorkflowAction('all',request.id,action,{version:request.version,reason});if(!alive())return;toast(action==='approve'?'Đã phê duyệt kỳ lương.':'Đã từ chối kỳ lương.');void load();await periodDialog(row);}
 catch(err){stale=err.status===409;if(alive())feedback.textContent=err.message+(stale?' Tải lại chi tiết kỳ lương trước khi tiếp tục.':'');}
 finally{busy=false;if(alive())form.querySelectorAll('button,textarea').forEach(control=>control.disabled=stale);}
 };
 }catch(err){if(alive()){panel.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Tải lại phê duyệt</button>`;panel.querySelector('button').onclick=fetchApproval;}}
 }
 await fetchApproval();
 }
 async function loadAdjustments(row,host,alive,editable){const target=host.querySelector('[data-adjustment-list]');target.innerHTML='<p role="status">Đang tải điều chỉnh…</p>';try{const rows=payrollObject(await apiPayrollAdjustments(row.id));if(!alive())return;if(!Array.isArray(rows))throw Error('Danh sách điều chỉnh không hợp lệ.');target.innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Khoản</th><th>Số tiền</th><th>Lý do</th><th>Trạng thái</th><th></th></tr></thead><tbody>${rows.map((item,index)=>{const component=payrollJson(item.componentSnapshotJson,{});return `<tr><td>#${e(item.employeeId)}</td><td>${e(component.code)} · ${e(component.name)}</td><td>${e(payrollAmount(item.amount))}</td><td>${e(item.reason)}</td><td>${item.isCancelled?'Đã hủy':'Đang áp dụng'}</td><td>${editable&&!item.isCancelled?`<button class="btn small danger" type="button" data-cancel-adjustment="${index}">Hủy khoản</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`:'<p class="muted">Chưa có điều chỉnh.</p>';target.querySelectorAll('[data-cancel-adjustment]').forEach(button=>button.onclick=()=>cancelAdjustmentDialog(row,rows[Number(button.dataset.cancelAdjustment)]));}catch(err){if(alive()){target.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;target.querySelector('button').onclick=()=>loadAdjustments(row,host,alive,editable);}}}
 function adjustmentDialog(period){return controller.dialog('Thêm điều chỉnh lương',async(host,alive)=>{const lookup=await apiCompensationLookups('payroll');if(!alive())return;let requestKey=payrollOperationKey();host.innerHTML=`<form class="payroll-form"><div data-adjustment-employee></div><div class="form-grid">${payrollSelect('componentId','Khoản thu nhập / khấu trừ',(lookup.components||[]).filter(item=>item.isActive).map(item=>({id:item.id,label:item.code+' · '+item.name})),'',{required:true})}${field('Số tiền','amount','number','','required min="0.01" max="1000000000000" step="0.01"')}</div><label>Lý do<textarea name="reason" maxlength="1000" required></textarea></label>${payrollFooter(grant('canUpdate'),'Thêm điều chỉnh')}</form>`;const form=host.querySelector('form'),picker=payrollEmployeePicker(host.querySelector('[data-adjustment-employee]'),{area:'payroll',alive});form.oninput=()=>{requestKey=payrollOperationKey();};form.onchange=()=>{requestKey=payrollOperationKey();};payrollBindForm(form,{alive,canSave:()=>grant('canUpdate'),reload:()=>adjustmentDialog(period),save:values=>{const amount=payrollMoney(values.amount),reason=values.reason.trim();if(amount<=0||!reason||reason.length>1000)throw Error('Nhập số tiền dương và lý do điều chỉnh.');return apiPayrollAdjustments(period.id,{employeeId:picker.id(),componentId:payrollId(values.componentId),amount,reason,requestKey});},onSaved:()=>{void load();periodDialog(period);}});});}
 function cancelAdjustmentDialog(period,adjustment){return controller.dialog('Hủy khoản điều chỉnh',async(host,alive)=>{if(!alive())return;host.innerHTML=`<form class="payroll-form"><p>Hủy khoản điều chỉnh này? Lịch sử vẫn được giữ và kỳ lương cần tính lại.</p>${payrollFooter(grant('canUpdate'),'Hủy khoản')}</form>`;payrollBindForm(host.querySelector('form'),{alive,canSave:()=>grant('canUpdate'),reload:()=>periodDialog(period),save:()=>apiPayrollCancelAdjustment(period.id,adjustment.id,adjustment.version),onSaved:()=>{void load();periodDialog(period);}});});}
 function paymentDialog(period){return controller.dialog('Ghi nhận thanh toán',async(host,alive)=>{if(!alive())return;host.innerHTML=`<form class="payroll-form"><p>Kỳ ${e(period.periodKey)} đã chốt. Chỉ ghi nhận khi có chứng từ thanh toán.</p><div class="form-grid">${field('Mã chứng từ / Giao dịch','reference','text','','required maxlength="150"')}${field('Thời gian thanh toán (giờ Việt Nam)','paidAt','datetime-local','','required step="1"')}</div>${payrollFooter(grant('canApprove'),'Xác nhận đã thanh toán')}</form>`;const form=host.querySelector('form');payrollBindForm(form,{alive,canSave:()=>payrollPeriodCapabilities(period).paid,reload:()=>periodDialog(period),save:values=>apiPayrollAction('periods',period.id,'paid',payrollPaymentPayload(values,period)),onSaved:()=>{void load();periodDialog(period);},success:'Đã ghi nhận thanh toán.'});});}
 shell();if(!timesheets){void metadata();void payrollAllRows('payroll','periods',{alive:active}).then(rows=>{if(!active())return;periodOptions=[...new Set(rows.map(row=>row.periodKey))].sort().reverse().map(key=>({id:key,label:key}));const select=root.querySelector('[name=periodKey]');if(select){select.innerHTML='<option value="">Tất cả kỳ lương</option>'+periodOptions.map(item=>`<option value="${e(item.id)}">${e(item.label)}</option>`).join('');select.value=filters.periodKey||'';}}).catch(err=>{if(active())root.querySelector('[data-payroll-lookup-error]').textContent=err.message;});if(Number.isSafeInteger(requestedPeriodId)&&requestedPeriodId>0)void periodDialog({id:requestedPeriodId});}return ()=>{++generation;clearTimeout(timer);controller.dispose();};
}


// Source: pages/my-workspace/my-payslips.js

function myPayslipRowValid(row,session=apiSession()){
 return !!row&&Number.isSafeInteger(row.id)&&row.id>0&&Number.isSafeInteger(row.employeeId)&&row.employeeId>0&&session?.user?.employeeId!=null&&String(row.employeeId)===String(session.user.employeeId)&&['LOCKED','PAID'].includes(row.status)&&['gross','deductions','net'].every(key=>typeof row[key]==='number'&&Number.isFinite(row[key]))&&/^[A-Z]{3}$/.test(row.currencyCode||'');
}
function myPayslipPage(response,session=apiSession()){const result=payrollPageData(response);if(result.data.some(row=>!myPayslipRowValid(row,session)))throw Error('Danh sách phiếu lương cá nhân không hợp lệ.');return result;}
function myPayslipDetail(response,session=apiSession()){const data=payrollObject(response);if(!myPayslipRowValid(data.row,session)||!data.result||!Array.isArray(data.result.lines)||data.snapshot!=null)throw Error('Chi tiết phiếu lương cá nhân không hợp lệ.');return data;}
function mountMyPayslips(root){
 const screen='WEB_MY_PAYSLIPS';if(!root)return ()=>{};if(!payrollGrant(screen)){root.innerHTML='<p>Bạn cần quyền WEB_MY_PAYSLIPS/VIEW để xem phiếu lương của mình.</p>';return ()=>{};}
 if(apiSession()?.user?.employeeId==null){root.innerHTML='<p>Tài khoản chưa liên kết hồ sơ nhân viên. Vui lòng liên hệ quản trị viên để xem phiếu lương.</p>';return ()=>{};}
 const requestedPeriodId=Number(new URLSearchParams(globalThis.location?.hash?.split('?')[1]||'').get('periodId'));let requestedPeriodOpened=false;
 const controller=payrollController(root),active=controller.active;let page=1,filters={},generation=0;
 root.innerHTML=`<form class="payroll-filters" data-my-payslip-filters>${payrollSelect('periodKey','Chọn kỳ lương',[],'',{empty:'Tất cả kỳ lương'})}${payrollSelect('status','Trạng thái',[{id:'LOCKED',label:'Đã chốt'},{id:'PAID',label:'Đã thanh toán'}],'',{empty:'Tất cả trạng thái'})}<button class="btn" type="submit">Lọc</button><button class="btn" type="button" data-my-payslip-refresh>Làm mới</button></form><p role="status" data-my-payslip-period-feedback></p><div data-my-payslip-content></div><div class="user-pagination" data-my-payslip-pages></div>`;
 const form=root.querySelector('form'),content=root.querySelector('[data-my-payslip-content]'),pagination=root.querySelector('[data-my-payslip-pages]');
 function apply(){filters=Object.fromEntries([...new FormData(form)].filter(([,value])=>value));page=1;load();}form.onsubmit=event=>{event.preventDefault();event.stopPropagation();apply();};form.elements.periodKey.onchange=apply;form.elements.status.onchange=apply;root.querySelector('[data-my-payslip-refresh]').onclick=()=>{void load();void loadPeriods();};
 async function loadPeriods(){
 const feedback=root.querySelector('[data-my-payslip-period-feedback]');
 try{
 const periods=new Set();let requestedPayslip=null;for(let currentPage=1;active();currentPage++){
 const result=myPayslipPage(await apiMyPayslips({page:currentPage,pageSize:100}));if(!active())return;
 for(const row of result.data){if(row.periodKey)periods.add(row.periodKey);if(Number.isSafeInteger(requestedPeriodId)&&requestedPeriodId>0&&Number(row.payrollPeriodId)===requestedPeriodId)requestedPayslip=row;}
 if(currentPage*100>=result.total)break;if(!result.data.length)throw Error('Chưa tải đủ danh sách kỳ lương.');
 }
 if(!active())return;const select=form.elements.periodKey;select.innerHTML='<option value="">Tất cả kỳ lương</option>'+[...periods].sort().reverse().map(key=>`<option value="${e(key)}">${e(key)}</option>`).join('');select.value=filters.periodKey||'';feedback.textContent='';
 if(Number.isSafeInteger(requestedPeriodId)&&requestedPeriodId>0&&!requestedPeriodOpened){requestedPeriodOpened=true;if(requestedPayslip){filters={periodKey:requestedPayslip.periodKey};page=1;select.value=requestedPayslip.periodKey;void load();await detail(requestedPayslip.id);}else feedback.textContent='Chưa có phiếu lương của bạn trong kỳ được thông báo.';}
 }catch(err){if(active()){feedback.innerHTML=`${e(err.message)} <button class="btn small" type="button">Tải lại kỳ lương</button>`;feedback.querySelector('button').onclick=loadPeriods;}}
 }
 async function load(){if(!active())return;const current=++generation;content.innerHTML='<p role="status">Đang tải phiếu lương của bạn…</p>';pagination.innerHTML='';try{const result=myPayslipPage(await apiMyPayslips({...filters,page,pageSize:20}));if(!active()||current!==generation)return;content.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Kỳ lương</th><th>Nhân viên</th><th>Thu nhập</th><th>Khấu trừ</th><th>Thực lĩnh</th><th>Trạng thái</th><th></th></tr></thead><tbody>${result.data.map((row,index)=>`<tr><td><strong>${e(row.periodKey)}</strong></td><td>${e(row.employeeName)}<small>${e(row.employeeCode)}</small></td><td>${e(payrollAmount(row.gross,row.currencyCode))}</td><td>${e(payrollAmount(row.deductions,row.currencyCode))}</td><td><strong>${e(payrollAmount(row.net,row.currencyCode))}</strong></td><td>${payrollBadge(row.status)}</td><td><div class="payroll-row-actions"><button class="btn small" type="button" data-my-payslip-detail="${index}">Chi tiết</button>${payrollGrant(screen,'canExport')?`<button class="btn small" type="button" data-my-payslip-pdf="${index}">Tải PDF</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<div class="empty"><h3>Chưa có phiếu lương</h3><p>Phiếu lương sẽ xuất hiện khi kỳ lương được chốt hoặc đã thanh toán.</p></div>'}`;
 content.querySelectorAll('[data-my-payslip-detail]').forEach(button=>button.onclick=()=>detail(result.data[Number(button.dataset.myPayslipDetail)].id));content.querySelectorAll('[data-my-payslip-pdf]').forEach(button=>button.onclick=()=>download(result.data[Number(button.dataset.myPayslipPdf)],button));payrollPagination(pagination,{page,total:result.total,onPage:next=>{page=next;load();}});
 }catch(err){if(active()&&current===generation){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}}}
 async function detail(id){return controller.dialog('Phiếu lương của tôi',async(host,alive)=>{const data=myPayslipDetail(await apiMyPayslipDetail(id));if(!alive())return;if(data.row.id!==id)throw Error('Phiếu lương trả về không khớp yêu cầu.');host.innerHTML=payrollPayslipMarkup(data)+(payrollGrant(screen,'canExport')?'<button class="btn primary" type="button" data-personal-pdf>Tải PDF</button>':'');host.querySelector('[data-personal-pdf]')?.addEventListener('click',event=>download(data.row,event.currentTarget));});}
 async function download(row,button){if(!myPayslipRowValid(row)||!payrollGrant(screen,'canExport'))return;button.disabled=true;try{const blob=await apiMyPayslipPdf(row.id);if(!active())return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='phieu-luong-'+String(row.periodKey).replace(/[^0-9-]/g,'')+'.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã tải phiếu lương PDF.');}catch(err){if(active())toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}}
 void load();void loadPeriods();return ()=>{++generation;controller.dispose();};
}


// Source: pages/performance/kpi-templates.js

const kpiConfigurationTabs={templates:'Mẫu KPI',metrics:'Chỉ tiêu',units:'Đơn vị',periods:'Kỳ đánh giá',assignments:'Giao KPI'};
const kpiPeriodTypes={MONTH:'Tháng',QUARTER:'Quý',YEAR:'Năm'};
function kpiConfigurationGrant(flag,global=false,session=apiSession()){
 const action={canNew:'NEW',canUpdate:'UPDATE',canView:'VIEW'}[flag];
 // Login ScreenPermissionDto has action flags only. Missing scope is unknown; the API enforces it.
 return !!session?.permissions?.some(p=>{if(p.platform!=='WEB'||p.code!=='WEB_KPI_CONFIGURATION'||p.canView!=='Y'||p[flag]!=='Y')return false;const scope=p.dataScopes?.[action];return flag==='canView'||scope==null||(global?scope==='ALL':['DEPARTMENT','ALL'].includes(scope));});
}
function kpiConfigurationCanEdit(template,lookups,session=apiSession()){
 if(template.status!=='DRAFT'||!kpiConfigurationGrant('canUpdate',false,session))return false;
 if(kpiConfigurationGrant('canUpdate',true,session))return true;
 const department=template.departmentId??lookups.teams.find(team=>team.id===template.teamId)?.departmentId;
 return department!=null&&lookups.departments.some(item=>item.id===department)&&!template.positionId;
}
function kpiConfigId(value){const number=Number(value);if(!Number.isSafeInteger(number)||number<1)throw Error('Chọn mục hợp lệ từ danh sách.');return number;}
function kpiConfigDecimal(value,precision=4,max=999999999999){const text=String(value??'').trim();if(!new RegExp('^\\d+(?:\\.\\d{1,'+precision+'})?$').test(text)||!Number.isFinite(Number(text))||Number(text)>max)throw Error('Giá trị không hợp lệ, tối đa '+precision+' chữ số thập phân.');return Number(text);}
function kpiTemplatePayload(values,criteria,metrics){
 const code=String(values.code||'').trim(),name=String(values.name||'').trim();if(!/^[A-Z0-9_]{1,30}$/.test(code)||!name||name.length>200||!kpiPeriodTypes[values.periodType])throw Error('Nhập mã, tên và loại kỳ KPI hợp lệ.');
 const payload={code,name,periodType:values.periodType,departmentId:null,teamId:null,positionId:null,version:values.version||0,criteria:[]};
 for(const key of ['departmentId','teamId','positionId'])if(values[key])payload[key]=kpiConfigId(values[key]);
 if(['departmentId','teamId','positionId'].filter(key=>payload[key]!==null).length>1)throw Error('Chỉ chọn một phạm vi áp dụng.');
 if(!criteria.length||criteria.length>100)throw Error('Mẫu KPI cần từ 1 đến 100 chỉ tiêu.');const seen=new Set();let weight=0;
 for(const item of criteria){const metricId=kpiConfigId(item.metricId),metric=metrics.find(metric=>metric.id===metricId);if(!metric||!metric.isActive||seen.has(metricId))throw Error('Chỉ tiêu phải đang hoạt động và không được trùng.');seen.add(metricId);const weightPercent=kpiConfigDecimal(item.weightPercent,2,100),targetValue=kpiConfigDecimal(item.targetValue);if(weightPercent<=0||metric.method==='RATIO'&&targetValue<=0)throw Error('Trọng số và mục tiêu chỉ tiêu tỷ lệ phải lớn hơn 0.');weight+=Math.round(weightPercent*100);payload.criteria.push({metricId,weightPercent,targetValue});}
 if(weight!==10000)throw Error('Tổng trọng số phải bằng 100%.');return payload;
}
function kpiMetricPayload(values,milestones){
 const code=String(values.code||'').trim(),name=String(values.name||'').trim(),unit=String(values.unit||'').trim(),methods={HIGHER:'RATIO',LOWER:'RATIO',QUALITATIVE:'DIRECT',MILESTONE:'MILESTONE'};
 if(!/^[A-Z0-9_]{1,30}$/.test(code)||!name||name.length>200||!unit||unit.length>30||!methods[values.direction])throw Error('Nhập mã, tên, đơn vị và phương pháp hợp lệ.');
 const maxScore=kpiConfigDecimal(values.maxScore,4,200);if(maxScore<1)throw Error('Điểm tối đa từ 1 đến 200.');
 const result=values.direction==='MILESTONE'?milestones.map(item=>({threshold:kpiConfigDecimal(item.threshold),score:kpiConfigDecimal(item.score,4,maxScore)})).sort((a,b)=>a.threshold-b.threshold):[];
 if(values.direction==='MILESTONE'&&(!result.length||result.length>100||result.some((item,index)=>index>0&&(item.threshold===result[index-1].threshold||item.score<result[index-1].score))))throw Error('Mốc không trùng, điểm tăng dần theo mốc; cần từ 1 đến 100 mốc.');
 return {code,name,unit,direction:values.direction,method:methods[values.direction],source:'MANUAL',maxScore,milestones:result,isActive:values.isActive===true,version:values.version||0};
}
function kpiUnitPayload(values,current=null){
 const code=String(values.code||'').trim(),name=String(values.name||'').trim(),sortOrder=Number(values.sortOrder);
 if(!code||code.length>30||!name||name.length>100||!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>100000)throw Error('Nhập mã, tên đơn vị và thứ tự từ 0 đến 100000.');
 if(current&&code!==current.code)throw Error('Không được đổi mã đơn vị đã tạo.');
 return {code,name,isActive:values.isActive===true,sortOrder,...(current?{version:current.version}:{})};
}
function kpiMetricUnitOptions(units,current=''){
 const choices=units.filter(unit=>unit.isActive===true).map(unit=>({id:unit.code,label:unit.code+' · '+unit.name}));
 if(current&&!choices.some(unit=>unit.id===current))choices.push({id:current,label:current+' (đơn vị hiện tại)'});return choices;
}
function kpiTemplateApplicability(template){
 if(template?.departmentId!=null)return {kind:'DEPARTMENT',type:'Theo phòng ban',name:template.departmentName||'Phòng ban #'+template.departmentId,target:'EMPLOYEE',id:template.departmentId};
 if(template?.teamId!=null)return {kind:'TEAM',type:'Theo team',name:template.teamName||'Team #'+template.teamId,target:'EMPLOYEE',id:template.teamId};
 if(template?.positionId!=null)return {kind:'POSITION',type:'Theo chức vụ',name:template.positionName||'Chức vụ #'+template.positionId,target:'EMPLOYEE',id:template.positionId};
 return {kind:'COMMON',type:'Dùng chung',name:'Không giới hạn phòng ban, team hoặc chức vụ',target:null,id:null};
}
function kpiTemplateMatchesEmployee(template,employee){return ['departmentId','teamId','positionId'].every(key=>template?.[key]==null||String(template[key])===String(employee[key]));}
async function kpiMatchingEmployees(template,isCurrent=()=>true){
 const matched=new Map();let loaded=0;
 for(let page=1;isCurrent();page++){
 const result=kpiConfigurationPage(await apiKpiConfigurationList('employees',{page,pageSize:100}));if(!isCurrent())return null;
 for(const employee of result.data)if(kpiTemplateMatchesEmployee(template,employee)){matched.set(employee.id,employee);if(matched.size>1000)throw Error('Có hơn 1000 nhân viên phù hợp. Chọn từng nhân viên để giao tối đa 1000 người mỗi đợt.');}
 loaded+=result.data.length;if(loaded>=result.total)return [...matched.values()];if(!result.data.length)throw Error('Chưa tải đủ danh sách nhân viên. Vui lòng thử lại.');
 }return null;
}
function kpiAssignmentPayload(values,employeeIds,periods,templates){
 const periodId=kpiConfigId(values.periodId),templateId=kpiConfigId(values.templateId),reviewerEmployeeId=kpiConfigId(values.reviewerEmployeeId),period=periods.find(item=>item.id===periodId),template=templates.find(item=>item.id===templateId);
 if(!period||period.isClosed||!template||template.status!=='PUBLISHED'||template.periodType!==period.periodType)throw Error('Chọn kỳ đang mở và mẫu đã phát hành cùng loại kỳ.');
 const applicability=kpiTemplateApplicability(template);if(applicability.target)values={...values,target:applicability.target,departmentId:template.departmentId,teamId:template.teamId};
 if(!['ALL','DEPARTMENT','TEAM','EMPLOYEE'].includes(values.target))throw Error('Chọn đối tượng giao KPI.');
 const payload={periodId,templateId,reviewerEmployeeId,target:values.target,employeeIds:[],departmentId:null,teamId:null,copyFromPeriodId:null};
 if(values.target==='DEPARTMENT')payload.departmentId=kpiConfigId(values.departmentId);if(values.target==='TEAM')payload.teamId=kpiConfigId(values.teamId);
 if(values.target==='EMPLOYEE'){payload.employeeIds=[...new Set(employeeIds.map(kpiConfigId))];if(!payload.employeeIds.length)throw Error('Chưa thêm nhân viên. Chọn nhân viên và bấm Thêm trước khi lưu.');if(payload.employeeIds.length>1000)throw Error('Chọn tối đa 1000 nhân viên.');}
 if(values.alternateReviewerEmployeeId){payload.alternateReviewerEmployeeId=kpiConfigId(values.alternateReviewerEmployeeId);if(payload.alternateReviewerEmployeeId===reviewerEmployeeId)throw Error('Người thay thế phải khác người đánh giá chính.');}
 if(values.copyFromPeriodId){const source=periods.find(item=>item.id===Number(values.copyFromPeriodId));if(!source||source.periodType!==period.periodType||source.endDate>=period.startDate)throw Error('Kỳ nguồn phải cùng loại và kết thúc trước kỳ đích.');payload.copyFromPeriodId=source.id;}
 return payload;
}
function kpiConfigurationPage(response){if(response?.success!==true||!Array.isArray(response.data)||!Number.isSafeInteger(response.total)||response.total<0)throw Error('Danh sách cấu hình KPI không hợp lệ.');return response;}
function kpiConfigSelect(name,label,items,labelKey,selected='',empty='Chọn…',extra=''){return `<label>${label}<select name="${name}" ${extra}><option value="">${empty}</option>${items.map(item=>`<option value="${e(item.id)}" ${String(item.id)===String(selected)?'selected':''}>${e(typeof labelKey==='function'?labelKey(item):item[labelKey])}</option>`).join('')}</select></label>`;}
function kpiConfigPeriodSelect(selected='MONTH'){return kpiConfigSelect('periodType','Loại kỳ',Object.entries(kpiPeriodTypes).map(([id,name])=>({id,name})),'name',selected,'Chọn loại kỳ','required');}

function mountKpiTemplates(root){
 if(!root)return ()=>{};if(!kpiConfigurationGrant('canView')){root.innerHTML='<p>Bạn cần quyền WEB_KPI_CONFIGURATION/VIEW để xem thiết lập KPI.</p>';return ()=>{};}
 let disposed=false,tab='templates',page=1,search='',unitIsActive='',generation=0,timer,dialogGeneration=0,dialogBusy=false,dialogHost=null,disposeAssignments=()=>{};
 const active=()=>!disposed&&root.isConnected;
 async function allRows(kind,filters={}){const rows=[];for(let next=1;active();next++){const result=kpiConfigurationPage(await apiKpiConfigurationList(kind,{...filters,page:next,pageSize:100}));rows.push(...result.data);if(rows.length>=result.total)break;if(!result.data.length)throw Error('Không tải đủ danh mục KPI.');}return rows;}
 async function lookups(){const data=await apiKpiConfigurationLookups();if(!['departments','teams','positions'].every(key=>Array.isArray(data[key])))throw Error('Danh mục tổ chức KPI không hợp lệ.');return data;}
 function shell(){
 root.innerHTML=`<div class="tabs">${Object.entries(kpiConfigurationTabs).map(([key,label])=>`<button type="button" class="tab ${key===tab?'active':''}" data-kpi-config-tab="${key}">${label}</button>`).join('')}</div><div class="kpi-config-toolbar"><form data-kpi-config-search><label>Tìm kiếm<input name="search" type="search" placeholder="Mã hoặc tên ${tab==='units'?'đơn vị':tab==='metrics'?'chỉ tiêu':'mẫu KPI'}" value="${e(search)}"></label><button class="btn" type="submit">Tìm</button></form>${tab==='units'?'<label>Trạng thái<select data-kpi-unit-status><option value="">Tất cả</option><option value="true">Hoạt động</option><option value="false">Ngừng hoạt động</option></select></label>':''}<button class="btn" type="button" data-kpi-config-refresh>Làm mới</button>${tab!=='assignments'&&kpiConfigurationGrant('canNew',tab!=='templates')?'<button class="btn primary" type="button" data-kpi-config-new>Thêm '+({templates:'mẫu KPI',metrics:'chỉ tiêu',units:'đơn vị',periods:'kỳ đánh giá'}[tab])+'</button>':''}</div><div data-kpi-config-content></div><div class="user-pagination" data-kpi-config-pages></div>`;
 root.querySelectorAll('[data-kpi-config-tab]').forEach(button=>button.onclick=()=>{if(dialogBusy)return;clearTimeout(timer);++generation;tab=button.dataset.kpiConfigTab;page=1;search='';unitIsActive='';shell();});
 const form=root.querySelector('[data-kpi-config-search]');form.hidden=['periods','assignments'].includes(tab);form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(timer);search=form.elements.search.value.trim();page=1;load();};form.elements.search.oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>{search=form.elements.search.value.trim();page=1;load();},300);};
 const unitStatus=root.querySelector('[data-kpi-unit-status]');if(unitStatus){unitStatus.value=unitIsActive;unitStatus.onchange=()=>{unitIsActive=unitStatus.value;page=1;load();};}
 root.querySelector('[data-kpi-config-refresh]').onclick=()=>{clearTimeout(timer);load();};root.querySelector('[data-kpi-config-new]')?.addEventListener('click',()=>tab==='templates'?templateDialog():tab==='metrics'?metricDialog():tab==='units'?unitDialog():periodDialog());void load();
 }
 async function load(){
 disposeAssignments();disposeAssignments=()=>{};
 const current=++generation,kind=tab,content=root.querySelector('[data-kpi-config-content]'),pagination=root.querySelector('[data-kpi-config-pages]');if(!active())return;content.innerHTML='<p role="status">Đang tải thiết lập KPI…</p>';pagination.innerHTML='';
 if(kind==='assignments'){
 content.innerHTML=`<div class="kpi-assignment-list-heading"><div><h2>KPI đã giao</h2><p class="muted">Theo dõi các bộ KPI của nhân viên theo kỳ đánh giá.</p></div>${kpiConfigurationGrant('canNew')?'<button class="btn primary" type="button" data-kpi-assign>Giao KPI</button>':''}</div><div data-kpi-assigned-list></div>`;
 content.querySelector('[data-kpi-assign]')?.addEventListener('click',assignmentDialog);
 const list=content.querySelector('[data-kpi-assigned-list]');if(kpiEvaluationGrant('canView'))disposeAssignments=mountKpiResults(list,{employeeFilter:false});else list.innerHTML='<p>Bạn cần quyền WEB_KPI_EVALUATION/VIEW để xem danh sách KPI đã giao.</p>';return;
 }

 try{const response=kpiConfigurationPage(await apiKpiConfigurationList(kind,{page,pageSize:20,search,...(kind==='units'?{isActive:unitIsActive}:{})}));if(!active()||current!==generation)return;
 const headers=kind==='templates'?['Mã / Tên mẫu','Loại kỳ','Loại mẫu / Áp dụng cho','Trạng thái','']:kind==='units'?['Mã / Tên đơn vị','Thứ tự','Trạng thái','']:kind==='metrics'?['Mã / Tên chỉ tiêu','Đơn vị','Điểm tối đa','Trạng thái','']:['Kỳ đánh giá','Loại kỳ','Thời gian','Trạng thái',''];
 content.innerHTML=`<div class="table-wrap"><table><thead><tr>${headers.map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${response.data.map((row,index)=>`<tr><td><strong>${e(row.code)}</strong>${row.name?`<small>${e(row.name)}</small>`:''}</td>${kind==='templates'?`<td>${e(kpiPeriodTypes[row.periodType]||row.periodType)}</td><td><strong>${e(kpiTemplateApplicability(row).type)}</strong><small>${e(kpiTemplateApplicability(row).name)}</small></td><td><span class="badge ${row.status==='PUBLISHED'?'active':''}">${row.status==='PUBLISHED'?'Đã phát hành':'Bản nháp'}</span></td><td><button class="btn small" type="button" data-config-detail="${index}">Chi tiết</button></td>`:kind==='units'?`<td>${e(row.sortOrder)}</td><td>${row.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button class="btn small" type="button" data-config-detail="${index}">${kpiConfigurationGrant('canUpdate',true)?'Chỉnh sửa':'Chi tiết'}</button></td>`:kind==='metrics'?`<td>${e(row.unit)}</td><td>${e(row.maxScore)}</td><td>${row.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button class="btn small" type="button" data-config-detail="${index}">${kpiConfigurationGrant('canUpdate',true)?'Chỉnh sửa':'Chi tiết'}</button></td>`:`<td>${e(kpiPeriodTypes[row.periodType]||row.periodType)}</td><td>${e(dateLabel(row.startDate))} – ${e(dateLabel(row.endDate))}</td><td>${row.isClosed?'Đã chốt':'Đang mở'}</td><td>${!row.isClosed&&kpiConfigurationGrant('canUpdate',true)?`<button class="btn small" type="button" data-config-detail="${index}">Chốt kỳ</button>`:''}</td>`}</tr>`).join('')}</tbody></table></div>${response.data.length?'':'<p class="empty">Chưa có dữ liệu theo bộ lọc.</p>'}`;
 content.querySelectorAll('[data-config-detail]').forEach(button=>button.onclick=()=>{const row=response.data[Number(button.dataset.configDetail)];if(kind==='templates')templateDialog(row.id);else if(kind==='metrics')metricDialog(row);else if(kind==='units')unitDialog(row.id);else closePeriodDialog(row);});
 pagination.innerHTML=`<span>${response.total} mục · Trang ${page}/${Math.max(1,Math.ceil(response.total/20))}</span><div><button type="button" class="btn" data-prev ${page===1?'disabled':''}>Trang trước</button><button type="button" class="btn" data-next ${page*20>=response.total?'disabled':''}>Trang sau</button></div>`;pagination.querySelector('[data-prev]').onclick=()=>{page--;load();};pagination.querySelector('[data-next]').onclick=()=>{page++;load();};
 }catch(err){if(active()&&current===generation){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}}
 }
 async function dialog(title,prepare){
 if(dialogBusy)return;const current=++dialogGeneration;openDialog(title,'<div id="kpi-config-dialog"><p role="status">Đang tải…</p></div>');const host=document.getElementById('kpi-config-dialog');dialogHost=host;
 try{await prepare(host,()=>active()&&host.isConnected&&current===dialogGeneration);}catch(err){if(host.isConnected&&current===dialogGeneration){host.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;host.querySelector('button').onclick=()=>dialog(title,prepare);}}
 }
 function bindSave(host,{permission,save,reload,after}){
 const form=host.querySelector('form'),feedback=host.querySelector('[data-config-feedback]');let stale=false;form.noValidate=true;
 function showSaveError(message){feedback.textContent=message;feedback.setAttribute('role','alert');toast(message,{type:'error'});}
 host.querySelector('[data-config-reload]')?.addEventListener('click',async()=>{if(dialogBusy)return;const accepted=await confirmDialog({title:'Tải lại dữ liệu?',message:'Các thay đổi chưa lưu sẽ bị bỏ. Bạn có muốn tải lại dữ liệu mới nhất?',confirmLabel:'Tải lại'});if(accepted&&!dialogBusy&&form.isConnected)reload();});
 form.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(dialogBusy)return;if(stale){showSaveError('Dữ liệu đã thay đổi. Tải lại trước khi lưu tiếp.');return;}if(!permission()){showSaveError('Bạn chưa có quyền thực hiện thao tác KPI này.');return;}if(!form.checkValidity()){const invalid=form.querySelector('input:invalid,select:invalid,textarea:invalid'),label=invalid?.closest('label'),name=label?[...label.childNodes].filter(node=>node.nodeType===3).map(node=>node.textContent).join('').trim():'';showSaveError(name?'Vui lòng nhập hoặc chọn '+name.toLocaleLowerCase('vi-VN')+'.':'Vui lòng kiểm tra thông tin bắt buộc.');invalid?.focus();return;}const action=event.submitter?.value||'save';dialogBusy=true;const values=Object.fromEntries(new FormData(form));form.querySelectorAll('button,input,select,textarea').forEach(input=>input.disabled=true);feedback.setAttribute('role','status');feedback.textContent='Đang xử lý…';
 try{const result=await save(values,action);if(!active()||!form.isConnected)return;if(result===null){feedback.textContent='';return;}if(result?.success!==true)throw Error('Phản hồi chưa xác nhận thành công. Tải lại trước khi thao tác tiếp.');toast('Đã cập nhật KPI.');dialogBusy=false;if(after)after(result);else closeDialog();void load();}
 catch(err){stale=err.status===409;if(form.isConnected){const message=err.message+(stale?' Tải lại dữ liệu trước khi tiếp tục.':'');feedback.textContent=message;feedback.setAttribute('role','alert');if(!err.status)toast(message,{type:'error'});}}
 finally{dialogBusy=false;if(form.isConnected){form.querySelectorAll('button,input,select,textarea').forEach(input=>input.disabled=stale||input.hasAttribute('data-config-locked'));const reloadButton=form.querySelector('[data-config-reload]');if(reloadButton)reloadButton.disabled=false;}}
 };
 }
 function dialogActions(editable,extra=''){return `<div class="form-actions">${editable?'<button class="btn primary" type="submit" value="save">Lưu</button>':''}${extra}<button class="btn" type="button" data-config-reload>Tải lại</button></div><p role="status" data-config-feedback></p>`;}
 function templateDialog(id=null){return dialog(id?'Chi tiết mẫu KPI':'Thêm mẫu KPI',async(host,alive)=>{
 const [org,metrics,detail]=await Promise.all([lookups(),allRows('metrics'),id?apiKpiTemplateDetail(id):Promise.resolve({template:{periodType:'MONTH',status:'DRAFT',version:0},criteria:[]})]);if(!alive())return;
 if(!detail?.template||!Array.isArray(detail.criteria))throw Error('Chi tiết mẫu KPI không hợp lệ.');const row=detail.template,editable=id?kpiConfigurationCanEdit(row,org):kpiConfigurationGrant('canNew'),global=kpiConfigurationGrant(id?'canUpdate':'canNew',true),scopeType=row.teamId?'teamId':row.departmentId?'departmentId':row.positionId?'positionId':global?'GLOBAL':'departmentId';
 host.innerHTML=`<form class="user-registration kpi-config-form"><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div class="form-grid">${field('Mã mẫu','code','text',row.code||'','required maxlength="30" pattern="[A-Z0-9_]+"')}${field('Tên mẫu','name','text',row.name||'','required maxlength="200"')}${kpiConfigPeriodSelect(row.periodType)}${kpiConfigSelect('applicability','Áp dụng cho',[...(global||!editable?[{id:'GLOBAL',name:'Dùng chung'},{id:'positionId',name:'Chức vụ'}]:[]),{id:'departmentId',name:'Phòng ban'},{id:'teamId',name:'Team'}],'name',scopeType,'Chọn phạm vi','required')}<div data-applicability></div></div><div class="terminal-section-heading"><h3>Chỉ tiêu và trọng số</h3>${editable?'<button class="btn" type="button" data-add-criterion>Thêm chỉ tiêu</button>':''}</div><div data-criteria></div><p data-weight-total></p></fieldset>${dialogActions(editable,id&&editable?'<button class="btn" type="submit" value="publish">Phát hành</button>':'')}</form>`;
 const form=host.querySelector('form'),criteriaHost=host.querySelector('[data-criteria]');let criteria=detail.criteria.map(item=>({...item}));if(!criteria.length)criteria=[{metricId:'',weightPercent:100,targetValue:''}];
 function applicability(){const kind=form.elements.applicability.value;host.querySelector('[data-applicability]').innerHTML=kind==='GLOBAL'?'':kpiConfigSelect(kind,kind==='departmentId'?'Phòng ban':kind==='teamId'?'Team':'Chức vụ',kind==='departmentId'?org.departments:kind==='teamId'?org.teams:org.positions,kind==='departmentId'?'departmentName':kind==='teamId'?'teamName':'name',row[kind]||'','Chọn…','required');}form.elements.applicability.onchange=applicability;applicability();let changed=false;form.addEventListener('input',()=>{changed=true;});form.addEventListener('change',()=>{changed=true;});
 function syncCriteria(){criteria=[...criteriaHost.querySelectorAll('[data-criterion-row]')].map(section=>({metricId:section.querySelector('[name=metricId]').value,weightPercent:section.querySelector('[name=weightPercent]').value,targetValue:section.querySelector('[name=targetValue]').value}));}
 function total(){host.querySelector('[data-weight-total]').textContent='Tổng trọng số: '+criteria.reduce((sum,item)=>sum+(Number(item.weightPercent)||0),0).toLocaleString('vi-VN')+'% / 100%';}
 function renderCriteria(){criteriaHost.innerHTML=criteria.map((item,index)=>`<section class="kpi-criterion" data-criterion-row>${kpiConfigSelect('metricId','Chỉ tiêu',metrics.filter(metric=>metric.isActive||metric.id===Number(item.metricId)),metric=>metric.code+' · '+metric.name,item.metricId,'Chọn chỉ tiêu','required')}${!metrics.some(metric=>metric.id===Number(item.metricId))&&item.metricId?`<p>${e(item.code)} · ${e(item.name)} (chỉ tiêu cũ)</p>`:''}<div class="form-grid">${field('Trọng số (%)','weightPercent','number',item.weightPercent,'required min="0.01" max="100" step="0.01"')}${field('Mục tiêu','targetValue','number',item.targetValue,'required min="0" max="999999999999" step="0.0001"')}</div>${editable?`<button class="btn small danger" type="button" data-remove-criterion="${index}">Xóa chỉ tiêu</button>`:''}</section>`).join('');criteriaHost.querySelectorAll('[data-remove-criterion]').forEach(button=>button.onclick=()=>{syncCriteria();criteria.splice(Number(button.dataset.removeCriterion),1);changed=true;renderCriteria();});total();}
 renderCriteria();criteriaHost.oninput=()=>{syncCriteria();total();};host.querySelector('[data-add-criterion]')?.addEventListener('click',()=>{syncCriteria();if(criteria.length>=100)return;criteria.push({metricId:'',weightPercent:'',targetValue:''});changed=true;renderCriteria();});
 bindSave(host,{permission:()=>id?kpiConfigurationCanEdit(row,org):kpiConfigurationGrant('canNew'),reload:()=>templateDialog(id),save:async(values,action)=>{if(action==='publish'){if(changed)throw Error('Lưu các thay đổi trước khi phát hành mẫu KPI.');const accepted=await confirmDialog({title:'Phát hành mẫu KPI?',message:'Mẫu KPI sẽ được phát hành từ phiên bản đã lưu. Sau khi phát hành, bạn không thể chỉnh sửa mẫu này.',confirmLabel:'Phát hành'});if(!accepted||!active()||!form.isConnected)return null;return apiKpiConfigurationAction('templates',id,row.version);}syncCriteria();return apiKpiConfigurationSave('templates',kpiTemplatePayload({...values,version:row.version},criteria,metrics),id);}});
 });}
 function metricDialog(row=null){return dialog(row?'Chi tiết chỉ tiêu':'Thêm chỉ tiêu',async(host,alive)=>{
 const units=await allRows('units',{isActive:true});if(!alive())return;const unitChoices=kpiMetricUnitOptions(units,row?.unit||'');const editable=kpiConfigurationGrant(row?'canUpdate':'canNew',true);let milestones=row?JSON.parse(row.milestonesJson||'[]'):[];
 host.innerHTML=`<form class="user-registration kpi-config-form"><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div class="form-grid">${field('Mã chỉ tiêu','code','text',row?.code||'','required maxlength="30" pattern="[A-Z0-9_]+"')}${field('Tên chỉ tiêu','name','text',row?.name||'','required maxlength="200"')}${kpiConfigSelect('unit','Đơn vị',unitChoices,'label',row?.unit||'','Chọn đơn vị','required')}${kpiConfigSelect('direction','Cách đánh giá',[{id:'HIGHER',name:'Càng cao càng tốt'},{id:'LOWER',name:'Càng thấp càng tốt'},{id:'QUALITATIVE',name:'Chấm điểm trực tiếp'},{id:'MILESTONE',name:'Theo mốc'}],'name',row?.direction||'HIGHER','Chọn…','required')}${field('Điểm tối đa','maxScore','number',row?.maxScore??100,'required min="1" max="200" step="0.0001"')}<label class="role-toggle-row kpi-metric-active"><span>Hoạt động</span><span class="role-switch"><input type="checkbox" role="switch" name="isActive" ${!row||row.isActive?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label></div><div data-milestone-section><h3>Các mốc đánh giá</h3><div data-milestones></div><button class="btn" type="button" data-add-milestone>Thêm mốc</button></div></fieldset>${dialogActions(editable)}</form>`;
 const form=host.querySelector('form'),milestoneHost=host.querySelector('[data-milestones]');function collect(){milestones=[...milestoneHost.querySelectorAll('[data-milestone]')].map(section=>({threshold:section.querySelector('[name=threshold]').value,score:section.querySelector('[name=score]').value}));}
 function renderMilestones(){milestoneHost.innerHTML=milestones.map((item,index)=>`<div class="form-grid" data-milestone>${field('Ngưỡng','threshold','number',item.threshold,'min="0" step="0.0001"')}${field('Điểm','score','number',item.score,'min="0" max="200" step="0.0001"')}<button class="btn small" type="button" data-remove-milestone="${index}">Xóa</button></div>`).join('');milestoneHost.querySelectorAll('[data-remove-milestone]').forEach(button=>button.onclick=()=>{collect();milestones.splice(Number(button.dataset.removeMilestone),1);renderMilestones();});}
 renderMilestones();function direction(){host.querySelector('[data-milestone-section]').hidden=form.elements.direction.value!=='MILESTONE';}direction();form.elements.direction.onchange=direction;host.querySelector('[data-add-milestone]').onclick=()=>{collect();if(milestones.length>=100)return;milestones.push({threshold:'',score:''});renderMilestones();};
 bindSave(host,{permission:()=>kpiConfigurationGrant(row?'canUpdate':'canNew',true),reload:async()=>{if(!row)return metricDialog();await dialog('Tải lại chỉ tiêu',async(next,connected)=>{const fresh=(await allRows('metrics')).find(item=>item.id===row.id);if(!fresh)throw Error('Không tìm thấy chỉ tiêu.');if(connected())metricDialog(fresh);});},save:values=>{if(!unitChoices.some(unit=>unit.id===values.unit))throw Error('Chọn đơn vị từ danh mục.');collect();return apiKpiConfigurationSave('metrics',kpiMetricPayload({...values,isActive:form.elements.isActive.checked,version:row?.version||0},milestones),row?.id??null);}});
 });}
 function unitDialog(id=null){return dialog(id?'Chi tiết đơn vị KPI':'Thêm đơn vị KPI',async(host,alive)=>{
 let row=null;if(id!==null){const response=await apiKpiUnitDetail(id);if(response?.success!==true||!response.data||response.data.id!==id||!Number.isSafeInteger(response.data.version)||response.data.version<1)throw Error('Chi tiết đơn vị không hợp lệ.');row=response.data;}if(!alive())return;const editable=kpiConfigurationGrant(row?'canUpdate':'canNew',true);
 host.innerHTML=`<form class="user-registration kpi-config-form"><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div class="form-grid">${field('Mã đơn vị','code','text',row?.code||'',`required maxlength="30" ${row?'readonly':''}`)}${field('Tên đơn vị','name','text',row?.name||'','required maxlength="100"')}${field('Thứ tự hiển thị','sortOrder','number',row?.sortOrder??0,'required min="0" max="100000" step="1"')}<label class="role-toggle-row kpi-metric-active"><span>Hoạt động</span><span class="role-switch"><input type="checkbox" role="switch" name="isActive" ${!row||row.isActive?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label></div></fieldset>${dialogActions(editable)}</form>`;
 const form=host.querySelector('form');bindSave(host,{permission:()=>kpiConfigurationGrant(row?'canUpdate':'canNew',true),reload:()=>unitDialog(id),save:values=>apiKpiConfigurationSave('units',kpiUnitPayload({...values,isActive:form.elements.isActive.checked},row),id)});
 });}
 function periodDialog(){return dialog('Thêm kỳ đánh giá',async(host,alive)=>{
 if(!alive())return;const now=new Date();
 host.innerHTML=`<form class="user-registration"><div class="form-grid">${kpiConfigPeriodSelect()}${kpiConfigSelect('year','Năm',Array.from({length:101},(_,index)=>({id:2000+index,name:String(2000+index)})),'name',now.getFullYear(),'Chọn năm','required')}<div data-period-number></div></div>${dialogActions(kpiConfigurationGrant('canNew',true))}</form>`;
 const form=host.querySelector('form'),numberHost=host.querySelector('[data-period-number]'),selection={MONTH:now.getMonth()+1,QUARTER:Math.floor(now.getMonth()/3)+1};let previous='MONTH';
 function setPeriodNumber(){const old=form.elements.namedItem('number');if(old&&old.value)selection[previous]=Number(old.value);const kind=form.elements.periodType.value;previous=kind;numberHost.hidden=!['MONTH','QUARTER'].includes(kind);numberHost.innerHTML=numberHost.hidden?'':kpiConfigSelect('number',kind==='MONTH'?'Tháng':'Quý',Array.from({length:kind==='MONTH'?12:4},(_,index)=>({id:index+1,name:(kind==='MONTH'?'Tháng ':'Quý ')+(index+1)})),'name',selection[kind],'Chọn '+(kind==='MONTH'?'tháng':'quý'),'required');}
 form.elements.periodType.onchange=setPeriodNumber;setPeriodNumber();
 bindSave(host,{permission:()=>kpiConfigurationGrant('canNew',true),reload:periodDialog,save:values=>apiKpiConfigurationSave('periods',{periodType:values.periodType,year:Number(values.year),number:values.periodType==='YEAR'?1:Number(values.number)})});
 });}

 function closePeriodDialog(row){return dialog('Chốt kỳ KPI',async(host,alive)=>{if(!alive())return;host.innerHTML=`<form><p>Chốt kỳ <strong>${e(row.code)}</strong>? Kỳ đã chốt không thể mở lại. Tất cả bộ KPI trong kỳ phải được phê duyệt hoặc từ chối.</p>${dialogActions(kpiConfigurationGrant('canUpdate',true))}</form>`;bindSave(host,{permission:()=>kpiConfigurationGrant('canUpdate',true),reload:()=>{closeDialog();load();},save:()=>apiKpiConfigurationAction('periods',row.id,row.version)});});}
 function assignmentDialog(){return dialog('Giao KPI',async(host,alive)=>{
 const [org,periods,templates]=await Promise.all([lookups(),allRows('periods'),allRows('templates')]);if(!alive())return;let employeePage=1,employeeGeneration=0,employeeTimer,employeeRows=[],matchingRows=null,selected=new Map();
 host.innerHTML=`<form class="user-registration kpi-config-form"><div class="form-grid">${kpiConfigSelect('periodId','Kỳ đánh giá',periods.filter(item=>!item.isClosed),'code','','Chọn kỳ','required')}${kpiConfigSelect('templateId','Mẫu KPI',[],'name','','Chọn mẫu','required')}<div class="full kpi-assignment-template-info" data-assignment-template-info hidden></div>${kpiConfigSelect('target','Đối tượng',[{id:'EMPLOYEE',name:'Nhân viên'},{id:'DEPARTMENT',name:'Phòng ban'},{id:'TEAM',name:'Team'},{id:'ALL',name:'Tất cả trong phạm vi quyền'}],'name','EMPLOYEE','Chọn…','required')}<div data-assignment-target></div>${kpiConfigSelect('copyFromPeriodId','Sao chép từ kỳ',[],'code','','Không sao chép')}</div><section><label>Tìm nhân viên / người đánh giá<input type="search" data-assignment-search placeholder="Mã hoặc tên nhân viên"></label><div data-assignment-employees></div><div data-assignment-pages></div><div data-assignment-selected></div></section><div class="form-grid">${kpiConfigSelect('reviewerEmployeeId','Người đánh giá chính',[],'fullName','','Chọn người đánh giá','required')}${kpiConfigSelect('alternateReviewerEmployeeId','Người đánh giá thay thế',[],'fullName','','Không chọn')}</div><p class="muted">Chọn người thay thế nếu người đánh giá chính cũng thuộc đợt giao. Người đánh giá cần có tài khoản đang hoạt động.</p>${dialogActions(kpiConfigurationGrant('canNew'))}</form>`;
 const form=host.querySelector('form'),employeesHost=host.querySelector('[data-assignment-employees]'),selectedHost=host.querySelector('[data-assignment-selected]');
 function periodChange(){const period=periods.find(item=>String(item.id)===form.elements.periodId.value);form.elements.templateId.innerHTML='<option value="">Chọn mẫu đã phát hành</option>'+templates.filter(item=>item.status==='PUBLISHED'&&item.periodType===period?.periodType).map(item=>`<option value="${item.id}">${e(item.code)} · ${e(item.name)}</option>`).join('');form.elements.copyFromPeriodId.innerHTML='<option value="">Không sao chép</option>'+periods.filter(item=>item.periodType===period?.periodType&&item.endDate<period.startDate).map(item=>`<option value="${item.id}">${e(item.code)}</option>`).join('');templateChange();}form.elements.periodId.onchange=periodChange;
 function currentTemplate(){return templates.find(item=>String(item.id)===form.elements.templateId.value);}
 function templateChange(){
 const template=currentTemplate(),info=host.querySelector('[data-assignment-template-info]'),applicability=kpiTemplateApplicability(template);info.hidden=!template;info.innerHTML=template?`<div class="form-grid">${field('Loại mẫu','templateKind','text',applicability.type,'readonly')}${field('Áp dụng cho','templateAppliesTo','text',applicability.name,'readonly')}</div>`:'';
 const organizationTemplate=['DEPARTMENT','TEAM'].includes(applicability.kind);host.querySelector('[data-assignment-search]').closest('label').hidden=organizationTemplate;host.querySelector('[data-assignment-pages]').hidden=organizationTemplate;
 const target=form.elements.target;target.disabled=!!template&&applicability.kind!=='COMMON';target.toggleAttribute('data-config-locked',target.disabled);target.closest('label').hidden=!!template&&applicability.kind!=='COMMON';target.value=applicability.target||'EMPLOYEE';selected.clear();matchingRows=null;renderSelected();targetChange();renderEmployeePicker();if(template&&applicability.kind!=='COMMON')void addAllMatching({automatic:true});
 }
 function targetChange(){const template=currentTemplate(),applicability=kpiTemplateApplicability(template),target=applicability.target||form.elements.target.value;form.elements.target.value=target;
 host.querySelector('[data-assignment-target]').innerHTML=applicability.kind==='DEPARTMENT'||applicability.kind==='TEAM'?'':target==='DEPARTMENT'?kpiConfigSelect('departmentId','Phòng ban',org.departments,'departmentName','','Chọn phòng ban','required'):target==='TEAM'?kpiConfigSelect('teamId','Team',org.teams,'teamName','','Chọn team','required'):'';employeesHost.hidden=target!=='EMPLOYEE';selectedHost.hidden=target!=='EMPLOYEE';}
 form.elements.templateId.onchange=templateChange;form.elements.target.onchange=targetChange;targetChange();
 function renderEmployeePicker(){
 const available=(matchingRows||employeeRows).filter(item=>!selected.has(item.id)&&kpiTemplateMatchesEmployee(currentTemplate(),item));
 employeesHost.innerHTML=`<div class="kpi-assignment-picker">${kpiConfigSelect('assignmentEmployeeId','Nhân viên',available,item=>item.employeeCode+' · '+item.fullName,'',available.length?'Chọn nhân viên':'Không có nhân viên để thêm')}<button class="btn" type="button" data-assignment-add ${!available.length||selected.size>=1000||dialogBusy?'disabled':''}>Thêm</button>${currentTemplate()&&kpiTemplateApplicability(currentTemplate()).kind!=='COMMON'?`<button class="btn" type="button" data-assignment-add-all ${dialogBusy?'disabled':''}>Thêm tất cả nhân viên phù hợp</button>`:''}</div>`;
 const select=form.elements.assignmentEmployeeId,button=employeesHost.querySelector('[data-assignment-add]');button.disabled=true;select.disabled=dialogBusy;select.onchange=()=>{button.disabled=!select.value||selected.size>=1000||dialogBusy;};
 employeesHost.querySelector('[data-assignment-add-all]')?.addEventListener('click',()=>addAllMatching());
 button.onclick=()=>{if(dialogBusy||selected.size>=1000)return;const item=available.find(item=>String(item.id)===select.value);if(!item||selected.has(item.id)||!kpiTemplateMatchesEmployee(currentTemplate(),item))return;selected.set(item.id,item);renderSelected();renderEmployeePicker();};
 }
 async function addAllMatching({automatic=false}={}){
 if(dialogBusy)return;const template=currentTemplate();if(!template||kpiTemplateApplicability(template).kind==='COMMON')return;
 const controls=[...form.querySelectorAll('button,input,select,textarea')].map(control=>[control,control.disabled]),feedback=host.querySelector('[data-config-feedback]');dialogBusy=true;controls.forEach(([control])=>control.disabled=true);feedback.setAttribute('role','status');feedback.textContent='Đang tải tất cả nhân viên phù hợp…';
 try{const matches=await kpiMatchingEmployees(template,()=>alive()&&currentTemplate()===template);if(!matches||!alive())return;matchingRows=matches;const next=new Map(selected);for(const item of matches)next.set(item.id,item);if(next.size>1000)throw Error('Chỉ được giao tối đa 1000 nhân viên mỗi đợt.');const added=next.size-selected.size;selected=next;feedback.textContent=matches.length?'Đã thêm '+added+' nhân viên phù hợp. Tổng đã chọn: '+selected.size+'.':'Không có nhân viên phù hợp trong phạm vi quyền của bạn.';if(!automatic)toast(feedback.textContent);}
 catch(err){if(alive()){feedback.setAttribute('role','alert');feedback.textContent=err.message;if(!err.status)toast(err.message,{type:'error'});}}
 finally{dialogBusy=false;if(alive()){controls.forEach(([control,disabled])=>{if(control.isConnected)control.disabled=disabled;});renderSelected();renderEmployeePicker();}}
 }
 function renderSelected(){selectedHost.innerHTML=`<p>Đã chọn ${selected.size} nhân viên</p>`+[...selected.values()].map(item=>`<button class="btn small" type="button" data-remove-employee="${item.id}" aria-label="Bỏ ${e(item.employeeCode)} · ${e(item.fullName)}">${e(item.employeeCode)} · ${e(item.fullName)} ×</button>`).join('');selectedHost.querySelectorAll('[data-remove-employee]').forEach(button=>button.onclick=()=>{if(dialogBusy)return;selected.delete(Number(button.dataset.removeEmployee));renderSelected();renderEmployeePicker();});}
 async function employees(){const current=++employeeGeneration;if(!alive())return;employeesHost.innerHTML='<p role="status">Đang tải nhân viên…</p>';try{const result=kpiConfigurationPage(await apiKpiConfigurationList('employees',{page:employeePage,pageSize:20,search:host.querySelector('[data-assignment-search]').value.trim()}));if(!alive()||current!==employeeGeneration)return;
 employeeRows=result.data;renderEmployeePicker();
 for(const key of ['reviewerEmployeeId','alternateReviewerEmployeeId']){const select=form.elements.namedItem(key),old=select.selectedOptions[0],value=select.value;select.innerHTML='<option value="">'+(key==='reviewerEmployeeId'?'Chọn người đánh giá':'Không chọn')+'</option>'+result.data.map(item=>`<option value="${item.id}">${e(item.employeeCode)} · ${e(item.fullName)}</option>`).join('');if(value&&!result.data.some(item=>String(item.id)===value)&&old)select.appendChild(old.cloneNode(true));select.value=value;}
 const pages=host.querySelector('[data-assignment-pages]');pages.innerHTML=`<button class="btn small" type="button" data-prev ${employeePage===1?'disabled':''}>Trước</button><span>Trang ${employeePage}</span><button class="btn small" type="button" data-next ${employeePage*20>=result.total?'disabled':''}>Sau</button>`;pages.querySelector('[data-prev]').onclick=()=>{employeePage--;employees();};pages.querySelector('[data-next]').onclick=()=>{employeePage++;employees();};
 }catch(err){if(alive()&&current===employeeGeneration){employeesHost.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;employeesHost.querySelector('button').onclick=employees;}}}
 host.querySelector('[data-assignment-search]').oninput=()=>{clearTimeout(employeeTimer);++employeeGeneration;employeePage=1;employeesHost.innerHTML='<p role="status">Đang tìm nhân viên…</p>';employeeTimer=setTimeout(employees,300);};renderSelected();void employees();
 bindSave(host,{permission:()=>kpiConfigurationGrant('canNew'),reload:assignmentDialog,save:values=>apiKpiConfigurationSave('assignments',kpiAssignmentPayload(values,[...selected.keys()],periods,templates)),after:result=>{host.innerHTML=`<p role="status">Đã tạo ${e(result.created)} bộ KPI. Đã có sẵn: ${e(result.alreadyAssigned)}.</p><a class="btn" href="#/performance/kpi-results">Xem đánh giá KPI</a>`;host.querySelector('a').onclick=closeDialog;}});
 });}
 shell();return ()=>{disposeAssignments();disposed=true;++generation;++dialogGeneration;clearTimeout(timer);if(dialogHost?.isConnected)closeDialog();};
}


// Source: pages/performance/kpi-results.js

const kpiEvaluationStatuses={DRAFT:'Chưa bắt đầu',IN_PROGRESS:'Đang thực hiện',SUBMITTED:'Đã gửi tự đánh giá',REVIEWED:'Chờ phê duyệt',APPROVED:'Đã phê duyệt',REJECTED:'Đã từ chối'};
function kpiEvaluationGrant(flag,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_KPI_EVALUATION'&&p.canView==='Y'&&p[flag]==='Y');}
function kpiEvaluationCapabilities(detail,session=apiSession()){
 const target=detail.target,linked=session?.user?.employeeId,owner=linked!=null&&String(linked)===String(target.employeeId),reviewer=linked!=null&&String(linked)===String(target.reviewerEmployeeId)&&!owner,open=!detail.isClosed;
 return {start:open&&owner&&target.status==='DRAFT'&&kpiEvaluationGrant('canUpdate',session),edit:open&&owner&&target.status==='IN_PROGRESS'&&kpiEvaluationGrant('canUpdate',session),review:open&&reviewer&&target.status==='SUBMITTED'&&kpiEvaluationGrant('canApprove',session)};
}
function kpiApprovalCanDecide(detail,approval,session=apiSession()){
 const request=approval?.request,target=detail?.target;
 return !!target&&!detail.isClosed&&target.status==='REVIEWED'&&request?.id===target.approvalId&&request.requestType==='KPI_EVALUATION'&&Number(request.referenceId??request.referenceID)===target.id&&request.status==='PENDING'&&Number.isSafeInteger(request.version)&&request.version>0&&kpiEvaluationGrant('canApprove',session)&&!!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y'&&p.canApprove==='Y')&&!(session?.user?.employeeId!=null&&String(session.user.employeeId)===String(target.employeeId))&&!!approval.steps?.some(step=>Number(step.stepNo)===Number(request.currentStepNo)&&step.approverUserId===session?.user?.userId&&step.decision==='PENDING');
}
function kpiNumber(value){return value===null||value===undefined?'—':Number(value).toLocaleString('vi-VN',{maximumFractionDigits:4});}
function kpiEvidenceUrl(value){
 const text=String(value||'').trim();if(!text)return null;if(text.length>2000)throw Error('Liên kết bằng chứng tối đa 2000 ký tự.');let url;try{url=new URL(text);}catch{throw Error('Bằng chứng phải là liên kết HTTP(S) hợp lệ.');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('Bằng chứng phải dùng HTTP(S) và không chứa thông tin đăng nhập.');return text;
}
function kpiActualValue(value){const text=String(value??'').trim();if(!/^\d+(?:\.\d{1,4})?$/.test(text)||!Number.isFinite(Number(text))||Number(text)>999999999999)throw Error('Kết quả phải từ 0 đến 999999999999, tối đa 4 chữ số thập phân.');return Number(text);}
function kpiSavedResult(results,id){return results.find(item=>Number(item.criterionId??item.criterionID)===id);}
function kpiEvaluationDetailData(response){
 const data=response?.data;if(response?.success!==true||!data?.target||!Number.isSafeInteger(data.target.id)||!Number.isSafeInteger(data.target.version)||data.target.version<1||!Array.isArray(data.criteria)||!Array.isArray(data.results)||typeof data.isClosed!=='boolean')throw Error('Chi tiết KPI không hợp lệ.');
 const ids=new Set();for(const criterion of data.criteria){if(!Number.isSafeInteger(criterion.criterionId)||criterion.criterionId<1||ids.has(criterion.criterionId)||!criterion.metric)throw Error('Bộ chỉ tiêu KPI không hợp lệ.');ids.add(criterion.criterionId);}return data;
}
function kpiResultsComplete(detail){return detail.criteria.length>0&&detail.criteria.every(criterion=>{const result=kpiSavedResult(detail.results,criterion.criterionId);return result?.actualValue!==null&&result?.actualValue!==undefined;});}
function kpiResultsPayload(detail,values,{review=false,comment=''}={}){
 if(!Number.isSafeInteger(detail.target.version)||detail.target.version<1)throw Error('Thiếu phiên bản KPI.');const seen=new Set(),results=[];
 for(const value of values){const criterionId=Number(value.criterionId);if(seen.has(criterionId)||!detail.criteria.some(item=>item.criterionId===criterionId))throw Error('Chỉ tiêu không hợp lệ hoặc bị trùng.');seen.add(criterionId);if(String(value.actualValue??'').trim()===''){if(review)throw Error('Nhập kết quả quản lý cho đủ các chỉ tiêu.');continue;}
 const actualValue=kpiActualValue(value.actualValue),item={criterionId,actualValue};if(!review){const text=String(value.comment||'').trim();if(text.length>1000)throw Error('Nhận xét chỉ tiêu tối đa 1000 ký tự.');item.comment=text||null;item.evidenceUrl=kpiEvidenceUrl(value.evidenceUrl);}results.push(item);
 }
 if(!results.length)throw Error('Nhập ít nhất một kết quả trước khi lưu.');const payload={version:detail.target.version,results};
 if(review){if(results.length!==detail.criteria.length)throw Error('Nhập kết quả quản lý cho đủ các chỉ tiêu.');const text=String(comment||'').trim();if(!text||text.length>1000)throw Error('Nhận xét quản lý bắt buộc, tối đa 1000 ký tự.');payload.comment=text;}
 return payload;
}
function kpiListData(response){if(response?.success!==true||!Array.isArray(response.data)||!Number.isSafeInteger(response.total)||response.total<0||response.data.some(item=>!Number.isSafeInteger(item.id)||item.id<1||!Number.isSafeInteger(item.version)||item.version<1||item.finalScore!==null&&item.finalScore!==undefined&&!Number.isFinite(item.finalScore)))throw Error('Danh sách đánh giá KPI không hợp lệ.');return response;}
function kpiStatisticsMarkup(response=null,error=''){
 const data=response?.data;if(response&&(response.success!==true||!Number.isSafeInteger(data?.total)||data.total<0||!Array.isArray(data.statuses)||data.statuses.some(item=>!Number.isInteger(item.count)||item.count<0)||data.averageScore!==null&&!Number.isFinite(data.averageScore)))throw Error('Thống kê KPI không hợp lệ.');
 const cards=[['Tổng bộ KPI',data?data.total:'—'],['Đang thực hiện',data?data.statuses.find(item=>item.status==='IN_PROGRESS')?.count||0:'—'],['Chờ đánh giá',data?data.statuses.find(item=>item.status==='SUBMITTED')?.count||0:'—'],['Chờ phê duyệt',data?data.statuses.find(item=>item.status==='REVIEWED')?.count||0:'—'],['Điểm TB đã phê duyệt',data?kpiNumber(data.averageScore):'—']];
 return `${error?`<p role="alert">${e(error)}</p>`:''}<div class="kpi-results-stats">${cards.map(([label,value])=>`<article class="card"><span>${label}</span><strong>${e(value)}</strong></article>`).join('')}</div>`;
}
function kpiResultsRows(rows){return rows.map(row=>`<tr><td><strong>${e(row.employeeName)}</strong><small>${e(row.employeeCode)}</small></td><td>${e(row.departmentName)}<small>${e(row.teamName||'—')}</small></td><td>${e(row.periodKey)}</td><td><span class="badge ${row.status==='APPROVED'?'active':row.status==='REJECTED'?'high':''}">${e(kpiEvaluationStatuses[row.status]||row.status)}</span></td><td>${kpiNumber(row.finalScore)}</td><td><button class="btn small" type="button" data-kpi-detail="${row.id}">Chi tiết</button></td></tr>`).join('');}

function kpiRequestedEvaluationId(hash=globalThis.location?.hash||''){
 const [path,query]=hash.replace(/^#/,'').split('?');if(path!=='/performance/kpi-results')return null;
 const value=new URLSearchParams(query||'').get('evaluationId');if(!/^\d+$/.test(value||''))return null;const id=Number(value);return Number.isSafeInteger(id)&&id>0?id:null;
}

function mountKpiResults(root,{employeeFilter=false}={}){
 if(!root)return ()=>{};if(!kpiEvaluationGrant('canView')){root.innerHTML='<p>Bạn cần quyền WEB_KPI_EVALUATION/VIEW để xem đánh giá KPI.</p>';return ()=>{};}
 let filters={},page=1,generation=0,metadataGeneration=0,rows=[],teams=[],periods=[],employeePage=1,employeeGeneration=0,searchTimer,employeeTimer,dialogForm=null,disposed=false,detailGeneration=0,detailDirty=false,detailBusy=false;
 const pageSize=20,active=()=>!disposed&&root.isConnected;
 root.innerHTML=`<div data-kpi-statistics>${kpiStatisticsMarkup()}</div><form class="kpi-results-filters"><label>Kỳ KPI<select name="periodId"><option value="">Tất cả kỳ</option></select></label><label>Phòng ban<select name="departmentId"><option value="">Tất cả phòng ban</option></select></label><label>Team<select name="teamId"><option value="">Tất cả team</option></select></label><label>Trạng thái<select name="status"><option value="">Tất cả trạng thái</option>${Object.entries(kpiEvaluationStatuses).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label><label>Tìm kiếm<input name="search" type="search" placeholder="Mã hoặc tên nhân viên"></label>${employeeFilter?`<div class="kpi-employee-filter"><label>Tìm nhân viên<input type="search" data-kpi-employee-search placeholder="Mã hoặc tên để chọn nhân viên"></label><label>Nhân viên<select name="employeeId"><option value="">Tất cả nhân viên</option></select></label><div class="kpi-employee-pages" data-kpi-employee-pages></div></div>`:''}<button class="btn" type="submit">Lọc</button><button class="btn" type="button" data-kpi-refresh>Làm mới</button>${kpiEvaluationGrant('canExport')?`<button class="btn" type="button" data-kpi-export>${icon('download',16)} Xuất Excel</button>`:''}</form><div role="alert" data-kpi-filter-error></div><div data-kpi-content></div><div class="user-pagination contracts-pagination" data-kpi-pagination></div>`;
 const form=root.querySelector('form'),stats=root.querySelector('[data-kpi-statistics]'),content=root.querySelector('[data-kpi-content]'),pagination=root.querySelector('[data-kpi-pagination]'),filterError=root.querySelector('[data-kpi-filter-error]');
 async function load(){
 if(!active())return;const current=++generation;content.innerHTML='<div class="kpi-results-loading" role="status">Đang tải đánh giá KPI…</div>';pagination.innerHTML='';stats.innerHTML=kpiStatisticsMarkup();stats.setAttribute('aria-busy','true');const same=()=>active()&&current===generation;
 const listTask=apiKpiEvaluations({...filters,page,pageSize}).then(response=>{if(!same())return;const result=kpiListData(response);rows=result.data;content.innerHTML=`<div class="table-wrap"><table class="kpi-results-table"><thead><tr><th>Nhân viên</th><th>Phòng ban / Team</th><th>Kỳ KPI</th><th>Trạng thái</th><th>Điểm cuối</th><th></th></tr></thead><tbody>${kpiResultsRows(rows)}</tbody></table></div>${rows.length?'':'<div class="empty">Chưa có bộ KPI theo bộ lọc.</div>'}`;pagination.innerHTML=`<span>${result.total} bộ KPI · Trang ${page}/${Math.max(1,Math.ceil(result.total/pageSize))}</span><div><button class="btn" type="button" data-prev ${page===1?'disabled':''}>Trang trước</button><button class="btn" type="button" data-next ${page*pageSize>=result.total?'disabled':''}>Trang sau</button></div>`;pagination.querySelector('[data-prev]').onclick=()=>{page--;load();};pagination.querySelector('[data-next]').onclick=()=>{page++;load();};content.querySelectorAll('[data-kpi-detail]').forEach(button=>button.onclick=()=>openDetail(Number(button.dataset.kpiDetail)));}).catch(err=>{if(same()){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}});
 const statTask=apiKpiStatistics(filters).then(response=>{if(same())stats.innerHTML=kpiStatisticsMarkup(response);}).catch(err=>{if(same())stats.innerHTML=kpiStatisticsMarkup(null,err.message);}).finally(()=>{if(same())stats.removeAttribute('aria-busy');});await Promise.allSettled([listTask,statTask]);
 }
 function apply(){const values=Object.fromEntries(new FormData(form)),next={};for(const key of ['periodId','departmentId','teamId','employeeId'])if(values[key])next[key]=Number(values[key]);if(values.status)next.status=values.status;if(values.search.trim())next.search=values.search.trim();filters=next;page=1;load();}
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(searchTimer);apply();};
 for(const key of ['periodId','teamId','employeeId','status']){const input=form.elements.namedItem(key);if(input)input.onchange=apply;}
 form.elements.departmentId.onchange=()=>{form.elements.teamId.value='';setTeams();apply();};form.elements.search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(apply,300);};
 root.querySelector('[data-kpi-refresh]').onclick=()=>{clearTimeout(searchTimer);load();};
 function options(items,key,label,selected=''){return `<option value="">${label}</option>`+items.map(item=>`<option value="${e(item.id)}" ${String(item.id)===selected?'selected':''}>${e(item[key])}</option>`).join('');}
 function setTeams(){const selected=form.elements.teamId.value,department=form.elements.departmentId.value;form.elements.teamId.innerHTML=options(teams.filter(item=>!department||String(item.departmentId)===department),'teamName','Tất cả team',selected);}
 async function loadMetadata(){const current=++metadataGeneration;const results=await Promise.allSettled([apiKpiLookups(),(async()=>{const all=[];let page=1;while(true){const result=await apiKpiPeriods(page);if(!Array.isArray(result?.data)||!Number.isSafeInteger(result.total))throw Error('Danh sách kỳ KPI không hợp lệ.');all.push(...result.data);if(!result.data.length||all.length>=result.total)break;page++;}return all;})()]);if(!active()||current!==metadataGeneration)return;const errors=[];
 if(results[0].status==='fulfilled'){const lookup=results[0].value;if(Array.isArray(lookup.departments)&&Array.isArray(lookup.teams)){teams=lookup.teams;form.elements.departmentId.innerHTML=options(lookup.departments,'departmentName','Tất cả phòng ban',form.elements.departmentId.value);setTeams();}else errors.push('Danh mục phòng ban/team không hợp lệ.');}else errors.push(results[0].reason.message);
 if(results[1].status==='fulfilled'){periods=results[1].value;form.elements.periodId.innerHTML=options(periods.map(item=>({...item,label:item.code+(item.isClosed?' (Đã chốt)':'')})),'label','Tất cả kỳ',form.elements.periodId.value);}else errors.push(results[1].reason.message);
 filterError.innerHTML=errors.length?`${e(errors.join(' '))} <button class="btn" type="button">Tải lại danh mục</button>`:'';filterError.querySelector('button')?.addEventListener('click',loadMetadata);
 }
 async function loadEmployees(){const current=++employeeGeneration;const query=root.querySelector('[data-kpi-employee-search]').value.trim();try{const result=await apiKpiEmployees(query,employeePage);if(!active()||current!==employeeGeneration)return;if(!Array.isArray(result.data))throw Error('Danh sách nhân viên KPI không hợp lệ.');const select=form.elements.employeeId,selected=select.value,oldOption=select.selectedOptions[0];select.innerHTML='<option value="">Tất cả nhân viên</option>'+result.data.map(item=>`<option value="${e(item.id)}" ${String(item.id)===selected?'selected':''}>${e(item.employeeCode)} · ${e(item.fullName)}</option>`).join('');if(selected&&!result.data.some(item=>String(item.id)===selected)&&oldOption){select.appendChild(oldOption.cloneNode(true));select.value=selected;}const pages=root.querySelector('[data-kpi-employee-pages]');pages.innerHTML=`<button class="btn small" type="button" data-employee-prev ${employeePage===1?'disabled':''}>Trước</button><small>Trang ${employeePage}</small><button class="btn small" type="button" data-employee-next ${employeePage*20>=result.total?'disabled':''}>Sau</button>`;pages.querySelector('[data-employee-prev]').onclick=()=>{employeePage--;loadEmployees();};pages.querySelector('[data-employee-next]').onclick=()=>{employeePage++;loadEmployees();};}catch(err){if(active()&&current===employeeGeneration)filterError.textContent=err.message;}}
 if(employeeFilter)root.querySelector('[data-kpi-employee-search]').oninput=()=>{clearTimeout(employeeTimer);++employeeGeneration;employeePage=1;employeeTimer=setTimeout(loadEmployees,300);};
 root.querySelector('[data-kpi-export]')?.addEventListener('click',async event=>{if(!kpiEvaluationGrant('canExport'))return;const button=event.currentTarget;button.disabled=true;try{const blob=await apiKpiExport(filters),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='kpi.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất báo cáo KPI Excel.');}catch(err){toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}});
 async function openDetail(id){
 if(detailBusy)return;detailDirty=false;openDialog('Đánh giá KPI','<div id="kpi-evaluation-detail"><p role="status">Đang tải chi tiết KPI…</p></div>');const host=document.querySelector('#kpi-evaluation-detail');await fetchDetail(id,host);
 }
 async function fetchDetail(id,host){
 const current=++detailGeneration;host.innerHTML='<p role="status">Đang tải chi tiết KPI…</p>';
 try{const result=await apiKpiEvaluationDetail(id);if(!host.isConnected||!active()||current!==detailGeneration)return;const detail=kpiEvaluationDetailData(result);if(detail.target.id!==id)throw Error('Chi tiết KPI không đúng yêu cầu.');renderDetail(detail,host);}
 catch(err){if(host.isConnected&&current===detailGeneration){host.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Tải lại chi tiết</button>`;host.querySelector('button').onclick=()=>fetchDetail(id,host);}}
 }
 function renderDetail(detail,host){
 detailDirty=false;detailBusy=false;const target=detail.target,capabilities=kpiEvaluationCapabilities(detail),editable=capabilities.edit||capabilities.review;
 const criteria=detail.criteria.map(criterion=>{
 const result=kpiSavedResult(detail.results,criterion.criterionId),value=result?.actualValue??'',metric=criterion.metric;let evidence='';
 if(result?.evidenceUrl){try{const link=kpiEvidenceUrl(result.evidenceUrl);evidence=`<a href="${e(link)}" target="_blank" rel="noopener noreferrer">Xem bằng chứng</a>`;}catch{evidence='<span class="muted">Liên kết bằng chứng không hợp lệ.</span>';}}
 return `<section class="kpi-criterion" data-criterion="${criterion.criterionId}"><div class="kpi-criterion-heading"><h3>${e(metric.code)} · ${e(metric.name)}</h3><span class="tag">${kpiNumber(criterion.weightPercent)}%</span></div><p class="muted">Mục tiêu: ${kpiNumber(criterion.targetValue)} ${e(metric.unit)} · Điểm tối đa: ${kpiNumber(metric.maxScore)}</p><div class="kpi-criterion-scores"><span>Kết quả nhân viên: <strong>${kpiNumber(result?.actualValue)}</strong></span><span>Điểm tự đánh giá: <strong>${kpiNumber(result?.selfScore)}</strong></span><span>Điểm quản lý: <strong>${kpiNumber(result?.managerScore)}</strong></span></div><div class="form-grid">${field(capabilities.review?'Kết quả quản lý':'Kết quả thực tế',`actual-${criterion.criterionId}`,'number',value,`min="0" max="999999999999" step="0.0001" ${capabilities.review?'required':''}`)}${capabilities.review?`<div class="kpi-criterion-comment"><span>Nhận xét của nhân viên</span><p>${e(result?.comment||'—')}</p>${evidence}</div>`:`<label>Liên kết bằng chứng<input name="evidence-${criterion.criterionId}" type="url" maxlength="2000" value="${e(result?.evidenceUrl||'')}" placeholder="https://…"></label><label class="full">Nhận xét<textarea name="comment-${criterion.criterionId}" maxlength="1000">${e(result?.comment||'')}</textarea></label>${evidence?`<div>${evidence}</div>`:''}`}</div></section>`;
 }).join('');
 host.innerHTML=`<div class="kpi-detail-heading"><div><h2>${e(target.employeeName)}</h2><p>${e(target.employeeCode)} · ${e(target.periodKey)}</p></div><span class="badge ${target.status==='APPROVED'?'active':''}">${e(kpiEvaluationStatuses[target.status]||target.status)}</span></div><p class="muted">${e(target.departmentName)}${target.teamName?' · '+e(target.teamName):''}${detail.isClosed?' · Kỳ KPI đã chốt':''}</p><p class="kpi-final-score">Điểm cuối: <strong>${kpiNumber(target.finalScore)}</strong></p>${target.approvalId&&apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y')?`<p><a class="btn small" href="#/approvals?module=PERFORMANCE&approvalId=${target.approvalId}">Theo dõi phê duyệt #${target.approvalId}</a></p>`:''}<form id="kpi-results-detail-form" class="user-registration"><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}>${criteria}${capabilities.review?'<label>Nhận xét quản lý<textarea name="reviewComment" required maxlength="1000"></textarea></label>':''}</fieldset>${detail.reviewerComment?`<div class="kpi-manager-comment"><h3>Nhận xét quản lý</h3><p>${e(detail.reviewerComment)}</p></div>`:''}<div class="form-actions">${capabilities.start?'<button class="btn primary" type="submit" name="action" value="start">Bắt đầu thực hiện</button>':''}${capabilities.edit?`<button class="btn" type="submit" name="action" value="results">Lưu kết quả</button><button class="btn primary" type="submit" name="action" value="submit" ${kpiResultsComplete(detail)?'':'disabled'}>Gửi tự đánh giá</button>`:''}${capabilities.review?'<button class="btn primary" type="submit" name="action" value="review">Gửi đánh giá quản lý</button>':''}<button class="btn" type="button" data-kpi-reload>Tải lại chi tiết</button></div><p role="status" data-kpi-detail-feedback>${capabilities.edit?'Lưu các chỉ tiêu đã nhập trước khi gửi tự đánh giá. Điểm do máy chủ tính.':capabilities.review?'Nhập đủ kết quả quản lý và nhận xét để chuyển sang luồng phê duyệt.':''}</p></form><section class="kpi-approval-panel" data-kpi-approval></section><section class="kpi-history"><h3>Lịch sử KPI</h3>${(detail.history||[]).map(item=>`<article><strong>${e(item.action)}</strong><small>${e(item.actorUserId??item.actorUserID??'Hệ thống')} · ${e(dateLabel(item.createdAt))}</small></article>`).join('')||'<p class="muted">Chưa có lịch sử.</p>'}</section>`;
 const form=host.querySelector('form'),feedback=form.querySelector('[data-kpi-detail-feedback]'),fieldset=form.querySelector('fieldset'),reload=form.querySelector('[data-kpi-reload]');dialogForm=form;let stale=false;
 form.oninput=()=>{detailDirty=true;const submit=form.querySelector('[value=submit]');if(submit)submit.disabled=true;feedback.textContent='Có thay đổi chưa lưu.';};
 reload.onclick=()=>{if(detailBusy)return;if(detailDirty&&!confirm('Bỏ các thay đổi KPI chưa lưu để tải lại?'))return;detailDirty=false;fetchDetail(target.id,host);};
 form.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(detailBusy||stale)return;const action=event.submitter?.value||(capabilities.review?'review':'results'),current=kpiEvaluationCapabilities(detail);let payload={version:target.version};
 try{
 if(action==='start'&&!current.start||['results','submit'].includes(action)&&!current.edit||action==='review'&&!current.review)throw Error('Bạn không có quyền thực hiện thao tác KPI này.');
 if(action==='submit'&&(detailDirty||!kpiResultsComplete(detail)))throw Error('Lưu đủ kết quả của mọi chỉ tiêu trước khi gửi tự đánh giá.');
 if(action==='results'||action==='review'){const data=new FormData(form),values=detail.criteria.map(criterion=>({criterionId:criterion.criterionId,actualValue:data.get(`actual-${criterion.criterionId}`),comment:data.get(`comment-${criterion.criterionId}`),evidenceUrl:data.get(`evidence-${criterion.criterionId}`)}));payload=kpiResultsPayload(detail,values,{review:action==='review',comment:data.get('reviewComment')});}
 }catch(err){feedback.textContent=err.message;return;}
 detailBusy=true;fieldset.disabled=true;form.querySelectorAll('button').forEach(button=>button.disabled=true);feedback.textContent='Đang xử lý KPI…';
 try{const saved=await apiKpiEvaluationAction(target.id,action,payload);if(!form.isConnected||!active())return;if(saved?.success!==true)throw Error('Phản hồi thao tác KPI không hợp lệ. Tải lại chi tiết để xác nhận.');detailDirty=false;toast({start:'Đã bắt đầu thực hiện KPI.',results:'Đã lưu kết quả KPI.',submit:'Đã gửi tự đánh giá KPI.',review:'Đã gửi đánh giá quản lý vào luồng phê duyệt.'}[action]);detailBusy=false;void load();await fetchDetail(target.id,host);}
 catch(err){stale=err.status===409;if(form.isConnected)feedback.textContent=err.message+(stale?' Tải lại chi tiết trước khi thao tác tiếp.':'');}
 finally{detailBusy=false;if(form.isConnected){fieldset.disabled=stale||!editable;form.querySelectorAll('button').forEach(button=>button.disabled=stale);reload.disabled=false;const submit=form.querySelector('[value=submit]');if(submit)submit.disabled=stale||detailDirty||!kpiResultsComplete(detail);}}
 };
 void loadApproval(detail,host);
 }
 async function loadApproval(detail,host){
 const panel=host.querySelector('[data-kpi-approval]'),target=detail.target;if(!panel||!target.approvalId||target.status!=='REVIEWED')return;
 if(!apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y')){panel.innerHTML='<p class="muted">Xem và duyệt luồng KPI cần quyền WEB_APPROVALS/VIEW và APPROVE, cùng WEB_KPI_EVALUATION/APPROVE.</p>';return;}
 panel.innerHTML='<p role="status">Đang tải bước phê duyệt KPI…</p>';
 try{const approval=await apiWorkflowDetail('all',target.approvalId);if(!active()||!panel.isConnected)return;
 const request=approval?.request;if(request?.id!==target.approvalId||request.requestType!=='KPI_EVALUATION'||Number(request.referenceId??request.referenceID)!==target.id||!Array.isArray(approval.steps))throw Error('Thông tin phê duyệt không khớp bản ghi KPI. Tải lại chi tiết.');
 const canDecide=kpiApprovalCanDecide(detail,approval),canApprove=kpiEvaluationGrant('canApprove')&&apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVALS'&&p.canView==='Y'&&p.canApprove==='Y');
 panel.innerHTML=`<h3>Phê duyệt KPI</h3><p class="muted">Bước hiện tại: ${e(request.currentStepNo??'—')}</p>${approval.steps.map(step=>`<p>Bước ${e(step.stepNo)} · ${e(step.approverUserId)} · ${e(({PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Từ chối'})[step.decision]||step.decision)}</p>`).join('')}${canDecide?'<form data-kpi-decision-form novalidate><label>Lý do / Nhận xét<textarea name="reason" required maxlength="1000"></textarea></label><div class="form-actions"><button class="btn danger" type="submit" value="reject">Từ chối</button><button class="btn primary" type="submit" value="approve">Phê duyệt</button></div><p role="alert" data-kpi-decision-feedback></p></form>':`<p class="muted">${detail.isClosed?'Kỳ KPI đã chốt.':!canApprove?'Cần quyền Phê duyệt.':(apiSession()?.user?.employeeId!=null&&String(apiSession().user.employeeId)===String(target.employeeId))?'Bạn không thể duyệt KPI của chính mình.':'Chỉ người được giao ở bước đang chờ mới có thể phê duyệt.'}</p>`}`;
 const decisionForm=panel.querySelector('form');if(!decisionForm)return;let stale=false;const feedback=decisionForm.querySelector('[data-kpi-decision-feedback]');
 decisionForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(detailBusy||stale)return;
 const action=event.submitter?.value,reason=decisionForm.elements.reason.value.trim();if(!['approve','reject'].includes(action)||!kpiApprovalCanDecide(detail,approval)){feedback.textContent='Bạn không có quyền duyệt ở bước hiện tại.';return;}if(!reason||reason.length>1000){feedback.textContent='Nhập lý do hoặc nhận xét, tối đa 1000 ký tự.';toast(feedback.textContent,{type:'error'});decisionForm.elements.reason.focus();return;}
 detailBusy=true;decisionForm.querySelectorAll('button,textarea').forEach(control=>control.disabled=true);host.querySelectorAll('#kpi-results-detail-form button').forEach(button=>button.disabled=true);feedback.textContent='Đang xử lý phê duyệt…';
 try{await apiWorkflowAction('all',request.id,action,{version:request.version,reason});if(!active()||!decisionForm.isConnected)return;toast(action==='approve'?'Đã phê duyệt KPI.':'Đã từ chối KPI.');detailBusy=false;void load();await fetchDetail(target.id,host);}
 catch(err){stale=err.status===409;if(decisionForm.isConnected)feedback.textContent=err.message+(stale?' Tải lại chi tiết trước khi tiếp tục.':'');}
 finally{detailBusy=false;if(decisionForm.isConnected){decisionForm.querySelectorAll('button,textarea').forEach(control=>control.disabled=stale);host.querySelectorAll('#kpi-results-detail-form button').forEach(button=>button.disabled=false);}}
 };
 }catch(err){if(active()&&panel.isConnected){panel.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Tải lại bước duyệt</button>`;panel.querySelector('button').onclick=()=>{if(!detailBusy)loadApproval(detail,host);};}}
 }
 void loadMetadata();if(employeeFilter)void loadEmployees();void load();const requestedId=kpiRequestedEvaluationId();if(requestedId!==null)void openDetail(requestedId);
 return ()=>{disposed=true;++generation;++metadataGeneration;++employeeGeneration;++detailGeneration;clearTimeout(searchTimer);clearTimeout(employeeTimer);if(dialogForm?.isConnected)closeDialog();};
}


// Source: pages/attendance/attendance-management.js

const attendanceManagementStatuses={NOT_CHECKED_IN:'Chưa chấm công',WORKING:'Đang làm việc',COMPLETE:'Đã hoàn tất',MISSING_CHECK_IN:'Thiếu giờ vào',MISSING_CHECK_OUT:'Thiếu giờ ra',ABSENT:'Vắng mặt',ON_LEAVE:'Nghỉ phép',DAY_OFF:'Ngày nghỉ',HOLIDAY:'Ngày lễ',NO_SCHEDULE:'Chưa phân ca',LEGACY_UNVERIFIED:'Chưa xác minh lịch cũ',LATE:'Đi trễ',EARLY:'Về sớm'};
const attendanceManagementMetrics={employees:'Nhân viên',scheduled:'Có lịch',checkedIn:'Đã vào ca',working:'Đang làm việc',late:'Đi trễ',early:'Về sớm',notPunched:'Chưa chấm công',onLeave:'Nghỉ phép',absent:'Vắng mặt',missingCheckOut:'Thiếu giờ ra'};
function attendanceManagementGrant(flag,session=apiSession(),own=false){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code===(own?'WEB_MY_ATTENDANCE':'WEB_ATTENDANCE')&&p.canView==='Y'&&p[flag]==='Y');}
function attendanceAdjustmentGrant(session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_ATTENDANCE_ADJUSTMENTS'&&p.canView==='Y'&&p.canNew==='Y');}
function attendanceManagementToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function attendanceManagementDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='1900-01-01'&&value<='9998-12-31'&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function attendanceManagementDaysBefore(value,days){const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()-days);return date.toISOString().slice(0,10);}
function attendanceManagementValidateQuery(values){
 const query={};if(values.date){if(values.from||values.to||!attendanceManagementDate(values.date))throw Error('Chọn ngày hoặc khoảng ngày hợp lệ, không dùng đồng thời.');query.date=values.date;}else{if(!attendanceManagementDate(values.from)||!attendanceManagementDate(values.to)||values.to<values.from||(Date.parse(values.to)-Date.parse(values.from))/86400000>=31)throw Error('Khoảng chấm công phải từ 1 đến 31 ngày trong năm 1900–9998.');query.from=values.from;query.to=values.to;}
 for(const key of ['departmentId','teamId','employeeId'])if(values[key]!==undefined&&values[key]!==''){const id=Number(values[key]);if(!Number.isSafeInteger(id)||id<1)throw Error('Bộ lọc nhân viên, phòng ban hoặc team không hợp lệ.');query[key]=id;}
 if(values.status){if(!Object.hasOwn(attendanceManagementStatuses,values.status))throw Error('Trạng thái chấm công không hợp lệ.');query.status=values.status;}
 if(values.search?.trim())query.search=values.search.trim();return query;
}
function attendanceManagementUtc(value){if(!value)return NaN;return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)?value:value+'Z');}
function attendanceManagementTime(value){const time=attendanceManagementUtc(value);return Number.isFinite(time)?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short',hour12:false}).format(new Date(time)):'—';}
function attendanceLocalInput(value){const time=attendanceManagementUtc(value);if(!Number.isFinite(time))return '';return new Date(time+7*3600000).toISOString().slice(0,16);}
function attendanceManagementPage(response){
 if(response?.success!==true||!Number.isSafeInteger(response.total)||response.total<0||!Array.isArray(response.data)||!Number.isFinite(attendanceManagementUtc(response.asOfUtc)))throw Error('Dữ liệu chấm công không hợp lệ.');
 if(response.data.some(row=>!Number.isSafeInteger(row.employeeId)||row.employeeId<1||!attendanceManagementDate(row.workDate)||typeof row.status!=='string'))throw Error('Chi tiết chấm công không hợp lệ.');return response;
}
function attendanceStatisticsMarkup(result=null,error=''){
 if(result&&(result.success!==true||!Object.keys(attendanceManagementMetrics).every(key=>Number.isSafeInteger(result[key])&&result[key]>=0)))throw Error('Thống kê chấm công không hợp lệ.');
 return `${error?`<p role="alert">${e(error)}</p>`:''}<div class="attendance-metrics">${Object.entries(attendanceManagementMetrics).map(([key,label])=>`<article class="card attendance-metric"><span>${label}</span><strong>${result?result[key]:'—'}</strong></article>`).join('')}</div>`;
}
function attendanceCanPunch(row,action,asOfUtc,session=apiSession()){
 if(!['check-in','check-out'].includes(action)||!row.scheduleId||row.snapshotMissing||row.isPeriodLocked||row.isOnLeave||row.status==='ON_LEAVE'||!attendanceManagementGrant('canUpdate',session,true))return false;
 if(action==='check-in'&&row.checkInAtUtc||action==='check-out'&&(row.checkOutAtUtc||!row.checkInAtUtc&&row.missingPunchRule!=='INCOMPLETE'))return false;
 const now=attendanceManagementUtc(asOfUtc),open=attendanceManagementUtc(action==='check-in'?row.checkInOpenUtc:row.checkOutOpenUtc),close=attendanceManagementUtc(action==='check-in'?row.checkInCloseUtc:row.checkOutCloseUtc);return Number.isFinite(now)&&Number.isFinite(open)&&Number.isFinite(close)&&now>=open&&now<=close;
}
function attendanceCanAdjust(row,{own=false,session=apiSession()}={}){return !!(attendanceAdjustmentGrant(session)&&(own||String(session?.user?.employeeId)===String(row.employeeId))&&row.scheduleId&&!row.snapshotMissing&&!row.isPeriodLocked);}
function attendancePunchPayload(row,values,requestKey){
 if(!Number.isSafeInteger(row.scheduleId)||row.scheduleId<1||!requestKey||requestKey.length>100)throw Error('Lịch hoặc mã thao tác chấm công không hợp lệ.');const payload={scheduleId:row.scheduleId,requestKey};
 if(row.requireQr){const qrSessionId=Number(values.qrSessionId),qrToken=String(values.qrToken||'').trim();if(!Number.isSafeInteger(qrSessionId)||qrSessionId<1||!qrToken||qrToken.length>512)throw Error('Nhập phiên QR và mã QR hợp lệ.');payload.qrSessionId=qrSessionId;payload.qrToken=qrToken;}
 if(row.requireGps){const latitude=values.latitude,longitude=values.longitude;if(typeof latitude!=='number'||typeof longitude!=='number'||!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)throw Error('Cần vị trí GPS hợp lệ để chấm công.');payload.latitude=latitude;payload.longitude=longitude;}
 return payload;
}
function attendanceAdjustmentPayload(row,values){
 const reason=String(values.reason||'').trim();if(!reason||reason.length>1000)throw Error('Lý do bắt buộc, tối đa 1000 ký tự.');
 const parse=value=>{if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!attendanceManagementDate(value.slice(0,10))||Number(value.slice(11,13))>23||Number(value.slice(14,16))>59)throw Error('Giờ đề xuất không hợp lệ.');return value+':00+07:00';};
 const proposedCheckIn=parse(values.proposedCheckIn),proposedCheckOut=parse(values.proposedCheckOut);if(!proposedCheckIn&&!proposedCheckOut)throw Error('Nhập ít nhất một giờ đề xuất.');if(proposedCheckIn&&proposedCheckOut&&Date.parse(proposedCheckOut)<=Date.parse(proposedCheckIn))throw Error('Giờ ra phải sau giờ vào.');
 const id=row.attendanceId||row.scheduleId;if(!Number.isSafeInteger(id)||id<1)throw Error('Chưa có lịch để tạo phiếu điều chỉnh.');return {[row.attendanceId?'attendanceId':'scheduleId']:id,proposedCheckIn,proposedCheckOut,reason};
}
function attendanceRequestKey(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const bytes=new Uint8Array(16);if(!globalThis.crypto?.getRandomValues)throw Error('Trình duyệt không hỗ trợ tạo mã chấm công.');globalThis.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
function attendanceManagementRows(rows,{own=false,asOfUtc,session=apiSession()}={}){
 return rows.map((row,index)=>`<tr><td><strong>${e(row.employeeName)}</strong><small>${e(row.employeeCode)}</small>${!own?`<small>${e(row.departmentName)}${row.teamName?' · '+e(row.teamName):''}</small>`:''}</td><td>${dateLabel(row.workDate)}<small>${e(row.shiftCode||'Chưa phân ca')}</small>${row.shiftStartAtUtc?`<small>${e(attendanceManagementTime(row.shiftStartAtUtc))} – ${e(attendanceManagementTime(row.shiftEndAtUtc))}</small>`:''}</td><td>${e(attendanceManagementTime(row.checkInAtUtc))}</td><td>${e(attendanceManagementTime(row.checkOutAtUtc))}</td><td>${row.workedMinutes===null||row.workedMinutes===undefined?'—':e(row.workedMinutes)+' phút'}</td><td><span class="badge ${row.status==='COMPLETE'?'active':row.status==='ABSENT'?'high':''}">${e(attendanceManagementStatuses[row.status]||row.status)}</span>${row.isLate?`<small class="attendance-violation">Đi trễ: ${e(row.lateMinutes)} phút</small>`:''}${row.isEarly?`<small class="attendance-violation">Về sớm: ${e(row.earlyMinutes)} phút</small>`:''}${row.isPeriodLocked?'<small>Kỳ công đã khóa</small>':''}${row.snapshotMissing?'<small>Thiếu snapshot lịch</small>':''}</td><td><div class="attendance-row-actions">${own&&attendanceCanPunch(row,'check-in',asOfUtc,session)?`<button type="button" class="btn primary small" data-attendance-punch="check-in" data-row-index="${index}">Check-in</button>`:''}${own&&attendanceCanPunch(row,'check-out',asOfUtc,session)?`<button type="button" class="btn primary small" data-attendance-punch="check-out" data-row-index="${index}">Check-out</button>`:''}<button type="button" class="btn small" data-attendance-detail="${index}">Chi tiết</button>${attendanceCanAdjust(row,{own,session})?`<button type="button" class="btn small" data-attendance-adjust="${index}">Tạo phiếu điều chỉnh</button>`:''}</div></td></tr>`).join('');
}

function mountAttendanceManagement(root,{own=false}={}){
 if(!root)return ()=>{};
 if(!attendanceManagementGrant('canView',apiSession(),own)){root.innerHTML=`<p>Bạn chưa có quyền ${own?'WEB_MY_ATTENDANCE':'WEB_ATTENDANCE'}/VIEW để xem chấm công.</p>`;return ()=>{};}
 const today=attendanceManagementToday();let filters=own?{from:attendanceManagementDaysBefore(today,1),to:today}:{date:today},page=1,generation=0,rows=[],asOfUtc=null,searchTimer,drawer=null,disposed=false;
 const pageSize=20,active=()=>!disposed&&root.isConnected;
 root.innerHTML=`${!own?`<div data-attendance-statistics>${attendanceStatisticsMarkup()}</div>`:''}<form class="attendance-filters"><label>Khoảng xem<select name="dateMode"><option value="day" ${own?'':'selected'}>Theo ngày</option><option value="range" ${own?'selected':''}>Khoảng ngày</option></select></label><div data-attendance-date="day">${field('Ngày công','date','date',today,'min="1900-01-01" max="9998-12-31"')}</div><div data-attendance-date="range">${field('Từ ngày','from','date',own?attendanceManagementDaysBefore(today,1):today,'min="1900-01-01" max="9998-12-31"')}</div><div data-attendance-date="range">${field('Đến ngày','to','date',today,'min="1900-01-01" max="9998-12-31"')}</div>${!own?'<label>Phòng ban<select name="departmentId"><option value="">Tất cả phòng ban</option></select></label><label>Team<select name="teamId"><option value="">Tất cả team</option></select></label><label>ID nhân viên<input name="employeeId" type="number" min="1" step="1" placeholder="Tất cả"></label><label>Mã hoặc tên nhân viên<input type="search" name="search" placeholder="Tìm nhân viên"></label>':''}<label>Trạng thái<select name="status"><option value="">Tất cả</option>${Object.entries(attendanceManagementStatuses).map(([code,label])=>`<option value="${code}">${label}</option>`).join('')}</select></label><button type="submit" class="btn">Lọc</button><button type="button" class="btn" data-attendance-refresh>Làm mới</button>${!own&&attendanceManagementGrant('canExport')?`<button type="button" class="btn" data-attendance-export>${icon('download',16)} Xuất Excel</button>`:''}</form><p role="alert" data-attendance-filter-error></p><p class="muted" data-attendance-asof></p><div data-attendance-content></div><div class="user-pagination contracts-pagination" data-attendance-pagination></div>`;
 const form=root.querySelector('form'),content=root.querySelector('[data-attendance-content]'),pagination=root.querySelector('[data-attendance-pagination]'),filterError=root.querySelector('[data-attendance-filter-error]'),stats=root.querySelector('[data-attendance-statistics]');
 function syncDateFields(){root.querySelectorAll('[data-attendance-date]').forEach(wrapper=>{const visible=wrapper.dataset.attendanceDate===form.elements.dateMode.value;wrapper.hidden=!visible;wrapper.querySelectorAll('input').forEach(input=>{input.disabled=!visible;input.required=visible;});});}syncDateFields();
 const query=()=>({...filters,page,pageSize});
 function draw(){
 content.innerHTML=`<div class="table-wrap"><table class="attendance-management-table"><thead><tr><th>Nhân viên</th><th>Ngày / Ca</th><th>Giờ vào</th><th>Giờ ra</th><th>Thời gian làm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${attendanceManagementRows(rows,{own,asOfUtc})}</tbody></table></div>${rows.length?'':'<div class="empty">Không có dữ liệu chấm công theo bộ lọc.</div>'}`;
 content.querySelectorAll('[data-attendance-detail]').forEach(button=>button.onclick=()=>openDetail(rows[Number(button.dataset.attendanceDetail)]));
 content.querySelectorAll('[data-attendance-adjust]').forEach(button=>button.onclick=()=>openAdjustment(rows[Number(button.dataset.attendanceAdjust)]));
 content.querySelectorAll('[data-attendance-punch]').forEach(button=>button.onclick=()=>openPunch(rows[Number(button.dataset.rowIndex)],button.dataset.attendancePunch));
 }
 async function load(){
 if(!active())return;const current=++generation;rows=[];content.innerHTML='<div class="attendance-loading" role="status">Đang tải dữ liệu chấm công…</div>';pagination.innerHTML='';root.querySelector('[data-attendance-asof]').textContent='';
 const same=()=>active()&&current===generation;
 const dailyTask=(own?apiMyAttendance:apiAttendanceDaily)(query()).then(response=>{if(!same())return;const result=attendanceManagementPage(response);rows=result.data;asOfUtc=result.asOfUtc;root.querySelector('[data-attendance-asof]').textContent='Cập nhật: '+attendanceManagementTime(asOfUtc);draw();pagination.innerHTML=`<span>${result.total} dòng công · Trang ${page}/${Math.max(1,Math.ceil(result.total/pageSize))}</span><div><button type="button" class="btn" data-prev ${page<=1?'disabled':''}>Trang trước</button><button type="button" class="btn" data-next ${page*pageSize>=result.total?'disabled':''}>Trang sau</button></div>`;pagination.querySelector('[data-prev]').onclick=()=>{page--;load();};pagination.querySelector('[data-next]').onclick=()=>{page++;load();};}).catch(err=>{if(same()){content.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;content.querySelector('button').onclick=load;}});
 let statsTask=Promise.resolve();
 if(!own){stats.innerHTML=attendanceStatisticsMarkup();stats.setAttribute('aria-busy','true');statsTask=apiAttendanceStatistics(filters).then(response=>{if(same())stats.innerHTML=attendanceStatisticsMarkup(response);}).catch(err=>{if(same())stats.innerHTML=attendanceStatisticsMarkup(null,err.message);}).finally(()=>{if(same())stats.removeAttribute('aria-busy');});}
 await Promise.allSettled([dailyTask,statsTask]);
 }
 function apply(){syncDateFields();if(!form.reportValidity())return;try{const data=Object.fromEntries(new FormData(form));filters=attendanceManagementValidateQuery(data);page=1;filterError.textContent='';load();}catch(err){filterError.textContent=err.message;}}
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(searchTimer);apply();};form.elements.dateMode.onchange=apply;for(const name of ['date','from','to','departmentId','teamId','status','employeeId'])if(form.elements.namedItem(name))form.elements.namedItem(name).onchange=apply;
 if(!own){form.elements.search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(apply,300);};form.elements.departmentId.onchange=()=>{form.elements.teamId.value='';apply();};}
 root.querySelector('[data-attendance-refresh]').onclick=()=>{clearTimeout(searchTimer);load();};
 root.querySelector('[data-attendance-export]')?.addEventListener('click',async event=>{
 if(!attendanceManagementGrant('canExport'))return;const button=event.currentTarget;button.disabled=true;
 try{const blob=await apiAttendanceExport(filters),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='attendance.xlsx';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất báo cáo chấm công Excel.');}catch(err){toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}
 });
 async function loadFilters(){
 try{const result=await apiAttendanceFilters();if(!active())return;if(!Array.isArray(result.departments)||!Array.isArray(result.teams))throw Error('Danh mục lọc chấm công không hợp lệ.');for(const [key,items,label] of [['departmentId',result.departments,'Tất cả phòng ban'],['teamId',result.teams,'Tất cả team']]){const select=form.elements.namedItem(key),value=select.value;select.innerHTML=`<option value="">${label}</option>`+items.map(item=>`<option value="${e(item.id)}" ${String(item.id)===value?'selected':''}>${e(item.name)}</option>`).join('');}}
 catch(err){if(active()){filterError.innerHTML=`${e(err.message)} <button type="button" class="btn">Tải lại danh mục</button>`;filterError.querySelector('button').onclick=loadFilters;}}
 }
 async function openDetail(row){
 if(drawer){const previous=drawer;drawer=null;previous.close();previous.remove();}const dialog=document.createElement('dialog');dialog.className='attendance-detail-drawer';dialog.setAttribute('aria-label','Chi tiết chấm công');dialog.innerHTML=`<div class="attendance-drawer-heading"><h2>Chi tiết chấm công</h2><button type="button" class="icon-button" data-attendance-drawer-close aria-label="Đóng">${icon('close',18)}</button></div><div class="attendance-drawer-body"><p role="status">Đang tải chi tiết…</p></div>`;drawer=dialog;document.body.appendChild(dialog);dialog.showModal();dialog.querySelector('[data-attendance-drawer-close]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{if(drawer===dialog)drawer=null;dialog.remove();});const panel=dialog.querySelector('.attendance-drawer-body');
 try{const result=await apiAttendanceDetail(row);if(!dialog.isConnected||!active())return;const item=result.attendance,rules=result.rules;
 if(!item||item.employeeId!==row.employeeId||item.workDate!==row.workDate)throw Error('Chi tiết chấm công không hợp lệ.');
 const pairs=[['Mã nhân viên',item.employeeCode],['Nhân viên',item.employeeName],['Phòng ban',item.departmentName],['Team',item.teamName||'—'],['Ngày công',dateLabel(item.workDate)],['Ca',item.shiftCode||'Chưa phân ca'],['Trạng thái',attendanceManagementStatuses[item.status]||item.status],['Giờ vào thực tế',attendanceManagementTime(item.checkInAtUtc)],['Giờ ra thực tế',attendanceManagementTime(item.checkOutAtUtc)],['Thời gian làm',item.workedMinutes==null?'—':item.workedMinutes+' phút'],['Đi trễ',(item.lateMinutes||0)+' phút'],['Về sớm',(item.earlyMinutes||0)+' phút'],['Kỳ công',item.isPeriodLocked?'Đã khóa':'Chưa khóa']];
 panel.innerHTML=`<dl class="attendance-detail-grid">${pairs.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>${rules?`<h3>Quy tắc đã lưu của ca</h3><dl class="attendance-detail-grid">${[['Bắt đầu ca',attendanceManagementTime(rules.startAtUtc)],['Kết thúc ca',attendanceManagementTime(rules.endAtUtc)],['Cửa sổ vào',attendanceManagementTime(rules.checkInOpenUtc)+' – '+attendanceManagementTime(rules.checkInCloseUtc)],['Cửa sổ ra',attendanceManagementTime(rules.checkOutOpenUtc)+' – '+attendanceManagementTime(rules.checkOutCloseUtc)],['Nghỉ giữa ca',rules.breakMinutes+' phút'],['Bằng chứng',[rules.requireQr?'QR':'',rules.requireGps?'GPS':''].filter(Boolean).join(', ')||'Không yêu cầu']].map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${e(value)}</dd></div>`).join('')}</dl>`:'<p class="muted">Chưa có snapshot ca hợp lệ.</p>'}${attendanceCanAdjust(item,{own})?'<button type="button" class="btn primary" data-create-adjustment>Tạo phiếu điều chỉnh</button>':''}<h3>Phiếu điều chỉnh gần nhất</h3>${(result.adjustments||[]).map(adjustment=>`<article class="attendance-adjustment-item"><strong>${e(adjustment.status)}</strong><p>${e(adjustment.reason)}</p><small>Vào: ${e(attendanceManagementTime(adjustment.proposedCheckIn))} · Ra: ${e(attendanceManagementTime(adjustment.proposedCheckOut))}</small></article>`).join('')||'<p class="muted">Chưa có phiếu điều chỉnh.</p>'}`;
 panel.querySelector('[data-create-adjustment]')?.addEventListener('click',()=>openAdjustment(item));
 }catch(err){if(dialog.isConnected)panel.innerHTML=`<p role="alert">${e(err.message)}</p>`;}
 }
 function openAdjustment(row){
 if(!attendanceCanAdjust(row,{own}))return;
 openDialog('Tạo phiếu điều chỉnh công',`<p>${e(row.employeeCode)} · ${dateLabel(row.workDate)} · ${e(row.shiftCode)}</p><form id="attendance-adjustment-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Giờ vào đề xuất','proposedCheckIn','datetime-local',attendanceLocalInput(row.checkInAtUtc))}${field('Giờ ra đề xuất','proposedCheckOut','datetime-local',attendanceLocalInput(row.checkOutAtUtc))}</div><p class="muted">Nhập theo giờ Việt Nam. Để trống một giờ khi đề xuất xóa giờ đó. Giờ thực tế chỉ đổi sau khi được phê duyệt.</p><label>Lý do<textarea name="reason" required maxlength="1000"></textarea></label><div class="form-actions"><button type="submit" class="btn primary">Gửi phiếu điều chỉnh</button></div></fieldset><p role="alert"></p></form>`);
 const adjustmentForm=document.querySelector('#attendance-adjustment-form'),fieldset=adjustmentForm.querySelector('fieldset'),feedback=adjustmentForm.querySelector('[role=alert]');let busy=false;
 adjustmentForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||!attendanceCanAdjust(row,{own}))return;let payload;try{payload=attendanceAdjustmentPayload(row,Object.fromEntries(new FormData(adjustmentForm)));}catch(err){feedback.textContent=err.message;return;}
 busy=true;fieldset.disabled=true;
 try{await apiCreateWorkflow('adjustment',payload);if(!adjustmentForm.isConnected)return;closeDialog();if(drawer){drawer.close();drawer=null;}toast('Đã gửi phiếu điều chỉnh công để phê duyệt.');if(active())load();}catch(err){if(adjustmentForm.isConnected)feedback.textContent=err.message;}finally{busy=false;if(adjustmentForm.isConnected)fieldset.disabled=false;}
 };
 }
 function openPunch(row,action){
 if(!own||!attendanceCanPunch(row,action,asOfUtc))return;
 let requestKey;try{requestKey=attendanceRequestKey();}catch(err){toast(err.message,{type:'error'});return;}
 openDialog(action==='check-in'?'Check-in':'Check-out',`<p>${dateLabel(row.workDate)} · ${e(row.shiftCode)}</p><form id="attendance-punch-form" class="user-registration"><fieldset class="user-edit-fieldset">${row.requireQr?`<div class="form-grid">${field('Mã phiên QR','qrSessionId','number','','required min="1" step="1"')}${field('Mã QR','qrToken','text','','required maxlength="512" autocomplete="off"')}</div>`:''}${row.requireGps?'<p>Ca này yêu cầu GPS. Cho phép trình duyệt lấy vị trí khi xác nhận chấm công.</p>':''}<p class="muted">Thời điểm chấm công do máy chủ ghi nhận.</p><div class="form-actions"><button class="btn primary" type="submit">${action==='check-in'?'Xác nhận vào ca':'Xác nhận ra ca'}</button></div></fieldset><p role="status"></p></form>`);
 const punchForm=document.querySelector('#attendance-punch-form'),fieldset=punchForm.querySelector('fieldset'),feedback=punchForm.querySelector('[role=status]');let busy=false;
 punchForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||!attendanceCanPunch(row,action,asOfUtc))return;
 const data=Object.fromEntries(new FormData(punchForm));busy=true;fieldset.disabled=true;feedback.textContent=row.requireGps?'Đang lấy vị trí GPS…':'Đang chấm công…';
 try{if(row.requireGps){if(!globalThis.navigator?.geolocation)throw Error('Trình duyệt không hỗ trợ GPS.');const location=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,()=>reject(Error('Không lấy được vị trí GPS. Hãy kiểm tra quyền vị trí và thử lại.')),{enableHighAccuracy:true,timeout:15000,maximumAge:0}));data.latitude=location.coords.latitude;data.longitude=location.coords.longitude;}
 if(!punchForm.isConnected)return;const payload=attendancePunchPayload(row,data,requestKey);await apiAttendancePunch(action,payload);if(!punchForm.isConnected)return;closeDialog();toast(action==='check-in'?'Đã check-in thành công.':'Đã check-out thành công.');if(active())load();
 }catch(err){if(punchForm.isConnected)feedback.textContent=err.message;}finally{busy=false;if(punchForm.isConnected)fieldset.disabled=false;}
 };
 }
 if(!own)void loadFilters();void load();
 return ()=>{disposed=true;++generation;clearTimeout(searchTimer);if(drawer){const previous=drawer;drawer=null;previous.close();previous.remove();}};
}


// Source: pages/work/work-schedules.js

function workScheduleGrant(flag,session=apiSession()){
 const actions={canNew:'NEW',canUpdate:'UPDATE',canDelete:'DELETE',canExport:'EXPORT'};
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_WORK_SCHEDULES'&&p.canView==='Y'&&p[flag]==='Y'&&(!['canNew','canUpdate','canDelete'].includes(flag)||p.dataScopes?.[actions[flag]]!=='SELF'));
}
const workScheduleToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function workScheduleDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
function workScheduleAddDays(value,days){const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
function workScheduleRange(anchor,mode='week'){
 if(!workScheduleDate(anchor))throw Error('Ngày lịch không hợp lệ.');const date=new Date(anchor+'T00:00:00Z');
 if(mode==='month'){const from=anchor.slice(0,7)+'-01',last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0));return {from,to:last.toISOString().slice(0,10)};}
 const from=workScheduleAddDays(anchor,-((date.getUTCDay()+6)%7));return {from,to:workScheduleAddDays(from,6)};
}
function workScheduleDays(from,to){if(!workScheduleDate(from)||!workScheduleDate(to)||to<from)throw Error('Khoảng ngày không hợp lệ.');const count=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;if(count>92)throw Error('Khoảng ngày tối đa 92 ngày.');return Array.from({length:count},(_,index)=>workScheduleAddDays(from,index));}
function workScheduleColor(id){return ['#2563eb','#8b5cf6','#0f8b77','#b87516','#d44d66','#5262a3'][Math.abs(Number(id))%6];}
function workScheduleCalendarData(data){
 if(data?.success!==true||!Number.isSafeInteger(data.total)||data.total<0||!['employees','schedules','shifts','departments','teams','holidayDates'].every(key=>Array.isArray(data[key])))throw Error('Lịch phân ca trả về không hợp lệ.');
 const employees=new Set(data.employees.map(item=>item.id));
 if(data.schedules.some(item=>!employees.has(item.employeeId)||!workScheduleDate(item.workDate)||!Number.isSafeInteger(item.id)||!Number.isSafeInteger(item.version)))throw Error('Chi tiết lịch phân ca không hợp lệ.');return data;
}
function workScheduleBatchPayload(values,{operationId,today=workScheduleToday()}={}){
 const target=values.target,from=values.from,to=values.to,dates=workScheduleDays(from,to),positive=value=>{const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw Error('Chọn đối tượng và ca làm việc hợp lệ.');return id;};
 if(from<today)throw Error('Ngày phân ca mới không được ở quá khứ.');if(!['ALL','DEPARTMENT','TEAM','EMPLOYEE'].includes(target))throw Error('Đối tượng phân ca không hợp lệ.');
 const weekdays=(values.weekdays||[]).map(Number);if(!weekdays.length||new Set(weekdays).size!==weekdays.length||weekdays.some(day=>!Number.isInteger(day)||day<1||day>7))throw Error('Chọn các thứ trong tuần hợp lệ, không trùng.');
 const payload={operationId,target,employeeIds:[],from,to,weekdays,excludeHolidays:!!values.excludeHolidays,overwrite:!!values.overwrite};
 if(target==='DEPARTMENT')payload.departmentId=positive(values.departmentId);if(target==='TEAM')payload.teamId=positive(values.teamId);
 if(target==='EMPLOYEE'){payload.employeeIds=(values.employeeIds||[]).map(positive);if(!payload.employeeIds.length||payload.employeeIds.length>500||new Set(payload.employeeIds).size!==payload.employeeIds.length)throw Error('Chọn từ 1 đến 500 nhân viên, không trùng.');const selectedDays=dates.filter(day=>weekdays.includes((new Date(day+'T00:00:00Z').getUTCDay()+6)%7+1)).length;if(selectedDays*payload.employeeIds.length>5000)throw Error('Mỗi đợt tối đa 5000 lượt nhân viên/ngày.');}
 if(values.mode==='copy'){if(!workScheduleDate(values.copyFrom))throw Error('Chọn ngày bắt đầu lịch nguồn.');payload.copyFrom=values.copyFrom;}else payload.shiftId=positive(values.shiftId);
 return payload;
}
function workScheduleOperationId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const bytes=new Uint8Array(16);if(!globalThis.crypto?.getRandomValues)throw Error('Trình duyệt không hỗ trợ tạo mã phân ca.');globalThis.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const workScheduleOutcomes={READY:'Sẵn sàng',INACTIVE:'Nhân viên ngừng hoạt động',BEFORE_HIRE:'Trước ngày vào làm',PAST_DATE:'Ngày đã qua',HOLIDAY:'Ngày lễ',NON_WORKING_DAY:'Ngày không làm việc',PERIOD_LOCKED:'Kỳ công đã khóa',APPROVED_LEAVE:'Đã có phép được duyệt',SOURCE_MISSING_OR_MULTIPLE:'Lịch nguồn thiếu hoặc có nhiều ca',SHIFT_INACTIVE:'Ca ngừng hoạt động',MULTIPLE_SCHEDULES:'Có nhiều lịch',ATTENDANCE_OR_CLOSED:'Đã có chấm công hoặc đóng lịch',EXISTS:'Đã có lịch',STARTED_OR_LEGACY:'Lịch đã bắt đầu hoặc snapshot cũ',STARTED:'Ca đã bắt đầu',OVERLAP:'Trùng giờ ca',OVERLAP_OR_LEGACY:'Trùng ca hoặc snapshot cũ'};
function workSchedulePreviewMarkup(preview){
 if(typeof preview?.previewToken!=='string'||!preview.previewToken||!Number.isInteger(preview.ready)||!Number.isInteger(preview.skipped)||!Array.isArray(preview.items))throw Error('Kết quả xem trước không hợp lệ.');
 return `<p class="work-preview-summary">Sẵn sàng: <strong>${preview.ready}</strong> · Bỏ qua: <strong>${preview.skipped}</strong></p><div class="table-wrap work-preview-table"><table><thead><tr><th>Nhân viên</th><th>Ngày</th><th>Ca</th><th>Kết quả</th></tr></thead><tbody>${preview.items.map(item=>`<tr><td>${e(item.employeeCode)} · ${e(item.employeeName)}</td><td>${dateLabel(item.workDate)}</td><td>${e(item.rules?.shiftCode||item.shiftId||'—')}</td><td class="${item.outcome==='READY'?'work-ready':''}">${e(workScheduleOutcomes[item.outcome]||item.outcome)}</td></tr>`).join('')}</tbody></table></div>`;
}
function workScheduleCalendarMarkup(data,days,selected=new Set(),session=apiSession()){
 const byCell=new Map();for(const schedule of data.schedules){if(schedule.status==='CANCELLED')continue;const key=schedule.employeeId+'/'+schedule.workDate;if(!byCell.has(key))byCell.set(key,[]);byCell.get(key).push(schedule);}
 const canNew=workScheduleGrant('canNew',session),canDelete=workScheduleGrant('canDelete',session),today=workScheduleToday();
 return `<div class="table-wrap work-calendar-wrap"><table class="work-calendar"><thead><tr><th class="work-employee-col">${canNew?'<input type="checkbox" data-work-select-all aria-label="Chọn tất cả nhân viên trên trang"> ':''}Nhân viên</th>${days.map(day=>`<th class="${data.holidayDates.includes(day)?'work-holiday':''}"><span>${['CN','T2','T3','T4','T5','T6','T7'][new Date(day+'T00:00:00Z').getUTCDay()]}</span><strong>${dateLabel(day).slice(0,5)}</strong>${data.holidayDates.includes(day)?'<small>Ngày lễ</small>':''}</th>`).join('')}</tr></thead><tbody>${data.employees.map(employee=>`<tr><th class="work-employee-col"><div>${canNew?`<input type="checkbox" data-work-select="${employee.id}" aria-label="Chọn ${e(employee.fullName)}" ${selected.has(employee.id)?'checked':''}>`:''}<span>${e(employee.fullName)}<small>${e(employee.employeeCode)}</small></span></div></th>${days.map(day=>{const schedules=byCell.get(employee.id+'/'+day)||[];return `<td class="${day===today?'work-today':''}">${schedules.length?schedules.map(schedule=>{const shift=data.shifts.find(item=>item.id===schedule.shiftId),code=schedule.rules?.shiftCode||shift?.code||'Ca #'+schedule.shiftId;return `<div class="work-shift" style="--shift-color:${workScheduleColor(schedule.shiftId)}"><button type="button" data-work-schedule="${schedule.id}" title="Xem hoặc thay đổi ca ${e(code)}">${e(code)}</button>${canDelete&&schedule.status==='SCHEDULED'&&day>=today?`<button type="button" data-work-cancel="${schedule.id}" aria-label="Hủy ca ${e(code)}">×</button>`:''}</div>`;}).join(''):canNew&&day>=today?`<button type="button" class="work-empty-cell" data-work-assign="${employee.id}" data-work-date="${day}" aria-label="Phân ca cho ${e(employee.fullName)} ngày ${day}">+</button>`:'<span class="muted">—</span>'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>${data.employees.length?'':'<div class="empty">Không có nhân viên phù hợp trong phạm vi được xem.</div>'}`;
}

async function mountWorkSchedules(root){
 if(!root)return;if(!workScheduleGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem WEB_WORK_SCHEDULES.</p>';return;}
 let anchor=workScheduleToday(),mode='week',page=1,departmentId='',teamId='',search='',generation=0,calendar=null,range=workScheduleRange(anchor,mode),selected=new Set(),searchTimer;
 const pageSize=20;
 root.innerHTML=`<div class="work-heading page-content-actions"><div class="heading-actions">${workScheduleGrant('canExport')?'<button type="button" class="btn" data-work-export>Xuất CSV</button>':''}${workScheduleGrant('canNew')?`<button type="button" class="btn primary" data-work-bulk>${icon('plus',16)} Phân ca hàng loạt</button>`:''}</div></div><form class="work-filters"><label>Hiển thị<select name="mode"><option value="week">Tuần</option><option value="month">Tháng</option></select></label>${field('Ngày','anchor','date',anchor,'required')}<label>Phòng ban<select name="departmentId"><option value="">Tất cả phòng ban</option></select></label><label>Team<select name="teamId"><option value="">Tất cả team</option></select></label><label class="work-search">Nhân viên<input name="search" type="search" placeholder="Mã hoặc tên nhân viên"></label><button class="btn" type="submit">Lọc</button></form><div class="work-calendar-toolbar"><div><button class="btn" type="button" data-work-prev-period aria-label="Kỳ trước">←</button><button class="btn" type="button" data-work-today>Hôm nay</button><button class="btn" type="button" data-work-next-period aria-label="Kỳ sau">→</button></div><strong data-work-range></strong><button class="btn" type="button" data-work-refresh>Làm mới</button></div><p class="muted" data-work-selected></p><div data-work-content></div><div class="user-pagination contracts-pagination" data-work-pagination></div>`;
 const form=root.querySelector('form'),content=root.querySelector('[data-work-content]'),pagination=root.querySelector('[data-work-pagination]');
 const query=()=>({...range,page,pageSize,departmentId,teamId,search});
 function filterOptions(items,value,label){return `<option value="">${label}</option>`+items.map(item=>`<option value="${item.id}" ${String(item.id)===value?'selected':''}>${e(item.name)}</option>`).join('');}
 function selection(){root.querySelector('[data-work-selected]').textContent=selected.size?`Đã chọn ${selected.size} nhân viên trên trang.`:'';const all=content.querySelector('[data-work-select-all]');if(all){all.checked=!!calendar?.employees.length&&calendar.employees.every(item=>selected.has(item.id));all.indeterminate=selected.size>0&&!all.checked;}}
 function draw(){
 content.innerHTML=workScheduleCalendarMarkup(calendar,workScheduleDays(range.from,range.to),selected);
 selection();pagination.innerHTML=`<span>${calendar.total} nhân viên · Trang ${page}/${Math.max(1,Math.ceil(calendar.total/pageSize))}</span><div><button class="btn" type="button" data-prev ${page===1?'disabled':''}>Trang trước</button><button class="btn" type="button" data-next ${page*pageSize>=calendar.total?'disabled':''}>Trang sau</button></div>`;
 pagination.querySelector('[data-prev]').onclick=()=>{page--;selected.clear();load();};pagination.querySelector('[data-next]').onclick=()=>{page++;selected.clear();load();};
 content.querySelectorAll('[data-work-select]').forEach(input=>input.onchange=()=>{const id=Number(input.dataset.workSelect);input.checked?selected.add(id):selected.delete(id);selection();});
 content.querySelector('[data-work-select-all]')?.addEventListener('change',event=>{selected=new Set(event.target.checked?calendar.employees.map(item=>item.id):[]);draw();});
 content.querySelectorAll('[data-work-assign]').forEach(button=>button.onclick=()=>single(null,Number(button.dataset.workAssign),button.dataset.workDate));
 content.querySelectorAll('[data-work-schedule]').forEach(button=>button.onclick=()=>single(calendar.schedules.find(item=>item.id===Number(button.dataset.workSchedule))));
 content.querySelectorAll('[data-work-cancel]').forEach(button=>button.onclick=()=>cancel(calendar.schedules.find(item=>item.id===Number(button.dataset.workCancel))));
 }
 async function load(){
 if(!root.isConnected)return;const current=++generation;range=workScheduleRange(anchor,mode);root.querySelector('[data-work-range]').textContent=dateLabel(range.from)+' – '+dateLabel(range.to);calendar=null;content.innerHTML='<div class="work-calendar-loading" role="status">Đang tải lịch phân ca…</div>';pagination.innerHTML='';
 try{const data=workScheduleCalendarData(await apiWorkScheduleCalendar(query()));if(!root.isConnected||current!==generation)return;calendar=data;
 form.elements.departmentId.innerHTML=filterOptions(data.departments,departmentId,'Tất cả phòng ban');form.elements.teamId.innerHTML=filterOptions(data.teams,teamId,'Tất cả team');selected=new Set([...selected].filter(id=>data.employees.some(item=>item.id===id)));draw();
 }catch(err){if(root.isConnected&&current===generation){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}}
 }
 function apply(){if(!form.reportValidity())return;anchor=form.elements.anchor.value;mode=form.elements.mode.value;departmentId=form.elements.departmentId.value;teamId=form.elements.teamId.value;search=form.elements.search.value.trim();page=1;selected.clear();load();}
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(searchTimer);apply();};form.elements.mode.onchange=form.elements.anchor.onchange=form.elements.teamId.onchange=apply;
 form.elements.departmentId.onchange=()=>{form.elements.teamId.value='';apply();};form.elements.search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(apply,300);};
 root.querySelector('[data-work-refresh]').onclick=()=>{clearTimeout(searchTimer);load();};
 function movePeriod(direction){const current=new Date(anchor+'T00:00:00Z');anchor=mode==='week'?workScheduleAddDays(anchor,direction*7):new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+direction,1)).toISOString().slice(0,10);form.elements.anchor.value=anchor;page=1;selected.clear();load();}
 root.querySelector('[data-work-prev-period]').onclick=()=>movePeriod(-1);root.querySelector('[data-work-next-period]').onclick=()=>movePeriod(1);root.querySelector('[data-work-today]').onclick=()=>{anchor=workScheduleToday();form.elements.anchor.value=anchor;page=1;selected.clear();load();};
 root.querySelector('[data-work-export]')?.addEventListener('click',async event=>{
 if(!workScheduleGrant('canExport'))return;const button=event.currentTarget;button.disabled=true;
 try{const blob=await apiExportWorkSchedules(query()),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='work-schedules.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất lịch phân ca của trang nhân viên hiện tại.');}catch(err){toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}
 });
 function shiftOptions(value){return '<option value="">Chọn ca</option>'+calendar.shifts.filter(item=>item.isActive||item.id===value).map(item=>`<option value="${item.id}" ${item.id===value?'selected':''}>${e(item.code)} · ${e(item.name)} (${e(item.startTime?.slice(0,5))}–${e(item.endTime?.slice(0,5))})${item.isActive?'':' · Ngừng hoạt động'}</option>`).join('');}
 async function single(original,employeeId=null,day=null){
 if(!calendar)return;const dataAtOpen=calendar;
 try{
 if(original){original=await apiWorkScheduleDetail(original.id);if(!root.isConnected||calendar!==dataAtOpen)return;employeeId=original.employeeId;day=original.workDate;}
 const employee=calendar.employees.find(item=>item.id===employeeId),canSave=original?workScheduleGrant('canUpdate'):workScheduleGrant('canNew');if(!employee)return;
 openDialog(original?'Chi tiết lịch phân ca':'Phân ca một ngày',`<p>${e(employee.employeeCode)} · ${e(employee.fullName)}</p>${original?`<p class="muted">Ca đã phân: ${e(original.rules?.shiftCode||'—')} · Trạng thái: ${e(original.status)}</p>`:''}<form id="work-single-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Ngày làm việc','workDate','date',day,`required min="${workScheduleToday()}"`)}<label>Ca làm việc<select name="shiftId" required>${shiftOptions(original?.shiftId)}</select></label></div>${canSave?'<div class="form-actions"><button class="btn primary" type="submit">Lưu phân ca</button></div>':''}</fieldset><p role="alert"></p></form>`);
 const editForm=document.querySelector('#work-single-form'),feedback=editForm.querySelector('[role=alert]'),fieldset=editForm.querySelector('fieldset');let busy=false,stale=false;
 editForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||stale||!canSave||!workScheduleGrant(original?'canUpdate':'canNew'))return;
 const workDate=editForm.elements.workDate.value,shiftId=Number(editForm.elements.shiftId.value);if(!workScheduleDate(workDate)||workDate<workScheduleToday()||!calendar?.shifts.some(item=>item.id===shiftId&&item.isActive)){feedback.textContent='Chọn ngày từ hôm nay và ca đang hoạt động.';return;}
 busy=true;fieldset.disabled=true;
 try{await apiSaveWorkSchedule(original?.id??null,{employeeId,shiftId,workDate},original?.version);if(!editForm.isConnected)return;closeDialog();toast('Đã lưu phân ca.');if(root.isConnected)load();}catch(err){stale=err.status===409;if(editForm.isConnected)feedback.textContent=err.message+(stale?' Đóng cửa sổ và tải lại lịch trước khi sửa tiếp.':'');}finally{busy=false;if(editForm.isConnected)fieldset.disabled=stale;}
 };
 }catch(err){toast(err.message,{type:'error'});}
 }
 async function cancel(schedule){
 if(!workScheduleGrant('canDelete'))return;
 try{const current=await apiWorkScheduleDetail(schedule.id);if(!root.isConnected)return;const employee=calendar?.employees.find(item=>item.id===current.employeeId);
 openDialog('Hủy lịch phân ca',`<p>Hủy ca ${e(current.rules?.shiftCode||'')} ngày ${dateLabel(current.workDate)} của ${e(employee?.fullName||'nhân viên')}?</p><form id="work-cancel-form"><p role="alert"></p><div class="form-actions"><button type="submit" class="btn danger">Xác nhận hủy ca</button></div></form>`);
 const cancelForm=document.querySelector('#work-cancel-form');let busy=false;
 cancelForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||!workScheduleGrant('canDelete'))return;busy=true;cancelForm.querySelector('button').disabled=true;
 try{await apiCancelWorkSchedule(current.id,current.version);if(!cancelForm.isConnected)return;closeDialog();toast('Đã hủy lịch phân ca.');if(root.isConnected)load();}catch(err){if(cancelForm.isConnected){cancelForm.querySelector('[role=alert]').textContent=err.message+(err.status===409?' Tải lại lịch trước khi thử lại.':'');cancelForm.querySelector('button').disabled=err.status===409;}}finally{busy=false;}
 };
 }catch(err){toast(err.message,{type:'error'});}
 }
 root.querySelector('[data-work-bulk]')?.addEventListener('click',()=>{if(calendar&&workScheduleGrant('canNew'))openBatch();});
 function openBatch(){
 const dataAtOpen=calendar,earliest=range.from<workScheduleToday()?workScheduleToday():range.from;
 openDialog('Phân ca hàng loạt',`<form id="work-batch-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid"><label>Đối tượng<select name="target"><option value="EMPLOYEE">Nhân viên được chọn</option><option value="DEPARTMENT">Phòng ban</option><option value="TEAM">Team</option><option value="ALL">Tất cả trong phạm vi được cấp quyền</option></select></label><label>Cách phân ca<select name="mode"><option value="shift">Chọn ca</option><option value="copy">Sao chép lịch</option></select></label><label data-batch-target="DEPARTMENT">Phòng ban<select name="departmentId">${filterOptions(dataAtOpen.departments,departmentId,'Chọn phòng ban')}</select></label><label data-batch-target="TEAM">Team<select name="teamId">${filterOptions(dataAtOpen.teams,teamId,'Chọn team')}</select></label><label data-batch-mode="shift">Ca làm việc<select name="shiftId">${shiftOptions(null)}</select></label><div data-batch-mode="copy">${field('Ngày bắt đầu lịch nguồn','copyFrom','date','')}</div>${field('Từ ngày','from','date',earliest,`required min="${workScheduleToday()}"`)}${field('Đến ngày','to','date',range.to<earliest?earliest:range.to,'required')}</div><fieldset class="work-batch-employees" data-batch-target="EMPLOYEE"><legend>Nhân viên trên trang hiện tại</legend><div>${dataAtOpen.employees.map(item=>`<label><input type="checkbox" name="employeeIds" value="${item.id}" ${selected.has(item.id)?'checked':''}><span>${e(item.employeeCode)} · ${e(item.fullName)}</span></label>`).join('')||'<p>Chưa có nhân viên trên trang.</p>'}</div></fieldset><fieldset class="work-weekdays"><legend>Các thứ cần phân ca</legend>${['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ nhật'].map((label,index)=>`<label><input type="checkbox" name="weekdays" value="${index+1}" ${index<5?'checked':''}>${label}</label>`).join('')}</fieldset><div class="work-batch-flags"><label><input type="checkbox" name="excludeHolidays" checked>Loại trừ ngày lễ</label><label><input type="checkbox" name="overwrite" ${workScheduleGrant('canUpdate')?'':'disabled'}>Ghi đè lịch đủ điều kiện</label></div><div class="form-actions"><button type="submit" class="btn" name="action" value="preview">Xem trước</button><button type="submit" class="btn primary" name="action" value="confirm" disabled>Xác nhận phân ca</button></div></fieldset><p role="status" data-work-batch-feedback></p><div data-work-preview></div></form>`);
 const batchForm=document.querySelector('#work-batch-form'),fieldset=batchForm.querySelector('.user-edit-fieldset'),feedback=batchForm.querySelector('[data-work-batch-feedback]'),previewPanel=batchForm.querySelector('[data-work-preview]'),confirm=batchForm.querySelector('[value=confirm]');let busy=false,preview=null,payload=null,signature='',operationId='';
 function invalidate(){preview=null;payload=null;confirm.disabled=true;previewPanel.innerHTML='';feedback.textContent='';}
 function syncFields(){for(const row of batchForm.querySelectorAll('[data-batch-target]')){const active=row.dataset.batchTarget===batchForm.elements.target.value;row.hidden=!active;row.querySelectorAll('input,select').forEach(input=>input.disabled=!active);}for(const row of batchForm.querySelectorAll('[data-batch-mode]')){const active=row.dataset.batchMode===batchForm.elements.mode.value;row.hidden=!active;row.querySelectorAll('input,select').forEach(input=>input.disabled=!active);}}
 batchForm.oninput=batchForm.onchange=()=>{if(busy)return;invalidate();syncFields();};syncFields();
 batchForm.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||!workScheduleGrant('canNew'))return;
 const action=event.submitter?.value||'preview';if(action==='confirm'&&(!preview||!payload||preview.ready<1))return;
 try{
 if(action==='preview'){
 const data=new FormData(batchForm),draft=workScheduleBatchPayload({...Object.fromEntries(data),employeeIds:data.getAll('employeeIds'),weekdays:data.getAll('weekdays'),excludeHolidays:data.has('excludeHolidays'),overwrite:data.has('overwrite')},{operationId:''});
 if(draft.overwrite&&!workScheduleGrant('canUpdate'))throw Error('Ghi đè cần quyền cập nhật lịch.');const nextSignature=JSON.stringify(draft);if(nextSignature!==signature){operationId=workScheduleOperationId();signature=nextSignature;}payload={...draft,operationId};preview=null;previewPanel.innerHTML='';confirm.disabled=true;
 }
 busy=true;fieldset.disabled=true;feedback.textContent=action==='preview'?'Đang kiểm tra phân ca…':'Đang phân ca…';
 if(action==='preview'){const result=await apiPreviewWorkSchedules(payload);if(!batchForm.isConnected)return;const markup=workSchedulePreviewMarkup(result);preview=result;previewPanel.innerHTML=markup;feedback.textContent=result.ready?'Kiểm tra kết quả trước khi xác nhận.':'Không có dòng sẵn sàng để phân ca.';}
 else{const result=await apiAssignWorkSchedules({...payload,previewToken:preview.previewToken});if(!batchForm.isConnected)return;closeDialog();toast(`Đã tạo ${result.created} lịch, cập nhật ${result.updated}, bỏ qua ${result.skipped}.`);if(root.isConnected){selected.clear();load();}}
 }catch(err){if(batchForm.isConnected){feedback.textContent=err.message;if(err.status===409||action==='preview'){preview=null;previewPanel.innerHTML='';}if(err.status===409)feedback.textContent+=' Dữ liệu đã thay đổi; xem trước lại trước khi xác nhận.';}}
 finally{busy=false;if(batchForm.isConnected){fieldset.disabled=false;syncFields();batchForm.elements.overwrite.disabled=!workScheduleGrant('canUpdate');confirm.disabled=!preview||preview.ready<1;}}
 };
 }
 await load();
}


// Source: pages/human-resources/organization.js

const organizationSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase('vi').trim();
function organizationMatches(department,query,kind='all'){
 const term=organizationSearchText(query);
 const departmentMatch=kind!=='team'&&organizationSearchText(department.departmentName).includes(term);
 const teams=(department.teams||[]).map(team=>kind!=='department'&&organizationSearchText(team.teamName).includes(term));
 return {departmentMatch,teams,visible:!term||departmentMatch||teams.some(Boolean)};
}

function organizationManagerLabel(manager){
 if(!manager)return 'Chưa có quản lý';
 return `${manager.positionName?`${e(manager.positionName)}: `:''}${e(manager.fullName)}`;
}

function mountOrganization(root){
 if(!root)return ()=>{};
 const allowed=apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_ORGANIZATION'&&p.canView==='Y');
 if(!allowed){root.innerHTML='<p>Bạn chưa có quyền xem cơ cấu tổ chức.</p>';return ()=>{};}
 let disposed=false,treeController;
 const requests=new Map();
 const alive=()=>!disposed&&root.isConnected;
 const abortWithin=panel=>{for(const [node,controller] of requests)if(panel.contains(node)){controller.abort();requests.delete(node);}};
 const employeeMarkup=item=>`<li><a class="org-employee" href="#/hr/employees/${encodeURIComponent(item.id)}"><span class="org-avatar" aria-hidden="true">${e((item.fullName||'?').slice(0,1))}</span><span><strong>${e(item.fullName)}</strong><small>${e(item.employeeCode)} · ${e(item.positionName||'Chưa có chức vụ')}</small></span><span class="org-status">${e(({ACTIVE:'Đang làm việc',INACTIVE:'Ngừng hoạt động',TERMINATED:'Đã nghỉ việc',PROBATION:'Thử việc'})[item.employmentStatus]||item.employmentStatus||'')}</span></a></li>`;
 async function members(panel,kind,id,page=1){
  requests.get(panel)?.abort();const controller=new AbortController();requests.set(panel,controller);
  panel.innerHTML='<p role="status">Đang tải nhân viên…</p>';
  try{
   const result=await apiOrganizationMembers(kind,id,page,controller.signal);
   if(!alive()||controller.signal.aborted||requests.get(panel)!==controller)return;
   if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
   panel.dataset.loaded='true';
   panel.innerHTML=result.data.length?`<ul class="org-employees">${result.data.map(employeeMarkup).join('')}</ul>${kind==='unassigned'&&result.total<=20?'':`<div class="org-pagination"><button type="button" class="btn" data-prev ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} nhân viên</span><button type="button" class="btn" data-next ${page*20>=result.total?'disabled':''}>Trang sau</button></div>`}`:'<p class="muted">Chưa có nhân viên trong nhóm này.</p>';
   panel.querySelector('[data-prev]')?.addEventListener('click',()=>members(panel,kind,id,page-1));
   panel.querySelector('[data-next]')?.addEventListener('click',()=>members(panel,kind,id,page+1));
  }catch(err){if(alive()&&!controller.signal.aborted){panel.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;panel.querySelector('button').onclick=()=>members(panel,kind,id,page);}}
  finally{if(requests.get(panel)===controller)requests.delete(panel);}
 }
 function bindToggle(button,panel,onOpen){button.onclick=()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));panel.hidden=!open;if(open)onOpen?.();else abortWithin(panel);};}
 async function load(){
  treeController?.abort();treeController=new AbortController();
  root.innerHTML='<p role="status">Đang tải cơ cấu tổ chức…</p>';
  try{
   const departments=await apiOrganizationTree(treeController.signal);
   if(!alive()||treeController.signal.aborted)return;
   if(!Array.isArray(departments))throw Error('Cơ cấu tổ chức không hợp lệ.');
   root.innerHTML=`<form id="organization-search" class="toolbar"><input type="search" name="search" maxlength="150" placeholder="Tìm tên phòng ban hoặc team" aria-label="Tìm phòng ban hoặc team"><select name="kind" aria-label="Loại tìm kiếm"><option value="all">Phòng ban và team</option><option value="department">Phòng ban</option><option value="team">Team</option></select><button class="btn">Tìm kiếm</button></form><p id="organization-search-result" role="status" hidden></p><p class="org-intro muted">Chọn phòng ban để xem team, chọn team để xem nhân viên.</p><div class="org-grid">${departments.map((dep,i)=>`<article class="card org-department"><h2><button type="button" class="org-toggle org-department-toggle" aria-expanded="false" aria-controls="org-dep-${i}"><span class="org-department-icon" aria-hidden="true">▦</span><span><strong>${e(dep.departmentName)}</strong><small>${e(dep.teamCount)} team · ${e(dep.employeeCount)} nhân viên<br>${organizationManagerLabel(dep.manager)}</small></span><span class="org-chevron" aria-hidden="true">›</span></button></h2><div class="org-teams" id="org-dep-${i}" hidden></div></article>`).join('')}</div>${departments.length?'':'<p>Chưa có phòng ban trong phạm vi của bạn.</p>'}`;
   departments.forEach((dep,i)=>{
    const panel=root.querySelector(`#org-dep-${i}`),button=panel.previousElementSibling.querySelector('button');
    const groups=(dep.teams||[]).map(team=>({...team,kind:'team'}));
    panel.innerHTML=(dep.unassignedCount>0?`<div class="org-direct-members" id="org-direct-${i}" aria-label="Nhân viên trực thuộc phòng ban"></div>`:'')+groups.map((team,j)=>`<section class="org-team"><h3><button type="button" class="org-toggle" aria-expanded="false" aria-controls="org-members-${i}-${j}"><span><strong>${e(team.teamName)}</strong><small>${e(team.employeeCount)} nhân viên${team.kind==='team'?`<br>${organizationManagerLabel(team.lead)}`:''}</small></span><span class="org-chevron" aria-hidden="true">›</span></button></h3><div class="org-members" id="org-members-${i}-${j}" hidden></div></section>`).join('')||'<p class="muted">Phòng ban chưa có team.</p>';
    bindToggle(button,panel,()=>{const direct=panel.querySelector('.org-direct-members');if(direct&&!direct.hidden)members(direct,'unassigned',dep.id);});
    groups.forEach((team,j)=>{const target=panel.querySelector(`#org-members-${i}-${j}`);bindToggle(target.previousElementSibling.querySelector('button'),target,()=>members(target,team.kind,team.id));});
   });
   const searchForm=root.querySelector('#organization-search');
   function searchOrganization(){
    const query=searchForm.elements.search.value.trim(),kind=searchForm.elements.kind.value;
    let count=0;
    departments.forEach((dep,i)=>{
     const match=organizationMatches(dep,query,kind),panel=root.querySelector(`#org-dep-${i}`),card=panel.closest('.org-department');
     card.hidden=!match.visible;
     if(!match.visible){abortWithin(panel);return;}
     count++;
     const direct=panel.querySelector('.org-direct-members');
     if(direct){direct.hidden=!!query&&!match.departmentMatch;if(direct.hidden)abortWithin(direct);}
     panel.querySelectorAll('.org-team').forEach((team,j)=>{team.hidden=!!query&&!match.departmentMatch&&!match.teams[j];if(team.hidden)abortWithin(team);});
     if(query){const open=match.departmentMatch||match.teams.some(Boolean);panel.hidden=!open;panel.previousElementSibling.querySelector('button').setAttribute('aria-expanded',String(open));}
     if(direct&&!direct.hidden&&!panel.hidden&&!requests.has(direct)&&direct.dataset.loaded!=='true')members(direct,'unassigned',dep.id);
    });
    const result=root.querySelector('#organization-search-result');
    result.hidden=!query;
    result.textContent=count?`Tìm thấy ${count} phòng ban phù hợp.`:'Không có phòng ban hoặc team phù hợp.';
   }
   searchForm.onsubmit=event=>{event.preventDefault();event.stopPropagation();searchOrganization();};
   searchForm.elements.search.addEventListener('input',searchOrganization);
   searchForm.elements.kind.addEventListener('change',searchOrganization);
  }catch(err){if(alive()&&!treeController.signal.aborted){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=load;}}
 }
 load();
 return ()=>{disposed=true;treeController?.abort();for(const controller of requests.values())controller.abort();requests.clear();};
}


// Source: pages/reports/attendance-report.js
function reportRows(f){const from=f.period==='month'?(f.month||'2026-10')+'-01':f.from||f.date;let to=f.period==='month'?(f.month||'2026-10')+'-31':f.to||f.date;if(f.period==='month'){const [y,m]=(f.month||'2026-10').split('-').map(Number);to=`${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`;}if(to>'2026-10-19')to='2026-10-19';return scope.employees(s,user()).filter(u=>(!f.team||u.teamId===f.team)&&(!f.department||u.departmentId===f.department)&&(!f.employee||u.id===f.employee)&&matches(u.name+u.employeeCode,f.search)).map(u=>{const records=s.attendance.filter(a=>a.userId===u.id&&a.date>=from&&a.date<=to),valid=records.filter(a=>a.checkIn&&a.checkOut);const worked=valid.reduce((sum,a)=>sum+workMinutes(a,s.settings)/60,0),late=records.filter(a=>attendanceStatus(a)==='late').length,early=valid.filter(a=>a.checkOut.slice(11,16)<s.settings.shiftEnd).length,leave=records.filter(a=>a.leaveRequestId).length;const overtime=s.requests.filter(r=>r.requesterId===u.id&&r.type==='overtime'&&r.status==='approved'&&r.startDate>=from&&r.endDate<=to).reduce((sum,r)=>sum+(Number(r.hours)||0),0);return {u,standard:to>=from?workDays(from,to):0,actual:(worked/8).toFixed(1),late,early,overtime,leave,worked:worked.toFixed(1)};});}
function exportReport(f){csvDownload('intelex-bao-cao-cham-cong',['Mã NV','Nhân viên','Công chuẩn','Công thực tế','Đi trễ','Về sớm','Tăng ca (giờ)','Nghỉ phép','Giờ công'],reportRows(f).map(r=>[r.u.employeeCode,r.u.name,r.standard,r.actual,r.late,r.early,r.overtime,r.leave,r.worked]));}
function attendanceReport(f){const rows=reportRows(f);return `<div class="toolbar"><select data-filter="period" aria-label="Kỳ báo cáo"><option value="day" ${f.period!=='month'&&f.period!=='range'?'selected':''}>Theo ngày</option><option value="month" ${f.period==='month'?'selected':''}>Theo tháng</option><option value="range" ${f.period==='range'?'selected':''}>Khoảng ngày</option></select>${f.period==='month'?`<input type="month" aria-label="Tháng báo cáo" data-filter="month" value="${f.month||'2026-10'}" max="2026-10">`:f.period==='range'?`<input type="date" aria-label="Từ ngày" data-filter="from" value="${f.from||f.date}" max="2026-10-19"><input type="date" aria-label="Đến ngày" data-filter="to" value="${f.to||f.date}" max="2026-10-19">`:`<input type="date" aria-label="Ngày báo cáo" data-filter="date" value="${f.date}" max="2026-10-19">`}${teamOptions(f)}<select data-filter="department" aria-label="Phòng ban"><option value="">Tất cả phòng ban</option>${s.departments.map(d=>`<option value="${d.id}" ${f.department===d.id?'selected':''}>${e(d.name)}</option>`).join('')}</select><select data-filter="employee" aria-label="Nhân viên"><option value="">Tất cả nhân viên</option>${scope.employees(s,user()).filter(u=>!f.team||u.teamId===f.team).map(u=>`<option value="${u.id}" ${f.employee===u.id?'selected':''}>${e(u.name)}</option>`).join('')}</select>${button('Xuất CSV','export-report','download')}${button('In / PDF','print','print')}</div><div class="kpis">${kpi('Nhân sự',rows.length,'người','Theo phạm vi & bộ lọc','users','blue')}${kpi('Tổng giờ công',rows.reduce((n,r)=>n+Number(r.worked),0).toLocaleString('vi-VN'),'giờ','Chỉ tính các ca đã check-out','clock','teal')}${kpi('Lượt đi trễ',rows.reduce((n,r)=>n+r.late,0),'lượt','Theo giờ bắt đầu ca','calendar','orange')}${kpi('Ngày phép',rows.reduce((n,r)=>n+r.leave,0),'ngày','Theo lịch nghỉ đã duyệt','sun','purple')}</div>${card('Báo cáo chấm công chi tiết','Công thực tế = giờ công hợp lệ / 8 · Ngày chưa kết thúc chỉ ghi nhận giờ vào',table(['Nhân viên','Công chuẩn','Công thực tế','Đi trễ','Về sớm','Tăng ca (giờ)','Nghỉ phép','Giờ công'],rows.map(r=>[person(r.u),r.standard,r.actual,r.late,r.early,r.overtime,r.leave,r.worked]),{page:f.page,size:Number(f.size)||10}),`<select aria-label="Số dòng mỗi trang" data-filter="size">${[10,20,50].map(n=>`<option value="${n}" ${Number(f.size)===n?'selected':''}>${n} dòng</option>`).join('')}</select>`)}<p class="muted" style="font-size:11px;margin-top:14px">Số liệu đến ngày demo 19/10/2026. Ca mẫu 8 giờ/ngày, không tính ngày lễ. Ngày chưa có dữ liệu không được tính là vắng không phép.</p>`;}


// Source: pages/notifications/notifications.js

const notificationTabs=[['all','Tất cả'],['unread','Chưa đọc'],['task','Công việc'],['attendance','Chấm công'],['leave','Nghỉ phép'],['kpi','KPI'],['payroll','Lương'],['system','Hệ thống']];
function notificationCategory(item){
 const source=String(item.source||'').toUpperCase(),reference=String(item.referenceType||'').toUpperCase();
 if(reference==='PAYROLL'||String(item.type||'').toUpperCase()==='PAYROLL')return 'payroll';
 if(reference.startsWith('KPI'))return 'kpi';
 const attendance=['ATTENDANCE','WORK_SCHEDULE','SHIFT'];
 if(source==='SYSTEM')return attendance.includes(reference)?'attendance':'system';
 if(source==='WORKFLOW')return 'leave';
 if(attendance.includes(reference))return 'attendance';
 if(['TASK','PROJECT_TASK'].includes(reference))return 'task';
 if(['LEAVE','LEAVE_REQUEST'].includes(reference))return 'leave';
 return 'system';
}
function filterNotificationItems(items,tab){
 if(tab==='all')return items;
 if(tab==='unread')return items.filter(item=>!item.readAt);
 return items.filter(item=>notificationCategory(item)===tab);
}
function notificationTime(value){
 if(!value)return '—';const text=String(value),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'Z');
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
function notificationRows(items){
 return items.map(item=>`<button type="button" class="notification-row api-notification-row ${item.readAt?'':'unread'}" data-noti-read="${e(item.id)}"><span class="icon-tile blue">${icon('bell',16)}</span><span class="api-notification-content"><strong>${e(item.title)}</strong><span class="api-notification-text">${e(item.content)}</span><small>${e(notificationTime(item.publishedAt||item.createdAt))} · ${item.readAt?'Đã đọc':'Chưa đọc'}</small></span>${item.readAt?'':'<span class="api-notification-dot" aria-label="Chưa đọc"></span>'}</button>`).join('');
}
function notificationPayslipHref(item){
 if(notificationCategory(item)!=='payroll')return '';
 const id=Number(item.referenceId);return Number.isSafeInteger(id)&&id>0?'#/workspace/payslips?periodId='+id:'';
}
function notificationDetailMarkup(item){
 const label=({system:'Thông báo chung',attendance:'Chấm công',leave:'Nghỉ phép',task:'Công việc',kpi:'KPI',payroll:'Lương'})[notificationCategory(item)];
 return `<section id="notification-detail"><div class="notification-detail-meta"><span class="notification-detail-category">${label}</span><time>${e(notificationTime(item.publishedAt||item.createdAt))}</time></div><h3>${e(item.title)}</h3><p class="notification-detail-content">${e(item.content)}</p>${notificationPayslipHref(item)?`<div class="form-actions"><a class="btn primary" data-notification-payslip href="${notificationPayslipHref(item)}">Xem chi tiết</a></div>`:''}<p id="notification-detail-error" class="form-error" role="alert"></p></section>`;
}
async function openNotificationDetail(item,service=notificationService,showDialog=openDialog){
 if(!item)return;
 const generation=service.snapshot().generation;
 showDialog('Chi tiết thông báo',notificationDetailMarkup(item));
 const popup=globalThis.document?.getElementById('notification-detail');
 popup?.querySelector('[data-notification-payslip]')?.addEventListener?.('click',()=>closeDialog());
 if(item.readAt)return;
 try{await service.read(item.id);}
 catch(error){if(popup?.isConnected&&service.snapshot().generation===generation){const feedback=popup.querySelector('#notification-detail-error');if(feedback)feedback.textContent=notificationError(error);}}
}
function renderNotificationHeader(root,state=notificationService.snapshot(),service=notificationService){
 if(!root)return;
 const focused=root.contains(document.activeElement)?document.activeElement:null,focusId=focused?.id,focusRead=focused?.dataset?.notiRead;
 if(root.notificationGeneration!==state.generation){root.notificationOpen=false;root.notificationError='';root.notificationGeneration=state.generation;}
 const open=!!root.notificationOpen,count=state.count;
 root.innerHTML=`<button type="button" class="icon-button" id="notification-bell" aria-label="Thông báo${count===null?'':`, ${count} chưa đọc`}" aria-expanded="${open}" aria-controls="notification-dropdown">${icon('bell',19)}${count>0?`<span class="notification-count" aria-hidden="true">${count>99?'99+':count}</span>`:''}</button><section id="notification-dropdown" class="notification-dropdown" aria-label="Thông báo mới nhất" ${open?'':'hidden'}><div class="notification-dropdown-heading"><strong>Thông báo</strong><button type="button" class="btn text small" data-noti-all ${root.notificationBusy?'disabled':''}>Đánh dấu tất cả đã đọc</button></div>${state.error?`<p class="form-error" role="alert">${e(state.error)}</p>`:''}${root.notificationError?`<p class="form-error" role="alert">${e(root.notificationError)}</p>`:''}<div class="notification-dropdown-list">${!state.loaded&&state.loading?'<p role="status">Đang tải thông báo…</p>':state.items.length?notificationRows(state.items.slice(0,8)):state.loaded?'<p class="notification-empty">Chưa có thông báo.</p>':''}</div><div class="notification-dropdown-footer"><button type="button" class="btn small" data-noti-refresh ${state.loading?'disabled':''}>${state.loading?'Đang tải…':'Làm mới'}</button><a class="btn primary small" href="#/notifications">Xem tất cả</a></div></section>`;
 root.querySelector('#notification-bell').onclick=()=>{root.notificationOpen=!root.notificationOpen;renderNotificationHeader(root,service.snapshot(),service);if(root.notificationOpen)void service.refresh();};
 root.querySelector('[data-noti-refresh]').onclick=()=>{void service.refresh();};
 async function mutate(action){
 if(root.notificationBusy)return;root.notificationBusy=true;root.notificationError='';
 try{await action();}catch(error){root.notificationError=notificationError(error);}
 finally{root.notificationBusy=false;if(root.isConnected)renderNotificationHeader(root,service.snapshot(),service);}
 }
 root.querySelector('[data-noti-all]').onclick=()=>mutate(()=>service.readAll());
 root.querySelectorAll('[data-noti-read]').forEach(button=>button.onclick=()=>{
  const item=state.items.find(item=>String(item.id)===String(button.dataset.notiRead));if(!item)return;
  root.notificationOpen=false;renderNotificationHeader(root,service.snapshot(),service);void openNotificationDetail(item,service);
 });
 root.querySelector('a').onclick=()=>{root.notificationOpen=false;};
 if(focusId)root.querySelectorAll('[id]').forEach(element=>{if(element.id===focusId)element.focus();});
 else if(focusRead)root.querySelectorAll('[data-noti-read]').forEach(element=>{if(element.dataset.notiRead===focusRead)element.focus();});
}
function notificationEventInside(event,root){
 return !!root&&(event.composedPath?.().includes(root)||root.contains(event.target));
}
function closeNotificationHeader(root,focus=false){if(root?.notificationOpen){root.notificationOpen=false;const state=notificationService.snapshot();renderNotificationHeader(root,state);if(focus)root.querySelector('#notification-bell')?.focus();}}
function mountNotifications(root,service=notificationService){
 if(!root)return ()=>{};
 let selectedTab='all';
 let state=service.snapshot(),cursor=null,history=[],items=state.items,next=state.nextBeforeId,loading=false,error='',busy=false,requestId=0,revision=state.revision,generation=state.generation;
 function draw(){
 if(!root.isConnected)return;
 const visible=filterNotificationItems(items,selectedTab);
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Danh mục thông báo">${notificationTabs.map(([key,label])=>`<button type="button" role="tab" class="tab ${selectedTab===key?'active':''}" aria-selected="${selectedTab===key}" data-noti-filter="${key}">${label}</button>`).join('')}</div><div class="toolbar"><button type="button" class="btn primary" id="notifications-read-all" ${busy?'disabled':''}>Đánh dấu tất cả đã đọc</button><button type="button" class="btn" id="notifications-refresh" ${loading||state.loading?'disabled':''}>Làm mới</button></div><p id="notifications-error" class="form-error" role="alert">${e(error||state.error)}</p>${(loading||!state.loaded&&state.loading)?'<p role="status">Đang tải thông báo…</p>':visible.length?`<div class="notifications-inbox">${notificationRows(visible)}</div>`:state.loaded?`<div class="empty"><h3>${selectedTab==='all'?'Chưa có thông báo':'Không có thông báo phù hợp trên trang này'}</h3><p>Các thông báo của tài khoản này sẽ xuất hiện tại đây.</p></div>`:''}<div class="toolbar user-pagination"><button type="button" class="btn" id="notifications-prev" ${!history.length||loading?'disabled':''}>Trang trước</button><span>Trang ${history.length+1}</span><button type="button" class="btn" id="notifications-next" ${next===null||next===undefined||loading?'disabled':''}>Trang sau</button></div>`;
 root.querySelectorAll('[data-noti-filter]').forEach(button=>button.onclick=()=>{selectedTab=button.dataset.notiFilter;draw();});
 root.querySelector('#notifications-read-all').onclick=()=>mutate(()=>service.readAll());
 root.querySelector('#notifications-refresh').onclick=()=>{if(cursor===null)void service.refresh();else void loadPage(cursor);};
 root.querySelectorAll('[data-noti-read]').forEach(button=>button.onclick=()=>{const item=items.find(item=>String(item.id)===String(button.dataset.notiRead));if(item)void openNotificationDetail(item,service);});
 root.querySelector('#notifications-next').onclick=()=>{if(next!==null&&next!==undefined){history.push(cursor);cursor=next;void loadPage(cursor);}};
 root.querySelector('#notifications-prev').onclick=()=>{if(history.length){cursor=history.pop();if(cursor===null){requestId++;loading=false;items=state.items;next=state.nextBeforeId;draw();}else void loadPage(cursor);}};
 }
 async function loadPage(beforeId){
 const current=++requestId;loading=true;error='';draw();
 try{const result=await service.page(beforeId);if(!root.isConnected||current!==requestId)return;items=result.items;next=result.nextBeforeId??null;}
 catch(err){if(current===requestId)error=notificationError(err);}
 finally{if(current===requestId){loading=false;draw();}}
 }
 async function mutate(action){
 if(busy)return;busy=true;error='';draw();
 try{await action();if(cursor!==null)await loadPage(cursor);}
 catch(err){error=notificationError(err);}
 finally{busy=false;draw();}
 }
 let unsubscribe=()=>{};
 unsubscribe=service.subscribe(nextState=>{
 if(!root.isConnected){unsubscribe();return;}
 state=nextState;
 if(generation!==state.generation){generation=state.generation;requestId++;cursor=null;history=[];items=[];next=null;error='';loading=false;busy=false;}
 if(cursor===null){items=state.items;next=state.nextBeforeId;}
 else if(revision!==state.revision&&!loading)void loadPage(cursor);
 revision=state.revision;draw();
 });
 void service.syncAuth();if(!state.loaded&&!state.loading)void service.refresh();
 return ()=>{requestId++;unsubscribe();};
}


// Source: pages/administration/audit-logs.js

const auditActionNames={SETTINGS_UPDATED:'Cập nhật cấu hình',SHIFT_SAVED:'Lưu ca làm việc',SCHEDULE_SAVED:'Lưu lịch phân ca',SCHEDULE_CANCELLED:'Hủy lịch phân ca',CHECK_IN:'Chấm công vào',CHECK_OUT:'Chấm công ra',ATTENDANCE_CLOSED:'Chốt chấm công',QR_SESSION_CREATED:'Tạo phiên QR',USER_CREATE:'Tạo tài khoản',USER_UPDATE:'Cập nhật tài khoản',USER_STATUS:'Đổi trạng thái tài khoản',USER_ROLES:'Cập nhật vai trò tài khoản',PASSWORD_RESET:'Đổi/đặt lại mật khẩu',ROLE_SAVE:'Lưu vai trò',ROLE_DELETE:'Xóa vai trò',PERMISSIONS_UPDATE:'Cập nhật phân quyền',SCREEN_SAVE:'Lưu màn hình',EMPLOYEE_CREATED:'Tạo hồ sơ nhân viên',EMPLOYEE_UPDATED:'Cập nhật hồ sơ nhân viên',EMPLOYEE_DEACTIVATED:'Ngừng hoạt động nhân viên',EMPLOYEE_DEPARTMENT_CHANGED:'Chuyển phòng ban',EMPLOYEE_TEAM_CHANGED:'Đổi team nhân viên',CONTRACT_CREATED:'Tạo hợp đồng',CONTRACT_UPDATED:'Cập nhật hợp đồng',TEAM_CREATED:'Tạo team',TEAM_UPDATED:'Cập nhật team',TEAM_DELETED:'Xóa team'};
const auditModules={System:'Hệ thống',User:'Tài khoản',Role:'Vai trò',Screen:'Màn hình',Employee:'Nhân viên',Contract:'Hợp đồng',Team:'Teams'};
function auditTime(value){
 if(!value)return '—';
 const text=String(value),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'Z');
 return Number.isNaN(date.getTime())?'Thời gian không hợp lệ':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
}
function auditSafeText(value){
 return value.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,'[Đã ẩn]').replace(/\bBearer\s+\S+/gi,'Bearer [Đã ẩn]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[Đã ẩn]').replace(/((?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*)[^\s,;]+/gi,'$1[Đã ẩn]');
}
function redactAudit(value){
 if(Array.isArray(value))return value.map(redactAudit);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>{
 const normalized=key.replace(/[^a-z0-9]/gi,'').toLowerCase();
 const sensitive=/(password|token|secret|credential|nonce|salt|hash|authorization|cookie|apikey|privatekey|accesskey|signingkey|encryptionkey|connectionstring)/.test(normalized)&&!['passwordhistorycount','disallowusernameinpassword'].includes(normalized);
 return [auditSafeText(key),sensitive?'[Đã ẩn]':redactAudit(item)];
 }));
 if(typeof value==='string'){
 if(/^[\[{]/.test(value.trim())){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')return JSON.stringify(redactAudit(parsed));}catch{}}
 return auditSafeText(value);
 }
 return value;
}
const auditObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function auditCanonical(value){return JSON.stringify(auditObject(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(auditCanonical(value[key]))])):Array.isArray(value)?value.map(item=>JSON.parse(auditCanonical(item))):value);}
function auditChanges(before,after){
 if(!auditObject(before)||!auditObject(after))return null;
 const rows=[];
 function visit(left,right,path){
 const keys=new Set([...Object.keys(left),...Object.keys(right)]);
 for(const key of keys){
 const hasBefore=Object.hasOwn(left,key),hasAfter=Object.hasOwn(right,key),a=left[key],b=right[key],next=path+'/'+key.replaceAll('~','~0').replaceAll('/','~1');
 if(hasBefore&&hasAfter&&auditCanonical(a)===auditCanonical(b))continue;
 if(hasBefore&&hasAfter&&auditObject(a)&&auditObject(b))visit(a,b,next);
 else rows.push({path:next,hasBefore,hasAfter,before:hasBefore?a:undefined,after:hasAfter?b:undefined});
 }
 }
 visit(redactAudit(before),redactAudit(after),'');return rows;
}
function auditQuery(values){
 const query=new URLSearchParams({page:values.page||1,pageSize:values.pageSize||30});
 for(const key of ['search','actorUserId','action','entityType','entityId'])if(values[key]?.trim())query.set(key,values[key].trim());
 let from=null,to=null;
 for(const [input,key] of [['from','fromUtc'],['to','toUtc']])if(values[input]){
 const date=new Date(values[input]+'+07:00');if(Number.isNaN(date.getTime()))throw Error('Khoảng thời gian không hợp lệ.');
 query.set(key,date.toISOString());if(input==='from')from=date;else to=date;
 }
 if(from&&to&&from>to)throw Error('Thời gian bắt đầu phải trước hoặc bằng thời gian kết thúc.');
 return query.toString();
}
function auditError(error){return error.status===401?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':error.status===403?'Bạn không có quyền WEB_AUDIT_LOGS/VIEW hoặc quyền đã bị thu hồi.':error.status===404?'Không tìm thấy nhật ký này.':error.status===400?'Bộ lọc không hợp lệ. Vui lòng kiểm tra giá trị và khoảng thời gian.':'Không tải được nhật ký. Kiểm tra kết nối và thử lại.';}
function auditJson(value){return value===undefined?'Không có trường trong payload':JSON.stringify(value,null,2);}
function auditPayloadView(before,after,raw=false){
 const safeBefore=redactAudit(before),safeAfter=redactAudit(after),rows=auditChanges(safeBefore,safeAfter);
 if(raw||rows===null)return `<p class="muted">${raw?'JSON từ API sau khi che dữ liệu nhạy cảm.':'Không có đủ hai object trước/sau để so sánh. Hiển thị đúng payload được trả về.'}</p><div class="audit-json-grid"><section><h3>BeforeJson</h3><pre>${e(auditJson(safeBefore))}</pre></section><section><h3>AfterJson</h3><pre>${e(auditJson(safeAfter))}</pre></section></div>`;
 return `<p class="muted">So sánh các trường trong payload; dữ liệu có thể chỉ là metadata, không phải toàn bộ hồ sơ. Trường nhạy cảm đã được che.</p>${rows.length?`<div class="table-wrap"><table class="audit-diff"><thead><tr><th>Trường (JSON Pointer)</th><th>Trước</th><th>Sau</th></tr></thead><tbody>${rows.map(row=>`<tr><td><code>${e(row.path)}</code></td><td><pre>${e(row.hasBefore?auditJson(row.before):'Không có trường')}</pre></td><td><pre>${e(row.hasAfter?auditJson(row.after):'Không có trường')}</pre></td></tr>`).join('')}</tbody></table></div>`:'<p>Không có khác biệt trong các trường có thể hiển thị. Có thể xem Raw JSON để đối chiếu payload.</p>'}`;
}
async function mountAuditLogs(root){
 if(!root)return;
 const allowed=()=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_AUDIT_LOGS'&&p.canView==='Y');
 if(!allowed()){root.innerHTML='<p role="alert">Bạn không có quyền WEB_AUDIT_LOGS/VIEW.</p>';return;}
 let values={page:1,pageSize:30},generation=0,detailGeneration=0;
 root.innerHTML=`<form id="audit-filters" class="audit-filters"><div class="form-grid">${field('Tìm kiếm','search','search','','maxlength="150" placeholder="Người thực hiện, thao tác hoặc đối tượng"')}${field('Người thực hiện (khớp chính xác)','actorUserId','text','','maxlength="100"')}<label>Action Code (khớp chính xác)<input name="action" list="audit-actions" maxlength="100"><datalist id="audit-actions">${Object.entries(auditActionNames).map(([code,label])=>`<option value="${code}">${label}</option>`).join('')}</datalist></label>${field('EntityType (khớp chính xác)','entityType','text','','maxlength="100"')}${field('EntityId (khớp chính xác)','entityId','text','','maxlength="60"')}${field('Từ thời điểm (giờ Việt Nam)','from','datetime-local','','')}${field('Đến thời điểm (giờ Việt Nam)','to','datetime-local','','')}<label>Số dòng mỗi trang<select name="pageSize"><option>10</option><option selected>30</option><option>50</option><option>100</option></select></label></div><div class="toolbar"><button type="submit" class="btn primary">Tìm kiếm / Lọc</button><button type="button" class="btn" id="audit-clear">Xóa bộ lọc</button></div><p class="muted">Thời gian hiển thị theo Asia/Ho_Chi_Minh (UTC+7). Tìm kiếm không bao gồm nội dung JSON.</p><p id="audit-filter-error" role="alert"></p></form><div id="audit-list" aria-live="polite"></div><dialog class="audit-drawer" aria-labelledby="audit-detail-title"><div class="audit-drawer-header"><h2 id="audit-detail-title">Chi tiết nhật ký</h2><button type="button" class="icon-button" data-audit-close aria-label="Đóng chi tiết">${icon('close')}</button></div><div id="audit-detail" class="audit-drawer-body"></div></dialog>`;
 const form=root.querySelector('form'),list=root.querySelector('#audit-list'),drawer=root.querySelector('dialog'),detail=root.querySelector('#audit-detail'),filterError=root.querySelector('#audit-filter-error');let returnFocus=null;
 function close(){detailGeneration++;drawer.close();detail.replaceChildren();returnFocus?.isConnected&&returnFocus.focus();}
 drawer.querySelector('[data-audit-close]').onclick=close;drawer.addEventListener('cancel',ev=>{ev.preventDefault();close();});drawer.addEventListener('click',ev=>{if(ev.target===drawer&&ev.clientX<drawer.getBoundingClientRect().left)close();});
 async function showDetail(id,trigger){
 const current=++detailGeneration;returnFocus=trigger;detail.innerHTML='<p role="status">Đang tải chi tiết…</p>';if(!drawer.open)drawer.showModal();
 try{
 if(!allowed())throw Object.assign(Error(),{status:403});
 const raw=await apiAuditLogDetail(id);if(!drawer.isConnected||!drawer.open||current!==detailGeneration)return;
 const item=redactAudit(raw);
 detail.innerHTML=`<dl class="audit-metadata">${[['ID nhật ký',item.id],['ActorUserId',item.actorUserId??null],['Action',item.action],['EntityType',item.entityType],['EntityId',item.entityId],['CreatedAt',auditTime(item.createdAt)+' (Asia/Ho_Chi_Minh)']].map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value===null?'null':value??'Không có trường')}</dd></div>`).join('')}</dl><p>${e(auditActionNames[item.action]||'Thao tác chưa có bản dịch')}</p><div class="tabs audit-detail-tabs" role="tablist" aria-label="Hiển thị payload"><button type="button" class="tab active" role="tab" aria-selected="true" data-audit-mode="compare">So sánh trường</button><button type="button" class="tab" role="tab" aria-selected="false" data-audit-mode="raw">Raw JSON</button></div><div id="audit-payload" role="tabpanel"></div>`;
 const panel=detail.querySelector('#audit-payload');panel.innerHTML=auditPayloadView(item.beforeJson,item.afterJson);
 detail.querySelectorAll('[data-audit-mode]').forEach(button=>button.onclick=()=>{detail.querySelectorAll('[data-audit-mode]').forEach(tab=>{tab.classList.toggle('active',tab===button);tab.setAttribute('aria-selected',String(tab===button));});panel.innerHTML=auditPayloadView(item.beforeJson,item.afterJson,button.dataset.auditMode==='raw');});
 }catch(err){if(drawer.isConnected&&drawer.open&&current===detailGeneration){detail.innerHTML=`<p role="alert">${auditError(err)}</p><button class="btn" id="audit-detail-retry">Thử lại</button>`;detail.querySelector('button').onclick=()=>showDetail(id,trigger);}}
 }
 async function load(){
 const current=++generation;list.innerHTML='<p role="status">Đang tải nhật ký…</p>';
 try{
 if(!allowed())throw Object.assign(Error(),{status:403});
 const result=await apiAuditLogs(auditQuery(values));if(!list.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data)||!Number.isFinite(result.total))throw Error('Invalid response');
 list.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Phân hệ</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${result.data.map(raw=>{const item=redactAudit(raw);return `<tr><td>${e(auditTime(item.createdAt))}</td><td>${e(item.actorUserId??'Không có người thực hiện (null)')}</td><td><strong>${e(auditActionNames[item.action]||'Thao tác chưa có bản dịch')}</strong><code class="audit-action-code">${e(item.action)}</code></td><td>${e(auditModules[item.entityType]||item.entityType)}</td><td>${e(item.entityType)} · ${e(item.entityId)}</td><td><button type="button" class="btn small" data-audit-id="${e(item.id)}">Xem chi tiết</button></td></tr>`;}).join('')}</tbody></table></div>${result.data.length?'':'<div class="empty"><h3>Không có nhật ký phù hợp</h3><p>Thử thay đổi hoặc xóa bộ lọc.</p></div>'}<div class="toolbar user-pagination"><button class="btn" id="audit-prev" ${values.page<=1?'disabled':''}>Trang trước</button><span>Trang ${values.page} / ${Math.max(1,Math.ceil(result.total/values.pageSize))} · ${result.total} nhật ký</span><button class="btn" id="audit-next" ${values.page*values.pageSize>=result.total?'disabled':''}>Trang sau</button></div>`;
 list.querySelectorAll('[data-audit-id]').forEach(button=>button.onclick=()=>showDetail(button.dataset.auditId,button));list.querySelector('#audit-prev').onclick=()=>{values.page--;load();};list.querySelector('#audit-next').onclick=()=>{values.page++;load();};
 }catch(err){if(list.isConnected&&current===generation){list.innerHTML=`<p role="alert">${auditError(err)}</p><button class="btn" id="audit-retry">Thử lại</button>`;list.querySelector('button').onclick=load;}}
 }
 form.onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();const next={...Object.fromEntries(new FormData(form)),page:1};next.pageSize=Number(next.pageSize);try{auditQuery(next);filterError.textContent='';values=next;load();}catch(err){filterError.textContent=err.message;}};
 root.querySelector('#audit-clear').onclick=()=>{form.reset();filterError.textContent='';values={page:1,pageSize:30};load();};
 await load();
}


// Source: pages/administration/system-settings/approval-workflow-settings.js

const workflowRouteTypes={LEAVE:'Nghỉ phép',LEAVE_CANCELLATION:'Hủy nghỉ phép',OVERTIME:'Tăng ca',ATTENDANCE_ADJUSTMENT:'Điều chỉnh công',KPI_EVALUATION:'Đánh giá KPI',PAYROLL_PERIOD:'Kỳ lương'};
const workflowApprovers={TEAM_LEAD:'Trưởng team',DEPARTMENT_MANAGER:'Quản lý phòng ban',USER:'Nhân viên được chỉ định',HR:'HR'};
function approvalSettingsGrant(flag,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVAL_SETTINGS'&&p.canView==='Y'&&p[flag]==='Y');}
function approvalSettingsPayload(version,routes){
 if(!Number.isSafeInteger(version)||version<0)throw Error('Phiên bản cấu hình không hợp lệ.');
 if(!Array.isArray(routes)||routes.length<1||routes.length>Object.keys(workflowRouteTypes).length)throw Error('Cần từ 1 đến '+Object.keys(workflowRouteTypes).length+' loại quy trình.');
 const used=new Set();
 const normalized=routes.map(route=>{
  if(!Object.hasOwn(workflowRouteTypes,route.requestType)||used.has(route.requestType))throw Error('Loại yêu cầu không hợp lệ hoặc bị trùng.');used.add(route.requestType);
  if(typeof route.allowSelfApproval!=='boolean')throw Error('Cho phép tự duyệt phải là giá trị bật/tắt.');
  if(!Array.isArray(route.steps)||route.steps.length<1||route.steps.length>10)throw Error('Mỗi quy trình cần từ 1 đến 10 bước duyệt.');
  if(route.requestType==='PAYROLL_PERIOD'&&(route.allowSelfApproval||route.steps.some(step=>step.approverType==='TEAM_LEAD')))throw Error('Quy trình kỳ lương không được tự duyệt hoặc dùng Trưởng team; chọn HR, nhân viên chỉ định hoặc Quản lý phòng ban phù hợp.');
  return {requestType:route.requestType,allowSelfApproval:route.allowSelfApproval,steps:route.steps.map(step=>{
   if(!Object.hasOwn(workflowApprovers,step.approverType))throw Error('Loại người duyệt không hợp lệ.');
   if(step.approverType==='USER'){
    const employeeId=Number(step.employeeId);
    if(!Number.isSafeInteger(employeeId)||employeeId<=0)throw Error('Bước chỉ định cần chọn nhân viên duyệt hợp lệ, không dùng User ID.');
    return {approverType:'USER',employeeId};
   }
   if(step.approverType==='HR'){
    const employeeId=step.employeeId==null||String(step.employeeId).trim()===''?null:Number(step.employeeId),roleCode=String(step.roleCode??'HR').trim();
    if(employeeId!==null&&(!Number.isSafeInteger(employeeId)||employeeId<=0))throw Error('Nhân viên HR không hợp lệ.');
    if(!roleCode||roleCode.length>50)throw Error('Chọn role HR hợp lệ.');
    return {approverType:'HR',employeeId,roleCode};
   }
   return {approverType:step.approverType};
  })};
 });
 return {version,routes:normalized};
}

function approvalStepForType(step,type){
 if(type==='USER')return {approverType:type,employeeId:step.employeeId??null};
 if(type==='HR')return {approverType:type,employeeId:step.employeeId??null,roleCode:step.roleCode||'HR'};
 return {approverType:type};
}
const approvalEmployeeSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim();
function approvalEmployeeOptions(employees,employeeId,query=''){
 const term=approvalEmployeeSearchText(query);
 const available=employees.filter(item=>String(item.id)===String(employeeId)||!term||[item.fullName,item.employeeCode].some(value=>approvalEmployeeSearchText(value).includes(term)));
 if(employeeId&&!available.some(item=>String(item.id)===String(employeeId)))available.unshift({id:employeeId,fullName:`Nhân viên #${employeeId} (đã cấu hình)`,employeeCode:''});
 return '<option value="">Chọn nhân viên duyệt</option>'+available.map(item=>`<option value="${e(item.id)}" ${String(item.id)===String(employeeId)?'selected':''}>${e(item.fullName)}${item.employeeCode?` · ${e(item.employeeCode)}`:''}</option>`).join('')+(available.length?'':'<option value="" disabled>Không tìm thấy nhân viên phù hợp</option>');
}
function approvalStepFields(step,i,j,employees=null,employeeQuery='',roles=[]){
 const attrs=`data-route="${i}" data-step="${j}"`;
 const selector=`<label>Người duyệt<select ${attrs} data-step-field="approverType">${Object.entries(workflowApprovers).map(([value,label])=>`<option value="${value}" ${value===step.approverType?'selected':''}>${label}</option>`).join('')}</select></label>`;
 if(step.approverType==='TEAM_LEAD'||step.approverType==='DEPARTMENT_MANAGER')return selector+`<p class="muted approval-step-hint">${step.approverType==='TEAM_LEAD'?'Tự lấy trưởng team của nhân viên gửi đơn.':'Tự lấy quản lý phòng ban của nhân viên gửi đơn.'}</p>`;
 if(step.approverType==='USER'||step.approverType==='HR'){
  const required=step.approverType==='USER'?'required':'';
  let input;
  if(employees){
   input=`<div class="approval-employee-picker"><label>Tìm nhân viên<input type="search" maxlength="150" value="${e(employeeQuery)}" ${attrs} data-approval-employee-search placeholder="Tìm tên hoặc mã nhân viên" aria-label="Tìm nhân viên duyệt bước ${j+1}"></label><label>Nhân viên duyệt<select ${attrs} data-step-field="employeeId" ${required}>${approvalEmployeeOptions(employees,step.employeeId,employeeQuery)}</select></label></div>`;
  }else input=`<input type="number" min="1" step="1" ${required} value="${e(step.employeeId??'')}" ${attrs} data-step-field="employeeId" placeholder="ID nhân viên duyệt">`;
  const roleField=step.approverType==='HR'?`<label>Role HR<select ${attrs} data-step-field="roleCode" required><option value="">Chọn role</option>${roles.map(role=>`<option value="${e(role.code)}" ${role.code===(step.roleCode??'HR')?'selected':''}>${e(role.name||role.code)} · ${e(role.code)}</option>`).join('')}${step.roleCode&&!roles.some(role=>role.code===step.roleCode)?`<option selected value="${e(step.roleCode)}">${e(step.roleCode)} (đã cấu hình)</option>`:''}</select></label>`:'';
  return selector+`${employees?input:`<label>Nhân viên duyệt${input}</label>`}<p class="muted approval-step-hint">Nhân viên phải đang làm việc và có tài khoản đang hoạt động.${!step.employeeId&&step.userId?' Cấu hình cũ cần chọn lại nhân viên duyệt trước khi lưu.':''}</p>${roleField}`;
 }
 return selector;
}

async function mountApprovalWorkflowSettings(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 if(!root)return;
 let generation=0,saving=false;
 async function load(){
  const current=++generation;onDirty(false);
  if(!approvalSettingsGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem quy trình phê duyệt.</p>';return;}
  root.innerHTML='<p role="status">Đang tải quy trình phê duyệt…</p>';
  try{
   const result=await apiApprovalWorkflowSettings();if(!root.isConnected||generation!==current)return;
   if(!Number.isSafeInteger(result?.version)||result.version<0||!Array.isArray(result.routes))throw Error('Cấu hình quy trình hoặc phiên bản không hợp lệ.');
   let employees=null,roles=[];const employeeSearches=new WeakMap();
   let version=result.version,routes=result.routes.map(route=>({...route,steps:(route.steps||[]).map(step=>({...step}))}));
   const editable=approvalSettingsGrant('canUpdate');
   root.innerHTML=`<form id="approval-settings-form" class="user-registration"><h2>Quy trình phê duyệt</h2><p class="muted">Cấu hình các bước duyệt theo thứ tự cho từng loại yêu cầu. Áp dụng cho đơn gửi sau khi lưu.</p><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div id="approval-settings-employee-feedback" role="status"></div><div id="approval-settings-routes"></div><button type="button" class="btn" id="approval-settings-add">Thêm quy trình</button>${editable?'<div class="form-actions"><button type="submit" class="btn primary">Lưu quy trình</button></div>':''}</fieldset><p id="approval-settings-feedback" role="status">${editable?'':'Bạn có quyền xem; cần quyền cập nhật để lưu.'}</p></form>`;
   const form=root.querySelector('form'),container=root.querySelector('#approval-settings-routes'),fieldset=form.querySelector('fieldset'),feedback=root.querySelector('#approval-settings-feedback');
   const changed=()=>onDirty(true);
   function drawRoutes(){
    container.innerHTML=routes.map((route,i)=>`<section class="approval-route"><div class="approval-route-heading"><h3>Quy trình ${i+1}</h3><button type="button" class="btn danger small" data-route-remove="${i}">Xóa quy trình</button></div><div class="form-grid"><label>Loại yêu cầu<select data-route="${i}" data-route-field="requestType">${Object.entries(workflowRouteTypes).map(([value,label])=>`<option value="${value}" ${value===route.requestType?'selected':''}>${label}</option>`).join('')}</select></label><label class="approval-self-toggle"><span>Cho phép người gửi tự duyệt</span><span class="role-switch"><input type="checkbox" role="switch" data-route="${i}" data-route-field="allowSelfApproval" ${route.allowSelfApproval?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label></div><ol class="approval-route-steps">${route.steps.map((step,j)=>`<li><div class="approval-step-heading"><strong>Bước ${j+1}</strong><div><button type="button" class="btn small" data-route="${i}" data-step-up="${j}" ${j===0?'disabled':''}>Lên</button><button type="button" class="btn small" data-route="${i}" data-step-down="${j}" ${j===route.steps.length-1?'disabled':''}>Xuống</button><button type="button" class="btn danger small" data-route="${i}" data-step-remove="${j}" ${route.steps.length<=1?'disabled':''}>Xóa bước</button></div></div><div class="form-grid">${approvalStepFields(step,i,j,employees,employeeSearches.get(step)||'',roles)}</div></li>`).join('')}</ol><button type="button" class="btn" data-step-add="${i}" ${route.steps.length>=10?'disabled':''}>Thêm bước duyệt</button></section>`).join('')||'<p>Chưa cấu hình quy trình. Thêm quy trình để bắt đầu.</p>';
    root.querySelector('#approval-settings-add').disabled=routes.length>=Object.keys(workflowRouteTypes).length;
    container.querySelectorAll('[data-route-field]').forEach(input=>input.onchange=()=>{if(saving)return;routes[Number(input.dataset.route)][input.dataset.routeField]=input.type==='checkbox'?input.checked:input.value;changed();});
    container.querySelectorAll('[data-step-field]').forEach(input=>{
 const update=()=>{if(saving)return;const route=routes[Number(input.dataset.route)],j=Number(input.dataset.step),key=input.dataset.stepField;
 if(key==='approverType'){route.steps[j]=approvalStepForType(route.steps[j],input.value);changed();drawRoutes();}
 else{route.steps[j][key]=input.value;changed();}
 };
 input.onchange=update;if(input.tagName==='INPUT')input.oninput=update;
 });
    container.querySelectorAll('[data-approval-employee-search]').forEach(input=>{
     input.oninput=()=>{if(saving)return;const step=routes[Number(input.dataset.route)].steps[Number(input.dataset.step)];employeeSearches.set(step,input.value);input.closest('.approval-employee-picker').querySelector('select').innerHTML=approvalEmployeeOptions(employees||[],step.employeeId,input.value);};
     input.onkeydown=event=>{if(event.key==='Enter')event.preventDefault();};
    });
    container.querySelectorAll('[data-route-remove]').forEach(button=>button.onclick=()=>{if(saving)return;routes.splice(Number(button.dataset.routeRemove),1);changed();drawRoutes();});
    container.querySelectorAll('[data-step-add]').forEach(button=>button.onclick=()=>{if(saving)return;const steps=routes[Number(button.dataset.stepAdd)].steps;if(steps.length<10){steps.push({approverType:'USER',employeeId:null});changed();drawRoutes();}});
    for(const operation of ['remove','up','down'])container.querySelectorAll(`[data-step-${operation}]`).forEach(button=>button.onclick=()=>{if(saving)return;const steps=routes[Number(button.dataset.route)].steps,index=Number(button.dataset['step'+operation[0].toUpperCase()+operation.slice(1)]);if(operation==='remove'){if(steps.length<=1)return;steps.splice(index,1);}else{const target=index+(operation==='up'?-1:1);if(target<0||target>=steps.length)return;[steps[index],steps[target]]=[steps[target],steps[index]];}changed();drawRoutes();});
   }
   drawRoutes();
   async function loadEmployees(){
    const canView=apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_EMPLOYEES'&&p.canView==='Y');if(!canView)return;
    const feedback=root.querySelector('#approval-settings-employee-feedback');feedback.textContent='Đang tải danh sách nhân viên duyệt…';
    try{
     const items=[];let page=1,total=Infinity;
     while(items.length<total){const response=await apiEmployees(new URLSearchParams({page,pageSize:100,employmentStatus:'ACTIVE'}).toString());if(!form.isConnected)return;if(!Array.isArray(response?.data)||!Number.isInteger(response.total))throw Error('Danh sách nhân viên không hợp lệ.');items.push(...response.data);total=response.total;if(!response.data.length)break;page++;}
     employees=items.filter(item=>item.employmentStatus==='ACTIVE');feedback.textContent='';drawRoutes();
    }catch(err){if(form.isConnected){feedback.innerHTML=`${e(err.message)}. Bạn có thể nhập ID nhân viên. <button type="button" class="btn">Thử lại</button>`;feedback.querySelector('button').onclick=loadEmployees;}}
   }
   loadEmployees();
   async function loadRoles(){try{const items=await apiAllRoles();if(!form.isConnected)return;roles=items;drawRoutes();}catch(err){if(form.isConnected){const message=document.createElement('p');message.setAttribute('role','alert');message.textContent='Không tải được danh sách role: '+err.message;const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Thử lại';retry.onclick=()=>{message.remove();loadRoles();};message.appendChild(retry);fieldset.prepend(message);}}}
   loadRoles();
   root.querySelector('#approval-settings-add').onclick=()=>{if(saving||routes.length>=Object.keys(workflowRouteTypes).length)return;const requestType=Object.keys(workflowRouteTypes).find(type=>!routes.some(route=>route.requestType===type));if(requestType){routes.push({requestType,allowSelfApproval:false,steps:[{approverType:requestType==='PAYROLL_PERIOD'?'USER':'TEAM_LEAD'}]});changed();drawRoutes();}};
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(saving||!editable)return;
    try{
     if(!approvalSettingsGrant('canUpdate'))throw Error('Bạn không có quyền cập nhật quy trình phê duyệt.');
     const payload=approvalSettingsPayload(version,routes);saving=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu quy trình…';
     const saved=await apiApprovalWorkflowSettings(payload);if(!form.isConnected)return;
     if(!Number.isSafeInteger(saved?.version)||saved.version<0||!Array.isArray(saved.routes))throw Error('Chưa nhận cấu hình mới. Hãy tải lại để xác nhận trước khi lưu tiếp.');
     version=saved.version;routes=saved.routes.map(route=>({...route,steps:route.steps.map(step=>({...step}))}));onDirty(false);drawRoutes();feedback.textContent='Đã lưu quy trình phê duyệt.';
    }catch(err){if(form.isConnected)feedback.textContent=err.message;}
    finally{saving=false;onSaving(false);if(form.isConnected)fieldset.disabled=!editable;}
   };
  }catch(err){if(root.isConnected&&generation===current){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=load;}}
 }
 await load();
}


// Source: pages/administration/system-settings/leave-accrual-settings.js

function leaveAccrualGrant(flag,session=apiSession()){
 const has=(code,action)=>session?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y'&&p[action]==='Y');
 return !!has('WEB_SYSTEM_SETTINGS',flag);
}
function firstLeaveCycle(schedule){
 if(!schedule)return null;
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(schedule.startDate||'');
 if(!match||!Number.isInteger(schedule.interval)||schedule.interval<1||schedule.interval>120||!['MONTH','YEAR'].includes(schedule.unit))throw Error('Lịch cần ngày mốc hợp lệ, chu kỳ từ 1 đến 120 tháng hoặc năm.');
 const date=new Date(schedule.startDate+'T00:00:00Z');
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==schedule.startDate)throw Error('Ngày mốc không hợp lệ.');
 const months=Number(match[1])*12+Number(match[2])-1+schedule.interval*(schedule.unit==='YEAR'?12:1),year=Math.floor(months/12),month=months%12;
 if(year>9999)throw Error('Ngày kích hoạt vượt giới hạn năm 9999.');
 const day=Math.min(Number(match[3]),new Date(Date.UTC(year,month+1,0)).getUTCDate());
 return `${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function validateLeaveAccrual(settings,original=null,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),defaultLeaveTypeId=null){
 if(settings.scheduleVersion!==2||typeof settings.enabled!=='boolean')throw Error('Cấu hình lịch không hợp lệ.');
 if(settings.enabled&&!settings.accrualSchedule&&!settings.resetSchedule)throw Error('Chọn ít nhất một lịch khi bật tự động.');
 for(const key of ['accrualSchedule','resetSchedule']){
 const schedule=settings[key];if(schedule===null)continue;
 firstLeaveCycle(schedule);
 }
 if(!['ACTIVE_ON_DATE','ONE_MONTH'].includes(settings.newHireEligibility))throw Error('Điều kiện nhân viên mới không hợp lệ.');
 const defaultDays=settings.defaultDaysPerCycle===undefined?1:settings.defaultDaysPerCycle;
 if(!Number.isFinite(defaultDays)||defaultDays<=0||defaultDays>99999||Math.abs(defaultDays*100-Math.round(defaultDays*100))>1e-7)throw Error('Số ngày mặc định mỗi chu kỳ phải dương, tối đa 99999 và 2 chữ số thập phân.');
 if(!Array.isArray(settings.rules)||settings.rules.length>200)throw Error('Tối đa 200 quy tắc.');
 const pairs=new Set();
 for(const rule of settings.rules){
 if(!Number.isSafeInteger(rule.positionId)||rule.positionId<1||(rule.leaveTypeId!=null&&(!Number.isSafeInteger(rule.leaveTypeId)||rule.leaveTypeId<1)))throw Error('Chọn chức vụ và loại phép hợp lệ.');
 const days=rule.daysPerCycle;
 if((settings.accrualSchedule||days!=null)&&(!Number.isFinite(days)||days<=0||days>99999||Math.abs(days*100-Math.round(days*100))>1e-7))throw Error('Số ngày mỗi chu kỳ phải dương, tối đa 99999 và 2 chữ số thập phân.');
 const pair=`${rule.positionId}/${rule.leaveTypeId??defaultLeaveTypeId??'ANNUAL'}`;if(pairs.has(pair))throw Error('Trùng chức vụ và loại phép.');pairs.add(pair);
 }
 return settings;
}
function leaveCycleFields(key,label,schedule){
 return `<section class="system-settings-location"><label class="role-toggle-row" style="flex-direction:row"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" name="${key}-enabled" ${schedule?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label><div class="form-grid">${field('Ngày mốc',key+'-startDate','date',schedule?.startDate||'')}${field('Chu kỳ',key+'-interval','number',schedule?.interval??'','min="1" max="120" step="1"')}<label>Đơn vị<select name="${key}-unit"><option value="MONTH" ${schedule?.unit==='MONTH'?'selected':''}>Tháng</option><option value="YEAR" ${schedule?.unit==='YEAR'?'selected':''}>Năm</option></select></label></div><p class="muted" data-cycle-preview="${key}"></p></section>`;
}
async function mountLeaveAccrualSettings(root,options={}){
 if(!leaveAccrualGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem WEB_SYSTEM_SETTINGS.</p>';return;}
 root.innerHTML='<p role="status">Đang tải cấu hình…</p>';
 try{
 const result=await apiLeaveAccrualSettings();if(!root.isConnected)return;
 if(!result?.settings||!Number.isSafeInteger(result.version)||result.version<0)throw Error('Cấu hình trả về không hợp lệ.');
 let version=result.version,original=result.version>0?result.settings:null,busy=false,dirty=false,sequence=0;
 const settings=result.settings,canUpdate=leaveAccrualGrant('canUpdate');
 const catalogs=await Promise.allSettled([apiActivePositions(),apiWorkflowLeaveTypes()]);if(!root.isConnected)return;
 const positions=catalogs[0].status==='fulfilled'?catalogs[0].value:[];
 const rawTypes=catalogs[1].status==='fulfilled'?catalogs[1].value:[];
 const types=(Array.isArray(rawTypes)?rawTypes:rawTypes?.data||rawTypes?.items||[]).filter(item=>item.isActive&&item.requiresBalance);
 const toggle=(name,label,value)=>`<label class="role-toggle-row" style="flex-direction:row"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" name="${name}" ${value?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;
 root.innerHTML=`<form class="user-registration"><h2>Cấp/Thu hồi phép</h2><fieldset class="user-edit-fieldset" ${canUpdate?'':'disabled'}>${toggle('enabled','Tự động cấp và thu hồi phép',settings.enabled)}${settings.scheduleVersion!==2&&!settings.accrualSchedule&&!settings.resetSchedule?'<p role="status">Cấu hình cũ: hãy chọn lại ngày mốc và chu kỳ trước khi lưu chuyển sang lịch mới.</p>':''}${leaveCycleFields('accrualSchedule','Lịch cấp phép',settings.accrualSchedule)}${leaveCycleFields('resetSchedule','Lịch thu hồi phép',settings.resetSchedule)}<label>Điều kiện nhân viên mới<select name="newHireEligibility"><option value="ACTIVE_ON_DATE" ${settings.newHireEligibility==='ACTIVE_ON_DATE'?'selected':''}>Đã vào làm tại ngày đến hạn</option><option value="ONE_MONTH" ${settings.newHireEligibility==='ONE_MONTH'?'selected':''}>Đủ một tháng làm việc</option></select></label>${field('Số ngày cấp mặc định mỗi chu kỳ','defaultDaysPerCycle','number',settings.defaultDaysPerCycle??1,'required min="0.01" max="99999" step="0.01"')}<h3>Quy tắc cộng phép theo chức vụ</h3><div data-accrual-rules></div><button type="button" class="btn" data-accrual-add>Thêm quy tắc</button><div class="form-actions"><button class="btn primary" type="submit">Lưu cấu hình</button><button class="btn" type="button" data-accrual-run>Chạy lịch đến hạn</button></div></fieldset><p role="status" data-accrual-feedback>${canUpdate?'Chạy lịch sử dụng cấu hình đã lưu.':'Để lưu hoặc chạy lịch cần WEB_SYSTEM_SETTINGS/UPDATE.'}</p></form>`;
 const form=root.querySelector('form'),fieldset=form.querySelector('fieldset'),feedback=form.querySelector('[data-accrual-feedback]'),container=form.querySelector('[data-accrual-rules]'),add=form.querySelector('[data-accrual-add]'),run=form.querySelector('[data-accrual-run]');
 const readSchedule=key=>form.elements.namedItem(key+'-enabled').checked?{startDate:form.elements.namedItem(key+'-startDate').value,interval:Number(form.elements.namedItem(key+'-interval').value),unit:form.elements.namedItem(key+'-unit').value}:null;
 function preview(){for(const key of ['accrualSchedule','resetSchedule']){const schedule=readSchedule(key);for(const suffix of ['startDate','interval','unit']){const control=form.elements.namedItem(key+'-'+suffix);control.disabled=!schedule;control.required=!!schedule;}const target=form.querySelector(`[data-cycle-preview="${key}"]`);try{target.textContent=schedule?'Lần kích hoạt đầu tiên: '+firstLeaveCycle(schedule):'Không áp dụng lịch này.';}catch(err){target.textContent=err.message;}}}
 const markDirty=()=>{dirty=true;options.onDirty?.(true);run.disabled=true;preview();};form.oninput=form.onchange=markDirty;
 const choice=(label,name,value,items)=>items.length?`<label>${label}<select name="${name}" ${label==='Loại phép'?'':'required'}><option value="">${label==='Loại phép'?'Nghỉ phép năm (ANNUAL)':'Chọn '+label.toLowerCase()}</option>${value&&!items.some(item=>item.id===value)?`<option value="${e(value)}" selected>ID ${e(value)} (ngoài danh mục hiện tại)</option>`:''}${items.map(item=>`<option value="${e(item.id)}" ${item.id===value?'selected':''}>${e(item.name)}</option>`).join('')}</select></label>`:field(`${label} (ID)`,name,'number',value??'',`${label==='Loại phép'?'':'required'} min="1" step="1" placeholder="${label==='Loại phép'?'ANNUAL':''}"`);
 function addRule(rule={}){
 if(container.children.length>=200)return;const row=document.createElement('section'),prefix=`accrual-${sequence++}-`;row.className='system-settings-location';row.dataset.rulePrefix=prefix;
 row.innerHTML=`<div class="form-grid">${choice('Chức vụ',prefix+'positionId',rule.positionId,positions)}${choice('Loại phép',prefix+'leaveTypeId',rule.leaveTypeId,types)}${field('Số ngày cấp mỗi chu kỳ',prefix+'daysPerCycle','number',rule.daysPerCycle??rule.daysPerMonth??'','min="0.01" max="99999" step="0.01"')}</div><button type="button" class="btn danger">Xóa quy tắc</button>`;
 row.querySelector('button').onclick=()=>{if(busy)return;row.remove();add.disabled=false;markDirty();};container.appendChild(row);add.disabled=container.children.length>=200;
 }
 settings.rules.forEach(addRule);preview();add.onclick=()=>{if(!busy){addRule();markDirty();}};
 function setBusy(value){busy=value;fieldset.disabled=value||!canUpdate;options.onSaving?.(value);}
 form.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||!canUpdate)return;
 const data=new FormData(form),payload={scheduleVersion:2,enabled:data.has('enabled'),defaultDaysPerCycle:Number(data.get('defaultDaysPerCycle')),accrualSchedule:readSchedule('accrualSchedule'),resetSchedule:readSchedule('resetSchedule'),newHireEligibility:data.get('newHireEligibility'),rules:[...container.children].map(row=>{const get=key=>data.get(row.dataset.rulePrefix+key);return {positionId:Number(get('positionId')),leaveTypeId:get('leaveTypeId')?Number(get('leaveTypeId')):null,daysPerCycle:get('daysPerCycle')?Number(get('daysPerCycle')):null};})};
 try{if(original&&original.scheduleVersion!==2&&!original.accrualSchedule&&!original.resetSchedule&&!payload.accrualSchedule&&!payload.resetSchedule)throw Error('Chọn ngày mốc và chu kỳ để chuyển cấu hình cũ sang lịch mới.');validateLeaveAccrual(payload,original,undefined,result.defaultLeaveTypeId);}catch(err){feedback.textContent=err.message;return;}
 setBusy(true);feedback.textContent='Đang lưu…';
 try{const saved=await apiLeaveAccrualSettings({version,settings:payload});if(!Number.isSafeInteger(saved?.version)||saved.version<0)throw Error('Chưa nhận được phiên bản mới; tải lại cấu hình trước khi lưu tiếp.');version=saved.version;original=saved.settings||payload;dirty=false;options.onDirty?.(false);feedback.textContent='Đã lưu cấu hình.';}
 catch(err){feedback.textContent=err.message+' Nếu phiên bản đã thay đổi, tải lại trang trước khi lưu lại.';}
 finally{setBusy(false);run.disabled=dirty;}
 };
 run.onclick=async()=>{
 if(busy||dirty||!canUpdate)return;setBusy(true);feedback.textContent='Đang chạy lịch đến hạn…';
 try{const result=await apiRunLeaveAccrual();feedback.textContent=`Ngày xử lý: ${result.asOfDate} · Đã cộng: ${result.creditedBalances} số dư · Đã thu hồi: ${result.expiredBalances} số dư${result.accrualAlreadyProcessed?' · Kỳ cộng đã xử lý':''}${result.resetAlreadyProcessed?' · Kỳ thu hồi đã xử lý':''}.`;}
 catch(err){feedback.textContent=err.message;}finally{setBusy(false);}
 };
 }catch(err){if(root.isConnected)root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;root.querySelector('button')?.addEventListener('click',()=>mountLeaveAccrualSettings(root,options));}
}


// Source: pages/administration/system-settings/terminal-logging.js

function terminalLoggingGrant(flag,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_SYSTEM_SETTINGS'&&p.canView==='Y'&&p[flag]==='Y');}
function terminalLoggingCatalog(response){if(!Array.isArray(response?.modules)||response.modules.some(name=>typeof name!=='string'||!name.trim())||!Array.isArray(response.specialUsers)||response.specialUsers.some(name=>typeof name!=='string'||!name.trim()))throw Error('Danh mục module log không hợp lệ.');return response;}
function terminalLoggingValidate(settings,catalog){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Cấu hình log không hợp lệ.');
 for(const key of ['enabled','defaultUser','defaultModule','includeSql'])if(!['Y','N'].includes(settings[key]))throw Error('Cấu hình log chỉ nhận Y hoặc N.');
 for(const key of ['users','modules']){
 const rules=settings[key];if(!rules||typeof rules!=='object'||Array.isArray(rules)||Object.keys(rules).length>500)throw Error('Tối đa 500 cấu hình riêng cho user hoặc module.');const used=new Set();
 for(const [name,flag] of Object.entries(rules)){const normalized=name.toLowerCase();if(!name.trim()||name!==name.trim()||key==='users'&&name.length>100||used.has(normalized)||!['Y','N'].includes(flag))throw Error('User/module không được trống, trùng tên hoặc có cờ khác Y/N.');used.add(normalized);if(key==='modules'&&!catalog.modules.some(module=>module.toLowerCase()===normalized))throw Error('Module không thuộc danh mục: '+name);}
 }
 if(settings.userModules!==undefined){
 const entries=settings.userModules;if(!entries||typeof entries!=='object'||Array.isArray(entries)||Object.keys(entries).length>500)throw Error('Tối đa 500 cấu hình module theo user.');const seen=new Set();
 for(const [user,modules] of Object.entries(entries)){if(!user.trim()||user!==user.trim()||user.length>100||seen.has(user.toLowerCase()))throw Error('User không hợp lệ hoặc trùng tên.');seen.add(user.toLowerCase());terminalLoggingValidate({...settings,userModules:undefined,users:{},modules},catalog);}
 }
 return settings;
}
function terminalLoggingEffective(rules,key,fallback){const existing=Object.keys(rules).find(name=>name.toLowerCase()===key.toLowerCase());return existing===undefined?fallback:rules[existing];}
function terminalLoggingModuleMode(settings,modules){return settings.defaultModule==='Y'&&modules.every(name=>terminalLoggingEffective(settings.modules,name,settings.defaultModule)==='Y')?'ALL':'SELECTED';}
function terminalLoggingSelectAll(settings){settings.defaultModule='Y';settings.modules={};return settings;}
function terminalLoggingSetModule(settings,module,enabled,modules){
 const next={...settings.modules};for(const name of modules){const key=Object.keys(next).find(key=>key.toLowerCase()===name.toLowerCase())||name;next[key]=terminalLoggingEffective(settings.modules,name,settings.defaultModule);}
 const key=Object.keys(next).find(key=>key.toLowerCase()===module.toLowerCase())||module;next[key]=enabled?'Y':'N';settings.defaultModule='N';settings.modules=next;return settings;
}
function terminalLoggingUserModules(settings,user,modules){
 const key=Object.keys(settings.userModules||{}).find(key=>key.toLowerCase()===user.toLowerCase());
 if(key!==undefined)return settings.userModules[key];
 return Object.fromEntries(modules.map(module=>[module,terminalLoggingEffective(settings.modules,module,settings.defaultModule)]));
}
function terminalLoggingSetUserModules(settings,user,rules){
 settings.userModules||={};const key=Object.keys(settings.userModules).find(key=>key.toLowerCase()===user.toLowerCase())||user;
 if(rules===null)delete settings.userModules[key];else settings.userModules[key]={...rules};return settings;
}
function terminalLoggingAddUser(settings,userId){const id=String(userId||'').trim();if(!id||id.length>100)throw Error('Chọn hoặc nhập User ID hợp lệ.');if(Object.keys(settings.users).some(key=>key.toLowerCase()===id.toLowerCase()))throw Error('User này đã có trong danh sách.');if(Object.keys(settings.users).length>=500)throw Error('Tối đa 500 user.');settings.users={...settings.users,[id]:'Y'};terminalLoggingSetUserModules(settings,id,{});return settings;}
// Keep the API-required fallback disabled; only explicitly configured users may log.
function terminalLoggingExplicitUsers(settings){return {...JSON.parse(JSON.stringify(settings)),defaultUser:'N'};}
function terminalLoggingState(response){
 if(!Number.isSafeInteger(response?.version)||response.version<0||!response.settings)throw Error('Cấu hình hoặc phiên bản log trả về không hợp lệ.');
 const settings=JSON.parse(JSON.stringify(response.settings));for(const key of ['enabled','defaultUser','defaultModule','includeSql'])if(typeof settings[key]==='string')settings[key]=settings[key].toUpperCase();
 for(const map of ['users','modules'])if(settings[map]&&typeof settings[map]==='object'&&!Array.isArray(settings[map]))for(const key of Object.keys(settings[map]))if(typeof settings[map][key]==='string')settings[map][key]=settings[map][key].toUpperCase();
 for(const rules of Object.values(settings.userModules||{}))if(rules&&typeof rules==='object'&&!Array.isArray(rules))for(const key of Object.keys(rules))if(typeof rules[key]==='string')rules[key]=rules[key].toUpperCase();
 terminalLoggingValidate(settings,{modules:[...Object.keys(settings.modules||{}),...Object.values(settings.userModules||{}).flatMap(rules=>Object.keys(rules||{}))]});const etag=response.etag||`"${response.version}"`;if(!/^"(?:0|[1-9]\d*)"$/.test(etag))throw Error('ETag cấu hình log không hợp lệ.');return {settings,etag,version:response.version,updatedAtUtc:response.updatedAtUtc};
}

function terminalLoggingToggle(name,label,enabled){return `<label class="role-toggle-row terminal-toggle"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" name="${name}" ${enabled?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;}

async function mountTerminalLogging(root,options={}){
 if(!root)return;if(!terminalLoggingGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền WEB_SYSTEM_SETTINGS/VIEW.</p>';return;}
 let catalog,state,draft,busy=false,dirty=false,stale=false,pickerOpen=false,userPage=1,userSearch='',userGeneration=0,userTimer,userRows=[],userTotal=0;
 const canUpdate=terminalLoggingGrant('canUpdate'),canListUsers=!!apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_USERS'&&p.canView==='Y');
 function setDirty(value){dirty=value;options.onDirty?.(value);}
 function setBusy(value){busy=value;options.onSaving?.(value);}
 async function load(){
 root.innerHTML='<p role="status">Đang tải cấu hình log terminal…</p>';
 try{const [response,modules]=await Promise.all([apiTerminalLoggingSettings(),apiTerminalLoggingModules()]);if(!root.isConnected)return;catalog=terminalLoggingCatalog(modules);state=terminalLoggingState(response);draft=state.settings;
 for(const user of Object.keys(draft.userModules||{}))if(!Object.keys(draft.users).some(key=>key.toLowerCase()===user.toLowerCase()))draft.users[user]=draft.defaultUser;
 // Display saved overrides even if a module was removed from the current catalog.
 if(!['enabled','defaultUser','defaultModule','includeSql'].every(key=>['Y','N'].includes(draft[key]))||!draft.users||Array.isArray(draft.users)||!draft.modules||Array.isArray(draft.modules))throw Error('Cấu hình log trả về không hợp lệ.');
 stale=false;pickerOpen=false;setDirty(false);render();
 }catch(err){if(root.isConnected){root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;root.querySelector('button').onclick=load;}}
 }
 function userModuleForm(user,index){
 const custom=Object.keys(draft.userModules||{}).some(key=>key.toLowerCase()===user.toLowerCase()),rules=terminalLoggingUserModules(draft,user,catalog.modules),all=catalog.modules.length>0&&catalog.modules.every(module=>terminalLoggingEffective(rules,module,'N')==='Y');
 return `<div class="terminal-user-module-form"><label>Module của ${e(user)}<select data-terminal-user-mode="${index}"><option value="DEFAULT" ${!custom?'selected':''}>Dùng module mặc định</option><option value="ALL" ${custom&&all?'selected':''}>Tất cả module hiện tại</option><option value="SELECTED" ${custom&&!all?'selected':''}>Chọn nhiều module</option></select></label>${custom?`<div class="terminal-modules">${catalog.modules.map((module,moduleIndex)=>`<label><input type="checkbox" data-terminal-user-module="${index}" data-module-index="${moduleIndex}" ${terminalLoggingEffective(rules,module,'N')==='Y'?'checked':''}><span>${e(module)}</span></label>`).join('')}</div>${Object.keys(rules).filter(key=>!catalog.modules.some(module=>module.toLowerCase()===key.toLowerCase())).map(key=>`<div class="terminal-unknown-module"><span>${e(key)} (ngoài danh mục)</span><button type="button" class="btn small" data-terminal-remove-user-module="${index}" data-module="${e(key)}">Xóa</button></div>`).join('')}`:''}</div>`;
 }
 function render(){
 ++userGeneration;clearTimeout(userTimer);const mode=terminalLoggingModuleMode(draft,catalog.modules);
 root.innerHTML=`<form id="terminal-logging-form" class="terminal-logging-form"><div class="terminal-heading"><div><h2>Terminal Logging</h2><p>Cấu hình log theo user và module</p></div><span class="muted">${state.version===0?'Cấu hình mặc định của máy chủ':'Phiên bản '+state.version}</span></div><fieldset class="user-edit-fieldset" ${canUpdate?'':'disabled'}><div class="terminal-global-switches">${terminalLoggingToggle('enabled','Bật log terminal',draft.enabled==='Y')}${terminalLoggingToggle('includeSql','Ghi log SQL',draft.includeSql==='Y')}</div><div class="terminal-rule-grid"><section class="terminal-rule-section"><div class="terminal-section-heading"><h3>User</h3><button type="button" class="btn" data-terminal-add-user ${Object.keys(draft.users).length>=500?'disabled':''}>${icon('plus',16)} Thêm user</button></div><p class="muted">Chỉ user được thêm và bật trong danh sách mới được ghi log.</p><div data-terminal-user-list>${Object.keys(draft.users).length?Object.entries(draft.users).map(([user,flag],index)=>`<div class="terminal-user-card"><div class="terminal-user-row"><span class="terminal-user-name">${e(user)}</span><span class="role-switch"><input type="checkbox" role="switch" data-terminal-user="${index}" aria-label="Bật log cho ${e(user)}" ${flag==='Y'?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span><button type="button" class="icon-button" data-terminal-remove-user="${index}" aria-label="Xóa cấu hình user ${e(user)}">${icon('close',16)}</button></div>${userModuleForm(user,index)}</div>`).join(''):'<p class="empty terminal-empty">Chưa có cấu hình user riêng.</p>'}</div><div class="terminal-user-picker" data-terminal-user-picker ${pickerOpen?'':'hidden'}>${canListUsers?'<label>Tìm user<input type="search" data-terminal-user-search placeholder="User ID hoặc email"></label><label>Chọn user<select data-terminal-user-choice><option value="">Chọn user…</option></select></label><div class="terminal-user-pagination" data-terminal-user-pages></div>':`<label>User ID<input type="text" maxlength="100" list="terminal-special-users" data-terminal-user-choice placeholder="Nhập đúng User ID"><datalist id="terminal-special-users">${catalog.specialUsers.map(user=>`<option value="${e(user)}"></option>`).join('')}</datalist></label>`}<button type="button" class="btn primary" data-terminal-confirm-user>Thêm vào danh sách</button><p class="muted" role="status" data-terminal-user-feedback></p></div></section><section class="terminal-rule-section"><h3>Module mặc định</h3><p class="muted">Áp dụng cho user chưa có cấu hình module riêng.</p><label>Phạm vi module<select name="moduleMode"><option value="ALL" ${mode==='ALL'?'selected':''}>Tất cả module</option><option value="SELECTED" ${mode==='SELECTED'?'selected':''}>Chọn nhiều module</option></select></label><div class="terminal-modules" ${mode==='ALL'?'hidden':''}>${catalog.modules.map((module,index)=>`<label><input type="checkbox" data-terminal-module="${index}" ${terminalLoggingEffective(draft.modules,module,draft.defaultModule)==='Y'?'checked':''}><span>${e(module)}</span></label>`).join('')||'<p>Chưa có module trong danh mục.</p>'}</div>${mode==='ALL'?'<p class="muted terminal-all-modules">Áp dụng cho tất cả module hiện tại và module mới.</p>':''}${Object.keys(draft.modules).filter(key=>!catalog.modules.some(module=>module.toLowerCase()===key.toLowerCase())).map(key=>`<div class="terminal-unknown-module"><span>${e(key)} (ngoài danh mục)</span><button class="btn small danger" type="button" data-terminal-remove-module="${e(key)}">Xóa cấu hình cũ</button></div>`).join('')}</section></div><div class="form-actions">${canUpdate?`<button class="btn primary" type="submit" ${stale?'disabled':''}>Lưu cấu hình</button>`:''}</div></fieldset><div class="terminal-feedback"><p role="status" data-terminal-feedback>${!canUpdate?'Bạn chỉ có quyền xem. Lưu cần WEB_SYSTEM_SETTINGS/UPDATE.':stale?'Cấu hình đã thay đổi. Tải lại trước khi lưu tiếp.':''}</p><button class="btn" type="button" data-terminal-reload>Tải lại cấu hình</button></div></form>`;
 const form=root.querySelector('form'),fieldset=form.querySelector('fieldset'),feedback=form.querySelector('[data-terminal-feedback]');
 for(const key of ['enabled','includeSql'])form.elements.namedItem(key).onchange=event=>{if(busy||!canUpdate)return;draft[key]=event.target.checked?'Y':'N';setDirty(true);};
 form.elements.moduleMode.onchange=event=>{if(busy||!canUpdate)return;if(event.target.value==='ALL')terminalLoggingSelectAll(draft);else{const next={...draft.modules};for(const module of catalog.modules){const key=Object.keys(next).find(key=>key.toLowerCase()===module.toLowerCase())||module;next[key]=terminalLoggingEffective(draft.modules,module,draft.defaultModule);}draft.defaultModule='N';draft.modules=next;}setDirty(true);render();};
 root.querySelectorAll('[data-terminal-module]').forEach(input=>input.onchange=()=>{if(busy||!canUpdate)return;terminalLoggingSetModule(draft,catalog.modules[Number(input.dataset.terminalModule)],input.checked,catalog.modules);setDirty(true);});
 root.querySelectorAll('[data-terminal-user]').forEach(input=>input.onchange=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(input.dataset.terminalUser)];draft.users[user]=input.checked?'Y':'N';setDirty(true);});
 root.querySelectorAll('[data-terminal-remove-user]').forEach(button=>button.onclick=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(button.dataset.terminalRemoveUser)];delete draft.users[user];terminalLoggingSetUserModules(draft,user,null);setDirty(true);render();});
 root.querySelectorAll('[data-terminal-remove-module]').forEach(button=>button.onclick=()=>{if(busy||!canUpdate)return;delete draft.modules[button.dataset.terminalRemoveModule];setDirty(true);render();});
 root.querySelectorAll('[data-terminal-user-mode]').forEach(select=>select.onchange=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(select.dataset.terminalUserMode)];terminalLoggingSetUserModules(draft,user,select.value==='DEFAULT'?null:select.value==='ALL'?Object.fromEntries(catalog.modules.map(module=>[module,'Y'])):terminalLoggingUserModules(draft,user,catalog.modules));setDirty(true);render();});
 root.querySelectorAll('[data-terminal-user-module]').forEach(input=>input.onchange=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(input.dataset.terminalUserModule)],rules={...terminalLoggingUserModules(draft,user,catalog.modules)},module=catalog.modules[Number(input.dataset.moduleIndex)],key=Object.keys(rules).find(key=>key.toLowerCase()===module.toLowerCase())||module;rules[key]=input.checked?'Y':'N';terminalLoggingSetUserModules(draft,user,rules);setDirty(true);});
 root.querySelectorAll('[data-terminal-remove-user-module]').forEach(button=>button.onclick=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(button.dataset.terminalRemoveUserModule)],rules={...terminalLoggingUserModules(draft,user,catalog.modules)};delete rules[button.dataset.module];terminalLoggingSetUserModules(draft,user,rules);setDirty(true);render();});
 root.querySelector('[data-terminal-add-user]').onclick=()=>{if(busy||!canUpdate)return;pickerOpen=!pickerOpen;render();};
 root.querySelector('[data-terminal-confirm-user]').onclick=()=>{if(busy||!canUpdate)return;try{const id=root.querySelector('[data-terminal-user-choice]').value;terminalLoggingAddUser(draft,id);pickerOpen=false;setDirty(true);render();}catch(err){root.querySelector('[data-terminal-user-feedback]').textContent=err.message;}};
 root.querySelector('[data-terminal-reload]').onclick=()=>{if(busy)return;if(dirty&&!confirm('Bỏ thay đổi cấu hình log chưa lưu để tải lại?'))return;++userGeneration;clearTimeout(userTimer);load();};
 if(pickerOpen&&canListUsers){const input=root.querySelector('[data-terminal-user-search]');input.value=userSearch;input.oninput=()=>{clearTimeout(userTimer);++userGeneration;userSearch=input.value.trim();userPage=1;userTimer=setTimeout(loadUsers,300);};void loadUsers();}
 form.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||stale||!terminalLoggingGrant('canUpdate'))return;let payload;
 try{payload=terminalLoggingExplicitUsers(draft);terminalLoggingValidate(payload,catalog);}catch(err){feedback.textContent=err.message;return;}
 setBusy(true);fieldset.disabled=true;root.querySelector('[data-terminal-reload]').disabled=true;feedback.textContent='Đang lưu cấu hình log…';
 try{const response=await apiTerminalLoggingSettings(payload,state.etag);if(!form.isConnected)return;const saved=terminalLoggingState(response);if(saved.version<=state.version)throw Error('Chưa nhận phiên bản mới. Tải lại cấu hình để xác nhận trước khi lưu tiếp.');terminalLoggingValidate(saved.settings,catalog);state=saved;draft=state.settings;pickerOpen=false;setDirty(false);setBusy(false);render();root.querySelector('[data-terminal-feedback]').textContent='Đã lưu cấu hình log terminal.';toast('Đã lưu cấu hình log terminal.');}
 catch(err){if(form.isConnected){stale=[409,412,428].includes(err.status);feedback.textContent=err.message+(stale?' Tải lại cấu hình trước khi sửa và lưu tiếp.':'');}}
 finally{setBusy(false);if(form.isConnected){fieldset.disabled=!canUpdate;const save=form.querySelector('[type=submit]');if(save)save.disabled=stale;root.querySelector('[data-terminal-reload]').disabled=false;}}
 };
 }
 async function loadUsers(){
 const current=++userGeneration;if(!root.isConnected||!pickerOpen)return;const status=root.querySelector('[data-terminal-user-feedback]');status.textContent='Đang tải user…';
 try{const result=await apiUsers(userPage,userSearch);if(!root.isConnected||current!==userGeneration||!pickerOpen)return;if(!Array.isArray(result.data)||!Number.isSafeInteger(result.total))throw Error('Danh sách user không hợp lệ.');userRows=result.data;userTotal=result.total;
 const selected=new Set(Object.keys(draft.users).map(key=>key.toLowerCase())),special=catalog.specialUsers.filter(user=>!userSearch||user.toLowerCase().includes(userSearch.toLowerCase())),seen=new Set(special.map(user=>user.toLowerCase())),ordinary=userRows.filter(user=>!seen.has(user.userId.toLowerCase()));
 const select=root.querySelector('[data-terminal-user-choice]');select.innerHTML='<option value="">Chọn user…</option>'+special.map(user=>`<option value="${e(user)}" ${selected.has(user.toLowerCase())?'disabled':''}>${e(user)}</option>`).join('')+ordinary.map(user=>`<option value="${e(user.userId)}" ${selected.has(user.userId.toLowerCase())?'disabled':''}>${e(user.userId)} · ${e(user.email)}</option>`).join('');
 const pages=root.querySelector('[data-terminal-user-pages]');pages.innerHTML=`<button class="btn small" type="button" data-prev ${userPage===1?'disabled':''}>Trước</button><small>Trang ${userPage}</small><button class="btn small" type="button" data-next ${userPage*30>=userTotal?'disabled':''}>Sau</button>`;pages.querySelector('[data-prev]').onclick=()=>{userPage--;loadUsers();};pages.querySelector('[data-next]').onclick=()=>{userPage++;loadUsers();};status.textContent='';
 }catch(err){if(root.isConnected&&current===userGeneration){status.innerHTML=`${e(err.message)} <button class="btn small" type="button">Thử lại</button>`;status.querySelector('button').onclick=loadUsers;}}
 }
 await load();
}


// Source: pages/administration/system-settings/system-settings.js

const systemSettingTabs={'password-policy':'Chính sách mật khẩu',attendance:'Chấm công','leave-accrual':'Cấp/Thu hồi phép','terminal-logging':'Terminal Logging','approval-workflow':'Quy trình phê duyệt'};
const passwordSettingFlags=[['requireUppercase','Yêu cầu chữ hoa'],['requireLowercase','Yêu cầu chữ thường'],['requireDigit','Yêu cầu chữ số'],['requireSpecialCharacter','Yêu cầu ký tự đặc biệt'],['disallowUsernameInPassword','Không cho chứa tên đăng nhập']];
const attendanceSettingFlags=[['requireQr','Yêu cầu mã QR'],['requireGps','Yêu cầu vị trí GPS'],['allowOvernightShifts','Cho phép ca qua đêm']];
const attendanceSettingNumbers=[['checkInBeforeStartMinutes','Cho phép check-in trước giờ bắt đầu (phút)',1440],['checkInAfterStartMinutes','Cho phép check-in sau giờ bắt đầu (phút)',1440],['checkOutBeforeEndMinutes','Cho phép check-out trước giờ kết thúc (phút)',1440],['checkOutAfterEndMinutes','Cho phép check-out sau giờ kết thúc (phút)',1440],['lateGraceMinutes','Thời gian đi trễ được bỏ qua (phút)',240],['earlyLeaveGraceMinutes','Thời gian về sớm được bỏ qua (phút)',240]];
const missingPunchRules=['REJECT_CHECKOUT_WITHOUT_CHECKIN','INCOMPLETE'];
function systemSettingsGrant(flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_SYSTEM_SETTINGS'&&p.canView==='Y'&&p[flag]==='Y');}
function validateSystemSettings(kind,settings){
 const integer=(key,min,max)=>{if(!Number.isInteger(settings[key])||settings[key]<min||settings[key]>max)throw Error(`${key} phải là số nguyên từ ${min} đến ${max}.`);};
 const boolean=key=>{if(typeof settings[key]!=='boolean')throw Error(`${key} phải là giá trị bật/tắt.`);};
 if(kind==='password-policy'){
 integer('minimumLength',1,1024);integer('maximumLength',1,1024);integer('passwordHistoryCount',0,100);
 passwordSettingFlags.forEach(([key])=>boolean(key));
 if(settings.minimumLength>settings.maximumLength)throw Error('Độ dài tối thiểu không được lớn hơn độ dài tối đa.');
 const groups=passwordSettingFlags.slice(0,4).filter(([key])=>settings[key]).length;
 if(settings.maximumLength<groups)throw Error('Độ dài tối đa phải đủ cho số nhóm ký tự bắt buộc.');
 }else if(kind==='attendance'){
 if(typeof settings.timezone!=='string'||!settings.timezone.trim())throw Error('Vui lòng nhập múi giờ.');
 attendanceSettingNumbers.forEach(([key,,max])=>integer(key,0,max));attendanceSettingFlags.forEach(([key])=>boolean(key));
 if(!Array.isArray(settings.workingDays)||!settings.workingDays.length||new Set(settings.workingDays).size!==settings.workingDays.length||settings.workingDays.some(day=>!Number.isInteger(day)||day<1||day>7))throw Error('Chọn ít nhất một ngày làm việc hợp lệ, không trùng.');
 if(!missingPunchRules.includes(settings.missingPunchRule))throw Error('Quy tắc thiếu lượt chấm công không hợp lệ.');
 const holidays=settings.holidayDates??[];
 if(!Array.isArray(holidays)||holidays.length>3660||holidays.some(day=>typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day))throw Error('Ngày lễ phải có định dạng YYYY-MM-DD hợp lệ, tối đa 3660 ngày.');
 if(!Array.isArray(settings.locations)||settings.locations.length>20)throw Error('Cho phép tối đa 20 địa điểm.');
 if((settings.requireQr||settings.requireGps)&&!settings.locations.length)throw Error('Cần ít nhất một địa điểm khi bật QR hoặc GPS.');
 const codes=new Set();
 for(const location of settings.locations){
 if(typeof location.code!=='string'||!location.code.trim()||location.code.length>50||location.code!==location.code.toUpperCase()||codes.has(location.code))throw Error('Mã địa điểm phải viết hoa, không trùng và dài tối đa 50 ký tự.');
 codes.add(location.code);
 if(typeof location.name!=='string'||!location.name.trim()||location.name.length>150)throw Error('Tên địa điểm phải có từ 1 đến 150 ký tự.');
 for(const [key,min,max] of [['latitude',-90,90],['longitude',-180,180],['radiusMeters',10,10000]])if(!Number.isFinite(location[key])||location[key]<min||location[key]>max)throw Error(`${key} của địa điểm phải từ ${min} đến ${max}.`);
 }
 }else throw Error('Loại cấu hình không hợp lệ.');
 return settings;
}
function systemSettingToggle(key,label,value){return `<label class="role-toggle-row"><span>${label}</span><span class="role-switch"><input name="${key}" type="checkbox" role="switch" ${value?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;}
function systemSettingNumber(label,key,value,min,max){return field(label,key,'number',value,`required min="${min}" max="${max}" step="1"`);}
function passwordPolicySelect(label,key,value,choices,unit){
 const values=[...new Set([...choices,value])].sort((a,b)=>a-b);
 return `<label>${label}<select name="${key}">${values.map(option=>`<option value="${option}" ${option===value?'selected':''}>${option} ${unit}</option>`).join('')}</select></label>`;
}
async function mountSystemSettings(root,filters={},options={}){
 if(!root)return;
 const tabs=options.embedded?{attendance:'Chấm công'}:systemSettingTabs;
 let tab=tabs[filters.tab]?filters.tab:Object.keys(tabs).find(key=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===(key==='approval-workflow'?'WEB_APPROVAL_SETTINGS':'WEB_SYSTEM_SETTINGS')&&p.canView==='Y'))||Object.keys(tabs)[0],generation=0,saving=false,dirty=false;
 async function load(){
 const current=++generation,kind=tab;dirty=false;options.onDirty?.(false);
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Cấu hình hệ thống">${Object.entries(tabs).map(([key,label])=>`<button type="button" role="tab" class="tab ${key===kind?'active':''}" aria-selected="${key===kind}" data-system-tab="${key}">${label}</button>`).join('')}</div><div id="system-settings-panel" role="tabpanel"><p role="status">Đang tải cấu hình…</p></div>`;
 root.querySelectorAll('[data-system-tab]').forEach(button=>button.onclick=()=>{if(saving||button.dataset.systemTab===tab)return;if(dirty&&!confirm('Bỏ các thay đổi cấu hình chưa lưu?'))return;tab=button.dataset.systemTab;load();});
 if(options.embedded)root.querySelector('[role=tablist]').remove();
 const panel=root.querySelector('#system-settings-panel');
 if(kind==='approval-workflow'||kind==='leave-accrual'||kind==='terminal-logging'){await (kind==='terminal-logging'?mountTerminalLogging:kind==='leave-accrual'?mountLeaveAccrualSettings:mountApprovalWorkflowSettings)(panel,{onDirty:value=>{if(panel.isConnected){dirty=value;options.onDirty?.(value);}},onSaving:value=>{if(panel.isConnected){saving=value;options.onSaving?.(value);root.querySelectorAll('[data-system-tab]').forEach(button=>button.disabled=value);}}});return;}

 try{
 if(!systemSettingsGrant('canView'))throw Error('Bạn chưa có quyền xem WEB_SYSTEM_SETTINGS.');
 const result=await apiSystemSettings(kind);if(!root.isConnected||current!==generation)return;
 if(!result?.settings||!Number.isSafeInteger(result.version)||result.version<1)throw Error('Cấu hình hoặc phiên bản trả về không hợp lệ.');
 let version=result.version,locationSequence=0;
 const settings=result.settings,canUpdate=systemSettingsGrant('canUpdate');
 panel.innerHTML=`<form id="system-settings-form" class="user-registration ${kind==='password-policy'?'password-policy-card':''}">${kind==='password-policy'?`<div class="password-policy-heading"><div><h2>Password Policy</h2><p>Chính sách mật khẩu hệ thống</p></div>${icon('shield',18)}</div>`:''}<fieldset class="user-edit-fieldset" ${canUpdate?'':'disabled'}>${kind==='password-policy'?`<div class="form-grid">${passwordPolicySelect('Độ dài tối thiểu','minimumLength',settings.minimumLength,[8,10,12,14,16],'ký tự')}${passwordPolicySelect('Độ dài tối đa','maximumLength',settings.maximumLength,[32,64,128],'ký tự')}</div><div class="system-settings-switches">${passwordSettingFlags.map(([key,label])=>`<label class="password-policy-check"><span>${label}</span><input type="checkbox" name="${key}" ${settings[key]?'checked':''}><span class="password-policy-checkmark" aria-hidden="true">✓</span></label>`).join('')}</div>${passwordPolicySelect('Không được trùng mật khẩu gần nhất','passwordHistoryCount',settings.passwordHistoryCount,[0,1,3,5,10],'mật khẩu')}<p class="muted">Áp dụng khi tạo hoặc đổi mật khẩu. Mật khẩu hiện có vẫn giữ hiệu lực. Đặt số mật khẩu ghi nhớ bằng 0 để tắt kiểm tra lịch sử.</p>`:`<div class="form-grid">${field('Múi giờ','timezone','text',settings.timezone,'required maxlength="150" placeholder="Asia/Ho_Chi_Minh"')}${attendanceSettingNumbers.map(([key,label,max])=>systemSettingNumber(label,key,settings[key],0,max)).join('')}<label>Khi thiếu lượt check-in<select name="missingPunchRule"><option value="REJECT_CHECKOUT_WITHOUT_CHECKIN" ${settings.missingPunchRule==='REJECT_CHECKOUT_WITHOUT_CHECKIN'?'selected':''}>Từ chối check-out khi chưa check-in</option><option value="INCOMPLETE" ${settings.missingPunchRule==='INCOMPLETE'?'selected':''}>Ghi nhận chưa đầy đủ</option></select></label></div><fieldset class="system-working-days"><legend>Ngày làm việc</legend><div>${['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ nhật'].map((label,index)=>`<label><input type="checkbox" name="workingDays" value="${index+1}" ${settings.workingDays?.includes(index+1)?'checked':''}> ${label}</label>`).join('')}</div></fieldset><label>Ngày lễ (mỗi ngày một dòng, định dạng YYYY-MM-DD)<textarea name="holidayDates" rows="4">${e((settings.holidayDates||[]).join('\n'))}</textarea></label><div class="system-settings-switches attendance-settings-switches">${attendanceSettingFlags.map(([key,label])=>systemSettingToggle(key,label,settings[key])).join('')}</div><h3>Địa điểm chấm công</h3><div id="system-settings-locations"></div><button type="button" class="btn" id="system-settings-add-location">Thêm địa điểm</button><p class="muted">Tối đa 20 địa điểm. Bật QR hoặc GPS cần ít nhất một địa điểm. Cấu hình mới áp dụng cho lịch được tạo hoặc cập nhật sau đó; lịch và lượt chấm công đã lưu giữ nguyên quy tắc.</p>`}<div class="form-actions"><button type="submit" class="btn primary">Lưu cấu hình</button></div></fieldset><p id="system-settings-feedback" role="status">${canUpdate?'':'Bạn có quyền xem; cần WEB_SYSTEM_SETTINGS/UPDATE để lưu.'}</p></form>`;
 const form=panel.querySelector('form'),fieldset=form.querySelector('fieldset'),feedback=panel.querySelector('#system-settings-feedback');
 form.oninput=form.onchange=()=>{dirty=true;options.onDirty?.(true);};
 function addLocation(location={}){
 const container=panel.querySelector('#system-settings-locations');if(container.children.length>=20)return;
 const index=locationSequence++,prefix=`location-${index}-`,row=document.createElement('section');row.className='system-settings-location';row.dataset.locationPrefix=prefix;
 row.innerHTML=`<div class="form-grid">${field('Mã địa điểm',prefix+'code','text',location.code||'','required maxlength="50"')}${field('Tên địa điểm',prefix+'name','text',location.name||'','required maxlength="150"')}${field('Vĩ độ',prefix+'latitude','number',location.latitude??'','required min="-90" max="90" step="any"')}${field('Kinh độ',prefix+'longitude','number',location.longitude??'','required min="-180" max="180" step="any"')}${field('Bán kính (mét)',prefix+'radiusMeters','number',location.radiusMeters??100,'required min="10" max="10000" step="1"')}</div><button type="button" class="btn danger" data-remove-location>Xóa địa điểm</button>`;
 row.querySelector('[data-remove-location]').onclick=()=>{if(saving)return;row.remove();dirty=true;options.onDirty?.(true);panel.querySelector('#system-settings-add-location').disabled=false;};container.appendChild(row);
 panel.querySelector('#system-settings-add-location').disabled=container.children.length>=20;
 }
 if(kind==='attendance'){
 (settings.locations||[]).forEach(addLocation);
 panel.querySelector('#system-settings-add-location').onclick=()=>{if(!saving){addLocation();dirty=true;options.onDirty?.(true);}};
 }
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving||!canUpdate)return;
 const data=new FormData(form),payload={};
 if(kind==='password-policy'){
 for(const key of ['minimumLength','maximumLength','passwordHistoryCount'])payload[key]=Number(data.get(key));
 passwordSettingFlags.forEach(([key])=>{payload[key]=data.has(key);});
 }else{
 payload.timezone=data.get('timezone').trim();attendanceSettingNumbers.forEach(([key])=>{payload[key]=Number(data.get(key));});
 attendanceSettingFlags.forEach(([key])=>{payload[key]=data.has(key);});
 payload.holidayDates=String(data.get('holidayDates')||'').split(/[\s,;]+/).filter(Boolean);payload.workingDays=data.getAll('workingDays').map(Number);payload.missingPunchRule=data.get('missingPunchRule');
 payload.locations=[...panel.querySelectorAll('[data-location-prefix]')].map(row=>{const prefix=row.dataset.locationPrefix;return {code:data.get(prefix+'code').trim().toUpperCase(),name:data.get(prefix+'name').trim(),latitude:Number(data.get(prefix+'latitude')),longitude:Number(data.get(prefix+'longitude')),radiusMeters:Number(data.get(prefix+'radiusMeters'))};});
 }
 try{validateSystemSettings(kind,payload);}catch(err){feedback.textContent=err.message;return;}
 saving=true;options.onSaving?.(true);fieldset.disabled=true;root.querySelectorAll('[data-system-tab]').forEach(button=>button.disabled=true);feedback.textContent='Đang lưu cấu hình…';
 try{const saved=await apiSystemSettings(kind,payload,version);if(!form.isConnected)return;
 if(!Number.isSafeInteger(saved?.version)||saved.version<1)throw Error('Chưa nhận phiên bản mới. Hãy tải lại trang để xác nhận trước khi lưu tiếp.');
 version=saved.version;dirty=false;options.onDirty?.(false);feedback.textContent='Đã lưu cấu hình thành công.';
 }catch(err){if(form.isConnected)feedback.textContent=err.message+' Nếu có xung đột phiên bản, tải lại cấu hình trước khi sửa và lưu lại.';}
 finally{saving=false;options.onSaving?.(false);if(form.isConnected){fieldset.disabled=!canUpdate;root.querySelectorAll('[data-system-tab]').forEach(button=>button.disabled=false);}}
 };
 }catch(err){if(!root.isConnected||current!==generation)return;panel.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn" id="system-settings-retry">Thử lại</button>`;panel.querySelector('button').onclick=load;}
 }
 await load();
}


// Source: password-policy.js

function passwordPolicyRules(password,username,policy){
 const rules=[{key:'length',label:`Từ ${policy.minimumLength} đến ${policy.maximumLength} ký tự`,passed:!!password.trim()&&password.length>=policy.minimumLength&&password.length<=policy.maximumLength}];
 for(const [key,pattern,label] of [['requireUppercase',/\p{Lu}/u,'Có chữ hoa (A–Z)'],['requireLowercase',/\p{Ll}/u,'Có chữ thường (a–z)'],['requireDigit',/\p{Nd}/u,'Có chữ số (0–9)'],['requireSpecialCharacter',/[^\p{L}\p{N}\s]/u,'Có ký tự đặc biệt (!@#$…)']])if(policy[key])rules.push({key,label,passed:pattern.test(password)});
 if(policy.disallowUsernameInPassword)rules.push({key:'username',label:'Không chứa tên đăng nhập',passed:!username||!password.toLowerCase().includes(username.toLowerCase())});
 return rules;
}
function passwordPolicyErrors(password,username,policy){
 const errors=[];
 if(!password.trim())errors.push('Mật khẩu không được để trống hoặc chỉ chứa khoảng trắng.');
 return [...errors,...passwordPolicyRules(password,username,policy).filter(rule=>!rule.passed).map(rule=>rule.key==='length'?`Mật khẩu phải dài từ ${policy.minimumLength} đến ${policy.maximumLength} ký tự.`:rule.label+'.')];
}
function bindPasswordPolicy(form,{passwordName,confirmName=null,username,optional=false}){
 const input=form.elements[passwordName],note=document.createElement('div');note.className='password-policy-help';note.setAttribute('aria-live','polite');
 const host=input.closest('label, .user-password-field');
 host?.classList.add('password-validation-field');
 host?.appendChild(note);
 function decorate(control){
 const wrapper=document.createElement('span');wrapper.className='password-validation-input';control.before(wrapper);wrapper.appendChild(control);
 const tick=document.createElement('span');tick.className='password-validation-tick';tick.textContent='✓';tick.hidden=true;tick.setAttribute('aria-hidden','true');wrapper.appendChild(tick);
 return (valid,invalid)=>{wrapper.classList.toggle('is-valid',valid);wrapper.classList.toggle('is-invalid',invalid);tick.hidden=!valid;if(invalid)control.setAttribute('aria-invalid','true');else control.removeAttribute('aria-invalid');};
 }
 const markInput=decorate(input),confirm=confirmName?form.elements[confirmName]:null,markConfirm=confirm?decorate(confirm):null;
 confirm?.closest('label')?.classList.add('password-validation-field');
 const confirmNote=confirm?document.createElement('span'):null;
 if(confirmNote){confirmNote.className='password-confirm-feedback';confirmNote.setAttribute('aria-live','polite');confirm.closest('label')?.appendChild(confirmNote);}
 let policy=null,unavailable=false;
 function render(){
 const entered=!!input.value;
 const rules=policy?passwordPolicyRules(input.value,username(),policy):[];
 const valid=!!policy&&entered&&rules.every(rule=>rule.passed);
 markInput(valid,!!policy&&entered&&!valid);
 if(policy){
 note.innerHTML=`<ul class="password-policy-rules">${rules.map(rule=>`<li class="password-policy-rule ${entered?(rule.passed?'is-passed':'is-failed'):''}"><span class="password-policy-rule-mark" aria-hidden="true">${entered?(rule.passed?'✓':'×'):'•'}</span><span>${e(rule.label)}</span></li>`).join('')}</ul>${policy.passwordHistoryCount?`<p class="password-policy-history">Không trùng ${policy.passwordHistoryCount} mật khẩu gần nhất — kiểm tra khi lưu.</p>`:''}`;
 }
 if(confirm){const matched=!!confirm.value&&confirm.value===input.value;markConfirm(matched&&valid,!!confirm.value&&!matched);confirmNote.textContent=confirm.value&&!matched?'Mật khẩu nhập lại không khớp.':'';}
 }
 note.textContent='Đang tải chính sách mật khẩu…';
 const ready=apiSystemSettings('password-policy').then(result=>{
 policy=validateSystemSettings('password-policy',result.settings);
 if(!form.isConnected)return;
 for(const name of [passwordName,confirmName].filter(Boolean)){form.elements[name].minLength=policy.minimumLength;form.elements[name].maxLength=policy.maximumLength;}
 render();
 }).catch(()=>{unavailable=true;if(form.isConnected)note.textContent='Không tải được chính sách mật khẩu. Máy chủ sẽ kiểm tra khi lưu.';});
 input.addEventListener('input',render);confirm?.addEventListener('input',render);form.elements.userId?.addEventListener('input',render);
 form.addEventListener('reset',()=>setTimeout(()=>{if(form.isConnected)render();},0));
 return async()=>{
 await ready;render();
 if(optional&&!input.value)return;
 if(!input.value.trim())throw Error('Mật khẩu không được để trống hoặc chỉ chứa khoảng trắng.');
 if(!unavailable){const errors=passwordPolicyErrors(input.value,username(),policy);if(errors.length)throw Error(errors.join(' '));}
 };
}


// Source: pages/my-workspace/my-leave.js

const leaveBalanceNumbers=['entitledDays','carriedOverDays','adjustmentDays','usedDays','reservedDays','remainingDays','availableDays'];
const leaveDayNumber=value=>Number(value).toLocaleString('vi-VN',{maximumFractionDigits:2});
function myLeaveGrant(code,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y');}
function myLeaveBalanceData(response){
 const data=response?.data;
 if(response?.success!==true||!data||!Number.isSafeInteger(data.employeeId)||data.employeeId<=0||!Number.isInteger(data.year)||data.year<1900||data.year>9999||!/^\d{4}-\d{2}-\d{2}$/.test(data.asOfDate)||Number.isNaN(Date.parse(data.asOfDate))||new Date(data.asOfDate).toISOString().slice(0,10)!==data.asOfDate||!['totalDays','usedDays','remainingDays','reservedDays','availableDays'].every(key=>typeof data[key]==='number'&&Number.isFinite(data[key]))||!Array.isArray(data.balances))throw Error('Số dư phép trả về không hợp lệ.');
 for(const item of data.balances)if(item.employeeId!==data.employeeId||!Number.isSafeInteger(item.leaveTypeId)||item.leaveTypeId<=0||!leaveBalanceNumbers.every(key=>typeof item[key]==='number'&&Number.isFinite(item[key])))throw Error('Chi tiết số dư phép không hợp lệ.');
 return data;
}
function myLeaveBalanceMarkup(data){
 return `<div class="my-leave-summary">${[['totalDays','Tổng phép','calendar','blue'],['usedDays','Đã sử dụng','check','purple'],['remainingDays','Còn lại','sun','teal']].map(([key,label,glyph,tone])=>`<article class="card my-leave-stat"><div class="icon-tile ${tone}">${icon(glyph,20)}</div><div><span>${label}</span><strong>${leaveDayNumber(data[key])}<small> ngày</small></strong></div></article>`).join('')}</div><div class="my-leave-availability"><span>Đang giữ cho đơn chờ duyệt: <strong>${leaveDayNumber(data.reservedDays)} ngày</strong></span><span>Khả dụng: <strong>${leaveDayNumber(data.availableDays)} ngày</strong></span><span class="muted">Cập nhật ${dateLabel(data.asOfDate)}</span></div><div class="table-wrap"><table><thead><tr><th>Loại nghỉ phép</th><th>Được cấp</th><th>Chuyển năm</th><th>Điều chỉnh</th><th>Đã dùng</th><th>Đang giữ</th><th>Còn lại</th><th>Khả dụng</th></tr></thead><tbody>${data.balances.map(item=>`<tr><td>${e(item.leaveTypeName||`Loại phép #${item.leaveTypeId}`)}</td>${leaveBalanceNumbers.map(key=>`<td>${leaveDayNumber(item[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${data.balances.length?'':'<div class="empty"><h3>Chưa có số dư phép</h3><p>Chưa có số dư được cấp trong năm đã chọn.</p></div>'}`;
}
const myLeaveTabs={balances:{label:'Số dư phép',screen:'WEB_LEAVE_BALANCES'},leave:{label:'Nghỉ phép',screen:'WEB_LEAVE_REQUESTS'},overtime:{label:'Tăng ca',screen:'WEB_OVERTIME_REQUESTS'}};
function visibleMyLeaveTabs(session=apiSession()){return Object.keys(myLeaveTabs).filter(key=>myLeaveGrant(myLeaveTabs[key].screen,session));}
async function mountMyLeave(root){
 if(!root)return;const available=visibleMyLeaveTabs();
 if(!available.length){root.innerHTML='<p>Bạn chưa có quyền xem My Leave.</p>';return;}
 const requested=new URLSearchParams(globalThis.location?.hash?.split('?')[1]||'').get('tab');let selected=available.includes(requested)?requested:available[0];
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="My Leave">${available.map(key=>`<button class="tab" type="button" role="tab" data-my-leave-tab="${key}" aria-selected="false">${myLeaveTabs[key].label}</button>`).join('')}</div><section data-my-leave-panel></section>`;
 async function show(key){
 selected=key;root.querySelectorAll('[data-my-leave-tab]').forEach(button=>{const active=button.dataset.myLeaveTab===key;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
 const old=root.querySelector('[data-my-leave-panel]'),panel=document.createElement('section');panel.dataset.myLeavePanel='';panel.setAttribute('role','tabpanel');panel.setAttribute('aria-label',myLeaveTabs[key].label);old.replaceWith(panel);
 if(key==='balances')await mountMyLeaveBalances(panel);else await mountApprovals(panel,{}, {kind:key,own:true});
 }
 root.querySelectorAll('[data-my-leave-tab]').forEach(button=>button.onclick=()=>{if(button.dataset.myLeaveTab!==selected)show(button.dataset.myLeaveTab);});
 await show(selected);
}

async function mountMyLeaveBalances(root){
 if(!root)return;
 if(!myLeaveGrant('WEB_LEAVE_BALANCES')){root.innerHTML='<p>Bạn chưa có quyền WEB_LEAVE_BALANCES/VIEW để xem số dư phép của mình.</p>';return;}
 let year=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric'}).format(new Date())),generation=0;
 root.innerHTML=`<form class="toolbar" id="my-leave-year"><label>Năm<input type="number" name="year" min="1900" max="9999" step="1" required value="${year}" aria-label="Năm số dư phép"></label><button type="button" class="btn" id="my-leave-refresh">Làm mới</button>${workflowGrant('leave','canNew')?'<button type="button" class="btn primary" id="my-leave-create">Tạo đơn nghỉ phép</button>':''}</form><section id="my-leave-balances" aria-label="Số dư phép"></section>`;
 const panel=root.querySelector('#my-leave-balances'),form=root.querySelector('#my-leave-year');
 async function load(){
  const id=++generation;panel.innerHTML='<p role="status">Đang tải số dư phép…</p>';
  try{
   if(!myLeaveGrant('WEB_LEAVE_BALANCES'))throw Error('Bạn không có quyền xem số dư phép.');
   const data=myLeaveBalanceData(await apiMyLeaveBalances({year}));if(!root.isConnected||id!==generation)return;
   panel.innerHTML=myLeaveBalanceMarkup(data);
  }catch(err){if(root.isConnected&&id===generation){panel.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;panel.querySelector('button').onclick=load;}}
 }
 const changeYear=()=>{const value=Number(form.elements.year.value);if(!Number.isInteger(value)||value<1900||value>9999)return;year=value;load();};
 form.elements.year.onchange=changeYear;
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();changeYear();};
 root.querySelector('#my-leave-refresh').onclick=load;
 root.querySelector('#my-leave-create')?.addEventListener('click',()=>openWorkflowCreate('leave',()=>{if(root.isConnected)return load();}));
 await load();
}


// Source: pages/approval-center/approvals.js

const approvalTabs={all:{label:'Tất cả',screen:'WEB_APPROVALS'},kpi:{label:'KPI',screen:'WEB_APPROVALS'},payroll:{label:'Bảng lương',screen:'WEB_APPROVALS'},leave:{label:'Nghỉ phép',screen:'WEB_LEAVE_REQUESTS'},overtime:{label:'Tăng ca',screen:'WEB_OVERTIME_REQUESTS'},adjustment:{label:'Điều chỉnh công',screen:'WEB_ATTENDANCE_ADJUSTMENTS'}};
const workflowStatuses={PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Từ chối',CANCELLED:'Đã hủy',CANCELLATION_PENDING:'Chờ duyệt hủy'};
function workflowGrant(kind,flag='canView',session=apiSession()){
 const code=approvalTabs[kind]?.screen;
 if(kind==='payroll'&&!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_PAYROLL'&&p.canView==='Y'&&p[flag]==='Y'))return false;
 if(kind==='kpi'&&!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_KPI_EVALUATION'&&p.canView==='Y'&&p[flag]==='Y'))return false;
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y'&&p[flag]==='Y');
}
function visibleApprovalTabs(session=apiSession()){return Object.keys(approvalTabs).filter(kind=>workflowGrant(kind,'canView',session));}
const workflowTime=value=>{if(!value)return '—';const text=String(value),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'Z');return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short',hour12:false}).format(date);};
function workflowCreatePayload(kind,values){
 const reason=String(values.reason||'').trim();if(!reason||reason.length>1000)throw Error('Lý do bắt buộc, tối đa 1000 ký tự.');
 const positive=value=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<=0)throw Error('Vui lòng chọn bản ghi hợp lệ.');return number;};
 const date=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Ngày không hợp lệ.');return value;};
 const time=value=>{if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))throw Error('Ngày giờ không hợp lệ.');date(value.slice(0,10));const match=value.slice(11).split(':').map(Number);if(match[0]>23||match[1]>59||(match[2]||0)>59)throw Error('Ngày giờ không hợp lệ.');return value+(value.length===16?':00':'')+'+07:00';};
 if(kind==='leave'){const fromDate=date(values.fromDate),toDate=date(values.toDate);if(toDate<fromDate)throw Error('Ngày kết thúc không được trước ngày bắt đầu.');return {leaveTypeId:positive(values.leaveTypeId),fromDate,toDate,reason};}
 if(kind==='overtime'){const startAt=time(values.startAt),endAt=time(values.endAt);if(!startAt||!endAt||Date.parse(endAt)<=Date.parse(startAt))throw Error('Giờ kết thúc phải sau giờ bắt đầu.');return {startAt,endAt,reason};}
 if(kind==='adjustment'){const proposedCheckIn=time(values.proposedCheckIn),proposedCheckOut=time(values.proposedCheckOut);if(!proposedCheckIn&&!proposedCheckOut)throw Error('Nhập ít nhất một giờ chấm công đề nghị.');if(proposedCheckIn&&proposedCheckOut&&Date.parse(proposedCheckOut)<=Date.parse(proposedCheckIn))throw Error('Giờ ra phải sau giờ vào.');return {attendanceId:positive(values.attendanceId),proposedCheckIn,proposedCheckOut,reason};}
 throw Error('Loại yêu cầu không hợp lệ.');
}
function workflowCanCancel(kind,item,session=apiSession()){
 return !!session?.user?.employeeId&&kind!=='all'&&workflowGrant(kind,'canUpdate',session)&&String(item.employeeId)===String(session?.user?.employeeId)&&((kind==='leave'&&item.status==='APPROVED')||item.status==='PENDING');
}
function workflowPeriod(kind,item){return kind==='leave'?`${dateLabel(item.fromDate)} – ${dateLabel(item.toDate)}`:kind==='overtime'?`${workflowTime(item.startAt)} – ${workflowTime(item.endAt)}`:kind==='adjustment'?`${workflowTime(item.proposedCheckIn)} – ${workflowTime(item.proposedCheckOut)}`:workflowTime(item.createdAt);}
function workflowKpiDetailHref(item,session=apiSession()){
 if(item?.requestType!=='KPI_EVALUATION'||!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_KPI_EVALUATION'&&p.canView==='Y'))return '';
 const id=Number(item.referenceId??item.referenceID);if(!Number.isSafeInteger(id)||id<1)return '';
 return '#/performance/kpi-results?evaluationId='+id;
}
function workflowPayrollDetailHref(item,session=apiSession()){
 if(item?.requestType!=='PAYROLL_PERIOD'||!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_PAYROLL'&&p.canView==='Y'))return '';
 const id=Number(item.referenceId??item.referenceID);return Number.isSafeInteger(id)&&id>0?'#/payroll/management?periodId='+id:'';
}
function workflowKpiDetailLink(item,session=apiSession()){
 const href=workflowKpiDetailHref(item,session);return href?`<a class="btn small" data-workflow-kpi-detail href="${href}">Chi tiết</a>`:'';
}

function workflowRows(kind,items,session=apiSession()){return items.map((item,index)=>`<tr><td><strong>#${e(item.id)}</strong></td><td>${e(item.employeeName||`Nhân viên #${item.employeeId||'—'}`)}</td><td>${e(kind==='leave'?item.leaveTypeName:kind==='all'?({LEAVE:'Nghỉ phép',LEAVE_CANCELLATION:'Hủy nghỉ phép',OVERTIME:'Tăng ca',ATTENDANCE_ADJUSTMENT:'Điều chỉnh công',KPI_EVALUATION:'Đánh giá KPI',PAYROLL_PERIOD:'Kỳ lương'})[item.requestType]||item.requestType:approvalTabs[kind].label)}</td><td class="organization-description">${e(item.reason||'—')}</td><td>${e(workflowPeriod(kind,item))}</td><td><span class="badge ${item.status==='APPROVED'?'active':item.status==='REJECTED'?'rejected':''}">${e(workflowStatuses[item.status]||item.status)}</span></td><td>${item.requestType==='PAYROLL_PERIOD'?(workflowPayrollDetailHref(item,session)?`<a class="btn small" data-workflow-payroll-detail href="${workflowPayrollDetailHref(item,session)}">Chi tiết</a>`:'<button class="btn small" disabled>Chi tiết</button>'):item.requestType==='KPI_EVALUATION'?(workflowKpiDetailLink(item,session)||'<button type="button" class="btn small" disabled title="Cần quyền xem KPI và mã bản ghi KPI hợp lệ">Chi tiết</button>'):`<button type="button" class="btn small" data-workflow-detail="${index}">Chi tiết</button>`}</td></tr>`).join('');}

function openWorkflowCreate(type,onCreated=async()=>{}){
  if(!workflowGrant(type,'canNew'))return;
  openDialog('Tạo yêu cầu '+approvalTabs[type].label.toLowerCase(),`<form id="workflow-create-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${type==='leave'?`<label>Loại nghỉ phép<select name="leaveTypeId" required disabled><option value="">Đang tải loại nghỉ phép…</option></select></label>${field('Từ ngày','fromDate','date','','required')}${field('Đến ngày','toDate','date','','required')}`:type==='overtime'?`${field('Bắt đầu tăng ca','startAt','datetime-local','','required')}${field('Kết thúc tăng ca','endAt','datetime-local','','required')}`:`${field('ID bản ghi chấm công','attendanceId','number','','required min="1" step="1"')}${field('Giờ vào đề nghị','proposedCheckIn','datetime-local','')}${field('Giờ ra đề nghị','proposedCheckOut','datetime-local','')}`}<label class="full">Lý do<textarea name="reason" required maxlength="1000"></textarea></label></div><div class="form-actions"><button type="button" class="btn" data-workflow-cancel>Hủy</button><button class="btn primary" type="submit">Gửi yêu cầu</button></div></fieldset><p id="workflow-create-error" role="alert"></p></form>`);
  const form=document.getElementById('workflow-create-form'),feedback=form.querySelector('[role=alert]'),fieldset=form.querySelector('fieldset');let busy=false,types=[];
  form.querySelector('[data-workflow-cancel]').onclick=()=>{if(!busy)closeDialog();};
  if(type==='leave'){
   const loadTypes=async()=>{try{let page=1,total=Infinity;types=[];while(types.length<total){const response=await apiWorkflowLeaveTypes(new URLSearchParams({page,pageSize:100}).toString());if(!form.isConnected)return;if(!Array.isArray(response?.data))throw Error('Danh sách loại nghỉ phép không hợp lệ.');types.push(...response.data);total=response.total;if(!response.data.length)break;page++;}const select=form.elements.leaveTypeId;select.innerHTML='<option value="">Chọn loại nghỉ phép</option>'+types.filter(item=>item.isActive).map(item=>`<option value="${e(item.id)}">${e(item.name)}</option>`).join('');select.disabled=false;feedback.textContent='';}catch(err){if(form.isConnected){feedback.innerHTML=`${e(err.message)} <button type="button" class="btn">Thử lại</button>`;feedback.querySelector('button')?.addEventListener('click',loadTypes);}}};
   loadTypes();
  }
  form.onsubmit=async event=>{
   event.preventDefault();event.stopPropagation();if(busy)return;
   try{if(!workflowGrant(type,'canNew'))throw Error('Bạn không có quyền tạo yêu cầu này.');const payload=workflowCreatePayload(type,Object.fromEntries(new FormData(form)));if(type==='leave'&&!types.some(item=>item.isActive&&Number(item.id)===payload.leaveTypeId))throw Error('Chọn loại nghỉ phép đang hoạt động.');busy=true;fieldset.disabled=true;await apiCreateWorkflow(type,payload);if(form.isConnected){closeDialog();toast('Đã gửi yêu cầu');await onCreated();}}
   catch(err){if(form.isConnected){
    if(type==='leave'&&/^insufficient available leave balance\.?$/i.test(String(err.message||'').trim())){
     const message='Số dư phép khả dụng của bạn không đủ cho thời gian nghỉ đã chọn. Vui lòng điều chỉnh ngày nghỉ hoặc kiểm tra lại số dư phép.';feedback.textContent=message;await alertDialog({title:'Không đủ số dư phép',message});
    }else feedback.textContent=err.message;
   }}
   finally{busy=false;if(form.isConnected)fieldset.disabled=false;}
  };
 }

async function mountApprovals(root,filters={},options={}){
 if(!root)return;
 const routeParams=new URLSearchParams(globalThis.location?.hash?.split('?')[1]||''),approvalModule=routeParams.get('module'),requestedApprovalId=Number(routeParams.get('approvalId'));
 const tabs=options.kind?(workflowGrant(options.kind)?[options.kind]:[]):visibleApprovalTabs();if(!tabs.length){root.innerHTML='<p>Bạn chưa có quyền xem yêu cầu hoặc phê duyệt.</p>';return;}
 let kind=tabs.includes(filters.tab)?filters.tab:approvalModule==='PERFORMANCE'&&tabs.includes('kpi')?'kpi':approvalModule==='PAYROLL'&&tabs.includes('payroll')?'payroll':tabs[0],page=1,status='',view=options.own?'MY':'ALL',generation=0,approvalId=!options.own&&Number.isSafeInteger(requestedApprovalId)&&requestedApprovalId>0?String(requestedApprovalId):'';
 async function list(){
  const current=++generation;root.innerHTML='<p role="status">Đang tải yêu cầu…</p>';
  try{
   if(!workflowGrant(kind))throw Error('Bạn chưa có quyền xem loại yêu cầu này.');
   const query=new URLSearchParams({page,pageSize:20,view});if(status)query.set('status',status);if(kind==='kpi'){query.set('module','PERFORMANCE');query.set('requestType','KPI_EVALUATION');}else if(kind==='payroll'){query.set('module','PAYROLL');query.set('requestType','PAYROLL_PERIOD');}else if(kind==='all'&&approvalModule==='LEAVE')query.set('module','LEAVE');
   if(!options.own&&['leave','overtime','adjustment'].includes(kind))query.set('requestType',({leave:'LEAVE',overtime:'OVERTIME',adjustment:'ATTENDANCE_ADJUSTMENT'})[kind]);
   let result;
   if(!options.own&&approvalId){
    if(!workflowGrant('all'))throw Error('Bạn cần quyền xem phê duyệt để tìm theo ID.');
    const response=await apiWorkflowDetail('all',Number(approvalId));if(!root.isConnected||current!==generation)return;
    const item=response?.request;if(!item||Number(item.id)!==Number(approvalId))throw Error('Phản hồi ID phê duyệt không hợp lệ.');
    const matched=({LEAVE:'leave',LEAVE_CANCELLATION:'leave',OVERTIME:'overtime',ATTENDANCE_ADJUSTMENT:'adjustment',KPI_EVALUATION:'kpi',PAYROLL_PERIOD:'payroll'})[item.requestType];
    if(tabs.includes(matched))kind=matched;else if(tabs.includes('all'))kind='all';else throw Error('Bạn chưa có quyền xem loại phê duyệt này.');
    const items=!status||item.status===status?[item]:[];result={data:items,total:items.length};
   }else result=await apiWorkflowList(options.own?kind:'all',query.toString());if(!root.isConnected||current!==generation)return;
   if(!Array.isArray(result?.data))throw Error('Danh sách yêu cầu không hợp lệ.');
   root.innerHTML=`${options.kind?'':`<div class="tabs" role="tablist" aria-label="Loại yêu cầu">${tabs.map(key=>`<button type="button" role="tab" aria-selected="${key===kind}" class="tab ${key===kind?'active':''}" data-workflow-tab="${key}">${approvalTabs[key].label}</button>`).join('')}</div>`}<form class="toolbar" id="workflow-filters">${options.own?'':`<label>ID phê duyệt<input name="approvalId" type="number" min="1" step="1" value="${e(approvalId)}" placeholder="Nhập ID phê duyệt"></label>`}${options.own?'':`<label>Phạm vi yêu cầu<select name="view" aria-label="Phạm vi yêu cầu">${[['ALL','Trong phạm vi được phép'],['MY','Của tôi'],['TEAM','Cùng phòng ban']].map(([value,label])=>`<option value="${value}" ${value===view?'selected':''}>${label}</option>`).join('')}</select></label>`}<label>Trạng thái<select name="status" aria-label="Trạng thái yêu cầu"><option value="">Tất cả trạng thái</option>${Object.entries(workflowStatuses).map(([value,label])=>`<option value="${value}" ${value===status?'selected':''}>${label}</option>`).join('')}</select></label><button class="btn">Lọc</button>${!['all','kpi','payroll'].includes(kind)&&workflowGrant(kind,'canNew')?'<button type="button" class="btn primary" id="workflow-create">Tạo yêu cầu</button>':''}</form><div class="table-wrap"><table><thead><tr><th>ID</th><th>Người gửi</th><th>Loại yêu cầu</th><th>Lý do</th><th>Thời gian</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${workflowRows(options.own?kind:'all',result.data)}</tbody></table></div>${result.data.length?'':'<p>Không có yêu cầu phù hợp.</p>'}<div class="toolbar user-pagination"><button type="button" class="btn" id="workflow-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} yêu cầu</span><button type="button" class="btn" id="workflow-next" ${page*20>=result.total?'disabled':''}>Trang sau</button></div>`;
   root.querySelectorAll('[data-workflow-tab]').forEach(button=>button.onclick=()=>{kind=button.dataset.workflowTab;page=1;status='';view='ALL';approvalId='';list();});
   const form=root.querySelector('#workflow-filters');form.onsubmit=event=>{event.preventDefault();event.stopPropagation();view=options.own?'MY':form.elements.view.value;status=form.elements.status.value;approvalId=options.own?'':String(form.elements.approvalId?.value||'').trim();if(approvalId&&(!Number.isSafeInteger(Number(approvalId))||Number(approvalId)<1)){form.elements.approvalId.setCustomValidity('Nhập ID phê duyệt hợp lệ.');form.elements.approvalId.reportValidity();return;}form.elements.approvalId?.setCustomValidity('');page=1;list();};
   root.querySelector('#workflow-prev').onclick=()=>{page--;list();};root.querySelector('#workflow-next').onclick=()=>{page++;list();};
   root.querySelector('#workflow-create')?.addEventListener('click',()=>openWorkflowCreate(kind,()=>{if(root.isConnected)return list();}));
   root.querySelectorAll('[data-workflow-kpi-detail], [data-workflow-payroll-detail]').forEach(link=>link.onclick=()=>{if(document.getElementById('modal')?.open)closeDialog();});
   root.querySelectorAll('[data-workflow-detail]').forEach(button=>button.onclick=()=>detail(options.own?kind:'all',result.data[Number(button.dataset.workflowDetail)]));

  }catch(err){if(root.isConnected&&current===generation){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=list;}}
 }
 async function detail(type,row){
  if(!workflowGrant(type))return;
  openDialog('Chi tiết yêu cầu','<div id="workflow-detail"><p role="status">Đang tải…</p></div>');const panel=document.getElementById('workflow-detail');
  try{
   const data=type==='adjustment'?row:await apiWorkflowDetail(type,row.id);if(!panel.isConnected)return;
   const item=type==='all'?data.request:data;
   if(item.requestType==='PAYROLL_PERIOD'){const href=workflowPayrollDetailHref(item);if(href){closeDialog();location.hash=href;}else panel.innerHTML='<p>Bạn cần quyền xem WEB_PAYROLL để xem chi tiết kỳ lương.</p>';return;}
   if(item.requestType==='KPI_EVALUATION'){const href=workflowKpiDetailHref(item);if(href){closeDialog();location.hash=href;}else panel.innerHTML='<p>Bạn cần quyền WEB_KPI_EVALUATION/VIEW và mã bản ghi KPI hợp lệ để xem chi tiết.</p>';return;}
   const pairs=[['Người gửi',e(item.employeeName||`Nhân viên #${item.employeeId||'—'}`)],['Trạng thái',e(workflowStatuses[item.status]||item.status)],['Lý do',e(item.reason||data.details?.reason||'—')],['Thời gian',e(workflowPeriod(type,item))]];
   if(type==='leave')pairs.push(['Loại nghỉ phép',e(item.leaveTypeName)],['Số ngày',e(item.requestedDays)]);
   if(type==='overtime')pairs.push(['Số giờ đề nghị',e(item.requestedHours)],['Số giờ được duyệt',e(item.approvedHours??'—')]);
   if(type==='adjustment')pairs.push(['ID chấm công',e(item.attendanceId)]);
   const currentStep=type==='all'?data.steps?.find(step=>Number(step.stepNo)===Number(item.currentStepNo)&&step.approverUserId===apiSession()?.user?.userId&&step.decision==='PENDING'):null;
   const canDecide=type==='all'&&workflowGrant('all','canApprove')&&(item.requestType!=='KPI_EVALUATION'||apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_KPI_EVALUATION'&&p.canView==='Y'&&p.canApprove==='Y'))&&(item.requestType!=='PAYROLL_PERIOD'||apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_PAYROLL'&&p.canView==='Y'&&p.canApprove==='Y'))&&currentStep&&['PENDING','CANCELLATION_PENDING'].includes(item.status),canCancel=workflowCanCancel(type,item);
   panel.innerHTML=`${details(pairs)}${workflowKpiDetailLink(item)}${type==='all'?`<h3>Tiến trình duyệt</h3>${(data.steps||[]).map(step=>`<p>Bước ${e(step.stepNo)} · ${e(step.approverUserId)} · ${e(workflowStatuses[step.decision]||step.decision)}${step.comment?` · ${e(step.comment)}`:''}</p>`).join('')}`:''}${canCancel||canDecide?`<form id="workflow-action-form"><label>Lý do<textarea name="reason" required maxlength="1000"></textarea></label><div class="form-actions">${canCancel?'<button class="btn danger" name="action" value="cancel">Hủy yêu cầu</button>':'<button class="btn danger" name="action" value="reject">Từ chối</button><button class="btn primary" name="action" value="approve">Phê duyệt</button>'}</div><p role="alert"></p></form>`:''}`;
   panel.querySelector('[data-workflow-kpi-detail]')?.addEventListener('click',()=>closeDialog());
   const form=panel.querySelector('form');if(!form)return;let busy=false;
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(busy)return;
    const feedback=form.querySelector('[role=alert]');
    try{const action=event.submitter?.value;if(action==='cancel'?!workflowCanCancel(type,item):!canDecide||!workflowGrant('all','canApprove'))throw Error('Bạn không có quyền thực hiện thao tác này.');const reason=form.elements.reason.value.trim();if(!reason)throw Error('Vui lòng nhập lý do.');busy=true;form.querySelectorAll('button,textarea').forEach(control=>control.disabled=true);await apiWorkflowAction(type,item.id,action,{version:item.version,reason});if(panel.isConnected&&root.isConnected){closeDialog();toast('Đã cập nhật yêu cầu');await list();}}
    catch(err){if(panel.isConnected)feedback.textContent=err.message;}
    finally{busy=false;if(panel.isConnected)form.querySelectorAll('button,textarea').forEach(control=>control.disabled=false);}
   };
  }catch(err){if(panel.isConnected)panel.innerHTML=`<p role="alert">${e(err.message)}</p>`;}
 }
 await list();
}


// Source: pages/human-resources/contracts.js

const contractStatuses={DRAFT:'Bản nháp',ACTIVE:'Đang hiệu lực',EXPIRED:'Hết hạn',TERMINATED:'Đã chấm dứt',CANCELLED:'Đã hủy'};
function contractGrant(flag,session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_CONTRACTS'&&p.canView==='Y'&&p[flag]==='Y');
}
const contractCatalogGrant=code=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y');
function contractClosed(item){return ['EXPIRED','TERMINATED','CANCELLED'].includes(item?.status);}
const contractBusinessDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
function contractAttachment(value){
 if(!value)return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?value:null;}catch{return null;}
}
function contractPayload(values,{original=null,hireDate=null,today=contractBusinessDate()}={}){
 const contractType=String(values.contractType||''),startDate=values.startDate,endDate=values.endDate||null,status=values.status,attachmentUrl=String(values.attachmentUrl||'').trim()||null;
 if(original&&values.contractNo!==undefined&&values.contractNo!==original.contractNo)throw Error('Không được thay đổi số hợp đồng đã cấp.');
 if(!contractType.trim()||contractType.length>30)throw Error('Vui lòng chọn loại hợp đồng hợp lệ.');
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!validDate(startDate)||endDate&&!validDate(endDate))throw Error('Ngày hợp đồng không hợp lệ.');
 if(hireDate&&startDate<hireDate.slice(0,10))throw Error('Ngày bắt đầu không được trước ngày vào làm.');
 if(endDate&&endDate<startDate)throw Error('Ngày kết thúc không được trước ngày bắt đầu.');
 if(!Object.hasOwn(contractStatuses,status))throw Error('Trạng thái hợp đồng không hợp lệ.');
 if(attachmentUrl&&(attachmentUrl.length>500||!contractAttachment(attachmentUrl)))throw Error('Tệp đính kèm phải là liên kết HTTPS không chứa thông tin đăng nhập, tối đa 500 ký tự.');
 if(original?.status==='ACTIVE'&&!['ACTIVE','EXPIRED','TERMINATED'].includes(status))throw Error('Hợp đồng đang hiệu lực chỉ có thể giữ hiệu lực, hết hạn hoặc chấm dứt.');
 if(status==='ACTIVE'&&(startDate>today||endDate&&endDate<today))throw Error('Hợp đồng đang hiệu lực phải bao gồm ngày hôm nay.');
 if(['EXPIRED','TERMINATED'].includes(status)&&(!endDate||endDate>today))throw Error('Hợp đồng đóng phải có ngày kết thúc không sau hôm nay.');
 const payload={contractType,startDate,endDate,status,attachmentUrl};
 if(contractClosed(original)&&Object.keys(payload).some(key=>payload[key]!==original[key]))throw Error('Hợp đồng đã đóng chỉ được xem.');
 return payload;
}
function contractStatisticsData(response){
 const data=response?.data;
 if(response?.success!==true||!data||!['active','expiringSoon','expired'].every(key=>Number.isSafeInteger(data[key])&&data[key]>=0)||!Number.isInteger(data.expiringWithinDays)||data.expiringWithinDays<1||data.expiringWithinDays>365||!/^\d{4}-\d{2}-\d{2}$/.test(data.asOfDate)||Number.isNaN(Date.parse(data.asOfDate))||new Date(data.asOfDate).toISOString().slice(0,10)!==data.asOfDate)throw Error('Dữ liệu thống kê hợp đồng không hợp lệ.');
 return data;
}
function contractCategory(item,today=contractBusinessDate(),days=30){
 if(item.startDate>today)return null;
 const cutoff=new Date(today+'T00:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+days);
 if(['ACTIVE','EXPIRED'].includes(item.status)&&item.endDate&&item.endDate<today)return 'expired';
 if(item.status!=='ACTIVE')return null;
 if(!item.endDate||item.endDate>cutoff.toISOString().slice(0,10))return 'active';
 return 'expiringSoon';
}
function contractListRows(items,canUpdate=false,employee=null,today=contractBusinessDate(),days=30){
 return items.map((item,index)=>{
  const category=contractCategory(item,today,days),label=({active:'Đang hiệu lực',expiringSoon:'Sắp hết hạn',expired:'Đã hết hạn'})[category]||contractStatuses[item.status]||item.status;
  return `<tr><td><strong class="contract-number">${e(item.contractNo)}</strong><span class="contract-employee-name">${e(item.employeeName||employee?.fullName||`Nhân viên #${item.employeeId||'—'}`)}</span><small>${e(item.employeeCode||employee?.employeeCode||'')}</small></td><td><span class="contract-type-name">${e(item.contractTypeName||item.contractType)}</span><span class="contract-period">${dateLabel(item.startDate)} – ${dateLabel(item.endDate)}</span></td><td><span class="contract-state ${category||e(item.status?.toLowerCase())}"><span aria-hidden="true"></span>${e(label)}</span></td><td class="text-right"><button type="button" class="btn contract-view" data-contract-open="${index}">Xem</button></td></tr>`;
 }).join('');
}

const contractSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim();
function searchContracts(items,query='',status='',today=contractBusinessDate(),days=30){
 const term=contractSearchText(query);
 return items.filter(item=>(!term||[item.contractNo,item.employeeName,item.employeeCode].some(value=>contractSearchText(value).includes(term)))&&(!status||(['active','expiringSoon','expired'].includes(status)?contractCategory(item,today,days)===status:item.status===status)));
}
async function loadVisibleContracts({canReadEmployees=false,ownEmployee=null,signal,isCurrent=()=>true,readEmployees=apiEmployees,readContracts=apiEmployeeContracts}={}){
 const check=()=>{if(signal?.aborted||!isCurrent())throw new DOMException('Request aborted','AbortError');};
 async function pages(read){
  const items=[];let page=1,total=Infinity;
  while(items.length<total){check();const result=await read(new URLSearchParams({page,pageSize:100}).toString());check();
   if(!Array.isArray(result?.data)||!Number.isInteger(result.total)||result.total<0)throw Error('Danh sách hợp đồng hoặc nhân viên không hợp lệ.');
   items.push(...result.data);total=result.total;if(!result.data.length)break;page++;
  }
  return items;
 }
 const employees=canReadEmployees?await pages(query=>readEmployees(query,signal)):ownEmployee?.id?[ownEmployee]:[];
 if(!canReadEmployees&&!employees.length)throw Error('Cần quyền xem nhân viên hoặc hồ sơ nhân viên liên kết để tải danh sách hợp đồng.');
 const contracts=[];let next=0;
 await Promise.all(Array.from({length:Math.min(4,employees.length)},async()=>{
  while(next<employees.length){check();const employee=employees[next++];
   try{const rows=await pages(query=>readContracts(employee.id,query,signal));for(const item of rows)contracts.push({...item,employeeId:employee.id,employeeName:employee.fullName||'',employeeCode:employee.employeeCode||'',employeeHireDate:employee.hireDate||null});}
   catch(err){if(err.status!==404)throw err;}
  }
 }));
 check();return contracts.sort((a,b)=>String(a.contractNo).localeCompare(String(b.contractNo),'vi')||Number(a.employeeId)-Number(b.employeeId)||String(a.id).localeCompare(String(b.id)));
}

async function mountContracts(root){
 if(!root)return;
 if(!contractGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem hợp đồng.</p>';return;}
 let employeeId=null,employee=null,page=1,search='',generation=0,statisticsGeneration=0,saving=false,dirty=false,statusFilter='',expiringWithinDays=30,statistics=null,directory=null,directoryRequest=null,directoryController=null,searchTimer;
 const ownId=apiSession()?.user?.employeeId;
 root.innerHTML=`<div class="contracts-heading page-content-actions">${contractGrant('canNew')?`<button type="button" class="btn primary" id="contracts-create">${icon('plus',18)} Tạo hợp đồng</button>`:''}</div><div id="contract-statistics" aria-live="polite"></div><div class="contracts-statistics-note"><span id="contracts-as-of"></span><label>Cảnh báo sắp hết hạn<select id="contracts-window" aria-label="Khoảng thời gian sắp hết hạn"><option value="7">7 ngày</option><option value="30" selected>30 ngày</option><option value="60">60 ngày</option><option value="90">90 ngày</option><option value="365">365 ngày</option></select></label></div><form class="contracts-filters" id="contract-search"><div class="contracts-search-input">${icon('search',18)}<input type="search" name="search" maxlength="150" placeholder="Tìm nhân viên, mã hợp đồng…" aria-label="Tìm theo tên nhân viên, mã nhân viên hoặc mã hợp đồng"></div><select name="status" aria-label="Lọc trạng thái hợp đồng"><option value="">Tất cả</option><option value="active">Đang hiệu lực</option><option value="expiringSoon">Sắp hết hạn</option><option value="expired">Đã hết hạn</option></select></form><section id="contract-workspace"><p role="status">Đang tải hợp đồng…</p></section>`;
 async function loadStatistics(){
  const id=++statisticsGeneration,panel=root.querySelector('#contract-statistics');
  statistics=null;root.querySelector('#contracts-as-of').textContent='';
  panel.innerHTML=`<div class="contracts-stats" aria-busy="true" role="status" aria-label="Đang tải thống kê">${[1,2,3].map(()=>'<div class="contract-stat contract-stat-loading"><span></span><strong></strong><span></span></div>').join('')}</div>`;
  try{
   const data=contractStatisticsData(await apiContractStatistics(expiringWithinDays));if(!root.isConnected||id!==statisticsGeneration)return;
   statistics=data;
   panel.innerHTML=`<div class="contracts-stats">${[['active','Đang hiệu lực','approval'],['expiringSoon','Sắp hết hạn','clock'],['expired','Đã hết hạn','file']].map(([key,label,glyph])=>`<article class="contract-stat ${key}"><span class="contract-stat-icon">${icon(glyph,21)}</span><strong>${data[key].toLocaleString('vi-VN')}</strong><span>${label}</span></article>`).join('')}</div>`;
   root.querySelector('#contracts-as-of').textContent=`Trong phạm vi được xem · Cập nhật ${dateLabel(data.asOfDate)}`;
  }catch(err){if(root.isConnected&&id===statisticsGeneration){panel.innerHTML=`<div class="contracts-stats-error"><p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại thống kê</button></div>`;panel.querySelector('button').onclick=loadStatistics;}}
 }
 root.querySelector('#contracts-window').onchange=event=>{expiringWithinDays=Number(event.target.value);loadStatistics();if(!dirty&&!saving)list();};
 root.querySelector('#contracts-create')?.addEventListener('click',()=>{
  if(!canLeave())return;
  openContractCreation({isPageCurrent:()=>root.isConnected,onSaved:async()=>{directory=null;loadStatistics();await list();}});
 });
 const workspace=root.querySelector('#contract-workspace'),searchForm=root.querySelector('#contract-search');
 const applySearch=()=>{if(!canLeave())return;search=searchForm.elements.search.value.trim();statusFilter=searchForm.elements.status.value;page=1;list();};
 searchForm.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(searchTimer);applySearch();};
 searchForm.elements.search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(root.isConnected)applySearch();},250);};
 searchForm.elements.status.onchange=()=>{clearTimeout(searchTimer);applySearch();};
 const alive=id=>root.isConnected&&generation===id;
 const canLeave=()=>!saving&&(!dirty||confirm('Bỏ các thay đổi hợp đồng chưa lưu?'));
 function showError(err,retry){workspace.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;workspace.querySelector('button').onclick=retry;}
 async function getDirectory(){
  if(directory)return directory;
  if(!directoryRequest){
   directoryController=new AbortController();
   directoryRequest=loadVisibleContracts({canReadEmployees:!!contractCatalogGrant('WEB_EMPLOYEES'),ownEmployee:ownId?{id:ownId,fullName:apiSession()?.user?.fullName||'',employeeCode:apiSession()?.user?.employeeCode||''}:null,signal:directoryController.signal,isCurrent:()=>root.isConnected}).then(items=>{directory=items;return items;}).catch(err=>{directoryController?.abort();throw err;}).finally(()=>{directoryRequest=null;});
  }
  return directoryRequest;
 }
 async function list(){
  clearTimeout(searchTimer);const id=++generation;dirty=false;searchForm.hidden=false;
  workspace.innerHTML='<p role="status">Đang tải hợp đồng…</p>';
  try{
   if(!contractGrant('canView'))throw Error('Bạn chưa có quyền xem hợp đồng.');
   const items=await getDirectory();if(!alive(id))return;
   const filtered=searchContracts(items,search,statusFilter,statistics?.asOfDate||contractBusinessDate(),expiringWithinDays);
   page=Math.min(page,Math.max(1,Math.ceil(filtered.length/30)));
   const result={data:filtered.slice((page-1)*30,page*30),total:filtered.length};
   workspace.innerHTML=`<div class="table-wrap"><table class="contracts-table"><thead><tr><th>Hợp đồng / Nhân viên</th><th>Loại / Hiệu lực</th><th>Trạng thái</th><th><span class="sr-only">Hành động</span></th></tr></thead><tbody>${contractListRows(result.data,contractGrant('canUpdate'),null,statistics?.asOfDate||contractBusinessDate(),expiringWithinDays)}</tbody></table></div>${result.data.length?'':'<div class="empty"><h3>Không có hợp đồng phù hợp</h3><p>Thử thay đổi từ khóa hoặc trạng thái.</p></div>'}<div class="toolbar user-pagination contracts-pagination"><span>${e(result.total)} hợp đồng · Trang ${page}</span><div><button type="button" class="btn" id="contract-prev" ${page<=1?'disabled':''}>Trang trước</button><button type="button" class="btn" id="contract-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div></div>`;
   workspace.querySelectorAll('[data-contract-open]').forEach(button=>button.onclick=()=>{const item=result.data[Number(button.dataset.contractOpen)];employeeId=item.employeeId;employee={id:item.employeeId,fullName:item.employeeName,employeeCode:item.employeeCode,hireDate:item.employeeHireDate};edit(item.id);});
   workspace.querySelector('#contract-prev').onclick=()=>{page--;list();};workspace.querySelector('#contract-next').onclick=()=>{page++;list();};
  }catch(err){if(alive(id))showError(err,list);}
 }
 async function edit(contractId=null,editing=false){
  if(contractId===null&&!contractGrant('canNew'))return;
  clearTimeout(searchTimer);searchForm.hidden=true;const id=++generation,target=employeeId;workspace.innerHTML='<p role="status">Đang tải thông tin hợp đồng…</p>';
  try{
   const item=contractId===null?null:await apiEmployeeContract(target,contractId);if(!alive(id))return;
   const editable=contractGrant(contractId===null?'canNew':'canUpdate')&&!contractClosed(item);
   if(item&&(!editable||!editing)){
    const attachment=contractAttachment(item?.attachmentUrl);
    workspace.innerHTML=`<button type="button" class="btn" id="contract-back">← Danh sách hợp đồng</button><h2 class="role-editor-title">${e(item.contractNo)}</h2>${details([['Loại hợp đồng',e(item.contractTypeName||item.contractType)],['Bắt đầu',dateLabel(item.startDate)],['Kết thúc',dateLabel(item.endDate)],['Trạng thái',e(contractStatuses[item.status]||item.status)],['Tệp đính kèm',attachment?`<a href="${e(attachment)}" target="_blank" rel="noopener noreferrer">Xem tệp đính kèm</a>`:'—']])}${contractClosed(item)?'<p class="muted">Hợp đồng đã đóng chỉ được xem.</p>':''}${editable?'<button type="button" class="btn primary" id="contract-edit-detail">Chỉnh sửa hợp đồng</button>':''}`;
    workspace.querySelector('#contract-back').onclick=list;workspace.querySelector('#contract-edit-detail')?.addEventListener('click',()=>edit(contractId,true));return;
   }
   workspace.innerHTML=`<button type="button" class="btn" id="contract-back">← Danh sách hợp đồng</button><h2 class="role-editor-title">${item?'Chỉnh sửa':'Thêm'} hợp đồng · ${employee?e(employee.fullName):`Nhân viên #${e(target)}`}</h2><form class="user-registration" id="contract-form"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Số hợp đồng','contractNo','text',item?.contractNo||'','readonly')}<label>Loại hợp đồng<select name="contractType" required disabled>${item?`<option value="${e(item.contractType)}">${e(item.contractTypeName||item.contractType)}</option>`:'<option value="">Đang tải loại hợp đồng…</option>'}</select></label>${field('Ngày bắt đầu','startDate','date',item?.startDate||'','required')}${field('Ngày kết thúc (tùy chọn)','endDate','date',item?.endDate||'')}<label>Trạng thái<select name="status">${Object.entries(contractStatuses).filter(([value])=>item?.status!=='ACTIVE'||['ACTIVE','EXPIRED','TERMINATED'].includes(value)).map(([value,label])=>`<option value="${value}" ${(item?.status||'DRAFT')===value?'selected':''}>${label}</option>`).join('')}</select></label>${field('Liên kết tệp đính kèm (HTTPS)','attachmentUrl','url',item?.attachmentUrl||'','maxlength="500"')}</div><p id="contract-type-feedback" role="status"></p><div class="form-actions"><button type="submit" class="btn primary" ${!item?'disabled':''}>Lưu hợp đồng</button></div></fieldset><p id="contract-feedback" role="alert"></p></form>`;
   const form=workspace.querySelector('#contract-form'),fieldset=form.querySelector('fieldset'),feedback=workspace.querySelector('#contract-feedback'),typeFeedback=workspace.querySelector('#contract-type-feedback'),submit=form.querySelector('[type=submit]');
   let types=[],typeReady=!!item;
   form.oninput=form.onchange=()=>{dirty=true;};
   workspace.querySelector('#contract-back').onclick=()=>{if(canLeave())list();};
   async function loadTypes(){
    if(!contractCatalogGrant('WEB_CONTRACT_TYPES')){typeFeedback.textContent=item?'Giữ loại hợp đồng hiện tại. Cần quyền xem loại hợp đồng để đổi loại.':'Bạn cần quyền xem WEB_CONTRACT_TYPES để chọn loại hợp đồng.';return;}
    try{
     const result=await apiActiveContractTypes();if(!alive(id)||!form.isConnected)return;types=result;
     const choices=[...types];if(item&&!choices.some(type=>type.code===item.contractType))choices.unshift({code:item.contractType,name:item.contractTypeName||item.contractType});
     form.elements.contractType.innerHTML='<option value="">Chọn loại hợp đồng</option>'+choices.map(type=>`<option value="${e(type.code)}" ${item?.contractType===type.code?'selected':''}>${e(type.name)}</option>`).join('');form.elements.contractType.disabled=false;typeReady=choices.length>0;submit.disabled=!typeReady;
     typeFeedback.textContent=choices.length?'':'Chưa có loại hợp đồng hoạt động. Thêm loại hợp đồng trong Master Data trước.';
    }catch(err){if(alive(id)&&form.isConnected){typeFeedback.innerHTML=`${e(err.message)} <button type="button" class="btn">Thử lại</button>`;typeFeedback.querySelector('button').onclick=loadTypes;}}
   }
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(saving)return;feedback.textContent='';
    try{
     if(!contractGrant(item?'canUpdate':'canNew'))throw Error('Bạn không có quyền lưu hợp đồng.');
     if(!typeReady)throw Error('Vui lòng tải và chọn loại hợp đồng.');
     const values=Object.fromEntries(new FormData(form));if(form.elements.contractType.disabled)values.contractType=item?.contractType;
     const payload=contractPayload(values,{original:item,hireDate:employee?.hireDate});
     if(payload.contractType!==item?.contractType&&!types.some(type=>type.code===payload.contractType))throw Error('Vui lòng chọn loại hợp đồng đang hoạt động.');
     saving=true;fieldset.disabled=true;submit.textContent='Đang lưu…';
     await apiSaveEmployeeContract(target,contractId,payload);if(alive(id)){dirty=false;directory=null;loadStatistics();await list();}
    }catch(err){if(alive(id)&&form.isConnected)feedback.textContent=err.message;}
    finally{saving=false;if(form.isConnected){fieldset.disabled=false;submit.disabled=!typeReady;submit.textContent='Lưu hợp đồng';}}
   };
   loadTypes();
  }catch(err){if(alive(id))showError(err,()=>edit(contractId,editing));}
 }
 loadStatistics();
 await list();
}

function openContractCreation({onSaved=()=>{},isPageCurrent=()=>true}={}){
 if(!contractGrant('canNew'))throw Error('Bạn không có quyền tạo hợp đồng.');
 const canEmployees=!!contractCatalogGrant('WEB_EMPLOYEES'),ownId=apiSession()?.user?.employeeId;
 openDialog('Tạo hợp đồng',`<section id="contract-create-popup">${canEmployees?'<label class="contract-popup-employee-search">Tìm nhân viên<input type="search" id="contract-create-employee-search" maxlength="150" placeholder="Tìm tên hoặc mã nhân viên"></label>':''}<form id="contract-create-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${canEmployees?'<label>Nhân viên<select name="employeeId" required disabled><option value="">Đang tải nhân viên…</option></select></label>':field('ID nhân viên','employeeId','number',ownId||'','required min="1" step="1"')}<label>Loại hợp đồng<select name="contractType" required disabled><option value="">Đang tải loại hợp đồng…</option></select></label>${field('Ngày bắt đầu','startDate','date','','required')}${field('Ngày kết thúc (tùy chọn)','endDate','date','')}<label>Trạng thái<select name="status">${Object.entries(contractStatuses).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>${field('Liên kết tệp đính kèm (HTTPS)','attachmentUrl','url','','maxlength="500"')}</div><p id="contract-create-catalog-feedback" role="status"></p><div class="form-actions"><button type="button" class="btn" id="contract-create-cancel">Hủy</button><button type="submit" class="btn primary" disabled>Tạo hợp đồng</button></div></fieldset><p id="contract-create-feedback" role="alert"></p></form></section>`);
 const popup=document.getElementById('contract-create-popup'),form=popup.querySelector('form'),fieldset=form.querySelector('fieldset'),submit=form.querySelector('[type=submit]'),feedback=popup.querySelector('#contract-create-feedback'),catalogFeedback=popup.querySelector('#contract-create-catalog-feedback');
 let employees=[],types=[],employeesReady=!canEmployees,typesReady=false,busy=false;
 const modal=document.getElementById('modal'),closeButton=modal.querySelector('[data-action="close"]');
 const preventBusyClose=event=>{if(busy)event.preventDefault();};
 modal.addEventListener('cancel',preventBusyClose);
 modal.addEventListener('close',()=>modal.removeEventListener('cancel',preventBusyClose),{once:true});
 const current=()=>isPageCurrent()&&popup.isConnected&&document.getElementById('contract-create-popup')===popup&&document.getElementById('modal').open;
 const ready=()=>{submit.disabled=busy||!employeesReady||!typesReady;};
 function catalogError(key,err,retry){
  const previous=catalogFeedback.querySelector(`[data-catalog="${key}"]`);previous?.remove();
  const row=document.createElement('span');row.dataset.catalog=key;row.textContent=err.message+' ';
  if(retry){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Thử lại';button.onclick=()=>{row.remove();retry();};row.append(button);}
  catalogFeedback.append(row);
 }
 function drawEmployees(){
  const selected=form.elements.employeeId.value||String(ownId||''),query=popup.querySelector('#contract-create-employee-search').value;
  const filtered=employees.filter(item=>!query||[item.fullName,item.employeeCode].some(value=>contractSearchText(value).includes(contractSearchText(query)))||String(item.id)===selected);
  form.elements.employeeId.innerHTML='<option value="">Chọn nhân viên</option>'+filtered.map(item=>`<option value="${e(item.id)}" ${String(item.id)===selected?'selected':''}>${e(item.employeeCode)} · ${e(item.fullName)}</option>`).join('');
  form.elements.employeeId.disabled=false;
 }
 async function loadEmployees(){
  try{
   const items=[];let page=1,total=Infinity;
   while(items.length<total){const result=await apiEmployees(new URLSearchParams({page,pageSize:100}).toString());if(!current())return;if(!Array.isArray(result?.data)||!Number.isInteger(result.total))throw Error('Danh sách nhân viên không hợp lệ.');items.push(...result.data);total=result.total;if(!result.data.length)break;page++;}
   employees=items;employeesReady=items.length>0;drawEmployees();ready();if(!employeesReady)catalogError('employees',Error('Không có nhân viên trong phạm vi được xem.'));
  }catch(err){if(current())catalogError('employees',err,loadEmployees);}
 }
 async function loadTypes(){
  if(!contractCatalogGrant('WEB_CONTRACT_TYPES')){catalogError('types',Error('Bạn cần quyền xem loại hợp đồng để chọn loại hợp đồng.'));return;}
  try{
   const items=await apiActiveContractTypes();if(!current())return;
   types=items.filter(item=>/^[A-Z][A-Z0-9]{0,19}$/.test(item.prefix||''));typesReady=types.length>0;
   form.elements.contractType.innerHTML='<option value="">Chọn loại hợp đồng</option>'+types.map(item=>`<option value="${e(item.code)}">${e(item.name)} · ${e(item.prefix)}</option>`).join('');form.elements.contractType.disabled=false;ready();
   if(!typesReady)catalogError('types',Error('Chưa có loại hợp đồng hoạt động có prefix hợp lệ. Cấu hình prefix tại Master Data.'));
  }catch(err){if(current())catalogError('types',err,loadTypes);}
 }
 popup.querySelector('#contract-create-employee-search')?.addEventListener('input',()=>{if(employeesReady)drawEmployees();});
 popup.querySelector('#contract-create-cancel').onclick=()=>{if(!busy)closeDialog();};
 form.onsubmit=async event=>{
  event.preventDefault();event.stopPropagation();if(busy)return;feedback.textContent='';
  try{
   if(!contractGrant('canNew'))throw Error('Bạn không có quyền tạo hợp đồng.');
   if(!employeesReady||!typesReady)throw Error('Vui lòng tải danh sách nhân viên và loại hợp đồng.');
   const values=Object.fromEntries(new FormData(form)),employeeId=Number(values.employeeId),employee=employees.find(item=>Number(item.id)===employeeId);
   if(!Number.isSafeInteger(employeeId)||employeeId<=0||canEmployees&&!employee)throw Error('Vui lòng chọn nhân viên hợp lệ.');
   if(!types.some(item=>item.code===values.contractType))throw Error('Vui lòng chọn loại hợp đồng có prefix hợp lệ.');
   const payload={employeeId,...contractPayload(values,{hireDate:employee?.hireDate})};
   busy=true;fieldset.disabled=true;if(closeButton)closeButton.disabled=true;submit.textContent='Đang tạo…';
   const saved=await apiCreateContract(payload);
   if(current()){closeDialog();toast(`Đã tạo hợp đồng · ${saved.contractNo}`);await onSaved(saved);}
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{busy=false;if(current()){fieldset.disabled=false;if(closeButton)closeButton.disabled=false;submit.textContent='Tạo hợp đồng';ready();}}
 };
 if(canEmployees)loadEmployees();loadTypes();
}


// Source: pages/human-resources/leave-balances.js

const balanceDayKeys=['entitledDays','carriedOverDays','adjustmentDays','usedDays','reservedDays','remainingDays','availableDays'];
const balanceDayText=value=>Number(value).toLocaleString('vi-VN',{maximumFractionDigits:2});
function leaveBalanceGrant(flag,session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_LEAVE_BALANCES'&&p.canView==='Y'&&p[flag]==='Y'&&(flag!=='canUpdate'||p.dataScopes?.UPDATE!=='SELF'));
}
function leaveBalanceList(response){
 if(response?.success!==true||!Array.isArray(response.data)||!Number.isSafeInteger(response.total)||response.total<0)throw Error('Danh sách số dư phép không hợp lệ.');
 for(const row of response.data)if(!['id','employeeId','leaveTypeId'].every(key=>Number.isSafeInteger(row[key])&&row[key]>0)||!Number.isSafeInteger(row.version)||row.version<0||!balanceDayKeys.every(key=>typeof row[key]==='number'&&Number.isFinite(row[key])))throw Error('Chi tiết số dư phép không hợp lệ.');
 return response;
}
function leaveBalanceTotals(rows){return rows.reduce((sum,row)=>({total:sum.total+row.entitledDays+row.carriedOverDays+row.adjustmentDays,used:sum.used+row.usedDays,remaining:sum.remaining+row.remainingDays}),{total:0,used:0,remaining:0});}
function leaveBalanceAmount(value,{signed=false}={}){
 const number=Number(value);
 if(value===null||String(value).trim()===''||!Number.isFinite(number)||Math.abs(number)>99999.99||(!signed&&number<0)||Math.abs(number*100-Math.round(number*100))>1e-7)throw Error('Số ngày phải hợp lệ, tối đa 99999.99 và 2 chữ số thập phân.');
 return number;
}
function leaveBalanceOperationId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 const bytes=new Uint8Array(16);if(!globalThis.crypto?.getRandomValues)throw Error('Trình duyệt không hỗ trợ tạo mã cấp phép an toàn.');
 globalThis.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function leaveBalanceGrantPayload(values,operationId){
 const target=values.target,year=Number(values.year),leaveTypeId=Number(values.leaveTypeId),reason=String(values.reason||'').trim();
 if(!['EMPLOYEE','DEPARTMENT','ALL'].includes(target)||!Number.isInteger(year)||year<1900||year>9999||!Number.isSafeInteger(leaveTypeId)||leaveTypeId<1||!reason)throw Error('Chọn đối tượng, loại phép, năm và nhập lý do hợp lệ.');
 const payload={operationId,target,year,leaveTypeId,entitledDays:leaveBalanceAmount(values.entitledDays),carriedOverDays:leaveBalanceAmount(values.carriedOverDays),reason};
 const key=target==='EMPLOYEE'?'employeeId':target==='DEPARTMENT'?'departmentId':null;
 if(key){const id=Number(values[key]);if(!Number.isSafeInteger(id)||id<1)throw Error('Chọn nhân viên hoặc phòng ban hợp lệ.');payload[key]=id;}
 return payload;
}
function leaveBalanceRows(rows,canUpdate){return rows.map(row=>`<tr><td><strong>${e(row.employeeName||'')}</strong>${row.employeeCode?`<span class="balance-employee-code">${e(row.employeeCode)}</span>`:''}<small>${e(row.leaveTypeName||'')}</small></td>${['entitledDays','carriedOverDays','adjustmentDays','usedDays','reservedDays','remainingDays'].map(key=>`<td class="${key==='reservedDays'?'balance-reserved':key==='remainingDays'?'balance-remaining':''}">${balanceDayText(row[key])}</td>`).join('')}<td>${balanceDayText(row.availableDays)}</td><td><div class="balance-row-actions">${canUpdate?`<button type="button" class="btn small" data-balance-edit="${row.id}">Sửa</button><button type="button" class="btn small" data-balance-adjust="${row.id}">Điều chỉnh</button>`:''}<button type="button" class="btn small" data-balance-history="${row.id}">Lịch sử</button></div></td></tr>`).join('');}

function leaveBalanceLookupFields(key,label,placeholder){
 return `<div class="balance-lookup"><label>${label}<input type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="balance-options-${key}" data-balance-lookup="${key}" autocomplete="off" placeholder="${placeholder}" aria-describedby="balance-selection-${key}"></label><input type="hidden" name="${key}"><div class="balance-lookup-options" id="balance-options-${key}" role="listbox" aria-label="${label}" hidden></div><span class="user-field-note balance-lookup-status" id="balance-selection-${key}" role="status"></span></div>`;
}
function leaveBalanceLookupMatch(items,value){
 const code=String(value||'').trim().toLocaleLowerCase('vi');
 return code?items.find(item=>String(item.code).toLocaleLowerCase('vi')===code)||null:null;
}
function mountLeaveBalanceLookup(form,key,loadOptions){
 const input=form.querySelector(`[data-balance-lookup="${key}"]`),hidden=form.elements.namedItem(key),list=form.querySelector(`#balance-options-${key}`),status=form.querySelector(`#balance-selection-${key}`);
 let items=[],visible=[],generation=0,timer,blurTimer,active=-1;
 const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
 const show=value=>{list.hidden=!value;input.setAttribute?.('aria-expanded',String(value));if(!value)input.removeAttribute?.('aria-activedescendant');};
 const resolve=()=>{const selected=leaveBalanceLookupMatch(items,input.value);hidden.value=selected?.id||'';input.setCustomValidity(input.value&&!selected?'Chọn một mục hợp lệ từ danh sách gợi ý.':'');status.textContent=selected?selected.name:'';return selected;};
 function render(){
 const query=normalize(input.value.trim());visible=items.filter(item=>normalize(item.code+' '+item.name).includes(query));
 list.innerHTML=visible.length?visible.map((item,index)=>`<button type="button" role="option" aria-selected="${index===active}" id="balance-option-${key}-${index}" data-lookup-index="${index}"><strong>${e(item.code)}</strong>${item.name!==item.code?`<small>${e(item.name)}</small>`:''}</button>`).join(''):'<p>Không có kết quả phù hợp.</p>';
 show(true);
 if(active>=0)input.setAttribute?.('aria-activedescendant',`balance-option-${key}-${active}`);
 }
 function choose(index){const item=visible[index];if(!item)return;input.value=item.code;resolve();generation++;clearTimeout(timer);show(false);input.focus?.();}
 list.onpointerdown=event=>event.preventDefault();
 list.onclick=event=>{const button=event.target.closest('[data-lookup-index]');if(button)choose(Number(button.dataset.lookupIndex));};
 async function search(){
 const current=++generation,query=input.value.trim();status.textContent='Đang tìm…';list.innerHTML='<p>Đang tải danh sách…</p>';show(true);
 try{const result=await loadOptions(query);if(!form.isConnected||current!==generation||input.disabled)return;
 items=result;active=-1;resolve();render();if(!hidden.value)status.textContent=visible.length?'Chọn trong danh sách gợi ý.':'Không có kết quả phù hợp.';
 }catch(err){if(form.isConnected&&current===generation){hidden.value='';list.innerHTML='';show(false);status.textContent=err.message;}}
 }
 input.oninput=()=>{clearTimeout(timer);generation++;resolve();active=-1;render();timer=setTimeout(search,250);};
 input.onchange=resolve;
 input.onfocus=()=>{clearTimeout(blurTimer);clearTimeout(timer);return search();};
 input.onclick=()=>{if(list.hidden){clearTimeout(timer);return search();}};
 input.onblur=()=>{blurTimer=setTimeout(()=>show(false),150);};
 input.onkeydown=event=>{
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();show(false);return;}
 if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();choose(active);return;}
 if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(list.hidden)render();active=Math.max(0,Math.min(visible.length-1,active+(event.key==='ArrowDown'?1:-1)));render();list.querySelector?.(`[data-lookup-index="${active}"]`)?.scrollIntoView?.({block:'nearest'});}
 };
}

async function mountLeaveBalances(root){
 if(!root)return;
 if(!leaveBalanceGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem WEB_LEAVE_BALANCES.</p>';return;}
 let year=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric'}).format(new Date())),type='',search='',page=1,rows=[],types=[],generation=0,timer;
 const canUpdate=leaveBalanceGrant('canUpdate'),pageSize=20;
 root.innerHTML=`<div class="contracts-heading"><div><h2>Leave Management</h2><p>Theo dõi và phân bổ ngày phép nhân viên</p></div>${canUpdate?`<button type="button" class="btn primary" data-balance-grant>${icon('plus',18)} Cấp phép</button>`:''}</div><div data-balance-summary></div><form class="toolbar balance-filters"><label>Năm<input name="year" type="number" min="1900" max="9999" required value="${year}"></label><label>Loại phép<select name="leaveTypeId"><option value="">Tất cả loại phép</option></select></label><label class="balance-search">Tìm nhân viên<input name="search" placeholder="Tên hoặc mã nhân viên" type="search"></label><button class="btn" type="submit">Lọc</button><button class="btn" type="button" data-balance-refresh>Làm mới</button></form><div data-balance-content></div>`;
 const content=root.querySelector('[data-balance-content]'),summary=root.querySelector('[data-balance-summary]'),form=root.querySelector('form');
 function currentFilters(){return {year,leaveTypeId:type,search,view:'ALL'};}
 async function load(){
 if(!root.isConnected)return;
 const current=++generation;content.innerHTML='<p role="status">Đang tải số dư phép…</p>';summary.innerHTML='<div class="my-leave-summary" aria-busy="true">'+Array.from({length:3},()=>'<div class="card my-leave-stat">Đang tải…</div>').join('')+'</div>';
 try{
 const all=[];let serverPage=1;
 while(true){const result=leaveBalanceList(await apiLeaveBalances({...currentFilters(),page:serverPage,pageSize:100}));if(!root.isConnected||current!==generation)return;all.push(...result.data);if(all.length>=result.total)break;if(!result.data.length)throw Error('Danh sách thay đổi trong lúc tải. Hãy làm mới.');serverPage++;}
 rows=all;
 for(const row of rows)if(!types.some(item=>item.id===row.leaveTypeId))types.push({id:row.leaveTypeId,name:row.leaveTypeName||`Loại phép #${row.leaveTypeId}`});
 form.elements.leaveTypeId.innerHTML='<option value="">Tất cả loại phép</option>'+types.map(item=>`<option value="${item.id}" ${String(item.id)===type?'selected':''}>${e(item.name)}</option>`).join('');
 page=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));const totals=leaveBalanceTotals(rows);
 summary.innerHTML=`<div class="my-leave-summary">${[['total','Tổng phép được cấp'],['used','Phép đã sử dụng'],['remaining','Phép còn lại']].map(([key,label])=>`<article class="card my-leave-stat"><div><span>${label}</span><strong>${balanceDayText(totals[key])}<small> ngày</small></strong></div></article>`).join('')}</div>`;draw();
 }catch(err){if(!root.isConnected||current!==generation)return;summary.innerHTML='';content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button" data-retry>Thử lại</button>`;content.querySelector('button').onclick=load;}
 }
 function draw(){
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
 content.innerHTML=`<div class="table-wrap"><table class="leave-balances-table"><thead><tr><th>Nhân viên</th><th>Được cấp</th><th>Chuyển năm</th><th>Điều chỉnh</th><th>Đã nghỉ</th><th>Chờ duyệt</th><th>Còn lại</th><th>Khả dụng</th><th></th></tr></thead><tbody>${leaveBalanceRows(rows.slice((page-1)*pageSize,page*pageSize),canUpdate)}</tbody></table></div>${rows.length?'':'<div class="empty">Chưa có số dư phép theo bộ lọc.</div>'}<div class="user-pagination contracts-pagination"><span>${rows.length} số dư · Trang ${page}/${totalPages}</span><div><button type="button" class="btn" data-prev ${page===1?'disabled':''}>Trang trước</button><button type="button" class="btn" data-next ${page>=totalPages?'disabled':''}>Trang sau</button></div></div>`;
 content.querySelector('[data-prev]').onclick=()=>{page--;draw();};content.querySelector('[data-next]').onclick=()=>{page++;draw();};
 for(const [attribute,action] of [['data-balance-edit','edit'],['data-balance-adjust','adjust'],['data-balance-history','history']])content.querySelectorAll(`[${attribute}]`).forEach(button=>button.onclick=()=>{const row=rows.find(item=>item.id===Number(button.getAttribute(attribute)));if(action==='history')showHistory(row);else editBalance(row,action);});
 }
 const apply=()=>{if(!form.reportValidity())return;year=Number(form.elements.year.value);type=form.elements.leaveTypeId.value;search=form.elements.search.value.trim();page=1;load();};
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(timer);apply();};form.elements.year.onchange=form.elements.leaveTypeId.onchange=apply;form.elements.search.oninput=()=>{clearTimeout(timer);timer=setTimeout(apply,300);};root.querySelector('[data-balance-refresh]').onclick=()=>{clearTimeout(timer);apply();};
 function typeOptions(selected=''){return `<option value="">Chọn loại phép</option>${types.map(item=>`<option value="${item.id}" ${Number(selected)===item.id?'selected':''}>${e(item.name)}</option>`).join('')}`;}
 async function grantBalance(){
 if(!leaveBalanceGrant('canUpdate'))return;
 openDialog('Cấp phép',`<form id="balance-grant-form" class="user-registration"><div class="form-grid"><label>Đối tượng<select name="target"><option value="EMPLOYEE">Nhân viên</option><option value="DEPARTMENT">Phòng ban</option><option value="ALL">Tất cả nhân viên trong phạm vi được cấp quyền</option></select></label><label>Loại phép${types.length?`<select name="leaveTypeId" required>${typeOptions(type)}</select>`:'<input name="leaveTypeId" type="number" min="1" required placeholder="ID loại phép">'}</label><div data-grant-employee class="balance-grant-target">${leaveBalanceLookupFields('employeeId','Mã nhân viên','Nhập mã nhân viên để tìm')}</div><div data-grant-department class="balance-grant-target" hidden><label>Phòng ban<select name="departmentId"><option value="">Chọn phòng ban</option></select></label></div>${field('Năm','year','number',year,'required min="1900" max="9999"')}${field('Số ngày được cấp','entitledDays','number','','required min="0" max="99999.99" step="0.01"')}${field('Số ngày chuyển năm','carriedOverDays','number',0,'required min="0" max="99999.99" step="0.01"')}</div><label>Lý do<textarea name="reason" required maxlength="1000"></textarea></label><p data-feedback role="status"></p><div class="form-actions"><button class="btn primary" type="submit">Cấp phép</button></div></form>`);
 const grantForm=document.querySelector('#balance-grant-form'),feedback=grantForm.querySelector('[data-feedback]');let busy=false,lastContent='',operationId='';
 let departmentsPromise,departmentsLoaded=false;
 mountLeaveBalanceLookup(grantForm,'employeeId',async query=>{
 const result=await apiEmployees(new URLSearchParams({page:1,pageSize:20,search:query,employmentStatus:'ACTIVE'}));
 if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
 return result.data.filter(item=>item.employeeCode).map(item=>({id:item.id,code:item.employeeCode,name:item.fullName||item.name||''}));
 });
 const departmentSelect=grantForm.elements.departmentId;
 async function loadDepartments(){
 if(departmentsLoaded||departmentsPromise)return;
 departmentSelect.innerHTML='<option value="">Đang tải phòng ban…</option>';
 departmentsPromise=apiActiveDepartments();
 try{const items=await departmentsPromise;if(!grantForm.isConnected)return;
 departmentSelect.innerHTML='<option value="">Chọn phòng ban</option>'+items.map(item=>`<option value="${e(item.id)}">${e(item.departmentName)}</option>`).join('');departmentsLoaded=true;
 if(!items.length)feedback.textContent='Chưa có phòng ban đang hoạt động.';
 }catch(err){if(grantForm.isConnected){departmentSelect.innerHTML='<option value="">Không tải được phòng ban</option>';feedback.textContent=err.message;}}
 finally{departmentsPromise=null;}
 }
 departmentSelect.onfocus=loadDepartments;
 function syncTarget(){
 for(const [target,key,selector] of [['EMPLOYEE','employeeId','[data-grant-employee]'],['DEPARTMENT','departmentId','[data-grant-department]']]){
 const active=grantForm.elements.target.value===target,input=key==='departmentId'?departmentSelect:grantForm.querySelector(`[data-balance-lookup="${key}"]`);
 grantForm.querySelector(selector).hidden=!active;input.required=active;input.disabled=!active;
 if(active&&key==='departmentId')loadDepartments();
 }
 }
 grantForm.elements.target.onchange=syncTarget;syncTarget();
 grantForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||!leaveBalanceGrant('canUpdate'))return;let payload;
 try{payload=leaveBalanceGrantPayload(Object.fromEntries(new FormData(grantForm)),'');const signature=JSON.stringify(payload);if(signature!==lastContent){operationId=leaveBalanceOperationId();lastContent=signature;}payload.operationId=operationId;}catch(err){feedback.textContent=err.message;return;}
 busy=true;const submit=grantForm.querySelector('[type=submit]');submit.disabled=true;feedback.textContent='Đang cấp phép…';
 try{const receipt=await apiGrantLeaveBalances(payload);if(!grantForm.isConnected)return;closeDialog();toast(`Đã tạo ${receipt.created} số dư; bỏ qua ${receipt.skipped} số dư đã có.`);if(root.isConnected)load();}catch(err){if(grantForm.isConnected)feedback.textContent=err.message;}finally{busy=false;submit.disabled=false;}
 };
 }
 function editBalance(row,action){
 if(!leaveBalanceGrant('canUpdate'))return;
 openDialog(action==='adjust'?'Điều chỉnh số dư phép':'Sửa cấp phép',`<p>${e(row.employeeName)} · ${e(row.leaveTypeName)} · ${row.year}</p><form id="balance-edit-form" class="user-registration">${action==='adjust'?field('Số ngày điều chỉnh (âm để giảm)','days','number','','required min="-99999.99" max="99999.99" step="0.01"'):`<div class="form-grid">${field('Số ngày được cấp','entitledDays','number',row.entitledDays,'required min="0" max="99999.99" step="0.01"')}${field('Số ngày chuyển năm','carriedOverDays','number',row.carriedOverDays,'required min="0" max="99999.99" step="0.01"')}</div>`}<label>Lý do<textarea name="reason" required maxlength="1000"></textarea></label><p role="status" data-feedback></p><div class="form-actions"><button class="btn primary" type="submit">Lưu</button></div></form>`);
 const editForm=document.querySelector('#balance-edit-form'),feedback=editForm.querySelector('[data-feedback]');let busy=false,stale=false;
 editForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||stale||!leaveBalanceGrant('canUpdate'))return;const data=Object.fromEntries(new FormData(editForm));let payload;
 try{const reason=data.reason.trim();if(!reason)throw Error('Nhập lý do.');if(action==='adjust'){const days=leaveBalanceAmount(data.days,{signed:true});if(days===0||row.availableDays+days<0)throw Error('Điều chỉnh phải khác 0 và không giảm vào phép đã dùng hoặc đang giữ.');payload={version:row.version,days,reason};}else{const entitledDays=leaveBalanceAmount(data.entitledDays),carriedOverDays=leaveBalanceAmount(data.carriedOverDays),allocated=entitledDays+carriedOverDays+row.adjustmentDays;if(allocated<row.usedDays+row.reservedDays||allocated>99999.99)throw Error('Tổng phân bổ phải đủ phép đã dùng/đang giữ và không vượt 99999.99.');payload={employeeId:row.employeeId,leaveTypeId:row.leaveTypeId,year:row.year,version:row.version,entitledDays,carriedOverDays,reason};}}catch(err){feedback.textContent=err.message;return;}
 busy=true;const submit=editForm.querySelector('button');submit.disabled=true;
 try{if(action==='adjust')await apiAdjustLeaveBalance(row.id,payload);else await apiSaveLeaveBalance(payload);if(!editForm.isConnected)return;closeDialog();toast('Đã cập nhật số dư phép.');if(root.isConnected)load();}catch(err){stale=err.status===409;if(editForm.isConnected)feedback.textContent=err.message+(stale?' Đóng cửa sổ và làm mới danh sách trước khi sửa lại.':'');}finally{busy=false;submit.disabled=stale;}
 };
 }
 async function showHistory(row){
 openDialog('Lịch sử số dư phép',`<p>${e(row.employeeName)} · ${e(row.leaveTypeName)}</p><div id="balance-history-content"></div>`);const target=document.querySelector('#balance-history-content');let historyPage=1;
 async function loadHistory(){target.innerHTML='<p>Đang tải lịch sử…</p>';try{const result=await apiLeaveBalanceHistory(row.id,historyPage);if(!target.isConnected)return;if(!Array.isArray(result.data))throw Error('Lịch sử không hợp lệ.');target.innerHTML=`${result.data.map(item=>{let after={};try{after=typeof item.afterJson==='string'?JSON.parse(item.afterJson):item.afterJson||{};}catch{}return `<article class="system-settings-location"><strong>${e(item.action)}</strong><p>${e(item.actorUserId||'Hệ thống')} · ${e(dateLabel(item.createdAt))}</p><p>${e(after.reason||'')}</p></article>`;}).join('')||'<p>Chưa có lịch sử.</p>'}<div class="user-pagination"><button class="btn" type="button" data-history-prev ${historyPage===1?'disabled':''}>Trang trước</button><span>Trang ${historyPage}</span><button class="btn" type="button" data-history-next ${historyPage*20>=result.total?'disabled':''}>Trang sau</button></div>`;target.querySelector('[data-history-prev]').onclick=()=>{historyPage--;loadHistory();};target.querySelector('[data-history-next]').onclick=()=>{historyPage++;loadHistory();};}catch(err){if(target.isConnected)target.innerHTML=`<p role="alert">${e(err.message)}</p>`;}}
 await loadHistory();
 }
 root.querySelector('[data-balance-grant]')?.addEventListener('click',grantBalance);
 const catalogAllowed=apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_LEAVE_TYPES'&&p.canView==='Y');
 if(catalogAllowed){try{const result=await apiWorkflowLeaveTypes('page=1&pageSize=100');types=(Array.isArray(result)?result:result.data||[]).filter(item=>item.isActive&&item.requiresBalance);if(root.isConnected)form.elements.leaveTypeId.innerHTML='<option value="">Tất cả loại phép</option>'+types.map(item=>`<option value="${item.id}">${e(item.name)}</option>`).join('');}catch{}}
 await load();
}


// Source: pages/administration/master-data/leave-types.js

function leaveTypeGrant(flag,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_LEAVE_TYPES'&&p.canView==='Y'&&p[flag]==='Y');}
function leaveTypePayload(values){
 const code=String(values.code||'').trim(),name=String(values.name||'').trim();
 if(!/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(code))throw Error('Mã gồm 1–30 chữ hoa, số, gạch dưới hoặc gạch ngang; bắt đầu bằng chữ hoặc số.');
 if(!name||name.length>100)throw Error('Tên loại nghỉ phép bắt buộc, tối đa 100 ký tự.');
 for(const key of ['paid','requiresBalance','isActive'])if(typeof values[key]!=='boolean')throw Error('Trạng thái loại nghỉ phép không hợp lệ.');
 return {code,name,paid:values.paid,requiresBalance:values.requiresBalance,isActive:values.isActive};
}
const leaveTypeSwitch=(name,label,value)=>`<label class="role-toggle-row"><span>${label}</span><span class="role-switch"><input name="${name}" type="checkbox" role="switch" ${value?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;
async function mountLeaveTypes(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 if(!root)return;
 let page=1,search='',generation=0,busy=false;
 const current=id=>root.isConnected&&id===generation;
 async function list(){
  const id=++generation;onDirty(false);
  if(!leaveTypeGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem loại nghỉ phép.</p>';return;}
  root.innerHTML='<p role="status">Đang tải loại nghỉ phép…</p>';
  try{
   const result=await apiWorkflowLeaveTypes(new URLSearchParams({page,pageSize:20,search}).toString());if(!current(id))return;
   if(!Array.isArray(result?.data))throw Error('Danh sách loại nghỉ phép không hợp lệ.');
   root.innerHTML=`<form class="toolbar" id="leave-type-search"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã hoặc tên loại nghỉ phép" aria-label="Tìm loại nghỉ phép"><button class="btn">Tìm kiếm</button>${leaveTypeGrant('canNew')?'<button type="button" class="btn primary" id="leave-type-create">Thêm loại nghỉ phép</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên loại nghỉ phép</th><th>Hưởng lương</th><th>Trừ số dư phép</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map((item,index)=>`<tr><td>${e(item.code)}</td><td>${e(item.name)}</td><td>${item.paid?'Có':'Không'}</td><td>${item.requiresBalance?'Có':'Không'}</td><td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-leave-type-edit="${index}">${leaveTypeGrant('canUpdate')?'Chỉnh sửa':'Chi tiết'}</button></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Không có loại nghỉ phép phù hợp.</p>'}<div class="toolbar user-pagination"><button type="button" class="btn" id="leave-type-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} loại nghỉ phép</span><button type="button" class="btn" id="leave-type-next" ${page*20>=result.total?'disabled':''}>Trang sau</button></div>`;
   const form=root.querySelector('#leave-type-search');form.onsubmit=event=>{event.preventDefault();event.stopPropagation();search=form.elements.search.value.trim();page=1;list();};
   root.querySelector('#leave-type-create')?.addEventListener('click',()=>edit());
   root.querySelectorAll('[data-leave-type-edit]').forEach(button=>button.onclick=()=>edit(result.data[Number(button.dataset.leaveTypeEdit)]));
   root.querySelector('#leave-type-prev').onclick=()=>{page--;list();};root.querySelector('#leave-type-next').onclick=()=>{page++;list();};
  }catch(err){if(current(id)){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=list;}}
 }
 function edit(item=null){
  if(busy||!leaveTypeGrant(item?'canView':'canNew'))return;
  const canSave=leaveTypeGrant(item?'canUpdate':'canNew');++generation;
  root.innerHTML=`<button type="button" class="btn" id="leave-type-back">← Danh sách loại nghỉ phép</button><h2 class="role-editor-title">${item?'Chi tiết':'Thêm'} loại nghỉ phép</h2><form id="leave-type-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Mã loại nghỉ phép','code','text',item?.code||'','required maxlength="30" pattern="[A-Z0-9][A-Z0-9_-]*"')}${field('Tên loại nghỉ phép','name','text',item?.name||'','required maxlength="100"')}</div><div class="role-toggles">${leaveTypeSwitch('paid','Hưởng lương',item?.paid??false)}${leaveTypeSwitch('requiresBalance','Trừ số dư phép',item?.requiresBalance??true)}${leaveTypeSwitch('isActive','Hoạt động',item?.isActive??true)}</div>${canSave?'<div class="form-actions"><button type="submit" class="btn primary">Lưu lại</button></div>':''}</fieldset><p id="leave-type-feedback" role="alert"></p></form>`;
  const form=root.querySelector('#leave-type-form'),fieldset=form.querySelector('fieldset'),feedback=root.querySelector('#leave-type-feedback');
  form.oninput=form.onchange=()=>{if(canSave)onDirty(true);};
  root.querySelector('#leave-type-back').onclick=()=>{if(!busy)list();};
  form.onsubmit=async event=>{
   event.preventDefault();event.stopPropagation();if(busy||!canSave)return;
   try{
    if(!leaveTypeGrant(item?'canUpdate':'canNew'))throw Error('Bạn không có quyền lưu loại nghỉ phép.');
    const payload=leaveTypePayload({code:form.elements.code.value,name:form.elements.name.value,paid:form.elements.paid.checked,requiresBalance:form.elements.requiresBalance.checked,isActive:form.elements.isActive.checked});
    busy=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu…';
    await apiSaveLeaveType(item?.id??null,payload);if(form.isConnected){onDirty(false);await list();}
   }catch(err){if(form.isConnected)feedback.textContent=err.message;}
   finally{busy=false;onSaving(false);if(form.isConnected)fieldset.disabled=!canSave;}
  };
 }
 await list();
}


// Source: pages/administration/master-data/contract-types.js

function contractTypeGrant(flag,session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_CONTRACT_TYPES'&&p.canView==='Y'&&p[flag]==='Y');
}
function contractTypePayload(values,creating=false){
 const name=String(values.name||'').trim(),description=String(values.description||'').trim()||null;
 if(!name||name.length>150)throw Error('Tên loại hợp đồng bắt buộc, tối đa 150 ký tự.');
 if(description&&description.length>500)throw Error('Mô tả tối đa 500 ký tự.');
 if(values.sortOrder===''||values.sortOrder===undefined)throw Error('Vui lòng nhập thứ tự hiển thị.');
 const sortOrder=Number(values.sortOrder);
 if(!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>2147483647)throw Error('Thứ tự hiển thị phải là số nguyên không âm.');
 if(typeof values.isActive!=='boolean')throw Error('Trạng thái không hợp lệ.');
 const payload={name,description,isActive:values.isActive,sortOrder};
 if(values.prefix!==undefined){
  const prefix=values.prefix===null?null:String(values.prefix).trim()||null;
  if(prefix!==null&&!/^[A-Z][A-Z0-9]{0,19}$/.test(prefix))throw Error('Prefix gồm 1–20 chữ hoa hoặc số, bắt đầu bằng chữ cái.');
  payload.prefix=prefix;
 }
 if(creating){const code=String(values.code||'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$/.test(code))throw Error('Mã tối đa 30 ký tự, bắt đầu bằng chữ/số, chỉ gồm chữ, số, dấu gạch dưới hoặc gạch ngang.');payload.code=code;}
 return payload;
}

async function mountContractTypes(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 if(!root)return;
 let page=1,search='',active='',generation=0,busy=false;
 const current=id=>root.isConnected&&generation===id;
 function failure(err,retry){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn" data-retry>Thử lại</button>`;root.querySelector('[data-retry]').onclick=retry;}
 async function list(){
  const id=++generation;onDirty(false);
  if(!contractTypeGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem loại hợp đồng.</p>';return;}
  root.innerHTML='<p role="status">Đang tải loại hợp đồng…</p>';
  try{
   const query=new URLSearchParams({page,pageSize:30,search});if(active!=='')query.set('isActive',active);
   const result=await apiContractTypes(query.toString());if(!current(id))return;
   if(!Array.isArray(result?.data))throw Error('Danh sách loại hợp đồng không hợp lệ.');
   root.innerHTML=`<form class="toolbar" id="contract-type-search"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã hoặc tên loại hợp đồng" aria-label="Tìm loại hợp đồng"><select name="active" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option><option value="true" ${active==='true'?'selected':''}>Hoạt động</option><option value="false" ${active==='false'?'selected':''}>Ngừng hoạt động</option></select><button class="btn">Tìm kiếm</button>${contractTypeGrant('canNew')?'<button type="button" class="btn primary" id="contract-type-create">Thêm loại hợp đồng</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên loại hợp đồng</th><th>Prefix</th><th>Mô tả</th><th>Thứ tự</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map((item,index)=>`<tr><td>${e(item.code)}</td><td>${e(item.name)}</td><td>${e(item.prefix||'—')}</td><td class="organization-description">${e(item.description||'—')}</td><td>${e(item.sortOrder)}</td><td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-contract-type-edit="${index}">${contractTypeGrant('canUpdate')?'Chỉnh sửa':'Chi tiết'}</button>${contractTypeGrant('canDelete')?` <button type="button" class="btn danger" data-contract-type-delete="${index}">Xóa</button>`:''}</td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Không có loại hợp đồng phù hợp.</p>'}<p id="contract-type-list-feedback" role="alert"></p><div class="toolbar user-pagination"><button type="button" class="btn" id="contract-type-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} loại hợp đồng</span><button type="button" class="btn" id="contract-type-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
   const form=root.querySelector('#contract-type-search');form.onsubmit=event=>{event.preventDefault();event.stopPropagation();if(busy)return;search=form.elements.search.value.trim();active=form.elements.active.value;page=1;list();};
   root.querySelector('#contract-type-create')?.addEventListener('click',()=>edit());
   root.querySelectorAll('[data-contract-type-edit]').forEach(button=>button.onclick=()=>{if(!busy)edit(result.data[Number(button.dataset.contractTypeEdit)].code);});
   root.querySelectorAll('[data-contract-type-delete]').forEach(button=>button.onclick=async()=>{
    if(busy||!contractTypeGrant('canDelete'))return;
    const item=result.data[Number(button.dataset.contractTypeDelete)];if(!confirm(`Xóa loại hợp đồng “${item.name}”?`))return;
    busy=true;onSaving(true);root.querySelectorAll('button,input,select').forEach(control=>control.disabled=true);
    try{await apiDeleteContractType(item.code);if(current(id)){if(result.data.length===1&&page>1)page--;await list();}}
    catch(err){if(current(id)){root.querySelector('#contract-type-list-feedback').textContent=err.message+(err.status===409?' Bạn có thể chỉnh sửa và chuyển sang ngừng hoạt động.':'');root.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);root.querySelector('#contract-type-prev').disabled=page<=1;root.querySelector('#contract-type-next').disabled=page*30>=result.total;}}
    finally{busy=false;onSaving(false);}
   });
   root.querySelector('#contract-type-prev').onclick=()=>{if(!busy){page--;list();}};root.querySelector('#contract-type-next').onclick=()=>{if(!busy){page++;list();}};
  }catch(err){if(current(id))failure(err,list);}
 }
 async function edit(code=null){
  if(busy||!contractTypeGrant(code===null?'canNew':'canView'))return;
  const id=++generation;root.innerHTML='<p role="status">Đang tải loại hợp đồng…</p>';
  try{
   const item=code===null?{isActive:true,sortOrder:0}:await apiContractType(code);if(!current(id))return;
   const canSave=contractTypeGrant(code===null?'canNew':'canUpdate');
   root.innerHTML=`<button type="button" class="btn" id="contract-type-back">← Danh sách loại hợp đồng</button><h2 class="role-editor-title">${code===null?'Thêm':'Chi tiết'} loại hợp đồng</h2><form id="contract-type-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Mã','code','text',item.code||'',code===null?'required maxlength="30" pattern="[A-Za-z0-9][A-Za-z0-9_-]*"':'readonly')}${field('Tên loại hợp đồng','name','text',item.name||'','required maxlength="150"')}${field('Prefix số hợp đồng','prefix','text',item.prefix||'','maxlength="20" pattern="[A-Z][A-Z0-9]{0,19}" placeholder="Ví dụ: HDLD"')}<label>Mô tả<textarea name="description" maxlength="500">${e(item.description||'')}</textarea></label>${field('Thứ tự hiển thị','sortOrder','number',item.sortOrder,'required min="0" max="2147483647" step="1"')}<label>Trạng thái<select name="isActive"><option value="true" ${item.isActive?'selected':''}>Hoạt động</option><option value="false" ${!item.isActive?'selected':''}>Ngừng hoạt động</option></select></label></div><p class="muted">Prefix dùng để cấp số cho hợp đồng mới; thay đổi không đổi số hợp đồng đã cấp.</p>${canSave?'<div class="form-actions"><button type="submit" class="btn primary">Lưu lại</button></div>':''}</fieldset><p id="contract-type-feedback" role="status"></p></form>`;
   const form=root.querySelector('#contract-type-form'),feedback=root.querySelector('#contract-type-feedback'),fieldset=form.querySelector('fieldset');
   form.oninput=form.onchange=()=>{if(canSave)onDirty(true);};root.querySelector('#contract-type-back').onclick=()=>{if(!busy)list();};
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(busy||!canSave)return;
    try{
     if(!contractTypeGrant(code===null?'canNew':'canUpdate'))throw Error('Bạn không có quyền lưu loại hợp đồng.');
     const values=Object.fromEntries(new FormData(form)),payload=contractTypePayload({...values,isActive:values.isActive==='true'},code===null);
     busy=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu…';
     await apiSaveContractType(code,payload);if(current(id)){onDirty(false);await list();}
    }catch(err){if(current(id))feedback.textContent=err.message;}
    finally{busy=false;onSaving(false);if(form.isConnected)fieldset.disabled=!canSave;}
   };
  }catch(err){if(current(id))failure(err,()=>edit(code));}
 }
 await list();
}


// Source: pages/administration/master-data/master-data.js

const organizationCatalogs={
 departments:{label:'Phòng ban',screen:'WEB_DEPARTMENTS',code:'departmentCode',name:'departmentName',max:20,description:true},
 positions:{label:'Chức vụ',screen:'WEB_POSITIONS',code:'code',name:'name',max:30},
 teams:{label:'Teams',screen:'WEB_TEAMS',code:'teamCode',name:'teamName',max:30,description:true}
};
function organizationGrant(kind,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===organizationCatalogs[kind].screen&&p.canView==='Y'&&p[flag]==='Y');}
function organizationPayload(kind,values,original=null){
 const config=organizationCatalogs[kind];
 const payload={[config.code]:values.code.trim(),[config.name]:values.name.trim(),isActive:values.isActive};
 if(config.description)payload.description=values.description.trim()||null;
 if(kind==='teams')payload.departmentId=original?original.departmentId:Number(values.departmentId);
 return payload;
}
async function mountOrganizationData(root,filters={},options={}){
 if(!root)return;
 let kind=organizationCatalogs[filters.tab]?filters.tab:Object.keys(organizationCatalogs).find(key=>organizationGrant(key,'canView'))||'departments',page=1,search='',active='',generation=0;
 const error=(err,retry)=>{if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="organization-retry">Thử lại</button>`;root.querySelector('#organization-retry').onclick=retry;};
 async function list(){
 const current=++generation,config=organizationCatalogs[kind];
 root.innerHTML='<p role="status">Đang tải danh mục…</p>';
 try{
 const canView=organizationGrant(kind,'canView');
 let result={data:[],total:0};
 if(canView){const query=new URLSearchParams({page,pageSize:30,search});if(active!=='')query.set('isActive',active);result=await apiOrganization(kind,null,null,query.toString());}
 if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách danh mục không hợp lệ.');
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Danh mục tổ chức">${Object.entries(organizationCatalogs).map(([key,item])=>`<button type="button" role="tab" aria-selected="${kind===key}" class="tab ${kind===key?'active':''}" data-org-tab="${key}">${item.label}</button>`).join('')}</div>${canView?`<form id="organization-search" class="toolbar"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã hoặc tên" aria-label="Tìm danh mục"><select name="active" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option><option value="true" ${active==='true'?'selected':''}>Hoạt động</option><option value="false" ${active==='false'?'selected':''}>Ngừng hoạt động</option></select><button class="btn">Tìm kiếm</button>${organizationGrant(kind,'canNew')?'<button type="button" class="btn primary" id="organization-create">Thêm mới</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên</th>${kind==='teams'?'<th>Phòng ban</th>':''}${config.description?'<th>Mô tả</th>':''}<th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map(item=>`<tr><td>${e(item[config.code])}</td><td>${e(item[config.name])}</td>${kind==='teams'?`<td>${e(item.departmentName||'—')}</td>`:''}${config.description?`<td class="organization-description">${e(item.description||'—')}</td>`:''}<td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-org-edit="${e(item.id)}" ${organizationGrant(kind,'canUpdate')?'':'disabled'}>Chỉnh sửa</button></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Không có dữ liệu phù hợp.</p>'}<div class="toolbar user-pagination"><button class="btn" id="organization-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} bản ghi</span><button class="btn" id="organization-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`:'<p>Bạn chưa có quyền xem danh mục này.</p>'}`;
 root.querySelector('[role=tablist]')?.remove();
 root.querySelectorAll('[data-org-tab]').forEach(button=>button.onclick=()=>{kind=button.dataset.orgTab;page=1;search='';active='';list();});
 root.querySelector('#organization-create')?.addEventListener('click',()=>edit());
 root.querySelectorAll('[data-org-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.orgEdit));
 const form=root.querySelector('#organization-search');if(form)form.onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=form.elements.search.value.trim();active=form.elements.active.value;page=1;list();};
 root.querySelector('#organization-prev')?.addEventListener('click',()=>{page--;list();});root.querySelector('#organization-next')?.addEventListener('click',()=>{page++;list();});
 }catch(err){if(current===generation)error(err,list);}
 }
 async function edit(id=null){
 if(!organizationGrant(kind,id===null?'canNew':'canUpdate'))return;
 const current=++generation,config=organizationCatalogs[kind];root.innerHTML='<p role="status">Đang tải thông tin…</p>';
 try{
 const item=id===null?null:await apiOrganization(kind,id);
 const departments=kind==='teams'&&id===null?await apiActiveDepartments():[];
 if(!root.isConnected||current!==generation)return;
 root.innerHTML=`<button type="button" class="btn" id="organization-back">← Danh sách</button><h2 class="role-editor-title">${id===null?'Thêm':'Chỉnh sửa'} ${config.label}</h2><form id="organization-edit" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Mã','code','text',item?.[config.code]||'',`required maxlength="${config.max}" ${kind==='teams'?'pattern="[A-Za-z0-9][A-Za-z0-9_-]*"':''}`)}${field('Tên','name','text',item?.[config.name]||'','required maxlength="150"')}${kind==='teams'?(item?`${field('Phòng ban','departmentName','text',item.departmentName||String(item.departmentId),'readonly')}<p class="muted">Phòng ban của team không thể thay đổi sau khi tạo.</p>`:`<label>Phòng ban<select name="departmentId" required><option value="">Chọn phòng ban</option>${departments.map(dep=>`<option value="${e(dep.id)}">${e(dep.departmentName)}</option>`).join('')}</select></label>`):''}${config.description?`<label>Mô tả<textarea name="description" maxlength="500">${e(item?.description||'')}</textarea></label>`:''}<label>Trạng thái<select name="isActive"><option value="true" ${item?.isActive!==false?'selected':''}>Hoạt động</option><option value="false" ${item?.isActive===false?'selected':''}>Ngừng hoạt động</option></select></label></div><div class="form-actions"><button type="submit" class="btn primary">Lưu lại</button></div></fieldset><p id="organization-feedback" role="status"></p></form>`;
 const form=root.querySelector('#organization-edit'),feedback=root.querySelector('#organization-feedback');let saving=false;
 form.oninput=form.onchange=()=>options.onDirty?.(true);
 root.querySelector('#organization-back').onclick=()=>{if(!saving){options.onDirty?.(false);list();}};
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving)return;
 const data=new FormData(form),values={code:data.get('code'),name:data.get('name'),description:data.get('description')||'',isActive:data.get('isActive')==='true',departmentId:data.get('departmentId')};
 if(!values.code.trim()||!values.name.trim()){feedback.textContent='Mã và tên không được để trống.';return;}
 const payload=organizationPayload(kind,values,item);
 if(kind==='teams'&&!item&&!departments.some(dep=>dep.id===payload.departmentId)){feedback.textContent='Vui lòng chọn phòng ban đang hoạt động.';return;}
 saving=true;options.onSaving?.(true);form.querySelector('fieldset').disabled=true;feedback.textContent='Đang lưu…';
 try{await apiOrganization(kind,id,payload);if(!form.isConnected)return;options.onDirty?.(false);await list();}
 catch(err){if(form.isConnected)feedback.textContent=err.message;}
 finally{saving=false;options.onSaving?.(false);if(form.isConnected)form.querySelector('fieldset').disabled=false;}
 };
 }catch(err){if(current===generation)error(err,()=>edit(id));}
 }
 await list();
}

const masterDataTabs={departments:'Phòng ban',positions:'Chức vụ',teams:'Teams',contractTypes:'Loại hợp đồng',leaveTypes:'Loại nghỉ phép',shifts:'Ca làm việc'};
async function mountMasterData(root,filters={}){
 if(!root)return;
 const screens={departments:'WEB_DEPARTMENTS',positions:'WEB_POSITIONS',teams:'WEB_TEAMS',contractTypes:'WEB_CONTRACT_TYPES',leaveTypes:'WEB_LEAVE_TYPES',shifts:'WEB_SHIFTS'};
 let tab=masterDataTabs[filters.tab]?filters.tab:Object.keys(masterDataTabs).find(key=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===screens[key]&&p.canView==='Y'))||'departments',dirty=false,saving=false;
 async function draw(){
 dirty=false;
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Master Data">${Object.entries(masterDataTabs).map(([key,label])=>`<button type="button" role="tab" aria-selected="${key===tab}" class="tab ${key===tab?'active':''}" data-master-tab="${key}">${label}</button>`).join('')}</div><div id="master-data-panel" role="tabpanel"></div>`;
 root.querySelectorAll('[data-master-tab]').forEach(button=>button.onclick=()=>{if(saving||button.dataset.masterTab===tab)return;if(dirty&&!confirm('Bỏ các thay đổi chưa lưu?'))return;tab=button.dataset.masterTab;draw();});
 const panel=root.querySelector('#master-data-panel'),options={onDirty:value=>{if(panel.isConnected)dirty=value;},onSaving:value=>{if(!panel.isConnected)return;saving=value;root.querySelectorAll('[data-master-tab]').forEach(button=>button.disabled=value);}};
 if(tab==='leaveTypes')await mountLeaveTypes(panel,options);
 else if(tab==='contractTypes')await mountContractTypes(panel,options);
 else if(tab==='shifts')await mountShifts(panel,options);
 else await mountOrganizationData(panel,{tab},options);
 }
 await draw();
}


function shiftGrant(flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_SHIFTS'&&p.canView==='Y'&&p[flag]==='Y');}
function validateShift(payload){
 if(!payload.code.trim()||payload.code.length>30)throw Error('Mã ca bắt buộc và tối đa 30 ký tự.');
 if(!payload.name.trim()||payload.name.length>100)throw Error('Tên ca bắt buộc và tối đa 100 ký tự.');
 const seconds=value=>{const match=/^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);if(!match||Number(match[1])>23||Number(match[2])>59||Number(match[3]||0)>59)throw Error('Giờ ca không hợp lệ.');return Number(match[1])*3600+Number(match[2])*60+Number(match[3]||0);};
 const start=seconds(payload.startTime),end=seconds(payload.endTime);
 if(start===end)throw Error('Giờ bắt đầu và kết thúc không được trùng nhau.');
 const duration=((end-start+86400)%86400)/60;
 if(!Number.isInteger(payload.breakMinutes)||payload.breakMinutes<0||payload.breakMinutes>=duration)throw Error('Phút nghỉ phải không âm và nhỏ hơn thời lượng ca.');
 if(payload.lateGraceMinutes!==null&&(!Number.isInteger(payload.lateGraceMinutes)||payload.lateGraceMinutes<0||payload.lateGraceMinutes>240||payload.lateGraceMinutes>=duration))throw Error('Phút cho phép đi trễ phải từ 0 đến 240 và nhỏ hơn thời lượng ca.');
 return payload;
}
async function mountShifts(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 let page=1,search='',generation=0;
 const showError=(err,retry)=>{if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="shift-retry">Thử lại</button>`;root.querySelector('#shift-retry').onclick=retry;};
 async function list(){
 const current=++generation;onDirty(false);root.innerHTML='<p role="status">Đang tải ca làm việc…</p>';
 try{
 if(!shiftGrant('canView'))throw Error('Bạn chưa có quyền WEB_SHIFTS/VIEW để xem ca làm việc.');
 const result=await apiShifts(page,search);if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách ca không hợp lệ.');
 root.innerHTML=`<form class="toolbar" id="shift-search"><input name="search" value="${e(search)}" maxlength="150" placeholder="Tìm mã hoặc tên ca" aria-label="Tìm ca làm việc"><button class="btn">Tìm kiếm</button>${shiftGrant('canNew')?'<button type="button" id="shift-create" class="btn primary">Thêm ca làm việc</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã ca</th><th>Tên ca</th><th>Bắt đầu</th><th>Kết thúc</th><th>Nghỉ (phút)</th><th>Đi trễ cho phép (phút)</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map(item=>`<tr><td>${e(item.code)}</td><td>${e(item.name)}</td><td>${e(item.startTime)}</td><td>${e(item.endTime)}${item.endTime<item.startTime?' <span class="tag">Qua đêm</span>':''}</td><td>${e(item.breakMinutes)}</td><td>${e(item.lateGraceMinutes??'Mặc định')}</td><td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-shift-edit="${e(item.id)}">${shiftGrant('canUpdate')?'Chỉnh sửa':'Chi tiết'}</button></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Chưa có ca phù hợp.</p>'}<div class="toolbar user-pagination"><button class="btn" id="shift-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} ca</span><button class="btn" id="shift-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
 const form=root.querySelector('#shift-search');form.onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=form.elements.search.value.trim();page=1;list();};
 root.querySelector('#shift-create')?.addEventListener('click',()=>edit());
 root.querySelectorAll('[data-shift-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.shiftEdit));
 root.querySelector('#shift-prev').onclick=()=>{page--;list();};root.querySelector('#shift-next').onclick=()=>{page++;list();};
 }catch(err){if(current===generation)showError(err,list);}
 }
 async function edit(id=null){
 const current=++generation;root.innerHTML='<p role="status">Đang tải thông tin ca…</p>';
 try{
 const item=id===null?{}:await apiShiftDetail(id);if(!root.isConnected||current!==generation)return;
 const canSave=shiftGrant(id===null?'canNew':'canUpdate');let saving=false,dirty=false;
 root.innerHTML=`<button type="button" class="btn" id="shift-back">← Danh sách ca</button><h2 class="role-editor-title">${id===null?'Thêm':'Chi tiết'} ca làm việc</h2><form id="shift-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Mã ca','code','text',item.code||'','required maxlength="30"')}${field('Tên ca','name','text',item.name||'','required maxlength="100"')}${field('Giờ bắt đầu','startTime','time',item.startTime||'','required step="1"')}${field('Giờ kết thúc','endTime','time',item.endTime||'','required step="1"')}${field('Nghỉ giữa ca (phút)','breakMinutes','number',item.breakMinutes??0,'required min="0" max="1439" step="1"')}${field('Cho phép đi trễ (phút)','lateGraceMinutes','number',item.lateGraceMinutes??'','min="0" max="240" step="1" placeholder="Dùng mặc định cấu hình chấm công"')}<label>Trạng thái<select name="isActive"><option value="true" ${item.isActive!==false?'selected':''}>Hoạt động</option><option value="false" ${item.isActive===false?'selected':''}>Ngừng hoạt động</option></select></label></div><p class="muted">Để trống phút đi trễ để lấy mặc định từ cấu hình chấm công. Ca qua đêm cần được bật trong cấu hình. Sửa ca không thay đổi lịch làm việc đã tạo.</p><div class="form-actions"><button type="submit" class="btn primary">Lưu ca làm việc</button></div></fieldset><p id="shift-feedback" role="status"></p></form>`;
 const form=root.querySelector('#shift-form'),fieldset=form.querySelector('fieldset'),feedback=root.querySelector('#shift-feedback');
 form.oninput=form.onchange=()=>{dirty=true;onDirty(true);};
 root.querySelector('#shift-back').onclick=()=>{if(!saving&&(!dirty||confirm('Bỏ thay đổi ca chưa lưu?')))list();};
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving||!canSave)return;
 const data=new FormData(form),normalizeTime=value=>value.length===5?value+':00':value;
 const payload={code:data.get('code').trim().toUpperCase(),name:data.get('name').trim(),startTime:normalizeTime(data.get('startTime')),endTime:normalizeTime(data.get('endTime')),breakMinutes:Number(data.get('breakMinutes')),lateGraceMinutes:data.get('lateGraceMinutes')===''?null:Number(data.get('lateGraceMinutes')),isActive:data.get('isActive')==='true'};
 try{validateShift(payload);}catch(err){feedback.textContent=err.message;return;}
 saving=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu ca…';
 try{await apiSaveShift(id,payload,item.version);if(form.isConnected){onDirty(false);await list();}}
 catch(err){if(form.isConnected)feedback.textContent=err.message+' Nếu phiên bản đã thay đổi, hãy mở lại ca trước khi lưu.';}
 finally{saving=false;onSaving(false);if(form.isConnected)fieldset.disabled=!canSave;}
 };
 }catch(err){if(current===generation)showError(err,()=>edit(id));}
 }
 await list();
}


// Source: pages/human-resources/employees.js

const employeeStatuses={ACTIVE:'Đang làm việc',INACTIVE:'Ngừng hoạt động',TERMINATED:'Đã nghỉ việc'};
const employeeValue=value=>e(value||'—');
function employeeCanUpdate(session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_EMPLOYEES'&&p.canUpdate==='Y');
}

function employeeRoleSwitch(kind,employee={},grant){
 const department=kind==='department',name=department?'isDepartmentManager':'isTeamLead',code=department?'WEB_DEPARTMENTS':'WEB_TEAMS';
 return `<label class="employee-inline-role"><span>${department?'Quản lý phòng ban':'Team Lead'}</span><span class="role-switch"><input type="checkbox" role="switch" name="${name}" ${employee[name]?'checked':''} ${grant(code,'canUpdate')&&(department||employee.teamId)?'':'disabled'}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;
}
function employeeRolePayload(values){
 const flags={};
 for(const key of ['isDepartmentManager','isTeamLead']){
  if(values[key]===undefined||values[key]===null)continue;
  if(typeof values[key]!=='boolean')throw Error('Vai trò quản lý phải là giá trị boolean.');
  flags[key]=values[key];
 }
 if(flags.isTeamLead===true&&!values.teamId)throw Error('Vui lòng chọn team trước khi bổ nhiệm Team Lead.');
 return flags;
}
function employeeFormRoles(form,grant){
 const result={};
 for(const [key,code] of [['isDepartmentManager','WEB_DEPARTMENTS'],['isTeamLead','WEB_TEAMS']]){
  const input=form.elements[key];
  if(!input.disabled){if(!grant(code,'canUpdate'))throw Error('Bạn không có quyền thay đổi vai trò quản lý này.');result[key]=input.checked;}
 }
 return result;
}

function employeeListRows(items){
 return items.map(employee=>`<tr><td><strong>${e(employee.fullName)}</strong><div class="person-sub">${e(employee.employeeCode)}</div></td><td>${employeeValue(employee.positionName)}</td><td>${employeeValue(employee.departmentName)}</td><td>${employeeValue(employee.teamName)}</td><td><span class="badge ${employee.employmentStatus==='ACTIVE'?'active':''}">${e(employeeStatuses[employee.employmentStatus]||employee.employmentStatus)}</span></td><td><a class="btn small" href="#/hr/employees/${encodeURIComponent(employee.id)}">Hồ sơ</a></td></tr>`).join('');
}
async function mountEmployees(root,filters={},employeeId=null){
 if(!root)return;
 let page=Number(filters.page)||1,search=filters.search||'',status='',generation=0;
 async function load(){
 const current=++generation;root.innerHTML='<p role="status">Đang tải nhân viên…</p>';
 try{
 if(employeeId!==null){
 const employee=await apiEmployeeDetail(employeeId);if(!root.isConnected||current!==generation)return;
 root.innerHTML=`<a class="btn" href="#/hr/employees">← Danh sách nhân viên</a><h2 class="role-editor-title">${e(employee.fullName)}</h2>${details([['Mã nhân viên',employeeValue(employee.employeeCode)],['Chức danh',employeeValue(employee.positionName)],['Phòng ban',employeeValue(employee.departmentName)+(employee.isDepartmentManager?' (Quản lý)':'')],['Team',employeeValue(employee.teamName)+(employee.isTeamLead?' (Quản lý)':'')],['Trạng thái',employeeValue(employeeStatuses[employee.employmentStatus]||employee.employmentStatus)],['Email',employeeValue(employee.email)],['Số điện thoại',employeeValue(employee.phoneNumber)],['Ngày sinh',employee.dateOfBirth?dateLabel(employee.dateOfBirth):'—'],['Ngày vào làm',employee.hireDate?dateLabel(employee.hireDate):'—']])}${employeeCanUpdate()?'<button type="button" class="btn primary" id="employee-profile-edit">Chỉnh sửa</button>':''}`;
 root.querySelector('#employee-profile-edit')?.addEventListener('click',()=>editEmployeeProfile(root,employee,load));
 return;
 }
 const query=new URLSearchParams({page,pageSize:30,search});if(status)query.set('employmentStatus',status);
 const result=await apiEmployees(query.toString());if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
 root.innerHTML=`<form id="employee-api-search" class="toolbar"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã, tên hoặc email nhân viên" aria-label="Tìm nhân viên"><select name="status" aria-label="Trạng thái nhân viên"><option value="">Tất cả trạng thái</option>${Object.entries(employeeStatuses).map(([value,label])=>`<option value="${value}" ${value===status?'selected':''}>${label}</option>`).join('')}</select><button class="btn">Tìm kiếm</button></form><div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Chức danh</th><th>Phòng ban</th><th>Team</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${employeeListRows(result.data)}</tbody></table></div>${result.data.length?'':'<p>Không có nhân viên phù hợp.</p>'}<div class="toolbar user-pagination"><button class="btn" id="employee-api-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} nhân viên</span><button class="btn" id="employee-api-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
 root.querySelector('#employee-api-search').onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=ev.currentTarget.elements.search.value.trim();status=ev.currentTarget.elements.status.value;page=1;load();};
 root.querySelector('#employee-api-prev').onclick=()=>{page--;load();};root.querySelector('#employee-api-next').onclick=()=>{page++;load();};
 }catch(err){if(!root.isConnected||current!==generation)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="employee-api-retry">Thử lại</button>`;root.querySelector('#employee-api-retry').onclick=load;}
 }
 await load();
}


function employeeCreationPayload(values){
 const fullName=String(values.fullName||'').trim(),email=String(values.email||'').trim(),phoneNumber=String(values.phoneNumber||'').trim()||null;
 if(!fullName||fullName.length>150)throw Error('Họ và tên bắt buộc, tối đa 150 ký tự.');
 if(!email||email.length>255||!/^\S+@\S+\.\S+$/.test(email))throw Error('Email không hợp lệ.');
 if(phoneNumber&&phoneNumber.length>20)throw Error('Số điện thoại tối đa 20 ký tự.');
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 const hireDate=values.hireDate,dateOfBirth=values.dateOfBirth||null;
 if(!validDate(hireDate))throw Error('Ngày vào làm không hợp lệ.');
 if(dateOfBirth&&(!validDate(dateOfBirth)||dateOfBirth>hireDate||dateOfBirth>new Date().toISOString().slice(0,10)))throw Error('Ngày sinh phải hợp lệ, không sau ngày vào làm hoặc trong tương lai.');
 const positiveId=(value,required=false)=>{if(!value&&!required)return null;const id=Number(value);if(!Number.isSafeInteger(id)||id<=0)throw Error('Vui lòng chọn danh mục hợp lệ.');return id;};
 if(!Object.hasOwn(employeeStatuses,values.employmentStatus))throw Error('Trạng thái nhân viên không hợp lệ.');
 return {fullName,email,phoneNumber,dateOfBirth,hireDate,departmentId:positiveId(values.departmentId,true),teamId:positiveId(values.teamId),positionId:positiveId(values.positionId),employmentStatus:values.employmentStatus,...employeeRolePayload(values)};
}

function openEmployeeCreation({openDialog,closeDialog,toast,render}){
 const grant=(code,flag='canView')=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');
 if(!grant('WEB_EMPLOYEES','canNew'))throw Error('Bạn không có quyền thêm nhân viên.');
 openDialog('Thêm nhân viên',`<form id="employee-create-api" class="user-registration"><p class="muted">Mã nhân viên sẽ được hệ thống tự động tạo.</p><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Họ và tên','fullName','text','','required maxlength="150"')}${field('Email','email','email','','required maxlength="255"')}${field('Số điện thoại','phoneNumber','tel','','maxlength="20"')}${field('Ngày sinh','dateOfBirth','date','')}${field('Ngày vào làm','hireDate','date','','required')}<div class="employee-assignment-field"><label>Phòng ban<select name="departmentId" required disabled><option value="">Đang tải phòng ban…</option></select></label>${employeeRoleSwitch('department',{},grant)}</div><label>Chức danh (tùy chọn)<select name="positionId" disabled><option value="">Chưa chọn chức danh</option></select></label><div class="employee-assignment-field"><label>Team (tùy chọn)<select name="teamId" disabled><option value="">Chọn phòng ban trước</option></select></label>${employeeRoleSwitch('team',{},grant)}</div><label>Trạng thái<select name="employmentStatus">${Object.entries(employeeStatuses).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div><div id="employee-catalog-feedback"></div><div class="form-actions"><button type="button" class="btn" id="employee-create-cancel">Hủy</button><button type="submit" class="btn primary" id="employee-create-submit" disabled>Thêm nhân viên</button></div></fieldset><p id="employee-create-feedback" role="alert"></p></form>`);
 const form=document.getElementById('employee-create-api'),feedback=form.querySelector('#employee-create-feedback'),catalogFeedback=form.querySelector('#employee-catalog-feedback'),submit=form.querySelector('#employee-create-submit'),fieldset=form.querySelector('fieldset');
 let busy=false,departmentReady=false,teamGeneration=0,departments=[],positions=[],teams=[];
 const current=()=>form.isConnected&&document.getElementById('employee-create-api')===form;
 const options=(select,items,name,placeholder)=>{select.innerHTML=`<option value="">${placeholder}</option>`+items.map(item=>`<option value="${e(item.id)}">${e(item[name])}</option>`).join('');select.disabled=false;};
 const catalogError=(key,message,retry)=>{let panel=form.querySelector(`[data-catalog-error="${key}"]`);if(!panel){panel=document.createElement('p');panel.dataset.catalogError=key;catalogFeedback.append(panel);}panel.innerHTML=`<span role="status">${e(message)}</span>${retry?' <button type="button" class="btn">Thử lại</button>':''}`;if(retry)panel.querySelector('button').onclick=()=>{panel.remove();retry();};};
 async function loadDepartments(){
  if(!grant('WEB_DEPARTMENTS')){form.elements.departmentId.innerHTML='<option value="">Không có quyền xem phòng ban</option>';catalogError('department','Bạn cần quyền xem phòng ban để chọn phòng ban khi tạo nhân viên.');return;}
  try{const items=await apiActiveDepartments();if(!current())return;departments=items;options(form.elements.departmentId,items,'departmentName','Chọn phòng ban');departmentReady=items.length>0;submit.disabled=!departmentReady;if(!items.length)catalogError('department','Chưa có phòng ban hoạt động.');}
  catch(err){if(current())catalogError('department',err.message,loadDepartments);}
 }
 async function loadPositions(){
  if(!grant('WEB_POSITIONS')){catalogError('position','Bạn chưa có quyền xem chức danh; nhân viên sẽ được tạo chưa có chức danh.');return;}
  try{const items=await apiActivePositions();if(current()){positions=items;options(form.elements.positionId,items,'name','Chưa chọn chức danh');}}
  catch(err){if(current())catalogError('position',err.message,loadPositions);}
 }
 async function loadTeams(){
  const generation=++teamGeneration,departmentId=form.elements.departmentId.value,select=form.elements.teamId;
  teams=[];form.elements.isTeamLead.checked=false;form.elements.isTeamLead.disabled=true;select.disabled=true;select.innerHTML='<option value="">Chưa chọn team</option>';form.querySelector('[data-catalog-error="team"]')?.remove();
  if(!departmentId)return;
  if(!grant('WEB_TEAMS')){catalogError('team','Bạn chưa có quyền xem team; nhân viên sẽ được tạo chưa có team.');return;}
  select.innerHTML='<option value="">Đang tải team…</option>';
  try{const items=await apiActiveTeams(departmentId);if(current()&&generation===teamGeneration){teams=items;options(select,items,'teamName','Chưa chọn team');}}
  catch(err){if(current()&&generation===teamGeneration){select.innerHTML='<option value="">Chưa chọn team</option>';catalogError('team',err.message,loadTeams);}}
 }
 form.elements.departmentId.onchange=()=>{loadTeams();};
 form.elements.teamId.onchange=()=>{form.elements.isTeamLead.checked=false;form.elements.isTeamLead.disabled=!form.elements.teamId.value||!grant('WEB_TEAMS','canUpdate');};
 form.querySelector('#employee-create-cancel').onclick=()=>{if(!busy)closeDialog();};
 form.onsubmit=async event=>{
  event.preventDefault();event.stopPropagation();if(busy)return;
  feedback.textContent='';
  try{
   if(!grant('WEB_EMPLOYEES','canNew'))throw Error('Bạn không có quyền thêm nhân viên.');
   if(!departmentReady)throw Error('Vui lòng tải và chọn phòng ban.');
   const payload=employeeCreationPayload({...Object.fromEntries(new FormData(form)),...employeeFormRoles(form,grant)});
   if(!departments.some(item=>Number(item.id)===payload.departmentId)||payload.positionId&&!positions.some(item=>Number(item.id)===payload.positionId)||payload.teamId&&!teams.some(item=>Number(item.id)===payload.teamId&&Number(item.departmentId)===payload.departmentId))throw Error('Danh mục đã chọn không hợp lệ. Vui lòng chọn lại.');
   busy=true;fieldset.disabled=true;submit.textContent='Đang tạo…';
   const employee=await apiCreateEmployee(payload);
   if(current()){closeDialog();if(globalThis.location?.hash?.split('?')[0]==='#/hr/employees')render();}
   toast(`Đã thêm nhân viên · ${employee.employeeCode}`);
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{busy=false;if(current()){fieldset.disabled=false;submit.disabled=!departmentReady;submit.textContent='Thêm nhân viên';}}
 };
 loadDepartments();loadPositions();
}


function employeeUpdatePayload(values,employee){
 const validated=employeeCreationPayload({...values,teamId:values.teamId===undefined?employee.teamId:values.teamId,positionId:values.positionId===undefined?employee.positionId:values.positionId,hireDate:employee.hireDate?.slice(0,10),departmentId:employee.departmentId});
 const {hireDate,departmentId,...payload}=validated;
 if(values.teamId===undefined)delete payload.teamId;
 return payload;
}

async function editEmployeeProfile(root,employee,onBack,draft={}){
 if(!employeeCanUpdate())return;
 const grant=(code,flag='canView')=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');
 root.innerHTML=`<h2 class="role-editor-title">Chỉnh sửa hồ sơ nhân viên</h2><p class="muted">${e(employee.employeeCode)} · ${e(employee.departmentName||'—')} · Ngày vào làm: ${employee.hireDate?dateLabel(employee.hireDate):'—'}</p><form id="employee-profile-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Họ và tên','fullName','text',employee.fullName||'','required maxlength="150"')}${field('Email','email','email',employee.email||'','required maxlength="255"')}${field('Số điện thoại','phoneNumber','tel',employee.phoneNumber||'','maxlength="20"')}${field('Ngày sinh','dateOfBirth','date',employee.dateOfBirth?.slice(0,10)||'')}<div class="employee-assignment-field"><label>Phòng ban<select name="departmentId" disabled><option value="${e(employee.departmentId)}">${e(employee.departmentName||'—')}</option></select></label>${employeeRoleSwitch('department',employee,grant)}</div><label>Chức danh<select name="positionId" disabled><option value="${e(employee.positionId||'')}">${e(employee.positionName||'Chưa có chức danh')}</option></select></label><div class="employee-assignment-field"><label>Team<select name="teamId" disabled><option value="${e(employee.teamId||'')}">${e(employee.teamName||'Chưa có team')}</option></select></label>${employeeRoleSwitch('team',employee,grant)}</div><label>Trạng thái<select name="employmentStatus">${Object.entries(employeeStatuses).map(([value,label])=>`<option value="${value}" ${value===employee.employmentStatus?'selected':''}>${label}</option>`).join('')}</select></label></div><section id="employee-transfer-section" hidden><p class="muted">Chuyển nhân viên sang phòng ban và team đã chọn trước khi lưu hồ sơ hoặc bổ nhiệm quản lý. Cần quyền chuyển phòng trong phạm vi ALL.</p><div class="form-grid">${field('Ngày hiệu lực chuyển phòng','effectiveDate','date',new Date().toISOString().slice(0,10),`min="${e(employee.hireDate?.slice(0,10)||'')}" max="${new Date().toISOString().slice(0,10)}"`)}<label>Lý do chuyển phòng<textarea name="transferReason" maxlength="500"></textarea></label></div><button type="button" class="btn" id="employee-transfer-submit">Áp dụng chuyển phòng</button></section><div id="employee-edit-catalog-feedback"></div><div class="form-actions"><button type="button" class="btn" id="employee-edit-cancel">Hủy</button><button type="submit" class="btn primary">Lưu thay đổi</button></div></fieldset><p id="employee-edit-feedback" role="alert"></p></form>`;
 const form=root.querySelector('#employee-profile-form'),fieldset=form.querySelector('fieldset'),feedback=form.querySelector('#employee-edit-feedback'),catalogFeedback=form.querySelector('#employee-edit-catalog-feedback');
 const current=()=>root.isConnected&&root.querySelector('#employee-profile-form')===form;
 let saving=false,teamRequest=0;
 for(const key of ['fullName','email','phoneNumber','dateOfBirth','employmentStatus'])if(draft[key]!==undefined)form.elements[key].value=draft[key];
 const changedDepartment=()=>String(form.elements.departmentId.value)!==String(employee.departmentId);
 const syncSelection=()=>{
  const changed=changedDepartment();
  form.querySelector('#employee-transfer-section').hidden=!changed;
  form.querySelector('[type="submit"]').disabled=changed;
  form.elements.isDepartmentManager.disabled=changed||!grant('WEB_DEPARTMENTS','canUpdate');
  form.elements.isTeamLead.disabled=changed||!form.elements.teamId.value||!grant('WEB_TEAMS','canUpdate');
 };
 async function catalog(name,code,fetchItems,label){
  if(!grant(code))return;
  try{
   const selectedDepartment=form.elements.departmentId.value;
   const items=await fetchItems();if(!current()||name==='teamId'&&String(form.elements.departmentId.value)!==String(selectedDepartment))return;
   const id=employee[name],title=name==='departmentId'?employee.departmentName:name==='teamId'?employee.teamName:employee.positionName,select=form.elements[name];
   const available=[...items];if(id&&!available.some(item=>String(item.id)===String(id)))available.unshift({id,[label]:title||String(id)});
   select.innerHTML='<option value="">Chưa chọn</option>'+available.map(item=>`<option value="${e(item.id)}" ${String(item.id)===String(id)?'selected':''}>${e(item[label])}</option>`).join('');select.disabled=false;syncSelection();
  }catch(err){if(current()){const message=document.createElement('p');message.setAttribute('role','status');message.textContent=`${err.message}. Giữ nguyên ${name==='teamId'?'team':'chức danh'} hiện tại. `;const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Thử lại';retry.onclick=()=>{message.remove();catalog(name,code,fetchItems,label);};message.append(retry);catalogFeedback.append(message);}}
 }
 async function loadSelectedTeams(){
  const request=++teamRequest,departmentId=form.elements.departmentId.value,select=form.elements.teamId;
  select.disabled=true;select.innerHTML='<option value="">Chưa chọn team</option>';
  form.elements.isTeamLead.checked=false;syncSelection();
  if(!departmentId||!grant('WEB_TEAMS'))return;
  try{
   const items=await apiActiveTeams(departmentId);if(!current()||request!==teamRequest)return;
   const available=[...items];
   if(!changedDepartment()&&employee.teamId&&!available.some(item=>String(item.id)===String(employee.teamId)))available.unshift({id:employee.teamId,teamName:employee.teamName||String(employee.teamId)});
   select.innerHTML='<option value="">Chưa chọn team</option>'+available.map(item=>`<option value="${e(item.id)}" ${!changedDepartment()&&String(item.id)===String(employee.teamId)?'selected':''}>${e(item.teamName)}</option>`).join('');select.disabled=false;
   if(!changedDepartment())form.elements.isTeamLead.checked=!!employee.isTeamLead;
   syncSelection();
  }catch(err){if(current()&&request===teamRequest){feedback.textContent=err.message;}}
 }
 form.elements.departmentId.onchange=()=>{
  form.elements.isDepartmentManager.checked=changedDepartment()?false:!!employee.isDepartmentManager;
  loadSelectedTeams();
 };
 form.elements.teamId.onchange=()=>{if(!form.elements.teamId.value)form.elements.isTeamLead.checked=false;syncSelection();};
 form.querySelector('#employee-transfer-submit').onclick=async()=>{
  if(saving||!changedDepartment())return;
  feedback.textContent='';
  try{
   if(!employeeCanUpdate())throw Error('Bạn không có quyền chuyển phòng ban.');
   const values=Object.fromEntries(new FormData(form));
   const payload=employeeTransferPayload(values,employee);
   saving=true;fieldset.disabled=true;
   const transferred=await apiTransferEmployeeDepartment(employee.id,payload);
   if(current()){
    await editEmployeeProfile(root,transferred,onBack,values);
    const note=root.querySelector('#employee-edit-feedback');if(note)note.textContent='Đã chuyển phòng ban. Bạn có thể tiếp tục chỉnh sửa và bổ nhiệm quản lý.';
   }
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{saving=false;if(current()){fieldset.disabled=false;syncSelection();}}
 };
 syncSelection();
 form.querySelector('#employee-edit-cancel').onclick=()=>{if(!saving)onBack();};
 form.onsubmit=async event=>{
  event.preventDefault();event.stopPropagation();if(saving)return;
  feedback.textContent='';
  try{
   if(!employeeCanUpdate())throw Error('Bạn không có quyền chỉnh sửa hồ sơ nhân viên.');
   if(changedDepartment())throw Error('Vui lòng áp dụng chuyển phòng trước khi lưu hồ sơ.');
   const values={...Object.fromEntries(new FormData(form)),...employeeFormRoles(form,grant)};
   if(form.elements.positionId.disabled)values.positionId=employee.positionId??'';
   if(form.elements.teamId.disabled)values.teamId=employee.teamId??'';
   if(employee.isTeamLead&&!values.teamId&&grant('WEB_TEAMS','canUpdate'))values.isTeamLead=false;
   const payload=employeeUpdatePayload(values,employee);
   saving=true;fieldset.disabled=true;
   await apiUpdateEmployee(employee.id,payload);
   if(current())await onBack();
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{saving=false;if(current())fieldset.disabled=false;}
 };
 await Promise.allSettled([catalog('departmentId','WEB_DEPARTMENTS',apiActiveDepartments,'departmentName'),catalog('positionId','WEB_POSITIONS',apiActivePositions,'name'),catalog('teamId','WEB_TEAMS',()=>apiActiveTeams(employee.departmentId),'teamName')]);
}

function employeeTransferPayload(values,employee){
 const departmentId=Number(values.departmentId),teamId=values.teamId?Number(values.teamId):null;
 if(!Number.isSafeInteger(departmentId)||departmentId<=0||departmentId===Number(employee.departmentId))throw Error('Vui lòng chọn phòng ban đích khác phòng ban hiện tại.');
 if(teamId!==null&&(!Number.isSafeInteger(teamId)||teamId<=0))throw Error('Team không hợp lệ.');
 const effectiveDate=values.effectiveDate,today=new Date().toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)||Number.isNaN(Date.parse(effectiveDate))||new Date(effectiveDate).toISOString().slice(0,10)!==effectiveDate||effectiveDate<employee.hireDate?.slice(0,10)||effectiveDate>today)throw Error('Ngày chuyển phòng phải hợp lệ, từ ngày vào làm đến hôm nay.');
 return {departmentId,teamId,effectiveDate,reason:String(values.transferReason||'').trim()||null};
}


// Source: pages/administration/roles.js

const requestScopeScreens=['WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS'];
const roleUsesEmployeeScope=code=>['WEB_SALARY_CONFIGURATION','WEB_PAYROLL','WEB_KPI_CONFIGURATION','WEB_KPI_EVALUATION','WEB_ATTENDANCE','WEB_WORK_SCHEDULES','WEB_EMPLOYEES','WEB_CONTRACTS','WEB_APPROVALS','WEB_LEAVE_BALANCES','WEB_LEAVE_MANAGEMENT',...requestScopeScreens].includes(code);
const roleHasScopeAction=(code,flag)=>code==='WEB_SALARY_CONFIGURATION'?['VIEW','NEW','UPDATE'].includes(flag):code==='WEB_PAYROLL'?['VIEW','NEW','UPDATE','APPROVE','EXPORT'].includes(flag):code==='WEB_KPI_CONFIGURATION'?['VIEW','NEW','UPDATE'].includes(flag):code==='WEB_KPI_EVALUATION'?['VIEW','UPDATE','APPROVE','EXPORT'].includes(flag):code==='WEB_ATTENDANCE'?['VIEW','NEW','UPDATE','APPROVE','EXPORT'].includes(flag):code==='WEB_WORK_SCHEDULES'?['VIEW','NEW','UPDATE','DELETE','EXPORT'].includes(flag):requestScopeScreens.includes(code)?flag==='VIEW':code==='WEB_APPROVALS'?['VIEW','APPROVE'].includes(flag):['WEB_LEAVE_BALANCES','WEB_LEAVE_MANAGEMENT'].includes(code)?['VIEW','UPDATE'].includes(flag):roleUsesEmployeeScope(code);

function roleScopeSelect(code,flag,label,value='SELF',disabled=false){
 if(!roleHasScopeAction(code,flag))return '';
 return `<div class="role-scope"><label>Phạm vi dữ liệu<select data-role-scope="${e(flag)}" aria-label="Phạm vi ${e(label)}" ${disabled?'disabled':''}>${[['SELF','Chính mình'],['DEPARTMENT','Cùng phòng ban'],['ALL','Tất cả']].map(([scope,text])=>`<option value="${scope}" ${value===scope?'selected':''}>${text}</option>`).join('')}</select></label></div>`;
}

const roleFlags=[['NEW','Thêm mới','can_new'],['VIEW','Xem','can_view'],['UPDATE','Chỉnh sửa','can_update'],['DELETE','Xóa','can_delete'],['APPROVE','Phê duyệt','can_approve'],['EXPORT','Xuất dữ liệu','can_export']];
function roleScopeDraft(screens,matrixScreens){
 const scopes=new Map();
 for(const screen of screens){
  if(!roleUsesEmployeeScope(screen.code))continue;
  const original=matrixScreens.find(item=>item.screenCode===screen.code)?.dataScopes||{};
  const values={...original};
  for(const [flag] of roleFlags)if(roleHasScopeAction(screen.code,flag))values[flag]=['SELF','DEPARTMENT','ALL'].includes(original[flag])?original[flag]:'SELF';
  scopes.set(screen.code,values);
 }
 return scopes;
}

function roleScreenCatalog(catalog){
 const names={WEB_MY_PAYSLIPS:'Phiếu lương của tôi',WEB_SALARY_CONFIGURATION:'Cấu hình lương',WEB_PAYROLL:'Bảng lương và bảng công',WEB_KPI_CONFIGURATION:'Thiết lập KPI',WEB_CONTRACT_TYPES:'Loại hợp đồng',WEB_LEAVE_TYPES:'Loại nghỉ phép',WEB_LEAVE_BALANCES:'Số dư phép',WEB_APPROVAL_SETTINGS:'Quy trình phê duyệt',WEB_LEAVE_REQUESTS:'Nghỉ phép',WEB_OVERTIME_REQUESTS:'Tăng ca',WEB_ATTENDANCE_ADJUSTMENTS:'Điều chỉnh công',WEB_LEAVE_MANAGEMENT:'Leave Management',WEB_WORK_SCHEDULES:'Lịch phân ca',WEB_ATTENDANCE:'Chấm công',WEB_MY_ATTENDANCE:'My Attendance',WEB_KPI_EVALUATION:'Đánh giá KPI'};
 const screens=catalog.map(screen=>names[screen.code]?{...screen,name:names[screen.code]}:{...screen});
 for(const [code,name] of Object.entries(names))if(!screens.some(screen=>screen.code===code))screens.push({id:'pending-'+code,code,name,platform:'WEB',isActive:true,registrationRequired:true});
 return screens;
}
function roleMenuScreenVisible(screen){return !['WEB_SALARY_PROFILES','WEB_TIMESHEETS','WEB_KPI_TEMPLATES','WEB_KPI_RESULTS','WEB_LEAVE','WEB_MY_LEAVE'].includes(screen.code);}
function roleMenuEntrySelected(entry,selected,menuKey=null){return entry.id===selected?.id&&(entry.menuKey?entry.menuKey===menuKey:!menuKey);}
function roleMenuGroups(catalog,platform='WEB'){
 catalog=catalog.filter(screen=>roleMenuScreenVisible(screen)&&(!screen.platform||screen.platform===platform)).map(screen=>['WEB_LEAVE_MANAGEMENT','WEB_LEAVE_BALANCES'].includes(screen.code)?{...screen,name:screen.code==='WEB_LEAVE_MANAGEMENT'?'Leave Management':'Số dư phép'}:screen);
 const used=new Set();const groups=navigationForScreens(nav,catalog,platform).map(group=>{
 const entries=(group.children||[[group.name,group.route]]).flatMap(([label,path])=>{
 const dynamic=/^\/screens\/([A-Z0-9_]+)$/.exec(path);
 const codes=dynamic?[dynamic[1]]:(roleScreenRoutes[path]||['WEB_'+path.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()]).map(code=>platform==='MOBILE'?code.replace(/^WEB_/,'MOBILE_'):code);
 return codes.flatMap(code=>catalog.filter(screen=>screen.code===code&&!used.has(screen.id)).map(screen=>{used.add(screen.id);return {...screen,label:screen.code==='WEB_PAYROLL'?'Payroll / Timesheets':path==='/admin/roles'?(screen.code==='WEB_PERMISSIONS'?'Phân quyền role':'Roles'):screen.code==='WEB_LEAVE_BALANCES'?'Số dư phép':screen.code==='WEB_LEAVE_MANAGEMENT'?'Leave Management':path==='/workspace/leave'?screen.name:group.route==='/approvals'?(screen.code==='WEB_APPROVALS'?'Phê duyệt':screen.name):codes.length>1?label+' · '+screen.name:label,...(path==='/workspace/leave'?{parentMenu:'My Leave'}:path==='/admin/master-data'?{parentMenu:'Master Data'}:path==='/admin/settings'?{parentMenu:'System Settings'}:{})};}));
 });return {name:group.name,icon:group.icon,section:group.section,nested:!!group.children||group.route==='/approvals',entries};
 }).filter(group=>group.entries.length);
 for(const group of groups){
 const myLeaveEntries=group.entries.filter(screen=>screen.parentMenu==='My Leave');
 const entries=group.entries.filter(screen=>screen.parentMenu==='Master Data'&&!screen.code.endsWith('_MASTER_DATA')).map(screen=>({...screen,label:screen.name}));
 group.subgroups=entries.length?[{name:'Master Data',key:group.name+'/Master Data',entries}]:[];
 if(myLeaveEntries.length)group.subgroups.push({name:'My Leave',key:group.name+'/My Leave',entries:myLeaveEntries});
 const settingsEntries=group.entries.filter(screen=>screen.parentMenu==='System Settings').flatMap(screen=>screen.code.endsWith('_SYSTEM_SETTINGS')?[
  {...screen,label:'Chính sách mật khẩu',menuKey:'system/password-policy'},
  {...screen,label:'Chấm công',menuKey:'system/attendance'},
  {...screen,label:'Cấp/Thu hồi phép',menuKey:'system/leave-accrual'},
  {...screen,label:'Terminal Logging',menuKey:'system/terminal-logging'}
 ]:[{...screen,label:'Quy trình phê duyệt',menuKey:'system/approval-workflow'}]);
 if(settingsEntries.length)group.subgroups.push({name:'System Settings',key:group.name+'/System Settings',entries:settingsEntries});
 }

 const remaining=catalog.filter(screen=>!used.has(screen.id));
 if(remaining.length)groups.push({name:'Màn hình khác',icon:'grid',nested:true,entries:remaining.map(screen=>({...screen,label:screen.name}))});
 return groups;
}
function applyMyLeaveViewDependency(draft,changed,scopes=new Map(),enabledScreens=null,screens=null){
 if(draft.get('WEB_LEAVE_MANAGEMENT')?.VIEW!==true)return;
 const target='WEB_LEAVE_BALANCES',existing=draft.get(target),scope=scopes.get(target)||{};
 if(existing?.VIEW===true&&['SELF','DEPARTMENT','ALL'].includes(scope.VIEW)){enabledScreens?.add(target);return;}
 if(screens){const screen=screens.find(item=>item.code===target);if(!screen||screen.registrationRequired||screen.isActive===false)throw Error('Cần đăng ký và kích hoạt màn hình Số dư phép (WEB_LEAVE_BALANCES) trước khi cấp quyền Leave Management.');}
 draft.set(target,{...Object.fromEntries(roleFlags.map(([flag])=>[flag,false])),...existing,VIEW:true});
 scopes.set(target,{...scope,VIEW:['SELF','DEPARTMENT','ALL'].includes(scope.VIEW)?scope.VIEW:'SELF'});
 changed.add(target);enabledScreens?.add(target);
}
function rolePermissionPatch(draft,changed,disabled=new Set(),scopes=new Map()){
 const effectiveDraft=new Map([...draft].map(([code,flags])=>[code,{...flags}])),effectiveScopes=new Map([...scopes].map(([code,values])=>[code,{...values}])),effectiveChanged=new Set(changed);
 applyMyLeaveViewDependency(effectiveDraft,effectiveChanged,effectiveScopes);
 return [...effectiveChanged].map(code=>({screenCode:code,standard:{...effectiveDraft.get(code)},...(code!=='WEB_MY_ATTENDANCE'&&effectiveScopes.has(code)?{dataScopes:{...effectiveScopes.get(code)}}:{}),...(disabled.has(code)?{extendedActions:[]}: {})}));
}
function roleGrant(code,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y'&&p[flag]==='Y');}
function roleSessionIdentity(session=apiSession()){
 const account=session?.user;
 return {id:account?.userId||'',name:account?.fullName||account?.userId||'Tài khoản',role:(session?.roles||[]).map(role=>role.name||role.code||'').filter(Boolean).join(', ')};
}
function roleCreatePayload(values){
 const code=String(values.code||'').trim().toUpperCase(),name=String(values.name||'').trim();
 if(code.length>30||!/^[A-Z][A-Z0-9_]*$/.test(code))throw Error('Mã role phải bắt đầu bằng chữ, chỉ gồm chữ in hoa, số, dấu gạch dưới và tối đa 30 ký tự.');
 if(!name||name.length>100)throw Error('Tên role bắt buộc, tối đa 100 ký tự.');
 return {code,name};
}
function roleCanCreate(session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_ROLES'&&p.canView==='Y'&&p.canNew==='Y');}
async function mountRoles(root,filters={}){
 if(!root)return;
 if(!apiSession()){root.innerHTML='<p>Vui lòng đăng nhập để xem vai trò và phân quyền.</p>';return;}
 let rolePage=Number(filters.page)||1,roleSearch=filters.search||'';
 const showError=(err,retry)=>{if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" data-role-retry>Thử lại</button>`;root.querySelector('[data-role-retry]').onclick=retry;};
 async function list(){
 root.innerHTML='<p role="status">Đang tải danh sách role…</p>';
 try{const result=await apiRoles(rolePage,roleSearch);if(!root.isConnected)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách role không hợp lệ.');
 root.innerHTML=`<form id="role-search" class="toolbar"><input name="search" value="${e(roleSearch)}" placeholder="Tìm mã hoặc tên role" aria-label="Tìm role"><button class="btn">Tìm kiếm</button>${roleCanCreate()?`<button type="button" class="btn primary" id="role-create">${icon('plus',16)} Thêm role</button>`:''}</form><div class="table-wrap"><table><thead><tr><th>Mã role</th><th>Tên role</th><th>Hành động</th></tr></thead><tbody>${result.data.map(role=>`<tr><td>${e(role.code)}</td><td>${e(role.name)}</td><td><button class="btn" data-edit-role="${e(role.id)}" ${roleGrant('WEB_PERMISSIONS','canView')?'':'disabled'}>Chỉnh sửa</button></td></tr>`).join('')}</tbody></table></div>${!result.data.length?'<p>Không có role phù hợp.</p>':''}<div class="toolbar"><button class="btn" id="role-prev" ${rolePage<=1?'disabled':''}>Trang trước</button><span>Trang ${rolePage} · ${e(result.total)} role</span><button class="btn" id="role-next" ${rolePage*30>=result.total?'disabled':''}>Trang sau</button></div>`;
 root.querySelector('#role-search').onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();roleSearch=ev.currentTarget.elements.search.value.trim();rolePage=1;list();};
 root.querySelector('#role-create')?.addEventListener('click',createRole);
 root.querySelector('#role-prev').onclick=()=>{rolePage--;list();};root.querySelector('#role-next').onclick=()=>{rolePage++;list();};
 root.querySelectorAll('[data-edit-role]').forEach(el=>el.onclick=()=>edit(result.data.find(r=>String(r.id)===el.dataset.editRole)));
 }catch(err){showError(err,list);}
 }
 function createRole(){
 if(!roleCanCreate())return;
 openDialog('Thêm role',`<form id="role-create-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Mã role','code','text','','required maxlength="30" pattern="[A-Za-z][A-Za-z0-9_]*" autocomplete="off"')}${field('Tên role','name','text','','required maxlength="100"')}</div><div class="form-actions"><button type="button" class="btn" data-cancel-role>Hủy</button><button class="btn primary" type="submit">Tạo role</button></div></fieldset><p role="alert" data-create-role-error></p></form>`);
 const form=document.querySelector('#role-create-form'),fieldset=form.querySelector('fieldset'),feedback=form.querySelector('[data-create-role-error]');let busy=false;
 form.querySelector('[data-cancel-role]').onclick=()=>{if(!busy)closeDialog();};
 form.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||!roleCanCreate())return;let payload;
 try{payload=roleCreatePayload(Object.fromEntries(new FormData(form)));}catch(err){feedback.textContent=err.message;return;}
 busy=true;fieldset.disabled=true;feedback.textContent='Đang tạo role…';
 try{const saved=await apiCreateRole(payload);if(!form.isConnected)return;closeDialog();toast('Đã tạo role thành công.');if(root.isConnected){rolePage=1;roleSearch=saved?.code||payload.code;await list();}}
 catch(err){if(form.isConnected)feedback.textContent=err.message;}
 finally{busy=false;if(form.isConnected)fieldset.disabled=false;}
 };
 }
 async function edit(role){
 root.innerHTML='<p role="status">Đang tải màn hình và quyền của role…</p>';
 try{const [catalog,matrix]=await Promise.all([apiAllScreens(),apiRolePermissions(role.id)]);if(!root.isConnected)return;
 if(!Array.isArray(matrix?.screens)||!matrix.version)throw Error('Ma trận quyền hoặc version không hợp lệ.');
 // Keep inactive grants visible and read-only; extended actions are omitted from patches to preserve them.
 const mergedCatalog=[...catalog];for(const item of matrix.screens)if(!mergedCatalog.some(x=>x.code===item.screenCode))mergedCatalog.push({id:item.screenId,code:item.screenCode,name:item.name,platform:item.platform,isActive:false});
 const screens=roleScreenCatalog(mergedCatalog);
 const draft=new Map(screens.map(screen=>{const original=matrix.screens.find(x=>x.screenCode===screen.code);return [screen.code,Object.fromEntries(roleFlags.map(([flag])=>[flag,original?.standard?.[flag]===true]))];}));
 const scopes=roleScopeDraft(screens,matrix.screens);
 const enabledScreens=new Set(matrix.screens.filter(item=>Object.values(item.standard||{}).some(value=>value===true)||item.extendedActions?.length).map(item=>item.screenCode));
 const disabledScreens=new Set();
 const changed=new Set();let activePlatform='WEB';
 const selectedByPlatform={WEB:screens.find(screen=>screen.platform==='WEB'&&roleMenuScreenVisible(screen)),MOBILE:screens.find(screen=>screen.platform==='MOBILE'&&roleMenuScreenVisible(screen))};
 let selected=selectedByPlatform.WEB;
 const menuKeyByPlatform={WEB:selected?.code==='WEB_SYSTEM_SETTINGS'?'system/password-policy':selected?.code==='WEB_APPROVAL_SETTINGS'?'system/approval-workflow':null,MOBILE:selectedByPlatform.MOBILE?.code==='MOBILE_SYSTEM_SETTINGS'?'system/password-policy':selectedByPlatform.MOBILE?.code==='MOBILE_APPROVAL_SETTINGS'?'system/approval-workflow':null};
 const menuLabelByPlatform={WEB:selected?.code==='WEB_SYSTEM_SETTINGS'?'Chính sách mật khẩu':selected?.name,MOBILE:selectedByPlatform.MOBILE?.code==='MOBILE_SYSTEM_SETTINGS'?'Chính sách mật khẩu':selectedByPlatform.MOBILE?.name};
 let saving=false;let nameDraft=role.name;
 const openByPlatform={WEB:new Set(),MOBILE:new Set()};
 for(const platform of ['WEB','MOBILE'])for(const group of roleMenuGroups(screens,platform)){
 if(group.entries.some(screen=>roleMenuEntrySelected(screen,selectedByPlatform[platform],menuKeyByPlatform[platform])))openByPlatform[platform].add(group.name);
 for(const subgroup of group.subgroups||[])if(subgroup.entries.some(screen=>roleMenuEntrySelected(screen,selectedByPlatform[platform],menuKeyByPlatform[platform]))){openByPlatform[platform].add(group.name);openByPlatform[platform].add(subgroup.key);}
 }
 const canSave=roleGrant('WEB_PERMISSIONS','canUpdate')&&roleGrant('WEB_PERMISSIONS','canApprove');
 function dependencyReady(){
 const target=screens.find(screen=>screen.code==='WEB_LEAVE_BALANCES');
 if(target&&!target.registrationRequired&&target.isActive!==false)return true;
 root.querySelector('#role-feedback').textContent='Cần đăng ký và kích hoạt màn hình Số dư phép (WEB_LEAVE_BALANCES) trước.';
 return false;
 }
 let dependencyError='';
 function syncMyLeave(strict=false){try{applyMyLeaveViewDependency(draft,changed,scopes,enabledScreens,screens);dependencyError='';}catch(error){dependencyError=error.message;if(strict)throw error;}}

 function screenSwitch(screen){return `<span class="role-switch role-screen-switch"><input type="checkbox" role="switch" aria-label="Phân quyền màn hình ${e(screen.label||screen.name)}" data-screen-enabled="${e(screen.id)}" data-screen-menu-key="${e(screen.menuKey||'')}" data-screen-label="${e(screen.label||screen.name)}" ${enabledScreens.has(screen.code)?'checked':''} ${!canSave||screen.isActive===false||screen.registrationRequired||saving?'disabled':''}><span class="role-switch-track" aria-hidden="true"></span></span>`;}
 function draw(){
 const menuGroups=roleMenuGroups(screens,activePlatform),openGroups=openByPlatform[activePlatform];
 root.innerHTML=`<button class="btn" id="role-back">← Danh sách role</button><h2 class="role-editor-title">Chỉnh sửa role</h2><form id="role-rename" class="role-name-editor"><label for="role-name">Tên role</label><input id="role-name" name="name" required maxlength="100" value="${e(nameDraft)}" ${!roleGrant('WEB_ROLES','canUpdate')||saving?'disabled':''}><button class="btn" ${!roleGrant('WEB_ROLES','canUpdate')||saving?'disabled':''}>Lưu tên role</button><span class="muted">${e(role.code)}</span></form><p class="muted">Chọn màn hình trong menu, sau đó bật các chức năng được phép.</p><div class="tabs role-platform-tabs" role="tablist" aria-label="Nền tảng phân quyền">${['WEB','MOBILE'].map(platform=>`<button type="button" role="tab" id="role-platform-${platform}" class="tab ${activePlatform===platform?'active':''}" aria-selected="${activePlatform===platform}" aria-controls="role-platform-panel" data-role-platform="${platform}">${icon(platform==='WEB'?'grid':'person',16)} ${platform}</button>`).join('')}</div><div class="role-editor" id="role-platform-panel" role="tabpanel" aria-labelledby="role-platform-${activePlatform}"><nav class="role-menu" aria-label="Màn hình phân quyền">${menuGroups.map(group=>{
 const active=group.entries.some(screen=>roleMenuEntrySelected(screen,selected,menuKeyByPlatform[activePlatform])),open=openGroups.has(group.name);
 const screenButton=screen=>{
 const selectedEntry=roleMenuEntrySelected(screen,selected,menuKeyByPlatform[activePlatform]);
 return `<div class="role-screen-row"><button type="button" class="role-screen ${selectedEntry?'selected':''}" data-screen-id="${e(screen.id)}" data-screen-menu-key="${e(screen.menuKey||'')}" data-screen-label="${e(screen.label)}" ${selectedEntry?'aria-current="true"':''}><span>${e(screen.label)}</span>${changed.has(screen.code)?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${screenSwitch(screen)}</div>`;
 };
 const renderedSubgroups=new Set();
 const menuEntries=group.entries.map(screen=>{
 if(!screen.parentMenu)return screenButton(screen);
 if(renderedSubgroups.has(screen.parentMenu))return '';
 renderedSubgroups.add(screen.parentMenu);
 const subgroup=group.subgroups.find(item=>item.name===screen.parentMenu);if(!subgroup)return '';
 const expanded=openGroups.has(subgroup.key),subActive=subgroup.entries.some(item=>roleMenuEntrySelected(item,selected,menuKeyByPlatform[activePlatform]));
 return `<button type="button" class="role-subgroup-toggle ${subActive?'active':''}" data-role-group="${e(subgroup.key)}" aria-expanded="${expanded}"><span>${e(subgroup.name)}</span><span class="chev ${expanded?'role-chevron-open':''}">${icon('chevron',12)}</span>${subgroup.entries.some(item=>changed.has(item.code))?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${expanded?`<div class="submenu role-submenu role-subgroup-items">${subgroup.entries.map(screenButton).join('')}</div>`:''}`;
 }).join('');
 return `${group.section?`<div class="nav-caption">${e(group.section)}</div>`:''}${group.nested?`<button type="button" class="nav-item ${active?'active':''}" data-role-group="${e(group.name)}" aria-expanded="${open}">${icon(group.icon,18)}<span class="role-nav-group-copy"><span class="nav-label">${e(group.name)}</span>${group.description?`<small>${e(group.description)}</small>`:''}</span><span class="chev ${open?'role-chevron-open':''}">${icon('chevron',12)}</span></button>${open?`<div class="submenu role-submenu">${menuEntries}</div>`:''}`:`<div class="role-screen-row"><button type="button" class="nav-item ${active?'active':''}" data-screen-id="${e(group.entries[0].id)}" ${active?'aria-current="true"':''}>${icon(group.icon,18)}<span>${e(group.name)}</span>${changed.has(group.entries[0].code)?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${screenSwitch(group.entries[0])}</div>`}`;
 }).join('')||'<p class="muted role-menu-empty">Chưa có màn hình cho nền tảng này.</p>'}</nav><section class="role-functions">${selected?`<div class="role-functions-heading"><span class="icon-tile blue">${icon('shield',20)}</span><div><h3>${e(menuLabelByPlatform[activePlatform]||selected.name)}</h3><p class="muted">${enabledScreens.has(selected.code)?'Thiết lập quyền thao tác trên màn hình':'Bật nút gạt ở menu để phân quyền màn hình này'}</p></div></div>${selected.registrationRequired?`<p>Màn hình chưa được đăng ký trên hệ thống.</p><button type="button" class="btn primary" id="role-register-screen" ${!roleGrant('WEB_PERMISSIONS','canNew')||saving?'disabled':''}>Đăng ký màn hình ${e(selected.name)}</button>${!roleGrant('WEB_PERMISSIONS','canNew')?'<p class="muted">Cần quyền thêm mới trong Phân quyền để đăng ký màn hình.</p>':''}`:''}${selected.isActive===false?'<p>Màn hình ngừng hoạt động · chỉ xem quyền đã cấp.</p>':''}${['WEB_LEAVE_MANAGEMENT','WEB_LEAVE_BALANCES'].includes(selected.code)?'<p class="muted role-scope-note">Bật Xem cho Leave Management sẽ tự cấp Xem số dư phép. Phạm vi số dư mặc định là Chính mình; quyền và phạm vi đã có vẫn được giữ.</p>':''}${selected.code==='WEB_SYSTEM_SETTINGS'?'<p class="muted role-scope-note">Quyền này áp dụng cho Chính sách mật khẩu, Chấm công, Cấp/Thu hồi phép và Terminal Logging trong System Settings.</p>':''}<div class="role-toggles">${roleFlags.map(([flag,label])=>`<div class="role-permission-item"><label class="role-toggle-row"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" aria-label="${label}" data-role-flag="${flag}" ${draft.get(selected.code)[flag]?'checked':''} ${!canSave||!enabledScreens.has(selected.code)||selected.isActive===false||selected.registrationRequired||saving?'disabled':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>${roleScopeSelect(selected.code,flag,label,scopes.get(selected.code)?.[flag]||'SELF',!canSave||!enabledScreens.has(selected.code)||!draft.get(selected.code)[flag]||selected.isActive===false||selected.registrationRequired||saving)}</div>`).join('')}</div>${requestScopeScreens.includes(selected.code)?'<p class="muted role-scope-note">Phạm vi áp dụng khi xem yêu cầu. Tạo và hủy đơn dùng nhân viên liên kết với tài khoản hiện tại.</p>':selected.code==='WEB_APPROVALS'?'<p class="muted role-scope-note">Phạm vi xem và duyệt được cấu hình riêng. Chỉ người được gán ở bước hiện tại mới có thể duyệt.</p>':selected.code==='WEB_KPI_EVALUATION'?'<p class="muted role-scope-note">Scope áp dụng riêng cho từng thao tác. Chỉ chủ KPI được sửa kết quả; chỉ reviewer được giao được đánh giá quản lý.</p>':roleUsesEmployeeScope(selected.code)?'<p class="muted role-scope-note">Chính mình chỉ cho phép đọc. Các thao tác ghi cần phạm vi Cùng phòng ban hoặc Tất cả.</p>':''}`:'<p>Chưa có màn hình trong danh mục.</p>'}</section></div><div class="role-save"><p id="role-feedback" role="status">${e(dependencyError)}</p><span>${changed.size} màn hình thay đổi</span><button id="role-save" class="btn primary" ${!canSave||!changed.size||saving?'disabled':''}>${saving?'Đang lưu…':'Lưu lại'}</button></div>`;
 root.querySelector('#role-register-screen')?.addEventListener('click',async()=>{
 if(saving||!selected?.registrationRequired||!roleGrant('WEB_PERMISSIONS','canNew'))return;
 const target=selected;saving=true;draw();
 try{
  let registered;
  try{registered=await apiCreateScreen({code:target.code,name:target.name,platform:target.platform,isActive:true});}
  catch(err){if(err.status!==409)throw err;registered=(await apiAllScreens()).find(screen=>screen.code===target.code);}
  if(!root.isConnected)return;
  if(!registered?.id||registered.code!==target.code)throw Error('Chưa nhận được màn hình đã đăng ký. Vui lòng mở lại role.');
  Object.assign(target,registered,{registrationRequired:false});
  saving=false;draw();root.querySelector('#role-feedback').textContent='Đã đăng ký màn hình. Bật màn hình và chọn các quyền cần cấp, sau đó lưu lại.';
 }catch(err){saving=false;if(root.isConnected){draw();root.querySelector('#role-feedback').textContent=err.message;}}
 });
 root.querySelector('#role-name').oninput=ev=>{nameDraft=ev.target.value;};
 root.querySelector('#role-rename').onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving||!roleGrant('WEB_ROLES','canUpdate'))return;
 const name=nameDraft.trim();if(!name){root.querySelector('#role-feedback').textContent='Vui lòng nhập tên role.';return;}
 saving=true;draw();
 try{const saved=await apiUpdateRole(role.id,matrix.version,{code:role.code,name});if(!root.isConnected)return;
 if(!saved?.version)throw Error('Chưa nhận version mới. Hãy tải lại role để xác nhận.');
 matrix.version=saved.version;role.name=saved.name??name;nameDraft=role.name;saving=false;draw();root.querySelector('#role-feedback').textContent='Đã cập nhật tên role.';
 }catch(err){saving=false;if(root.isConnected){draw();root.querySelector('#role-feedback').textContent=err.message;}}
 };
 root.querySelectorAll('[data-role-platform]').forEach(el=>el.onclick=()=>{selectedByPlatform[activePlatform]=selected;activePlatform=el.dataset.rolePlatform;selected=selectedByPlatform[activePlatform];draw();root.querySelector(`[data-role-platform="${activePlatform}"]`)?.focus();});
 root.querySelectorAll('[data-role-group]').forEach(el=>el.onclick=()=>{const name=el.dataset.roleGroup;openGroups.has(name)?openGroups.delete(name):openGroups.add(name);draw();root.querySelectorAll('[data-role-group]').forEach(button=>{if(button.dataset.roleGroup===name)button.focus();});});
 root.querySelector('#role-back').onclick=()=>{if(saving)return;if((!changed.size&&nameDraft===role.name)||confirm('Bỏ các thay đổi chưa lưu?'))list();};
 root.querySelectorAll('[data-screen-id]').forEach(el=>el.onclick=()=>{selected=screens.find(x=>String(x.id)===el.dataset.screenId);menuKeyByPlatform[activePlatform]=el.dataset.screenMenuKey||null;menuLabelByPlatform[activePlatform]=el.dataset.screenLabel||selected?.name;draw();});
 root.querySelectorAll('[data-screen-enabled]').forEach(el=>el.onchange=()=>{
 const screen=screens.find(item=>String(item.id)===el.dataset.screenEnabled);
 if(!screen||!canSave||screen.isActive===false||screen.registrationRequired||saving)return;
 if(screen.code==='WEB_LEAVE_MANAGEMENT'&&el.checked&&!dependencyReady()){el.checked=false;return;}
 selected=screen;menuKeyByPlatform[activePlatform]=el.dataset.screenMenuKey||null;menuLabelByPlatform[activePlatform]=el.dataset.screenLabel||screen.name;
 if(el.checked){enabledScreens.add(screen.code);draft.get(screen.code).VIEW=true;if(roleUsesEmployeeScope(screen.code)){if(!scopes.has(screen.code))scopes.set(screen.code,{});scopes.get(screen.code).VIEW??='SELF';}}
 else{enabledScreens.delete(screen.code);disabledScreens.add(screen.code);roleFlags.forEach(([flag])=>{draft.get(screen.code)[flag]=false;});}
 changed.add(screen.code);syncMyLeave();draw();root.querySelector(`[data-screen-enabled="${screen.id}"][data-screen-menu-key="${menuKeyByPlatform[activePlatform]||''}"]`)?.focus();
 });
 root.querySelectorAll('[data-role-flag]').forEach(el=>el.onchange=()=>{if(!canSave||saving)return;if(selected.code==='WEB_LEAVE_MANAGEMENT'&&el.dataset.roleFlag==='VIEW'&&el.checked&&!dependencyReady()){el.checked=false;return;}draft.get(selected.code)[el.dataset.roleFlag]=el.checked;if(roleHasScopeAction(selected.code,el.dataset.roleFlag)&&el.checked){if(!scopes.has(selected.code))scopes.set(selected.code,{});scopes.get(selected.code)[el.dataset.roleFlag]??='SELF';}changed.add(selected.code);syncMyLeave();const flag=el.dataset.roleFlag;draw();root.querySelector(`[data-role-flag="${flag}"]`)?.focus();});
 root.querySelectorAll('[data-role-scope]').forEach(el=>el.onchange=()=>{
 if(!canSave||saving||selected.isActive===false||selected.registrationRequired)return;
 const flag=el.dataset.roleScope;
 if(!roleHasScopeAction(selected.code,flag)||!['SELF','DEPARTMENT','ALL'].includes(el.value))return;
 if(!enabledScreens.has(selected.code)||!draft.get(selected.code)[flag])return;
 if(!scopes.has(selected.code))scopes.set(selected.code,{});
 scopes.get(selected.code)[flag]=el.value;
 changed.add(selected.code);draw();
 root.querySelector(`[data-role-scope="${flag}"]`)?.focus();
 });
 root.querySelector('#role-save').onclick=async()=>{
 if(saving||!canSave||!changed.size)return;saving=true;draw();
 try{syncMyLeave(true);const saved=await apiSaveRolePermissions(role.id,matrix.version,rolePermissionPatch(draft,changed,disabledScreens,scopes));if(!root.isConnected)return;
 if(!saved?.version)throw Error('Đã gửi lưu nhưng chưa nhận version mới. Hãy quay lại và tải lại role để xác nhận.');
 matrix.version=saved.version;changed.clear();disabledScreens.clear();saving=false;draw();root.querySelector('#role-feedback').textContent='Đã lưu quyền thành công.';
 }catch(err){saving=false;if(!root.isConnected)return;draw();root.querySelector('#role-feedback').textContent=err.message+' Nếu dữ liệu đã thay đổi, quay lại danh sách và mở role để tải phiên bản mới.';}
 };
 }
 draw();
 }catch(err){showError(err,()=>edit(role));}
 }
 await list();
}


// Source: pages/administration/users.js

function userApiGrant(code,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');}
function registrationDateValue(value){
 if(!value.trim())return '';
 const parts=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
 if(!parts)return null;
 const iso=`${parts[3]}-${parts[2]}-${parts[1]}`,date=new Date(iso+'T00:00:00Z');
 return Number(parts[3])>0&&!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===iso?iso:null;
}
function registrationDateField(label,name,required=false){
 return `<div class="registration-date-field"><label for="register-${name}">${label}</label><div class="registration-date-control"><input id="register-${name}" name="${name}" type="text" placeholder="dd/mm/yyyy" inputmode="numeric" maxlength="10" ${required?'required':''}><input type="date" data-date-picker="${name}" aria-label="Chọn ${label.toLowerCase()} từ lịch" tabindex="0"></div></div>`;
}
async function registerSystemUser(input){
 const {employeeId,...account}=input.account;
 if(input.employee){
 const {employeeCode,...employee}=input.employee;
 return apiCreateUser({...account,createEmployee:true,employee:{...employee,email:account.email}});
 }
 return apiCreateUser({...account,createEmployee:false,employeeId:employeeId??null});
}
async function mountUsers(root,filters,register=false){
 if(!root)return;
 if(register){await userRegistration(root);return;}
 let page=Number(filters.page)||1,search=filters.search||'',generation=0;
 async function load(){const current=++generation;root.innerHTML='<p role="status">Đang tải tài khoản…</p>';
 try{const result=await apiUsers(page,search);if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách tài khoản không hợp lệ.');
 const statuses={ACTIVE:'Hoạt động',LOCKED:'Đã khóa',INACTIVE:'Ngừng hoạt động'};
 root.innerHTML=`<form id="system-user-search" class="toolbar"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm tài khoản hoặc email" aria-label="Tìm tài khoản"><button class="btn">Tìm kiếm</button>${userApiGrant('WEB_USERS','canNew')?'<a class="btn primary" href="#/admin/users/register">Đăng ký tài khoản</a>':''}</form><div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Hồ sơ nhân viên</th><th>Hành động</th></tr></thead><tbody>${result.data.map(account=>`<tr><td>${e(account.userId)}</td><td>${e(account.email)}</td><td>${(account.roles||[]).map(role=>`<span class="tag">${e(role.name||role.code)}</span>`).join(' ')||'Chưa phân vai trò'}</td><td><span class="user-status ${account.status==='ACTIVE'?'user-status-active':'user-status-inactive'}"><span class="user-status-dot" aria-hidden="true"></span>${e(statuses[account.status]||account.status)}</span></td><td>${account.employeeId?e(account.employeeCode||'—'):'Chưa liên kết'}</td><td>${userApiGrant('WEB_USERS','canUpdate')||userApiGrant('WEB_USERS','canApprove')?`<button type="button" class="btn" data-system-edit-user="${e(account.userId)}">Chỉnh sửa</button>`:''}</td></tr>`).join('')}</tbody></table></div>${!result.data.length?'<p>Không có tài khoản phù hợp.</p>':''}<div class="toolbar user-pagination"><button class="btn" id="system-user-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} tài khoản</span><button class="btn" id="system-user-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
 root.querySelectorAll('[data-system-edit-user]').forEach(button=>button.onclick=()=>editSystemUser(root,button.dataset.systemEditUser,load));
 root.querySelector('#system-user-search').onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=ev.currentTarget.elements.search.value.trim();page=1;load();};
 root.querySelector('#system-user-prev').onclick=()=>{page--;load();};root.querySelector('#system-user-next').onclick=()=>{page++;load();};
 }catch(err){if(!root.isConnected||current!==generation)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="system-user-retry">Thử lại</button>`;root.querySelector('#system-user-retry').onclick=load;}
 }
 await load();
}
async function userRegistration(root){
 if(!userApiGrant('WEB_USERS','canNew')){root.innerHTML='<p>Bạn không có quyền tạo tài khoản.</p>';return;}
 const canAssign=userApiGrant('WEB_USERS','canApprove'),canEmployee=userApiGrant('WEB_EMPLOYEES','canNew');
 let departments=null,departmentsLoading=false,busy=false,teams=[],teamsLoading=false,teamGeneration=0,positions=null,positionsLoading=false;
 const canTeams=userApiGrant('WEB_TEAMS','canView'),canPositions=userApiGrant('WEB_POSITIONS','canView');
 root.innerHTML=`<a class="btn" href="#/admin/users">← Danh sách tài khoản</a><form id="system-user-register" class="user-registration"><section class="user-form-section"><h2>Thông tin tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text','','required maxlength="100" pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" autocomplete="off"')}${field('Email','email','email','','required maxlength="255" autocomplete="off"')}${field('Mật khẩu','password','password','','required maxlength="1024" autocomplete="new-password"')}${field('Nhập lại mật khẩu','confirmPassword','password','','required maxlength="1024" autocomplete="new-password"')}</div></section><section class="user-form-section"><h2>Vai trò</h2><p class="muted">Có thể chọn nhiều vai trò cho tài khoản.</p><div id="system-role-options" class="user-role-picker">${canAssign?'Đang tải vai trò…':'Bạn chưa có quyền gán vai trò. Tài khoản sẽ được tạo chưa có vai trò.'}</div></section><section class="user-form-section"><label class="role-toggle-row"><span><strong>Tạo kèm hồ sơ nhân viên</strong><small class="user-field-note">Tạo và liên kết cùng lúc; mã nhân viên được hệ thống tự cấp</small></span><span class="role-switch"><input type="checkbox" role="switch" name="createEmployee" ${canEmployee?'':'disabled'}><span class="role-switch-track" aria-hidden="true"></span></span></label>${!canEmployee?'<p class="muted">Bạn chưa có quyền tạo hồ sơ nhân viên.</p>':''}<fieldset id="system-employee-fields" hidden disabled><div class="form-grid">${field('Họ và tên','fullName','text','','required maxlength="150"')}${registrationDateField('Ngày sinh','dateOfBirth')}${field('Số điện thoại','phoneNumber','tel','','maxlength="20"')}${registrationDateField('Ngày vào làm','hireDate',true)}<label>Phòng ban<select name="departmentId" required><option value="">Chọn phòng ban</option></select></label><label>Chức danh (tùy chọn)<select name="positionId" disabled><option value="">Chưa chọn chức danh</option></select></label><label>Team (tùy chọn)<select name="teamId" disabled><option value="">Chọn phòng ban trước</option></select></label></div><p id="system-position-feedback" role="status"></p><p id="system-team-feedback" role="status"></p><p id="system-department-error" role="alert"></p></fieldset></section><p id="system-register-feedback" class="form-error" role="alert"></p><div class="form-actions"><a class="btn" href="#/admin/users">Hủy</a><button type="submit" class="btn primary" id="system-register-submit">Đăng ký tài khoản</button></div></form>`;
 const form=root.querySelector('#system-user-register'),feedback=root.querySelector('#system-register-feedback'),employeeFields=root.querySelector('#system-employee-fields');
 const checkRegistrationPassword=bindPasswordPolicy(form,{passwordName:'password',confirmName:'confirmPassword',username:()=>form.elements.userId.value.trim()});
 form.querySelectorAll('[data-date-picker]').forEach(picker=>{
 const input=form.elements[picker.dataset.datePicker];
 input.oninput=()=>{const value=registrationDateValue(input.value);input.setCustomValidity(value===null?'Nhập ngày hợp lệ theo định dạng dd/mm/yyyy.':'');picker.value=value||'';};
 picker.onchange=()=>{const [year,month,day]=picker.value.split('-');input.value=picker.value?`${day}/${month}/${year}`:'';input.setCustomValidity('');};
 });
 async function loadDepartments(){if(departmentsLoading)return;departmentsLoading=true;const error=root.querySelector('#system-department-error');error.textContent='Đang tải phòng ban…';
 try{departments=await apiActiveDepartments();if(!root.isConnected)return;form.elements.departmentId.innerHTML='<option value="">Chọn phòng ban</option>'+departments.map(dep=>`<option value="${e(dep.id)}">${e(dep.departmentName)}</option>`).join('');error.textContent=departments.length?'':'Chưa có phòng ban đang hoạt động.';}
 catch(err){if(!root.isConnected)return;error.textContent=err.message;}finally{departmentsLoading=false;}}
 async function loadPositions(){
 if(positionsLoading||positions!==null)return;
 const select=form.elements.positionId,note=root.querySelector('#system-position-feedback');
 if(!canPositions){note.textContent='Cần quyền WEB_POSITIONS/VIEW để chọn chức danh. Có thể tạo nhân viên chưa gán chức danh.';return;}
 positionsLoading=true;select.disabled=true;note.textContent='Đang tải chức danh…';
 try{const result=await apiActivePositions();if(!form.isConnected)return;
 positions=result;select.innerHTML='<option value="">Chưa chọn chức danh</option>'+positions.map(position=>`<option value="${e(position.id)}">${e(position.name)} (${e(position.code)})</option>`).join('');select.disabled=false;
 note.textContent=positions.length?'':'Chưa có chức danh đang hoạt động.';
 }catch(err){if(form.isConnected)note.textContent=err.message;}
 finally{positionsLoading=false;}
 }
 async function loadTeams(){
 const generation=++teamGeneration,departmentId=form.elements.departmentId.value,select=form.elements.teamId,note=root.querySelector('#system-team-feedback');
 teams=[];teamsLoading=false;select.disabled=true;select.innerHTML='<option value="">Không gán team</option>';note.textContent='';
 if(!departmentId){select.innerHTML='<option value="">Chọn phòng ban trước</option>';return;}
 if(!canTeams){note.textContent='Cần quyền WEB_TEAMS/VIEW để chọn team. Có thể tạo nhân viên chưa gán team.';return;}
 teamsLoading=true;note.textContent='Đang tải team…';
 try{const result=await apiActiveTeams(departmentId);if(!form.isConnected||generation!==teamGeneration)return;
 teams=result;select.innerHTML='<option value="">Không gán team</option>'+teams.map(team=>`<option value="${e(team.id)}">${e(team.teamName)} (${e(team.teamCode)})</option>`).join('');
 select.disabled=false;note.textContent=teams.length?'':'Phòng ban chưa có team đang hoạt động.';
 }catch(err){if(form.isConnected&&generation===teamGeneration){note.textContent=err.message;}}
 finally{if(generation===teamGeneration)teamsLoading=false;}
 }
 form.elements.departmentId.onchange=loadTeams;
 form.elements.createEmployee.onchange=()=>{employeeFields.hidden=!form.elements.createEmployee.checked;employeeFields.disabled=!form.elements.createEmployee.checked;if(form.elements.createEmployee.checked){if(!departments)loadDepartments();loadPositions();}};
 let rolesReady=!canAssign;
 if(canAssign){apiAllRoles().then(roles=>{if(!root.isConnected)return;rolesReady=true;mountUserRolePicker(root.querySelector('#system-role-options'),roles);}).catch(err=>{if(!root.isConnected)return;root.querySelector('#system-role-options').textContent=err.message+' Quay lại trang đăng ký để tải lại vai trò.';});}
 form.onsubmit=async ev=>{ev.preventDefault();ev.stopPropagation();if(busy)return;feedback.textContent='';
 if(!rolesReady){feedback.textContent='Chưa tải được danh sách vai trò. Vui lòng thử lại.';return;}
 try{await checkRegistrationPassword();}catch(err){feedback.textContent=err.message;return;}
 if(busy)return;
 const data=new FormData(form),staff=form.elements.createEmployee.checked;
 if(data.get('password')!==data.get('confirmPassword')){feedback.textContent='Mật khẩu nhập lại không khớp.';return;}
 if(staff&&(!departments||departmentsLoading||!departments.some(dep=>String(dep.id)===data.get('departmentId')))){feedback.textContent='Vui lòng chọn phòng ban hợp lệ.';return;}
 const dateOfBirth=staff?registrationDateValue(data.get('dateOfBirth')):null,hireDate=staff?registrationDateValue(data.get('hireDate')):null;
 if(staff&&(dateOfBirth===null||!hireDate)){feedback.textContent='Vui lòng nhập ngày hợp lệ theo định dạng dd/mm/yyyy.';return;}
 if(staff&&dateOfBirth&&dateOfBirth>hireDate){feedback.textContent='Ngày sinh phải trước hoặc bằng ngày vào làm.';return;}
 const selectedPosition=data.get('positionId');
 if(staff&&selectedPosition&&(positionsLoading||!positions?.some(position=>String(position.id)===selectedPosition))){feedback.textContent='Vui lòng chọn chức danh hợp lệ đang hoạt động.';return;}
 const selectedTeam=data.get('teamId');
 if(staff&&selectedTeam&&(teamsLoading||!teams.some(team=>String(team.id)===selectedTeam&&Number(team.departmentId)===Number(data.get('departmentId'))))){feedback.textContent='Vui lòng chọn team hợp lệ thuộc phòng ban đã chọn.';return;}
 const account={userId:data.get('userId').trim(),email:data.get('email').trim(),password:data.get('password'),roleIds:data.getAll('roleIds').map(Number)};
 const employee=staff?{fullName:data.get('fullName').trim(),email:account.email,teamId:selectedTeam?Number(selectedTeam):null,positionId:selectedPosition?Number(selectedPosition):null,dateOfBirth:dateOfBirth||null,phoneNumber:data.get('phoneNumber').trim()||null,hireDate,departmentId:Number(data.get('departmentId')),employmentStatus:'ACTIVE'}:null;
 busy=true;const submit=root.querySelector('#system-register-submit');submit.disabled=true;submit.textContent='Đang đăng ký…';form.elements.createEmployee.disabled=true;
 try{const created=await registerSystemUser({account,employee});if(!root.isConnected)return;form.reset();root.innerHTML=`<div class="empty"><h2>Đăng ký tài khoản thành công</h2><p>Tài khoản và các vai trò đã được lưu vào hệ thống.</p>${created?.employeeCode?`<p>Mã nhân viên: <strong>${e(created.employeeCode)}</strong></p>`:''}<a class="btn primary" href="#/admin/users">Về danh sách tài khoản</a></div>`;}
 catch(err){if(!root.isConnected)return;feedback.textContent=err.message;}
 finally{busy=false;if(root.isConnected&&submit.isConnected){submit.disabled=false;submit.textContent='Đăng ký tài khoản';form.elements.createEmployee.disabled=!canEmployee;}}

 };
}

function mountUserRolePicker(container,roles,initial=[],disabled=false){
 const selected=new Map(initial.map(role=>[String(role.id),role]));
 function draw(){
 container.innerHTML=`<label class="user-role-select-label">Thêm vai trò<select aria-label="Chọn vai trò để thêm" ${disabled?'disabled':''}><option value="">Chọn vai trò…</option>${roles.filter(role=>!selected.has(String(role.id))).map(role=>`<option value="${e(role.id)}">${e(role.name||role.code)}</option>`).join('')}</select></label><div class="user-role-chips">${[...selected.values()].map(role=>`<span class="user-role-chip"><input type="hidden" name="roleIds" value="${e(role.id)}"><span>${e(role.name||role.code)}</span>${disabled?'':`<button type="button" data-remove-role="${e(role.id)}" aria-label="Bỏ vai trò ${e(role.name||role.code)}">×</button>`}</span>`).join('')||'<span class="muted">Chưa chọn vai trò</span>'}</div>`;
 container.querySelector('select').onchange=ev=>{const role=roles.find(item=>String(item.id)===ev.target.value);if(!role||disabled)return;selected.set(String(role.id),role);draw();container.querySelector('select').focus();};
 container.querySelectorAll('[data-remove-role]').forEach(button=>button.onclick=()=>{selected.delete(button.dataset.removeRole);draw();container.querySelector('select').focus();});
 }
 draw();return ()=>[...selected.keys()].map(Number);
}
async function saveSystemUserChanges(current,changes){
 if(!current.version)Object.assign(current,await apiUserDetail(current.userId));
 let saved=current;
 if(changes.profile&&(changes.profile.email!==current.email||changes.profile.employeeId!==(current.employeeId??null))){
 saved=await apiUpdateUser(current.userId,current.version,changes.profile);
 Object.assign(current,saved);
 }
 if(changes.roleIds&&JSON.stringify([...changes.roleIds].sort((a,b)=>a-b))!==JSON.stringify((current.roles||[]).map(role=>Number(role.id)).sort((a,b)=>a-b))){
 // Re-read the aggregate after updating metadata before changing memberships.
 const latest=await apiUserDetail(current.userId);Object.assign(current,latest);
 saved=await apiUpdateUserRoles(current.userId,current.version,changes.roleIds);Object.assign(current,saved);
 }
 if(changes.newPassword){
 saved=await apiResetUserPassword(current.userId,current.version,{type:'ADMIN_RESET',newPassword:changes.newPassword});
 if(saved?.version)Object.assign(current,saved);
 else{current.version=null;saved=current;} // A successful empty response has no aggregate version; reload before the next save.
 }
 if(changes.status!==undefined&&changes.status!==current.status){
 if(!current.version)Object.assign(current,await apiUserDetail(current.userId));
 saved=await apiSetUserStatus(current.userId,current.version,changes.status);
 if(saved?.version)Object.assign(current,saved);else{current.status=changes.status;current.version=null;saved=current;}
 }
 return saved;
}
async function editSystemUser(root,userId,back){
 root.innerHTML='<p role="status">Đang tải thông tin tài khoản…</p>';
 try{const current=await apiUserDetail(userId);if(!root.isConnected)return;
 const canUpdate=userApiGrant('WEB_USERS','canUpdate'),canReset=userApiGrant('WEB_USERS','canUpdate')&&apiSession()?.user?.userId!==userId,canRoles=userApiGrant('WEB_USERS','canApprove')&&apiSession()?.user?.userId!==userId;
 let busy=false,employeeId=current.employeeId??null,employeePage=1,employeeSearch='',searchGeneration=0,draftStatus=current.status;
 root.innerHTML=`<button type="button" class="btn" id="system-edit-back">← Danh sách tài khoản</button><form id="system-edit-form" class="user-registration"><fieldset class="user-edit-fieldset"><section class="user-form-section"><h2>Chỉnh sửa tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text',current.userId,'readonly')}${field('Email','email','email',current.email,`required maxlength="255" ${canUpdate?'':'readonly'}`)}<div class="user-account-status"><label class="role-toggle-row" style="flex-direction:row"><span>Hoạt động tài khoản</span><span class="role-switch"><input id="system-user-active" type="checkbox" role="switch" aria-label="Hoạt động tài khoản" ${current.status==='ACTIVE'?'checked':''} ${canUpdate?'':'disabled'}><span class="role-switch-track" aria-hidden="true"></span></span></label><small class="muted" id="system-user-status-label">${e({ACTIVE:'Hoạt động',LOCKED:'Đã khóa',INACTIVE:'Ngừng hoạt động'}[current.status]||current.status)}</small></div><div class="user-password-field"><label for="system-new-password">Mật khẩu</label><div class="user-password-control"><input id="system-new-password" name="newPassword" type="password" placeholder="********" maxlength="1024" autocomplete="new-password" ${canReset?'':'disabled'}><button type="button" class="btn" id="system-password-eye" aria-label="Xem mật khẩu mới" aria-pressed="false" ${canReset?'':'disabled'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><small class="muted">Để trống để giữ nguyên mật khẩu. Nút mắt chỉ hiển thị mật khẩu mới bạn nhập.</small></div></div></section><section class="user-form-section"><h2>Vai trò</h2><div id="system-edit-role-picker" class="user-role-picker">Đang tải vai trò…</div></section><section class="user-form-section"><h2>Liên kết nhân viên</h2><div id="system-linked-employee"></div>${canUpdate&&userApiGrant('WEB_EMPLOYEES','canView')?'<div class="toolbar user-employee-search"><input id="system-employee-search" placeholder="Tìm mã hoặc tên nhân viên" maxlength="150" aria-label="Tìm nhân viên"><button type="button" class="btn" id="system-employee-find">Tìm kiếm</button></div><div id="system-employee-results"></div>':'<p class="muted">Cần quyền xem nhân viên để tìm hồ sơ liên kết.</p>'}</section></fieldset><p id="system-edit-feedback" class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="btn" id="system-edit-cancel">Hủy</button><button type="submit" class="btn primary">Lưu lại</button></div></form>`;
 const form=root.querySelector('#system-edit-form'),feedback=root.querySelector('#system-edit-feedback');
 const passwordInput=form.elements.newPassword;
 root.querySelector('#system-user-active').onchange=event=>{if(busy||!canUpdate)return;draftStatus=event.target.checked?'ACTIVE':'INACTIVE';root.querySelector('#system-user-status-label').textContent=draftStatus==='ACTIVE'?'Hoạt động':'Ngừng hoạt động';};
 const checkEditedPassword=bindPasswordPolicy(form,{passwordName:'newPassword',username:()=>current.userId,optional:true});
 root.querySelector('#system-password-eye')?.addEventListener('click',ev=>{
 const visible=passwordInput.type==='password';passwordInput.type=visible?'text':'password';
 ev.currentTarget.setAttribute('aria-pressed',String(visible));ev.currentTarget.setAttribute('aria-label',visible?'Ẩn mật khẩu mới':'Xem mật khẩu mới');
 });

 const leave=()=>{if(!busy)back();};root.querySelector('#system-edit-back').onclick=leave;root.querySelector('#system-edit-cancel').onclick=leave;
 let getRoles=()=>null,rolesReady=!canRoles;
 if(canRoles){try{const roles=await apiAllRoles();if(!root.isConnected)return;getRoles=mountUserRolePicker(root.querySelector('#system-edit-role-picker'),roles,current.roles||[]);rolesReady=true;}
 catch(err){if(!root.isConnected)return;root.querySelector('#system-edit-role-picker').textContent=err.message;}}
 else mountUserRolePicker(root.querySelector('#system-edit-role-picker'),[],current.roles||[],true);
 function linked(label){const area=root.querySelector('#system-linked-employee');area.innerHTML=employeeId?`<div class="user-employee-linked"><span>${e(label||'Đã liên kết hồ sơ nhân viên')}</span>${canUpdate?'<button type="button" class="btn danger" id="system-unlink-employee">Gỡ liên kết</button>':''}</div>`:'<p class="muted">Chưa liên kết nhân viên.</p>';
 area.querySelector('#system-unlink-employee')?.addEventListener('click',()=>{employeeId=null;linked();});}
 linked([current.employeeCode,current.employeeName].filter(Boolean).join(' · '));
 async function findEmployees(){const results=root.querySelector('#system-employee-results');if(!results)return;const generation=++searchGeneration;results.innerHTML='<p>Đang tìm nhân viên…</p>';
 try{const result=await apiUnlinkedEmployees(new URLSearchParams({page:employeePage,pageSize:10,search:employeeSearch}).toString());if(!root.isConnected||generation!==searchGeneration)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
 results.innerHTML=result.data.map(employee=>`<div class="user-employee-result"><div><strong>${e(employee.fullName)}</strong><small>${e(employee.employeeCode)} · ${e(employee.email)}</small></div><button type="button" class="btn" data-link-employee="${e(employee.id)}">Liên kết</button></div>`).join('')||'<p>Không có nhân viên chưa liên kết phù hợp.</p>';
 results.innerHTML+=`<div class="toolbar user-pagination"><button type="button" class="btn" id="system-employee-prev" ${employeePage<=1?'disabled':''}>Trước</button><span>Trang ${employeePage}</span><button type="button" class="btn" id="system-employee-next" ${employeePage*10>=result.total?'disabled':''}>Sau</button></div><p class="muted">Danh sách chỉ gồm nhân viên chưa liên kết tài khoản trong phạm vi bạn được xem.</p>`;
 results.querySelectorAll('[data-link-employee]').forEach(button=>button.onclick=()=>{const employee=result.data.find(item=>String(item.id)===button.dataset.linkEmployee);employeeId=employee.id;linked(employee.fullName+' · '+employee.employeeCode);});
 results.querySelector('#system-employee-prev').onclick=()=>{employeePage--;findEmployees();};results.querySelector('#system-employee-next').onclick=()=>{employeePage++;findEmployees();};
 }catch(err){if(root.isConnected&&generation===searchGeneration)results.textContent=err.message;}}
 if(canUpdate&&userApiGrant('WEB_EMPLOYEES','canView'))findEmployees();
 root.querySelector('#system-employee-find')?.addEventListener('click',()=>{employeeSearch=root.querySelector('#system-employee-search').value.trim();employeePage=1;findEmployees();});
 root.querySelector('#system-employee-search')?.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();root.querySelector('#system-employee-find').click();}});
 form.onsubmit=async ev=>{ev.preventDefault();ev.stopPropagation();if(busy)return;
 try{await checkEditedPassword();}catch(err){feedback.textContent=err.message;return;}
 if(busy)return;
 if(!rolesReady){feedback.textContent='Chưa tải được vai trò. Vui lòng mở lại tài khoản.';return;}
 busy=true;form.querySelector('fieldset').disabled=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Đang lưu…';feedback.textContent='';
 const previousVersion=current.version;
 try{await saveSystemUserChanges(current,{profile:canUpdate?{email:form.elements.email.value.trim(),employeeId}:null,roleIds:canRoles?getRoles():null,newPassword:canReset?passwordInput.value:undefined,status:canUpdate?draftStatus:undefined});if(!root.isConnected)return;passwordInput.value='';passwordInput.dispatchEvent(new Event('input'));passwordInput.type='password';root.querySelector('#system-password-eye')?.setAttribute('aria-pressed','false');feedback.textContent='Đã lưu tài khoản thành công.';findEmployees();}
 catch(err){if(!root.isConnected)return;feedback.textContent=(current.version!==previousVersion?'Một phần thay đổi đã được lưu; các thay đổi còn lại chưa hoàn tất. ':'')+err.message+' Nếu có xung đột phiên bản, mở lại tài khoản để tải dữ liệu mới.';}
 finally{busy=false;if(root.isConnected){form.querySelector('fieldset').disabled=false;submit.disabled=false;submit.textContent='Lưu lại';}}
 };
 }catch(err){if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="system-edit-error-back">Về danh sách</button>`;root.querySelector('#system-edit-error-back').onclick=back;}
}


// Source: pages/shared/work.js
function taskPage(f,own=false){let ts=visibleTasks(f).filter(t=>(!own||t.assigneeId===user().id)&&(!f.status||t.status===f.status)&&matches(t.title+t.code,f.search));if(f.project)ts=ts.filter(t=>t.projectId===f.project);const view=f.view||'list';return `${searchToolbar(f,statusSelect(f,['todo','in_progress','review','done'])+`<select data-filter="project" aria-label="Lọc dự án"><option value="">Tất cả dự án</option>${scope.projects(s,user()).map(p=>`<option value="${p.id}" ${f.project===p.id?'selected':''}>${e(p.name)}</option>`).join('')}</select>`+button('Danh sách','list','menu',view==='list'?'primary':'')+button('Kanban','kanban','grid',view==='kanban'?'primary':''))}${view==='kanban'?`<div class="kanban">${['todo','in_progress','review','done'].map(st=>`<section class="kanban-column"><h3>${labels[st]} <span class="tag">${ts.filter(t=>t.status===st).length}</span></h3>${ts.filter(t=>t.status===st).map(t=>`<article class="kanban-card" tabindex="0" role="button" data-open="task" data-id="${t.id}"><small>${e(t.code)}</small><h3>${e(t.title)}</h3>${badge(t.priority)}<footer><span>${dateLabel(t.dueDate)}</span>${avatar(s.users.find(u=>u.id===t.assigneeId))}</footer></article>`).join('')}</section>`).join('')}</div>`:`<div class="card">${table(['Công việc','Dự án','Phụ trách','Ưu tiên','Trạng thái','Hạn hoàn thành'],ts.map(t=>[`<a href="#" data-open="task" data-id="${t.id}"><strong>${e(t.title)}</strong><div class="person-sub">${e(t.code)}</div></a>`,e(s.projects.find(p=>p.id===t.projectId)?.name),person(s.users.find(u=>u.id===t.assigneeId)),badge(t.priority),badge(t.status),dateLabel(t.dueDate)]),{page:f.page})}</div>`}`;}
function projectCards(f,own=false){const ps=scope.projects(s,user()).filter(p=>(!own||p.memberIds.includes(user().id))&&matches(p.name+p.code,f.search));return `${searchToolbar(f)}<div class="project-grid">${ps.map(p=>{const ts=scope.tasks(s,user()).filter(t=>t.projectId===p.id),done=ts.filter(t=>t.status==='done').length;return `<article class="card project-card ${p.color}"><div class="project-card-top"><div class="icon-tile ${p.color}">${icon('folder',20)}</div>${badge(p.health,p.health==='review'?'Chờ nghiệm thu':null)}</div><div><h2><a href="#/projects/${p.id}" style="color:inherit">${e(p.name)}</a></h2><p style="margin-top:8px">${e(p.description)}</p></div>${user().role!=='HR'?`<div><div class="progress-info"><span>Tiến độ công việc</span><strong>${done}/${ts.length} · ${pct(done,ts.length)}%</strong></div>${progress(pct(done,ts.length))}</div>`:''}<div class="project-card-footer"><div class="avatar-group">${p.memberIds.slice(0,3).map(id=>avatar(s.users.find(u=>u.id===id))).join('')}<span class="avatar">+${Math.max(0,p.memberIds.length-3)}</span></div><span>${icon('calendar',11)} ${dateLabel(p.dueDate)}</span></div><a class="card-link" href="#/projects/${p.id}">Chi tiết dự án ${icon('arrow',13)}</a></article>`;}).join('')}</div>${!ps.length?empty():''}`;}
function projectDetail(f,projectId){const p=scope.projects(s,user()).find(p=>p.id===projectId);if(!p)return empty('Không tìm thấy dự án','Dự án không tồn tại hoặc ngoài phạm vi của bạn.');const tab=f.tab||'overview',hr=user().role==='HR',ts=scope.tasks(s,user()).filter(t=>t.projectId===p.id),done=ts.filter(t=>t.status==='done').length;return `<div class="card mb"><div class="card-body"><div class="project-card-top"><div class="person"><div class="icon-tile ${p.color}">${icon('folder',22)}</div><h2>${e(p.name)}</h2></div>${badge(p.health)}</div><p class="muted" style="margin-top:16px">${e(p.description)}</p>${details([['Mã dự án',e(p.code)],['Quản lý',e(s.users.find(u=>u.id===p.managerId)?.name)],['Bắt đầu',dateLabel(p.startDate)],['Deadline',dateLabel(p.dueDate)]])}${scope.can(s,user(),'project.create')?button('Sửa dự án','edit-project','edit','','data-id="'+p.id+'"'):''}</div></div>${tabs(hr?[['overview','Tổng quan'],['members','Thành viên']]:[['overview','Tổng quan'],['tasks','Công việc'],['members','Thành viên'],['milestones','Milestones'],['timeline','Timeline'],['documents','Tài liệu']],tab)}${tab==='tasks'?taskPage({...f,project:p.id}):tab==='members'?peoplePage({...f,ids:p.memberIds}):tab==='documents'?documentsPage({...f,project:p.id}):tab==='milestones'||tab==='timeline'?timelinePage(f,[p]):`<div class="kpis">${kpi('Thành viên',p.memberIds.length,'người','Cùng phát triển sản phẩm','users','blue')}${!hr?kpi('Hoàn thành',done,`/ ${ts.length}`,`${pct(done,ts.length)}% tổng công việc`,'check','teal'):''}${kpi('Phạm vi',p.teamIds.length,'team','Hợp tác liên phòng ban','briefcase','purple')}</div>${!hr?card('Công việc dự án','Tiến độ và trạng thái mới nhất',`<div class="card-body">${progress(pct(done,ts.length))}</div>${taskPage({...f,project:p.id})}`):''}`}`;}
function peoplePage(f,mode='table'){let us=scope.employees(s,user()).filter(u=>(!f.team||u.teamId===f.team)&&(!f.ids||f.ids.includes(u.id))&&matches(u.name+u.employeeCode+u.position,f.search));return `${searchToolbar(f,teamOptions(f)+button('Danh sách','list','menu',f.view!=='grid'?'primary':'')+button('Thẻ','grid','grid',f.view==='grid'?'primary':''))}${f.view==='grid'?`<div class="people-grid">${us.map(u=>`<article class="card people-card">${avatar(u,'lg')}<h3>${e(u.name)}</h3><p>${e(u.position)}</p>${badge(u.status)}<div>${button('Xem hồ sơ','employee','','','data-id="'+u.id+'"')}</div></article>`).join('')}</div>`:`<div class="card">${table(['Nhân viên','Chức danh','Team','Email','Trạng thái',''],us.map(u=>[person(u),e(u.position),e(s.teams.find(t=>t.id===u.teamId)?.name||'Office'),e(u.email),badge(u.status),button('Hồ sơ','employee','person','small','data-id="'+u.id+'"')]),{page:f.page})}</div>`}`;}
function attendancePage(f,personal=false){const u=user(),record=s.attendance.find(a=>a.userId===u.id&&a.date==='2026-10-19');const own=f.tab||'history';return `${personal?`<div class="card mb"><div class="card-body"><div class="project-card-top"><div><h2>Chấm công của bạn</h2><p class="muted">Thứ Hai, 19/10/2026 · Ca 08:30–17:30</p></div>${badge(attendanceStatus(record))}</div>${details([['Giờ vào',timeLabel(record?.checkIn)],['Giờ ra',timeLabel(record?.checkOut)]])}<div class="toolbar">${button('Check-in','check-in','clock','primary',record?.checkIn||record?.leaveRequestId?'disabled':'')}${button('Check-out','check-out','logout','',!record?.checkIn||record?.checkOut?'disabled':'')}${button('Yêu cầu điều chỉnh','new-adjustment','edit')}</div></div></div>${tabs([['history','Lịch sử'],['late','Đi trễ / Về sớm'],['overtime','Tăng ca']],own)}`:''}${personal?own==='overtime'?approvalPage({...f,tab:'overtime'},true):`<div class="card">${table(['Ngày','Check-in','Check-out','Trạng thái'],s.attendance.filter(a=>a.userId===u.id&&(own!=='late'||attendanceStatus(a)==='late')).sort((a,b)=>b.date.localeCompare(a.date)).map(a=>[dateLabel(a.date),timeLabel(a.checkIn),timeLabel(a.checkOut),badge(attendanceStatus(a))]),{page:f.page})}</div>`:`${searchToolbar(f,teamOptions(f)+`<input type="date" data-filter="date" aria-label="Ngày chấm công" value="${f.date}" max="2026-10-19">`+statusSelect(f,['ontime','late','leave','absent'])+button('CSV','export-attendance','download'))}<div class="card">${[0,6].includes(new Date(f.date+'T12:00:00+07:00').getDay())?empty('Không có lịch làm việc','Ngày đã chọn là cuối tuần.'):attendanceTable(f)}</div>`}`;}
function approvalPage(f,personal=false){const tab=f.tab||'all';let rs=scope.requests(s,user()).filter(r=>(!personal||r.requesterId===user().id)&&(tab==='all'||tab==='history'&&!r.status.startsWith('pending_')||r.type===tab)&&(!f.status||r.status===f.status)&&matches(r.reason+(s.users.find(u=>u.id===r.requesterId)?.name||''),f.search));const balance=s.leaveBalances.find(b=>b.userId===user().id);return `${personal&&tab!=='overtime'?`<div class="kpis">${kpi('Phép năm',balance?.allowanceDays||12,'ngày','Định mức năm 2026','calendar','blue')}${kpi('Đã sử dụng',balance?.usedDays||0,'ngày','Đã được duyệt','check','purple')}${kpi('Còn lại',(balance?.allowanceDays||12)-(balance?.usedDays||0),'ngày','Sẵn sàng cho kỳ nghỉ tiếp theo','sun','teal')}</div>`:''}${tabs([['all','Tất cả'],['leave','Nghỉ phép'],['overtime','Tăng ca'],['adjustment','Điều chỉnh công'],['general','Yêu cầu khác'],['history','Lịch sử']],tab)}${searchToolbar(f,statusSelect(f,['pending_leader','pending_manager','pending_hr','approved','rejected','cancelled'])+button('Tạo yêu cầu','new-request','plus','primary'))}<div class="card">${table(['Người gửi','Loại yêu cầu','Nội dung','Thời gian','Trạng thái',''],rs.map(r=>[person(s.users.find(u=>u.id===r.requesterId)),badge(r.type),`<span title="${e(r.reason)}">${e(r.reason.slice(0,40))}${r.reason.length>40?'…':''}</span>`,dateLabel(r.startDate),badge(r.status),button('Chi tiết','request','','small','data-id="'+r.id+'"')]),{page:f.page})}</div>`;}
function workloadPage(f){const us=visibleEmployees(f),ts=visibleTasks(f);return card('Phân bổ công việc','Số task chưa hoàn thành theo từng thành viên',`<div class="card-body">${us.map(u=>{const count=ts.filter(t=>t.assigneeId===u.id&&t.status!=='done').length;return `<div class="workload-bar">${person(u)}<div class="${count>4?'orange':'blue'}">${progress(Math.min(100,count*20))}</div><span class="muted">${count} task</span></div>`;}).join('')}</div>`,teamOptions(f));}
function timelinePage(f,ps=scope.projects(s,user())){return card('Lộ trình & Milestones','Giai đoạn phát triển và ngày bàn giao dự kiến',`<div class="card-body">${ps.map(p=>`<div style="padding:20px 0;border-bottom:1px solid var(--border)"><div class="project-card-top"><a href="#/projects/${p.id}"><strong>${e(p.name)}</strong></a>${badge(p.health)}</div><div class="progress-info" style="margin-top:16px"><span>${dateLabel(p.startDate)} · Khởi động</span><span>${dateLabel(p.dueDate)} · Nghiệm thu</span></div><div class="${p.color}">${progress(pct(scope.tasks(s,user()).filter(t=>t.projectId===p.id&&t.status==='done').length,scope.tasks(s,user()).filter(t=>t.projectId===p.id).length))}</div><div class="progress-info" style="margin-top:10px"><span>① Thiết kế</span><span>② Phát triển</span><span>③ Kiểm thử</span><span>④ Bàn giao</span></div></div>`).join('')}</div>`);}
function teamPage(f,path){if(path.endsWith('tasks'))return taskPage(f);if(path.endsWith('members'))return peoplePage(f);if(path.endsWith('attendance'))return attendancePage(f);if(path.endsWith('leave'))return approvalPage({...f,tab:f.tab||'leave'});if(path.endsWith('workload'))return workloadPage(f);if(path.endsWith('reports'))return reportsPage(f);return `${searchToolbar(f,teamOptions(f))}<div class="project-grid mb">${s.teams.filter(t=>scope.scopedTeams(s,user()).includes(t.id)&&(!f.team||f.team===t.id)).map(t=>`<article class="card project-card"><div class="icon-tile blue">${icon('users',22)}</div><h2>${e(t.name)} Team</h2><p>${s.users.filter(u=>u.teamId===t.id).length} thành viên · Engineering</p><div>${person(s.users.find(u=>u.id===t.leaderId))}</div><a class="card-link" href="#/team/members">Xem thành viên ${icon('arrow',14)}</a></article>`).join('')}</div>${user().role==='HR'?'':workloadPage(f)}`;}
function documentsPage(f){const tab=f.tab||'all';const ds=scope.documents(s,user()).filter(d=>(!f.project||d.projectId===f.project)&&(tab==='all'||d.category===tab)&&matches(d.name,f.search));return `${tabs([['all','Tất cả'],['company','Công ty'],['policies','Chính sách'],['project','Dự án'],['shared','Được chia sẻ']],tab)}${searchToolbar(f,button('Thêm tài liệu','new-document','plus','primary'))}<div class="document-grid">${ds.map(d=>`<article class="card document-card"><div class="icon-tile ${d.category==='project'?'blue':'purple'}">${icon('file',25)}</div><h3>${e(d.name)}</h3><p>Cập nhật ${dateLabel(d.updatedAt)} · Markdown</p><div class="toolbar">${button('Xem trước','document','','small',`data-id="${d.id}"`)}${d.fileUrl?downloadLink(d.fileUrl):'<span class="tag">Metadata demo</span>'}</div></article>`).join('')}</div>${!ds.length?empty():''}`;}
function reportsPage(f){if(f.tab==='attendance')return tabs(user().role==='HR'?[['employee','Nhân sự'],['attendance','Chấm công'],['leave','Nghỉ phép']]:[['management','Tổng quan'],['attendance','Chấm công'],['task','Công việc'],['project','Dự án']], 'attendance')+attendanceReport(f);const hr=user().role==='HR',tab=f.tab||(hr?'employee':'management'),options=hr?[['employee','Nhân sự'],['attendance','Chấm công'],['leave','Nghỉ phép']]:[['management','Tổng quan'],['attendance','Chấm công'],['task','Công việc'],['project','Dự án'],...(user().role==='Dev'?[]:[['team','Hiệu suất team']])];return `${tabs(options,tab)}<div class="toolbar">${teamOptions(f)}<input data-filter="date" aria-label="Ngày báo cáo" type="date" value="${f.date}" max="2026-10-19">${button('Xuất CSV','export-current','download')}${button('In báo cáo','print','print')}</div>${tab==='attendance'?`<div class="dashboard-grid">${card('Thống kê chấm công',dateLabel(f.date),attendanceChart(f))}${card('Tổng quan ngày làm việc','Ca chuẩn: 08:30–17:30',`<div class="card-body"><p class="muted">Báo cáo theo nhân viên thuộc phạm vi hiện tại. Nghỉ trưa 12:00–13:00. Giờ công được tính khi có đủ check-in và check-out.</p></div>`)}</div><div class="card">${attendanceTable(f)}</div>`:tab==='task'?taskPage(f):tab==='project'?projectCards(f):tab==='employee'?peoplePage(f):tab==='leave'?approvalPage(f):`<div class="dashboard-grid">${card('Tiến độ dự án','Theo số task hoàn thành',projectChart(f))}${card('Chấm công đội ngũ',dateLabel(f.date),attendanceChart(f))}</div>${workloadPage(f)}`}`;}


// Source: pages/shared/operations.js
function hrPage(f,path){if(path==='/hr/attendance')return '<section class="card attendance-management-page" id="attendance-management-api-root"></section>';if(path==='/hr/leave')return '<section class="card leave-balances-page" id="leave-balances-api-root"></section>';if(apiSession()&&path==='/hr/contracts')return '<section class="card contracts-page" id="contracts-api-root"></section>';if(path==='/hr/organization')return '<section id="organization-api-root"></section>';if(apiSession()&&(path==='/hr/employees'||path.startsWith('/hr/employees/')))return '<section class="card user-admin" id="employees-api-root"></section>';if(path==='/hr/employees')return peoplePage(f);if(path.startsWith('/hr/employees/')){const u=scope.employees(s,user()).find(u=>u.id===path.split('/').pop());if(!u)return empty('Không tìm thấy nhân viên','Hồ sơ nằm ngoài phạm vi của bạn.');return card('Hồ sơ nhân viên','Thông tin công việc tại Intelex',`<div class="card-body">${person(u)}${details([['Chức danh',e(u.position)],['Email',e(u.email)],['Team',e(s.teams.find(t=>t.id===u.teamId)?.name||'Office')],['Ngày gia nhập',dateLabel(u.joinedAt)]])}${scope.can(s,user(),'hr')?button('Sửa hồ sơ','edit-employee','edit','primary',`data-id="${u.id}"`):''}</div>`);} if(path.includes('attendance-reports')||path==='/hr/reports')return reportsPage({...f,tab:f.tab||'attendance'});
 if(path==='/hr/contracts')return `<div class="toolbar">${button('Thêm hợp đồng','new-contract','plus','primary')}</div><div class="card">${table(['Nhân viên','Loại hợp đồng','Bắt đầu','Kết thúc','Trạng thái',''],s.contracts.map(c=>[person(s.users.find(u=>u.id===c.employeeId)),e(c.type),dateLabel(c.startDate),dateLabel(c.endDate),badge(c.endDate<'2026-11-19'?'high':'active',c.endDate<'2026-11-19'?'Sắp hết hạn':'Còn hiệu lực'),button('Sửa','edit-contract','edit','small',`data-id="${c.id}"`)]),{page:f.page})}</div>`;
 const tab=f.tab||'departments';return `${tabs([['departments','Phòng ban'],['teams','Teams'],['positions','Chức vụ']],tab)}<div class="project-grid">${(tab==='departments'?s.departments:tab==='teams'?s.teams:s.positions.map(name=>({name}))).map(x=>`<article class="card project-card"><div class="icon-tile blue">${icon('briefcase',22)}</div><h2>${e(x.name)}</h2><p>${tab==='departments'?s.users.filter(u=>u.departmentId===x.id).length+' nhân sự':tab==='teams'?s.users.filter(u=>u.teamId===x.id).length+' thành viên':'Chức danh tại Intelex'}</p></article>`).join('')}</div>`;
}
function adminPage(f,path){if(path==='/admin/audit-logs'&&apiSession())return '<section class="card user-admin" id="audit-logs-api-root"></section>';if(path==='/admin/settings'&&apiSession())return '<section class="card user-admin" id="system-settings-api-root"></section>';if(path==='/admin/master-data'&&apiSession())return '<section class="card user-admin" id="master-data-api-root"></section>';if(path==='/admin/users'||path==='/admin/users/register')return '<section class="card user-admin" id="users-api-root"></section>';if(path==='/admin/roles'||path==='/admin/permissions')return '<section class="card role-admin" id="roles-api-root"></section>';
 if(path==='/admin/audit-logs')return `<div class="card">${table(['Thời gian','Người thực hiện','Hành động'],s.auditLogs.map(a=>[`${dateLabel(a.createdAt)} ${timeLabel(a.createdAt)}`,e(s.users.find(u=>u.id===a.actorId)?.name),e(a.action)]),{page:f.page})}</div>`;
 if(path==='/admin/settings')return card('Thiết lập công ty','Cấu hình cho bản demo trên trình duyệt',`<div class="card-body"><form data-form="settings" class="settings-form"><div class="form-grid">${field('Tên công ty','companyName','text',s.settings.companyName,'required')}${field('Bắt đầu ca','shiftStart','time',s.settings.shiftStart,'required')}${field('Kết thúc ca','shiftEnd','time',s.settings.shiftEnd,'required')}</div><p class="muted" style="margin-top:15px">Giờ nghỉ trưa cố định 12:00–13:00. Lịch làm việc: thứ Hai–thứ Sáu.</p>${formFooter()}</form></div>`);
 return `${tabs([['departments','Phòng ban'],['positions','Chức vụ'],['leaveTypes','Loại phép']],f.tab||'departments')}<div class="toolbar">${button('Thêm danh mục','new-master','plus','primary')}</div><div class="card">${table(['Tên danh mục',''],(f.tab==='positions'?s.positions:f.tab==='leaveTypes'?s.leaveTypes:s.departments.map(x=>x.name)).map((name,i)=>[e(name),button('Sửa','edit-master','edit','small',`data-index="${i}"`)]))}</div>`;
}


// Source: router.js
const workspaceRequestKinds={'/workspace/leave-requests':'leave','/workspace/overtime':'overtime','/workspace/attendance-adjustments':'adjustment'};
const nav=[
 {name:'Dashboard',icon:'grid',route:'/dashboard',section:'TỔNG QUAN'},
 {name:'My Workspace',icon:'briefcase',route:'/workspace/tasks',children:[['My Tasks','/workspace/tasks'],['My Projects','/workspace/projects'],['My Attendance','/workspace/attendance'],['My Leave','/workspace/leave'],['My Payslips','/workspace/payslips']]},
 {name:'Team Management',icon:'users',route:'/team/overview',children:[['Team Overview','/team/overview'],['Team Members','/team/members'],['Team Tasks','/team/tasks'],['Team Attendance','/team/attendance'],['Team Leave','/team/leave'],['Team Workload','/team/workload'],['Team Reports','/team/reports']]},
 {name:'Project Management',icon:'folder',route:'/projects',children:[['Projects','/projects'],['Tasks','/projects/tasks'],['Milestones','/projects/milestones'],['Members','/projects/members'],['Workload','/projects/workload'],['Timeline','/projects/timeline'],['Project Reports','/projects/reports']]},
 {name:'Human Resources',icon:'person',route:'/hr/employees',section:'QUẢN LÝ & VẬN HÀNH',children:[['Employees','/hr/employees'],['Organization','/hr/organization'],['Contracts','/hr/contracts'],['Attendance','/hr/attendance'],['Work Schedules','/work/schedules'],['Attendance Reports','/hr/attendance-reports'],['Leave Management','/hr/leave'],['HR Reports','/hr/reports']]},
 {name:'Payroll & Compensation',icon:'briefcase',route:'/payroll/management',children:[['Salary Configuration','/payroll/configuration'],['Payroll','/payroll/management'],['Timesheets','/payroll/timesheets']]},
 {name:'Performance Management',icon:'chart',route:'/performance/kpi-results',children:[['KPI Templates','/performance/kpi-templates'],['KPI Results','/performance/kpi-results']]},
 {name:'Approval Center',icon:'approval',route:'/approvals'},
 {name:'Reports & Analytics',icon:'chart',route:'/reports'},
 {name:'Documents',icon:'file',route:'/documents',section:'KHÔNG GIAN CHUNG'},
 {name:'Notifications',icon:'bell',route:'/notifications'},
 {name:'Administration',icon:'settings',route:'/admin/users',children:[['Users','/admin/users'],['Roles','/admin/roles'],['Audit Logs','/admin/audit-logs'],['System Settings','/admin/settings'],['Master Data','/admin/master-data']]}
];
function mainNavigation(){return navigationForScreens(nav,apiSession()?.permissions||[]);}
function getPath(){const path=(location.hash.slice(1).split('?')[0]||'/dashboard').replace(/\/$/,'')||'/dashboard';const legacy={'/screens/WEB_MY_PAYSLIPS':'/workspace/payslips','/screens/WEB_PAYROLL':'/payroll/management','/screens/WEB_SALARY_PROFILES':'/payroll/configuration','/screens/WEB_SALARY_CONFIGURATION':'/payroll/configuration','/screens/WEB_TIMESHEETS':'/payroll/timesheets','/screens/WEB_KPI_TEMPLATES':'/performance/kpi-templates','/screens/WEB_KPI_CONFIGURATION':'/performance/kpi-templates','/screens/WEB_KPI_RESULTS':'/performance/kpi-results','/screens/WEB_KPI_EVALUATION':'/performance/kpi-results','/admin/permissions':'/admin/roles','/screens/WEB_PERMISSIONS':'/admin/roles','/screens/WEB_MY_ATTENDANCE':'/workspace/attendance','/hr/my-attendance':'/workspace/attendance','/screens/WEB_ATTENDANCE':'/hr/attendance','/screens/WEB_WORK_SCHEDULES':'/work/schedules','/workspace/leave-requests':'/workspace/leave?tab=leave','/workspace/overtime':'/workspace/leave?tab=overtime','/workspace/attendance-adjustments':'/workspace/leave?tab=adjustment','/screens/WEB_LEAVE_BALANCES':'/workspace/leave','/screens/WEB_LEAVE':'/hr/leave','/screens/WEB_MY_LEAVE':'/workspace/leave','/screens/WEB_LEAVE_MANAGEMENT':'/hr/leave'};if(legacy[path]){if(typeof location.replace==='function')location.replace('#'+legacy[path]);return legacy[path].split('?')[0];}return path;}
function groupFor(path){if(path==='/admin/users/register')return nav.find(n=>n.name==='Administration');return mainNavigation().find(n=>n.route===path||n.children?.some(c=>c[1]===path))||nav.find(n=>path.startsWith('/projects/')&&n.route==='/projects'||path.startsWith('/hr/employees/')&&n.route==='/hr/employees');}
function isKnown(path){return !!groupFor(path)||/^\/projects\/prj-[\w-]+$/.test(path)||/^\/hr\/employees\/[\w-]+$/.test(path);}


// Source: actions.js
const roles=['Admin','Dev','Leader','Manager','HR'];
function setupActions(ctx){const {render,openDialog,closeDialog,toast}=ctx;const f=ctx.filters;
 function form(title,name,body,dataId=''){openDialog(title,`<form data-form="${name}" data-id="${e(dataId)}"><div class="form-grid">${body}</div>${formFooter()}</form>`);}
 function requestForm(type='leave'){form('Tạo yêu cầu mới','request',selectField('Loại yêu cầu','type',Object.entries({leave:'Nghỉ phép',overtime:'Tăng ca',adjustment:'Điều chỉnh công',general:'Yêu cầu khác'}),type)+selectField('Loại phép (nếu nghỉ)','leaveType',s.leaveTypes.map(x=>[x,x]))+field('Từ ngày','startDate','date','2026-10-21','required min="2026-10-19"')+field('Đến ngày','endDate','date','2026-10-21','required min="2026-10-19"')+field('Số giờ tăng ca (nếu có)','hours','number','2','min="0.5" max="12" step="0.5"')+notesField('Lý do','reason'));}
 function taskForm(task=null){if(!scope.can(s,user(),'task.create')&&!task)throw Error('Bạn không có quyền tạo công việc.');const ps=scope.projects(s,user()),p=ps.find(p=>p.id===(task?.projectId||f().project))||ps[0];form(task?'Cập nhật công việc':'Tạo công việc','task',field('Tên công việc','title','text',task?.title||'','required maxlength="160"')+selectField('Dự án','projectId',ps.map(p=>[p.id,p.name]),p?.id)+selectField('Người phụ trách','assigneeId',scope.employees(s,user()).filter(u=>p?.memberIds.includes(u.id)).map(u=>[u.id,u.name]),task?.assigneeId)+selectField('Trạng thái','status',Object.entries(labels).filter(([k])=>['todo','in_progress','review','done'].includes(k)),task?.status||'todo')+selectField('Ưu tiên','priority',[['low','Thấp'],['medium','Trung bình'],['high','Cao']],task?.priority||'medium')+field('Bắt đầu','startDate','date',task?.startDate||DEMO_DATE,'required')+field('Hạn hoàn thành','dueDate','date',task?.dueDate||'2026-10-23','required')+notesField('Mô tả','description',task?.description||''),task?.id||'');}
 function projectForm(project=null){if(!scope.can(s,user(),'project.create'))throw Error('Bạn không có quyền quản lý dự án.');form(project?'Sửa dự án':'Tạo dự án','project',field('Tên dự án','name','text',project?.name||'','required maxlength="100"')+field('Mã dự án','code','text',project?.code||'','required pattern="[A-Za-z0-9-]+"')+selectField('Team chính','teamId',s.teams.filter(t=>scope.scopedTeams(s,user()).includes(t.id)).map(t=>[t.id,t.name]),project?.teamIds[0])+selectField('Quản lý','managerId',s.users.filter(u=>u.role==='Manager'||u.role==='Admin').filter(u=>user().role==='Admin'||u.id===user().id).map(u=>[u.id,u.name]),project?.managerId||user().id)+field('Bắt đầu','startDate','date',project?.startDate||DEMO_DATE,'required')+field('Deadline','dueDate','date',project?.dueDate||'2026-11-20','required')+notesField('Mô tả','description',project?.description||''),project?.id||'');}
 function employeeForm(u=null,account=false){if(!scope.can(s,user(),account?'admin':'hr'))throw Error('Bạn không có quyền chỉnh sửa nhân sự.');form(u?'Sửa '+(account?'tài khoản':'nhân viên'):'Thêm '+(account?'tài khoản':'nhân viên'),account?'user':'employee',field('Họ tên','name','text',u?.name||'','required maxlength="100"')+field('Email','email','email',u?.email||'','required')+field('Mã nhân viên','employeeCode','text',u?.employeeCode||'','required')+field('Chức danh','position','text',u?.position||'Developer','required')+selectField('Team','teamId',[['','Office'],...s.teams.map(t=>[t.id,t.name])],u?.teamId||'')+selectField('Phòng ban','departmentId',s.departments.map(d=>[d.id,d.name]),u?.departmentId||'engineering')+(account?selectField('Role','role',roles.map(r=>[r,r]),u?.role||'Dev'):'')+field('Ngày gia nhập','joinedAt','date',u?.joinedAt||DEMO_DATE,'required'),u?.id||'');}
 function employeeDetail(userId){const u=[...scope.employees(s,user()),user()].find(u=>u.id===userId);if(!u)throw Error('Hồ sơ ngoài phạm vi của bạn.');openDialog('Hồ sơ nhân viên',`<div class="person">${avatar(u,'lg')}<div><h2>${e(u.name)}</h2><p class="muted">${e(u.position)}</p></div></div>${details([['Mã nhân viên',e(u.employeeCode)],['Email',e(u.email)],['Team',e(s.teams.find(t=>t.id===u.teamId)?.name||'Office')],['Ngày gia nhập',dateLabel(u.joinedAt)],['Role',e(u.role)],['Trạng thái',badge(u.status)]])}${scope.can(s,user(),'hr')?button('Sửa hồ sơ','edit-employee','edit','primary',`data-id="${u.id}"`):''}`);}
 function taskDetail(taskId){const t=scope.tasks(s,user()).find(t=>t.id===taskId);if(!t)throw Error('Bạn không có quyền xem task này.');const editable=scope.can(s,user(),'task.edit',t);openDialog(e(t.code)+' · Chi tiết công việc',`<h2>${e(t.title)}</h2><p class="muted" style="margin-top:14px">${e(t.description)}</p>${details([['Dự án',e(s.projects.find(p=>p.id===t.projectId)?.name)],['Phụ trách',person(s.users.find(u=>u.id===t.assigneeId))],['Ưu tiên',badge(t.priority)],['Hạn hoàn thành',dateLabel(t.dueDate)]])}${editable?`<form data-form="task-status" data-id="${t.id}">${selectField('Cập nhật trạng thái','status',['todo','in_progress','review','done'].map(x=>[x,labels[x]]),t.status)}${formFooter()}</form>${scope.can(s,user(),'task.create')?button('Sửa chi tiết / Giao lại','edit-task','edit','',`data-id="${t.id}"`):''}`:badge(t.status)}`);}
 function requestDetail(requestId){const r=scope.requests(s,user()).find(r=>r.id===requestId);if(!r)throw Error('Yêu cầu ngoài phạm vi của bạn.');const owner=s.users.find(u=>u.id===r.requesterId);openDialog('Chi tiết yêu cầu',`${person(owner)}${details([['Loại yêu cầu',badge(r.type)],['Trạng thái',badge(r.status)],['Từ ngày',dateLabel(r.startDate)],['Đến ngày',dateLabel(r.endDate)]])}<p>${e(r.reason)}</p><hr><h3>Tiến trình phê duyệt</h3><div style="margin:16px 0">${r.history.map(h=>`<div class="timeline-row"><div class="icon-tile blue">${icon('check',14)}</div><div><p>${e(h.label)}</p><small>${e(s.users.find(u=>u.id===h.actorId)?.name)} · ${timeLabel(h.at)}</small></div></div>`).join('')}</div>${scope.can(s,user(),'approve',r)?`<form data-form="decision" data-id="${r.id}"><label>Lý do / Ghi chú <textarea name="reason" placeholder="Bắt buộc khi từ chối hoặc Admin xử lý thay thế"></textarea></label><p class="form-error" role="alert"></p><div class="form-actions"><button class="btn danger" type="submit" name="decision" value="reject">Từ chối</button><button class="btn primary" type="submit" name="decision" value="approve">Đồng ý</button></div></form>`:r.requesterId===user().id&&r.status.startsWith('pending_')?button('Hủy yêu cầu','cancel-request','close','danger',`data-id="${r.id}"`):''}`);}
 async function act(action,el){const itemId=el.dataset.id;switch(action){
 case 'close':closeDialog();if(el.tagName==='A'&&el.hash)location.hash=el.hash;return;
 case 'toggle-sidebar':if(innerWidth<768)document.body.classList.toggle('mobile-open');else document.body.classList.toggle('collapsed');return;
 case 'refresh':render(true);toast('Đã cập nhật dữ liệu mới nhất');return;
 case 'list':case 'grid':case 'kanban':ctx.setFilters({view:action,page:1});render();return;
 case 'account':{const api=apiSession();openDialog('Tài khoản',`<p>${e(api?.user?.userId||'')}</p><p>${e(api?.user?.email||'')}</p><div class="form-actions">${button('Đổi mật khẩu','self-password','shield')}${button('Đăng xuất','backend-logout','logout','danger')}</div>`);return;}
 case 'self-password':{
 const account=apiSession()?.user;if(!account)return;
 openDialog('Đổi mật khẩu',`<form id="self-password-form"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Mật khẩu hiện tại','currentPassword','password','','required autocomplete="current-password"')}${field('Mật khẩu mới','newPassword','password','','required maxlength="1024" autocomplete="new-password"')}${field('Nhập lại mật khẩu mới','confirmPassword','password','','required maxlength="1024" autocomplete="new-password"')}</div><label><input type="checkbox" id="self-password-visible"> Hiện mật khẩu</label><div class="form-actions"><button type="submit" class="btn primary">Đổi mật khẩu</button></div></fieldset><p role="alert" id="self-password-feedback"></p></form>`);
 const form=document.getElementById('self-password-form'),feedback=document.getElementById('self-password-feedback');
 const checkSelfPassword=bindPasswordPolicy(form,{passwordName:'newPassword',confirmName:'confirmPassword',username:()=>account.userId});
 form.querySelector('#self-password-visible').onchange=ev=>{form.querySelectorAll('input[name]').forEach(input=>input.type=ev.target.checked?'text':'password');};
 let saving=false;
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving)return;
 const newPassword=form.elements.newPassword.value;
 if(newPassword!==form.elements.confirmPassword.value){feedback.textContent='Mật khẩu nhập lại không khớp.';return;}
 try{await checkSelfPassword();}catch(err){feedback.textContent=err.message;return;}
 if(saving)return;
 saving=true;form.querySelector('fieldset').disabled=true;feedback.textContent='Đang đổi mật khẩu…';
 try{await apiResetUserPassword(account.userId,null,{type:'SELF_CHANGE',oldPassword:form.elements.currentPassword.value,newPassword});
 form.reset();closeDialog();apiLogout();toast('Đã đổi mật khẩu. Vui lòng đăng nhập lại.');
 }catch(err){if(form.isConnected)feedback.textContent=err.message;}
 finally{saving=false;if(form.isConnected)form.querySelector('fieldset').disabled=false;}
 };return;
 }
 case 'backend-login':openDialog('Đăng nhập backend',`<form data-form="backend-login"><p class="dialog-subtitle">Đăng nhập JWT vào HRM.API đang chạy local.</p><div class="form-grid">${field('User ID','userId','text','admin','required autocomplete="username"')}${field('Mật khẩu','password','password','','required autocomplete="current-password"')}</div>${formFooter()}</form>`);return;
 case 'backend-logout':apiLogout();closeDialog();render(true);toast('Đã đăng xuất backend');return;
 case 'confirm-reset':openDialog('Khôi phục bản demo?',`<p>Toàn bộ thay đổi trên trình duyệt sẽ được xóa và khôi phục dữ liệu mẫu ban đầu.</p><div class="form-actions">${button('Hủy','close')}${button('Khôi phục dữ liệu','reset','refresh','danger')}</div>`);return;
 case 'reset':reset();ctx.resetFilters();closeDialog();location.hash='/dashboard';render(true);toast('Đã khôi phục dữ liệu mẫu');return;
 case 'notifications':openDialog('Thông báo của bạn',`${notifications(5)}<div class="form-actions"><a class="btn primary" href="#/notifications" data-action="close">Xem tất cả</a></div>`);return;
 case 'read-all':if(apiSession()){await notificationService.readAll();return;}s.notifications.filter(n=>n.recipientId===user().id).forEach(n=>n.readAt=NOW);save();render(true);toast('Đã đánh dấu tất cả đã đọc');return;
 case 'employee':employeeDetail(itemId);return;
 case 'task':taskDetail(itemId);return;
 case 'request':requestDetail(itemId);return;
 case 'new-task':taskForm();return;
 case 'edit-task':{const t=scope.tasks(s,user()).find(t=>t.id===itemId);if(!t||!scope.can(s,user(),'task.create'))throw Error('Không có quyền sửa.');taskForm(t);return;}
 case 'new-project':projectForm();return;
 case 'edit-project':{const p=scope.projects(s,user()).find(p=>p.id===itemId);if(!p)throw Error('Không tìm thấy dự án.');projectForm(p);return;}
 case 'new-employee':if(apiSession())openEmployeeCreation({openDialog,closeDialog,toast,render});else employeeForm();return;
 case 'new-user':employeeForm(null,true);return;
 case 'edit-employee':case 'edit-user':{const u=scope.employees(s,user()).find(u=>u.id===itemId);if(!u)throw Error('Không tìm thấy nhân viên.');employeeForm(u,action==='edit-user');return;}
 case 'new-contract':case 'edit-contract':{if(!scope.can(s,user(),'hr'))throw Error('Không có quyền.');const c=s.contracts.find(c=>c.id===itemId);form(c?'Sửa hợp đồng':'Thêm hợp đồng','contract',selectField('Nhân viên','employeeId',scope.employees(s,user()).map(u=>[u.id,u.name]),c?.employeeId)+selectField('Loại hợp đồng','type',[['Hợp đồng lao động','Hợp đồng lao động'],['Thử việc','Thử việc'],['Cộng tác viên','Cộng tác viên']],c?.type)+field('Bắt đầu','startDate','date',c?.startDate||DEMO_DATE,'required')+field('Kết thúc','endDate','date',c?.endDate||'2027-10-19','required'),c?.id||'');return;}
 case 'new-request':requestForm();return;
 case 'new-adjustment':requestForm('adjustment');return;
 case 'cancel-request':cancelRequest(itemId);closeDialog();render(true);toast('Đã hủy yêu cầu');return;
 case 'check-in':case 'check-out':{let a=s.attendance.find(a=>a.userId===user().id&&a.date===DEMO_DATE);if(a?.leaveRequestId)throw Error('Bạn đang có lịch nghỉ phép.');if(action==='check-in'){if(a?.checkIn)throw Error('Bạn đã check-in hôm nay.');if(!a){a={id:id('att'),userId:user().id,date:DEMO_DATE,shiftId:'standard',checkOut:null};s.attendance.push(a);}a.checkIn=demoNow();}else{if(!a?.checkIn||a.checkOut)throw Error('Cần check-in trước hoặc bạn đã check-out.');const at=demoNow();a.checkOut=at>a.checkIn?at:new Date(Date.parse(a.checkIn)+421*60000).toISOString().slice(0,19)+'+07:00';}log('đã '+action);render();toast('Đã '+action+' lúc '+timeLabel(action==='check-in'?a.checkIn:a.checkOut)+' (giờ demo)');return;}
 case 'export-attendance':{const rows=attendanceRows(f());csvDownload('intelex-attendance-'+f().date,['Mã NV','Họ tên','Ngày','Check-in','Check-out','Giờ công','Trạng thái'],rows.map(({u,a})=>[u.employeeCode,u.name,f().date,timeLabel(a?.checkIn),timeLabel(a?.checkOut),hours(a,s.settings),labels[attendanceStatus(a)]]));toast('Đã xuất CSV theo bộ lọc hiện tại');return;}
 case 'export-current':{const tab=f().tab||'management';if(tab==='task'){csvDownload('intelex-tasks',['Mã','Tên','Dự án','Trạng thái','Hạn'],scope.tasks(s,user()).filter(t=>!f().status||t.status===f().status).filter(t=>!f().search||(t.title+t.code).toLowerCase().includes(f().search.toLowerCase())).map(t=>[t.code,t.title,s.projects.find(p=>p.id===t.projectId)?.name,labels[t.status],t.dueDate]));}else if(tab==='project'){csvDownload('intelex-projects',['Mã','Tên','Bắt đầu','Kết thúc','Trạng thái'],scope.projects(s,user()).filter(p=>!f().search||(p.name+p.code).toLowerCase().includes(f().search.toLowerCase())).map(p=>[p.code,p.name,p.startDate,p.dueDate,labels[p.health]]));}else{exportReport(f());}toast('Đã xuất dữ liệu trong phạm vi của bạn');return;}
 case 'export-report':exportReport(f());toast('Đã xuất báo cáo theo bộ lọc');return;
 case 'print':window.print();return;
 case 'document':{const d=scope.documents(s,user()).find(d=>d.id===itemId);if(!d)throw Error('Không có quyền xem tài liệu.');if(!d.fileUrl){openDialog(e(d.name),'<p class="muted">Bản ghi chỉ lưu tên và metadata trong demo, chưa có tệp được tải lên.</p>');return;}const text=DOCUMENT_CONTENTS[d.fileUrl];if(typeof text!=='string')throw Error('Không tìm thấy nội dung tài liệu mẫu.');openDialog(e(d.name),`<pre style="white-space:pre-wrap;font:inherit;font-size:12px;color:#6b7d96">${e(text)}</pre><hr>${downloadLink(d.fileUrl)}`);return;}
 case 'new-document':form('Thêm tài liệu (metadata)','document',field('Tên tài liệu','name','text','','required')+selectField('Nhóm','category',[['company','Công ty'],['shared','Được chia sẻ'],['project','Dự án']])+selectField('Dự án (nếu có)','projectId',scope.projects(s,user()).map(p=>[p.id,p.name]))+field('Tên file (không upload)','filename','text','','required'));return;
 case 'toggle-user':if(!scope.can(s,user(),'admin')||itemId===user().id)throw Error('Không thể khóa tài khoản này.');openDialog('Thay đổi trạng thái tài khoản?',`<p>Tài khoản bị khóa sẽ không xuất hiện trong danh sách người dùng demo.</p><div class="form-actions">${button('Hủy','close')}${button('Xác nhận','confirm-toggle-user','shield','primary',`data-id="${itemId}"`)}</div>`);return;
 case 'confirm-toggle-user':{if(!scope.can(s,user(),'admin')||itemId===user().id)throw Error('Không có quyền.');const u=s.users.find(u=>u.id===itemId);u.status=u.status==='active'?'locked':'active';log('đã đổi trạng thái tài khoản '+u.name);closeDialog();render();toast('Đã lưu trạng thái');return;}
 case 'new-master':case 'edit-master':{if(!scope.can(s,user(),'admin'))throw Error('Không có quyền.');const key=f().tab||'departments',index=el.dataset.index,value=key==='departments'?s.departments[index]?.name:s[key][index];form('Danh mục hệ thống','master',field('Tên danh mục','name','text',value||'','required')+`<input type="hidden" name="key" value="${key}"><input type="hidden" name="index" value="${index??''}">`);return;}
 default:throw Error('Thao tác không được hỗ trợ.');}}
 document.addEventListener('click',ev=>{const notification=ev.target.closest('[data-notification]');if(notification){const n=s.notifications.find(n=>n.id===notification.dataset.notification&&n.recipientId===user().id);if(n){n.readAt=NOW;save();if(document.getElementById('modal').open)closeDialog();}}const el=ev.target.closest('[data-action],[data-open]');if(!el)return;ev.preventDefault();const action=el.dataset.open||el.dataset.action;Promise.resolve().then(()=>act(action,el)).catch(err=>toast(err.message,{type:'error'}));});
 document.addEventListener('change',ev=>{const el=ev.target;if(el.name==='projectId'&&el.closest('[data-form="task"]')){const p=scope.projects(s,user()).find(p=>p.id===el.value),sel=el.closest('form').querySelector('[name="assigneeId"]');sel.innerHTML=scope.employees(s,user()).filter(u=>p?.memberIds.includes(u.id)).map(u=>`<option value="${u.id}">${e(u.name)}</option>`).join('');}});
 document.addEventListener('submit',ev=>{const formEl=ev.target.closest('[data-form]');if(!formEl)return;ev.preventDefault();const data=Object.fromEntries(new FormData(formEl));Object.keys(data).forEach(k=>{if(typeof data[k]==='string')data[k]=data[k].trim();});const formType=formEl.dataset.form,itemId=formEl.dataset.id;try{switch(formType){
 case 'task-status':updateTask(itemId,data.status);break;
 case 'task':{if(!scope.can(s,user(),'task.create'))throw Error('Bạn không có quyền tạo/giao task.');if(!data.title||!data.assigneeId)throw Error('Điền tên và chọn người phụ trách.');if(data.dueDate<data.startDate)throw Error('Hạn hoàn thành không được trước ngày bắt đầu.');const p=scope.projects(s,user()).find(p=>p.id===data.projectId);if(!p||!p.memberIds.includes(data.assigneeId)||!scope.employees(s,user()).some(u=>u.id===data.assigneeId))throw Error('Người phụ trách phải thuộc team và dự án.');if(itemId){const t=scope.tasks(s,user()).find(t=>t.id===itemId);if(!t)throw Error('Không có quyền sửa.');Object.assign(t,data);}else s.tasks.push({...data,id:id('tsk'),code:p.code+'-'+String(s.tasks.filter(t=>t.projectId===p.id).length+1).padStart(3,'0')});log('đã lưu công việc '+data.title,p.id);break;}
 case 'project':{if(!scope.can(s,user(),'project.create'))throw Error('Không có quyền quản lý dự án.');if(data.dueDate<data.startDate)throw Error('Deadline không được trước ngày bắt đầu.');if(s.projects.some(p=>p.code.toLowerCase()===data.code.toLowerCase()&&p.id!==itemId))throw Error('Mã dự án đã tồn tại.');if(!scope.scopedTeams(s,user()).includes(data.teamId))throw Error('Team ngoài phạm vi của bạn.');const {teamId,...rest}=data;if(itemId){const p=scope.projects(s,user()).find(p=>p.id===itemId);if(!p)throw Error('Không có quyền.');Object.assign(p,rest,{teamIds:[teamId],memberIds:s.users.filter(u=>u.teamId===teamId).map(u=>u.id)});}else s.projects.push({...rest,id:id('prj'),teamIds:[teamId],memberIds:s.users.filter(u=>u.teamId===teamId).map(u=>u.id),status:'in_progress',health:'on_track',color:'blue'});log('đã lưu dự án '+data.name);break;}
 case 'contract':{if(!scope.can(s,user(),'hr'))throw Error('Không có quyền.');if(data.endDate<data.startDate)throw Error('Ngày kết thúc phải từ ngày bắt đầu trở đi.');if(!s.users.some(u=>u.id===data.employeeId))throw Error('Nhân viên không tồn tại.');if(itemId){const c=s.contracts.find(c=>c.id===itemId);if(!c)throw Error('Không tìm thấy hợp đồng.');Object.assign(c,data);}else s.contracts.push({...data,id:id('ctr'),status:'active'});log('đã lưu hợp đồng nhân sự');break;}
 case 'request':createRequest(data);break;
 case 'decision':decideRequest(itemId,ev.submitter?.value==='approve',data.reason);break;
 case 'employee':case 'user':{if(!scope.can(s,user(),formType==='user'?'admin':'hr'))throw Error('Không có quyền.');if(s.users.some(u=>u.id!==itemId&&(u.email.toLowerCase()===data.email.toLowerCase()||u.employeeCode===data.employeeCode)))throw Error('Email hoặc mã nhân viên đã tồn tại.');if(itemId===user().id&&data.role&&data.role!==user().role)throw Error('Không đổi role tài khoản Admin đang sử dụng.');if(itemId){const u=s.users.find(u=>u.id===itemId);Object.assign(u,data,{teamId:data.teamId||null});}else{const uid=id('usr');s.users.push({...data,id:uid,role:data.role||'Dev',teamId:data.teamId||null,status:'active',managedTeamIds:[]});s.leaveBalances.push({userId:uid,year:2026,allowanceDays:12,usedDays:0});}log('đã lưu nhân sự '+data.name);break;}
 case 'backend-login':login(data.userId,data.password).then(()=>{closeDialog();render(true);toast('Đăng nhập backend thành công');}).catch(err=>{const error=formEl.querySelector('.form-error');if(error)error.textContent=err.message;else toast(err.message,{type:'error'});});return;
 case 'settings':if(!scope.can(s,user(),'admin'))throw Error('Không có quyền.');if(data.shiftStart>=data.shiftEnd||data.shiftStart>'12:00'||data.shiftEnd<'13:00')throw Error('Ca làm việc phải bao gồm giờ nghỉ trưa 12:00–13:00.');Object.assign(s.settings,data);log('đã cập nhật cấu hình');break;
 case 'document':if(data.category==='company'&&!['HR','Admin'].includes(user().role))throw Error('Chỉ HR/Admin thêm tài liệu công ty.');if(data.category==='project'&&!scope.projects(s,user()).some(p=>p.id===data.projectId))throw Error('Không có quyền với dự án.');s.documents.push({id:id('doc'),name:data.name+' · '+data.filename,category:data.category,projectId:data.category==='project'?data.projectId:null,visibility:data.category==='project'?'project':'company',ownerId:user().id,fileUrl:null,updatedAt:DEMO_DATE});log('đã thêm metadata tài liệu');break;
 case 'master':{if(!scope.can(s,user(),'admin')||!['departments','positions','leaveTypes'].includes(data.key))throw Error('Không có quyền.');const list=s[data.key];if(data.index==='')list.push(data.key==='departments'?{id:id('dep'),name:data.name}:data.name);else if(data.key==='departments')list[Number(data.index)].name=data.name;else list[Number(data.index)]=data.name;log('đã cập nhật danh mục');break;}
 default:throw Error('Form không hợp lệ.');}
 save();if(document.getElementById('modal').open)closeDialog();render(true);toast('Đã lưu thay đổi thành công');}catch(err){const error=formEl.querySelector('.form-error');if(error)error.textContent=err.message;else toast(err.message,{type:'error'});}});
 document.getElementById('modal').addEventListener('click',ev=>{if(ev.target===ev.currentTarget){const box=ev.currentTarget.getBoundingClientRect();if(ev.clientX<box.left||ev.clientX>box.right||ev.clientY<box.top||ev.clientY>box.bottom)closeDialog();}});
}

// Source: app.js
const newFilters=()=>({search:'',status:'',team:'',project:'',date:'2026-10-19',page:1,size:10,view:'',tab:'',sort:''});
let filters=newFilters(),expanded=new Set(),lastPath='',searchTimer,disposeNotificationsPage=()=>{},disposeOrganizationPage=()=>{},disposeAttendancePage=()=>{},disposeKpiPage=()=>{};
const app=document.getElementById('app');
function pageTitle(path){const titles={'/workspace/payslips':'Phiếu lương của tôi','/payroll/configuration':'Cấu hình lương','/payroll/management':'Quản lý bảng lương','/payroll/timesheets':'Quản lý bảng công','/performance/kpi-templates':'Thiết lập KPI','/admin/users/register':'Đăng ký tài khoản','/dashboard':'Tổng quan quản lý','/workspace/tasks':'Công việc của tôi','/workspace/projects':'Dự án của tôi','/workspace/attendance':'Chấm công cá nhân','/performance/kpi-results':'Đánh giá KPI','/work/schedules':'Lịch phân ca','/workspace/leave':'Nghỉ phép của tôi','/workspace/leave-requests':'Nghỉ phép của tôi','/workspace/overtime':'Tăng ca của tôi','/workspace/attendance-adjustments':'Điều chỉnh công của tôi','/team/overview':'Đội ngũ của bạn','/team/members':'Thành viên team','/team/tasks':'Công việc của team','/team/attendance':'Chấm công team','/team/leave':'Nghỉ phép team','/team/workload':'Phân bổ công việc','/team/reports':'Báo cáo team','/projects':'Quản lý dự án','/projects/tasks':'Tất cả công việc','/projects/milestones':'Milestones','/projects/members':'Thành viên dự án','/projects/workload':'Workload','/projects/timeline':'Timeline dự án','/projects/reports':'Báo cáo dự án','/hr/employees':'Quản lý nhân sự','/hr/organization':'Cơ cấu tổ chức','/hr/contracts':'Hợp đồng lao động','/hr/attendance':'Quản lý chấm công','/hr/attendance-reports':'Báo cáo chấm công','/hr/leave':'Leave Management','/hr/reports':'Báo cáo nhân sự','/approvals':'Trung tâm phê duyệt','/reports':'Báo cáo & Phân tích','/documents':'Thư viện tài liệu','/notifications':'Thông báo','/admin/users':'Quản lý tài khoản','/admin/roles':'Vai trò hệ thống','/admin/permissions':'Phân quyền','/admin/audit-logs':'Nhật ký hệ thống','/admin/settings':'Cấu hình hệ thống','/admin/master-data':'Dữ liệu danh mục'};return path==='/dashboard'&&user().role!=='Manager'?`Tổng quan ${user().role==='Dev'?'cá nhân':user().role==='HR'?'nhân sự':user().role==='Admin'?'hệ thống':'team'}`:titles[path]||(path.startsWith('/screens/')?screenNavigationLabel(apiSession()?.permissions?.find(p=>p.code===path.split('/').pop())||{code:path.split('/').pop()}):path.startsWith('/projects/')?'Chi tiết dự án':path.startsWith('/hr/employees/')?'Hồ sơ nhân viên':'Không tìm thấy trang');}
function loginScreen(){
 disposeKpiPage();disposeKpiPage=()=>{};
 disposeAttendancePage();disposeAttendancePage=()=>{};
 disposeNotificationsPage();disposeNotificationsPage=()=>{};
 document.title='Đăng nhập · Intelex';
 app.innerHTML=`<main class="login-page"><form id="login-form" class="login-card"><img src="assets/images/logo.svg" alt="Intelex" width="48"><h1>Đăng nhập Intelex</h1><p>Đăng nhập bằng tài khoản được cấp để vào không gian làm việc.</p><label>User ID<input name="userId" autocomplete="username" required autofocus></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label><p id="login-error" role="alert"></p><button class="btn primary" type="submit">Đăng nhập</button></form></main>`;
 document.getElementById('login-form').addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.currentTarget,submit=form.querySelector('button');submit.disabled=true;
 try{await login(form.elements.userId.value.trim(),form.elements.password.value);const destination=mainNavigation().flatMap(n=>n.children?n.children.map(c=>c[1]):[n.route]).find(p=>scope.routeAllowed(s,user(),p));location.hash=destination||'/dashboard';navigate();}
 catch(err){document.getElementById('login-error').textContent=err.message;submit.disabled=false;}
 });
}
function shell(){if(!apiSession()){loginScreen();return;}
const path=getPath(),apiRolePage=path==='/workspace/payslips'||path.startsWith('/payroll/')||path==='/performance/kpi-templates'||path==='/performance/kpi-results'||path==='/workspace/attendance'||path==='/hr/attendance'||path==='/work/schedules'||!!workspaceRequestKinds[path]||path==='/hr/leave'||path==='/admin/roles'||path==='/admin/permissions'||path==='/approvals'||path==='/workspace/leave'||path.startsWith('/screens/'),u=apiRolePage?roleSessionIdentity():user();let unread=notificationService.snapshot().count||0,pending=approvalCountService.snapshot().count||0;app.innerHTML=`<div class="mobile-backdrop" data-action="toggle-sidebar"></div><aside class="sidebar" aria-label="Thanh điều hướng"><a class="brand" href="#/dashboard"><img src="assets/images/logo.svg" alt=""><div><div class="brand-name">intelex<span>.</span></div><small>PEOPLE & WORK</small></div></a><nav class="nav-scroll" aria-label="Menu chính">${mainNavigation().map(n=>{const children=n.children?.filter(([,p])=>scope.routeAllowed(s,u,p));return {...n,children,route:children?.[0]?.[1]||n.route};}).filter(n=>scope.routeAllowed(s,u,n.route)).map(n=>{const active=n.name===groupFor(path)?.name,open=expanded.has(n.name)&&n.children;return `${n.section?`<div class="nav-caption">${n.section}</div>`:''}<div style="position:relative"><a class="nav-item ${active?'active':''}" title="${n.name}" href="#${n.route}" ${active?'aria-current="page"':''}>${icon(n.icon,18)}<span class="nav-label">${n.name}</span>${n.name==='Approval Center'?`<span class="badge count" data-approval-nav-count ${pending?'':'hidden'}>${pending>99?'99+':pending}</span>`:n.name==='Notifications'&&unread?`<span class="badge count" data-notification-nav-count>${unread}</span>`:n.name==='Notifications'?'<span class="badge count" data-notification-nav-count hidden></span>':n.children?`<span class="chev">${icon('chevron',12)}</span>`:''}</a>${n.children?`<button class="icon-button nav-expand" style="position:absolute;right:0;top:8px;width:23px" data-expand="${n.name}" aria-label="Mở menu ${n.name}" aria-expanded="${!!open}"></button>`:''}</div>${open?`<div class="submenu">${n.children.filter(([,p])=>scope.routeAllowed(s,u,p)).map(([label,p])=>`<a href="#${p}" class="${p===path?'active':''}">${label}</a>`).join('')}</div>`:''}`;}).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-user">${avatar(u)}<div><strong>${e(apiSession()?.user?.userId||u.name.split(' ').slice(-2).join(' '))}</strong><small>${e(u.role)} · Intelex</small></div><button class="icon-button" data-action="account" aria-label="Tài khoản">${icon('more')}</button></div></div></aside><header class="topbar"><div class="top-left"><button class="icon-button" data-action="toggle-sidebar" aria-label="Thu gọn hoặc mở menu">${icon('menu',18)}</button><div class="breadcrumb"><a href="#/dashboard" aria-label="Trang chủ">${icon('grid',14)}</a><span>/</span><strong>${e(groupFor(path)?.name||'Intelex')}</strong></div></div><div class="top-right"><div class="global-search" ${apiRolePage?'hidden':''}>${icon('search',17)}<input id="global-search" placeholder="Tìm kiếm mọi thứ…" aria-label="Tìm kiếm toàn cục" autocomplete="off"><span class="kbd">⌘ K</span><div id="search-results" class="search-results"></div></div><span class="top-divider"></span><div id="notification-header" class="notification-header"></div><span class="top-divider"></span><div class="account-menu-wrap"><button class="icon-button top-user" style="width:auto" data-action="account" aria-label="Menu tài khoản" aria-expanded="false" aria-controls="top-account-menu">${avatar(u)}<div style="text-align:left"><strong>${e(apiSession()?.user?.userId||u.name.split(' ').slice(-2).join(' '))}</strong><small>${e(u.role)}</small></div>${icon('down',12)}</button><div class="account-dropdown" id="top-account-menu" hidden><button type="button" class="btn" data-action="self-password">Đổi mật khẩu</button><button type="button" class="btn" data-action="logout">Đăng xuất</button></div></div></div></header><main class="main" id="main" tabindex="-1"><div class="content" id="content"></div></main>`;renderNotificationHeader(document.getElementById('notification-header'));renderContent();}
function header(path){if(path==='/hr/leave')return '';const u=user(),home=path==='/dashboard';const primary=(path.includes('tasks')&&scope.can(s,u,'task.create'))?button('Tạo công việc','new-task','plus','primary'):path==='/projects'&&scope.can(s,u,'project.create')?button('Tạo dự án','new-project','plus','primary'):path==='/hr/employees'&&scope.can(s,u,'hr')?button('Thêm nhân viên','new-employee','plus','primary'):'';return `<div class="page-heading"><div><div class="eyebrow">${home?'YOUR WORK, CONNECTED':'INTELEX WORKSPACE'}</div><h1>${pageTitle(path)}${home?'<span style="color:#d7aa64;font-weight:400;margin-left:9px">✦</span>':''}</h1><p>${home?`Chào ${e(u.name.split(' ').pop())}, cùng xem đội ngũ đang làm việc thế nào hôm nay.`:'Một không gian chung để kết nối con người và công việc.'}</p></div><div class="heading-actions">${home?`${teamOptions(filters)}<input type="date" aria-label="Ngày dashboard" data-filter="date" value="${filters.date}" max="2026-10-19">${button('','refresh','refresh','','aria-label="Làm mới dashboard"')}`:primary}</div></div>`;}
function routeTabs(path){const group=groupFor(path);if(!group?.children||path.startsWith('/projects/prj-')||/^\/hr\/employees\/.+/.test(path))return '';return `<div class="tabs route-tabs">${group.children.filter(([,p])=>scope.routeAllowed(s,user(),p)).map(([name,p])=>`<a class="tab ${p===path?'active':''}" href="#${p}">${name}</a>`).join('')}</div>`;}
function view(path){if(!scope.routeAllowed(s,user(),path))return empty('403 · Không có quyền truy cập','Chọn mục được cấp quyền trong menu.')+'<a class="btn primary" href="#/dashboard">Về Dashboard</a>';if(!isKnown(path))return empty('404 · Trang không tồn tại','Kiểm tra đường dẫn hoặc trở về Dashboard.')+'<a class="btn primary" href="#/dashboard">Về Dashboard</a>';if(path==='/workspace/payslips')return '<section class="card payroll-page" id="my-payslips-api-root"></section>';if(path.startsWith('/payroll/'))return '<section class="card payroll-page" id="payroll-api-root"></section>';if(path==='/performance/kpi-templates')return '<section class="card kpi-templates-page" id="kpi-templates-api-root"></section>';if(path==='/performance/kpi-results')return '<section class="card kpi-results-page" id="kpi-results-api-root"></section>';if(path==='/work/schedules')return '<section class="card work-schedules-page" id="work-schedules-api-root"></section>';if(workspaceRequestKinds[path])return '<section class="card user-admin" id="workspace-requests-api-root"></section>';if(path.startsWith('/screens/'))return `<section class="card user-admin"><h2>${e(pageTitle(path))}</h2><p class="muted">Màn hình này chưa tích hợp API nghiệp vụ.</p></section>`;if(path==='/dashboard')return dashboard(filters);if(path==='/workspace/tasks')return taskPage(filters,true);if(path==='/workspace/projects')return projectCards(filters,true);if(path==='/workspace/attendance')return '<section class="card attendance-management-page" id="my-attendance-api-root"></section>';if(path==='/workspace/leave')return '<section class="card user-admin" id="my-leave-api-root"></section>';if(path.startsWith('/team/'))return teamPage(filters,path);if(path==='/projects')return projectCards(filters);if(path==='/projects/tasks')return taskPage(filters);if(path==='/projects/members')return peoplePage(filters);if(path==='/projects/workload')return workloadPage(filters);if(path==='/projects/milestones'||path==='/projects/timeline')return timelinePage(filters);if(path==='/projects/reports'||path==='/reports')return reportsPage(filters);if(path.startsWith('/projects/'))return projectDetail(filters,path.split('/').pop());if(path.startsWith('/hr/'))return hrPage(filters,path);if(path==='/approvals')return '<section class="card user-admin" id="approvals-api-root"></section>';if(path==='/documents')return documentsPage(filters);if(path==='/notifications')return '<section class="card user-admin" id="notifications-api-root"></section>';if(path.startsWith('/admin/'))return adminPage(filters,path);return empty();}
let disposePayrollPage=()=>{};
function renderContent(){disposePayrollPage();disposePayrollPage=()=>{};disposeKpiPage();disposeKpiPage=()=>{};disposeAttendancePage();disposeAttendancePage=()=>{};disposeOrganizationPage();disposeOrganizationPage=()=>{};disposeNotificationsPage();disposeNotificationsPage=()=>{};const path=getPath();document.title=`${pageTitle(path)} · Intelex`;document.getElementById('content').innerHTML=header(path)+routeTabs(path)+view(path)+`<footer class="main-footer"><span>© 2026 Intelex. Built for our people.</span><span class="live-status">${path==='/workspace/payslips'?'Phiếu lương cá nhân từ API':path.startsWith('/payroll/')?'Dữ liệu lương từ API':path==='/performance/kpi-templates'?'Thiết lập KPI từ API':path==='/performance/kpi-results'?'Đánh giá KPI từ API':path==='/workspace/attendance'||path==='/hr/attendance'?'Chấm công từ API':path==='/work/schedules'?'Lịch phân ca từ API':workspaceRequestKinds[path]?'Yêu cầu cá nhân từ API':path==='/hr/leave'||path==='/workspace/leave'?'Số dư phép từ API':path.startsWith('/screens/')?'Truy cập theo quyền màn hình':path==='/approvals'?'Yêu cầu và phê duyệt từ API':path==='/admin/roles'||path==='/admin/permissions'?'Vai trò và phân quyền từ API':path==='/hr/contracts'?'Hợp đồng từ API':path==='/hr/organization'?'Cơ cấu tổ chức từ API':path==='/notifications'?'Thông báo từ API · Giờ Việt Nam (UTC+7)':path==='/admin/audit-logs'?'Nhật ký từ API · Giờ Việt Nam (UTC+7)':'Dữ liệu demo · 19/10/2026 · Chỉ lưu trên trình duyệt'}</span><a href="#/documents">People first. Progress together.</a></footer>`;if((path==='/admin/users'||path==='/admin/users/register')&&scope.routeAllowed(s,user(),path))mountUsers(document.getElementById('users-api-root'),filters,path==='/admin/users/register');if(path==='/workspace/payslips'&&scope.routeAllowed(s,user(),path))disposePayrollPage=mountMyPayslips(document.getElementById('my-payslips-api-root'));if(path.startsWith('/payroll/')&&scope.routeAllowed(s,user(),path))disposePayrollPage=path==='/payroll/configuration'?mountSalaryConfiguration(document.getElementById('payroll-api-root')):mountPayrollManagement(document.getElementById('payroll-api-root'),{timesheets:path==='/payroll/timesheets'});if(path==='/performance/kpi-templates'&&scope.routeAllowed(s,user(),path))disposeKpiPage=mountKpiTemplates(document.getElementById('kpi-templates-api-root'));if(path==='/performance/kpi-results'&&scope.routeAllowed(s,user(),path))disposeKpiPage=mountKpiResults(document.getElementById('kpi-results-api-root'));if(path==='/workspace/attendance'&&scope.routeAllowed(s,user(),path))disposeAttendancePage=mountAttendanceManagement(document.getElementById('my-attendance-api-root'),{own:true});if(path==='/hr/attendance'&&scope.routeAllowed(s,user(),path))disposeAttendancePage=mountAttendanceManagement(document.getElementById('attendance-management-api-root'));if(path==='/work/schedules'&&scope.routeAllowed(s,user(),path))mountWorkSchedules(document.getElementById('work-schedules-api-root'));if(path==='/hr/leave'&&scope.routeAllowed(s,user(),path))mountLeaveBalances(document.getElementById('leave-balances-api-root'));if(workspaceRequestKinds[path]&&scope.routeAllowed(s,user(),path))mountApprovals(document.getElementById('workspace-requests-api-root'),{}, {kind:workspaceRequestKinds[path],own:true});if(path==='/workspace/leave'&&scope.routeAllowed(s,user(),path))mountMyLeave(document.getElementById('my-leave-api-root'));if(path==='/approvals'&&scope.routeAllowed(s,user(),path))mountApprovals(document.getElementById('approvals-api-root'),filters);if(path==='/hr/contracts'&&scope.routeAllowed(s,user(),path))mountContracts(document.getElementById('contracts-api-root'));if(path==='/hr/organization'&&scope.routeAllowed(s,user(),path))disposeOrganizationPage=mountOrganization(document.getElementById('organization-api-root'));if(path==='/notifications')disposeNotificationsPage=mountNotifications(document.getElementById('notifications-api-root'));if(path==='/admin/audit-logs'&&scope.routeAllowed(s,user(),path))mountAuditLogs(document.getElementById('audit-logs-api-root'));if(path==='/admin/settings'&&scope.routeAllowed(s,user(),path))mountSystemSettings(document.getElementById('system-settings-api-root'),filters);if(path==='/admin/master-data'&&scope.routeAllowed(s,user(),path))mountMasterData(document.getElementById('master-data-api-root'),filters);if((path==='/admin/roles'||path==='/admin/permissions')&&scope.routeAllowed(s,user(),path))mountRoles(document.getElementById('roles-api-root'),filters);if((path==='/hr/employees'||path.startsWith('/hr/employees/'))&&scope.routeAllowed(s,user(),path))mountEmployees(document.getElementById('employees-api-root'),filters,path==='/hr/employees'?null:decodeURIComponent(path.split('/').pop()));}
function render(full=false){if(!apiSession()){loginScreen();return;}if(full)shell();else renderContent();}
function navigate(){if(lastPath!==getPath()){filters=newFilters();document.body.classList.remove('mobile-open');lastPath=getPath();const g=groupFor(lastPath);if(g?.children)expanded.add(g.name);if(document.getElementById('modal').open)closeDialog();}shell();window.scrollTo(0,0);}
window.addEventListener('hashchange',navigate);
window.addEventListener('auth-change',()=>{clearToasts();void approvalCountService.syncAuth();void notificationService.syncAuth();closeDialog();navigate();});
window.addEventListener('session-change',()=>{clearToasts();void approvalCountService.syncAuth();void notificationService.syncAuth();});
window.addEventListener('pagehide',()=>{approvalCountService.stop();void notificationService.stop();});
window.addEventListener('pageshow',()=>{void approvalCountService.syncAuth();void notificationService.syncAuth();});
window.addEventListener('online',()=>{void approvalCountService.syncAuth();void approvalCountService.refresh();void notificationService.syncAuth();void notificationService.refresh();});
setInterval(()=>{if(!apiSession()&&!document.getElementById('login-form'))loginScreen();},30000);
app.addEventListener('click',ev=>{if(ev.target.closest('[data-action="logout"]')){apiLogout();return;}const exp=ev.target.closest('[data-expand]');if(exp){const n=exp.dataset.expand;expanded.has(n)?expanded.delete(n):expanded.add(n);shell();return;}const p=ev.target.closest('[data-page]');if(p){filters.page=Number(p.dataset.page);render();}const tab=ev.target.closest('[data-tab]');if(tab){filters.tab=tab.dataset.tab;filters.page=1;render();}const sort=ev.target.closest('[data-sort]');if(sort){filters.sort=sort.dataset.sort;render();}const nf=ev.target.closest('[data-notification]');if(nf){const n=s.notifications.find(x=>x.id===nf.dataset.notification&&x.recipientId===user().id);if(n){n.readAt='2026-10-19T10:00:00+07:00';save();}}});
document.addEventListener('change',ev=>{const el=ev.target;if(el.matches('[data-filter]')){filters[el.dataset.filter]=el.value;filters.page=1;render();}if(el.id==='demo-user'){switchUser(el.value);filters=newFilters();closeDialog();if(getPath()==='/dashboard')shell();else location.hash='/dashboard';toast('Đã chuyển tài khoản demo');}});
document.addEventListener('input',ev=>{const el=ev.target;if(el.matches('[data-filter="search"]')){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const cursor=el.selectionStart;filters.search=el.value;filters.page=1;render();const input=document.querySelector('[data-filter="search"]');input?.focus();input?.setSelectionRange(cursor,cursor);},220);}if(el.id==='global-search'){if(getPath()==='/admin/roles'||getPath()==='/admin/permissions'||getPath().startsWith('/screens/'))return;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const q=el.value.trim().toLowerCase();const entries=[...scope.projects(s,user()).map(p=>({name:p.name,type:'Dự án',route:'/projects/'+p.id})),...scope.tasks(s,user()).map(t=>({name:t.code+' · '+t.title,type:'Công việc',route:'/workspace/tasks',open:'task',id:t.id})),...scope.employees(s,user()).map(u=>({name:u.name,type:'Nhân viên',route:'/hr/employees/'+u.id,open:'employee',id:u.id}))].filter(x=>x.name.toLowerCase().includes(q)).slice(0,8);document.getElementById('search-results').innerHTML=q?entries.map(x=>`<a href="#${x.route}" ${x.open?`data-open="${x.open}" data-id="${x.id}"`:''}>${e(x.name)}<small>${x.type}</small></a>`).join('')||'<div class="empty">Không tìm thấy kết quả</div>':'';},250);}});
document.addEventListener('click',ev=>{if(!notificationEventInside(ev,document.getElementById('notification-header')))closeNotificationHeader(document.getElementById('notification-header'));if(!ev.target.closest('.global-search'))(()=>{const results=document.getElementById('search-results');if(results)results.innerHTML='';})();});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){closeNotificationHeader(document.getElementById('notification-header'),true);}if(ev.key==='Escape')(()=>{const results=document.getElementById('search-results');if(results)results.innerHTML='';})();if((ev.ctrlKey||ev.metaKey)&&ev.key==='k'){ev.preventDefault();document.getElementById('global-search')?.focus();}if(ev.key==='Enter'&&ev.target.matches('.kanban-card'))ev.target.click();});
document.addEventListener('click',ev=>{
 const trigger=ev.target.closest('.top-user[data-action="account"]'),menu=document.getElementById('top-account-menu');
 if(trigger&&menu){ev.preventDefault();ev.stopImmediatePropagation();menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));}
 else if(menu&&!ev.target.closest('.account-menu-wrap')){menu.hidden=true;document.querySelector('.top-user')?.setAttribute('aria-expanded','false');}
},true);
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){const menu=document.getElementById('top-account-menu');if(menu&&!menu.hidden){menu.hidden=true;const trigger=document.querySelector('.top-user');trigger?.setAttribute('aria-expanded','false');trigger?.focus();}}});
let notificationToastGeneration=-1,notificationToastLoaded=false,notificationSeenIds=new Set(),approvalNotificationRevision=-1;
approvalCountService.subscribe(state=>{if(!apiSession())return;document.querySelectorAll('[data-approval-nav-count]').forEach(badge=>{badge.textContent=state.count>99?'99+':String(state.count||0);badge.hidden=!state.count;});});
window.addEventListener('focus',()=>{void approvalCountService.syncAuth();void approvalCountService.refresh();void notificationService.syncAuth();void notificationService.refresh();});
window.addEventListener('api-mutation',event=>{
 const {path,method,ok,message}=event.detail;
 if(ok&&(/\/(approvals|leave-requests|overtime-requests|attendance-adjustments)(?:\/|$)/.test(path)||path.startsWith('/api/kpi/evaluations/'))){void approvalCountService.refresh();void notificationService.refresh();}
 const version=toastRevision();
 setTimeout(()=>{if(toastRevision()!==version||!apiSession())return;
 const success=path.endsWith('/reset-password')?'Đã đổi mật khẩu thành công.':path.endsWith('/approve')?'Đã phê duyệt yêu cầu.':path.endsWith('/reject')?'Đã từ chối yêu cầu.':path.endsWith('/cancel')?'Đã gửi yêu cầu hủy.':path.endsWith('/grants')?'Đã cấp phép thành công.':method==='DELETE'?'Đã xóa thành công.':'Đã lưu thay đổi thành công.';
 toast(ok?success:message||'Thao tác không thành công. Vui lòng thử lại.',{type:ok?'success':'error',automatic:true});
 },100);
});
notificationService.subscribe(state=>{
 if(state.generation!==notificationToastGeneration){notificationToastGeneration=state.generation;notificationToastLoaded=false;notificationSeenIds=new Set();approvalNotificationRevision=-1;}
 if(!apiSession())return;
 if(state.loaded){for(const item of state.items){const key=String(item.id);if(notificationToastLoaded&&!notificationSeenIds.has(key)&&!item.readAt)toast(item.title||'Bạn có thông báo mới.',{type:'info',automatic:true});notificationSeenIds.add(key);}notificationToastLoaded=true;if(notificationSeenIds.size>2000)notificationSeenIds=new Set(state.items.map(item=>String(item.id)));}
 if(state.revision!==approvalNotificationRevision){approvalNotificationRevision=state.revision;void approvalCountService.refresh();}
 renderNotificationHeader(document.getElementById('notification-header'),state);
 document.querySelectorAll('[data-notification-nav-count]').forEach(badge=>{badge.textContent=state.count>99?'99+':String(state.count||0);badge.hidden=!state.count;});
 document.querySelectorAll('[data-notification-feed]').forEach(feed=>{feed.innerHTML=state.items.length?notificationRows(state.items.slice(0,Number(feed.dataset.notificationFeed)||4)):state.loading?'<p role="status">Đang tải thông báo…</p>':state.error?`<p role="alert">${e(state.error)}</p>`:'<p>Chưa có thông báo.</p>';});
});
app.addEventListener('click',ev=>{const button=ev.target.closest('[data-noti-read]');if(button?.closest('[data-notification-feed]'))void notificationService.read(button.dataset.notiRead).catch(error=>toast(notificationError(error),{type:'error'}));});
void notificationService.syncAuth();
void approvalCountService.syncAuth();
setupActions({render,filters:()=>filters,setFilters:patch=>Object.assign(filters,patch),resetFilters:()=>{filters=newFilters();},openDialog,closeDialog,toast});
if(!location.hash)history.replaceState(null,'','#/dashboard');navigate();

})();
