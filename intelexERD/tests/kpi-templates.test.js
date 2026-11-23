import test from 'node:test';
import assert from 'node:assert/strict';
import {kpiConfigurationGrant,kpiConfigurationCanEdit,kpiTemplatePayload,kpiMetricPayload,kpiAssignmentPayload,mountKpiTemplates} from '../assets/js/pages/performance/kpi-templates.js';
import {apiKpiConfigurationList,apiKpiConfigurationLookups,apiKpiTemplateDetail,apiKpiConfigurationSave,apiKpiConfigurationAction} from '../assets/js/api/client.js';
import {screenRoutes} from '../assets/js/permissions.js';
import {getPath,nav} from '../assets/js/router.js';
import {roleScreenCatalog,roleMenuGroups,roleHasScopeAction} from '../assets/js/pages/administration/roles.js';
const configAccount=(scope='ALL',patch={})=>({permissions:[{platform:'WEB',code:'WEB_KPI_CONFIGURATION',canView:'Y',canNew:'Y',canUpdate:'Y',dataScopes:{NEW:scope,UPDATE:scope},...patch}]});
const configMetrics=[{id:1,code:'SALES',isActive:true,method:'RATIO'},{id:2,code:'QUALITY',isActive:true,method:'DIRECT'},{id:3,isActive:false}];
const templateValues={code:'SALES_V1',name:'Sales tháng',periodType:'MONTH',departmentId:'4',version:2};
const configCriteria=[{metricId:1,weightPercent:'66.67',targetValue:'100.1234'},{metricId:2,weightPercent:'33.33',targetValue:0}];
test('configuration uses canonical grant, action scopes and immutable published templates',()=>{
 assert.equal(kpiConfigurationGrant('canNew',true,configAccount()),true);assert.equal(kpiConfigurationGrant('canNew',true,configAccount('DEPARTMENT')),false);assert.equal(kpiConfigurationGrant('canNew',false,configAccount('SELF')),false);assert.equal(kpiConfigurationGrant('canView',false,configAccount('SELF')),true);assert.equal(kpiConfigurationGrant('canNew',false,configAccount('ALL',{code:'WEB_KPI_TEMPLATES'})),false);
 const org={departments:[{id:4}],teams:[{id:9,departmentId:4}]};assert.equal(kpiConfigurationCanEdit({status:'DRAFT',departmentId:4},org,configAccount('DEPARTMENT')),true);assert.equal(kpiConfigurationCanEdit({status:'DRAFT',teamId:9},org,configAccount('DEPARTMENT')),true);assert.equal(kpiConfigurationCanEdit({status:'DRAFT'},org,configAccount('DEPARTMENT')),false);assert.equal(kpiConfigurationCanEdit({status:'PUBLISHED'},org,configAccount()),false);
 const root={innerHTML:''};mountKpiTemplates(root);assert.match(root.innerHTML,/WEB_KPI_CONFIGURATION\/VIEW/);
});
test('template validates exact weights, unique active metrics, applicability and four-place targets',()=>{
 const payload=kpiTemplatePayload(templateValues,configCriteria,configMetrics);assert.equal(payload.criteria.length,2);assert.equal(payload.departmentId,4);assert.equal(payload.teamId,null);assert.equal(payload.version,2);
 for(const criteria of [[],[...configCriteria,configCriteria[0]],[{metricId:3,weightPercent:100,targetValue:1}],[{metricId:1,weightPercent:100,targetValue:0}],[{metricId:1,weightPercent:99.99,targetValue:1}],[{metricId:1,weightPercent:100,targetValue:'1.12345'}],[{metricId:1,weightPercent:'100.001',targetValue:1}]])assert.throws(()=>kpiTemplatePayload(templateValues,criteria,configMetrics));
 assert.throws(()=>kpiTemplatePayload({...templateValues,teamId:9},configCriteria,configMetrics),/một phạm vi/);assert.throws(()=>kpiTemplatePayload({...templateValues,code:'bad-code'},configCriteria,configMetrics));
});
test('metrics derive valid method pairs and validate milestone order without client score formulas',()=>{
 const values={code:'SALES',name:'Sales',unit:'VND',direction:'HIGHER',maxScore:100,isActive:true,version:3};assert.equal(kpiMetricPayload(values,[]).method,'RATIO');assert.equal(kpiMetricPayload({...values,direction:'QUALITATIVE'},[]).method,'DIRECT');assert.equal(kpiMetricPayload(values,[]).source,'MANUAL');
 assert.deepEqual(kpiMetricPayload({...values,direction:'MILESTONE'},[{threshold:20,score:100},{threshold:10,score:40}]).milestones,[{threshold:10,score:40},{threshold:20,score:100}]);
 for(const milestones of [[],[{threshold:10,score:40},{threshold:10,score:100}],[{threshold:10,score:100},{threshold:20,score:40}],[{threshold:10,score:101}]])assert.throws(()=>kpiMetricPayload({...values,direction:'MILESTONE'},milestones));
});
test('assignment enforces open matching period, reviewer separation and earlier source without client scope expansion',()=>{
 const periods=[{id:1,periodType:'MONTH',startDate:'2026-11-01',endDate:'2026-11-30',isClosed:false},{id:2,periodType:'MONTH',startDate:'2026-10-01',endDate:'2026-10-31',isClosed:true}];const templates=[{id:7,status:'PUBLISHED',periodType:'MONTH'}];const values={periodId:1,templateId:7,target:'EMPLOYEE',reviewerEmployeeId:32,alternateReviewerEmployeeId:33,copyFromPeriodId:2};
 const payload=kpiAssignmentPayload(values,[12,13],periods,templates);assert.deepEqual(payload.employeeIds,[12,13]);assert.equal(payload.copyFromPeriodId,2);assert.equal(payload.alternateReviewerEmployeeId,33);assert.equal(payload.departmentId,null);
 for(const patch of [{periodId:2},{copyFromPeriodId:1},{alternateReviewerEmployeeId:32},{reviewerEmployeeId:''}])assert.throws(()=>kpiAssignmentPayload({...values,...patch},[12],periods,templates));assert.throws(()=>kpiAssignmentPayload(values,[],periods,templates));assert.throws(()=>kpiAssignmentPayload(values,[12],periods,[{...templates[0],status:'DRAFT'}]));assert.equal(kpiAssignmentPayload({...values,target:'ALL'},[],periods,templates).target,'ALL');
});
test('template path redirects old codes and role exposes canonical configuration with scopes only once',()=>{
 assert.deepEqual(screenRoutes['/performance/kpi-templates'],['WEB_KPI_CONFIGURATION']);assert.ok(nav.find(group=>group.name==='Performance Management').children.some(([label,path])=>label==='KPI Templates'&&path==='/performance/kpi-templates'));
 const entries=roleMenuGroups(roleScreenCatalog([{id:1,code:'WEB_KPI_TEMPLATES',platform:'WEB'},{id:2,code:'WEB_KPI_CONFIGURATION',platform:'WEB'}])).flatMap(group=>group.entries);assert.equal(entries.filter(item=>item.code==='WEB_KPI_CONFIGURATION').length,1);assert.ok(!entries.some(item=>item.code==='WEB_KPI_TEMPLATES'));
 for(const action of ['VIEW','NEW','UPDATE'])assert.equal(roleHasScopeAction('WEB_KPI_CONFIGURATION',action),true);assert.equal(roleHasScopeAction('WEB_KPI_CONFIGURATION','APPROVE'),false);
 const previous=globalThis.location;try{for(const code of ['WEB_KPI_TEMPLATES','WEB_KPI_CONFIGURATION']){let redirect;globalThis.location={hash:'#/screens/'+code,replace:value=>redirect=value};assert.equal(getPath(),'/performance/kpi-templates');assert.equal(redirect,'#/performance/kpi-templates');}}finally{globalThis.location=previous;}
});
test('configuration APIs use real endpoints, numeric versions and never replay conflicts',async()=>{
 const previous=globalThis.fetch,calls=[];try{globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({success:true,data:[]})};};
 await apiKpiConfigurationList('templates',{page:2,pageSize:20,search:'Sales & IT',employeeId:999});const url=new URL(calls[0].url,'https://example.invalid');assert.equal(url.pathname,'/api/kpi/configuration/templates');assert.equal(url.searchParams.get('search'),'Sales & IT');assert.equal(url.searchParams.has('employeeId'),false);assert.equal(calls[0].options.cache,'no-store');
 await apiKpiConfigurationLookups();await apiKpiTemplateDetail(9);await apiKpiConfigurationSave('templates',{version:3},9);assert.equal(calls[3].options.method,'PUT');assert.deepEqual(JSON.parse(calls[3].options.body),{version:3});await apiKpiConfigurationSave('assignments',{target:'ALL'});assert.equal(calls[4].options.method,'POST');await apiKpiConfigurationAction('templates',9,3);assert.ok(calls[5].url.endsWith('/templates/9/publish'));await apiKpiConfigurationAction('periods',1,2);assert.ok(calls[6].url.endsWith('/periods/1/close'));assert.throws(()=>apiKpiConfigurationSave('templates',{version:0},9));assert.throws(()=>apiKpiConfigurationAction('periods',1,0));
 let attempts=0;globalThis.fetch=async()=>{attempts++;return {ok:false,status:409,json:async()=>({message:'Reload KPI'})};};await assert.rejects(apiKpiConfigurationAction('templates',9,3),/Reload KPI/);assert.equal(attempts,1);
 }finally{globalThis.fetch=previous;}
});

