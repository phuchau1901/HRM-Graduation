import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage={data:new Map(),getItem(k){return this.data.get(k)||null;},setItem(k,v){this.data.set(k,v);},removeItem(k){this.data.delete(k);}};
const api=await import('../assets/js/api/client.js');
const scope=await import('../assets/js/permissions.js');
const response={accessToken:'test-token',expiresAtUtc:'2099-01-01T00:00:00Z',user:{userId:'employee'},roles:[{code:'ADMIN'}],permissions:[{code:'WEB_EMPLOYEES',platform:'WEB',canView:'Y',canNew:'N'},{code:'WEB_USERS',platform:'WEB',canView:'N'}]};
test('login preserves response, sends credentials and uses Bearer for authenticated requests',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>response};};
 assert.deepEqual(await api.login('employee','secret'),response);
 assert.deepEqual(JSON.parse(calls[0].options.body),{userId:'employee',password:'secret'});
 assert.equal(calls[0].options.headers.has('Authorization'),false);
 assert.deepEqual(JSON.parse(localStorage.getItem('intelex-erp-api-session:v1')),response);
 await api.me();assert.equal(calls[1].options.headers.get('Authorization'),'Bearer test-token');
 assert.equal(scope.routeAllowed({}, {role:'Dev'},'/hr/employees'),true);
 assert.equal(scope.routeAllowed({}, {role:'Admin'},'/admin/users'),false);
 assert.equal(scope.screenAllowed('/hr/employees','canNew'),false);
 assert.equal(scope.screenAllowed('/unknown'),false);
 assert.equal(scope.screenAllowed('/hr/employees/42'),true);
 globalThis.fetch=async()=>({ok:false,status:401,json:async()=>({message:'Phiên không hợp lệ'})});
 await assert.rejects(api.me(),/Phiên không hợp lệ/);assert.equal(api.apiSession(),null);
 assert.equal(localStorage.getItem('intelex-erp-api-session:v1'),null);
});
test('invalid login response never creates a session',async()=>{
 globalThis.fetch=async()=>({ok:true,json:async()=>({user:{}})});
 await assert.rejects(api.login('x','y'),/không hợp lệ/);assert.equal(api.apiSession(),null);
});
