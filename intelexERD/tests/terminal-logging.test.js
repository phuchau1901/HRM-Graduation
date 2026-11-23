import test from 'node:test';
import assert from 'node:assert/strict';
import {terminalLoggingGrant,terminalLoggingCatalog,terminalLoggingValidate,terminalLoggingEffective,terminalLoggingModuleMode,terminalLoggingSelectAll,terminalLoggingSetModule,terminalLoggingAddUser,terminalLoggingState,mountTerminalLogging} from '../assets/js/pages/administration/system-settings/terminal-logging.js';
import {apiTerminalLoggingSettings,apiTerminalLoggingModules} from '../assets/js/api/client.js';
import {systemSettingTabs} from '../assets/js/pages/administration/system-settings/system-settings.js';
import {roleMenuGroups,roleScreenCatalog} from '../assets/js/pages/administration/roles.js';
const catalog=()=>({modules:['Employees','Authorization','Performance','System'],specialUsers:['system','anonymous']});
const settings=()=>({enabled:'N',defaultUser:'N',defaultModule:'N',includeSql:'N',users:{admin:'Y',system:'N'},modules:{Employees:'Y',Authorization:'N'}});
test('terminal logging tab uses shared system settings screen with no data scope or extra module grants',async()=>{
 assert.equal(systemSettingTabs['terminal-logging'],'Terminal Logging');
 const permission={platform:'WEB',code:'WEB_SYSTEM_SETTINGS',canView:'Y',canUpdate:'Y',dataScopes:{UPDATE:'SELF'}};
 assert.equal(terminalLoggingGrant('canUpdate',{permissions:[permission]}),true);assert.equal(terminalLoggingGrant('canView',{permissions:[{...permission,code:'WEB_USERS'}]}),false);assert.equal(terminalLoggingGrant('canUpdate',{permissions:[{...permission,canUpdate:'N'}]}),false);
 const entry=roleMenuGroups(roleScreenCatalog([{id:9,code:'WEB_SYSTEM_SETTINGS',name:'Settings',platform:'WEB'}])).flatMap(group=>group.subgroups).find(group=>group?.name==='System Settings').entries.find(entry=>entry.menuKey==='system/terminal-logging');assert.equal(entry.id,9);assert.equal(entry.code,'WEB_SYSTEM_SETTINGS');assert.equal(entry.label,'Terminal Logging');
 const root={innerHTML:''};await mountTerminalLogging(root);assert.match(root.innerHTML,/WEB_SYSTEM_SETTINGS\/VIEW/);
});
test('module catalog is supplied by server and validates known names instead of hardcoding controllers',()=>{
 const data=catalog();assert.equal(terminalLoggingCatalog(data),data);assert.throws(()=>terminalLoggingCatalog({modules:['System']}));
 assert.equal(terminalLoggingValidate(settings(),data).enabled,'N');
 assert.throws(()=>terminalLoggingValidate({...settings(),modules:{Unknown:'Y'}},data),/danh mục/);
 assert.doesNotThrow(()=>terminalLoggingValidate({...settings(),modules:{employees:'Y'}},data));
});
test('settings use Y/N strings, preserve disabled rules and reject duplicate case-insensitive map keys',()=>{
 for(const patch of [{enabled:true},{includeSql:'y'},{defaultUser:'YES'},{defaultModule:null},{users:[]},{users:{admin:'true'}},{users:{admin:'Y',ADMIN:'N'}},{modules:{Employees:'Y',employees:'N'}},{users:{' bad ':'Y'}},{users:Object.fromEntries(Array.from({length:501},(_,index)=>['user'+index,'Y']))}])assert.throws(()=>terminalLoggingValidate({...settings(),...patch},catalog()));
 const saved=settings();saved.defaultUser='Y';assert.equal(terminalLoggingEffective(saved.users,'SYSTEM',saved.defaultUser),'N');assert.equal(terminalLoggingEffective(saved.users,'other',saved.defaultUser),'Y');assert.equal(saved.modules.Authorization,'N');
});
test('ALL modules removes module exclusions and SELECTED supports several simultaneous selections',()=>{
 const draft=settings();draft.defaultModule='Y';assert.equal(terminalLoggingModuleMode(draft,catalog().modules),'SELECTED');assert.equal(terminalLoggingEffective(draft.modules,'System',draft.defaultModule),'Y');
 const beforeUsers=JSON.stringify(draft.users);terminalLoggingSelectAll(draft);assert.equal(draft.defaultModule,'Y');assert.deepEqual(draft.modules,{});assert.equal(terminalLoggingModuleMode(draft,catalog().modules),'ALL');assert.equal(JSON.stringify(draft.users),beforeUsers);
 terminalLoggingSetModule(draft,'Authorization',false,catalog().modules);assert.equal(draft.defaultModule,'N');assert.equal(draft.modules.Authorization,'N');assert.equal(draft.modules.Employees,'Y');assert.equal(draft.modules.Performance,'Y');
 terminalLoggingSetModule(draft,'System',false,catalog().modules);assert.equal(draft.modules.System,'N');assert.equal(draft.modules.Employees,'Y');assert.equal(draft.modules.Performance,'Y');assert.equal(terminalLoggingModuleMode(draft,catalog().modules),'SELECTED');
});
test('plus user adds explicit user only, preserves defaults and prevents duplicates or overflow',()=>{
 const draft=settings();terminalLoggingAddUser(draft,' anonymous ');assert.equal(draft.users.anonymous,'Y');assert.equal(draft.users.system,'N');assert.equal(draft.enabled,'N');assert.equal(draft.defaultUser,'N');assert.throws(()=>terminalLoggingAddUser(draft,'ADMIN'),/đã có/);assert.throws(()=>terminalLoggingAddUser(draft,''));
 const full={...settings(),users:Object.fromEntries(Array.from({length:500},(_,index)=>['user'+index,'Y']))};assert.throws(()=>terminalLoggingAddUser(full,'next'),/500/);
});
test('GET state accepts initial version zero without seeding, keeps actual ETag and normalizes host y/n only',()=>{
 const initial={enabled:'N',defaultUser:'N',defaultModule:'N',includeSql:'N',users:{},modules:{}};const result=terminalLoggingState({version:0,settings:initial,etag:'"0"'});assert.equal(result.etag,'"0"');assert.deepEqual(result.settings,initial);assert.notEqual(result.settings,initial);
 const lower=terminalLoggingState({version:2,settings:{...settings(),enabled:'y',users:{Admin:'y'},modules:{Employees:'n'}}});assert.equal(lower.settings.enabled,'Y');assert.equal(lower.settings.users.Admin,'Y');assert.equal(lower.settings.modules.Employees,'N');assert.equal(lower.etag,'"2"');
 assert.throws(()=>terminalLoggingState({version:-1,settings:initial}));assert.throws(()=>terminalLoggingState({version:0,settings:{...initial,enabled:true}}));assert.throws(()=>terminalLoggingState({version:0,settings:initial,etag:'wrong'}));
});
test('terminal API GET loads catalog and PUT sends bare settings with If-Match including zero',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,headers:new Headers({ETag:'"'+(options.method==='PUT'?1:0)+'"'}),json:async()=>url.endsWith('/modules')?catalog():{version:options.method==='PUT'?1:0,settings:settings()}};};
 const loaded=await apiTerminalLoggingSettings();assert.equal(loaded.version,0);assert.equal(loaded.etag,'"0"');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.responseType,undefined);
 await apiTerminalLoggingModules();assert.ok(calls[1].url.endsWith('/api/system-settings/terminal-logging/modules'));
 const payload=settings();const saved=await apiTerminalLoggingSettings(payload,loaded.etag);assert.equal(saved.etag,'"1"');assert.equal(calls[2].options.method,'PUT');assert.equal(calls[2].options.headers.get('If-Match'),'"0"');assert.deepEqual(JSON.parse(calls[2].options.body),payload);assert.equal(JSON.parse(calls[2].options.body).settings,undefined);assert.equal(JSON.parse(calls[2].options.body).version,undefined);
 assert.throws(()=>apiTerminalLoggingSettings(payload,null),/phiên bản/);
 for(const status of [409,412,428]){let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status,json:async()=>({message:'Reload configuration'})};};await assert.rejects(apiTerminalLoggingSettings(payload,'"0"'),/Reload/);assert.equal(attempts,1);}
 }finally{globalThis.fetch=previous;}
});