test('login action-only DTO does not hide creation or block assignment before server scope validation',()=>{
 const session=configAccount();delete session.permissions[0].dataScopes;
 assert.equal(kpiConfigurationGrant('canNew',false,session),true);assert.equal(kpiConfigurationGrant('canNew',true,session),true);assert.equal(kpiConfigurationGrant('canUpdate',true,session),true);
 assert.equal(kpiConfigurationCanEdit({status:'DRAFT'}, {departments:[],teams:[]},session),true);assert.equal(kpiConfigurationCanEdit({status:'PUBLISHED'}, {departments:[],teams:[]},session),false);
 session.permissions[0].canNew='N';assert.equal(kpiConfigurationGrant('canNew',false,session),false);assert.equal(kpiConfigurationGrant('canNew',true,session),false);session.permissions[0].canNew='Y';session.permissions[0].canView='N';assert.equal(kpiConfigurationGrant('canNew',false,session),false);
 });

test('unit catalog preserves legacy/inactive current code while offering active codes only',async()=>{
 const {kpiMetricUnitOptions,kpiUnitPayload}=await import('../assets/js/pages/performance/kpi-templates.js');
 const choices=kpiMetricUnitOptions([{id:1,code:'KG',name:'Kilogram',isActive:true},{id:2,code:'OLD',name:'Old',isActive:false}],'OLD');assert.deepEqual(choices.map(item=>item.id),['KG','OLD']);assert.match(choices[1].label,/hiện tại/);assert.deepEqual(kpiMetricUnitOptions([{code:'KG',name:'Kilogram',isActive:true}],'KG').map(item=>item.id),['KG']);assert.deepEqual(kpiMetricUnitOptions([{code:'OLD',isActive:false}]),[]);
 const values={code:'%',name:'Phần trăm',isActive:true,sortOrder:20};assert.deepEqual(kpiUnitPayload(values),values);assert.deepEqual(kpiUnitPayload({...values,name:'Tỷ lệ'},{code:'%',version:4}),{...values,name:'Tỷ lệ',version:4});assert.throws(()=>kpiUnitPayload(values,{code:'KG',version:4}),/đổi mã/);
 for(const patch of [{code:''},{name:''},{name:'x'.repeat(101)},{sortOrder:-1},{sortOrder:100001},{sortOrder:1.5}])assert.throws(()=>kpiUnitPayload({...values,...patch}));
 const metric=kpiMetricPayload({code:'WEIGHT',name:'Khối lượng',unit:choices[0].id,direction:'HIGHER',maxScore:100,isActive:true},[]);assert.equal(metric.unit,'KG');assert.equal(metric.unitId,undefined);
});
test('units API supports active filter including false, detail and versioned catalog writes',async()=>{
 const {apiKpiUnitDetail}=await import('../assets/js/api/client.js');const previous=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({success:true,data:{id:12,code:'KG',version:2}})};};
 await apiKpiConfigurationList('units',{isActive:true,page:2,pageSize:100,search:'Kg'});assert.ok(calls[0].url.includes('isActive=true'));assert.ok(calls[0].url.includes('page=2'));await apiKpiConfigurationList('units',{isActive:false});assert.ok(calls[1].url.includes('isActive=false'));
 await apiKpiUnitDetail(12);assert.ok(calls[2].url.endsWith('/units/12'));const payload={code:'KG',name:'Kilogram',isActive:false,sortOrder:20,version:1};await apiKpiConfigurationSave('units',payload,12);assert.equal(calls[3].options.method,'PUT');assert.deepEqual(JSON.parse(calls[3].options.body),payload);await apiKpiConfigurationSave('units',{...payload,version:0});assert.equal(calls[4].options.method,'POST');assert.throws(()=>apiKpiConfigurationSave('units',{...payload,version:0},12));
 }finally{globalThis.fetch=previous;}
});

