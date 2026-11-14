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
test('registration creates user and employee in one request without client employee code or employeeId',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return ok({userId:'new.user',employeeId:42,employeeCode:'NV000042'});};
 const account={userId:'new.user',email:'account@example.com',password:'example-password',roleIds:[1,2],employeeId:99};
 const employee={employeeCode:'CLIENT-CODE',fullName:'New employee',email:'staff@example.com',departmentId:5};
 const result=await registerSystemUser({account,employee});
 assert.equal(calls.length,1);assert.equal(calls[0].url.endsWith('/api/users'),true);
 assert.deepEqual(calls[0].body,{userId:'new.user',email:'account@example.com',password:'example-password',roleIds:[1,2],createEmployee:true,employee:{fullName:'New employee',email:'account@example.com',departmentId:5}});
 assert.equal(result.employeeCode,'NV000042');assert.equal(employee.employeeCode,'CLIENT-CODE');
});
test('atomic registration failure retries the complete user request without separate employee creation',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return calls.length===1?{ok:false,status:409,json:async()=>({message:'Email đã tồn tại'})}:ok({userId:'new',employeeId:7,employeeCode:'NV000007'});};
 const input={account:{roleIds:[]},employee:{fullName:'New',departmentId:1}};
 await assert.rejects(registerSystemUser(input),/Email đã tồn tại/);
 await registerSystemUser(input);assert.equal(calls.length,2);
 assert.ok(calls.every(call=>call.url.endsWith('/api/users')));assert.deepEqual(calls[0].body,calls[1].body);
});
test('account only registration omits employee object and supports an existing employee link',async()=>{
 const bodies=[];globalThis.fetch=async(url,options)=>{assert.equal(url.endsWith('/api/users'),true);bodies.push(JSON.parse(options.body));return ok({userId:'account'});};
 await registerSystemUser({account:{roleIds:[]}});
 await registerSystemUser({account:{roleIds:[],employeeId:12}});
 assert.deepEqual(bodies,[{roleIds:[],createEmployee:false,employeeId:null},{roleIds:[],createEmployee:false,employeeId:12}]);
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
test('employee linking queries unlinked endpoint with server pagination and encoded filters',async()=>{
 const {apiUnlinkedEmployees}=await import('../assets/js/api/client.js');
 let seen;globalThis.fetch=async(url,options)=>{seen={url,options};return ok({total:0,data:[]});};
 const result=await apiUnlinkedEmployees(new URLSearchParams({page:2,pageSize:10,search:'NV & tên'}).toString());
 const url=new URL(seen.url,'http://local');
 assert.equal(url.pathname,'/api/employees/unlinked');assert.equal(url.searchParams.get('page'),'2');
 assert.equal(url.searchParams.get('pageSize'),'10');assert.equal(url.searchParams.get('search'),'NV & tên');
 assert.equal(url.searchParams.has('employmentStatus'),false);assert.deepEqual(result,{total:0,data:[]});
});
test('password reset posts actor reauthentication and new password with aggregate version',async()=>{
 const {apiResetUserPassword}=await import('../assets/js/api/client.js');
 let seen;globalThis.fetch=async(url,options)=>{seen={url,options};return ok({userId:'target/name',version:'after-reset'});};
 const saved=await apiResetUserPassword('target/name','current-version',{type:'SELF_CHANGE',currentPassword:'actor-test-password',newPassword:'target-test-password'});
 assert.match(seen.url,/\/api\/users\/target%2Fname\/reset-password$/);
 assert.equal(seen.options.method,'POST');assert.equal(seen.options.headers.get('If-Match'),'"current-version"');
 assert.deepEqual(JSON.parse(seen.options.body),{type:'SELF_CHANGE',currentPassword:'actor-test-password',newPassword:'target-test-password'});
 assert.equal(saved.version,'after-reset');assert.throws(()=>apiResetUserPassword('target','','a','b'),/version/);
 globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({message:'Sai mật khẩu xác thực'})});
 await assert.rejects(apiResetUserPassword('target','v1',{type:'SELF_CHANGE',currentPassword:'wrong',newPassword:'target-test-password'}),/Sai mật khẩu xác thực/);
});

