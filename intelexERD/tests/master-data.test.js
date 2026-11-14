import test from 'node:test';
import assert from 'node:assert/strict';
import {organizationPayload} from '../assets/js/pages/master-data.js';
import {apiOrganization} from '../assets/js/api/client.js';

test('organization forms serialize all editable fields using each API contract',()=>{
 const input={code:' D01 ',name:' Engineering ',description:' Description ',isActive:false,departmentId:'7'};
 assert.deepEqual(organizationPayload('departments',input),{departmentCode:'D01',departmentName:'Engineering',description:'Description',isActive:false});
 assert.deepEqual(organizationPayload('positions',input),{code:'D01',name:'Engineering',isActive:false});
 assert.deepEqual(organizationPayload('teams',input),{teamCode:'D01',teamName:'Engineering',description:'Description',isActive:false,departmentId:7});
 assert.equal(organizationPayload('teams',input,{departmentId:2}).departmentId,2);
 assert.equal(organizationPayload('departments',{...input,description:'  '}).description,null);
});
test('organization list, detail, create and update use resource endpoints without If-Match',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:1})};};
 await apiOrganization('teams',null,null,new URLSearchParams({page:2,pageSize:30,search:'A & B',isActive:false}).toString());
 const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/teams');assert.equal(url.searchParams.get('search'),'A & B');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('isActive'),'false');
 await apiOrganization('departments',1);assert.ok(calls[1].url.endsWith('/api/departments/1'));
 const payload={code:'DEV',name:'Developer',isActive:true};
 await apiOrganization('positions',null,payload);assert.equal(calls[2].options.method,'POST');
 await apiOrganization('positions',7,payload);assert.equal(calls[3].options.method,'PUT');assert.ok(calls[3].url.endsWith('/api/positions/7'));assert.equal(calls[3].options.headers.has('If-Match'),false);assert.deepEqual(JSON.parse(calls[3].options.body),payload);
 assert.throws(()=>apiOrganization('users'),/Danh mục/);
 globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Mã đã tồn tại'})});
 await assert.rejects(apiOrganization('positions',7,payload),/Mã đã tồn tại/);
});
