import test from 'node:test';
import assert from 'node:assert/strict';
import {ApprovalCountService} from '../assets/js/services/approval-count-service.js';
const session=()=>({accessToken:'token',user:{userId:'user'},permissions:[{platform:'WEB',code:'WEB_APPROVALS',canView:'Y'}]});
function fixture(fetchCount){let account=session(),interval;const service=new ApprovalCountService({getSession:()=>account,fetchCount,timers:{setInterval(fn,ms){assert.equal(ms,30000);interval=fn;return 1;},clearInterval(){interval=null;}}});return {service,setSession:value=>account=value,poll:()=>interval?.()};}
test('pending count loads immediately, publishes authoritative total and polls with VIEW only',async()=>{
 let calls=0;const f=fixture(async()=>({total:++calls})),states=[];f.service.subscribe(state=>states.push(state.count));
 await f.service.syncAuth();assert.equal(f.service.snapshot().count,1);assert.ok(states.includes(1));
 f.poll();await f.service.refresh();assert.equal(f.service.snapshot().count,2);
 f.setSession({...session(),permissions:[{platform:'WEB',code:'WEB_LEAVE_REQUESTS',canView:'Y'}]});await f.service.syncAuth();assert.equal(f.service.snapshot().count,null);assert.equal(calls,2);
 f.service.stop();
});
test('pending count coalesces requests and discards late responses across logout/account changes',async()=>{
 let resolve,calls=0;const f=fixture(()=>{calls++;return new Promise(done=>resolve=done);});
 const old=f.service.syncAuth();f.service.refresh();f.service.syncAuth();assert.equal(calls,1);
 f.setSession(null);await f.service.syncAuth();resolve({total:99});await old;assert.equal(f.service.snapshot().count,null);
 f.service.stop();
});
test('pending count never substitutes demo or zero when server fails',async()=>{
 const f=fixture(async()=>{throw Error('offline');});await f.service.syncAuth();assert.equal(f.service.snapshot().count,null);f.service.stop();
});

test('default pending counter queries approvals PENDING and uses total instead of page length',async()=>{
 const previous=globalThis.fetch;let url;
 try{globalThis.fetch=async value=>{url=new URL(value);return {ok:true,json:async()=>({success:true,total:42,data:[{id:1}]})};};
 const service=new ApprovalCountService({getSession:session,timers:{setInterval(){return 1;},clearInterval(){}}});await service.syncAuth();assert.equal(url.pathname,'/api/approvals');assert.equal(url.searchParams.get('status'),'PENDING');assert.equal(url.searchParams.get('pageSize'),'1');assert.equal(service.snapshot().count,42);service.stop();
 }finally{globalThis.fetch=previous;}
});

test('default polling timers preserve the browser global receiver',async()=>{
 const previousSet=globalThis.setInterval,previousClear=globalThis.clearInterval;let started=false,stopped=false;
 globalThis.setInterval=function(callback,delay){assert.equal(this,globalThis);assert.equal(delay,30000);started=true;return 17;};
 globalThis.clearInterval=function(id){assert.equal(this,globalThis);assert.equal(id,17);stopped=true;};
 const service=new ApprovalCountService({getSession:session,fetchCount:async()=>({total:3})});
 try{await service.syncAuth();assert.equal(started,true);assert.equal(service.snapshot().count,3);service.stop();assert.equal(stopped,true);}finally{globalThis.setInterval=previousSet;globalThis.clearInterval=previousClear;}
});
