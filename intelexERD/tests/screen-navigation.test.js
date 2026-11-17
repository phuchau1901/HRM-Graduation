import test from 'node:test';
import assert from 'node:assert/strict';
import {screenNavigationGroup,screenNavigationLabel,navigationForScreens} from '../assets/js/screen-navigation.js';
import {nav,mainNavigation,groupFor,isKnown,getPath} from '../assets/js/router.js';
import {screenAllowed,screenRoutes} from '../assets/js/permissions.js';
import {roleMenuGroups} from '../assets/js/pages/administration/roles.js';
import {login,apiLogout} from '../assets/js/api/client.js';

test('payroll and performance screens move into their own groups without duplicate existing screens',()=>{
 const catalog=[{id:1,code:'WEB_SALARY_PROFILES',name:'Thiết lập lương nhân viên',platform:'WEB'},{id:2,code:'WEB_PAYROLL_PERIODS',name:'Quản lý bảng lương',platform:'WEB'},{id:3,code:'WEB_KPI_TEMPLATES',name:'Thiết lập KPI',platform:'WEB'},{id:4,code:'WEB_KPI_RESULTS',name:'Đánh giá KPI',platform:'WEB'},{id:5,code:'WEB_TEAM_MEMBERS',name:'Thành viên team',platform:'WEB'},{id:6,code:'WEB_CUSTOM',name:'Tùy chỉnh',platform:'WEB'}];
 const groups=roleMenuGroups(catalog);
 assert.deepEqual(groups.find(group=>group.name==='Payroll & Compensation').entries.map(item=>item.id),[1,2]);
 assert.deepEqual(groups.find(group=>group.name==='Performance Management').entries.map(item=>item.id),[3,4]);
 assert.ok(!groups.some(group=>group.name==='Màn hình khác'));assert.equal(groups.flatMap(group=>group.entries).length,catalog.length);
 const menu=navigationForScreens(nav,catalog);assert.ok(!menu.find(group=>group.name==='Team Management').children.some(([,route])=>route==='/screens/WEB_TEAM_MEMBERS'));
 assert.equal(screenNavigationGroup('WEB_EMPLOYEE_SALARIES').name,'Payroll & Compensation');assert.equal(screenNavigationLabel({code:'WEB_KPI_RESULTS'}),'Đánh giá KPI');
});
test('main menu and direct navigation use VIEW grants for each actual backend screen code',async()=>{
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async()=>({ok:true,json:async()=>({accessToken:'navigation-test',user:{userId:'viewer'},permissions:[{platform:'WEB',code:'WEB_SALARY_PROFILES',canView:'Y',canUpdate:'N'},{platform:'WEB',code:'WEB_KPI_TEMPLATES',canView:'N',canUpdate:'Y'}],roles:[],expiresAtUtc:'2099-01-01T00:00:00Z'})});
  await login('viewer','test');
  const menu=mainNavigation(),salary='/screens/WEB_SALARY_PROFILES',kpi='/screens/WEB_KPI_TEMPLATES';
  assert.ok(menu.find(group=>group.name==='Payroll & Compensation').children.some(([,path])=>path===salary));
  assert.equal(screenAllowed(salary),true);assert.equal(screenAllowed(salary,'canUpdate'),false);assert.equal(screenAllowed(kpi),false);
  assert.equal(groupFor(salary).name,'Payroll & Compensation');assert.equal(isKnown(salary),true);assert.equal(screenAllowed('/screens/WEB_UNKNOWN'),false);
 }finally{apiLogout();globalThis.fetch=previous;}
});
test('role groups preserve MOBILE screen identity and separate platforms',()=>{
 const catalog=[{id:1,code:'WEB_PAYROLL',name:'Web payroll',platform:'WEB'},{id:2,code:'MOBILE_PAYROLL',name:'Mobile payroll',platform:'MOBILE'}];
 assert.deepEqual(roleMenuGroups(catalog,'WEB').flatMap(group=>group.entries.map(item=>item.id)),[1]);assert.deepEqual(roleMenuGroups(catalog,'MOBILE').flatMap(group=>group.entries.map(item=>item.id)),[2]);
});

test('leave balances belongs to hr leave with no duplicate dynamic menu and old link resolves there',()=>{
 assert.deepEqual(screenRoutes['/hr/leave'],['WEB_LEAVE_BALANCES']);
 const menu=navigationForScreens(nav,[{code:'WEB_LEAVE_BALANCES',platform:'WEB',canView:'Y'},{code:'WEB_LEAVE',platform:'WEB',canView:'Y'}]);
 const links=menu.flatMap(group=>group.children||[]);
 assert.ok(links.some(([label,path])=>label==='Leave Management'&&path==='/hr/leave'));
 assert.ok(!links.some(([,path])=>path==='/screens/WEB_LEAVE_BALANCES'||path==='/screens/WEB_LEAVE'));
 const previous=globalThis.location;
 try{globalThis.location={hash:'#/screens/WEB_LEAVE_BALANCES'};assert.equal(getPath(),'/hr/leave');globalThis.location.hash='#/screens/WEB_LEAVE';assert.equal(getPath(),'/hr/leave');}finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}
});

test('old My Leave link redirects to workspace leave without adding a duplicate menu',()=>{
 const links=navigationForScreens(nav,[{code:'WEB_MY_LEAVE',platform:'WEB'},{code:'WEB_LEAVE_MANAGEMENT',platform:'WEB'}]).flatMap(group=>group.children||[]);
 assert.ok(!links.some(([,path])=>path==='/screens/WEB_MY_LEAVE'||path==='/screens/WEB_LEAVE_MANAGEMENT'));
 const previous=globalThis.location,calls=[];
 try{globalThis.location={hash:'#/screens/WEB_MY_LEAVE',replace:value=>calls.push(value)};assert.equal(getPath(),'/workspace/leave');assert.deepEqual(calls,['#/workspace/leave']);globalThis.location.hash='#/screens/WEB_LEAVE_MANAGEMENT';assert.equal(getPath(),'/workspace/leave');}finally{if(previous===undefined)delete globalThis.location;else globalThis.location=previous;}
});
