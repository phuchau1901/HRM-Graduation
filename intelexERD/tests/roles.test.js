import test from 'node:test';
import assert from 'node:assert/strict';
import {roleMenuGroups,rolePermissionPatch,roleFlags} from '../assets/js/pages/roles.js';
import {apiAllScreens,apiRolePermissions,apiSaveRolePermissions,apiRoles} from '../assets/js/api/client.js';
test('screen catalog groups follow navigation and retain IDs and unmatched screens',()=>{
 const groups=roleMenuGroups([{id:17,code:'WEB_TEAM_MEMBERS',name:'Members'},{id:9,code:'WEB_ROLES',name:'Roles'},{id:99,code:'WEB_CUSTOM',name:'Custom'}]);
 assert.equal(groups[0].name,'Team Management');assert.equal(groups[0].entries[0].id,17);
 assert.equal(groups[1].name,'Administration');assert.equal(groups[2].name,'Màn hình khác');
 assert.equal(groups.flatMap(g=>g.entries).length,3);
});
test('patch sends changed screens, all six flags, false revocations, and preserves extended actions by omission',()=>{
 const flags=Object.fromEntries(roleFlags.map(([key])=>[key,false]));
 const patch=rolePermissionPatch(new Map([['WEB_ROLES',flags],['WEB_USERS',{VIEW:true}]]),new Set(['WEB_ROLES']));
 assert.deepEqual(patch,[{screenCode:'WEB_ROLES',standard:flags}]);assert.equal(Object.keys(patch[0].standard).length,6);
 assert.equal('extendedActions' in patch[0],false);
});
test('roles API pagination, screens catalog pagination and versioned matrix save',async()=>{
 const calls=[];globalThis.fetch=async(url,options)=>{
 calls.push({url,options});let body;
 if(url.includes('/api/screens?')){const page=Number(new URL(url,'http://localhost').searchParams.get('page'));body={total:101,data:Array.from({length:page===1?100:1},(_,i)=>({id:(page-1)*100+i+1}))};}
 else body={version:'a'.repeat(64),screens:[]};
 return {ok:true,json:async()=>body};
 };
 const catalog=await apiAllScreens();assert.equal(catalog.length,101);assert.equal(catalog[100].id,101);
 await apiRoles(2,'test & role');assert.match(calls[2].url,/page=2/);assert.match(calls[2].url,/search=test\+%26\+role/);
 const matrix=await apiRolePermissions(5);
 await apiSaveRolePermissions(5,matrix.version,[{screenCode:'WEB_ROLES',standard:{VIEW:false}}]);
 const saved=calls.at(-1);assert.equal(saved.options.method,'PUT');assert.equal(saved.options.headers.get('If-Match'),'"'+'a'.repeat(64)+'"');
 assert.deepEqual(JSON.parse(saved.options.body),{screens:[{screenCode:'WEB_ROLES',standard:{VIEW:false}}]});
 assert.throws(()=>apiSaveRolePermissions(5,'',[]),/version/);
 globalThis.fetch=async()=>({ok:false,status:412,json:async()=>({message:'Version đã thay đổi'})});
 await assert.rejects(apiSaveRolePermissions(5,matrix.version,[]),/Version đã thay đổi/);
});
test('disabling a screen revokes standard and registered extended grants in one patch',()=>{
 const flags=Object.fromEntries(roleFlags.map(([key])=>[key,false]));
 const patch=rolePermissionPatch(new Map([['WEB_TEAM_MEMBERS',flags]]),new Set(['WEB_TEAM_MEMBERS']),new Set(['WEB_TEAM_MEMBERS']));
 assert.deepEqual(patch,[{screenCode:'WEB_TEAM_MEMBERS',standard:flags,extendedActions:[]}]);
});
