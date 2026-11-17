import test from 'node:test';
import assert from 'node:assert/strict';
import {roleScreenCatalog,roleMenuGroups,rolePermissionPatch,roleFlags} from '../assets/js/pages/administration/roles.js';
import {apiAllScreens,apiRolePermissions,apiSaveRolePermissions,apiRoles} from '../assets/js/api/client.js';
test('screen catalog groups follow navigation and retain IDs and unmatched screens',()=>{
 const groups=roleMenuGroups([{id:17,code:'WEB_TEAM_MEMBERS',name:'Members'},{id:9,code:'WEB_ROLES',name:'Roles'},{id:99,code:'WEB_CUSTOM',name:'Custom'}]);
 assert.equal(groups[0].name,'Team Management');assert.equal(groups[0].entries[0].id,17);
 assert.equal(groups[1].name,'Administration');assert.ok(groups[1].entries.some(screen=>screen.code==='WEB_CUSTOM'));assert.ok(!groups.some(group=>group.name==='Màn hình khác'));
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
 assert.deepEqual(admin.entries.filter(screen=>screen.label.startsWith('System Settings')).map(screen=>screen.code),['WEB_SYSTEM_SETTINGS']);
 assert.deepEqual(groups.find(group=>group.name==='Human Resources').entries.map(screen=>screen.code),['WEB_ORGANIZATION']);
 const entries=groups.flatMap(group=>group.entries);assert.equal(new Set(entries.map(screen=>screen.id)).size,catalog.length);assert.equal(new Set(admin.entries.map(screen=>screen.label)).size,admin.entries.length);
});
test('Master Data submenu excludes attendance settings after moving to System Settings',()=>{
 const catalog=[['WEB_DEPARTMENTS','Phòng ban'],['WEB_POSITIONS','Chức vụ'],['WEB_TEAMS','Teams'],['WEB_SHIFTS','Ca làm việc'],['WEB_SYSTEM_SETTINGS','Cấu hình hệ thống']].map(([code,name],index)=>({id:index+1,code,name,platform:'WEB'}));
 const admin=roleMenuGroups(catalog).find(group=>group.name==='Administration');
 assert.equal(admin.subgroups[0].name,'Master Data');assert.equal(admin.subgroups[0].key,'Administration/Master Data');
 assert.deepEqual(admin.subgroups[0].entries.map(screen=>screen.label),['Phòng ban','Chức vụ','Teams','Ca làm việc']);
 assert.ok(!admin.subgroups[0].entries.some(screen=>screen.code==='WEB_SYSTEM_SETTINGS'));
});

test('Master Data container does not create an overview child',()=>{
 const catalog=[{id:1,code:'WEB_MASTER_DATA',name:'Master Data',platform:'WEB'},{id:2,code:'WEB_TEAMS',name:'Teams',platform:'WEB'}];
 const admin=roleMenuGroups(catalog).find(group=>group.name==='Administration');
 assert.deepEqual(admin.subgroups[0].entries.map(screen=>screen.code),['WEB_TEAMS']);
 assert.ok(!admin.subgroups[0].entries.some(screen=>screen.label==='Tổng quan'));
});

test('Contracts renders the same three data-scope choices as Employees for each permission',async()=>{
 const {roleScopeSelect}=await import('../assets/js/pages/administration/roles.js');
 for(const [flag,label] of roleFlags){
  const contracts=roleScopeSelect('WEB_CONTRACTS',flag,label,'DEPARTMENT');
  assert.equal(contracts,roleScopeSelect('WEB_EMPLOYEES',flag,label,'DEPARTMENT'));
  assert.ok(contracts.includes('Chính mình'));assert.ok(contracts.includes('Cùng phòng ban'));assert.ok(contracts.includes('Tất cả'));
  assert.ok(contracts.includes('value="DEPARTMENT" selected'));assert.ok(contracts.includes(`data-role-scope="${flag}"`));
 }
 assert.equal(roleScopeSelect('WEB_CONTRACT_TYPES','VIEW','Xem'), '');
 assert.ok(roleScopeSelect('WEB_CONTRACTS','VIEW','Xem','SELF',true).includes('disabled'));
});

