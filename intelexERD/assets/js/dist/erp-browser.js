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

async function request(path,options={}){
 const headers=new Headers(options.headers||{});
 headers.set('Accept','application/json');
 if(options.body&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 if(path!=='/api/auth/login'&&apiSession()?.accessToken)headers.set('Authorization',`Bearer ${session.accessToken}`);
 const transport=globalThis['fetch'];
 if(typeof transport!=='function')throw Error('Trình duyệt hiện tại không hỗ trợ kết nối API.');
 const response=await transport(apiBaseUrl()+path,{...options,headers});
 let body=null;try{body=await response.json();}catch{}
 if(!response.ok){if(response.status===401)apiLogout();throw Error(body?.message||body?.error?.message||`API lỗi HTTP ${response.status}`);}
 return body;
}

async function login(userId,password){
 const result=await request('/api/auth/login',{method:'POST',body:JSON.stringify({userId,password})});
 if(!result?.accessToken||!result.user||!Array.isArray(result.permissions))throw Error('Phản hồi đăng nhập không hợp lệ.');
 session={...result};
 try{localStorage.setItem(SESSION_KEY,JSON.stringify(session));}catch{}
 return session;
}

function me(){return request('/api/auth/me');}
function permissions(){return request('/api/auth/me/permissions');}
function apiEmployees(query=''){return request('/api/employees'+(query?`?${query}`:''));}
function apiEmployeeDetail(employeeId){return request(`/api/employees/${encodeURIComponent(employeeId)}`);}
function apiUnlinkedEmployees(query=''){return request('/api/employees/unlinked'+(query?`?${query}`:''));}
function apiDepartments(query=''){return request('/api/departments'+(query?`?${query}`:''));}
function apiPositions(query=''){return request('/api/positions'+(query?`?${query}`:''));}
function apiNotifications(){return request('/api/notifications');}

function apiRoles(page=1,search=''){return request('/api/roles?'+new URLSearchParams({page,pageSize:30,search}));}
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
function apiUpdateUserRoles(userId,version,roleIds){
 if(!version)throw Error('Thiếu version tài khoản. Vui lòng tải lại.');
 return request(`/api/users/${encodeURIComponent(userId)}/roles`,{method:'PUT',headers:{'If-Match':`"${version}"`},body:JSON.stringify({roleIds})});
}

function apiResetUserPassword(userId,version,payload){
 if(!version)throw Error('Thiếu version tài khoản. Vui lòng tải lại.');
 if(!['SELF_CHANGE','ADMIN_RESET'].includes(payload?.type))throw Error('Loại thay đổi mật khẩu không hợp lệ.');
 const body={type:payload.type,newPassword:payload.newPassword,...(payload.type==='SELF_CHANGE'?{currentPassword:payload.currentPassword}:{})};
 return request(`/api/users/${encodeURIComponent(userId)}/reset-password`,{method:'POST',headers:{'If-Match':`"${version}"`},body:JSON.stringify(body)});
}


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
function routeAllowed(s,u,path){if(apiSession())return path==='/admin/users/register'?screenAllowed('/admin/users','canNew'):screenAllowed(path);if(path.startsWith('/admin'))return can(s,u,'admin');if(path.startsWith('/hr'))return u.role!=='Dev'&&(['Admin','HR'].includes(u.role)||path==='/hr/employees'||/^\/hr\/employees\/[^/]+$/.test(path));if(path.startsWith('/team'))return u.role==='HR'?['/team/overview','/team/members'].includes(path):can(s,u,'team');if(u.role==='HR'&&['/projects/tasks','/projects/workload','/projects/reports','/projects/timeline'].includes(path))return false;return true;}

// Explicit aliases for screen codes supplied by the backend. Unknown codes deny access.
const screenRoutes={
 '/dashboard':['WEB_DASHBOARD'],
 '/workspace/tasks':['WEB_MY_TASKS'], 
 '/workspace/projects':['WEB_MY_PROJECTS'],
 '/workspace/attendance':['WEB_MY_ATTENDANCE'], 
 '/workspace/leave':['WEB_MY_LEAVE'],
 '/projects':['WEB_PROJECTS'], 
 '/approvals':['WEB_APPROVALS'], 
 '/reports':['WEB_REPORTS'],
 '/documents':['WEB_DOCUMENTS'], 
 '/notifications':['WEB_NOTIFICATIONS'],
 '/hr/employees':['WEB_EMPLOYEES'], 
 '/hr/organization':['WEB_ORGANIZATION','WEB_DEPARTMENTS','WEB_POSITIONS'],
 '/hr/contracts':['WEB_CONTRACTS'], 
 '/hr/attendance':['WEB_ATTENDANCE'],
 '/hr/attendance-reports':['WEB_ATTENDANCE_REPORTS'], 
 '/hr/leave':['WEB_LEAVE','WEB_LEAVE_MANAGEMENT'],
 '/hr/reports':['WEB_HR_REPORTS'], 
 '/admin/users':['WEB_USERS'], 
 '/admin/roles':['WEB_ROLES'],
 '/admin/permissions':['WEB_PERMISSIONS'], 
 '/admin/audit-logs':['WEB_AUDIT_LOGS'],
 '/admin/settings':['WEB_SYSTEM_SETTINGS'], 
 '/admin/master-data':['WEB_MASTER_DATA']
};
function screenAllowed(path,flag='canView'){
 const current=apiSession();if(!current)return false;
 let route=path;
 if(/^\/hr\/employees\/.+/.test(path))route='/hr/employees';
 if(/^\/projects\/prj-/.test(path))route='/projects';
 const codes=screenRoutes[route]||(/^\/(team|projects)\//.test(route)?['WEB_'+route.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()]:[]);
 return current.permissions.some(p=>p.platform==='WEB'&&codes.includes(p.code)&&p.canView==='Y'&&p[flag]==='Y');
}


const scope=Object.freeze({scopedTeams,employees,projects,tasks,documents,requests,can,routeAllowed});

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
let timer;
function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),3500);}


