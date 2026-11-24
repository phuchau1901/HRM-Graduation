const SESSION_KEY = 'intelex-erp-api-session:v1';
const DEFAULT_BASE_URL = typeof location!=='undefined' && /^https?:$/.test(location.protocol) ? '' : 'https://hrm-graduation.up.railway.app';

function readSession(){try{return JSON.parse(localStorage.getItem(SESSION_KEY))||null;}catch{return null;}}
let session = readSession();

export function apiBaseUrl(){return globalThis.window?.INTELEX_API_BASE ?? DEFAULT_BASE_URL;}
export function apiSession(){
 if(session?.expiresAtUtc&&Date.parse(session.expiresAtUtc)<=Date.now())apiLogout();
 return session?.accessToken?session:null;
}
export function apiLogout(){session=null;try{localStorage.removeItem(SESSION_KEY);}catch{}
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

export async function login(userId,password){
 const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify({userId,password})});
 if(!result?.accessToken||!result.user||!Array.isArray(result.permissions))throw Error('Phản hồi đăng nhập không hợp lệ.');
 session={...result};
 try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch{}
 globalThis.window?.dispatchEvent?.(new Event('session-change'));
 return session;
}

export function me(){return request('/api/auth/me');}
export function permissions(){return request('/api/auth/me/permissions');}
export function apiEmployees(query='',signal){return request('/api/employees'+(query?`?${query}`:''),{signal});}
export function apiEmployeeDetail(employeeId){return request(`/api/employees/${encodeURIComponent(employeeId)}`);}
export function apiUnlinkedEmployees(query=''){return request('/api/employees/unlinked'+(query?`?${query}`:''));}
export function apiDepartments(query=''){return request('/api/departments'+(query?`?${query}`:''));}
export function apiPositions(query=''){return request('/api/positions'+(query?`?${query}`:''));}
export function apiNotifications(limit=30,beforeId=null){
 const query=new URLSearchParams({limit});if(beforeId!==null)query.set('beforeId',beforeId);
 return request('/api/notifications?'+query,{cache:'no-store'});
}
export function apiNotificationUnreadCount(){return request('/api/notifications/unread-count',{cache:'no-store'});}
export function apiReadNotification(id){return request(`/api/notifications/${encodeURIComponent(id)}/read`,{method:'PATCH'});}
export function apiReadAllNotifications(){return request('/api/notifications/read-all',{method:'PATCH'});}

export function apiRoles(page=1,search=''){return request('/api/roles?'+new URLSearchParams({page,pageSize:30,search}));}
export function apiCreateRole(payload){return request('/api/roles',{method:'POST',body:JSON.stringify(payload)});}
export function apiRoleDetail(roleId){return request(`/api/roles/${encodeURIComponent(roleId)}`);}
export function apiUpdateRole(roleId,version,payload){
 if(!version)throw Error('Thiếu version của role. Vui lòng tải lại.');
 return request(`/api/roles/${encodeURIComponent(roleId)}`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify(payload)});
}
export async function apiAllScreens(){
 const screens=[];let page=1,total;
 do{const result=await request('/api/screens?'+new URLSearchParams({page,pageSize:100}));
 if(!Array.isArray(result?.data))throw Error('Danh sách màn hình không hợp lệ.');
 screens.push(...result.data);total=result.total;if(!result.data.length)break;page++;
 }while(screens.length<total);
 return screens;
}
export function apiRolePermissions(roleId){return request(`/api/roles/${encodeURIComponent(roleId)}/permissions`);}
export function apiSaveRolePermissions(roleId,version,screens){
 if(!version)throw Error('Thiếu version của role. Vui lòng tải lại.');
 return request(`/api/roles/${encodeURIComponent(roleId)}/permissions`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify({screens})});
}