test('restricted templates use server names and explicit employee IDs so removals are honored; common templates stay flexible',async()=>{
 const {kpiTemplateApplicability,kpiTemplateMatchesEmployee}=await import('../assets/js/pages/performance/kpi-templates.js');
 const periods=[{id:1,periodType:'MONTH',isClosed:false}],base={id:7,periodType:'MONTH',status:'PUBLISHED'},values={periodId:1,templateId:7,reviewerEmployeeId:32,target:'ALL',departmentId:999,teamId:999};
 const department={...base,departmentId:4,departmentName:'Công nghệ'};assert.equal(kpiTemplateApplicability(department).name,'Công nghệ');const deptPayload=kpiAssignmentPayload(values,[12],periods,[department]);assert.equal(deptPayload.target,'EMPLOYEE');assert.equal(deptPayload.departmentId,null);assert.deepEqual(deptPayload.employeeIds,[12]);assert.equal(deptPayload.teamId,null);
 const team={...base,teamId:9,teamName:'Backend'};const teamPayload=kpiAssignmentPayload(values,[14],periods,[team]);assert.equal(teamPayload.target,'EMPLOYEE');assert.equal(teamPayload.teamId,null);assert.deepEqual(teamPayload.employeeIds,[14]);assert.equal(teamPayload.departmentId,null);
 const position={...base,positionId:7,positionName:'Backend Developer'};assert.equal(kpiTemplateApplicability(position).type,'Theo chức vụ');assert.equal(kpiTemplateApplicability(position).name,'Backend Developer');assert.equal(kpiAssignmentPayload(values,[12],periods,[position]).target,'EMPLOYEE');assert.equal(kpiTemplateMatchesEmployee(position,{positionId:7}),true);assert.equal(kpiTemplateMatchesEmployee(position,{positionId:8}),false);
 const common={...base,departmentId:null,teamId:null,positionId:null};assert.equal(kpiTemplateApplicability(common).kind,'COMMON');assert.equal(kpiAssignmentPayload(values,[],periods,[common]).target,'ALL');assert.equal(kpiTemplateMatchesEmployee(common,{positionId:8}),true);
});

