import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLeaveAccrual,leaveAccrualGrant,mountLeaveAccrualSettings,firstLeaveCycle,leaveCycleFields} from '../assets/js/pages/administration/system-settings/leave-accrual-settings.js';
import {apiLeaveAccrualSettings,apiRunLeaveAccrual} from '../assets/js/api/client.js';
const schedule=(startDate='2027-01-01',interval=2,unit='MONTH')=>({startDate,interval,unit});
const settings=()=>({scheduleVersion:2,enabled:true,defaultDaysPerCycle:1,accrualSchedule:schedule(),resetSchedule:schedule('2027-01-01',1,'YEAR'),newHireEligibility:'ACTIVE_ON_DATE',rules:[{positionId:1,daysPerCycle:1.5}]});
test('calendar previews clamp month ends and leap days and start after the anchor',()=>{
 assert.equal(firstLeaveCycle(schedule()),'2027-03-01');
 assert.equal(firstLeaveCycle(schedule('2028-01-31',1)),'2028-02-29');
 assert.equal(firstLeaveCycle(schedule('2028-01-31',2)),'2028-03-31');
 assert.equal(firstLeaveCycle(schedule('2028-02-29',1,'YEAR')),'2029-02-28');
 for(const s of [schedule('2027-02-30'),schedule('2027-01-01',0),schedule('2027-01-01',121),schedule('2027-01-01',1,'DAY')])assert.throws(()=>firstLeaveCycle(s));
 assert.match(leaveCycleFields('accrualSchedule','Cấp',schedule()),/data-cycle-preview/);
});
test('v2 accepts overdue anchors, optional ANNUAL and reset-only rules',()=>{
 const policy=settings();assert.equal(validateLeaveAccrual(policy,null,'2026-11-17'),policy);
 const pastAnchor={...policy,accrualSchedule:schedule('2026-01-01',1,'YEAR')};assert.doesNotThrow(()=>validateLeaveAccrual(pastAnchor,null,'2026-11-17'));
 assert.doesNotThrow(()=>validateLeaveAccrual(policy,null,'2028-01-01'));
 assert.doesNotThrow(()=>validateLeaveAccrual(policy,policy,'2028-01-01'));
 assert.doesNotThrow(()=>validateLeaveAccrual({...policy,accrualSchedule:schedule('2027-01-01',3)},policy,'2028-01-01'));
 assert.doesNotThrow(()=>validateLeaveAccrual({...policy,accrualSchedule:null,rules:[{positionId:1,daysPerCycle:null}]},null,'2026-11-17'));
 assert.doesNotThrow(()=>validateLeaveAccrual({...policy,enabled:false,accrualSchedule:null,resetSchedule:null},null,'2026-11-17'));
 for(const patch of [{accrualSchedule:null,resetSchedule:null},{rules:[{positionId:1,daysPerCycle:100000}]},{rules:[{positionId:1,daysPerCycle:1.234}]},{rules:[{positionId:1,daysPerCycle:1},{positionId:1,leaveTypeId:5,daysPerCycle:2}]}])assert.throws(()=>validateLeaveAccrual({...policy,...patch},null,'2026-11-17',5));
});
test('configuration uses only WEB_SYSTEM_SETTINGS without balance permission or scopes',async()=>{
 const system={platform:'WEB',code:'WEB_SYSTEM_SETTINGS',canView:'Y',canUpdate:'Y',dataScopes:{UPDATE:'SELF'}};
 assert.equal(leaveAccrualGrant('canView',{permissions:[system]}),true);
 assert.equal(leaveAccrualGrant('canUpdate',{permissions:[system]}),true);
 assert.equal(leaveAccrualGrant('canUpdate',{permissions:[{...system,canUpdate:'N'}]}),false);
 assert.equal(leaveAccrualGrant('canView',{permissions:[{...system,code:'WEB_LEAVE_BALANCES'}]}),false);
 const root={innerHTML:''};await mountLeaveAccrualSettings(root);assert.match(root.innerHTML,/chưa có quyền/);
});
test('v2 saves body version zero and run has no date or force body; conflicts never retry',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({version:1,settings:settings()})};};
 await apiLeaveAccrualSettings();await apiLeaveAccrualSettings({version:0,settings:settings()});await apiRunLeaveAccrual();
 assert.ok(calls[0].url.endsWith('/api/system-settings/leave-accrual'));assert.equal(calls[0].options.cache,'no-store');
 assert.equal(calls[1].options.method,'PUT');assert.deepEqual(JSON.parse(calls[1].options.body),{version:0,settings:settings()});assert.equal(calls[1].options.headers.has('If-Match'),false);
 assert.ok(calls[2].url.endsWith('/leave-accrual/run'));assert.equal(calls[2].options.method,'POST');assert.equal(calls[2].options.body,undefined);
 let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status:409,json:async()=>({message:'Version changed'})};};
 await assert.rejects(apiLeaveAccrualSettings({version:0,settings:settings()}),/Version changed/);assert.equal(attempts,1);
 }finally{globalThis.fetch=previous;}
});

test('default days support empty rules and API default, reject invalid precision and range',()=>{
 const policy={...settings(),rules:[]};
 for(const value of [undefined,1,0.01,1.25,99999])assert.doesNotThrow(()=>validateLeaveAccrual({...policy,defaultDaysPerCycle:value}));
 for(const value of [null,'1',0,-1,100000,1.001,NaN,Infinity])assert.throws(()=>validateLeaveAccrual({...policy,defaultDaysPerCycle:value}),/mặc định/);
});
