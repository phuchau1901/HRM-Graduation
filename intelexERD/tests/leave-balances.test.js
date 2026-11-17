import test from 'node:test';
import assert from 'node:assert/strict';
import {leaveBalanceGrant,leaveBalanceList,leaveBalanceTotals,leaveBalanceGrantPayload,leaveBalanceRows,leaveBalanceOperationId,mountLeaveBalances,leaveBalanceLookupMatch,mountLeaveBalanceLookup} from '../assets/js/pages/human-resources/leave-balances.js';
import {apiLeaveBalances,apiGrantLeaveBalances,apiSaveLeaveBalance,apiAdjustLeaveBalance,apiLeaveBalanceHistory} from '../assets/js/api/client.js';
const row=()=>({id:1,employeeId:3,employeeName:'<Nhân viên>',employeeCode:'TX003',leaveTypeId:2,leaveTypeName:'Phép năm',year:2026,entitledDays:12,carriedOverDays:2,adjustmentDays:-1,usedDays:3,reservedDays:2,remainingDays:10,availableDays:8,version:4});
test('balance totals use granted plus carryover and adjustment, preserve reserved versus remaining',()=>{
 const response={success:true,data:[row()],total:1};assert.equal(leaveBalanceList(response),response);
 assert.deepEqual(leaveBalanceTotals(response.data),{total:13,used:3,remaining:10});assert.deepEqual(leaveBalanceTotals([]),{total:0,used:0,remaining:0});
 for(const invalid of [{...response,data:[{...row(),availableDays:'8'}]},{...response,total:-1},{...response,data:[{...row(),id:null}]}])assert.throws(()=>leaveBalanceList(invalid));
 const html=leaveBalanceRows([row()],true);assert.ok(html.includes('&lt;Nhân viên&gt;'));assert.ok(html.includes('TX003'));assert.ok(html.includes('data-balance-edit'));assert.ok(!leaveBalanceRows([row()],false).includes('data-balance-edit'));assert.ok(leaveBalanceRows([row()],false).includes('data-balance-history'));
});
test('balance permission never uses employee or settings grants and explicit SELF cannot write',async()=>{
 const grant={platform:'WEB',code:'WEB_LEAVE_BALANCES',canView:'Y',canUpdate:'Y',dataScopes:{UPDATE:'DEPARTMENT'}};
 assert.equal(leaveBalanceGrant('canUpdate',{permissions:[grant]}),true);
 assert.equal(leaveBalanceGrant('canUpdate',{permissions:[{...grant,dataScopes:{UPDATE:'SELF'}}]}),false);
 assert.equal(leaveBalanceGrant('canView',{permissions:[{...grant,code:'WEB_EMPLOYEES'}]}),false);
 const root={innerHTML:''};await mountLeaveBalances(root);assert.match(root.innerHTML,/chưa có quyền/);
});
test('batch payload includes only relevant target id and validates allocation, year and reason',()=>{
 const values={target:'EMPLOYEE',employeeId:'3',departmentId:'5',year:'2026',leaveTypeId:'2',entitledDays:'12.5',carriedOverDays:'0',reason:' Cấp phép '};
 const payload=leaveBalanceGrantPayload(values,'operation');assert.equal(payload.employeeId,3);assert.equal(payload.departmentId,undefined);assert.equal(payload.reason,'Cấp phép');assert.equal(payload.entitledDays,12.5);
 const all=leaveBalanceGrantPayload({...values,target:'ALL'},'operation');assert.equal(all.employeeId,undefined);assert.equal(all.departmentId,undefined);
 const department=leaveBalanceGrantPayload({...values,target:'DEPARTMENT'},'operation');assert.equal(department.departmentId,5);assert.equal(department.employeeId,undefined);
 for(const patch of [{reason:' '},{year:1899},{leaveTypeId:0},{target:'OTHER'},{employeeId:''},{entitledDays:-1},{entitledDays:1.234},{carriedOverDays:100000}])assert.throws(()=>leaveBalanceGrantPayload({...values,...patch},'operation'));
});
test('operation id remains a UUID without randomUUID on HTTP',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 try{Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:array=>{array.fill(23);return array;}}});assert.match(leaveBalanceOperationId(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);}finally{if(original)Object.defineProperty(globalThis,'crypto',original);else delete globalThis.crypto;}
});
test('balance APIs encode filters, use current versions and preserve operation ID without retrying conflicts',async()=>{
 const previous=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({success:true,data:[],total:0})};};
 await apiLeaveBalances({year:2026,page:2,pageSize:20,view:'ALL',search:'A & B',leaveTypeId:2,ignored:'no'});
 const url=new URL(calls[0].url);assert.equal(url.searchParams.get('search'),'A & B');assert.equal(url.searchParams.get('ignored'),null);assert.equal(calls[0].options.cache,'no-store');
 const grant={operationId:'same-id',target:'ALL',year:2026,leaveTypeId:2,entitledDays:12,carriedOverDays:0,reason:'Cấp'};
 await apiGrantLeaveBalances(grant);await apiGrantLeaveBalances(grant);assert.deepEqual(JSON.parse(calls[1].options.body),JSON.parse(calls[2].options.body));
 await apiSaveLeaveBalance({version:4,employeeId:3,reason:'Sửa'});assert.equal(calls[3].options.method,'PUT');assert.equal(JSON.parse(calls[3].options.body).version,4);
 await apiAdjustLeaveBalance(1,{version:4,days:-0.5,reason:'Giảm'});assert.ok(calls[4].url.endsWith('/api/leave-balances/1/adjustments'));assert.equal(calls[4].options.method,'POST');
 await apiLeaveBalanceHistory(1,2);assert.ok(calls[5].url.includes('/1/history?page=2'));
 let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status:409,json:async()=>({message:'Version changed'})};};await assert.rejects(apiAdjustLeaveBalance(1,{version:4,days:1,reason:'Sửa'}),/Version changed/);assert.equal(attempts,1);
 }finally{globalThis.fetch=previous;}
});

