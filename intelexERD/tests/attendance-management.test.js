import test from 'node:test';
import assert from 'node:assert/strict';
import {attendanceManagementValidateQuery,attendanceManagementPage,attendanceStatisticsMarkup,attendanceCanPunch,attendanceCanAdjust,attendancePunchPayload,attendanceAdjustmentPayload,attendanceManagementRows,attendanceManagementTime,attendanceLocalInput,attendanceManagementGrant,mountAttendanceManagement} from '../assets/js/pages/attendance/attendance-management.js';
import {apiAttendanceDaily,apiMyAttendance,apiAttendanceStatistics,apiAttendanceFilters,apiAttendanceDetail,apiAttendancePunch,apiAttendanceExport} from '../assets/js/api/client.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {roleMenuGroups,roleScreenCatalog,roleScopeSelect} from '../assets/js/pages/administration/roles.js';
const session=(extra={})=>({user:{employeeId:12},permissions:[{platform:'WEB',code:'WEB_ATTENDANCE',canView:'Y',canNew:'Y',canUpdate:'Y',canExport:'Y',...extra},{platform:'WEB',code:'WEB_MY_ATTENDANCE',canView:'Y',canNew:'Y',canUpdate:'Y',...extra},{platform:'WEB',code:'WEB_ATTENDANCE_ADJUSTMENTS',canView:'Y',canNew:'Y'}]});
const row=()=>({employeeId:12,employeeCode:'TX0012',employeeName:'<Nhân viên>',departmentId:3,departmentName:'IT',teamId:4,teamName:'Core',workDate:'2026-11-18',scheduleId:100,attendanceId:null,shiftCode:'NIGHT',shiftStartAtUtc:'2026-11-18T15:00:00Z',shiftEndAtUtc:'2026-11-18T23:00:00Z',checkInOpenUtc:'2026-11-18T14:00:00Z',checkInCloseUtc:'2026-11-18T17:00:00Z',checkOutOpenUtc:'2026-11-18T21:00:00Z',checkOutCloseUtc:'2026-11-19T01:00:00Z',checkInAtUtc:null,checkOutAtUtc:null,workedMinutes:null,lateMinutes:7,earlyMinutes:5,isLate:true,isEarly:true,isOnLeave:false,isHoliday:false,isPeriodLocked:false,snapshotMissing:false,requireQr:false,requireGps:false,missingPunchRule:'REJECT_CHECKOUT_WITHOUT_CHECKIN',status:'NOT_CHECKED_IN'});
const statistics=()=>({success:true,employees:10,scheduled:9,checkedIn:8,working:7,late:6,early:5,notPunched:4,onLeave:3,absent:2,missingCheckOut:1});
test('daily filters validate dates, 31-day boundary and server filter types',()=>{
 assert.deepEqual(attendanceManagementValidateQuery({date:'2026-11-19',employeeId:'12',status:'LATE'}),{date:'2026-11-19',employeeId:12,status:'LATE'});
 assert.doesNotThrow(()=>attendanceManagementValidateQuery({from:'2028-02-01',to:'2028-03-02'}));
 for(const values of [{date:'2026-02-29'},{date:'2026-11-19',from:'2026-11-18',to:'2026-11-19'},{from:'2026-01-01',to:'2026-02-01'},{from:'2026-11-20',to:'2026-11-19'},{date:'1899-12-31'},{date:'9999-01-01'},{date:'2026-11-19',departmentId:'0'},{date:'2026-11-19',status:'DEMO'}])assert.throws(()=>attendanceManagementValidateQuery(values));
});
test('daily read model does not invent times, preserves independent late/early and overnight dates',()=>{
 const response={success:true,total:1,asOfUtc:'2026-11-19T01:00:00Z',data:[row()]};assert.equal(attendanceManagementPage(response),response);
 const html=attendanceManagementRows(response.data,{own:true,asOfUtc:response.asOfUtc,session:session()});assert.ok(html.includes('&lt;Nhân viên&gt;'));assert.ok(html.includes('TX0012'));assert.ok(html.includes('18/11/2026'));assert.ok(html.includes('Đi trễ: 7 phút'));assert.ok(html.includes('Về sớm: 5 phút'));assert.ok(!html.includes('0 phút'));
 assert.ok(attendanceManagementTime('2026-11-18T23:00:00Z').includes('19/11/26'));assert.ok(attendanceManagementTime('2026-11-18T23:00:00Z').includes('06:00'));assert.equal(attendanceLocalInput('2026-11-18T23:00:00Z'),'2026-11-19T06:00');
 assert.throws(()=>attendanceManagementPage({...response,asOfUtc:null}));assert.throws(()=>attendanceManagementPage({...response,data:[{...row(),employeeId:0}]}));
});
test('statistics remain distinct counters and failed stats show dashes instead of fabricated zeros',()=>{
 const html=attendanceStatisticsMarkup(statistics());assert.ok(html.includes('<strong>10</strong>'));assert.ok(html.includes('<strong>6</strong>'));
 const failed=attendanceStatisticsMarkup(null,'Không tải được thống kê');assert.ok(failed.includes('Không tải'));assert.equal((failed.match(/<strong>—<\/strong>/g)||[]).length,10);assert.ok(!failed.includes('<strong>0</strong>'));
 assert.throws(()=>attendanceStatisticsMarkup({...statistics(),late:'6'}));
});
test('punch gates use server snapshot windows, exact close boundary and action permission',()=>{
 const r=row(),s=session();assert.equal(attendanceCanPunch(r,'check-in','2026-11-18T14:00:00Z',s),true);assert.equal(attendanceCanPunch(r,'check-in','2026-11-18T17:00:00Z',s),true);assert.equal(attendanceCanPunch(r,'check-in','2026-11-18T17:00:01Z',s),false);
 const working={...r,checkInAtUtc:'2026-11-18T15:00:00Z'};assert.equal(attendanceCanPunch(working,'check-out','2026-11-19T01:00:00Z',s),true);assert.equal(attendanceCanPunch(working,'check-out','2026-11-19T01:00:01Z',s),false);
 for(const patch of [{snapshotMissing:true},{isPeriodLocked:true},{isOnLeave:true},{scheduleId:null},{checkInAtUtc:'2026-11-18T15:00:00Z'}])assert.equal(attendanceCanPunch({...r,...patch},'check-in','2026-11-18T15:00:00Z',s),false);
 assert.equal(attendanceCanPunch(working,'check-out','2026-11-19T01:00:00Z',session({canUpdate:'N'})),false);
 assert.equal(attendanceCanPunch(r,'check-out','2026-11-19T01:00:00Z',s),false);assert.equal(attendanceCanPunch({...r,missingPunchRule:'INCOMPLETE'},'check-out','2026-11-19T01:00:00Z',s),true);
});
test('punch body requires QR/GPS when policy demands and never sends client clock or employee id',()=>{
 const r={...row(),requireQr:true,requireGps:true},values={qrSessionId:'5',qrToken:'valid-token',latitude:10.7,longitude:106.6,employeeId:999,checkInAtUtc:'client-clock'};
 const payload=attendancePunchPayload(r,values,'retry-key');assert.deepEqual(payload,{scheduleId:100,requestKey:'retry-key',qrSessionId:5,qrToken:'valid-token',latitude:10.7,longitude:106.6});assert.deepEqual(attendancePunchPayload(r,values,'retry-key'),payload);
 for(const patch of [{qrSessionId:0},{qrToken:''},{latitude:null},{longitude:181}])assert.throws(()=>attendancePunchPayload(r,{...values,...patch},'key'));
 assert.deepEqual(attendancePunchPayload(row(),values,'key'),{scheduleId:100,requestKey:'key'});
});
test('adjustment creation is own-only, locked/legacy schedules are blocked and references are exclusive',()=>{
 const r=row();assert.equal(attendanceCanAdjust(r,{own:true,session:session()}),true);assert.equal(attendanceCanAdjust({...r,employeeId:13},{session:session()}),false);assert.equal(attendanceCanAdjust({...r,isPeriodLocked:true},{own:true,session:session()}),false);assert.equal(attendanceCanAdjust({...r,snapshotMissing:true},{own:true,session:session()}),false);
 const values={proposedCheckIn:'2026-11-18T22:00',proposedCheckOut:'2026-11-19T06:00',reason:' Thiếu giờ '};
 const first=attendanceAdjustmentPayload(r,values);assert.equal(first.scheduleId,100);assert.equal(first.attendanceId,undefined);assert.equal(first.proposedCheckIn,'2026-11-18T22:00:00+07:00');assert.equal(first.reason,'Thiếu giờ');
 const existing=attendanceAdjustmentPayload({...r,attendanceId:7},values);assert.equal(existing.attendanceId,7);assert.equal(existing.scheduleId,undefined);
 assert.equal(attendanceAdjustmentPayload(r,{...values,proposedCheckOut:''}).proposedCheckOut,null);
 assert.throws(()=>attendanceAdjustmentPayload(r,{...values,proposedCheckIn:'2026-11-19T07:00'}));assert.throws(()=>attendanceAdjustmentPayload(r,{...values,reason:' '}));
});
test('personal and admin routes require independent screen codes and retain separate role entries',()=>{
 assert.deepEqual(screenRoutes['/workspace/attendance'],['WEB_MY_ATTENDANCE']);assert.deepEqual(screenRoutes['/hr/attendance'],['WEB_ATTENDANCE']);
 const personalSession={permissions:[{platform:'WEB',code:'WEB_MY_ATTENDANCE',canView:'Y',canNew:'Y'}]};
 assert.equal(attendanceManagementGrant('canView',personalSession,true),true);assert.equal(attendanceManagementGrant('canView',personalSession),false);assert.equal(attendanceManagementGrant('canView',{permissions:[{platform:'WEB',code:'WEB_ATTENDANCE',canView:'Y'}]},true),false);
 const catalog=[{id:81,platform:'WEB',code:'WEB_ATTENDANCE',name:'Attendance'},{id:82,platform:'WEB',code:'WEB_MY_ATTENDANCE',name:'My Attendance'}],groups=roleMenuGroups(roleScreenCatalog(catalog));
 assert.equal(groups.find(group=>group.name==='Human Resources').entries.find(item=>item.code==='WEB_ATTENDANCE').id,81);assert.equal(groups.find(group=>group.name==='My Workspace').entries.find(item=>item.code==='WEB_MY_ATTENDANCE').id,82);
 assert.equal(roleScopeSelect('WEB_MY_ATTENDANCE','NEW','Check-in','SELF'),'');assert.ok(roleScopeSelect('WEB_ATTENDANCE','EXPORT','Xuất Excel','ALL').includes('Tất cả'));
 const root={innerHTML:''};const dispose=mountAttendanceManagement(root,{own:true});assert.match(root.innerHTML,/WEB_MY_ATTENDANCE\/VIEW/);dispose();
});
test('attendance APIs use own endpoint, scoped filters/detail, no direct time mutation and real binary export',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url),options});return {ok:true,json:async()=>({success:true,total:0,data:[]})};};
 await apiMyAttendance({from:'2026-11-18',to:'2026-11-19',page:1,pageSize:20,employeeId:999,departmentId:5,search:'other'});assert.equal(calls[0].url.pathname,'/api/attendances/me');assert.equal(calls[0].url.searchParams.get('employeeId'),null);assert.equal(calls[0].url.searchParams.get('departmentId'),null);assert.equal(calls[0].url.searchParams.get('from'),'2026-11-18');
 const filters={from:'2026-11-18',to:'2026-11-19',departmentId:3,status:'LATE',search:'A & B'};await apiAttendanceDaily({...filters,page:2,pageSize:20});await apiAttendanceStatistics(filters);assert.equal(calls[1].url.pathname,'/api/attendances/daily');assert.equal(calls[2].url.pathname,'/api/attendances/statistics');assert.equal(calls[1].url.searchParams.get('search'),'A & B');assert.equal(calls[2].url.searchParams.get('status'),'LATE');
 await apiAttendanceFilters();assert.equal(calls[3].url.pathname,'/api/attendances/filters');
 await apiAttendanceDetail(row());assert.equal(calls[4].url.pathname,'/api/attendances/daily/detail');assert.equal(calls[4].url.searchParams.get('scheduleId'),'100');await apiAttendanceDetail({...row(),scheduleId:null});assert.equal(calls[5].url.searchParams.get('scheduleId'),null);
 const payload=attendancePunchPayload(row(),{},'same-key');await apiAttendancePunch('check-in',payload);await apiAttendancePunch('check-in',payload);assert.equal(calls[6].options.method,'POST');assert.equal(calls[6].options.body,calls[7].options.body);assert.equal(JSON.parse(calls[6].options.body).employeeId,undefined);assert.throws(()=>apiAttendancePunch('update-time',{}));
 let seen;const blob=new Blob(['PK-test-xlsx']);globalThis.fetch=async(url,options)=>{seen={url:new URL(url),options};return {ok:true,blob:async()=>blob,json:async()=>{throw Error('not JSON');}};};assert.equal(await apiAttendanceExport({...filters,page:2,pageSize:20}),blob);assert.equal(seen.url.pathname,'/api/attendances/export');assert.equal(seen.url.searchParams.get('page'),null);assert.equal(seen.url.searchParams.get('departmentId'),'3');
 }finally{globalThis.fetch=previous;}
});

test('both personal check-in and check-out require MY_ATTENDANCE UPDATE, independently of NEW',()=>{
 const personal=extra=>({permissions:[{platform:'WEB',code:'WEB_MY_ATTENDANCE',canView:'Y',...extra}]}),r=row();
 const updateOnly=personal({canNew:'N',canUpdate:'Y'}),newOnly=personal({canNew:'Y',canUpdate:'N'});
 assert.equal(attendanceCanPunch(r,'check-in','2026-11-18T15:00:00Z',updateOnly),true);
 assert.equal(attendanceCanPunch({...r,checkInAtUtc:'2026-11-18T15:00:00Z'},'check-out','2026-11-19T01:00:00Z',updateOnly),true);
 assert.equal(attendanceCanPunch(r,'check-in','2026-11-18T15:00:00Z',newOnly),false);
 assert.equal(attendanceCanPunch({...r,checkInAtUtc:'2026-11-18T15:00:00Z'},'check-out','2026-11-19T01:00:00Z',newOnly),false);
 assert.equal(attendanceCanPunch(r,'check-in','2026-11-18T15:00:00Z',{permissions:[{platform:'WEB',code:'WEB_ATTENDANCE',canView:'Y',canUpdate:'Y'}]}),false);
});
