export const nav=[
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
export function getPath(){return (location.hash.slice(1).split('?')[0]||'/dashboard').replace(/\/$/,'')||'/dashboard';}
export function groupFor(path){if(path==='/admin/users/register')return nav.find(n=>n.name==='Administration');return nav.find(n=>n.route===path||n.children?.some(c=>c[1]===path))||nav.find(n=>path.startsWith('/projects/')&&n.route==='/projects'||path.startsWith('/hr/employees/')&&n.route==='/hr/employees');}
export function isKnown(path){return !!groupFor(path)||/^\/projects\/prj-[\w-]+$/.test(path)||/^\/hr\/employees\/[\w-]+$/.test(path);}