test('add all matching employees reads every scoped page without search and filters/deduplicates position matches',async()=>{
 const {kpiMatchingEmployees}=await import('../assets/js/pages/performance/kpi-templates.js');const previous=globalThis.fetch,calls=[];
 try{globalThis.fetch=async(url)=>{const query=new URL(url,'https://example.invalid').searchParams;calls.push(query);const page=Number(query.get('page'));return {ok:true,json:async()=>({success:true,total:4,data:page===1?[{id:12,positionId:7},{id:32,positionId:8}]:[{id:14,positionId:7},{id:12,positionId:7}]})};};
 const result=await kpiMatchingEmployees({positionId:7});assert.deepEqual(result.map(item=>item.id),[12,14]);assert.equal(calls.length,2);assert.equal(calls[0].get('pageSize'),'100');assert.equal(calls[0].has('search'),false);
 assert.equal(await kpiMatchingEmployees({positionId:7},()=>false),null);
 globalThis.fetch=async()=>({ok:true,json:async()=>({success:true,total:1001,data:Array.from({length:1001},(_,index)=>({id:index+1,positionId:7}))})});await assert.rejects(kpiMatchingEmployees({positionId:7}),/1000/);
 let page=0;globalThis.fetch=async()=>{if(++page===2)return {ok:false,status:503,json:async()=>({message:'Load failed'})};return {ok:true,json:async()=>({success:true,total:2,data:[{id:12,positionId:7}]})};};await assert.rejects(kpiMatchingEmployees({positionId:7}),/Load failed/);
 }finally{globalThis.fetch=previous;}
});
