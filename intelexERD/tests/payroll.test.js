import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollGrant,payrollMoney,payrollMonth,payrollPageData,payrollObject,payrollAllRows,payrollOperationKey} from '../assets/js/pages/payroll/payroll-common.js';
import {salaryProfilePayload,salaryComponentPayload,salaryPolicyPayload,mountSalaryConfiguration} from '../assets/js/pages/payroll/salary-configuration.js';
import {payrollPeriodCapabilities,payrollPaymentPayload,payrollStatisticsMarkup,payrollPayslipMarkup,mountPayrollManagement} from '../assets/js/pages/payroll/payroll-management.js';
import {apiCompensationList,apiCompensationLookups,apiCompensationSave,apiPayrollDetail,apiPayrollAction,apiPayrollAdjustments,apiPayrollCancelAdjustment,apiPayrollPublishPolicy,apiPayrollStatistics,apiPayrollExport} from '../assets/js/api/client.js';
import {getPath,nav} from '../assets/js/router.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {roleScreenCatalog,roleMenuGroups,roleHasScopeAction} from '../assets/js/pages/administration/roles.js';
import {workflowRouteTypes,approvalSettingsPayload} from '../assets/js/pages/administration/system-settings/approval-workflow-settings.js';
const account=(code='WEB_PAYROLL',extra={})=>({permissions:[{platform:'WEB',code,canView:'Y',canNew:'Y',canUpdate:'Y',canApprove:'Y',canExport:'Y',...extra}]});
const components=[{id:2,isActive:true},{id:3,isActive:false}];
const profileValues={employeeId:'12',baseSalary:'20000000.25',allowanceAmount:'0',insuranceBase:'10000000',dependents:'1',kpiBonusAmount:'1000000',payBasis:'MONTH',currencyCode:'VND',effectiveFrom:'2026-10-01',effectiveTo:'',reason:'Quyết định đã duyệt'};
test('Payroll routes replace all three screen URLs and share the actual backend grants without legacy duplicates',()=>{
 const routes={WEB_PAYROLL:'/payroll/management',WEB_SALARY_PROFILES:'/payroll/configuration',WEB_SALARY_CONFIGURATION:'/payroll/configuration',WEB_TIMESHEETS:'/payroll/timesheets'};const previous=globalThis.location;try{for(const [code,path] of Object.entries(routes)){let redirect;globalThis.location={hash:'#/screens/'+code,replace:value=>redirect=value};assert.equal(getPath(),path);assert.equal(redirect,'#'+path);}}finally{globalThis.location=previous;}
 assert.deepEqual(screenRoutes['/payroll/management'],['WEB_PAYROLL']);assert.deepEqual(screenRoutes['/payroll/timesheets'],['WEB_PAYROLL']);assert.deepEqual(screenRoutes['/payroll/configuration'],['WEB_SALARY_CONFIGURATION']);assert.equal(nav.find(group=>group.name==='Payroll & Compensation').children.length,3);
 const entries=roleMenuGroups(roleScreenCatalog([{id:1,code:'WEB_PAYROLL',platform:'WEB'},{id:2,code:'WEB_SALARY_CONFIGURATION',platform:'WEB'},{id:3,code:'WEB_SALARY_PROFILES',platform:'WEB'},{id:4,code:'WEB_TIMESHEETS',platform:'WEB'}])).flatMap(group=>group.entries);assert.equal(entries.filter(item=>item.code==='WEB_PAYROLL').length,1);assert.ok(entries.some(item=>item.code==='WEB_SALARY_CONFIGURATION'));assert.ok(!entries.some(item=>['WEB_SALARY_PROFILES','WEB_TIMESHEETS'].includes(item.code)));
 for(const action of ['VIEW','NEW','UPDATE','APPROVE','EXPORT'])assert.equal(roleHasScopeAction('WEB_PAYROLL',action),true);assert.equal(roleHasScopeAction('WEB_PAYROLL','DELETE'),false);assert.equal(roleHasScopeAction('WEB_SALARY_CONFIGURATION','APPROVE'),false);
});
test('permission checks accept action-only login DTOs but honor known scopes and denied mounts never fetch',()=>{
 assert.equal(payrollGrant('WEB_PAYROLL','canNew',{session:account()}),true);assert.equal(payrollGrant('WEB_PAYROLL','canUpdate',{session:account('WEB_PAYROLL',{dataScopes:{UPDATE:'SELF'}})}),false);assert.equal(payrollGrant('WEB_PAYROLL','canUpdate',{global:true,session:account('WEB_PAYROLL',{dataScopes:{UPDATE:'DEPARTMENT'}})}),false);assert.equal(payrollGrant('WEB_PAYROLL','canExport',{session:account('WEB_PAYROLL',{dataScopes:{EXPORT:'SELF'}})}),true);assert.equal(payrollGrant('WEB_SALARY_CONFIGURATION','canView',{session:account('WEB_SALARY_PROFILES')}),false);
 const root={innerHTML:''};mountSalaryConfiguration(root);assert.match(root.innerHTML,/WEB_SALARY_CONFIGURATION/);mountPayrollManagement(root);assert.match(root.innerHTML,/WEB_PAYROLL/);
});
test('money and month validation rejects excess precision, negatives and invalid calendar keys',()=>{
 for(const value of ['0','1.25','1000000000000'])assert.equal(payrollMoney(value),Number(value));for(const value of ['',-1,'1.001','1000000000000.01','1e3','NaN'])assert.throws(()=>payrollMoney(value));assert.equal(payrollMonth('2026-10'),'2026-10');for(const value of ['2026-00','2026-13','1999-12','2101-01','2026-1'])assert.throws(()=>payrollMonth(value));
 const first=payrollOperationKey();assert.match(first,/^[A-Za-z0-9_-]{8,100}$/);assert.notEqual(payrollOperationKey(),first);
});
test('salary changes create a new profile with supersede ID/version and never overwrite legacy salary values',()=>{
 const payload=salaryProfilePayload(profileValues,[{componentId:'2',amount:'500000.50',prorate:true}],components);assert.equal(payload.employeeId,12);assert.equal(payload.items[0].amount,500000.5);assert.equal(payload.supersedeProfileId,null);assert.equal(payload.effectiveTo,null);
 const previous={id:7,employeeID:12,version:3,effectiveFrom:'2026-09-01',effectiveTo:null,baseSalary:15000000};const changed=salaryProfilePayload({...profileValues,employeeId:99},[],components,previous);assert.equal(changed.employeeId,12);assert.equal(changed.supersedeProfileId,7);assert.equal(changed.supersedeVersion,3);assert.equal(previous.baseSalary,15000000);assert.throws(()=>salaryProfilePayload({...profileValues,effectiveFrom:'2026-09-01'},[],components,previous));
 for(const items of [[{componentId:3,amount:1}],[{componentId:2,amount:1},{componentId:2,amount:2}]])assert.throws(()=>salaryProfilePayload(profileValues,items,components));assert.throws(()=>salaryProfilePayload({...profileValues,reason:''},[],components));assert.throws(()=>salaryProfilePayload({...profileValues,effectiveFrom:'2026-02-30'},[],components));
});
test('salary component identity and kinds are immutable; reserved engine codes and inconsistent flags are rejected',()=>{
 const values={code:'MEAL',name:'Phụ cấp ăn',kind:'EARNING',taxable:true,taxDeductible:false,overtimeIncluded:false,isActive:true};assert.equal(salaryComponentPayload(values).kind,'EARNING');assert.equal(salaryComponentPayload(values,{...values,version:2}).version,2);assert.throws(()=>salaryComponentPayload({...values,code:'OTHER'},{...values,version:2}));for(const code of ['BASE','INS_HEALTH','KPI'])assert.throws(()=>salaryComponentPayload({...values,code}));assert.throws(()=>salaryComponentPayload({...values,kind:'DEDUCTION'}));assert.throws(()=>salaryComponentPayload({...values,taxDeductible:true}));
});
test('policy publish configuration keeps payroll and existing workflow routes without modifying rules of published policies',()=>{
 assert.equal(workflowRouteTypes.PAYROLL_PERIOD,'Kỳ lương');assert.throws(()=>approvalSettingsPayload(1,[{requestType:'PAYROLL_PERIOD',allowSelfApproval:true,steps:[{approverType:'USER',employeeId:32}]}]));assert.throws(()=>approvalSettingsPayload(1,[{requestType:'PAYROLL_PERIOD',allowSelfApproval:false,steps:[{approverType:'TEAM_LEAD'}]}]));const routes=Object.keys(workflowRouteTypes).map(requestType=>({requestType,allowSelfApproval:false,steps:[{approverType:'USER',employeeId:32}]}));assert.equal(approvalSettingsPayload(2,routes).routes.length,routes.length);
 const values={code:'POLICY',name:'Chính sách',effectiveFrom:'2026-10-01',legalReference:'Quyết định'},rules={currencyCode:'VND',taxMode:'PROGRESSIVE',taxBrackets:[{upTo:100,rate:0.1},{upTo:null,rate:0.2}],insurance:[]};assert.equal(salaryPolicyPayload(values,rules).rules,rules);assert.throws(()=>salaryPolicyPayload(values,rules,{status:'PUBLISHED',version:2}));assert.throws(()=>salaryPolicyPayload(values,{...rules,taxBrackets:[{upTo:100,rate:0.1}]}));
});
test('period lifecycle gates calculation, submission, locks and payments; timesheet writes require global scope',()=>{
 const session=account();assert.equal(payrollPeriodCapabilities({status:'OPEN'}, {session}).calculate,true);assert.equal(payrollPeriodCapabilities({status:'REVIEW',inputHash:'verified'}, {session}).submit,true);assert.equal(payrollPeriodCapabilities({status:'REVIEW',inputHash:'verified',approvalId:9}, {session}).calculate,false);assert.equal(payrollPeriodCapabilities({status:'APPROVED'}, {session}).lock,true);assert.equal(payrollPeriodCapabilities({status:'LOCKED'}, {session}).paid,true);assert.equal(payrollPeriodCapabilities({status:'PAID'}, {session}).paid,false);
 const department=account('WEB_PAYROLL',{dataScopes:{NEW:'DEPARTMENT',UPDATE:'DEPARTMENT',APPROVE:'DEPARTMENT'}});assert.equal(payrollPeriodCapabilities({status:'OPEN'},{timesheets:true,session:department}).calculate,false);assert.equal(payrollPeriodCapabilities({status:'OPEN'},{session:department}).calculate,true);
});
test('payment uses Vietnamese offset, real reference and version and cannot predate lock or be in the future',()=>{
 const row={version:5,status:'LOCKED',lockedAt:'2020-01-01T00:00:00Z'};assert.deepEqual(payrollPaymentPayload({reference:' BANK-123 ',paidAt:'2020-01-02T12:00'},row),{version:5,reference:'BANK-123',paidAt:'2020-01-02T12:00:00+07:00'});for(const values of [{reference:'',paidAt:'2020-01-02T12:00'},{reference:'ABC',paidAt:'2099-01-02T12:00'},{reference:'ABC',paidAt:'2019-12-31T12:00'},{reference:'ABC',paidAt:'2020-02-30T12:00'}])assert.throws(()=>payrollPaymentPayload(values,row));
});
test('list/statistics do not replace failures with zero financial data; payslip lines are escaped',()=>{
 assert.throws(()=>payrollPageData({success:false,data:[]}));assert.throws(()=>payrollObject({success:false}));assert.ok(payrollStatisticsMarkup(null,'API offline').includes('API offline'));assert.equal((payrollStatisticsMarkup(null).match(/<strong>—<\/strong>/g)||[]).length,4);assert.throws(()=>payrollStatisticsMarkup({success:true,data:{employees:1,gross:'100',deductions:0,net:100}}));assert.ok(payrollStatisticsMarkup({success:true,data:{employees:0,gross:0,deductions:0,net:0,currencyCode:null}}).includes('<strong>0</strong>'));
 const html=payrollPayslipMarkup({row:{employeeName:'<script>',employeeCode:'TX0012',periodKey:'2026-10',status:'LOCKED',currencyCode:'VND'},result:{gross:100,net:90,lines:[{code:'BASE',name:'<img>',kind:'EARNING',amount:100,formula:'<script>'}]}});assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('TX0012'));
});
test('Payroll API uses scoped endpoints and correct verbs, body versions, stable calculation keys and original export bytes',async()=>{
 const previous=globalThis.fetch,calls=[];try{globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url,'https://example.invalid'),options});return {ok:true,json:async()=>({success:true,data:{id:1,version:2}}),blob:async()=>new Blob(['xlsx'],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})};};
 const filters={page:2,pageSize:20,periodKey:'2026-10',departmentId:4,search:'TX & IT',ignored:'no'};await apiCompensationList('payroll','payslips',filters);assert.equal(calls[0].url.pathname,'/api/payroll/payslips');assert.equal(calls[0].url.searchParams.get('search'),'TX & IT');assert.equal(calls[0].url.searchParams.has('ignored'),false);assert.equal(calls[0].options.cache,'no-store');
 await apiCompensationLookups('salary-configuration');await apiCompensationSave('salary-configuration','profiles',profileValues);assert.equal(calls[2].options.method,'POST');await apiCompensationSave('salary-configuration','components',{version:3},2);assert.equal(calls[3].options.method,'PUT');assert.throws(()=>apiCompensationSave('salary-configuration','profiles',{version:1},2));
 const calculation={version:3,requestKey:'operation_key_123',policyId:7};await apiPayrollAction('periods',1,'calculate',calculation);assert.deepEqual(JSON.parse(calls[4].options.body),calculation);await apiPayrollAction('timesheets',1,'lock',{version:4});assert.equal(calls[5].url.pathname,'/api/payroll/timesheets/1/lock');await apiPayrollDetail('timesheets',1);await apiPayrollAdjustments(1);await apiPayrollAdjustments(1,{employeeId:12,amount:100,requestKey:'adjustment_123'});assert.equal(calls[8].options.method,'POST');await apiPayrollCancelAdjustment(1,9,2);assert.deepEqual(JSON.parse(calls[9].options.body),{version:2});await apiPayrollPublishPolicy(2,{version:3,supersedePolicyId:1,supersedeVersion:2});assert.equal(calls[10].url.pathname,'/api/salary-configuration/policies/2/publish');await apiPayrollStatistics(filters);assert.equal(calls[11].url.searchParams.has('page'),false);const blob=await apiPayrollExport(filters);assert.equal(await blob.text(),'xlsx');assert.equal(calls[12].url.searchParams.has('page'),false);
 for(const status of [403,409,500]){let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status,json:async()=>({message:'Payroll failed'})};};await assert.rejects(apiPayrollAction('periods',1,'calculate',calculation),/Payroll failed/);assert.equal(attempts,1);}
 }finally{globalThis.fetch=previous;}
});
test('financial dropdown lists load every scoped page without using unrelated Employees permissions',async()=>{
 const previous=globalThis.fetch,calls=[];try{globalThis.fetch=async(url)=>{const query=new URL(url,'https://example.invalid');calls.push(query);return {ok:true,json:async()=>({success:true,total:2,data:[{id:Number(query.searchParams.get('page'))}]})};};assert.deepEqual((await payrollAllRows('salary-configuration','components')).map(item=>item.id),[1,2]);assert.equal(calls.length,2);assert.equal(calls[0].pathname,'/api/salary-configuration/components');assert.equal(calls[0].searchParams.get('pageSize'),'100');}finally{globalThis.fetch=previous;}
});