export function apiUsers(page=1,search=''){return request('/api/users?'+new URLSearchParams({page,pageSize:30,search}));}
export function apiCreateUser(payload){return request('/api/users',{method:'POST',body:JSON.stringify(payload)});}
export function apiCreateEmployee(payload){return request('/api/employees',{method:'POST',body:JSON.stringify(payload)});}
export async function apiAllRoles(){
 const items=[];let page=1;
 while(true){const result=await apiRoles(page);if(!Array.isArray(result?.data))throw Error('Danh sách role không hợp lệ.');items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;}
 return items;
}
export async function apiActiveDepartments(){
 const items=[];let page=1;
 while(true){const result=await apiDepartments(new URLSearchParams({page,pageSize:100,isActive:true}).toString());if(!Array.isArray(result?.data))throw Error('Danh sách phòng ban không hợp lệ.');items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;}
 return items.filter(item=>item.isActive);
}

export async function apiActivePositions(){
 const items=[];let page=1;
 while(true){const result=await apiPositions(new URLSearchParams({page,pageSize:100,isActive:true}).toString());
 if(!Array.isArray(result?.data))throw Error('Danh sách chức danh không hợp lệ.');
 items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;
 }
 return items.filter(position=>position.isActive);
}

export async function apiActiveTeams(departmentId){
 const items=[];let page=1;
 while(true){const result=await request('/api/teams?'+new URLSearchParams({page,pageSize:100,departmentId,isActive:true}));
 if(!Array.isArray(result?.data))throw Error('Danh sách team không hợp lệ.');
 items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;
 }
 return items.filter(team=>team.isActive&&Number(team.departmentId)===Number(departmentId));
}

export function apiUserDetail(userId){return request(`/api/users/${encodeURIComponent(userId)}`);}
export function apiUpdateUser(userId,version,payload){
 if(!version)throw Error('Thiếu version tài khoản. Vui lòng tải lại.');
 return request(`/api/users/${encodeURIComponent(userId)}`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify(payload)});
}
export function apiSetUserStatus(userId,version,status){
 if(!['ACTIVE','LOCKED','INACTIVE'].includes(status))throw Error('Trạng thái tài khoản không hợp lệ.');
 if(!version)throw Error('Thiếu phiên bản tài khoản. Vui lòng tải lại.');
 return request(`/api/users/${encodeURIComponent(userId)}/status`,{method:'PATCH',headers:{'If-Match':`"${version}"`},body:JSON.stringify({status})});
}
export function apiUpdateUserRoles(userId,version,roleIds){
 if(!version)throw Error('Thiếu version tài khoản. Vui lòng tải lại.');
 return request(`/api/users/${encodeURIComponent(userId)}/roles`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify({roleIds})});
}

export function apiResetUserPassword(userId,version,payload){
 if(!['SELF_CHANGE','ADMIN_RESET'].includes(payload?.type))throw Error('Loại thay đổi mật khẩu không hợp lệ.');
 const body={type:payload.type,newPassword:payload.newPassword,...(payload.type==='SELF_CHANGE'?{oldPassword:payload.oldPassword}:{})};
 return request(`/api/users/${encodeURIComponent(userId)}/reset-password`,{method:'POST',body:JSON.stringify(body)});
}

export function apiOrganization(kind,id=null,payload=null,query=''){
 if(!['departments','positions','teams'].includes(kind))throw Error('Danh mục không hợp lệ.');
 const path=`/api/${kind}`+(id===null?'':`/${encodeURIComponent(id)}`)+(query?`?${query}`:'');
 return request(path,payload===null?{}:{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});
}

export function apiSystemSettings(kind,settings=null,version=null){
 if(!['password-policy','attendance'].includes(kind))throw Error('Loại cấu hình hệ thống không hợp lệ.');
 if(settings===null)return request(`/api/system-settings/${kind}`);
 if(!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản cấu hình hợp lệ. Vui lòng tải lại.');
 return request(`/api/system-settings/${kind}`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify(settings)});
}

