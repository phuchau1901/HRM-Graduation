import test from 'node:test';
import assert from 'node:assert/strict';
import {kpiEvaluationGrant,kpiEvaluationCapabilities,kpiEvaluationDetailData,kpiResultsComplete,kpiResultsPayload,kpiEvidenceUrl,kpiActualValue,kpiListData,kpiStatisticsMarkup,kpiResultsRows,mountKpiResults} from '../assets/js/pages/performance/kpi-results.js';
import {apiKpiEvaluations,apiKpiStatistics,apiKpiEvaluationAction,apiKpiEvaluationDetail,apiKpiEmployees,apiKpiLookups,apiKpiPeriods,apiKpiExport} from '../assets/js/api/client.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {nav,getPath} from '../assets/js/router.js';
import {roleMenuGroups,roleScreenCatalog,roleHasScopeAction} from '../assets/js/pages/administration/roles.js';
import {approvalSettingsPayload,workflowRouteTypes} from '../assets/js/pages/administration/system-settings/approval-workflow-settings.js';
const account=(id=12,extra={})=>({user:{employeeId:id},permissions:[{platform:'WEB',code:'WEB_KPI_EVALUATION',canView:'Y',canUpdate:'Y',canApprove:'Y',canExport:'Y',...extra}]});
const target=()=>({id:7,employeeId:12,employeeCode:'TX0012',employeeName:'<Nhân viên>',departmentName:'IT',teamName:'Core',periodKey:'2026-11',status:'IN_PROGRESS',finalScore:null,reviewerEmployeeId:32,version:3,approvalId:null});
const detail=()=>({target:target(),criteria:[{criterionId:1,metric:{code:'SALES',name:'Doanh số',unit:'VND',direction:'HIGHER',method:'RATIO',maxScore:100},weightPercent:100,targetValue:100000}],results:[{criterionID:1,actualValue:80000,selfScore:80,managerScore:null,comment:'Result',evidenceUrl:'https://example.com/evidence'}],isClosed:false,history:[]});
test('KPI evaluation grant and employee/reviewer ownership independently gate transitions',()=>{
 const data=detail();assert.deepEqual(kpiEvaluationCapabilities(data,account()),{start:false,edit:true,review:false});
 assert.equal(kpiEvaluationCapabilities({...data,target:{...data.target,status:'DRAFT'}},account()).start,true);
 assert.equal(kpiEvaluationCapabilities({...data,isClosed:true},account()).edit,false);assert.equal(kpiEvaluationCapabilities(data,account(99)).edit,false);assert.equal(kpiEvaluationCapabilities(data,account(12,{canUpdate:'N'})).edit,false);
 const submitted={...data,target:{...data.target,status:'SUBMITTED'}};assert.equal(kpiEvaluationCapabilities(submitted,account(32)).review,true);assert.equal(kpiEvaluationCapabilities(submitted,account(12)).review,false);assert.equal(kpiEvaluationCapabilities(submitted,account(32,{canApprove:'N'})).review,false);
 assert.equal(kpiEvaluationCapabilities({...submitted,target:{...submitted.target,reviewerEmployeeId:12}},account(12)).review,false);
 assert.equal(kpiEvaluationGrant('canView',account(12,{code:'WEB_KPI_RESULTS'})),false);assert.equal(kpiEvaluationGrant('canApprove',account(32)),true);
 const root={innerHTML:''};mountKpiResults(root);assert.match(root.innerHTML,/WEB_KPI_EVALUATION\/VIEW/);
});
test('detail handles server criterionID casing and requires results for every criterion before submit',()=>{
 const data=detail();assert.equal(kpiEvaluationDetailData({success:true,data}),data);assert.equal(kpiResultsComplete(data),true);assert.equal(kpiResultsComplete({...data,results:[]}),false);assert.equal(kpiResultsComplete({...data,results:[{criterionID:1,actualValue:0}]}),true);assert.equal(kpiResultsComplete({...data,results:[{criterionID:1,actualValue:null}]}),false);
 assert.throws(()=>kpiEvaluationDetailData({success:true,data:{...data,target:{...data.target,version:0}}}));assert.throws(()=>kpiEvaluationDetailData({success:true,data:{...data,criteria:[...data.criteria,...data.criteria]}}));
});
test('result save accepts partial values and zero, sends snapshot criterion ids only and no client scores',()=>{
 const data=detail(),payload=kpiResultsPayload(data,[{criterionId:1,actualValue:'0',weightPercent:999,selfScore:200,managerScore:200,comment:' Result ',evidenceUrl:'https://example.com/evidence'}]);
 assert.deepEqual(payload,{version:3,results:[{criterionId:1,actualValue:0,comment:'Result',evidenceUrl:'https://example.com/evidence'}]});
 assert.throws(()=>kpiResultsPayload(data,[{criterionId:999,actualValue:1}]),/Chỉ tiêu/);assert.throws(()=>kpiResultsPayload(data,[{criterionId:1,actualValue:1},{criterionId:1,actualValue:2}]),/trùng/);assert.throws(()=>kpiResultsPayload(data,[{criterionId:1,actualValue:''}]),/ít nhất/);
 const two={...data,criteria:[...data.criteria,{...data.criteria[0],criterionId:2}]};assert.equal(kpiResultsPayload(two,[{criterionId:1,actualValue:5},{criterionId:2,actualValue:''}]).results.length,1);
});
test('review requires all criteria and a manager comment without overwriting self evidence in payload',()=>{
 const data=detail(),payload=kpiResultsPayload(data,[{criterionId:1,actualValue:'90000',comment:'ignored',evidenceUrl:'ignored'}],{review:true,comment:' Checked '});assert.deepEqual(payload,{version:3,comment:'Checked',results:[{criterionId:1,actualValue:90000}]});
 assert.throws(()=>kpiResultsPayload(data,[{criterionId:1,actualValue:90}],{review:true,comment:''}),/Nhận xét/);
 assert.throws(()=>kpiResultsPayload({...data,criteria:[...data.criteria,{...data.criteria[0],criterionId:2}]},[{criterionId:1,actualValue:90}],{review:true,comment:'Checked'}),/đủ/);
});
test('numeric precision and evidence validate real links without fetching or accepting credentials',()=>{
 for(const value of ['0','1.1234','999999999999'])assert.equal(kpiActualValue(value),Number(value));for(const value of ['',-1,'1.12345','NaN',Infinity,'1000000000000'])assert.throws(()=>kpiActualValue(value));
 assert.equal(kpiEvidenceUrl(' https://example.com/a '),'https://example.com/a');assert.equal(kpiEvidenceUrl('http://example.com/a'),'http://example.com/a');assert.equal(kpiEvidenceUrl(''),null);
 for(const value of ['javascript:alert(1)','https://user:pass@example.com/','data:text/html,test','not-url','https://example.com/'+ 'a'.repeat(2000)])assert.throws(()=>kpiEvidenceUrl(value));
});
test('list and statistics preserve null scores and real zeros; API failures do not become zero metrics',()=>{
 const response={success:true,total:1,data:[target()]};assert.equal(kpiListData(response),response);const html=kpiResultsRows(response.data);assert.ok(html.includes('&lt;Nhân viên&gt;'));assert.ok(html.includes('TX0012'));assert.ok(html.includes('>—</td>'));
 const stats=kpiStatisticsMarkup({success:true,data:{total:2,statuses:[{status:'SUBMITTED',count:2}],averageScore:null}});assert.ok(stats.includes('<strong>2</strong>'));assert.ok(stats.includes('<strong>—</strong>'));
 const error=kpiStatisticsMarkup(null,'offline');assert.equal((error.match(/<strong>—<\/strong>/g)||[]).length,5);assert.ok(!error.includes('<strong>0</strong>'));
 assert.throws(()=>kpiListData({...response,data:[{...target(),finalScore:'80'}]}));
});
test('KPI Results has a conventional route, canonical evaluation permission and independent action scopes',()=>{
 assert.deepEqual(screenRoutes['/performance/kpi-results'],['WEB_KPI_EVALUATION']);assert.ok(nav.find(group=>group.name==='Performance Management').children.some(([,path])=>path==='/performance/kpi-results'));
 const groups=roleMenuGroups(roleScreenCatalog([{id:9,code:'WEB_KPI_EVALUATION',name:'Đánh giá',platform:'WEB'},{id:10,code:'WEB_KPI_RESULTS',name:'Old results',platform:'WEB'}]));assert.equal(groups.find(group=>group.name==='Performance Management').entries.find(item=>item.code==='WEB_KPI_EVALUATION').id,9);assert.ok(!groups.flatMap(group=>group.entries).some(item=>item.code==='WEB_KPI_RESULTS'));
 for(const action of ['VIEW','UPDATE','APPROVE','EXPORT'])assert.equal(roleHasScopeAction('WEB_KPI_EVALUATION',action),true);assert.equal(roleHasScopeAction('WEB_KPI_EVALUATION','NEW'),false);
 const previous=globalThis.location,calls=[];try{globalThis.location={hash:'#/screens/WEB_KPI_RESULTS',replace:value=>calls.push(value)};assert.equal(getPath(),'/performance/kpi-results');assert.deepEqual(calls,['#/performance/kpi-results']);}finally{globalThis.location=previous;}
});
test('approval settings preserve KPI_EVALUATION alongside all existing routes',()=>{
 assert.equal(workflowRouteTypes.KPI_EVALUATION,'Đánh giá KPI');const routes=Object.keys(workflowRouteTypes).map(requestType=>({requestType,allowSelfApproval:false,steps:[{approverType:'USER',employeeId:32}]}));const payload=approvalSettingsPayload(3,routes);assert.equal(payload.routes.length,Object.keys(workflowRouteTypes).length);assert.equal(payload.routes[4].requestType,'KPI_EVALUATION');
});
test('KPI API uses evaluation-scoped lookups/list and body version, never automatically retries decisions',async()=>{
 const original=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,options)=>{calls.push({url:new URL(url),options});return {ok:true,json:async()=>({success:true,data:[],total:0})};};
 const filters={periodId:3,departmentId:4,teamId:5,employeeId:12,status:'SUBMITTED',search:'A & B',page:2,pageSize:20,ignored:'no'};await apiKpiEvaluations(filters);await apiKpiStatistics(filters);await apiKpiLookups();await apiKpiPeriods(2);await apiKpiEmployees('TX0012',2);await apiKpiEvaluationDetail(7);
 assert.equal(calls[0].url.pathname,'/api/kpi/evaluations');assert.equal(calls[0].url.searchParams.get('search'),'A & B');assert.equal(calls[0].url.searchParams.get('ignored'),null);assert.equal(calls[1].url.searchParams.get('page'),null);assert.equal(calls[2].url.pathname,'/api/kpi/evaluations/lookups');assert.equal(calls[3].url.searchParams.get('page'),'2');assert.equal(calls[4].url.pathname,'/api/kpi/evaluations/employees');assert.equal(calls[4].url.searchParams.get('search'),'TX0012');assert.equal(calls[5].url.pathname,'/api/kpi/evaluations/7');
 for(const action of ['start','results','submit','review']){await apiKpiEvaluationAction(7,action,{version:3,results:[]});const call=calls.at(-1);assert.ok(call.url.pathname.endsWith('/'+action));assert.equal(call.options.method,action==='results'?'PUT':'POST');assert.equal(JSON.parse(call.options.body).version,3);assert.equal(call.options.headers.has('If-Match'),false);}
 assert.throws(()=>apiKpiEvaluationAction(7,'approve',{version:3}));assert.throws(()=>apiKpiEvaluationAction(7,'review',{version:0}));
 let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status:409,json:async()=>({message:'KPI changed'})};};await assert.rejects(apiKpiEvaluationAction(7,'review',{version:3}),/changed/);assert.equal(attempts,1);
 }finally{globalThis.fetch=original;}
});
test('KPI Excel export keeps filters, excludes pagination and downloads original XLSX bytes',async()=>{
 const original=globalThis.fetch;try{let url;const blob=new Blob(['PK-Excel']);globalThis.fetch=async value=>{url=new URL(value);return {ok:true,blob:async()=>blob,json:async()=>{throw Error('binary');}};};assert.equal(await apiKpiExport({periodId:3,departmentId:4,status:'APPROVED',page:4,pageSize:20}),blob);assert.equal(url.pathname,'/api/kpi/evaluations/export');assert.equal(url.searchParams.get('periodId'),'3');assert.equal(url.searchParams.get('page'),null);
 }finally{globalThis.fetch=original;}
});