// Source: pages/dashboard.js
function teamOptions(f){return `<select data-filter="team" aria-label="Lọc team"><option value="">Tất cả team${user().role==='Manager'?' quản lý':''}</option>${s.teams.filter(t=>scope.scopedTeams(s,user()).includes(t.id)).map(t=>`<option value="${t.id}" ${f.team===t.id?'selected':''}>${e(t.name)}</option>`).join('')}</select>`;}
function visibleEmployees(f){return scope.employees(s,user()).filter(u=>(!f.team||u.teamId===f.team)&&u.status==='active');}
function visibleTasks(f){const people=new Set(visibleEmployees(f).map(u=>u.id));return scope.tasks(s,user()).filter(t=>!f.team||people.has(t.assigneeId));}
function attendanceRows(f){if([0,6].includes(new Date(f.date+'T12:00:00+07:00').getDay()))return [];return visibleEmployees(f).map(u=>({u,a:s.attendance.find(a=>a.userId===u.id&&a.date===f.date)})).filter(({u,a})=>matches(u.name+u.employeeCode,f.search)&&(!f.status||attendanceStatus(a)===f.status));}
function attendanceTable(f,dashboard=false){const rows=attendanceRows(f);if(f.sort==='name')rows.sort((a,b)=>a.u.name.localeCompare(b.u.name,'vi'));if(f.sort==='time')rows.sort((a,b)=>(a.a?.checkIn||'z').localeCompare(b.a?.checkIn||'z'));return table([`<button class="btn text" data-sort="name">Nhân viên ↕</button>`,'Team',`<button class="btn text" data-sort="time">Check-in ↕</button>`,'Check-out',...(dashboard?[]:['Giờ công']), 'Trạng thái'],rows.map(({u,a})=>[`<a href="#/hr/employees/${u.id}" data-open="employee" data-id="${u.id}">${person(u)}</a>`,e(s.teams.find(t=>t.id===u.teamId)?.name||'Office'),`<span style="color:${attendanceStatus(a)==='late'?'#c38f49':'#5a6d89'}">${timeLabel(a?.checkIn)}</span>`,timeLabel(a?.checkOut),...(dashboard?[]:[hours(a,s.settings)]),badge(attendanceStatus(a))]),{page:f.page,size:dashboard?5:Number(f.size)||10});}
function projectChart(f){const ts=visibleTasks(f);const ps=scope.projects(s,user()).filter(p=>!f.team||p.teamIds.includes(f.team));return `<div class="card-body project-chart">${ps.map(p=>{const all=ts.filter(t=>t.projectId===p.id),done=all.filter(t=>t.status==='done').length;return `<a class="chart-row ${p.health==='at_risk'?'orange':p.color}" href="#/projects/${p.id}" title="${e(p.name)}: ${done}/${all.length} task, hạn ${dateLabel(p.dueDate)}"><span class="chart-name">${e(p.name)}</span><span class="chart-track"><span class="chart-fill" style="width:${pct(done,all.length)}%;display:block"></span></span><span class="chart-percent">${pct(done,all.length)}%</span></a>`;}).join('')||empty()}<div class="chart-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div class="chart-footer"><span>${icon('clock',10)} Cập nhật từ dữ liệu công việc</span><strong>${ts.filter(t=>t.status==='done').length}/${ts.length} task hoàn thành</strong></div></div>`;}
function attendanceChart(f){const weekend=[0,6].includes(new Date(f.date+'T12:00:00+07:00').getDay());if(weekend)return `<div class="card-body">${empty('Không có lịch làm việc','Ngày đã chọn là ngày nghỉ cuối tuần.')}</div>`;const rows=attendanceRows({...f,search:'',status:''}),n=rows.length;const counts=['ontime','late','leave','absent'].map(st=>rows.filter(({a})=>attendanceStatus(a)===st).length),sum=counts[0]+counts[1];return `<div class="card-body"><div class="attendance-chart"><div class="donut" style="--a:${pct(counts[0],n)}%;--b:${pct(sum,n)}%;--c:${pct(sum+counts[2],n)}%" role="img" aria-label="${sum}/${n} đã check-in"><div class="donut-center"><strong>${sum}<span>/${n}</span></strong><small>Đã check-in</small></div></div><div class="attendance-legend">${['Đúng giờ','Đi trễ','Nghỉ phép','Chưa check-in'].map((name,i)=>`<li><span class="legend-key" style="--tone:${['#5296ec','#e9b667','#a58ad9','#d8dee9'][i]}">${name}</span><strong>${counts[i]}</strong></li>`).join('')}</div></div><div class="attendance-summary"><strong>${n?(sum/n*100).toLocaleString('vi-VN',{maximumFractionDigits:1}):0}%</strong> nhân sự đã có mặt · ${dateLabel(f.date)}</div></div>`;}
function taskList(f){const tasks=visibleTasks(f).filter(t=>t.status!=='done'&&t.dueDate<='2026-10-26').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));return `<div class="card-body" style="padding-top:5px">${tasks.slice(0,5).map(t=>{const u=s.users.find(u=>u.id===t.assigneeId),over=t.dueDate<'2026-10-19';return `<a class="task-item" href="#/workspace/tasks" data-open="task" data-id="${t.id}"><span class="task-check"></span><div><h3>${e(t.title)}</h3><p>${e(t.code)} <span>·</span> ${badge(t.priority)}</p><div class="due ${over?'overdue':''}">${icon('calendar',10)} ${over?'Quá hạn · ':''}${dateLabel(t.dueDate)}</div></div>${avatar(u)}</a>`;}).join('')||empty('Không có task sắp đến hạn','Bạn đã hoàn thành các công việc trong tuần.')}</div>`;}
function notifications(limit=99,filter='all'){let ns=s.notifications.filter(n=>n.recipientId===user().id&&(filter==='all'||filter==='unread'&&!n.readAt||n.type===filter));return ns.slice(0,limit).map(n=>`<a href="#${n.targetRoute}" class="notification-row ${!n.readAt?'unread':''}" data-notification="${n.id}"><div class="icon-tile ${n.type==='leave'?'purple':n.type==='system'?'orange':'blue'}">${icon(n.type==='task'?'check':n.type==='leave'?'calendar':n.type==='system'?'file':'clock',15)}</div><div><h3>${e(n.title)}</h3><p>${e(n.body)}</p><p>${timeLabel(n.createdAt)} · ${dateLabel(n.createdAt)}</p></div></a>`).join('')||empty('Không có thông báo','Bạn đã cập nhật mọi thông tin.');}
function activityList(f,limit=6){const us=new Set(visibleEmployees(f).map(u=>u.id));return `<div class="card-body">${s.activities.filter(a=>us.has(a.actorId)||a.actorId===user().id).slice(0,limit).map(a=>{const u=s.users.find(u=>u.id===a.actorId),p=s.projects.find(p=>p.id===a.projectId);return `<div class="timeline-row">${avatar(u)}<div><p><strong>${e(u?.name)}</strong> ${e(a.action)}</p><small>${p?e(p.name)+' · ':''}${timeLabel(a.createdAt)} · ${dateLabel(a.createdAt)}</small></div></div>`;}).join('')||empty('Chưa có hoạt động','Các cập nhật của bạn sẽ xuất hiện tại đây.')}</div>`;}
function dashboard(f){const u=user(),us=visibleEmployees(f),ps=scope.projects(s,u).filter(p=>!f.team||p.teamIds.includes(f.team)),ts=visibleTasks(f),done=ts.filter(t=>t.status==='done').length,ars=attendanceRows({...f,search:'',status:''}),check=ars.filter(({a})=>!!a?.checkIn).length;const admin=u.role==='Admin',hr=u.role==='HR';let metrics=admin?kpi('Tài khoản hoạt động',s.users.filter(x=>x.status==='active').length,'users','Toàn bộ hệ thống','users','blue')+kpi('Nhóm quyền',5,'roles','Phân quyền theo phạm vi','shield','purple')+kpi('Nhật ký thao tác',s.auditLogs.length,'','Ghi nhận trong bản demo','file','orange')+kpi('Phòng ban',s.departments.length,'','Engineering & People','briefcase','teal'):hr?kpi('Nhân sự công ty',us.length,'người','Đang làm việc tại Intelex','users','blue')+kpi('Hợp đồng sắp hết',s.contracts.filter(c=>c.endDate<'2026-11-19').length,'','Trong 30 ngày tới','file','purple')+kpi('Yêu cầu cần xử lý',s.requests.filter(r=>r.currentApproverId===u.id).length,'','Đang chờ HR phê duyệt','approval','orange')+kpi('Chấm công hôm nay',check,`/ ${us.length}`,'Có mặt trong ngày','clock','teal'):kpi(u.role==='Dev'?'Thành viên':'Nhân sự quản lý',us.length,'người',u.role==='Dev'?'Không gian cá nhân':`${new Set(us.map(x=>x.teamId)).size} team trong phạm vi`,'users','blue')+kpi('Dự án đang chạy',ps.length,'dự án','Đang trong giai đoạn triển khai','folder','purple')+kpi('Task hoàn thành',done,`/ ${ts.length}`,`${pct(done,ts.length)}% công việc đã hoàn tất`,'check','orange')+kpi('Chấm công hôm nay',check,`/ ${us.length}`,'Nhân sự đã check-in','clock','teal');return `<div class="welcome-banner"><div class="welcome-icon">${icon('sun',21)}</div><div><strong>Một tuần mới, những ý tưởng mới.</strong><p>${u.role==='Dev'?'Sẵn sàng cùng Intelex tạo nên những điều có ý nghĩa.':`Bạn có ${scope.requests(s,u).filter(r=>r.currentApproverId===u.id).length} yêu cầu đang chờ xử lý. Cùng giữ nhịp làm việc của đội ngũ nhé!`}</p></div><a href="#/approvals" class="btn small">Xem yêu cầu ${icon('arrow',13)}</a></div><div class="kpis">${metrics}</div><div class="dashboard-grid">${hr||admin?card('Nhịp làm việc Intelex','Hoạt động mới nhất trong công ty',activityList(f,5),link('Xem nhân sự','/hr/employees')):card('Tiến độ dự án','Tổng quan tiến độ các dự án đang triển khai',projectChart(f),`<div class="chart-meta"><span class="legend-key blue">Đúng kế hoạch</span><span class="legend-key orange">Có nguy cơ</span></div>`)}${card('Chấm công hôm nay','Tình hình hiện diện của đội ngũ',attendanceChart(f),button('','refresh','refresh','text','aria-label="Làm mới chấm công"'))}</div><div class="dashboard-grid">${card('Báo cáo chấm công',`${dateLabel(f.date)} · Theo dõi check-in của đội ngũ`,`<div class="table-toolbar"><input placeholder="Tìm nhân viên…" aria-label="Tìm nhân viên chấm công" data-filter="search" value="${e(f.search)}"><select data-filter="status" aria-label="Lọc chấm công"><option value="">Tất cả trạng thái</option>${['ontime','late','leave','absent'].map(k=>`<option value="${k}" ${f.status===k?'selected':''}>${labels[k]}</option>`).join('')}</select></div>${attendanceTable(f,true)}`,link('Xem tất cả',u.role==='Dev'?'/workspace/attendance':'/reports'))}${hr||admin?card('Thông báo','Thông tin dành cho bạn',`<div class="card-body" style="padding-top:4px">${notifications(4)}</div>`,link('Tất cả','/notifications')):card('Task sắp đến hạn','Ưu tiên hôm nay và trong 7 ngày tới',taskList(f),link('Xem tất cả',u.role==='Dev'?'/workspace/tasks':'/projects/tasks'))}</div><div class="dashboard-grid">${card('Hoạt động gần đây','Những cập nhật mới nhất từ đội ngũ',activityList(f,5),`<span class="tag">Hôm nay</span>`)}${card('Bảng tin Intelex','Kết nối và cập nhật thông tin',`<div class="card-body" style="padding-top:4px">${notifications(3)}</div>`,link('Xem tất cả','/notifications'))}</div>`;}


// Source: pages/attendance-report.js
function reportRows(f){const from=f.period==='month'?(f.month||'2026-10')+'-01':f.from||f.date;let to=f.period==='month'?(f.month||'2026-10')+'-31':f.to||f.date;if(f.period==='month'){const [y,m]=(f.month||'2026-10').split('-').map(Number);to=`${y}-${String(m).padStart(2,'0')}-${new Date(y,m,0).getDate()}`;}if(to>'2026-10-19')to='2026-10-19';return scope.employees(s,user()).filter(u=>(!f.team||u.teamId===f.team)&&(!f.department||u.departmentId===f.department)&&(!f.employee||u.id===f.employee)&&matches(u.name+u.employeeCode,f.search)).map(u=>{const records=s.attendance.filter(a=>a.userId===u.id&&a.date>=from&&a.date<=to),valid=records.filter(a=>a.checkIn&&a.checkOut);const worked=valid.reduce((sum,a)=>sum+workMinutes(a,s.settings)/60,0),late=records.filter(a=>attendanceStatus(a)==='late').length,early=valid.filter(a=>a.checkOut.slice(11,16)<s.settings.shiftEnd).length,leave=records.filter(a=>a.leaveRequestId).length;const overtime=s.requests.filter(r=>r.requesterId===u.id&&r.type==='overtime'&&r.status==='approved'&&r.startDate>=from&&r.endDate<=to).reduce((sum,r)=>sum+(Number(r.hours)||0),0);return {u,standard:to>=from?workDays(from,to):0,actual:(worked/8).toFixed(1),late,early,overtime,leave,worked:worked.toFixed(1)};});}
function exportReport(f){csvDownload('intelex-bao-cao-cham-cong',['Mã NV','Nhân viên','Công chuẩn','Công thực tế','Đi trễ','Về sớm','Tăng ca (giờ)','Nghỉ phép','Giờ công'],reportRows(f).map(r=>[r.u.employeeCode,r.u.name,r.standard,r.actual,r.late,r.early,r.overtime,r.leave,r.worked]));}
function attendanceReport(f){const rows=reportRows(f);return `<div class="toolbar"><select data-filter="period" aria-label="Kỳ báo cáo"><option value="day" ${f.period!=='month'&&f.period!=='range'?'selected':''}>Theo ngày</option><option value="month" ${f.period==='month'?'selected':''}>Theo tháng</option><option value="range" ${f.period==='range'?'selected':''}>Khoảng ngày</option></select>${f.period==='month'?`<input type="month" aria-label="Tháng báo cáo" data-filter="month" value="${f.month||'2026-10'}" max="2026-10">`:f.period==='range'?`<input type="date" aria-label="Từ ngày" data-filter="from" value="${f.from||f.date}" max="2026-10-19"><input type="date" aria-label="Đến ngày" data-filter="to" value="${f.to||f.date}" max="2026-10-19">`:`<input type="date" aria-label="Ngày báo cáo" data-filter="date" value="${f.date}" max="2026-10-19">`}${teamOptions(f)}<select data-filter="department" aria-label="Phòng ban"><option value="">Tất cả phòng ban</option>${s.departments.map(d=>`<option value="${d.id}" ${f.department===d.id?'selected':''}>${e(d.name)}</option>`).join('')}</select><select data-filter="employee" aria-label="Nhân viên"><option value="">Tất cả nhân viên</option>${scope.employees(s,user()).filter(u=>!f.team||u.teamId===f.team).map(u=>`<option value="${u.id}" ${f.employee===u.id?'selected':''}>${e(u.name)}</option>`).join('')}</select>${button('Xuất CSV','export-report','download')}${button('In / PDF','print','print')}</div><div class="kpis">${kpi('Nhân sự',rows.length,'người','Theo phạm vi & bộ lọc','users','blue')}${kpi('Tổng giờ công',rows.reduce((n,r)=>n+Number(r.worked),0).toLocaleString('vi-VN'),'giờ','Chỉ tính các ca đã check-out','clock','teal')}${kpi('Lượt đi trễ',rows.reduce((n,r)=>n+r.late,0),'lượt','Theo giờ bắt đầu ca','calendar','orange')}${kpi('Ngày phép',rows.reduce((n,r)=>n+r.leave,0),'ngày','Theo lịch nghỉ đã duyệt','sun','purple')}</div>${card('Báo cáo chấm công chi tiết','Công thực tế = giờ công hợp lệ / 8 · Ngày chưa kết thúc chỉ ghi nhận giờ vào',table(['Nhân viên','Công chuẩn','Công thực tế','Đi trễ','Về sớm','Tăng ca (giờ)','Nghỉ phép','Giờ công'],rows.map(r=>[person(r.u),r.standard,r.actual,r.late,r.early,r.overtime,r.leave,r.worked]),{page:f.page,size:Number(f.size)||10}),`<select aria-label="Số dòng mỗi trang" data-filter="size">${[10,20,50].map(n=>`<option value="${n}" ${Number(f.size)===n?'selected':''}>${n} dòng</option>`).join('')}</select>`)}<p class="muted" style="font-size:11px;margin-top:14px">Số liệu đến ngày demo 19/10/2026. Ca mẫu 8 giờ/ngày, không tính ngày lễ. Ngày chưa có dữ liệu không được tính là vắng không phép.</p>`;}