export function apiShifts(page=1,search=''){return request('/api/shifts?'+new URLSearchParams({page,pageSize:30,search}));}
export function apiShiftDetail(id){return request(`/api/shifts/${encodeURIComponent(id)}`);}
export function apiSaveShift(id,payload,version=null){
 const headers={};
 if(id!==null){
 if(version===null||version===undefined||!String(version)||!/^[A-Za-z0-9_-]+$/.test(String(version)))throw Error('Thiếu phiên bản ca làm việc. Vui lòng tải lại.');
 headers['If-Match']=`"${version}"`;
 }
 return request('/api/shifts'+(id===null?'':`/${encodeURIComponent(id)}`),{method:id===null?'POST':'PUT',headers,body:JSON.stringify(payload)});
}

export function apiAuditLogs(query=''){return request('/api/audit-logs'+(query?`?${query}`:''),{cache:'no-store'});}
export function apiAuditLogDetail(id){return request(`/api/audit-logs/${encodeURIComponent(id)}`,{cache:'no-store'});}

// Keep connected browser tabs aligned when a login/logout replaces the stored JWT.
globalThis.window?.addEventListener?.('storage',event=>{
 if(event.key===SESSION_KEY||event.key===null){session=readSession();globalThis.window.dispatchEvent(new Event('auth-change'));}
});

export function apiOrganizationTree(signal){return request('/api/organization/tree',{signal,cache:'no-store'});}
export function apiOrganizationMembers(kind,id,page=1,signal){
 if(!['team','unassigned'].includes(kind))throw Error('Nhóm nhân viên không hợp lệ.');
 const path=kind==='team'?`/api/teams/${encodeURIComponent(id)}/members`:`/api/departments/${encodeURIComponent(id)}/unassigned-members`;
 return request(path+'?'+new URLSearchParams({page,pageSize:20}),{signal,cache:'no-store'});
}

export function apiUpdateEmployee(employeeId,payload){return request(`/api/employees/${encodeURIComponent(employeeId)}`,{method:"PUT",body:JSON.stringify(payload)});}

export function apiTransferEmployeeDepartment(employeeId,payload){return request(`/api/employees/${encodeURIComponent(employeeId)}/department`,{method:'PATCH',body:JSON.stringify(payload)});}

export function apiContractTypes(query=''){return request('/api/contract-types'+(query?`?${query}`:''));}
export function apiContractType(code){return request(`/api/contract-types/${encodeURIComponent(code)}`);}
export function apiSaveContractType(code,payload){return request('/api/contract-types'+(code===null?'':`/${encodeURIComponent(code)}`),{method:code===null?'POST':'PUT',body:JSON.stringify(payload)});}
export function apiDeleteContractType(code){return request(`/api/contract-types/${encodeURIComponent(code)}`,{method:'DELETE'});}

export function apiCreateScreen(payload){return request('/api/screens',{method:'POST',body:JSON.stringify(payload)});}

export function apiEmployeeContracts(employeeId,query='',signal){return request(`/api/employees/${encodeURIComponent(employeeId)}/contracts`+(query?`?${query}`:''),{signal});}
export function apiEmployeeContract(employeeId,contractId){return request(`/api/employees/${encodeURIComponent(employeeId)}/contracts/${encodeURIComponent(contractId)}`);}
export function apiSaveEmployeeContract(employeeId,contractId,payload){return request(`/api/employees/${encodeURIComponent(employeeId)}/contracts`+(contractId===null?'':`/${encodeURIComponent(contractId)}`),{method:contractId===null?'POST':'PUT',body:JSON.stringify(payload)});}
export async function apiActiveContractTypes(){
 const items=[];let page=1;
 while(true){const result=await apiContractTypes(new URLSearchParams({page,pageSize:100,isActive:true}).toString());
 if(!Array.isArray(result?.data))throw Error('Danh sách loại hợp đồng không hợp lệ.');
 items.push(...result.data);if(!result.data.length||items.length>=result.total)break;page++;
 }
 return items.filter(item=>item.isActive);
}

export function apiContractStatistics(expiringWithinDays=30){return request('/api/contracts/statistics?'+new URLSearchParams({expiringWithinDays}),{cache:'no-store'});}