test('KPI deep links parse the evaluation ID only on the results route',async()=>{
 const {kpiRequestedEvaluationId}=await import('../assets/js/pages/performance/kpi-results.js');
 assert.equal(kpiRequestedEvaluationId('#/performance/kpi-results?evaluationId=11'),11);assert.equal(kpiRequestedEvaluationId('#/performance/kpi-results?status=REVIEWED&evaluationId=12'),12);
 for(const hash of ['#/performance/kpi-results?evaluationId=0','#/performance/kpi-results?evaluationId=-1','#/performance/kpi-results?evaluationId=1.5','#/performance/kpi-results?evaluationId=9007199254740992','#/performance/kpi-results?evaluationId=bad','#/performance/kpi-templates?evaluationId=11','#/performance/kpi-results'])assert.equal(kpiRequestedEvaluationId(hash),null);
});
test('approval KPI link uses referenceId instead of approval ID and requires evaluation VIEW',async()=>{
 const {workflowKpiDetailLink,workflowRows}=await import('../assets/js/pages/approval-center/approvals.js');
 const session=account(),item={id:99,referenceId:11,requestType:'KPI_EVALUATION'};assert.match(workflowKpiDetailLink(item,session),/kpi-results\?evaluationId=11/);assert.ok(!workflowKpiDetailLink(item,session).includes('evaluationId=99'));assert.equal(workflowKpiDetailLink({...item,referenceId:null},session),'');assert.equal(workflowKpiDetailLink({...item,referenceId:'bad'},session),'');assert.equal(workflowKpiDetailLink({...item,requestType:'LEAVE'},session),'');assert.equal(workflowKpiDetailLink(item,account(12,{canView:'N'})),'');assert.equal(workflowKpiDetailLink(item,{permissions:[]}),'');assert.match(workflowRows('all',[item],session),/KPI/);
});

