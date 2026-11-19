import test from 'node:test';
import assert from 'node:assert/strict';
import {workScheduleRange,workScheduleDays,workScheduleAddDays,workScheduleGrant,workScheduleBatchPayload,workScheduleCalendarData,workScheduleCalendarMarkup,workSchedulePreviewMarkup,mountWorkSchedules} from '../assets/js/pages/work/work-schedules.js';
import {apiWorkScheduleCalendar,apiSaveWorkSchedule,apiCancelWorkSchedule,apiPreviewWorkSchedules,apiAssignWorkSchedules,apiExportWorkSchedules} from '../assets/js/api/client.js';
import {nav,getPath} from '../assets/js/router.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {roleMenuGroups,roleScreenCatalog,roleHasScopeAction,roleScopeSelect,rolePermissionPatch} from '../assets/js/pages/administration/roles.js';
const account=(extra={})=>({permissions:[{platform:'WEB',code:'WEB_WORK_SCHEDULES',canView:'Y',canNew:'Y',canUpdate:'Y',canDelete:'Y',canExport:'Y',...extra}]});
const employee=()=>({id:12,employeeCode:'TX0012',fullName:'<Nhân viên>',departmentId:1,teamId:2});
const calendar=()=>({success:true,total:2,page:1,pageSize:20,employees:[employee(),{...employee(),id:13,employeeCode:'TX0013',fullName:'Chưa phân ca'}],schedules:[{id:9,employeeId:12,shiftId:3,workDate:'2027-01-01',status:'SCHEDULED',version:4,rules:{shiftCode:'HISTORY'}}],shifts:[{id:3,code:'CURRENT',name:'Ca ngày',startTime:'08:00:00',endTime:'17:00:00',isActive:true,version:1}],departments:[{id:1,name:'Công nghệ'}],teams:[{id:2,name:'Backend'}],holidayDates:['2027-01-01']});
const values=()=>({target:'EMPLOYEE',employeeIds:[12,13],mode:'shift',shiftId:3,from:'2027-01-01',to:'2027-01-07',weekdays:[1,2,3,4,5],excludeHolidays:true,overwrite:false});
test('calendar weeks start Monday and months use actual lengths including leap years',()=>{
 assert.deepEqual(workScheduleRange('2027-01-03'),{from:'2026-12-28',to:'2027-01-03'});
 assert.deepEqual(workScheduleRange('2028-02-18','month'),{from:'2028-02-01',to:'2028-02-29'});
 assert.equal(workScheduleDays('2027-02-01','2027-02-28').length,28);assert.equal(workScheduleAddDays('2026-12-31',1),'2027-01-01');
 assert.throws(()=>workScheduleRange('2027-02-30'));assert.throws(()=>workScheduleDays('2027-04-02','2027-04-01'));assert.throws(()=>workScheduleDays('2027-01-01','2027-04-03'),/92/);
});
test('calendar retains employees without schedules and uses snapshot shift code and escaped names',()=>{
 const data=workScheduleCalendarData(calendar());assert.equal(data.employees.length,2);
 const html=workScheduleCalendarMarkup(data,['2027-01-01'],new Set([12]),account());
 assert.ok(html.includes('HISTORY'));assert.ok(!html.includes('>CURRENT<'));assert.ok(html.includes('&lt;Nhân viên&gt;'));assert.ok(html.includes('TX0013'));assert.ok(html.includes('data-work-assign="13"'));assert.ok(html.includes('work-holiday'));assert.ok(html.includes('data-work-cancel="9"'));
 const viewOnly=workScheduleCalendarMarkup(data,['2027-01-01'],new Set(),account({canNew:'N',canDelete:'N'}));assert.ok(!viewOnly.includes('data-work-assign'));assert.ok(!viewOnly.includes('data-work-cancel'));assert.ok(!viewOnly.includes('data-work-select='));
 assert.throws(()=>workScheduleCalendarData({...data,schedules:[{...data.schedules[0],employeeId:999}]}));
});
test('work schedule grants are independent of employee and shift permissions and respect SELF write restrictions',async()=>{
 assert.equal(workScheduleGrant('canNew',account()),true);assert.equal(workScheduleGrant('canExport',account({canExport:'N'})),false);
 assert.equal(workScheduleGrant('canNew',account({dataScopes:{NEW:'SELF'}})),false);assert.equal(workScheduleGrant('canUpdate',account({dataScopes:{UPDATE:'SELF'}})),false);assert.equal(workScheduleGrant('canExport',account({dataScopes:{EXPORT:'SELF'}})),true);
 assert.equal(workScheduleGrant('canView',{permissions:[{platform:'WEB',code:'WEB_EMPLOYEES',canView:'Y'}]}),false);
 const root={innerHTML:''};await mountWorkSchedules(root);assert.match(root.innerHTML,/chưa có quyền/);
});
test('batch payload supports employee, department, team and scoped ALL with separate copy mode',()=>{
 const payload=workScheduleBatchPayload(values(),{operationId:'operation',today:'2026-11-19'});assert.deepEqual(payload.employeeIds,[12,13]);assert.equal(payload.shiftId,3);assert.equal(payload.copyFrom,undefined);
 const department=workScheduleBatchPayload({...values(),target:'DEPARTMENT',departmentId:5},{today:'2026-11-19'});assert.equal(department.departmentId,5);assert.deepEqual(department.employeeIds,[]);assert.equal(department.teamId,undefined);
 const team=workScheduleBatchPayload({...values(),target:'TEAM',teamId:4},{today:'2026-11-19'});assert.equal(team.teamId,4);assert.equal(team.departmentId,undefined);
 const all=workScheduleBatchPayload({...values(),target:'ALL'},{today:'2026-11-19'});assert.deepEqual(all.employeeIds,[]);assert.equal(all.departmentId,undefined);
 const copy=workScheduleBatchPayload({...values(),mode:'copy',copyFrom:'2026-12-01'},{today:'2026-11-19'});assert.equal(copy.shiftId,undefined);assert.equal(copy.copyFrom,'2026-12-01');
});
test('batch rejects past dates, bad weekdays, duplicate employees and limits instead of guessing',()=>{
 for(const patch of [{from:'2026-01-01',to:'2026-01-07'},{weekdays:[]},{weekdays:[1,1]},{weekdays:[8]},{employeeIds:[]},{employeeIds:[12,12]},{employeeIds:Array.from({length:501},(_,index)=>index+1)},{shiftId:0},{target:'TEAM',teamId:0},{mode:'copy',copyFrom:'2027-02-30'}])assert.throws(()=>workScheduleBatchPayload({...values(),...patch},{today:'2026-11-19'}));
 assert.throws(()=>workScheduleBatchPayload({...values(),from:'2027-01-01',to:'2027-03-31',employeeIds:Array.from({length:100},(_,index)=>index+1)},{today:'2026-11-19'}),/5000/);
});
test('preview displays each skip reason and validates token before showing ready output',()=>{
 const html=workSchedulePreviewMarkup({previewToken:'real-token',ready:1,skipped:1,items:[{employeeCode:'<code>',employeeName:'A',workDate:'2027-01-01',outcome:'READY',rules:{shiftCode:'DAY'}},{employeeCode:'B',employeeName:'B',workDate:'2027-01-01',outcome:'PERIOD_LOCKED'}]});assert.ok(html.includes('Kỳ công đã khóa'));assert.ok(html.includes('&lt;code&gt;'));assert.ok(html.includes('Sẵn sàng'));
 assert.throws(()=>workSchedulePreviewMarkup({ready:1,items:[]}));
});
test('work schedule route and role scopes use the same backend screen identity without code in URL',()=>{
 assert.deepEqual(screenRoutes['/work/schedules'],['WEB_WORK_SCHEDULES']);assert.ok(nav.some(group=>group.name==='Human Resources'&&group.children.some(([,path])=>path==='/work/schedules')));
 const groups=roleMenuGroups(roleScreenCatalog([{id:91,code:'WEB_WORK_SCHEDULES',name:'Lịch phân ca',platform:'WEB'}]));assert.equal(groups.find(group=>group.name==='Human Resources').entries.find(item=>item.code==='WEB_WORK_SCHEDULES').id,91);
 for(const flag of ['VIEW','NEW','UPDATE','DELETE','EXPORT']){assert.equal(roleHasScopeAction('WEB_WORK_SCHEDULES',flag),true);assert.ok(roleScopeSelect('WEB_WORK_SCHEDULES',flag,'Quyền','DEPARTMENT').includes('Cùng phòng ban'));}
 assert.equal(roleHasScopeAction('WEB_WORK_SCHEDULES','APPROVE'),false);
 const patch=rolePermissionPatch(new Map([['WEB_WORK_SCHEDULES',{VIEW:true,NEW:true}]]),new Set(['WEB_WORK_SCHEDULES']),new Set(),new Map([['WEB_WORK_SCHEDULES',{VIEW:'ALL',NEW:'DEPARTMENT'}]]));assert.deepEqual(patch[0].dataScopes,{VIEW:'ALL',NEW:'DEPARTMENT'});
 const previous=globalThis.location,calls=[];try{globalThis.location={hash:'#/screens/WEB_WORK_SCHEDULES',replace:path=>calls.push(path)};assert.equal(getPath(),'/work/schedules');assert.deepEqual(calls,['#/work/schedules']);}finally{globalThis.location=previous;}
});
test('work APIs use numeric If-Match, preview/confirm/copy and preserve operation identity on retry',async()=>{
 const original=globalThis.fetch,calls=[];try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({version:2})};};
 await apiWorkScheduleCalendar({from:'2027-01-01',to:'2027-01-07',page:2,pageSize:20,search:'A & B',teamId:4,ignored:'no'});const url=new URL(calls[0].url);assert.equal(url.pathname,'/api/work-schedules/calendar');assert.equal(url.searchParams.get('search'),'A & B');assert.equal(url.searchParams.get('ignored'),null);
 await apiSaveWorkSchedule(null,{employeeId:12,shiftId:3,workDate:'2027-01-01'});assert.equal(calls[1].options.method,'POST');assert.equal(calls[1].options.headers.has('If-Match'),false);
 await apiSaveWorkSchedule(9,{shiftId:3},4);assert.equal(calls[2].options.method,'PUT');assert.equal(calls[2].options.headers.get('If-Match'),'"4"');
 await apiCancelWorkSchedule(9,4);assert.equal(calls[3].options.method,'PATCH');assert.equal(calls[3].options.headers.get('If-Match'),'"4"');
 const payload=workScheduleBatchPayload(values(),{operationId:'same-operation',today:'2026-11-19'});await apiPreviewWorkSchedules(payload);assert.ok(calls[4].url.endsWith('/bulk/preview'));assert.equal(JSON.parse(calls[4].options.body).previewToken,undefined);
 assert.throws(()=>apiAssignWorkSchedules(payload),/xem trước/);await apiAssignWorkSchedules({...payload,previewToken:'token'});await apiAssignWorkSchedules({...payload,previewToken:'token'});assert.equal(calls[5].options.body,calls[6].options.body);
 await apiAssignWorkSchedules({...payload,shiftId:undefined,copyFrom:'2026-12-01',previewToken:'token'});assert.ok(calls[7].url.endsWith('/copy'));
 let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status:409,json:async()=>({message:'Stale preview'})};};await assert.rejects(apiAssignWorkSchedules({...payload,previewToken:'token'}),/Stale preview/);assert.equal(attempts,1);
 assert.throws(()=>apiSaveWorkSchedule(9,{},null),/phiên bản/);
 }finally{globalThis.fetch=original;}
});
test('CSV export downloads binary on the current employee page using the same filters',async()=>{
 const original=globalThis.fetch;try{const blob=new Blob(['EmployeeCode,EmployeeName\nTX01,A']),query={from:'2027-01-01',to:'2027-01-07',page:3,pageSize:20,departmentId:5,teamId:4,search:'A'};let seen;
 globalThis.fetch=async(url,options)=>{seen={url:new URL(url),options};return {ok:true,blob:async()=>blob,json:async()=>{throw Error('CSV is not JSON');}};};assert.equal(await apiExportWorkSchedules(query),blob);assert.equal(seen.url.pathname,'/api/work-schedules/export');assert.equal(seen.url.searchParams.get('page'),'3');assert.equal(seen.url.searchParams.get('teamId'),'4');assert.equal(seen.options.cache,'no-store');assert.equal(seen.options.responseType,undefined);
 }finally{globalThis.fetch=original;}
});