export function apiCreateContract(payload){return request('/api/contracts',{method:'POST',body:JSON.stringify(payload)});}

const workflowResources={leave:'leave-requests',overtime:'overtime-requests',adjustment:'attendance-adjustments',all:'approvals'};
function workflowPath(kind,id=null){if(!workflowResources[kind])throw Error('Loại yêu cầu không hợp lệ.');return '/api/'+workflowResources[kind]+(id===null?'':`/${encodeURIComponent(id)}`);}
export function apiWorkflowList(kind,query=''){return request(workflowPath(kind)+(query?`?${query}`:''),{cache:'no-store'});}
export function apiWorkflowDetail(kind,id){if(kind==='adjustment')throw Error('API điều chỉnh công không có endpoint chi tiết.');return request(workflowPath(kind,id),{cache:'no-store'});}
export function apiCreateWorkflow(kind,payload){if(kind==='all')throw Error('Chọn loại yêu cầu để tạo.');return request(workflowPath(kind),{method:'POST',body:JSON.stringify(payload)});}
export function apiWorkflowAction(kind,id,action,payload){if(kind==='all'?!['approve','reject'].includes(action):action!=='cancel')throw Error('Thao tác yêu cầu không hợp lệ.');return request(workflowPath(kind,id)+'/'+action,{method:'POST',body:JSON.stringify(payload)});}
export function apiWorkflowLeaveTypes(query=''){return request('/api/leave-types'+(query?`?${query}`:''),{cache:'no-store'});}

export function apiSaveLeaveType(id,payload){return request('/api/leave-types'+(id===null?'':`/${encodeURIComponent(id)}`),{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});}

export function apiApprovalWorkflowSettings(payload=null){
 if(payload!==null&&(!Number.isSafeInteger(payload.version)||payload.version<0))throw Error('Thiếu phiên bản cấu hình quy trình hợp lệ.');
 return request('/api/approval-workflow-settings',payload===null?{cache:'no-store'}:{method:'PUT',body:JSON.stringify(payload)});
}

export function apiMyLeaveBalances({year=null,leaveTypeId=null}={}){
 const query=new URLSearchParams();
 if(year!==null){if(!Number.isInteger(year)||year<1900||year>9999)throw Error('Năm phải từ 1900 đến 9999.');query.set('year',year);}
 if(leaveTypeId!==null){if(!Number.isSafeInteger(leaveTypeId)||leaveTypeId<=0)throw Error('Loại nghỉ phép không hợp lệ.');query.set('leaveTypeId',leaveTypeId);}
 return request('/api/leave-balances/me'+(query.size?'?'+query:''),{cache:'no-store'});
}

export function apiLeaveAccrualSettings(payload=null){
 if(payload!==null&&(!Number.isSafeInteger(payload.version)||payload.version<0))throw Error('Phiên bản cấu hình không hợp lệ.');
 return request('/api/system-settings/leave-accrual',payload===null?{cache:'no-store'}:{method:'PUT',body:JSON.stringify(payload)});
}
export function apiRunLeaveAccrual(){return request('/api/system-settings/leave-accrual/run',{method:'POST'});}