// Source: pages/employees.js

const employeeStatuses={ACTIVE:'Đang làm việc',INACTIVE:'Ngừng hoạt động',TERMINATED:'Đã nghỉ việc'};
const employeeValue=value=>e(value||'—');
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
 root.innerHTML=`<a class="btn" href="#/hr/employees">← Danh sách nhân viên</a><h2 class="role-editor-title">${e(employee.fullName)}</h2>${details([['Mã nhân viên',employeeValue(employee.employeeCode)],['Chức danh',employeeValue(employee.positionName)],['Phòng ban',employeeValue(employee.departmentName)],['Team',employeeValue(employee.teamName)],['Trạng thái',employeeValue(employeeStatuses[employee.employmentStatus]||employee.employmentStatus)],['Email',employeeValue(employee.email)],['Số điện thoại',employeeValue(employee.phoneNumber)],['Ngày sinh',employee.dateOfBirth?dateLabel(employee.dateOfBirth):'—'],['Ngày vào làm',employee.hireDate?dateLabel(employee.hireDate):'—']])}`;
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


// Source: pages/roles.js

const roleFlags=[['NEW','Thêm mới','can_new'],['VIEW','Xem','can_view'],['UPDATE','Chỉnh sửa','can_update'],['DELETE','Xóa','can_delete'],['APPROVE','Phê duyệt','can_approve'],['EXPORT','Xuất dữ liệu','can_export']];
function roleMenuGroups(catalog,platform='WEB'){
 catalog=catalog.filter(screen=>!screen.platform||screen.platform===platform);
 const used=new Set();const groups=nav.map(group=>{
 const entries=(group.children||[[group.name,group.route]]).flatMap(([label,path])=>{
 const codes=(screenRoutes[path]||['WEB_'+path.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()]).map(code=>platform==='MOBILE'?code.replace(/^WEB_/,'MOBILE_'):code);
 return catalog.filter(screen=>codes.includes(screen.code)&&!used.has(screen.id)).map(screen=>{used.add(screen.id);return {...screen,label};});
 });return {name:group.name,icon:group.icon,section:group.section,nested:!!group.children,entries};
 }).filter(group=>group.entries.length);
 const remaining=catalog.filter(screen=>!used.has(screen.id));
 if(remaining.length)groups.push({name:'Màn hình khác',icon:'grid',nested:true,entries:remaining.map(screen=>({...screen,label:screen.name}))});
 return groups;
}
function rolePermissionPatch(draft,changed,disabled=new Set(),scopes=new Map()){
 return [...changed].map(code=>({screenCode:code,standard:{...draft.get(code)},...(scopes.has(code)?{dataScopes:{...scopes.get(code)}}:{}),...(disabled.has(code)?{extendedActions:[]}: {})}));
}
function roleGrant(code,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y'&&p[flag]==='Y');}
async function mountRoles(root,filters){
 if(!root)return;
 let rolePage=Number(filters.page)||1,roleSearch=filters.search||'';
 const showError=(err,retry)=>{if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" data-role-retry>Thử lại</button>`;root.querySelector('[data-role-retry]').onclick=retry;};
 async function list(){
 root.innerHTML='<p role="status">Đang tải danh sách role…</p>';
 try{const result=await apiRoles(rolePage,roleSearch);if(!root.isConnected)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách role không hợp lệ.');
 root.innerHTML=`<form id="role-search" class="toolbar"><input name="search" value="${e(roleSearch)}" placeholder="Tìm mã hoặc tên role" aria-label="Tìm role"><button class="btn">Tìm kiếm</button></form><div class="table-wrap"><table><thead><tr><th>Mã role</th><th>Tên role</th><th>Hành động</th></tr></thead><tbody>${result.data.map(role=>`<tr><td>${e(role.code)}</td><td>${e(role.name)}</td><td><button class="btn" data-edit-role="${e(role.id)}" ${roleGrant('WEB_PERMISSIONS','canView')?'':'disabled'}>Chỉnh sửa</button></td></tr>`).join('')}</tbody></table></div>${!result.data.length?'<p>Không có role phù hợp.</p>':''}<div class="toolbar"><button class="btn" id="role-prev" ${rolePage<=1?'disabled':''}>Trang trước</button><span>Trang ${rolePage} · ${e(result.total)} role</span><button class="btn" id="role-next" ${rolePage*30>=result.total?'disabled':''}>Trang sau</button></div><p class="muted">Chỉnh sửa quyền cần quyền xem WEB_PERMISSIONS. Lưu cần quyền cập nhật và phê duyệt.</p>`;
 root.querySelector('#role-search').onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();roleSearch=ev.currentTarget.elements.search.value.trim();rolePage=1;list();};
 root.querySelector('#role-prev').onclick=()=>{rolePage--;list();};root.querySelector('#role-next').onclick=()=>{rolePage++;list();};
 root.querySelectorAll('[data-edit-role]').forEach(el=>el.onclick=()=>edit(result.data.find(r=>String(r.id)===el.dataset.editRole)));
 }catch(err){showError(err,list);}
 }
 async function edit(role){
 root.innerHTML='<p role="status">Đang tải màn hình và quyền của role…</p>';
 try{const [catalog,matrix]=await Promise.all([apiAllScreens(),apiRolePermissions(role.id)]);if(!root.isConnected)return;
 if(!Array.isArray(matrix?.screens)||!matrix.version)throw Error('Ma trận quyền hoặc version không hợp lệ.');
 // Keep inactive grants visible and read-only; extended actions are omitted from patches to preserve them.
 const screens=[...catalog];for(const item of matrix.screens)if(!screens.some(x=>x.id===item.screenId))screens.push({id:item.screenId,code:item.screenCode,name:item.name,platform:item.platform,isActive:false});
 const draft=new Map(screens.map(screen=>{const original=matrix.screens.find(x=>x.screenCode===screen.code);return [screen.code,Object.fromEntries(roleFlags.map(([flag])=>[flag,original?.standard?.[flag]===true]))];}));
 const scopes=new Map(matrix.screens.filter(item=>item.screenCode==='WEB_EMPLOYEES').map(item=>[item.screenCode,{...item.dataScopes}]));
 const enabledScreens=new Set(matrix.screens.filter(item=>Object.values(item.standard||{}).some(value=>value===true)||item.extendedActions?.length).map(item=>item.screenCode));
 const disabledScreens=new Set();
 const changed=new Set();let activePlatform='WEB';
 const selectedByPlatform={WEB:screens.find(screen=>screen.platform==='WEB'),MOBILE:screens.find(screen=>screen.platform==='MOBILE')};
 let selected=selectedByPlatform.WEB;let saving=false;let nameDraft=role.name;
 const openByPlatform={WEB:new Set(),MOBILE:new Set()};
 for(const platform of ['WEB','MOBILE'])roleMenuGroups(screens,platform).filter(group=>group.entries.some(screen=>screen.id===selectedByPlatform[platform]?.id)).forEach(group=>openByPlatform[platform].add(group.name));
 const canSave=roleGrant('WEB_PERMISSIONS','canUpdate')&&roleGrant('WEB_PERMISSIONS','canApprove');
 function screenSwitch(screen){return `<span class="role-switch role-screen-switch"><input type="checkbox" role="switch" aria-label="Phân quyền màn hình ${e(screen.name)}" data-screen-enabled="${e(screen.id)}" ${enabledScreens.has(screen.code)?'checked':''} ${!canSave||screen.isActive===false||saving?'disabled':''}><span class="role-switch-track" aria-hidden="true"></span></span>`;}
 function draw(){
 const menuGroups=roleMenuGroups(screens,activePlatform),openGroups=openByPlatform[activePlatform];
 root.innerHTML=`<button class="btn" id="role-back">← Danh sách role</button><h2 class="role-editor-title">Chỉnh sửa role</h2><form id="role-rename" class="role-name-editor"><label for="role-name">Tên role</label><input id="role-name" name="name" required maxlength="100" value="${e(nameDraft)}" ${!roleGrant('WEB_ROLES','canUpdate')||saving?'disabled':''}><button class="btn" ${!roleGrant('WEB_ROLES','canUpdate')||saving?'disabled':''}>Lưu tên role</button><span class="muted">${e(role.code)}</span></form><p class="muted">Chọn màn hình trong menu, sau đó bật các chức năng được phép.</p><div class="tabs role-platform-tabs" role="tablist" aria-label="Nền tảng phân quyền">${['WEB','MOBILE'].map(platform=>`<button type="button" role="tab" id="role-platform-${platform}" class="tab ${activePlatform===platform?'active':''}" aria-selected="${activePlatform===platform}" aria-controls="role-platform-panel" data-role-platform="${platform}">${icon(platform==='WEB'?'grid':'person',16)} ${platform}</button>`).join('')}</div><div class="role-editor" id="role-platform-panel" role="tabpanel" aria-labelledby="role-platform-${activePlatform}"><nav class="role-menu" aria-label="Màn hình phân quyền">${menuGroups.map(group=>{
 const active=group.entries.some(screen=>screen.id===selected?.id),open=openGroups.has(group.name);
 const screenButton=screen=>`<div class="role-screen-row"><button type="button" class="role-screen ${selected?.id===screen.id?'selected':''}" data-screen-id="${e(screen.id)}" ${selected?.id===screen.id?'aria-current="true"':''}><span>${e(screen.label)}</span>${changed.has(screen.code)?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${screenSwitch(screen)}</div>`;
 return `${group.section?`<div class="nav-caption">${e(group.section)}</div>`:''}${group.nested?`<button type="button" class="nav-item ${active?'active':''}" data-role-group="${e(group.name)}" aria-expanded="${open}">${icon(group.icon,18)}<span class="nav-label">${e(group.name)}</span><span class="chev ${open?'role-chevron-open':''}">${icon('chevron',12)}</span></button>${open?`<div class="submenu role-submenu">${group.entries.map(screenButton).join('')}</div>`:''}`:`<div class="role-screen-row"><button type="button" class="nav-item ${active?'active':''}" data-screen-id="${e(group.entries[0].id)}" ${active?'aria-current="true"':''}>${icon(group.icon,18)}<span>${e(group.name)}</span>${changed.has(group.entries[0].code)?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${screenSwitch(group.entries[0])}</div>`}`;
 }).join('')||'<p class="muted role-menu-empty">Chưa có màn hình cho nền tảng này.</p>'}</nav><section class="role-functions">${selected?`<div class="role-functions-heading"><span class="icon-tile blue">${icon('shield',20)}</span><div><h3>${e(selected.name)}</h3><p class="muted">${enabledScreens.has(selected.code)?'Thiết lập quyền thao tác trên màn hình':'Bật nút gạt ở menu để phân quyền màn hình này'}</p></div></div>${selected.isActive===false?'<p>Màn hình ngừng hoạt động · chỉ xem quyền đã cấp.</p>':''}<div class="role-toggles">${roleFlags.map(([flag,label])=>`<div class="role-permission-item"><label class="role-toggle-row"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" aria-label="${label}" data-role-flag="${flag}" ${draft.get(selected.code)[flag]?'checked':''} ${!canSave||!enabledScreens.has(selected.code)||selected.isActive===false||saving?'disabled':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>${selected.code==='WEB_EMPLOYEES'?`<div class="role-scope"><select data-role-scope="${flag}" aria-label="Phạm vi ${label}" ${!canSave||!enabledScreens.has(selected.code)||!draft.get(selected.code)[flag]||selected.isActive===false||saving?'disabled':''}>${[['SELF','Chính mình'],['DEPARTMENT','Cùng phòng ban'],['ALL','Tất cả']].map(([value,text])=>`<option value="${value}" ${(scopes.get(selected.code)?.[flag]||'SELF')===value?'selected':''}>${text}</option>`).join('')}</select></div>`:''}</div>`).join('')}</div>${selected.code==='WEB_EMPLOYEES'?'<p class="muted role-scope-note">Chính mình chỉ cho phép đọc. Các thao tác ghi cần phạm vi Cùng phòng ban hoặc Tất cả.</p>':''}`:'<p>Chưa có màn hình trong danh mục.</p>'}</section></div><div class="role-save"><p id="role-feedback" role="status"></p><span>${changed.size} màn hình thay đổi</span><button id="role-save" class="btn primary" ${!canSave||!changed.size||saving?'disabled':''}>${saving?'Đang lưu…':'Lưu lại'}</button></div>`;
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
 root.querySelectorAll('[data-screen-id]').forEach(el=>el.onclick=()=>{selected=screens.find(x=>String(x.id)===el.dataset.screenId);draw();});
 root.querySelectorAll('[data-screen-enabled]').forEach(el=>el.onchange=()=>{
 const screen=screens.find(item=>String(item.id)===el.dataset.screenEnabled);
 if(!screen||!canSave||screen.isActive===false||saving)return;
 selected=screen;
 if(el.checked){enabledScreens.add(screen.code);draft.get(screen.code).VIEW=true;if(screen.code==='WEB_EMPLOYEES'){if(!scopes.has(screen.code))scopes.set(screen.code,{});scopes.get(screen.code).VIEW??='SELF';}}
 else{enabledScreens.delete(screen.code);disabledScreens.add(screen.code);roleFlags.forEach(([flag])=>{draft.get(screen.code)[flag]=false;});}
 changed.add(screen.code);draw();root.querySelector(`[data-screen-enabled="${screen.id}"]`)?.focus();
 });
 root.querySelectorAll('[data-role-flag]').forEach(el=>el.onchange=()=>{draft.get(selected.code)[el.dataset.roleFlag]=el.checked;if(selected.code==='WEB_EMPLOYEES'&&el.checked){if(!scopes.has(selected.code))scopes.set(selected.code,{});scopes.get(selected.code)[el.dataset.roleFlag]??='SELF';}changed.add(selected.code);const flag=el.dataset.roleFlag;draw();root.querySelector(`[data-role-flag="${flag}"]`)?.focus();});
 root.querySelectorAll('[data-role-scope]').forEach(el=>el.onchange=()=>{
 if(!canSave||saving||selected.isActive===false)return;
 const flag=el.dataset.roleScope;
 if(!enabledScreens.has(selected.code)||!draft.get(selected.code)[flag])return;
 if(!scopes.has(selected.code))scopes.set(selected.code,{});
 scopes.get(selected.code)[flag]=el.value;
 changed.add(selected.code);draw();
 root.querySelector(`[data-role-scope="${flag}"]`)?.focus();
 });
 root.querySelector('#role-save').onclick=async()=>{
 if(saving||!canSave||!changed.size)return;saving=true;draw();
 try{const saved=await apiSaveRolePermissions(role.id,matrix.version,rolePermissionPatch(draft,changed,disabledScreens,scopes));if(!root.isConnected)return;
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


// Source: pages/users.js

function userApiGrant(code,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');}
async function registerSystemUser(input){
 const {employeeId,...account}=input.account;
 if(input.employee){
 const {employeeCode,...employee}=input.employee;
 return apiCreateUser({...account,createEmployee:true,employee});
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
 root.innerHTML=`<form id="system-user-search" class="toolbar"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm tài khoản hoặc email" aria-label="Tìm tài khoản"><button class="btn">Tìm kiếm</button>${userApiGrant('WEB_USERS','canNew')?'<a class="btn primary" href="#/admin/users/register">Đăng ký tài khoản</a>':''}</form><div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Hồ sơ nhân viên</th><th>Hành động</th></tr></thead><tbody>${result.data.map(account=>`<tr><td>${e(account.userId)}</td><td>${e(account.email)}</td><td>${(account.roles||[]).map(role=>`<span class="tag">${e(role.name||role.code)}</span>`).join(' ')||'Chưa phân vai trò'}</td><td>${e(statuses[account.status]||account.status)}</td><td>${account.employeeId?'Đã liên kết':'Chưa liên kết'}</td><td>${userApiGrant('WEB_USERS','canUpdate')||userApiGrant('WEB_USERS','canApprove')?`<button type="button" class="btn" data-system-edit-user="${e(account.userId)}">Chỉnh sửa</button>`:''}</td></tr>`).join('')}</tbody></table></div>${!result.data.length?'<p>Không có tài khoản phù hợp.</p>':''}<div class="toolbar user-pagination"><button class="btn" id="system-user-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} tài khoản</span><button class="btn" id="system-user-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
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
 root.innerHTML=`<a class="btn" href="#/admin/users">← Danh sách tài khoản</a><form id="system-user-register" class="user-registration"><section class="user-form-section"><h2>Thông tin tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text','','required maxlength="100" pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" autocomplete="off"')}${field('Email','email','email','','required maxlength="255" autocomplete="off"')}${field('Mật khẩu','password','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}${field('Nhập lại mật khẩu','confirmPassword','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}</div></section><section class="user-form-section"><h2>Vai trò</h2><p class="muted">Có thể chọn nhiều vai trò cho tài khoản.</p><div id="system-role-options" class="user-role-picker">${canAssign?'Đang tải vai trò…':'Bạn chưa có quyền gán vai trò. Tài khoản sẽ được tạo chưa có vai trò.'}</div></section><section class="user-form-section"><label class="role-toggle-row"><span><strong>Tạo kèm hồ sơ nhân viên</strong><small class="user-field-note">Tạo và liên kết cùng lúc; mã nhân viên được hệ thống tự cấp</small></span><span class="role-switch"><input type="checkbox" role="switch" name="createEmployee" ${canEmployee?'':'disabled'}><span class="role-switch-track" aria-hidden="true"></span></span></label>${!canEmployee?'<p class="muted">Bạn chưa có quyền tạo hồ sơ nhân viên.</p>':''}<fieldset id="system-employee-fields" hidden disabled><div class="form-grid">${field('Email nhân viên','employeeEmail','email','','required maxlength="255" autocomplete="off"')}${field('Họ và tên','fullName','text','','required maxlength="150"')}${field('Ngày sinh','dateOfBirth','date','','')}${field('Số điện thoại','phoneNumber','tel','','maxlength="20"')}${field('Ngày vào làm','hireDate','date','','required')}<label>Phòng ban<select name="departmentId" required><option value="">Chọn phòng ban</option></select></label><label>Chức danh (tùy chọn)<select name="positionId" disabled><option value="">Chưa chọn chức danh</option></select></label><label>Team (tùy chọn)<select name="teamId" disabled><option value="">Chọn phòng ban trước</option></select></label></div><p id="system-position-feedback" role="status"></p><p id="system-team-feedback" role="status"></p><p id="system-department-error" role="alert"></p></fieldset></section><p id="system-register-feedback" class="form-error" role="alert"></p><div class="form-actions"><a class="btn" href="#/admin/users">Hủy</a><button type="submit" class="btn primary" id="system-register-submit">Đăng ký tài khoản</button></div></form>`;
 const form=root.querySelector('#system-user-register'),feedback=root.querySelector('#system-register-feedback'),employeeFields=root.querySelector('#system-employee-fields');
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
 const data=new FormData(form),staff=form.elements.createEmployee.checked;
 if(data.get('password')!==data.get('confirmPassword')){feedback.textContent='Mật khẩu nhập lại không khớp.';return;}
 if(staff&&(!departments||departmentsLoading||!departments.some(dep=>String(dep.id)===data.get('departmentId')))){feedback.textContent='Vui lòng chọn phòng ban hợp lệ.';return;}
 if(staff&&data.get('dateOfBirth')&&data.get('dateOfBirth')>data.get('hireDate')){feedback.textContent='Ngày sinh phải trước hoặc bằng ngày vào làm.';return;}
 const selectedPosition=data.get('positionId');
 if(staff&&selectedPosition&&(positionsLoading||!positions?.some(position=>String(position.id)===selectedPosition))){feedback.textContent='Vui lòng chọn chức danh hợp lệ đang hoạt động.';return;}
 const selectedTeam=data.get('teamId');
 if(staff&&selectedTeam&&(teamsLoading||!teams.some(team=>String(team.id)===selectedTeam&&Number(team.departmentId)===Number(data.get('departmentId'))))){feedback.textContent='Vui lòng chọn team hợp lệ thuộc phòng ban đã chọn.';return;}
 const account={userId:data.get('userId').trim(),email:data.get('email').trim(),password:data.get('password'),roleIds:data.getAll('roleIds').map(Number)};
 const employee=staff?{fullName:data.get('fullName').trim(),email:data.get('employeeEmail').trim(),teamId:selectedTeam?Number(selectedTeam):null,positionId:selectedPosition?Number(selectedPosition):null,dateOfBirth:data.get('dateOfBirth')||null,phoneNumber:data.get('phoneNumber').trim()||null,hireDate:data.get('hireDate'),departmentId:Number(data.get('departmentId')),employmentStatus:'ACTIVE'}:null;
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
 const latest=await apiUserDetail(current.userId);Object.assign(current,latest);
 saved=await apiResetUserPassword(current.userId,current.version,{type:'ADMIN_RESET',newPassword:changes.newPassword});
 if(!saved?.version)throw Error('Chưa nhận phiên bản sau đổi mật khẩu. Hãy mở lại tài khoản để xác nhận.');
 Object.assign(current,saved);
 }
 return saved;
}
async function editSystemUser(root,userId,back){
 root.innerHTML='<p role="status">Đang tải thông tin tài khoản…</p>';
 try{const current=await apiUserDetail(userId);if(!root.isConnected)return;
 const canUpdate=userApiGrant('WEB_USERS','canUpdate'),canRoles=userApiGrant('WEB_USERS','canApprove')&&apiSession()?.user?.userId!==userId;
 let busy=false,employeeId=current.employeeId??null,employeePage=1,employeeSearch='',searchGeneration=0;
 root.innerHTML=`<button type="button" class="btn" id="system-edit-back">← Danh sách tài khoản</button><form id="system-edit-form" class="user-registration"><fieldset class="user-edit-fieldset"><section class="user-form-section"><h2>Chỉnh sửa tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text',current.userId,'readonly')}${field('Email','email','email',current.email,`required maxlength="255" ${canUpdate?'':'readonly'}`)}<div class="user-password-field"><label for="system-new-password">Mật khẩu</label><div class="user-password-control"><input id="system-new-password" name="newPassword" type="password" placeholder="********" minlength="12" maxlength="128" autocomplete="new-password" ${canRoles?'':'disabled'}><button type="button" class="btn" id="system-password-eye" aria-label="Xem mật khẩu mới" aria-pressed="false" ${canRoles?'':'disabled'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><small class="muted">Để trống để giữ nguyên mật khẩu. Nút mắt chỉ hiển thị mật khẩu mới bạn nhập.</small></div></div></section><section class="user-form-section"><h2>Vai trò</h2><div id="system-edit-role-picker" class="user-role-picker">Đang tải vai trò…</div></section><section class="user-form-section"><h2>Liên kết nhân viên</h2><div id="system-linked-employee"></div>${canUpdate&&userApiGrant('WEB_EMPLOYEES','canView')?'<div class="toolbar user-employee-search"><input id="system-employee-search" placeholder="Tìm mã hoặc tên nhân viên" maxlength="150" aria-label="Tìm nhân viên"><button type="button" class="btn" id="system-employee-find">Tìm kiếm</button></div><div id="system-employee-results"></div>':'<p class="muted">Cần quyền xem nhân viên để tìm hồ sơ liên kết.</p>'}</section></fieldset><p id="system-edit-feedback" class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="btn" id="system-edit-cancel">Hủy</button><button type="submit" class="btn primary">Lưu lại</button></div></form>`;
 const form=root.querySelector('#system-edit-form'),feedback=root.querySelector('#system-edit-feedback');
 const passwordInput=form.elements.newPassword;
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
 linked();
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
 if(!rolesReady){feedback.textContent='Chưa tải được vai trò. Vui lòng mở lại tài khoản.';return;}
 busy=true;form.querySelector('fieldset').disabled=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Đang lưu…';feedback.textContent='';
 const previousVersion=current.version;
 try{await saveSystemUserChanges(current,{profile:canUpdate?{email:form.elements.email.value.trim(),employeeId}:null,roleIds:canRoles?getRoles():null,newPassword:canRoles?passwordInput.value:undefined});if(!root.isConnected)return;passwordInput.value='';passwordInput.type='password';root.querySelector('#system-password-eye')?.setAttribute('aria-pressed','false');feedback.textContent='Đã lưu tài khoản thành công.';findEmployees();}
 catch(err){if(!root.isConnected)return;feedback.textContent=(current.version!==previousVersion?'Một phần thay đổi đã được lưu; các thay đổi còn lại chưa hoàn tất. ':'')+err.message+' Nếu có xung đột phiên bản, mở lại tài khoản để tải dữ liệu mới.';}
 finally{busy=false;if(root.isConnected){form.querySelector('fieldset').disabled=false;submit.disabled=false;submit.textContent='Lưu lại';}}
 };
 }catch(err){if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="system-edit-error-back">Về danh sách</button>`;root.querySelector('#system-edit-error-back').onclick=back;}
}


// Source: pages/work.js
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


// Source: pages/operations.js
function hrPage(f,path){if(apiSession()&&(path==='/hr/employees'||path.startsWith('/hr/employees/')))return '<section class="card user-admin" id="employees-api-root"></section>';if(path==='/hr/employees')return peoplePage(f);if(path.startsWith('/hr/employees/')){const u=scope.employees(s,user()).find(u=>u.id===path.split('/').pop());if(!u)return empty('Không tìm thấy nhân viên','Hồ sơ nằm ngoài phạm vi của bạn.');return card('Hồ sơ nhân viên','Thông tin công việc tại Intelex',`<div class="card-body">${person(u)}${details([['Chức danh',e(u.position)],['Email',e(u.email)],['Team',e(s.teams.find(t=>t.id===u.teamId)?.name||'Office')],['Ngày gia nhập',dateLabel(u.joinedAt)]])}${scope.can(s,user(),'hr')?button('Sửa hồ sơ','edit-employee','edit','primary',`data-id="${u.id}"`):''}</div>`);}if(path==='/hr/attendance')return `${tabs([['company','Toàn công ty'],['adjustment','Điều chỉnh'],['shifts','Ca làm việc'],['late','Đi trễ / Về sớm'],['overtime','Tăng ca']],f.tab||'company')}${f.tab==='shifts'?card('Ca làm việc','Ca chuẩn toàn công ty',`<div class="card-body">${details([['Tên ca','Hành chính'],['Giờ làm',`${e(s.settings.shiftStart)}–${e(s.settings.shiftEnd)}`],['Nghỉ trưa','12:00–13:00'],['Ngày làm','Thứ Hai–Thứ Sáu']])}<a class="btn" href="#/admin/settings">Cấu hình ca (Admin)</a></div>`):['adjustment','overtime'].includes(f.tab)?approvalPage(f):attendancePage(f.tab==='late'?{...f,status:'late'}:f)}`;
 if(path.includes('attendance-reports')||path==='/hr/reports')return reportsPage({...f,tab:f.tab||'attendance'});if(path==='/hr/leave')return `${tabs([['requests','Đơn nghỉ phép'],['types','Loại nghỉ'],['balances','Số dư phép']],f.tab||'requests')}${f.tab==='types'?card('Danh mục loại phép','Quy định mô phỏng',`<div class="card-body">${s.leaveTypes.map(t=>`<p style="padding:12px;border-bottom:1px solid var(--border)">${e(t)}</p>`).join('')}</div>`):f.tab==='balances'?`<div class="card">${table(['Nhân viên','Định mức','Đã dùng','Còn lại'],s.leaveBalances.map(b=>[person(s.users.find(u=>u.id===b.userId)),b.allowanceDays+' ngày',b.usedDays+' ngày',(b.allowanceDays-b.usedDays)+' ngày']),{page:f.page})}</div>`:approvalPage({...f,tab:'leave'})}`;
 if(path==='/hr/contracts')return `<div class="toolbar">${button('Thêm hợp đồng','new-contract','plus','primary')}</div><div class="card">${table(['Nhân viên','Loại hợp đồng','Bắt đầu','Kết thúc','Trạng thái',''],s.contracts.map(c=>[person(s.users.find(u=>u.id===c.employeeId)),e(c.type),dateLabel(c.startDate),dateLabel(c.endDate),badge(c.endDate<'2026-11-19'?'high':'active',c.endDate<'2026-11-19'?'Sắp hết hạn':'Còn hiệu lực'),button('Sửa','edit-contract','edit','small',`data-id="${c.id}"`)]),{page:f.page})}</div>`;
 const tab=f.tab||'departments';return `${tabs([['departments','Phòng ban'],['teams','Teams'],['positions','Chức vụ']],tab)}<div class="project-grid">${(tab==='departments'?s.departments:tab==='teams'?s.teams:s.positions.map(name=>({name}))).map(x=>`<article class="card project-card"><div class="icon-tile blue">${icon('briefcase',22)}</div><h2>${e(x.name)}</h2><p>${tab==='departments'?s.users.filter(u=>u.departmentId===x.id).length+' nhân sự':tab==='teams'?s.users.filter(u=>u.teamId===x.id).length+' thành viên':'Chức danh tại Intelex'}</p></article>`).join('')}</div>`;
}
const permissionActions=[['team','Quản lý team'],['project.create','Tạo/sửa dự án'],['task.create','Tạo/giao công việc'],['hr','Quản lý nhân sự'],['admin','Quản trị hệ thống']];
function adminPage(f,path){if(path==='/admin/users'||path==='/admin/users/register')return '<section class="card user-admin" id="users-api-root"></section>';if(path==='/admin/roles')return '<section class="card role-admin" id="roles-api-root"></section>';
 if(path==='/admin/roles'||path==='/admin/permissions')return card('Ma trận quyền','Các thay đổi chỉ áp dụng trong bản demo hiện tại',table(['Quyền','Dev','Leader','Manager','HR','Admin'],permissionActions.map(([action,label])=>[label,...['Dev','Leader','Manager','HR','Admin'].map(role=>{const sample=s.users.find(u=>u.role===role),allowed=scope.can(s,sample,action);return `<input type="checkbox" aria-label="${label} cho ${role}" data-permission="${action}" data-role="${role}" ${allowed?'checked':''} ${role==='Admin'&&action==='admin'?'disabled':''}>`;})])));
 if(path==='/admin/audit-logs')return `<div class="card">${table(['Thời gian','Người thực hiện','Hành động'],s.auditLogs.map(a=>[`${dateLabel(a.createdAt)} ${timeLabel(a.createdAt)}`,e(s.users.find(u=>u.id===a.actorId)?.name),e(a.action)]),{page:f.page})}</div>`;
 if(path==='/admin/settings')return card('Thiết lập công ty','Cấu hình cho bản demo trên trình duyệt',`<div class="card-body"><form data-form="settings" class="settings-form"><div class="form-grid">${field('Tên công ty','companyName','text',s.settings.companyName,'required')}${field('Bắt đầu ca','shiftStart','time',s.settings.shiftStart,'required')}${field('Kết thúc ca','shiftEnd','time',s.settings.shiftEnd,'required')}</div><p class="muted" style="margin-top:15px">Giờ nghỉ trưa cố định 12:00–13:00. Lịch làm việc: thứ Hai–thứ Sáu.</p>${formFooter()}</form></div>`);
 return `${tabs([['departments','Phòng ban'],['positions','Chức vụ'],['leaveTypes','Loại phép']],f.tab||'departments')}<div class="toolbar">${button('Thêm danh mục','new-master','plus','primary')}</div><div class="card">${table(['Tên danh mục',''],(f.tab==='positions'?s.positions:f.tab==='leaveTypes'?s.leaveTypes:s.departments.map(x=>x.name)).map((name,i)=>[e(name),button('Sửa','edit-master','edit','small',`data-index="${i}"`)]))}</div>`;
}


// Source: router.js
const nav=[
 {name:'Dashboard',icon:'grid',route:'/dashboard',section:'TỔNG QUAN'},
 {name:'My Workspace',icon:'briefcase',route:'/workspace/tasks',children:[['My Tasks','/workspace/tasks'],['My Projects','/workspace/projects'],['My Attendance','/workspace/attendance'],['My Leave','/workspace/leave']]},
 {name:'Team Management',icon:'users',route:'/team/overview',children:[['Team Overview','/team/overview'],['Team Members','/team/members'],['Team Tasks','/team/tasks'],['Team Attendance','/team/attendance'],['Team Leave','/team/leave'],['Team Workload','/team/workload'],['Team Reports','/team/reports']]},
 {name:'Project Management',icon:'folder',route:'/projects',children:[['Projects','/projects'],['Tasks','/projects/tasks'],['Milestones','/projects/milestones'],['Members','/projects/members'],['Workload','/projects/workload'],['Timeline','/projects/timeline'],['Project Reports','/projects/reports']]},
 {name:'Human Resources',icon:'person',route:'/hr/employees',section:'QUẢN LÝ & VẬN HÀNH',children:[['Employees','/hr/employees'],['Organization','/hr/organization'],['Contracts','/hr/contracts'],['Attendance','/hr/attendance'],['Attendance Reports','/hr/attendance-reports'],['Leave Management','/hr/leave'],['HR Reports','/hr/reports']]},
 {name:'Approval Center',icon:'approval',route:'/approvals'},
 {name:'Reports & Analytics',icon:'chart',route:'/reports'},
 {name:'Documents',icon:'file',route:'/documents',section:'KHÔNG GIAN CHUNG'},
 {name:'Notifications',icon:'bell',route:'/notifications'},
 {name:'Administration',icon:'settings',route:'/admin/users',children:[['Users','/admin/users'],['Roles','/admin/roles'],['Permissions','/admin/permissions'],['Audit Logs','/admin/audit-logs'],['System Settings','/admin/settings'],['Master Data','/admin/master-data']]}
];
function getPath(){return (location.hash.slice(1).split('?')[0]||'/dashboard').replace(/\/$/,'')||'/dashboard';}
function groupFor(path){if(path==='/admin/users/register')return nav.find(n=>n.name==='Administration');return nav.find(n=>n.route===path||n.children?.some(c=>c[1]===path))||nav.find(n=>path.startsWith('/projects/')&&n.route==='/projects'||path.startsWith('/hr/employees/')&&n.route==='/hr/employees');}
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
 openDialog('Đổi mật khẩu',`<form id="self-password-form"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Mật khẩu hiện tại','currentPassword','password','','required autocomplete="current-password"')}${field('Mật khẩu mới','newPassword','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}${field('Nhập lại mật khẩu mới','confirmPassword','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}</div><label><input type="checkbox" id="self-password-visible"> Hiện mật khẩu</label><div class="form-actions"><button type="submit" class="btn primary">Đổi mật khẩu</button></div></fieldset><p role="alert" id="self-password-feedback"></p></form>`);
 const form=document.getElementById('self-password-form'),feedback=document.getElementById('self-password-feedback');
 form.querySelector('#self-password-visible').onchange=ev=>{form.querySelectorAll('input[name]').forEach(input=>input.type=ev.target.checked?'text':'password');};
 let saving=false;
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving)return;
 const newPassword=form.elements.newPassword.value;
 if(newPassword!==form.elements.confirmPassword.value){feedback.textContent='Mật khẩu nhập lại không khớp.';return;}
 if(!newPassword.trim()){feedback.textContent='Mật khẩu không được chỉ chứa khoảng trắng.';return;}
 saving=true;form.querySelector('fieldset').disabled=true;feedback.textContent='Đang đổi mật khẩu…';
 try{const own=await me();const version=own?.version||own?.user?.version||(await apiUserDetail(account.userId)).version;
 await apiResetUserPassword(account.userId,version,{type:'SELF_CHANGE',currentPassword:form.elements.currentPassword.value,newPassword});
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
 case 'read-all':s.notifications.filter(n=>n.recipientId===user().id).forEach(n=>n.readAt=NOW);save();render(true);toast('Đã đánh dấu tất cả đã đọc');return;
 case 'employee':employeeDetail(itemId);return;
 case 'task':taskDetail(itemId);return;
 case 'request':requestDetail(itemId);return;
 case 'new-task':taskForm();return;
 case 'edit-task':{const t=scope.tasks(s,user()).find(t=>t.id===itemId);if(!t||!scope.can(s,user(),'task.create'))throw Error('Không có quyền sửa.');taskForm(t);return;}
 case 'new-project':projectForm();return;
 case 'edit-project':{const p=scope.projects(s,user()).find(p=>p.id===itemId);if(!p)throw Error('Không tìm thấy dự án.');projectForm(p);return;}
 case 'new-employee':employeeForm();return;
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
 document.addEventListener('click',ev=>{const notification=ev.target.closest('[data-notification]');if(notification){const n=s.notifications.find(n=>n.id===notification.dataset.notification&&n.recipientId===user().id);if(n){n.readAt=NOW;save();if(document.getElementById('modal').open)closeDialog();}}const el=ev.target.closest('[data-action],[data-open]');if(!el)return;ev.preventDefault();const action=el.dataset.open||el.dataset.action;Promise.resolve().then(()=>act(action,el)).catch(err=>toast(err.message));});
 document.addEventListener('change',ev=>{const el=ev.target;if(el.name==='projectId'&&el.closest('[data-form="task"]')){const p=scope.projects(s,user()).find(p=>p.id===el.value),sel=el.closest('form').querySelector('[name="assigneeId"]');sel.innerHTML=scope.employees(s,user()).filter(u=>p?.memberIds.includes(u.id)).map(u=>`<option value="${u.id}">${e(u.name)}</option>`).join('');}if(el.matches('[data-permission]')){if(!scope.can(s,user(),'admin'))return;const role=el.dataset.role,action=el.dataset.permission;s.rolePermissions[role]??={};if(el.checked)delete s.rolePermissions[role][action];else s.rolePermissions[role][action]=false;log('đã cập nhật quyền '+role);render(true);toast('Đã cập nhật quyền demo');}});
 document.addEventListener('submit',ev=>{const formEl=ev.target.closest('[data-form]');if(!formEl)return;ev.preventDefault();const data=Object.fromEntries(new FormData(formEl));Object.keys(data).forEach(k=>{if(typeof data[k]==='string')data[k]=data[k].trim();});const formType=formEl.dataset.form,itemId=formEl.dataset.id;try{switch(formType){
 case 'task-status':updateTask(itemId,data.status);break;
 case 'task':{if(!scope.can(s,user(),'task.create'))throw Error('Bạn không có quyền tạo/giao task.');if(!data.title||!data.assigneeId)throw Error('Điền tên và chọn người phụ trách.');if(data.dueDate<data.startDate)throw Error('Hạn hoàn thành không được trước ngày bắt đầu.');const p=scope.projects(s,user()).find(p=>p.id===data.projectId);if(!p||!p.memberIds.includes(data.assigneeId)||!scope.employees(s,user()).some(u=>u.id===data.assigneeId))throw Error('Người phụ trách phải thuộc team và dự án.');if(itemId){const t=scope.tasks(s,user()).find(t=>t.id===itemId);if(!t)throw Error('Không có quyền sửa.');Object.assign(t,data);}else s.tasks.push({...data,id:id('tsk'),code:p.code+'-'+String(s.tasks.filter(t=>t.projectId===p.id).length+1).padStart(3,'0')});log('đã lưu công việc '+data.title,p.id);break;}
 case 'project':{if(!scope.can(s,user(),'project.create'))throw Error('Không có quyền quản lý dự án.');if(data.dueDate<data.startDate)throw Error('Deadline không được trước ngày bắt đầu.');if(s.projects.some(p=>p.code.toLowerCase()===data.code.toLowerCase()&&p.id!==itemId))throw Error('Mã dự án đã tồn tại.');if(!scope.scopedTeams(s,user()).includes(data.teamId))throw Error('Team ngoài phạm vi của bạn.');const {teamId,...rest}=data;if(itemId){const p=scope.projects(s,user()).find(p=>p.id===itemId);if(!p)throw Error('Không có quyền.');Object.assign(p,rest,{teamIds:[teamId],memberIds:s.users.filter(u=>u.teamId===teamId).map(u=>u.id)});}else s.projects.push({...rest,id:id('prj'),teamIds:[teamId],memberIds:s.users.filter(u=>u.teamId===teamId).map(u=>u.id),status:'in_progress',health:'on_track',color:'blue'});log('đã lưu dự án '+data.name);break;}
 case 'contract':{if(!scope.can(s,user(),'hr'))throw Error('Không có quyền.');if(data.endDate<data.startDate)throw Error('Ngày kết thúc phải từ ngày bắt đầu trở đi.');if(!s.users.some(u=>u.id===data.employeeId))throw Error('Nhân viên không tồn tại.');if(itemId){const c=s.contracts.find(c=>c.id===itemId);if(!c)throw Error('Không tìm thấy hợp đồng.');Object.assign(c,data);}else s.contracts.push({...data,id:id('ctr'),status:'active'});log('đã lưu hợp đồng nhân sự');break;}
 case 'request':createRequest(data);break;
 case 'decision':decideRequest(itemId,ev.submitter?.value==='approve',data.reason);break;
 case 'employee':case 'user':{if(!scope.can(s,user(),formType==='user'?'admin':'hr'))throw Error('Không có quyền.');if(s.users.some(u=>u.id!==itemId&&(u.email.toLowerCase()===data.email.toLowerCase()||u.employeeCode===data.employeeCode)))throw Error('Email hoặc mã nhân viên đã tồn tại.');if(itemId===user().id&&data.role&&data.role!==user().role)throw Error('Không đổi role tài khoản Admin đang sử dụng.');if(itemId){const u=s.users.find(u=>u.id===itemId);Object.assign(u,data,{teamId:data.teamId||null});}else{const uid=id('usr');s.users.push({...data,id:uid,role:data.role||'Dev',teamId:data.teamId||null,status:'active',managedTeamIds:[]});s.leaveBalances.push({userId:uid,year:2026,allowanceDays:12,usedDays:0});}log('đã lưu nhân sự '+data.name);break;}
 case 'backend-login':login(data.userId,data.password).then(()=>{closeDialog();render(true);toast('Đăng nhập backend thành công');}).catch(err=>{const error=formEl.querySelector('.form-error');if(error)error.textContent=err.message;else toast(err.message);});return;
 case 'settings':if(!scope.can(s,user(),'admin'))throw Error('Không có quyền.');if(data.shiftStart>=data.shiftEnd||data.shiftStart>'12:00'||data.shiftEnd<'13:00')throw Error('Ca làm việc phải bao gồm giờ nghỉ trưa 12:00–13:00.');Object.assign(s.settings,data);log('đã cập nhật cấu hình');break;
 case 'document':if(data.category==='company'&&!['HR','Admin'].includes(user().role))throw Error('Chỉ HR/Admin thêm tài liệu công ty.');if(data.category==='project'&&!scope.projects(s,user()).some(p=>p.id===data.projectId))throw Error('Không có quyền với dự án.');s.documents.push({id:id('doc'),name:data.name+' · '+data.filename,category:data.category,projectId:data.category==='project'?data.projectId:null,visibility:data.category==='project'?'project':'company',ownerId:user().id,fileUrl:null,updatedAt:DEMO_DATE});log('đã thêm metadata tài liệu');break;
 case 'master':{if(!scope.can(s,user(),'admin')||!['departments','positions','leaveTypes'].includes(data.key))throw Error('Không có quyền.');const list=s[data.key];if(data.index==='')list.push(data.key==='departments'?{id:id('dep'),name:data.name}:data.name);else if(data.key==='departments')list[Number(data.index)].name=data.name;else list[Number(data.index)]=data.name;log('đã cập nhật danh mục');break;}
 default:throw Error('Form không hợp lệ.');}
 save();if(document.getElementById('modal').open)closeDialog();render(true);toast('Đã lưu thay đổi thành công');}catch(err){const error=formEl.querySelector('.form-error');if(error)error.textContent=err.message;else toast(err.message);}});
 document.getElementById('modal').addEventListener('click',ev=>{if(ev.target===ev.currentTarget){const box=ev.currentTarget.getBoundingClientRect();if(ev.clientX<box.left||ev.clientX>box.right||ev.clientY<box.top||ev.clientY>box.bottom)closeDialog();}});
}

// Source: app.js
const newFilters=()=>({search:'',status:'',team:'',project:'',date:'2026-10-19',page:1,size:10,view:'',tab:'',sort:''});
let filters=newFilters(),expanded=new Set(),lastPath='',searchTimer;
const app=document.getElementById('app');
function pageTitle(path){const titles={'/admin/users/register':'Đăng ký tài khoản','/dashboard':'Tổng quan quản lý','/workspace/tasks':'Công việc của tôi','/workspace/projects':'Dự án của tôi','/workspace/attendance':'Chấm công cá nhân','/workspace/leave':'Nghỉ phép của tôi','/team/overview':'Đội ngũ của bạn','/team/members':'Thành viên team','/team/tasks':'Công việc của team','/team/attendance':'Chấm công team','/team/leave':'Nghỉ phép team','/team/workload':'Phân bổ công việc','/team/reports':'Báo cáo team','/projects':'Quản lý dự án','/projects/tasks':'Tất cả công việc','/projects/milestones':'Milestones','/projects/members':'Thành viên dự án','/projects/workload':'Workload','/projects/timeline':'Timeline dự án','/projects/reports':'Báo cáo dự án','/hr/employees':'Quản lý nhân sự','/hr/organization':'Cơ cấu tổ chức','/hr/contracts':'Hợp đồng nhân sự','/hr/attendance':'Quản lý chấm công','/hr/attendance-reports':'Báo cáo chấm công','/hr/leave':'Quản lý nghỉ phép','/hr/reports':'Báo cáo nhân sự','/approvals':'Trung tâm phê duyệt','/reports':'Báo cáo & Phân tích','/documents':'Thư viện tài liệu','/notifications':'Thông báo','/admin/users':'Quản lý tài khoản','/admin/roles':'Vai trò hệ thống','/admin/permissions':'Phân quyền','/admin/audit-logs':'Nhật ký hệ thống','/admin/settings':'Cấu hình hệ thống','/admin/master-data':'Dữ liệu danh mục'};return path==='/dashboard'&&user().role!=='Manager'?`Tổng quan ${user().role==='Dev'?'cá nhân':user().role==='HR'?'nhân sự':user().role==='Admin'?'hệ thống':'team'}`:titles[path]||(path.startsWith('/projects/')?'Chi tiết dự án':path.startsWith('/hr/employees/')?'Hồ sơ nhân viên':'Không tìm thấy trang');}
function loginScreen(){
 document.title='Đăng nhập · Intelex';
 app.innerHTML=`<main class="login-page"><form id="login-form" class="login-card"><img src="assets/images/logo.svg" alt="Intelex" width="48"><h1>Đăng nhập Intelex</h1><p>Đăng nhập bằng tài khoản được cấp để vào không gian làm việc.</p><label>User ID<input name="userId" autocomplete="username" required autofocus></label><label>Mật khẩu<input name="password" type="password" autocomplete="current-password" required></label><p id="login-error" role="alert"></p><button class="btn primary" type="submit">Đăng nhập</button></form></main>`;
 document.getElementById('login-form').addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.currentTarget,submit=form.querySelector('button');submit.disabled=true;
 try{await login(form.elements.userId.value.trim(),form.elements.password.value);const destination=nav.flatMap(n=>n.children?n.children.map(c=>c[1]):[n.route]).find(p=>scope.routeAllowed(s,user(),p));location.hash=destination||'/dashboard';navigate();}
 catch(err){document.getElementById('login-error').textContent=err.message;submit.disabled=false;}
 });
}
function shell(){if(!apiSession()){loginScreen();return;}
const path=getPath(),u=user();let unread=s.notifications.filter(n=>n.recipientId===u.id&&!n.readAt).length,pending=scope.requests(s,u).filter(r=>r.currentApproverId===u.id&&r.status.startsWith('pending_')).length;app.innerHTML=`<div class="mobile-backdrop" data-action="toggle-sidebar"></div><aside class="sidebar" aria-label="Thanh điều hướng"><a class="brand" href="#/dashboard"><img src="assets/images/logo.svg" alt=""><div><div class="brand-name">intelex<span>.</span></div><small>PEOPLE & WORK</small></div></a><nav class="nav-scroll" aria-label="Menu chính">${nav.map(n=>{const children=n.children?.filter(([,p])=>scope.routeAllowed(s,u,p));return {...n,children,route:children?.[0]?.[1]||n.route};}).filter(n=>scope.routeAllowed(s,u,n.route)).map(n=>{const active=n.name===groupFor(path)?.name,open=expanded.has(n.name)&&n.children;return `${n.section?`<div class="nav-caption">${n.section}</div>`:''}<div style="position:relative"><a class="nav-item ${active?'active':''}" title="${n.name}" href="#${n.route}" ${active?'aria-current="page"':''}>${icon(n.icon,18)}<span class="nav-label">${n.name}</span>${n.name==='Approval Center'&&pending?`<span class="badge count">${pending}</span>`:n.name==='Notifications'&&unread?`<span class="badge count">${unread}</span>`:n.children?`<span class="chev">${icon('chevron',12)}</span>`:''}</a>${n.children?`<button class="icon-button nav-expand" style="position:absolute;right:0;top:8px;width:23px" data-expand="${n.name}" aria-label="Mở menu ${n.name}" aria-expanded="${!!open}"></button>`:''}</div>${open?`<div class="submenu">${n.children.filter(([,p])=>scope.routeAllowed(s,u,p)).map(([label,p])=>`<a href="#${p}" class="${p===path?'active':''}">${label}</a>`).join('')}</div>`:''}`;}).join('')}</nav><div class="sidebar-bottom"><div class="sidebar-user">${avatar(u)}<div><strong>${e(apiSession()?.user?.userId||u.name.split(' ').slice(-2).join(' '))}</strong><small>${u.role} · Intelex</small></div><button class="icon-button" data-action="account" aria-label="Tài khoản">${icon('more')}</button></div></div></aside><header class="topbar"><div class="top-left"><button class="icon-button" data-action="toggle-sidebar" aria-label="Thu gọn hoặc mở menu">${icon('menu',18)}</button><div class="breadcrumb"><a href="#/dashboard" aria-label="Trang chủ">${icon('grid',14)}</a><span>/</span><strong>${e(groupFor(path)?.name||'Intelex')}</strong></div></div><div class="top-right"><div class="global-search">${icon('search',17)}<input id="global-search" placeholder="Tìm kiếm mọi thứ…" aria-label="Tìm kiếm toàn cục" autocomplete="off"><span class="kbd">⌘ K</span><div id="search-results" class="search-results"></div></div><span class="top-divider"></span><button class="icon-button" data-action="notifications" aria-label="Thông báo">${icon('bell',19)}${unread?'<span class="notification-dot"></span>':''}</button><span class="top-divider"></span><div class="account-menu-wrap"><button class="icon-button top-user" style="width:auto" data-action="account" aria-label="Menu tài khoản" aria-expanded="false" aria-controls="top-account-menu">${avatar(u)}<div style="text-align:left"><strong>${e(apiSession()?.user?.userId||u.name.split(' ').slice(-2).join(' '))}</strong><small>${u.role}</small></div>${icon('down',12)}</button><div class="account-dropdown" id="top-account-menu" hidden><button type="button" class="btn" data-action="self-password">Đổi mật khẩu</button><button type="button" class="btn" data-action="logout">Đăng xuất</button></div></div></div></header><main class="main" id="main" tabindex="-1"><div class="content" id="content"></div></main>`;renderContent();}
function header(path){const u=user(),home=path==='/dashboard';const primary=(path.includes('tasks')&&scope.can(s,u,'task.create'))?button('Tạo công việc','new-task','plus','primary'):path==='/projects'&&scope.can(s,u,'project.create')?button('Tạo dự án','new-project','plus','primary'):path==='/hr/employees'&&scope.can(s,u,'hr')?button('Thêm nhân viên','new-employee','plus','primary'):path==='/workspace/leave'?button('Tạo đơn nghỉ','new-request','plus','primary'):'';return `<div class="page-heading"><div><div class="eyebrow">${home?'YOUR WORK, CONNECTED':'INTELEX WORKSPACE'}</div><h1>${pageTitle(path)}${home?'<span style="color:#d7aa64;font-weight:400;margin-left:9px">✦</span>':''}</h1><p>${home?`Chào ${e(u.name.split(' ').pop())}, cùng xem đội ngũ đang làm việc thế nào hôm nay.`:'Một không gian chung để kết nối con người và công việc.'}</p></div><div class="heading-actions">${home?`${teamOptions(filters)}<input type="date" aria-label="Ngày dashboard" data-filter="date" value="${filters.date}" max="2026-10-19">${button('','refresh','refresh','','aria-label="Làm mới dashboard"')}`:primary}</div></div>`;}
function routeTabs(path){const group=groupFor(path);if(!group?.children||path.startsWith('/projects/prj-')||/^\/hr\/employees\/.+/.test(path))return '';return `<div class="tabs route-tabs">${group.children.filter(([,p])=>scope.routeAllowed(s,user(),p)).map(([name,p])=>`<a class="tab ${p===path?'active':''}" href="#${p}">${name}</a>`).join('')}</div>`;}
function view(path){if(!scope.routeAllowed(s,user(),path))return empty('403 · Không có quyền truy cập','Chọn một mục trong menu hoặc chuyển tài khoản demo.')+'<a class="btn primary" href="#/dashboard">Về Dashboard</a>';if(!isKnown(path))return empty('404 · Trang không tồn tại','Kiểm tra đường dẫn hoặc trở về Dashboard.')+'<a class="btn primary" href="#/dashboard">Về Dashboard</a>';if(path==='/dashboard')return dashboard(filters);if(path==='/workspace/tasks')return taskPage(filters,true);if(path==='/workspace/projects')return projectCards(filters,true);if(path==='/workspace/attendance')return attendancePage(filters,true);if(path==='/workspace/leave')return approvalPage(filters,true);if(path.startsWith('/team/'))return teamPage(filters,path);if(path==='/projects')return projectCards(filters);if(path==='/projects/tasks')return taskPage(filters);if(path==='/projects/members')return peoplePage(filters);if(path==='/projects/workload')return workloadPage(filters);if(path==='/projects/milestones'||path==='/projects/timeline')return timelinePage(filters);if(path==='/projects/reports'||path==='/reports')return reportsPage(filters);if(path.startsWith('/projects/'))return projectDetail(filters,path.split('/').pop());if(path.startsWith('/hr/'))return hrPage(filters,path);if(path==='/approvals')return approvalPage(filters);if(path==='/documents')return documentsPage(filters);if(path==='/notifications')return `${tabs([['all','Tất cả'],['unread','Chưa đọc'],['task','Công việc'],['attendance','Chấm công'],['leave','Nghỉ phép'],['system','Hệ thống']],filters.tab||'all')}<div class="toolbar">${button('Đánh dấu tất cả đã đọc','read-all','check')}</div>${card('Hộp thư thông báo','Thông tin dành riêng cho bạn',`<div class="card-body">${notifications(99,filters.tab||'all')}</div>`)}`;if(path.startsWith('/admin/'))return adminPage(filters,path);return empty();}
function renderContent(){const path=getPath();document.title=`${pageTitle(path)} · Intelex`;document.getElementById('content').innerHTML=header(path)+routeTabs(path)+view(path)+`<footer class="main-footer"><span>© 2026 Intelex. Built for our people.</span><span class="live-status">Dữ liệu demo · 19/10/2026 · Chỉ lưu trên trình duyệt</span><a href="#/documents">People first. Progress together.</a></footer>`;if((path==='/admin/users'||path==='/admin/users/register')&&scope.routeAllowed(s,user(),path))mountUsers(document.getElementById('users-api-root'),filters,path==='/admin/users/register');if(path==='/admin/roles'&&scope.routeAllowed(s,user(),path))mountRoles(document.getElementById('roles-api-root'),filters);if((path==='/hr/employees'||path.startsWith('/hr/employees/'))&&scope.routeAllowed(s,user(),path))mountEmployees(document.getElementById('employees-api-root'),filters,path==='/hr/employees'?null:decodeURIComponent(path.split('/').pop()));}
function render(full=false){if(!apiSession()){loginScreen();return;}if(full)shell();else renderContent();}
function navigate(){if(lastPath!==getPath()){filters=newFilters();document.body.classList.remove('mobile-open');lastPath=getPath();const g=groupFor(lastPath);if(g?.children)expanded.add(g.name);if(document.getElementById('modal').open)closeDialog();}shell();window.scrollTo(0,0);}
window.addEventListener('hashchange',navigate);
window.addEventListener('auth-change',()=>{closeDialog();navigate();});
setInterval(()=>{if(!apiSession()&&!document.getElementById('login-form'))loginScreen();},30000);
app.addEventListener('click',ev=>{if(ev.target.closest('[data-action="logout"]')){apiLogout();return;}const exp=ev.target.closest('[data-expand]');if(exp){const n=exp.dataset.expand;expanded.has(n)?expanded.delete(n):expanded.add(n);shell();return;}const p=ev.target.closest('[data-page]');if(p){filters.page=Number(p.dataset.page);render();}const tab=ev.target.closest('[data-tab]');if(tab){filters.tab=tab.dataset.tab;filters.page=1;render();}const sort=ev.target.closest('[data-sort]');if(sort){filters.sort=sort.dataset.sort;render();}const nf=ev.target.closest('[data-notification]');if(nf){const n=s.notifications.find(x=>x.id===nf.dataset.notification&&x.recipientId===user().id);if(n){n.readAt='2026-10-19T10:00:00+07:00';save();}}});
document.addEventListener('change',ev=>{const el=ev.target;if(el.matches('[data-filter]')){filters[el.dataset.filter]=el.value;filters.page=1;render();}if(el.id==='demo-user'){switchUser(el.value);filters=newFilters();closeDialog();if(getPath()==='/dashboard')shell();else location.hash='/dashboard';toast('Đã chuyển tài khoản demo');}});
document.addEventListener('input',ev=>{const el=ev.target;if(el.matches('[data-filter="search"]')){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const cursor=el.selectionStart;filters.search=el.value;filters.page=1;render();const input=document.querySelector('[data-filter="search"]');input?.focus();input?.setSelectionRange(cursor,cursor);},220);}if(el.id==='global-search'){clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const q=el.value.trim().toLowerCase();const entries=[...scope.projects(s,user()).map(p=>({name:p.name,type:'Dự án',route:'/projects/'+p.id})),...scope.tasks(s,user()).map(t=>({name:t.code+' · '+t.title,type:'Công việc',route:'/workspace/tasks',open:'task',id:t.id})),...scope.employees(s,user()).map(u=>({name:u.name,type:'Nhân viên',route:'/hr/employees/'+u.id,open:'employee',id:u.id}))].filter(x=>x.name.toLowerCase().includes(q)).slice(0,8);document.getElementById('search-results').innerHTML=q?entries.map(x=>`<a href="#${x.route}" ${x.open?`data-open="${x.open}" data-id="${x.id}"`:''}>${e(x.name)}<small>${x.type}</small></a>`).join('')||'<div class="empty">Không tìm thấy kết quả</div>':'';},250);}});
document.addEventListener('click',ev=>{if(!ev.target.closest('.global-search'))(()=>{const results=document.getElementById('search-results');if(results)results.innerHTML='';})();});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')(()=>{const results=document.getElementById('search-results');if(results)results.innerHTML='';})();if((ev.ctrlKey||ev.metaKey)&&ev.key==='k'){ev.preventDefault();document.getElementById('global-search')?.focus();}if(ev.key==='Enter'&&ev.target.matches('.kanban-card'))ev.target.click();});
document.addEventListener('click',ev=>{
 const trigger=ev.target.closest('.top-user[data-action="account"]'),menu=document.getElementById('top-account-menu');
 if(trigger&&menu){ev.preventDefault();ev.stopImmediatePropagation();menu.hidden=!menu.hidden;trigger.setAttribute('aria-expanded',String(!menu.hidden));}
 else if(menu&&!ev.target.closest('.account-menu-wrap')){menu.hidden=true;document.querySelector('.top-user')?.setAttribute('aria-expanded','false');}
},true);
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){const menu=document.getElementById('top-account-menu');if(menu&&!menu.hidden){menu.hidden=true;const trigger=document.querySelector('.top-user');trigger?.setAttribute('aria-expanded','false');trigger?.focus();}}});
setupActions({render,filters:()=>filters,setFilters:patch=>Object.assign(filters,patch),resetFilters:()=>{filters=newFilters();},openDialog,closeDialog,toast});
if(!location.hash)history.replaceState(null,'','#/dashboard');navigate();

})();
