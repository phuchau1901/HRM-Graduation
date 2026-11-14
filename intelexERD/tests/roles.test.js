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
test('WEB and MOBILE menus separate platform catalogs and save changes together',()=>{
 const screens=[{id:1,code:'WEB_TEAM_MEMBERS',name:'Web members',platform:'WEB'},{id:2,code:'MOBILE_TEAM_MEMBERS',name:'Mobile members',platform:'MOBILE'},{id:3,code:'MOBILE_CUSTOM',name:'Mobile custom',platform:'MOBILE'}];
 assert.deepEqual(roleMenuGroups(screens,'WEB').flatMap(g=>g.entries.map(x=>x.id)),[1]);
 const mobile=roleMenuGroups(screens,'MOBILE');assert.equal(mobile[0].name,'Team Management');
 assert.deepEqual(mobile.flatMap(g=>g.entries.map(x=>x.id)),[2,3]);
 assert.deepEqual(roleMenuGroups(screens.filter(s=>s.platform==='WEB'),'MOBILE'),[]);
 const patch=rolePermissionPatch(new Map([['WEB_TEAM_MEMBERS',{VIEW:true}],['MOBILE_TEAM_MEMBERS',{VIEW:false}]]),new Set(['WEB_TEAM_MEMBERS','MOBILE_TEAM_MEMBERS']));
 assert.equal(patch.length,2);assert.equal(patch[1].standard.VIEW,false);
});
test('employee scope patch preserves each action scope and explicit SELF fallback',()=>{
 const draft=new Map([['WEB_EMPLOYEES',{VIEW:true,UPDATE:true}],['WEB_ROLES',{VIEW:true}]]);
 const scopes=new Map([['WEB_EMPLOYEES',{VIEW:'ALL',UPDATE:'DEPARTMENT',EXPORT:'SELF'}]]);
 const patch=rolePermissionPatch(draft,new Set(draft.keys()),new Set(),scopes);
 assert.deepEqual(patch[0].dataScopes,{VIEW:'ALL',UPDATE:'DEPARTMENT',EXPORT:'SELF'});
 assert.equal('dataScopes' in patch[1],false);
 assert.equal('extendedActions' in patch[0],false);
 scopes.get('WEB_EMPLOYEES').UPDATE='SELF';
 assert.equal(rolePermissionPatch(draft,new Set(['WEB_EMPLOYEES']),new Set(),scopes)[0].dataScopes.UPDATE,'SELF');
});
test('rename role uses fresh detail version and sends only code and name',async()=>{
 const {apiRoleDetail,apiUpdateRole}=await import('../assets/js/api/client.js');
 const originalFetch=globalThis.fetch,calls=[];
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:5,code:'STAFF',name:'New name',version:'b'.repeat(64)})};};
 const detail=await apiRoleDetail(5);
 await apiUpdateRole(5,detail.version,{code:detail.code,name:'New name'});
 assert.match(calls[0].url,/\/api\/roles\/5$/);
 assert.equal(calls[1].options.method,'PUT');
 assert.equal(calls[1].options.headers.get('If-Match'),'"'+'b'.repeat(64)+'"');
 assert.deepEqual(JSON.parse(calls[1].options.body),{code:'STAFF',name:'New name'});
 assert.throws(()=>apiUpdateRole(5,'',{}),/version/);
 }finally{globalThis.fetch=originalFetch;}
});

test('role screen menu places organization catalogs and shifts under Master Data without duplicate labels',()=>{
 const catalog=[{id:1,code:'WEB_DEPARTMENTS',name:'Phòng ban',platform:'WEB'},{id:2,code:'WEB_POSITIONS',name:'Chức vụ',platform:'WEB'},{id:3,code:'WEB_TEAMS',name:'Teams',platform:'WEB'},{id:4,code:'WEB_SHIFTS',name:'Ca làm việc',platform:'WEB'},{id:5,code:'WEB_SYSTEM_SETTINGS',name:'Cấu hình hệ thống',platform:'WEB'},{id:6,code:'WEB_ORGANIZATION',name:'Tổ chức',platform:'WEB'}];
 const groups=roleMenuGroups(catalog),admin=groups.find(group=>group.name==='Administration');
 assert.deepEqual(admin.entries.filter(screen=>screen.label.startsWith('Master Data')).map(screen=>screen.code),['WEB_DEPARTMENTS','WEB_POSITIONS','WEB_TEAMS','WEB_SHIFTS']);
 assert.deepEqual(admin.entries.filter(screen=>screen.label==='System Settings').map(screen=>screen.code),['WEB_SYSTEM_SETTINGS']);
 assert.deepEqual(groups.find(group=>group.name==='Human Resources').entries.map(screen=>screen.code),['WEB_ORGANIZATION']);
 const entries=groups.flatMap(group=>group.entries);assert.equal(new Set(entries.map(screen=>screen.id)).size,catalog.length);assert.equal(new Set(admin.entries.map(screen=>screen.label)).size,admin.entries.length);
});
test('Master Data exposes a nested screen submenu including shared attendance settings',()=>{
 const catalog=[['WEB_DEPARTMENTS','Phòng ban'],['WEB_POSITIONS','Chức vụ'],['WEB_TEAMS','Teams'],['WEB_SHIFTS','Ca làm việc'],['WEB_SYSTEM_SETTINGS','Cấu hình hệ thống']].map(([code,name],index)=>({id:index+1,code,name,platform:'WEB'}));
 const admin=roleMenuGroups(catalog).find(group=>group.name==='Administration');
 assert.equal(admin.subgroups[0].name,'Master Data');assert.equal(admin.subgroups[0].key,'Administration/Master Data');
 assert.deepEqual(admin.subgroups[0].entries.map(screen=>screen.label),['Phòng ban','Chức vụ','Teams','Chấm công','Ca làm việc']);
 assert.equal(admin.subgroups[0].entries.find(screen=>screen.label==='Chấm công').code,'WEB_SYSTEM_SETTINGS');
});

test('Master Data container does not create an overview child',()=>{
 const catalog=[{id:1,code:'WEB_MASTER_DATA',name:'Master Data',platform:'WEB'},{id:2,code:'WEB_TEAMS',name:'Teams',platform:'WEB'}];
 const admin=roleMenuGroups(catalog).find(group=>group.name==='Administration');
 assert.deepEqual(admin.subgroups[0].entries.map(screen=>screen.code),['WEB_TEAMS']);
 assert.ok(!admin.subgroups[0].entries.some(screen=>screen.label==='Tổng quan'));
});