export function apiLeaveBalances(filters={},signal){
 const query=new URLSearchParams();
 for(const key of ['page','pageSize','view','year','employeeId','departmentId','leaveTypeId','search'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);
 return request('/api/leave-balances?'+query,{cache:'no-store',signal});
}
export function apiGrantLeaveBalances(payload){return request('/api/leave-balances/grants',{method:'POST',body:JSON.stringify(payload)});}
export function apiSaveLeaveBalance(payload){return request('/api/leave-balances',{method:'PUT',body:JSON.stringify(payload)});}
export function apiAdjustLeaveBalance(id,payload){return request(`/api/leave-balances/${encodeURIComponent(id)}/adjustments`,{method:'POST',body:JSON.stringify(payload)});}
export function apiLeaveBalanceHistory(id,page=1){return request(`/api/leave-balances/${encodeURIComponent(id)}/history?`+new URLSearchParams({page,pageSize:20}),{cache:'no-store'});}

function workScheduleQuery(filters){const query=new URLSearchParams();for(const key of ['from','to','page','pageSize','departmentId','teamId','employeeId','search'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return query.toString();}
export function apiWorkScheduleCalendar(filters,signal){return request('/api/work-schedules/calendar?'+workScheduleQuery(filters),{cache:'no-store',signal});}
export function apiWorkScheduleDetail(id){return request(`/api/work-schedules/${encodeURIComponent(id)}`,{cache:'no-store'});}
function workScheduleVersion(version){if(!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản lịch hợp lệ. Vui lòng tải lại.');return {'If-Match':`"${version}"`};}
export function apiSaveWorkSchedule(id,payload,version=null){return request('/api/work-schedules'+(id===null?'':`/${encodeURIComponent(id)}`),{method:id===null?'POST':'PUT',headers:id===null?{}:workScheduleVersion(version),body:JSON.stringify(payload)});}
export function apiCancelWorkSchedule(id,version){return request(`/api/work-schedules/${encodeURIComponent(id)}/cancel`,{method:'PATCH',headers:workScheduleVersion(version)});}
export function apiPreviewWorkSchedules(payload){return request('/api/work-schedules/bulk/preview',{method:'POST',body:JSON.stringify(payload)});}
export function apiAssignWorkSchedules(payload){if(!payload.previewToken)throw Error('Cần xem trước phân ca trước khi xác nhận.');return request('/api/work-schedules/'+(payload.copyFrom?'copy':'bulk'),{method:'POST',body:JSON.stringify(payload)});}
export function apiExportWorkSchedules(filters){return request('/api/work-schedules/export?'+workScheduleQuery(filters),{cache:'no-store',responseType:'blob'});}

function attendanceManagementQuery(filters={},own=false){const query=new URLSearchParams();for(const key of ['date','from','to','page','pageSize','departmentId','teamId','employeeId','search','status'])if((!own||!['employeeId','departmentId','teamId','search'].includes(key))&&filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return query.toString();}
export function apiAttendanceDaily(filters={},signal){return request('/api/attendances/daily?'+attendanceManagementQuery(filters),{cache:'no-store',signal});}
export function apiMyAttendance(filters={},signal){return request('/api/attendances/me?'+attendanceManagementQuery(filters,true),{cache:'no-store',signal});}
export function apiAttendanceStatistics(filters={}){return request('/api/attendances/statistics?'+attendanceManagementQuery(filters),{cache:'no-store'});}
export function apiAttendanceFilters(){return request('/api/attendances/filters',{cache:'no-store'});}
export function apiAttendanceDetail(row){const query=new URLSearchParams({employeeId:row.employeeId,date:row.workDate});if(row.scheduleId)query.set('scheduleId',row.scheduleId);return request('/api/attendances/daily/detail?'+query,{cache:'no-store'});}
export function apiAttendancePunch(action,payload){if(!['check-in','check-out'].includes(action))throw Error('Thao tác chấm công không hợp lệ.');return request('/api/attendances/'+action,{method:'POST',body:JSON.stringify(payload)});}
export function apiAttendanceExport(filters={}){const {page,pageSize,...query}=filters;return request('/api/attendances/export?'+attendanceManagementQuery(query),{cache:'no-store',responseType:'blob'});}

function kpiEvaluationQuery(filters={}){const query=new URLSearchParams();for(const key of ['periodId','departmentId','teamId','employeeId','status','search','page','pageSize'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return query.toString();}
export function apiKpiEvaluations(filters={}){return request('/api/kpi/evaluations?'+kpiEvaluationQuery(filters),{cache:'no-store'});}
export function apiKpiStatistics(filters={}){const {page,pageSize,...query}=filters;return request('/api/kpi/evaluations/statistics?'+kpiEvaluationQuery(query),{cache:'no-store'});}
export function apiKpiLookups(){return request('/api/kpi/evaluations/lookups',{cache:'no-store'});}
export function apiKpiPeriods(page=1){return request('/api/kpi/evaluations/periods?'+new URLSearchParams({page,pageSize:100}),{cache:'no-store'});}
export function apiKpiEmployees(search='',page=1){return request('/api/kpi/evaluations/employees?'+new URLSearchParams({page,pageSize:20,search}),{cache:'no-store'});}
export function apiKpiEvaluationDetail(id){return request(`/api/kpi/evaluations/${encodeURIComponent(id)}`,{cache:'no-store'});}
export function apiKpiEvaluationAction(id,action,payload){if(!['start','results','submit','review'].includes(action))throw Error('Thao tác KPI không hợp lệ.');if(!Number.isSafeInteger(payload?.version)||payload.version<1)throw Error('Thiếu phiên bản KPI. Vui lòng tải lại.');return request(`/api/kpi/evaluations/${encodeURIComponent(id)}/${action}`,{method:action==='results'?'PUT':'POST',body:JSON.stringify(payload)});}
export function apiKpiExport(filters={}){const {page,pageSize,...query}=filters;return request('/api/kpi/evaluations/export?'+kpiEvaluationQuery(query),{cache:'no-store',responseType:'blob'});}

export function apiTerminalLoggingSettings(settings=null,etag=null){
 if(settings===null)return request('/api/system-settings/terminal-logging',{cache:'no-store',responseType:'etag'});
 if(typeof etag!=='string'||!/^"(?:0|[1-9]\d*)"$/.test(etag))throw Error('Thiếu phiên bản cấu hình log. Vui lòng tải lại.');
 return request('/api/system-settings/terminal-logging',{method:'PUT',headers:{'If-Match':etag},body:JSON.stringify(settings),responseType:'etag'});
}
export function apiTerminalLoggingModules(){return request('/api/system-settings/terminal-logging/modules',{cache:'no-store'});}

export function apiKpiConfigurationList(kind,filters={}){if(!['templates','metrics','periods','employees','units'].includes(kind))throw Error('Danh mục KPI không hợp lệ.');const query=new URLSearchParams();for(const key of ['page','pageSize','search',...(kind==='units'?['isActive']:[])])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request('/api/kpi/configuration/'+kind+'?'+query,{cache:'no-store'});}
export function apiKpiConfigurationLookups(){return request('/api/kpi/configuration/lookups',{cache:'no-store'});}
export function apiKpiTemplateDetail(id){return request('/api/kpi/configuration/templates/'+encodeURIComponent(id),{cache:'no-store'});}
export function apiKpiConfigurationSave(kind,payload,id=null){if(!['templates','metrics','periods','assignments','units'].includes(kind)||id!==null&&!['templates','metrics','units'].includes(kind))throw Error('Thao tác cấu hình KPI không hợp lệ.');if(id!==null&&(!Number.isSafeInteger(payload?.version)||payload.version<1))throw Error('Thiếu phiên bản KPI. Vui lòng tải lại.');return request('/api/kpi/configuration/'+kind+(id===null?'':'/'+encodeURIComponent(id)),{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});}
export function apiKpiConfigurationAction(kind,id,version){if(!['templates','periods'].includes(kind)||!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản KPI. Vui lòng tải lại.');return request('/api/kpi/configuration/'+kind+'/'+encodeURIComponent(id)+'/'+(kind==='templates'?'publish':'close'),{method:'POST',body:JSON.stringify({version})});}

export function apiKpiUnitDetail(id){return request('/api/kpi/configuration/units/'+encodeURIComponent(id),{cache:'no-store'});}

function compensationBase(area){if(!['payroll','salary-configuration'].includes(area))throw Error('Phân hệ lương không hợp lệ.');return '/api/'+area;}
export function apiCompensationList(area,resource,filters={}){const allowed=area==='payroll'?['employees','policies','timesheets','periods','payslips']:['employees','components','policies','profiles'];if(!allowed.includes(resource))throw Error('Danh mục lương không hợp lệ.');const query=new URLSearchParams();for(const key of ['page','pageSize','search','periodKey','status','employeeId','departmentId','teamId'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request(compensationBase(area)+'/'+resource+'?'+query,{cache:'no-store'});}
export function apiCompensationLookups(area){return request(compensationBase(area)+'/lookups',{cache:'no-store'});}
export function apiPayrollStatistics(filters={}){const {page,pageSize,...values}=filters;const query=new URLSearchParams();for(const key of ['search','periodKey','status','employeeId','departmentId','teamId'])if(values[key]!==undefined&&values[key]!==null&&values[key]!=='')query.set(key,values[key]);return request('/api/payroll/statistics?'+query,{cache:'no-store'});}
export function apiPayrollDetail(resource,id){if(!['timesheets','payslips'].includes(resource))throw Error('Chi tiết lương không hợp lệ.');return request('/api/payroll/'+resource+'/'+encodeURIComponent(id),{cache:'no-store'});}
export function apiCompensationSave(area,resource,payload,id=null){const allowed=area==='payroll'?['periods','timesheets']:['profiles','components','policies'];if(!allowed.includes(resource)||id!==null&&(area!=='salary-configuration'||!['components','policies'].includes(resource)))throw Error('Thao tác lương không hợp lệ.');if(id!==null&&(!Number.isSafeInteger(payload?.version)||payload.version<1))throw Error('Thiếu phiên bản. Vui lòng tải lại.');return request(compensationBase(area)+'/'+resource+(id===null?'':'/'+encodeURIComponent(id)),{method:id===null?'POST':'PUT',body:JSON.stringify(payload)});}
export function apiPayrollAction(resource,id,action,payload){const allowed=resource==='timesheets'?['calculate','lock']:resource==='periods'?['calculate','submit','lock','paid']:[];if(!allowed.includes(action)||!Number.isSafeInteger(payload?.version)||payload.version<1)throw Error('Thao tác hoặc phiên bản kỳ không hợp lệ.');if(action==='calculate'&&!/^[A-Za-z0-9_-]{8,100}$/.test(payload.requestKey||''))throw Error('Thiếu mã lần tính.');return request('/api/payroll/'+resource+'/'+encodeURIComponent(id)+'/'+action,{method:'POST',body:JSON.stringify(payload)});}
export function apiPayrollAdjustments(periodId,payload=null){return request('/api/payroll/periods/'+encodeURIComponent(periodId)+'/adjustments',payload===null?{cache:'no-store'}:{method:'POST',body:JSON.stringify(payload)});}
export function apiPayrollCancelAdjustment(periodId,adjustmentId,version){if(!Number.isSafeInteger(version)||version<1)throw Error('Thiếu phiên bản điều chỉnh.');return request(`/api/payroll/periods/${encodeURIComponent(periodId)}/adjustments/${encodeURIComponent(adjustmentId)}/cancel`,{method:'POST',body:JSON.stringify({version})});}
export function apiPayrollPublishPolicy(id,payload){if(!Number.isSafeInteger(payload?.version)||payload.version<1)throw Error('Thiếu phiên bản chính sách.');return request('/api/salary-configuration/policies/'+encodeURIComponent(id)+'/publish',{method:'POST',body:JSON.stringify(payload)});}
export function apiPayrollExport(filters={}){const query=new URLSearchParams();for(const key of ['search','periodKey','status','employeeId','departmentId','teamId'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request('/api/payroll/export?'+query,{cache:'no-store',responseType:'blob'});}

export function apiMyPayslips(filters={}){const query=new URLSearchParams();for(const key of ['periodKey','status','page','pageSize'])if(filters[key]!==undefined&&filters[key]!==null&&filters[key]!=='')query.set(key,filters[key]);return request('/api/payslips/me?'+query,{cache:'no-store'});}
export function apiMyPayslipDetail(id){return request('/api/payslips/me/'+encodeURIComponent(id),{cache:'no-store'});}
export function apiMyPayslipPdf(id){return request('/api/payslips/me/'+encodeURIComponent(id)+'/pdf',{cache:'no-store',responseType:'blob'});}