test('open timesheet explains missing UPDATE separately from APPROVE without granting access',async()=>{
 const {payrollTimesheetCalculateNotice}=await import('../assets/js/pages/payroll/payroll-management.js');
 const approvalOnly=account('WEB_PAYROLL',{canUpdate:'N',canApprove:'Y'});assert.match(payrollTimesheetCalculateNotice({status:'OPEN'},approvalOnly),/UPDATE/);assert.equal(payrollPeriodCapabilities({status:'OPEN'},{timesheets:true,session:approvalOnly}).calculate,false);assert.equal(payrollPeriodCapabilities({status:'OPEN'},{timesheets:true,session:approvalOnly}).lock,true);
 assert.match(payrollTimesheetCalculateNotice({status:'OPEN'},account('WEB_PAYROLL',{dataScopes:{UPDATE:'DEPARTMENT'}})),/ALL/);assert.equal(payrollTimesheetCalculateNotice({status:'OPEN'},account()),'');assert.equal(payrollTimesheetCalculateNotice({status:'LOCKED'},approvalOnly),'');
});

test('reconciliation uses employee codes from scoped lookup and translates attendance issues with Vietnamese dates',async()=>{
 const {payrollIssues,payrollIssueMessage}=await import('../assets/js/pages/payroll/payroll-common.js');
 const html=payrollIssues(JSON.stringify([{employeeId:33,message:'11/25/2026: incomplete attendance; request an adjustment before locking.'}]),[{id:33,employeeCode:'TX00033',fullName:'Nguyễn Văn A'}]);assert.ok(html.includes('Mã nhân viên: TX00033'));assert.ok(html.includes('Nguyễn Văn A'));assert.ok(html.includes('25/11/2026'));assert.ok(html.includes('Quên điểm danh'));assert.ok(!html.includes('Nhân viên #33'));assert.ok(!html.includes('incomplete attendance'));
 assert.match(payrollIssueMessage('2026-11-25: duplicate work schedules.'),/^25\/11\/2026: Có nhiều lịch làm việc/);assert.equal(payrollIssueMessage('2026-11-25: scheduled absence, no attendance recorded.'),'25/11/2026: scheduled absence, no attendance recorded.');assert.match(payrollIssueMessage('Overtime 8: approved quantity is missing.'),/tăng ca #8/);
 const direct=payrollIssues([{employeeId:33,employeeCode:'ITX025',message:'Thông báo tiếng Việt'}]);assert.ok(direct.includes('ITX025'));assert.ok(direct.includes('Thông báo tiếng Việt'));const missing=payrollIssues([{employeeId:33,message:'Dữ liệu cần kiểm tra'}]);assert.ok(missing.includes('chưa tải được mã'));assert.ok(!missing.includes('TX00033'));assert.ok(!missing.includes('#33'));
 assert.ok(payrollIssues([{employeeId:33,message:'<script>'}],[{id:33,employeeCode:'<img>',fullName:'<script>'}]).includes('&lt;img&gt;'));
});

test('repeated reconciliation guidance appears once above affected employees and dates',async()=>{
 const {payrollIssues}=await import('../assets/js/pages/payroll/payroll-common.js');
 const message='11/25/2026: incomplete attendance; request an adjustment before locking.';const html=payrollIssues([{employeeId:33,message},{employeeId:34,message},{employeeId:33,message:'11/24/2026: incomplete attendance; request an adjustment before locking.'}],[{id:33,employeeCode:'TX00033',fullName:'Nhân viên A'},{id:34,employeeCode:'TX00034',fullName:'Nhân viên B'}]);
 assert.equal((html.match(/Quên điểm danh/g)||[]).length,1);assert.equal((html.match(/<li>/g)||[]).length,3);assert.ok(html.includes('TX00033'));assert.ok(html.includes('TX00034'));assert.ok(html.includes('Ngày 25/11/2026'));assert.ok(html.includes('Ngày 24/11/2026'));assert.ok(html.indexOf('Quên điểm danh')<html.indexOf('TX00033'));assert.ok(html.includes('Cần đối soát (3)'));
});

test('no-attendance warnings use the exact day condition and show all affected codes/dates outside day detail',async()=>{
 const {payrollNoAttendanceWarnings,payrollNoAttendanceMarkup}=await import('../assets/js/pages/payroll/payroll-management.js');
 const day={date:'2026-11-25',scheduleId:1,workedMinutes:0,paidLeave:0,unpaidLeave:0};const row={employeeCode:'TX00033',fullName:'Nhân viên A',snapshotJson:JSON.stringify({employeeId:33,days:[day,{...day,date:'2026-11-24',payableWorkedMinutes:0},{...day,scheduleId:2}]})};
 const warnings=payrollNoAttendanceWarnings([row]);assert.equal(warnings.length,2);assert.equal(warnings[0].employeeCode,'TX00033');assert.equal(warnings[0].date,'2026-11-25');
 for(const patch of [{scheduleId:null},{scheduleId:undefined},{workedMinutes:1},{workedMinutes:undefined},{payableWorkedMinutes:1},{paidLeave:1},{paidLeave:undefined},{unpaidLeave:1}])assert.equal(payrollNoAttendanceWarnings([{...row,snapshotJson:JSON.stringify({days:[{...day,...patch}]})}]).length,0);
 const html=payrollNoAttendanceMarkup([row]);assert.ok(html.includes('Không chấm công (2)'));assert.ok(html.includes('TX00033'));assert.ok(html.includes('25/11/2026'));assert.ok(html.includes('24/11/2026'));assert.equal(payrollNoAttendanceMarkup([{...row,snapshotJson:null}]),'');assert.ok(payrollNoAttendanceMarkup([{...row,employeeCode:'<img>',fullName:'<script>'}]).includes('&lt;img&gt;'));
});

test('timesheet Excel exports scoped attendance rows rather than payroll payslips',async()=>{
 const {payrollTimesheetWorkbook}=await import('../assets/js/pages/payroll/payroll-management.js');
 const workbook=payrollTimesheetWorkbook('2026-11',[{employeeCode:'00033',fullName:'Nguyễn A & B',workedDays:12.5,paidLeaveDays:1,overtimeHours:2,lateMinutes:0},{employeeCode:'=1+1',fullName:'<Test>',workedDays:0}]);
 const xml=new TextDecoder().decode(workbook);assert.deepEqual([...workbook.slice(0,4)],[80,75,3,4]);
 assert.ok(xml.includes('Bảng công'));assert.ok(xml.includes('Nguyễn A &amp; B'));assert.ok(xml.includes('&lt;Test&gt;'));
 assert.ok(xml.includes('t xml:space="preserve">00033'));assert.ok(xml.includes('t xml:space="preserve">=1+1'));assert.ok(xml.includes('<v>12.5</v>'));assert.ok(xml.includes('<v>0</v>'));
 assert.throws(()=>payrollTimesheetWorkbook('2026-11',[]),/chưa có dữ liệu/);
});

test('payroll detail approval requires both grants, matching period and assigned pending step',async()=>{
 const {payrollApprovalCanDecide}=await import('../assets/js/pages/payroll/payroll-management.js');
 const session={...account(),user:{userId:'hr-reviewer'},permissions:[...account().permissions,{platform:'WEB',code:'WEB_APPROVALS',canView:'Y',canApprove:'Y'}]};
 const period={id:7,status:'REVIEW',approvalId:99},approval={request:{id:99,referenceId:7,requestType:'PAYROLL_PERIOD',requestedByUserId:'requester',status:'PENDING',currentStepNo:2,version:4},steps:[{stepNo:2,approverUserId:'hr-reviewer',decision:'PENDING'}]};
 assert.equal(payrollApprovalCanDecide(period,approval,session),true);
 assert.equal(payrollApprovalCanDecide({...period,status:'LOCKED'},approval,session),false);
 assert.equal(payrollApprovalCanDecide(period,{...approval,request:{...approval.request,referenceId:8}},session),false);
 assert.equal(payrollApprovalCanDecide(period,{...approval,request:{...approval.request,requestedByUserId:'hr-reviewer'}},session),false);
 assert.equal(payrollApprovalCanDecide(period,approval,{...session,user:{userId:'other'}}),false);
 assert.equal(payrollApprovalCanDecide(period,approval,{...session,permissions:session.permissions.filter(p=>p.code!=='WEB_APPROVALS')}),false);
 assert.equal(payrollApprovalCanDecide(period,{...approval,steps:[{...approval.steps[0],decision:'APPROVED'}]},session),false);
});