test('per-user module rules isolate selections, retain legacy defaults and survive state/API round trip',async()=>{
 const {terminalLoggingUserModules,terminalLoggingSetUserModules}=await import('../assets/js/pages/administration/system-settings/terminal-logging.js');
 const draft=settings();draft.defaultModule='Y';draft.userModules={admin:{Employees:'Y'},bob:{Performance:'Y'}};
 assert.deepEqual(terminalLoggingUserModules(draft,'ADMIN',catalog().modules),{Employees:'Y'});
 assert.equal(terminalLoggingEffective(terminalLoggingUserModules(draft,'admin',catalog().modules),'Performance','N'),'N');
 terminalLoggingSetUserModules(draft,'ADMIN',{System:'Y'});assert.deepEqual(draft.userModules.bob,{Performance:'Y'});assert.equal(Object.keys(draft.userModules).length,2);
 terminalLoggingSelectAll(draft);assert.deepEqual(draft.userModules.admin,{System:'Y'});
 terminalLoggingSetUserModules(draft,'admin',null);assert.equal(terminalLoggingUserModules(draft,'admin',catalog().modules).Performance,'Y');
 terminalLoggingAddUser(draft,'newuser');assert.deepEqual(draft.userModules.newuser,{});
 const loaded=terminalLoggingState({settings:{...draft,userModules:{bob:{Performance:'y'}}},version:3});assert.deepEqual(loaded.settings.userModules,{bob:{Performance:'Y'}});
 assert.doesNotThrow(()=>terminalLoggingValidate(loaded.settings,catalog()));
 for(const userModules of [[],{bob:{Unknown:'Y'}},{bob:{Performance:true}},{bob:{Performance:'Y',performance:'N'}},{bob:{},BOB:{}},{' bad ':{}}])assert.throws(()=>terminalLoggingValidate({...settings(),userModules},catalog()));
 const previous=globalThis.fetch;
 try{globalThis.fetch=async(url,options)=>{assert.deepEqual(JSON.parse(options.body).userModules,{bob:{Performance:'Y'}});return {ok:true,headers:new Headers({ETag:'"4"'}),json:async()=>({version:4,settings:loaded.settings})};};await apiTerminalLoggingSettings(loaded.settings,'"3"');}finally{globalThis.fetch=previous;}
});

 test('saving disables unconfigured users while preserving default modules and individual choices',async()=>{
 const {terminalLoggingExplicitUsers}=await import('../assets/js/pages/administration/system-settings/terminal-logging.js');
 const draft={...settings(),defaultUser:'Y',defaultModule:'Y',userModules:{admin:{Employees:'Y'}}};
 const payload=terminalLoggingExplicitUsers(draft);
 assert.equal(payload.defaultUser,'N');assert.equal(draft.defaultUser,'Y');assert.equal(payload.defaultModule,'Y');assert.deepEqual(payload.modules,draft.modules);assert.deepEqual(payload.users,draft.users);assert.deepEqual(payload.userModules,draft.userModules);assert.notEqual(payload.userModules,draft.userModules);
 });
