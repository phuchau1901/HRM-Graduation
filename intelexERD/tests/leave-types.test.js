import test from 'node:test';
import assert from 'node:assert/strict';
import {leaveTypePayload,leaveTypeGrant,mountLeaveTypes} from '../assets/js/pages/administration/master-data/leave-types.js';
import {apiWorkflowLeaveTypes,apiSaveLeaveType} from '../assets/js/api/client.js';
import {masterDataTabs} from '../assets/js/pages/administration/master-data/master-data.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {roleMenuGroups,roleScreenCatalog,roleUsesEmployeeScope} from '../assets/js/pages/administration/roles.js';

test('leave types belong to Master Data with their own role permission entry',()=>{
 assert.equal(masterDataTabs.leaveTypes,'Loại nghỉ phép');assert.ok(screenRoutes['/admin/master-data'].includes('WEB_LEAVE_TYPES'));
 const catalog=roleScreenCatalog([]),entry=catalog.find(item=>item.code==='WEB_LEAVE_TYPES');
 assert.equal(entry.name,'Loại nghỉ phép');assert.equal(entry.registrationRequired,true);
 const groups=roleMenuGroups(catalog),master=groups.find(group=>group.name==='Administration').subgroups.find(group=>group.name==='Master Data');
 assert.equal(master.entries.filter(item=>item.code==='WEB_LEAVE_TYPES').length,1);
 assert.equal(roleUsesEmployeeScope('WEB_LEAVE_TYPES'),false);
});
test('leave type payload validates API fields and preserves independent boolean settings',()=>{
 const input={code:' ANNUAL ',name:' Phép năm ',paid:true,requiresBalance:true,isActive:true};
 assert.deepEqual(leaveTypePayload(input),{code:'ANNUAL',name:'Phép năm',paid:true,requiresBalance:true,isActive:true});
 assert.deepEqual(leaveTypePayload({...input,paid:false,requiresBalance:false,isActive:false}),{code:'ANNUAL',name:'Phép năm',paid:false,requiresBalance:false,isActive:false});
 for(const invalid of [{code:'annual'},{code:'_BAD'},{code:'A'.repeat(31)},{name:''},{name:'A'.repeat(101)},{paid:'true'},{requiresBalance:null}])assert.throws(()=>leaveTypePayload({...input,...invalid}));
});
test('leave type actions require WEB_LEAVE_TYPES and denied views never call API',async()=>{
 const permission={platform:'WEB',code:'WEB_LEAVE_TYPES',canView:'Y',canNew:'Y',canUpdate:'N'};
 assert.equal(leaveTypeGrant('canNew',{permissions:[permission]}),true);assert.equal(leaveTypeGrant('canUpdate',{permissions:[permission]}),false);
 assert.equal(leaveTypeGrant('canView',{permissions:[{...permission,code:'WEB_LEAVE_REQUESTS'}]}),false);
 const original=globalThis.fetch;let called=false;
 try{globalThis.fetch=()=>{called=true;};const root={innerHTML:''};await mountLeaveTypes(root);assert.match(root.innerHTML,/chưa có quyền/);assert.equal(called,false);}finally{globalThis.fetch=original;}
});
test('leave type API supports server search, POST and PUT without inventing detail/delete endpoints',async()=>{
 const original=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:7,code:'ANNUAL'})};};
  await apiWorkflowLeaveTypes(new URLSearchParams({page:2,pageSize:20,search:'A & B'}).toString());
  const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/leave-types');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('search'),'A & B');
  const payload=leaveTypePayload({code:'ANNUAL',name:'Phép năm',paid:true,requiresBalance:true,isActive:true});
  await apiSaveLeaveType(null,payload);await apiSaveLeaveType(7,payload);
  assert.equal(calls[1].options.method,'POST');assert.ok(calls[1].url.endsWith('/api/leave-types'));assert.equal(calls[2].options.method,'PUT');assert.ok(calls[2].url.endsWith('/api/leave-types/7'));assert.deepEqual(JSON.parse(calls[2].options.body),payload);
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Mã loại nghỉ phép đã tồn tại'})});
  await assert.rejects(apiSaveLeaveType(null,payload),/đã tồn tại/);
 }finally{globalThis.fetch=original;}
});
