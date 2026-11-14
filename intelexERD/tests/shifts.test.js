import test from 'node:test';
import assert from 'node:assert/strict';
import {validateShift} from '../assets/js/pages/master-data.js';
import {apiShifts,apiShiftDetail,apiSaveShift} from '../assets/js/api/client.js';
const shift=()=>({code:'DAY',name:'Ca ngày',startTime:'08:00:00',endTime:'17:00:00',breakMinutes:60,lateGraceMinutes:5,isActive:true});
test('shift validation accepts regular and overnight shifts, including default late grace',()=>{
 assert.deepEqual(validateShift(shift()),shift());
 assert.doesNotThrow(()=>validateShift({...shift(),startTime:'22:00:00',endTime:'06:00:00',lateGraceMinutes:null}));
 assert.throws(()=>validateShift({...shift(),endTime:'08:00:00'}),/trùng/);
 assert.throws(()=>validateShift({...shift(),breakMinutes:540}),/Phút nghỉ/);
 assert.throws(()=>validateShift({...shift(),lateGraceMinutes:241}),/đi trễ/);
 assert.throws(()=>validateShift({...shift(),startTime:'25:00:00'}),/không hợp lệ/);
 assert.throws(()=>validateShift({...shift(),name:' '}),/Tên ca/);
});
test('shifts use list/detail/create endpoints and versioned updates without stale retries',async()=>{
 const calls=[],original=globalThis.fetch;
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({...shift(),id:7,version:3})};};
 await apiShifts(2,'Ca & A');const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/shifts');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('search'),'Ca & A');
 await apiShiftDetail(7);assert.ok(calls[1].url.endsWith('/api/shifts/7'));
 await apiSaveShift(null,shift());assert.equal(calls[2].options.method,'POST');assert.equal(calls[2].options.headers.has('If-Match'),false);
 await apiSaveShift(7,{...shift(),isActive:false},3);assert.equal(calls[3].options.method,'PUT');assert.equal(calls[3].options.headers.get('If-Match'),'"3"');assert.deepEqual(JSON.parse(calls[3].options.body),{...shift(),isActive:false});
 assert.throws(()=>apiSaveShift(7,shift()),/phiên bản/);
 let count=0;globalThis.fetch=async()=>{count++;return {ok:false,status:412,json:async()=>({message:'Phiên bản đã thay đổi'})};};
 await assert.rejects(apiSaveShift(7,shift(),3),/Phiên bản đã thay đổi/);assert.equal(count,1);
 }finally{globalThis.fetch=original;}
});
