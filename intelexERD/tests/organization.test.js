import test from 'node:test';
import assert from 'node:assert/strict';
import {apiOrganizationTree,apiOrganizationMembers} from '../assets/js/api/client.js';
import {mountOrganization} from '../assets/js/pages/organization.js';
import {screenRoutes} from '../assets/js/permissions.js';

test('organization tree and lazy member endpoints use no-store, pagination and cancellation',async()=>{
 const calls=[];const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url,'http://local'),options});return {ok:true,json:async()=>[]};};
 try{
  const controller=new AbortController();
  await apiOrganizationTree(controller.signal);
  await apiOrganizationMembers('team',7,3,controller.signal);
  await apiOrganizationMembers('unassigned',2,1,controller.signal);
  assert.equal(calls[0].url.pathname,'/api/organization/tree');
  assert.equal(calls[1].url.pathname,'/api/teams/7/members');
  assert.equal(calls[1].url.searchParams.get('page'),'3');
  assert.equal(calls[1].url.searchParams.get('pageSize'),'20');
  assert.equal(calls[2].url.pathname,'/api/departments/2/unassigned-members');
  for(const call of calls){assert.equal(call.options.cache,'no-store');assert.equal(call.options.signal,controller.signal);}
  assert.throws(()=>apiOrganizationMembers('other',1),/không hợp lệ/);
 }finally{globalThis.fetch=original;}
});
test('organization requires its own view grant and denied mount never fetches',()=>{
 assert.deepEqual(screenRoutes['/hr/organization'],['WEB_ORGANIZATION']);
 const original=globalThis.fetch;let fetched=false;
 globalThis.fetch=()=>{fetched=true;throw Error('must not fetch');};
 try{const root={innerHTML:''};const dispose=mountOrganization(root);assert.match(root.innerHTML,/chưa có quyền/);assert.equal(fetched,false);dispose();}finally{globalThis.fetch=original;}
});

test('organization search matches department or team names without accents and respects type',async()=>{
 const {organizationMatches}=await import('../assets/js/pages/organization.js');
 const department={departmentName:'Phòng Kỹ thuật',teams:[{teamName:'Đội phát triển'},{teamName:'QA'}]};
 assert.equal(organizationMatches(department,'ky thuat').departmentMatch,true);
 assert.deepEqual(organizationMatches(department,'doi phat').teams,[true,false]);
 assert.equal(organizationMatches(department,'QA','department').visible,false);
 assert.equal(organizationMatches(department,'ky thuat','team').visible,false);
 assert.equal(organizationMatches(department,'  qa  ','team').visible,true);
 assert.equal(organizationMatches(department,'Sales').visible,false);
 assert.equal(organizationMatches(department,'').visible,true);
});
