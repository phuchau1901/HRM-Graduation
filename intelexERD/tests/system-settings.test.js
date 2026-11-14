import test from 'node:test';
import assert from 'node:assert/strict';
import {apiSystemSettings} from '../assets/js/api/client.js';
import {validateSystemSettings} from '../assets/js/pages/system-settings.js';

const policy=()=>({minimumLength:12,maximumLength:128,requireUppercase:false,requireLowercase:false,requireDigit:false,requireSpecialCharacter:false,disallowUsernameInPassword:false,passwordHistoryCount:0});
const attendance=()=>({timezone:'Asia/Ho_Chi_Minh',checkInBeforeStartMinutes:60,checkInAfterStartMinutes:240,checkOutBeforeEndMinutes:240,checkOutAfterEndMinutes:120,lateGraceMinutes:5,earlyLeaveGraceMinutes:5,workingDays:[1,2,3,4,5],requireQr:false,requireGps:false,allowOvernightShifts:true,missingPunchRule:'REJECT_CHECKOUT_WITHOUT_CHECKIN',locations:[]});
const location=()=>({code:'HQ',name:'Head office',latitude:10.7,longitude:106.6,radiusMeters:100});

test('password settings enforce length bounds, character groups, flags and history',()=>{
 assert.deepEqual(validateSystemSettings('password-policy',policy()),policy());
 assert.throws(()=>validateSystemSettings('password-policy',{...policy(),minimumLength:129}),/tối thiểu/);
 assert.throws(()=>validateSystemSettings('password-policy',{...policy(),minimumLength:1,maximumLength:1,requireUppercase:true,requireDigit:true}),/nhóm ký tự/);
 assert.throws(()=>validateSystemSettings('password-policy',{...policy(),passwordHistoryCount:101}),/passwordHistoryCount/);
 assert.throws(()=>validateSystemSettings('password-policy',{...policy(),minimumLength:1.5}),/minimumLength/);
 assert.throws(()=>validateSystemSettings('password-policy',{...policy(),requireDigit:'true'}),/bật\/tắt/);
});
test('attendance settings validate days, windows, missing punches and QR/GPS evidence locations',()=>{
 assert.deepEqual(validateSystemSettings('attendance',attendance()),attendance());
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),workingDays:[]}),/ngày làm việc/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),workingDays:[1,1]}),/ngày làm việc/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),workingDays:[8]}),/ngày làm việc/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),checkInBeforeStartMinutes:1441}),/checkInBeforeStartMinutes/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),lateGraceMinutes:241}),/lateGraceMinutes/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),missingPunchRule:'GUESS'}),/thiếu lượt/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),requireGps:true}),/ít nhất một địa điểm/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),requireQr:true}),/ít nhất một địa điểm/);
 assert.doesNotThrow(()=>validateSystemSettings('attendance',{...attendance(),requireQr:true,requireGps:true,locations:[location()]}));
});
test('attendance locations reject duplicate codes and out-of-range coordinates',()=>{
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),locations:[location(),location()]}),/không trùng/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),locations:[{...location(),latitude:91}]}),/latitude/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),locations:[{...location(),radiusMeters:9}]}),/radiusMeters/);
 assert.throws(()=>validateSystemSettings('attendance',{...attendance(),locations:Array.from({length:21},(_,i)=>({...location(),code:`HQ${i}`}))}),/20 địa điểm/);
});
test('settings APIs send bare settings with their own numeric versions and reject stale saves without retry',async()=>{
 const calls=[],original=globalThis.fetch;
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({settings:url.endsWith('/attendance')?attendance():policy(),version:url.endsWith('/attendance')?7:2})};};
 const passwords=await apiSystemSettings('password-policy');const punches=await apiSystemSettings('attendance');
 await apiSystemSettings('password-policy',policy(),passwords.version);
 await apiSystemSettings('attendance',attendance(),punches.version);
 assert.ok(calls[0].url.endsWith('/api/system-settings/password-policy'));
 assert.ok(calls[1].url.endsWith('/api/system-settings/attendance'));
 assert.equal(calls[2].options.method,'PUT');assert.equal(calls[2].options.headers.get('If-Match'),'"2"');assert.equal(calls[3].options.headers.get('If-Match'),'"7"');
 assert.deepEqual(JSON.parse(calls[2].options.body),policy());assert.deepEqual(JSON.parse(calls[3].options.body),attendance());
 assert.throws(()=>apiSystemSettings('attendance',attendance(),null),/phiên bản/);
 assert.throws(()=>apiSystemSettings('attendance',attendance(),'*'),/phiên bản/);
 assert.throws(()=>apiSystemSettings('shifts'),/không hợp lệ/);
 let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status:412,json:async()=>({message:'Version đã thay đổi'})};};
 await assert.rejects(apiSystemSettings('attendance',attendance(),7),/Version đã thay đổi/);assert.equal(attempts,1);
 }finally{globalThis.fetch=original;}
});