test('code lookup resolves real ids, clears stale selections and ignores outdated searches',async()=>{
 const employee={id:3,code:'TX003',name:'Nhân viên'},department={id:7,code:'IT',name:'Công nghệ thông tin'};
 assert.equal(leaveBalanceLookupMatch([employee],' tx003 '),employee);assert.equal(leaveBalanceLookupMatch([department],'it'),department);assert.equal(leaveBalanceLookupMatch([employee],'3'),null);
 const input={value:'',disabled:false,setCustomValidity(value){this.validityMessage=value;}},hidden={value:''},list={innerHTML:''},status={textContent:''};
 const form={isConnected:true,elements:{namedItem:()=>hidden},querySelector:selector=>selector.startsWith('[data-balance-lookup')?input:selector.startsWith('#balance-options')?list:status};
 let finishOld;
 mountLeaveBalanceLookup(form,'employeeId',query=>query==='OLD'?new Promise(resolve=>finishOld=resolve):Promise.resolve([employee]));
 input.value='OLD';const old=input.onfocus();input.value='TX003';await input.onfocus();assert.equal(hidden.value,3);assert.equal(status.textContent,'Nhân viên');
 finishOld([{id:99,code:'OLD',name:'Old'}]);await old;assert.equal(hidden.value,3);assert.ok(!list.innerHTML.includes('OLD'));
 input.value='TX0';input.oninput();assert.equal(hidden.value,'');assert.match(input.validityMessage,/Chọn một mục/);
 await input.onfocus();assert.equal(hidden.value,'');input.value='TX003';input.oninput();assert.equal(hidden.value,3);assert.equal(input.validityMessage,'');input.onkeydown({key:'ArrowDown',preventDefault(){}});input.onkeydown({key:'Enter',preventDefault(){}});
});

test('department lookup opens names on focus and keyboard selection stores the actual id',async()=>{
 const input={value:'',disabled:false,setCustomValidity(value){this.validityMessage=value;}},hidden={value:''},list={innerHTML:'',hidden:true},status={textContent:''};
 const form={isConnected:true,elements:{namedItem:()=>hidden},querySelector:selector=>selector.startsWith('[data-balance-lookup')?input:selector.startsWith('#balance-options')?list:status};
 mountLeaveBalanceLookup(form,'departmentId',async()=>[{id:7,code:'Công nghệ thông tin',name:'Công nghệ thông tin'},{id:8,code:'Nhân sự',name:'Nhân sự'}]);
 await input.onfocus();assert.equal(list.hidden,false);assert.ok(list.innerHTML.includes('Công nghệ thông tin'));assert.ok(list.innerHTML.includes('Nhân sự'));
 input.value='cong nghe';input.oninput();assert.ok(list.innerHTML.includes('Công nghệ thông tin'));assert.ok(!list.innerHTML.includes('Nhân sự'));
 input.onkeydown({key:'ArrowDown',preventDefault(){}});input.onkeydown({key:'Enter',preventDefault(){}});
 assert.equal(input.value,'Công nghệ thông tin');assert.equal(hidden.value,7);assert.equal(list.hidden,true);
});
