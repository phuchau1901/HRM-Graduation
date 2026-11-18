import test from 'node:test';
import assert from 'node:assert/strict';
import {myLeaveBalanceData,myLeaveBalanceMarkup,myLeaveGrant,mountMyLeave} from '../assets/js/pages/my-workspace/my-leave.js';
import {apiMyLeaveBalances} from '../assets/js/api/client.js';
import {screenRoutes} from '../assets/js/permissions.js';
const response=()=>({success:true,data:{employeeId:12,year:2027,asOfDate:'2027-06-15',totalDays:13,usedDays:3,remainingDays:10,reservedDays:2,availableDays:8,balances:[{id:10,employeeId:12,leaveTypeId:1,leaveTypeName:'Phép năm',year:2027,entitledDays:12,carriedOverDays:2,adjustmentDays:-1,usedDays:3,reservedDays:2,remainingDays:10,availableDays:8,version:4}]}});

test('My Leave uses WEB_LEAVE_BALANCES independently of Leave Management',async()=>{
 assert.deepEqual(screenRoutes['/workspace/leave'],['WEB_LEAVE_BALANCES','WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS']);
 assert.deepEqual(screenRoutes['/hr/leave'],['WEB_LEAVE_MANAGEMENT']);
 assert.equal(myLeaveGrant('WEB_LEAVE_MANAGEMENT',{permissions:[{platform:'WEB',code:'WEB_LEAVE_MANAGEMENT',canView:'Y'}]}),true);
 assert.equal(myLeaveGrant('WEB_LEAVE_BALANCES',{permissions:[{platform:'WEB',code:'WEB_LEAVE_MANAGEMENT',canView:'Y'}]}),false);
 const original=globalThis.fetch;let called=false;
 try{globalThis.fetch=()=>{called=true;};const root={innerHTML:''};await mountMyLeave(root);assert.equal(called,false);assert.match(root.innerHTML,/chưa có quyền/);}finally{globalThis.fetch=original;}
});
test('my balance rendering uses API totals and actual zero without seeded quota',()=>{
 const data=myLeaveBalanceData(response()),html=myLeaveBalanceMarkup(data);
 for(const text of ['Tổng phép','Đã sử dụng','Còn lại','Phép năm','Khả dụng','Chuyển năm','Điều chỉnh'])assert.ok(html.includes(text));
 assert.ok(html.includes('13<small> ngày'));assert.ok(html.includes('8 ngày'));assert.ok(html.includes('15/06/2027'));
 const zero={...response(),data:{...data,totalDays:0,usedDays:0,remainingDays:0,reservedDays:0,availableDays:0,balances:[]}};
 const empty=myLeaveBalanceMarkup(myLeaveBalanceData(zero));assert.ok(empty.includes('0<small> ngày'));assert.ok(empty.includes('Chưa có số dư phép'));assert.ok(!empty.includes('12<small>'));
 const escaped=response();escaped.data.balances[0].leaveTypeName='<script>bad</script>';assert.ok(!myLeaveBalanceMarkup(myLeaveBalanceData(escaped)).includes('<script>'));
});
test('my balances reject malformed data and records belonging to another employee',()=>{
 const data=response().data;
 for(const invalid of [{success:false,data},{success:true,data:{...data,totalDays:'13'}},{success:true,data:{...data,asOfDate:'2027-02-30'}},{success:true,data:{...data,balances:null}},{success:true,data:{...data,balances:[{...data.balances[0],employeeId:99}]}}])assert.throws(()=>myLeaveBalanceData(invalid),/không hợp lệ/);
});
test('my balances API is no-store, accepts only year/type filters and never selects another employee',async()=>{
 const original=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>response()};};
  await apiMyLeaveBalances();await apiMyLeaveBalances({year:2027,leaveTypeId:1,employeeId:99});
  assert.ok(calls[0].url.endsWith('/api/leave-balances/me'));const url=new URL(calls[1].url,'http://local');assert.equal(url.searchParams.get('year'),'2027');assert.equal(url.searchParams.get('leaveTypeId'),'1');assert.equal(url.searchParams.has('employeeId'),false);assert.equal(calls[0].options.cache,'no-store');
  assert.throws(()=>apiMyLeaveBalances({year:1899}));assert.throws(()=>apiMyLeaveBalances({leaveTypeId:0}));
  globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({message:'Chưa liên kết nhân viên'})});
  await assert.rejects(apiMyLeaveBalances(),/Chưa liên kết nhân viên/);
 }finally{globalThis.fetch=original;}
});

test('leave creation requires leave request NEW, not the balance or management NEW flag',async()=>{
 const {workflowGrant,openWorkflowCreate}=await import('../assets/js/pages/approval-center/approvals.js');
 const permission={platform:'WEB',code:'WEB_LEAVE_REQUESTS',canView:'Y',canNew:'Y'};
 assert.equal(workflowGrant('leave','canNew',{permissions:[permission]}),true);
 for(const patch of [{canNew:'N'},{code:'WEB_LEAVE_BALANCES'},{code:'WEB_LEAVE_MANAGEMENT'}])assert.equal(workflowGrant('leave','canNew',{permissions:[{...permission,...patch}]}),false);
 assert.doesNotThrow(()=>openWorkflowCreate('leave'));
});

test('My Leave owns four independently permitted child tabs',async()=>{
 const {myLeaveTabs,visibleMyLeaveTabs}=await import('../assets/js/pages/my-workspace/my-leave.js');
 assert.deepEqual(Object.values(myLeaveTabs).map(tab=>tab.label),['Số dư phép','Nghỉ phép','Tăng ca','Điều chỉnh công']);
 for(const [key,tab] of Object.entries(myLeaveTabs))assert.deepEqual(visibleMyLeaveTabs({permissions:[{platform:'WEB',code:tab.screen,canView:'Y'}]}),[key]);
 assert.deepEqual(visibleMyLeaveTabs({permissions:[]}),[]);
});