test('admin reset omits old password and runs only when a new password is supplied',async()=>{
 const {saveSystemUserChanges}=await import('../assets/js/pages/users.js');
 const current={userId:'target',email:'x@example.com',employeeId:null,roles:[],version:'v1'},calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return ok({...current,version:options.method==='POST'?'v3':'v2'});};
 await saveSystemUserChanges(current,{newPassword:''});assert.equal(calls.length,0);
 await saveSystemUserChanges(current,{newPassword:'new-test-password'});
 assert.equal(calls.length,2);assert.match(calls[1].url,/reset-password$/);
 assert.equal(calls[1].options.headers.get('If-Match'),'"v2"');
 assert.deepEqual(JSON.parse(calls[1].options.body),{type:'ADMIN_RESET',newPassword:'new-test-password'});
 assert.equal(current.version,'v3');
});
test('team selector loads all active teams in the selected department',async()=>{
 const {apiActiveTeams}=await import('../assets/js/api/client.js');const calls=[];
 globalThis.fetch=async url=>{
 const query=new URL(url,'http://local');calls.push(query);
 assert.equal(query.pathname,'/api/teams');assert.equal(query.searchParams.get('departmentId'),'5');
 assert.equal(query.searchParams.get('isActive'),'true');assert.equal(query.searchParams.get('pageSize'),'100');
 return ok({total:4,data:query.searchParams.get('page')==='1'?[{id:1,departmentId:5,isActive:true},{id:2,departmentId:5,isActive:false}]:[{id:3,departmentId:6,isActive:true},{id:4,departmentId:5,isActive:true}]});
 };
 assert.deepEqual((await apiActiveTeams(5)).map(team=>team.id),[1,4]);assert.equal(calls.length,2);
});
test('registration sends selected team inside nested employee payload',async()=>{
 let body;globalThis.fetch=async(url,options)=>{body=JSON.parse(options.body);return ok({employeeId:1});};
 await registerSystemUser({account:{userId:'staff'},employee:{fullName:'Staff',departmentId:5,teamId:12}});
 assert.equal(body.employee.teamId,12);assert.equal(body.employee.departmentId,5);assert.equal(body.createEmployee,true);
});
test('position selector loads every page and excludes inactive positions',async()=>{
 const {apiActivePositions}=await import('../assets/js/api/client.js');let calls=0;
 globalThis.fetch=async url=>{calls++;const parsed=new URL(url,'http://local');
 assert.equal(parsed.pathname,'/api/positions');assert.equal(parsed.searchParams.get('isActive'),'true');assert.equal(parsed.searchParams.get('pageSize'),'100');
 return ok({total:3,data:parsed.searchParams.get('page')==='1'?[{id:1,isActive:true},{id:2,isActive:false}]:[{id:3,isActive:true}]});};
 assert.deepEqual((await apiActivePositions()).map(position=>position.id),[1,3]);assert.equal(calls,2);
});
test('registration sends selected position in the nested employee DTO',async()=>{
 let body;globalThis.fetch=async(url,options)=>{body=JSON.parse(options.body);return ok({employeeId:1});};
 await registerSystemUser({account:{userId:'staff'},employee:{departmentId:5,teamId:12,positionId:7}});
 assert.equal(body.employee.positionId,7);assert.equal(body.employee.teamId,12);assert.equal(body.createEmployee,true);
});

test('registration dates accept manual day/month/year and reject impossible dates',async()=>{
 const {registrationDateValue}=await import('../assets/js/pages/users.js');
 assert.equal(registrationDateValue('14/11/2026'),'2026-11-14');
 assert.equal(registrationDateValue('29/02/2024'),'2024-02-29');
 assert.equal(registrationDateValue('29/02/2025'),null);
 assert.equal(registrationDateValue('31/04/2026'),null);
 assert.equal(registrationDateValue('01/13/2026'),null);
 assert.equal(registrationDateValue(''), '');
});
