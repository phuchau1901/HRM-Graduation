import {apiSession} from './api/client.js';
export function scopedTeams(s,u){return u.role==='Admin'||u.role==='HR'?s.teams.map(t=>t.id):u.role==='Manager'?u.managedTeamIds:u.role==='Leader'?[u.teamId]:[];}
export function employees(s,u){if(['Admin','HR'].includes(u.role))return s.users;if(u.role==='Dev')return s.users.filter(x=>x.id===u.id);const teams=scopedTeams(s,u);return s.users.filter(x=>teams.includes(x.teamId));}
export function projects(s,u){return s.projects.filter(p=>['Admin','HR'].includes(u.role)||u.role==='Manager'&&p.managerId===u.id||u.role==='Leader'&&p.teamIds.includes(u.teamId)||p.memberIds.includes(u.id));}
export function tasks(s,u){const ps=new Set(projects(s,u).map(p=>p.id));const ids=new Set(employees(s,u).map(x=>x.id));return u.role==='HR'?[]:s.tasks.filter(t=>ps.has(t.projectId)&&(u.role==='Admin'||ids.has(t.assigneeId)));}
export function documents(s,u){return s.documents.filter(d=>d.visibility==='company'||d.visibility==='hr'&&['HR','Admin'].includes(u.role)||d.visibility==='project'&&projects(s,u).some(p=>p.id===d.projectId)&&u.role!=='HR');}
export function requests(s,u){const ids=new Set(employees(s,u).map(x=>x.id));return s.requests.filter(r=>['HR','Admin'].includes(u.role)||r.requesterId===u.id||u.role!=='Dev'&&ids.has(r.requesterId));}
export function can(s,u,action,resource){if(apiSession()){
 const path=(globalThis.location?.hash?.slice(1).split('?')[0]||'/dashboard');
 const flag={'project.create':'canNew','task.create':'canNew','task.edit':'canUpdate','approve':'canApprove','hr':'canNew','admin':'canUpdate'}[action];
 return screenAllowed(path,flag||'canView');
}const override=s.rolePermissions?.[u.role]?.[action];if(override===false&&!(u.role==='Admin'&&action==='admin'))return false;
 const r=u.role;switch(action){case 'admin':return r==='Admin';case 'hr':return ['Admin','HR'].includes(r);case 'team':return r!=='Dev';case 'project.create':return ['Admin','Manager'].includes(r);case 'task.create':return ['Admin','Manager','Leader'].includes(r);case 'task.edit':return tasks(s,u).some(t=>t.id===resource?.id)&&(r!=='Dev'||resource.assigneeId===u.id);case 'approve':return resource?.requesterId!==u.id&&resource?.status?.startsWith('pending_')&&(resource.currentApproverId===u.id||r==='Admin');default:return false;}}
export function routeAllowed(s,u,path){if(apiSession())return path==='/admin/users/register'?screenAllowed('/admin/users','canNew'):screenAllowed(path);if(path.startsWith('/admin'))return can(s,u,'admin');if(path.startsWith('/hr'))return u.role!=='Dev'&&(['Admin','HR'].includes(u.role)||path==='/hr/employees'||/^\/hr\/employees\/[^/]+$/.test(path));if(path.startsWith('/team'))return u.role==='HR'?['/team/overview','/team/members'].includes(path):can(s,u,'team');if(u.role==='HR'&&['/projects/tasks','/projects/workload','/projects/reports','/projects/timeline'].includes(path))return false;return true;}

// Explicit aliases for screen codes supplied by the backend. Unknown codes deny access.
export const screenRoutes={
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
export function screenAllowed(path,flag='canView'){
 const current=apiSession();if(!current)return false;
 let route=path;
 if(/^\/hr\/employees\/.+/.test(path))route='/hr/employees';
 if(/^\/projects\/prj-/.test(path))route='/projects';
 const codes=screenRoutes[route]||(/^\/(team|projects)\//.test(route)?['WEB_'+route.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()]:[]);
 return current.permissions.some(p=>p.platform==='WEB'&&codes.includes(p.code)&&p.canView==='Y'&&p[flag]==='Y');
}