test('KPI workflow decision requires both grants, assigned pending step, correct reference and prevents self approval',async()=>{
 const {kpiApprovalCanDecide}=await import('../assets/js/pages/performance/kpi-results.js');
 const session={user:{userId:'approver',employeeId:32},permissions:[{platform:'WEB',code:'WEB_APPROVALS',canView:'Y',canApprove:'Y'},{platform:'WEB',code:'WEB_KPI_EVALUATION',canView:'Y',canApprove:'Y'}]},data={...detail(),target:{...target(),status:'REVIEWED',approvalId:99}},approval={request:{id:99,referenceId:7,requestType:'KPI_EVALUATION',status:'PENDING',currentStepNo:2,version:4},steps:[{stepNo:1,approverUserId:'previous',decision:'APPROVED'},{stepNo:2,approverUserId:'approver',decision:'PENDING'}]};
 assert.equal(kpiApprovalCanDecide(data,approval,session),true);
 for(const request of [{...approval.request,id:7},{...approval.request,referenceId:99},{...approval.request,requestType:'LEAVE'},{...approval.request,status:'APPROVED'},{...approval.request,currentStepNo:1},{...approval.request,version:0}])assert.equal(kpiApprovalCanDecide(data,{...approval,request},session),false);
 assert.equal(kpiApprovalCanDecide({...data,isClosed:true},approval,session),false);assert.equal(kpiApprovalCanDecide({...data,target:{...data.target,status:'SUBMITTED'}},approval,session),false);assert.equal(kpiApprovalCanDecide(data,approval,{...session,user:{...session.user,employeeId:12}}),false);assert.equal(kpiApprovalCanDecide(data,approval,{...session,user:{userId:'other',employeeId:33}}),false);
 for(const code of ['WEB_APPROVALS','WEB_KPI_EVALUATION'])assert.equal(kpiApprovalCanDecide(data,approval,{...session,permissions:session.permissions.map(p=>p.code===code?{...p,canApprove:'N'}:p)}),false);
});

test('KPI approval has one Detail link that goes straight to KPI; other requests keep workflow detail',async()=>{
 const {workflowRows}=await import('../assets/js/pages/approval-center/approvals.js');
 const session=account(),item={id:99,referenceId:11,requestType:'KPI_EVALUATION'};const html=workflowRows('all',[item],session);
 assert.match(html,/href="#\/performance\/kpi-results\?evaluationId=11">Chi tiết<\/a>/);assert.ok(!html.includes('data-workflow-detail='));assert.ok(!html.includes('Xem chi tiết KPI'));assert.equal((html.match(/>Chi tiết</g)||[]).length,1);
 assert.match(workflowRows('all',[{id:1,requestType:'LEAVE'}],session),/data-workflow-detail="0"/);assert.ok(!workflowRows('all',[item],{permissions:[]}).includes('href='));
});
