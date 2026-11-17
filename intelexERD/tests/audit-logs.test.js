import test from 'node:test';
import assert from 'node:assert/strict';
import {auditTime,auditQuery,auditChanges,auditPayloadView,redactAudit,auditActionNames} from '../assets/js/pages/administration/audit-logs.js';
import {apiAuditLogs,apiAuditLogDetail,login,apiSession} from '../assets/js/api/client.js';

test('audit timestamps and local time filters explicitly use Vietnam and UTC',()=>{
 const time=auditTime('2026-11-15T01:00:00Z');assert.ok(time.includes('08:00:00'));assert.ok(time.includes('15/11/2026'));
 assert.equal(auditTime('2026-11-15T01:00:00'),time);assert.equal(auditTime(null),'—');
 const query=new URLSearchParams(auditQuery({page:2,pageSize:50,search:'admin & A',actorUserId:'admin',action:'SETTINGS_UPDATED',entityType:'System',entityId:'ATTENDANCE',from:'2026-11-15T08:00',to:'2026-11-15T09:00',result:'SUCCESS',status:200}));
 assert.equal(query.get('fromUtc'),'2026-11-15T01:00:00.000Z');assert.equal(query.get('toUtc'),'2026-11-15T02:00:00.000Z');assert.equal(query.get('search'),'admin & A');assert.equal(query.get('actorUserId'),'admin');assert.equal(query.get('entityId'),'ATTENDANCE');assert.equal(query.has('result'),false);assert.equal(query.has('status'),false);
 assert.throws(()=>auditQuery({from:'2026-11-16T08:00',to:'2026-11-15T08:00'}),/bắt đầu/);
});
test('audit comparison handles nested fields, absent versus null, arrays, and metadata without inventing data',()=>{
 const before={value:{name:'Old',removed:null,settings:{enabled:false},items:[1,2]},traceId:'trace-a'};
 const after={traceId:'trace-a',value:{name:'New',added:null,settings:{enabled:true},items:[1,3]}};
 const changes=auditChanges(before,after);
 assert.deepEqual(changes.map(row=>row.path),['/value/name','/value/removed','/value/settings/enabled','/value/items','/value/added']);
 assert.equal(changes.find(row=>row.path==='/value/removed').hasAfter,false);
 assert.equal(changes.find(row=>row.path==='/value/added').after,null);
 assert.equal(auditChanges(null,after),null);assert.deepEqual(auditChanges({a:1,b:2},{b:2,a:1}),[]);
 const metadata=auditPayloadView({employeeId:2,traceId:'a'},{employeeId:2,traceId:'b'});assert.ok(metadata.includes('metadata'));assert.ok(!metadata.includes('/fullName'));
 assert.ok(auditPayloadView(null,{status:'INCOMPLETE'}).includes('null'));
});
test('nested secrets and serialized credentials are redacted in raw and comparison output',()=>{
 const input={oldPassword:'old-sensitive',value:{newPassword:'new-sensitive',access_token:'token-sensitive',nested:[{nonceHash:'hash-sensitive',clientSecret:'secret-sensitive'}]},serialized:'{"password":"serialized-sensitive"}',header:'Bearer bearer-sensitive',passwordHistoryCount:5,disallowUsernameInPassword:true};
 const safe=redactAudit(input),raw=auditPayloadView(input,{...input,oldPassword:'another-sensitive'},true),comparison=auditPayloadView(input,{...input,oldPassword:'another-sensitive'});
 for(const value of ['old-sensitive','new-sensitive','token-sensitive','hash-sensitive','secret-sensitive','serialized-sensitive','bearer-sensitive','another-sensitive']){assert.ok(!JSON.stringify(safe).includes(value));assert.ok(!raw.includes(value));assert.ok(!comparison.includes(value));}
 assert.equal(safe.passwordHistoryCount,5);assert.equal(safe.disallowUsernameInPassword,true);assert.equal(input.oldPassword,'old-sensitive');
});
test('audit payload HTML escapes untrusted strings and retains unknown action codes',()=>{
 const html=auditPayloadView({name:'<script>bad</script>'},{name:'<img src=x onerror=bad>'},true);
 assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));
 assert.equal(auditActionNames.CHECK_IN,'Chấm công vào');assert.equal(auditActionNames.UNKNOWN_ACTION,undefined);
});
test('audit APIs are authenticated, uncached GETs and surface 403/404/401 without mutation endpoints',async()=>{
 const original=globalThis.fetch,calls=[];
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.endsWith('/api/auth/login')?{accessToken:'audit-test-token',user:{userId:'auditor'},permissions:[{platform:'WEB',code:'WEB_AUDIT_LOGS',canView:'Y'}]}:url.includes('?')?{total:1,data:[{id:3}]}:{id:3,beforeJson:null,afterJson:{status:'COMPLETE'}}};};
 await login('auditor','test-password');await apiAuditLogs('page=2&pageSize=30');const detail=await apiAuditLogDetail(3);
 assert.ok(calls[1].url.endsWith('/api/audit-logs?page=2&pageSize=30'));assert.ok(calls[2].url.endsWith('/api/audit-logs/3'));assert.equal(calls[2].options.cache,'no-store');assert.equal(calls[2].options.headers.get('Authorization'),'Bearer audit-test-token');assert.equal(calls[2].options.body,undefined);assert.equal(detail.beforeJson,null);
 for(const status of [403,404,401]){globalThis.fetch=async()=>({ok:false,status,json:async()=>({message:'Rejected'})});await assert.rejects(apiAuditLogDetail(3),error=>error.status===status);}
 assert.equal(apiSession(),null);
 globalThis.fetch=async()=>{throw new TypeError('Network failure');};await assert.rejects(apiAuditLogs(),/Network failure/);
 }finally{globalThis.fetch=original;}
});