test('Permissions menu and Roles menu both mount the API permission editor',async()=>{
 const {adminPage}=await import('../assets/js/pages/shared/operations.js');
 for(const path of ['/admin/permissions','/admin/roles']){
  const html=adminPage({},path);
  assert.ok(html.includes('id="roles-api-root"'));assert.ok(!html.includes('Ma trận quyền'));
 }
});

test('Contracts scope is saved independently of Employees scope with the role version',async()=>{
 const original=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({version:'new-version'})};};
  const draft=new Map([['WEB_CONTRACTS',{VIEW:true,NEW:true,UPDATE:true}],['WEB_EMPLOYEES',{VIEW:true}]]);
  const scopes=new Map([['WEB_CONTRACTS',{VIEW:'SELF',NEW:'DEPARTMENT',UPDATE:'ALL'}],['WEB_EMPLOYEES',{VIEW:'ALL'}]]);
  const patch=rolePermissionPatch(draft,new Set(['WEB_CONTRACTS']),new Set(),scopes);
  await apiSaveRolePermissions(7,'role-version',patch);
  const body=JSON.parse(calls[0].options.body);
  assert.equal(body.screens.length,1);assert.equal(body.screens[0].screenCode,'WEB_CONTRACTS');assert.deepEqual(body.screens[0].dataScopes,{VIEW:'SELF',NEW:'DEPARTMENT',UPDATE:'ALL'});
  assert.equal(calls[0].options.headers.get('If-Match'),'"role-version"');
 }finally{globalThis.fetch=original;}
});

test('Roles account display uses only authenticated API identity and roles',async()=>{
 const {roleSessionIdentity}=await import('../assets/js/pages/administration/roles.js');
 assert.deepEqual(roleSessionIdentity({user:{userId:'real-user',fullName:'Nguyễn A'},roles:[{name:'Nhân sự'},{code:'CONTRACT_MANAGER'}]}),{id:'real-user',name:'Nguyễn A',role:'Nhân sự, CONTRACT_MANAGER'});
 assert.deepEqual(roleSessionIdentity(null),{id:'',name:'Tài khoản',role:''});
});

test('Roles never substitutes demo roles when unauthenticated or when the API fails',async()=>{
 const {mountRoles}=await import('../assets/js/pages/administration/roles.js');
 const {login,apiLogout}=await import('../assets/js/api/client.js');
 const original=globalThis.fetch;let roleReads=0;
 const root={isConnected:true,innerHTML:'',querySelector:()=>({})};
 try{
  apiLogout();globalThis.fetch=()=>{throw Error('must not fetch without authentication');};
  await mountRoles(root);assert.match(root.innerHTML,/Vui lòng đăng nhập/);
  globalThis.fetch=async url=>{
   if(url.endsWith('/api/auth/login'))return {ok:true,json:async()=>({accessToken:'test',user:{userId:'real-user'},roles:[],permissions:[],expiresAtUtc:'2099-01-01T00:00:00Z'})};
   roleReads++;return {ok:false,status:503,json:async()=>({message:'Không kết nối được dịch vụ vai trò'})};
  };
  await login('real-user','test');await mountRoles(root,{});
  assert.equal(roleReads,1);assert.ok(root.innerHTML.includes('Không kết nối được dịch vụ vai trò'));assert.ok(root.innerHTML.includes('Thử lại'));assert.ok(!root.innerHTML.includes('<table'));assert.ok(!root.innerHTML.includes('demo'));
 }finally{apiLogout();globalThis.fetch=original;}
});

test('System Settings expands into its four tabs with stable backend screen identities',()=>{
 const catalog=[{id:10,code:'WEB_SYSTEM_SETTINGS',name:'System Settings',platform:'WEB'},{id:11,code:'WEB_APPROVAL_SETTINGS',name:'Quy trình phê duyệt',platform:'WEB'}];
 const admin=roleMenuGroups(catalog).find(group=>group.name==='Administration');
 const submenu=admin.subgroups.find(group=>group.name==='System Settings');
 assert.equal(submenu.key,'Administration/System Settings');
 assert.deepEqual(submenu.entries.map(item=>item.label),['Chính sách mật khẩu','Chấm công','Cấp/Thu hồi phép','Quy trình phê duyệt']);
 assert.deepEqual(submenu.entries.map(item=>item.id),[10,10,10,11]);assert.equal(new Set(submenu.entries.map(item=>item.menuKey)).size,4);
 assert.equal(admin.entries.length,2);
 const changed=new Set(submenu.entries.slice(0,2).map(item=>item.code));
 assert.deepEqual(rolePermissionPatch(new Map([['WEB_SYSTEM_SETTINGS',{VIEW:true}]]),changed),[{screenCode:'WEB_SYSTEM_SETTINGS',standard:{VIEW:true}}]);
});

