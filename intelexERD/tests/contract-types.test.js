import test from 'node:test';
import assert from 'node:assert/strict';
import {apiContractTypes,apiContractType,apiSaveContractType,apiDeleteContractType} from '../assets/js/api/client.js';
import {contractTypePayload,contractTypeGrant,mountContractTypes} from '../assets/js/pages/administration/master-data/contract-types.js';
import {masterDataTabs} from '../assets/js/pages/administration/master-data/master-data.js';
import {screenRoutes,roleScreenRoutes} from '../assets/js/permissions.js';
import {roleMenuGroups} from '../assets/js/pages/administration/roles.js';

test('contract types appear under Master Data and in its permission submenu',()=>{
 assert.equal(masterDataTabs.contractTypes,'Loại hợp đồng');
 assert.ok(screenRoutes['/admin/master-data'].includes('WEB_CONTRACT_TYPES'));
 assert.ok(roleScreenRoutes['/admin/master-data'].includes('WEB_CONTRACT_TYPES'));
 const catalog=[{id:1,code:'WEB_CONTRACT_TYPES',name:'Loại hợp đồng',platform:'WEB'},{id:2,code:'WEB_CONTRACTS',name:'Hợp đồng',platform:'WEB'}];
 const groups=roleMenuGroups(catalog);
 assert.equal(groups.find(group=>group.name==='Administration').subgroups[0].entries[0].code,'WEB_CONTRACT_TYPES');
 assert.equal(groups.find(group=>group.name==='Human Resources').entries[0].code,'WEB_CONTRACTS');
});
test('contract type payload validates create code and excludes immutable code from updates',()=>{
 const values={code:' FIXED_TERM ',name:' Có thời hạn ',description:' ',isActive:true,sortOrder:'10'};
 assert.deepEqual(contractTypePayload(values,true),{code:'FIXED_TERM',name:'Có thời hạn',description:null,isActive:true,sortOrder:10});
 const update=contractTypePayload({...values,code:' legacy / code ',isActive:false},false);
 assert.equal(Object.hasOwn(update,'code'),false);assert.equal(update.isActive,false);
 for(const patch of [{code:'bad code'},{code:'_BAD'},{code:'A'.repeat(31)},{name:''},{name:'A'.repeat(151)},{description:'A'.repeat(501)},{sortOrder:-1},{sortOrder:1.5},{sortOrder:''},{isActive:'true'}])assert.throws(()=>contractTypePayload({...values,...patch},true));
});
test('contract type permissions are independent of contracts and denied views never fetch',async()=>{
 const entry={platform:'WEB',code:'WEB_CONTRACT_TYPES',canView:'Y',canNew:'Y',canUpdate:'N',canDelete:'N'};
 assert.equal(contractTypeGrant('canNew',{permissions:[entry]}),true);
 assert.equal(contractTypeGrant('canUpdate',{permissions:[entry]}),false);
 assert.equal(contractTypeGrant('canView',{permissions:[{...entry,code:'WEB_CONTRACTS'}]}),false);
 const original=globalThis.fetch;let fetched=false;globalThis.fetch=()=>{fetched=true;};
 try{const root={innerHTML:''};await mountContractTypes(root);assert.match(root.innerHTML,/chưa có quyền/);assert.equal(fetched,false);}finally{globalThis.fetch=original;}
});
test('contract type API preserves encoded legacy codes and sends correct CRUD methods',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({code:'FIXED_TERM'})};};
 try{
  await apiContractTypes(new URLSearchParams({page:2,pageSize:30,search:'A & B',isActive:false}).toString());
  const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/contract-types');assert.equal(url.searchParams.get('search'),'A & B');assert.equal(url.searchParams.get('isActive'),'false');
  const code=' old / code ';
  await apiContractType(code);assert.ok(calls[1].url.endsWith('/api/contract-types/'+encodeURIComponent(code)));
  const create=contractTypePayload({code:'TEST',name:'Test',isActive:true,sortOrder:0},true);
  await apiSaveContractType(null,create);assert.equal(calls[2].options.method,'POST');assert.deepEqual(JSON.parse(calls[2].options.body),create);
  const update=contractTypePayload({name:'Updated',isActive:false,sortOrder:1});
  await apiSaveContractType(code,update);assert.equal(calls[3].options.method,'PUT');assert.ok(calls[3].url.endsWith(encodeURIComponent(code)));assert.equal(Object.hasOwn(JSON.parse(calls[3].options.body),'code'),false);
  await apiDeleteContractType(code);assert.equal(calls[4].options.method,'DELETE');
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Loại hợp đồng đang được sử dụng'})});
  await assert.rejects(apiDeleteContractType(code),err=>err.status===409&&err.message.includes('đang được sử dụng'));
 }finally{globalThis.fetch=original;}
});

test('permission menu retains a Contract Types entry even before backend registration without inventing grants',async()=>{
 const {roleScreenCatalog}=await import('../assets/js/pages/administration/roles.js');
 const screens=roleScreenCatalog([]),entry=screens[0];
 assert.equal(entry.code,'WEB_CONTRACT_TYPES');assert.equal(entry.name,'Loại hợp đồng');assert.equal(entry.registrationRequired,true);
 const menu=roleMenuGroups(screens).find(group=>group.name==='Administration');
 assert.equal(menu.subgroups[0].entries[0].code,'WEB_CONTRACT_TYPES');
 const registered=roleScreenCatalog([{id:10,code:'WEB_CONTRACT_TYPES',name:'Contract Type',platform:'WEB',isActive:true}]);
 assert.equal(registered.filter(screen=>screen.code==='WEB_CONTRACT_TYPES').length,1);assert.equal(registered[0].id,10);assert.equal(registered[0].name,'Loại hợp đồng');assert.equal(registered[0].registrationRequired,undefined);
});
test('screen registration uses screen API and does not assign any role permissions',async()=>{
 const {apiCreateScreen}=await import('../assets/js/api/client.js');const original=globalThis.fetch;const calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:10,code:'WEB_CONTRACT_TYPES'})};};
  const payload={code:'WEB_CONTRACT_TYPES',name:'Loại hợp đồng',platform:'WEB',isActive:true};
  await apiCreateScreen(payload);
  assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/api/screens'));assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),payload);
 }finally{globalThis.fetch=original;}
});

test('contract type prefix can be configured, preserved by omission, and explicitly cleared',()=>{
 const base={code:'FIXED',name:'Có thời hạn',isActive:true,sortOrder:0};
 assert.equal(contractTypePayload({...base,prefix:'HDLD'},true).prefix,'HDLD');
 const update=contractTypePayload({...base,prefix:'HD2026'});
 assert.equal(update.prefix,'HD2026');assert.equal(Object.hasOwn(update,'code'),false);
 assert.equal(Object.hasOwn(contractTypePayload(base),'prefix'),false);
 assert.equal(contractTypePayload({...base,prefix:null}).prefix,null);
 assert.equal(contractTypePayload({...base,prefix:'   '}).prefix,null);
 for(const prefix of ['hdld','1ABC','HD-LD','HĐ','A'.repeat(21)])assert.throws(()=>contractTypePayload({...base,prefix}),/Prefix/);
});
