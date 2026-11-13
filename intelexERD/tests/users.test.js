import test from 'node:test';
import assert from 'node:assert/strict';
import {apiUsers,apiAllRoles,apiActiveDepartments} from '../assets/js/api/client.js';
import {registerSystemUser} from '../assets/js/pages/users.js';
const ok=body=>({ok:true,json:async()=>body});
test('users list uses server paging and encoded search',async()=>{
 let seen;globalThis.fetch=async(url,options)=>{seen={url,options};return ok({data:[],total:0});};
 await apiUsers(2,'a & b');const url=new URL(seen.url,'http://local');assert.equal(url.pathname,'/api/users');assert.equal(url.searchParams.get('search'),'a & b');assert.equal(url.searchParams.get('page'),'2');
});
test('role and department selectors load every page and only active departments',async()=>{
 globalThis.fetch=async(url)=>{const parsed=new URL(url,'http://local');const page=Number(parsed.searchParams.get('page'));
 if(parsed.pathname==='/api/roles')return ok({total:2,data:[{id:page}]});
 assert.equal(parsed.searchParams.get('isActive'),'true');return ok({total:2,data:[{id:page,isActive:page===1}]});};
 assert.deepEqual((await apiAllRoles()).map(r=>r.id),[1,2]);assert.deepEqual((await apiActiveDepartments()).map(d=>d.id),[1]);
});
test('registration creates employee first then links account with multiple roles',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return ok(url.endsWith('/api/employees')?{id:42}:{userId:'new.user'});};
 const account={userId:'new.user',email:'x@example.com',password:'example-password',roleIds:[1,2]};
 const employee={employeeCode:'E01',departmentId:5};const progress={};
 await registerSystemUser({account,employee},progress);
 assert.equal(calls[0].url.endsWith('/api/employees'),true);assert.deepEqual(calls[0].body,employee);
 assert.deepEqual(calls[1].body,{...account,employeeId:42});assert.equal(progress.employeeId,42);
});
test('account failure preserves created employee for retry without duplicate employee',async()=>{
 let employeeCalls=0,userCalls=0;globalThis.fetch=async(url)=>{
 if(url.endsWith('/api/employees')){employeeCalls++;return ok({id:7});}
 userCalls++;return userCalls===1?{ok:false,status:409,json:async()=>({message:'Email đã tồn tại'})}:ok({userId:'new'});
 };
 const input={account:{roleIds:[]},employee:{departmentId:1}},progress={};
 await assert.rejects(registerSystemUser(input,progress),/Email đã tồn tại/);assert.equal(progress.employeeId,7);
 await registerSystemUser(input,progress);assert.equal(employeeCalls,1);assert.equal(userCalls,2);
});
test('account only registration does not create employee; employee failure stops account creation',async()=>{
 const urls=[];globalThis.fetch=async(url,options)=>{urls.push(url);assert.equal(JSON.parse(options.body).employeeId,null);return ok({userId:'account'});};
 await registerSystemUser({account:{roleIds:[]}},{});assert.equal(urls.length,1);assert.equal(urls[0].endsWith('/api/users'),true);
 globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({message:'Không có quyền tạo nhân viên'})});
 await assert.rejects(registerSystemUser({account:{},employee:{}},{}),/Không có quyền/);
});
test('editing metadata and roles uses the latest aggregate version and supports unlinking',async()=>{
 const {saveSystemUserChanges}=await import('../assets/js/pages/users.js');const calls=[];
 const current={userId:'user/name',email:'old@example.com',employeeId:7,roles:[{id:1}],version:'old'};
 globalThis.fetch=async(url,options)=>{calls.push({url,options});
 if(options.method==='PUT'&&!url.endsWith('/roles'))return ok({...current,email:'new@example.com',employeeId:null,version:'after-profile'});
 if(options.method==='PUT')return ok({...current,roles:[{id:2},{id:3}],version:'after-roles'});
 return ok({...current,version:'fresh'});
 };
 await saveSystemUserChanges(current,{profile:{email:'new@example.com',employeeId:null},roleIds:[2,3]});
 assert.equal(calls.length,3);assert.match(calls[0].url,/user%2Fname$/);
 assert.equal(calls[0].options.headers.get('If-Match'),'"old"');assert.equal(JSON.parse(calls[0].options.body).employeeId,null);
 assert.equal(calls[2].options.headers.get('If-Match'),'"fresh"');assert.deepEqual(JSON.parse(calls[2].options.body),{roleIds:[2,3]});
 assert.equal(current.version,'after-roles');
});
test('role failure retains saved metadata for retry, and empty role list removes all assignments',async()=>{
 const {saveSystemUserChanges}=await import('../assets/js/pages/users.js');let puts=0;let fail=true;const bodies=[];
 const current={userId:'target',email:'old@example.com',employeeId:null,roles:[{id:1}],version:'v1'};
 globalThis.fetch=async(url,options)=>{
 if(options.method==='PUT'&&!url.endsWith('/roles')){puts++;return ok({...current,email:'new@example.com',employeeId:12,version:'v2'});}
 if(url.endsWith('/roles')){bodies.push(JSON.parse(options.body));return fail?{ok:false,status:403,json:async()=>({message:'Không được gán role'})}:ok({...current,roles:[],version:'v3'});}
 return ok({...current});
 };
 const changes={profile:{email:'new@example.com',employeeId:12},roleIds:[]};
 await assert.rejects(saveSystemUserChanges(current,changes),/Không được gán role/);assert.equal(current.employeeId,12);
 fail=false;await saveSystemUserChanges(current,changes);assert.equal(puts,1);assert.deepEqual(bodies,[{roleIds:[]},{roleIds:[]}]);
});