test('granting My Leave VIEW also saves balance VIEW with SELF scope in one patch',()=>{
 const draft=new Map([['WEB_LEAVE_MANAGEMENT',{VIEW:true,NEW:false}]]);
 const patch=rolePermissionPatch(draft,new Set(['WEB_LEAVE_MANAGEMENT']));
 assert.deepEqual(patch.map(item=>item.screenCode),['WEB_LEAVE_MANAGEMENT','WEB_LEAVE_BALANCES']);
 const balance=patch.find(item=>item.screenCode==='WEB_LEAVE_BALANCES');
 assert.equal(balance.standard.VIEW,true);assert.equal(balance.standard.UPDATE,false);assert.equal(balance.standard.NEW,false);assert.deepEqual(balance.dataScopes,{VIEW:'SELF'});
 assert.equal(draft.has('WEB_LEAVE_BALANCES'),false);
});
test('My Leave dependency preserves existing balance permissions and wider scope and does not revoke on disable',()=>{
 const flags={VIEW:false,UPDATE:true,EXPORT:true},scopes=new Map([['WEB_LEAVE_BALANCES',{VIEW:'ALL',UPDATE:'DEPARTMENT'}]]);
 const patch=rolePermissionPatch(new Map([['WEB_LEAVE_MANAGEMENT',{VIEW:true}],['WEB_LEAVE_BALANCES',flags]]),new Set(['WEB_LEAVE_MANAGEMENT']),new Set(),scopes);
 const balance=patch.find(item=>item.screenCode==='WEB_LEAVE_BALANCES');assert.equal(balance.standard.VIEW,true);assert.equal(balance.standard.UPDATE,true);assert.equal(balance.standard.EXPORT,true);assert.deepEqual(balance.dataScopes,{VIEW:'ALL',UPDATE:'DEPARTMENT'});
 const disabled=rolePermissionPatch(new Map([['WEB_LEAVE_MANAGEMENT',{VIEW:false}],['WEB_LEAVE_BALANCES',{VIEW:true}]]),new Set(['WEB_LEAVE_MANAGEMENT']));
 assert.equal(disabled.length,1);assert.equal(disabled[0].screenCode,'WEB_LEAVE_MANAGEMENT');
});
test('dependency updates draft UI immediately and checks that balance screen is registered and active',async()=>{
 const {applyMyLeaveViewDependency}=await import('../assets/js/pages/administration/roles.js');
 const draft=new Map([['WEB_LEAVE_MANAGEMENT',{VIEW:true}]]),changed=new Set(['WEB_LEAVE_MANAGEMENT']),scopes=new Map(),enabled=new Set();
 assert.throws(()=>applyMyLeaveViewDependency(draft,changed,scopes,enabled,[]),/đăng ký/);assert.equal(draft.has('WEB_LEAVE_BALANCES'),false);
 applyMyLeaveViewDependency(draft,changed,scopes,enabled,[{code:'WEB_LEAVE_BALANCES',isActive:true}]);
 assert.equal(draft.get('WEB_LEAVE_BALANCES').VIEW,true);assert.ok(changed.has('WEB_LEAVE_BALANCES'));assert.ok(enabled.has('WEB_LEAVE_BALANCES'));assert.equal(scopes.get('WEB_LEAVE_BALANCES').VIEW,'SELF');
});

test('role menu and screen title use Leave Management despite an old API name',()=>{
 const screen={id:99,code:'WEB_LEAVE_MANAGEMENT',name:'Nghỉ phép của tôi',platform:'WEB'};
 assert.equal(roleScreenCatalog([screen]).find(item=>item.code===screen.code).name,'Leave Management');
 const entries=roleMenuGroups([screen]).flatMap(group=>group.entries).filter(item=>item.code===screen.code);
 assert.equal(entries.length,1);assert.equal(entries[0].name,'Leave Management');assert.equal(entries[0].label,'Leave Management');assert.equal(entries[0].id,99);
});
