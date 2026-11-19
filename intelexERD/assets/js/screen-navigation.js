import {screenRoutes} from './permissions.js';

const screenLabels={SALARY:'Thiết lập lương nhân viên',EMPLOYEE_SALARIES:'Thiết lập lương nhân viên',PAYROLLS:'Quản lý bảng lương',KPI_CRITERIA:'Thiết lập KPI',SALARY_PROFILES:'Thiết lập lương nhân viên',SALARY_PROFILE:'Thiết lập lương nhân viên',SALARY_SETTINGS:'Thiết lập lương nhân viên',SALARY_SETUP:'Thiết lập lương nhân viên',PAYROLL:'Quản lý bảng lương',PAYROLL_PERIODS:'Quản lý bảng lương',PAYROLL_MANAGEMENT:'Quản lý bảng lương',KPI_TEMPLATES:'Thiết lập KPI',KPI_SETTINGS:'Thiết lập KPI',KPI_SETUP:'Thiết lập KPI',KPI_TARGETS:'Mục tiêu KPI',KPI_RESULTS:'Đánh giá KPI',KPI_REVIEWS:'Đánh giá KPI',KPI_EVALUATIONS:'Đánh giá KPI',PERFORMANCE_REVIEWS:'Đánh giá hiệu suất'};
export function screenNavigationLabel(screen){if(screen.code==='WEB_LEAVE_BALANCES')return 'Số dư phép';const short=String(screen.code||'').replace(/^(WEB|MOBILE)_/,'');return screen.name||screen.screenName||screenLabels[short]||short.replaceAll('_',' ');}
export function screenNavigationGroup(code){
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
export function navigationForScreens(base,catalog,platform='WEB'){
 const groups=base.map(group=>({...group,children:group.children?.map(child=>[...child])}));
 const assigned=new Set(Object.values(screenRoutes).flat().map(code=>platform==='MOBILE'?code.replace(/^WEB_/,'MOBILE_'):code));
 for(const group of base)for(const [,path] of group.children||[[group.name,group.route]]){
  const codes=screenRoutes[path]||['WEB_'+path.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()];
  for(const code of codes)assigned.add(platform==='MOBILE'?code.replace(/^WEB_/,'MOBILE_'):code);
 }
 const seen=new Set();
 for(const screen of catalog){
  if(screen.platform&&screen.platform!==platform||!new RegExp('^'+platform+'_[A-Z0-9_]+$').test(screen.code||'')||['WEB_LEAVE','WEB_MY_LEAVE','WEB_MY_ATTENDANCE'].includes(screen.code)||assigned.has(screen.code)||seen.has(screen.code))continue;
  seen.add(screen.code);
  const metadata=screenNavigationGroup(screen.code),path='/screens/'+screen.code;
  let group=groups.find(group=>group.name===metadata.name);
  if(!group){group={...metadata,route:path,children:[]};const insertion=groups.findIndex(item=>item.name==='Approval Center');groups.splice(insertion<0?groups.length:insertion,0,group);}
  if(!group.children)group.children=[[group.name,group.route]];
  group.children.push([screenNavigationLabel(screen),path]);
 }
 return groups;
}
