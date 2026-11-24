import test from 'node:test';
import assert from 'node:assert/strict';
import {myPayslipRowValid,myPayslipPage,myPayslipDetail,mountMyPayslips} from '../assets/js/pages/my-workspace/my-payslips.js';
import {apiMyPayslips,apiMyPayslipDetail,apiMyPayslipPdf} from '../assets/js/api/client.js';
import {getPath,nav} from '../assets/js/router.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {roleHasScopeAction,roleMenuGroups,roleScreenCatalog} from '../assets/js/pages/administration/roles.js';
const account={user:{employeeId:12},permissions:[{platform:'WEB',code:'WEB_MY_PAYSLIPS',canView:'Y',canExport:'Y'}]};
const row=()=>({id:21,employeeId:12,employeeCode:'TX0012',employeeName:'Nhân viên',periodKey:'2026-10',status:'LOCKED',gross:10000000,deductions:1000000,net:9000000,currencyCode:'VND'});
test('personal payslip route/menu and role use WEB_MY_PAYSLIPS without data scopes or legacy duplicate',()=>{
 assert.deepEqual(screenRoutes['/workspace/payslips'],['WEB_MY_PAYSLIPS']);assert.ok(nav.find(group=>group.name==='My Workspace').children.some(([label,path])=>label==='My Payslips'&&path==='/workspace/payslips'));
 const previous=globalThis.location;try{let redirect;globalThis.location={hash:'#/screens/WEB_MY_PAYSLIPS',replace:value=>redirect=value};assert.equal(getPath(),'/workspace/payslips');assert.equal(redirect,'#/workspace/payslips');}finally{globalThis.location=previous;}
 const entries=roleMenuGroups(roleScreenCatalog([{id:9,code:'WEB_MY_PAYSLIPS',platform:'WEB'}])).find(group=>group.name==='My Workspace').entries.filter(entry=>entry.code==='WEB_MY_PAYSLIPS');assert.equal(entries.length,1);for(const action of ['VIEW','EXPORT','NEW','UPDATE'])assert.equal(roleHasScopeAction('WEB_MY_PAYSLIPS',action),false);
 const root={innerHTML:''};mountMyPayslips(root);assert.match(root.innerHTML,/WEB_MY_PAYSLIPS\/VIEW/);
});
test('personal payslips accept own locked/paid rows and actual zeros but reject another employee or unpublished data',()=>{
 assert.equal(myPayslipRowValid(row(),account),true);assert.equal(myPayslipRowValid({...row(),status:'PAID',net:0},account),true);const response={success:true,total:1,data:[row()]};assert.equal(myPayslipPage(response,account),response);
 for(const patch of [{employeeId:99},{status:'REVIEW'},{status:'OPEN'},{gross:'100'},{net:NaN},{currencyCode:''}])assert.throws(()=>myPayslipPage({...response,data:[{...row(),...patch}]},account));assert.equal(myPayslipRowValid(row(),{user:{employeeId:null}}),false);assert.throws(()=>myPayslipPage({success:false,data:[]},account));
});
test('own payslip detail never renders HR calculation snapshots and validates ownership',()=>{
 const data={row:row(),result:{lines:[],gross:10000000,net:9000000},snapshot:null};assert.equal(myPayslipDetail({success:true,data},account),data);assert.throws(()=>myPayslipDetail({success:true,data:{...data,snapshot:{profiles:[{baseSalary:999}]}}},account));assert.throws(()=>myPayslipDetail({success:true,data:{...data,row:{...row(),employeeId:99}}},account));
});
test('personal API whitelists month/status/paging and uses own detail and PDF endpoints only',async()=>{
 const previous=globalThis.fetch,calls=[];try{globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url,'https://example.invalid'),options});return {ok:true,json:async()=>({success:true,data:row()}),blob:async()=>new Blob(['%PDF-fixture'],{type:'application/pdf'})};};
 await apiMyPayslips({periodKey:'2026-10',status:'PAID',page:2,pageSize:20,employeeId:99,departmentId:4,teamId:9,search:'another'});assert.equal(calls[0].url.pathname,'/api/payslips/me');assert.equal(calls[0].url.searchParams.get('periodKey'),'2026-10');assert.equal(calls[0].url.searchParams.get('page'),'2');for(const key of ['employeeId','departmentId','teamId','search'])assert.equal(calls[0].url.searchParams.has(key),false);assert.equal(calls[0].options.cache,'no-store');
 await apiMyPayslipDetail(21);assert.equal(calls[1].url.pathname,'/api/payslips/me/21');const pdf=await apiMyPayslipPdf(21);assert.equal(calls[2].url.pathname,'/api/payslips/me/21/pdf');assert.equal(pdf.type,'application/pdf');assert.equal(await pdf.text(),'%PDF-fixture');assert.ok(calls.every(call=>!call.options.method||call.options.method==='GET'));
 }finally{globalThis.fetch=previous;}
});
