import test from 'node:test';
import assert from 'node:assert/strict';
import {contractPayload,contractListRows,contractGrant,contractAttachment,contractClosed,mountContracts} from '../assets/js/pages/contracts.js';
import {apiEmployeeContracts,apiEmployeeContract,apiSaveEmployeeContract,apiActiveContractTypes} from '../assets/js/api/client.js';
import {roleUsesEmployeeScope,rolePermissionPatch} from '../assets/js/pages/roles.js';

const draft={contractNo:' C001 ',contractType:'FIXED_TERM',startDate:'2024-01-01',endDate:'2027-01-01',status:'DRAFT',attachmentUrl:''};
test('contract list combines employee, catalog type and dates with view actions',()=>{
 const items=[{...draft,id:1,contractNo:'<script>',contractTypeName:'Có thời hạn'},{...draft,id:2,status:'EXPIRED'}];
 const html=contractListRows(items,true,{fullName:'Nguyễn A',employeeCode:'NV000001'});
 assert.ok(html.includes('Có thời hạn'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.equal((html.match(/>Xem<\/button>/g)||[]).length,2);assert.ok(html.includes('Nguyễn A'));assert.ok(html.includes('NV000001'));assert.ok(html.includes('01/01/2024'));
 assert.equal(contractClosed(items[1]),true);assert.equal(contractClosed(items[0]),false);
});
test('contract payload sends catalog code and validates dates, lifecycle and attachment URL',()=>{
 const payload=contractPayload(draft,{hireDate:'2023-01-01',today:'2026-11-16'});
 assert.deepEqual(payload,{contractType:'FIXED_TERM',startDate:'2024-01-01',endDate:'2027-01-01',status:'DRAFT',attachmentUrl:null});
 assert.equal(contractPayload({...draft,endDate:''}).endDate,null);
 assert.equal(contractPayload({...draft,contractType:' legacy '}).contractType,' legacy ');
 for(const patch of [{contractType:''},{startDate:'2025-02-30'},{endDate:'2020-01-01'},{status:'UNKNOWN'},{attachmentUrl:'http://example.com'},{attachmentUrl:'https://user:pass@example.com'}])assert.throws(()=>contractPayload({...draft,...patch}));
 assert.throws(()=>contractPayload(draft,{hireDate:'2025-01-01'}),/ngày vào làm/);
 assert.throws(()=>contractPayload({...draft,status:'ACTIVE'},{today:'2028-01-01'}),/hôm nay/);
 assert.throws(()=>contractPayload(draft,{original:{status:'ACTIVE',contractNo:draft.contractNo}}),/đang hiệu lực/);
 assert.throws(()=>contractPayload({...draft,status:'EXPIRED'},{today:'2026-01-01'}),/đóng/);
 const closed={...payload,status:'EXPIRED',endDate:'2025-01-01'};
 assert.deepEqual(contractPayload(closed,{original:closed,today:'2026-01-01'}),closed);
 assert.throws(()=>contractPayload({...closed,contractNo:'CHANGED'},{original:closed,today:'2026-01-01'}),/Không được thay đổi/);
 assert.equal(contractAttachment('javascript:alert(1)'),null);assert.equal(contractAttachment('https://example.com/file.pdf'),'https://example.com/file.pdf');
});
test('contract permission is independent of type permissions and denied mounts never fetch',async()=>{
 const permission={platform:'WEB',code:'WEB_CONTRACTS',canView:'Y',canNew:'Y',canUpdate:'N'};
 assert.equal(contractGrant('canView',{permissions:[permission]}),true);
 assert.equal(contractGrant('canUpdate',{permissions:[permission]}),false);
 assert.equal(contractGrant('canView',{permissions:[{...permission,code:'WEB_CONTRACT_TYPES'}]}),false);
 const original=globalThis.fetch;let fetched=false;globalThis.fetch=()=>{fetched=true;};
 try{const root={innerHTML:''};await mountContracts(root);assert.match(root.innerHTML,/chưa có quyền/);assert.equal(fetched,false);}finally{globalThis.fetch=original;}
});
test('employee contracts use nested endpoints, server pagination, POST and PUT without employeeId in body',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:1,...draft})};};
 try{
  await apiEmployeeContracts(42,new URLSearchParams({page:2,pageSize:30,search:'C & 1'}).toString());
  const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/employees/42/contracts');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('search'),'C & 1');
  await apiEmployeeContract(42,'123');assert.ok(calls[1].url.endsWith('/api/employees/42/contracts/123'));
  const payload=contractPayload(draft);await apiSaveEmployeeContract(42,null,payload);assert.equal(calls[2].options.method,'POST');assert.deepEqual(JSON.parse(calls[2].options.body),payload);assert.equal(Object.hasOwn(payload,'employeeId'),false);
  await apiSaveEmployeeContract(42,123,payload);assert.equal(calls[3].options.method,'PUT');assert.ok(calls[3].url.endsWith('/42/contracts/123'));
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Hợp đồng ACTIVE bị trùng'})});
  await assert.rejects(apiSaveEmployeeContract(42,null,payload),/bị trùng/);
 }finally{globalThis.fetch=original;}
});
test('contract dropdown loads active catalog types across all server pages without invented categories',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async url=>{calls.push(new URL(url,'http://local'));const page=calls.length;return {ok:true,json:async()=>({total:3,data:page===1?[{code:'A',name:'Type A',isActive:true},{code:'OLD',isActive:false}]:[{code:'B',name:'Type B',isActive:true}]})};};
 try{
  const types=await apiActiveContractTypes();assert.deepEqual(types.map(type=>type.code),['A','B']);assert.equal(calls.length,2);assert.equal(calls[1].searchParams.get('page'),'2');assert.equal(calls[0].searchParams.get('isActive'),'true');
 }finally{globalThis.fetch=original;}
});
test('contract permission editor supports independent per-action employee scopes',()=>{
 assert.equal(roleUsesEmployeeScope('WEB_CONTRACTS'),true);assert.equal(roleUsesEmployeeScope('WEB_CONTRACT_TYPES'),false);
 const scopes=new Map([['WEB_CONTRACTS',{VIEW:'SELF',NEW:'DEPARTMENT',UPDATE:'ALL'}]]);
 const patch=rolePermissionPatch(new Map([['WEB_CONTRACTS',{VIEW:true,NEW:true,UPDATE:true}]]),new Set(['WEB_CONTRACTS']),new Set(),scopes);
 assert.deepEqual(patch[0].dataScopes,{VIEW:'SELF',NEW:'DEPARTMENT',UPDATE:'ALL'});
});

test('contract statistics validates real zero counts and rejects malformed/error responses',async()=>{
 const {contractStatisticsData}=await import('../assets/js/pages/contracts.js');
 const response={success:true,data:{active:0,expiringSoon:2,expired:1,expiringWithinDays:30,asOfDate:'2026-11-16'}};
 assert.deepEqual(contractStatisticsData(response),response.data);
 assert.equal(contractStatisticsData({...response,data:{...response.data,expiringSoon:0,expired:0}}).active,0);
 for(const invalid of [null,{success:false,data:response.data},{data:response.data},{success:true,data:{...response.data,active:'3'}},{success:true,data:{...response.data,expired:-1}},{success:true,data:{...response.data,expiringSoon:null}},{success:true,data:{...response.data,asOfDate:'2026-02-30'}},{success:true,data:{...response.data,expiringWithinDays:0}}])assert.throws(()=>contractStatisticsData(invalid),/không hợp lệ/);
});
test('contract classifications follow Vietnam statistics date and inclusive expiration boundaries',async()=>{
 const {contractCategory}=await import('../assets/js/pages/contracts.js');
 const base={status:'ACTIVE',startDate:'2026-01-01',endDate:null},today='2026-11-16';
 assert.equal(contractCategory(base,today,30),'active');
 assert.equal(contractCategory({...base,endDate:'2026-11-16'},today,30),'expiringSoon');
 assert.equal(contractCategory({...base,endDate:'2026-12-16'},today,30),'expiringSoon');
 assert.equal(contractCategory({...base,endDate:'2026-12-17'},today,30),'active');
 assert.equal(contractCategory({...base,endDate:'2026-11-15'},today,30),'expired');
 assert.equal(contractCategory({...base,status:'EXPIRED',endDate:'2026-11-15'},today,30),'expired');
 for(const status of ['DRAFT','CANCELLED','TERMINATED','LEGACY'])assert.equal(contractCategory({...base,status,endDate:'2026-11-15'},today,30),null);
 assert.equal(contractCategory({...base,startDate:'2026-11-17'},today,30),null);
 assert.equal(contractCategory({...base,status:'EXPIRED'},today,30),null);
 assert.equal(contractCategory({...base,status:'EXPIRED',endDate:'2026-12-01'},today,30),null);
});
test('contract statistics uses global scoped no-store endpoint and surfaces failures',async()=>{
 const {apiContractStatistics}=await import('../assets/js/api/client.js');const original=globalThis.fetch;const calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({success:true,data:{active:3,expiringSoon:2,expired:1}})};};
  await apiContractStatistics();await apiContractStatistics(90);
  const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/contracts/statistics');assert.equal(url.searchParams.get('expiringWithinDays'),'30');assert.equal(calls[0].options.cache,'no-store');assert.equal(new URL(calls[1].url,'http://local').searchParams.get('expiringWithinDays'),'90');
  globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({message:'Thiếu phạm vi xem hợp đồng'})});
  await assert.rejects(apiContractStatistics(),/Thiếu phạm vi/);
 }finally{globalThis.fetch=original;}
});
test('contract writes accept CANCELLED drafts and use Vietnam business date near UTC midnight',async()=>{
 const {contractBusinessDate}=await import('../assets/js/pages/contracts.js');
 assert.equal(contractBusinessDate(new Date('2026-11-15T17:00:00Z')),'2026-11-16');
 assert.equal(contractBusinessDate(new Date('2026-11-15T16:59:59Z')),'2026-11-15');
 assert.equal(contractPayload({...draft,status:'CANCELLED'}).status,'CANCELLED');
 assert.equal(contractClosed({status:'CANCELLED'}),true);
});

test('unified contract search matches employee name, employee code or contract number and combines status',async()=>{
 const {searchContracts}=await import('../assets/js/pages/contracts.js');
 const items=[{id:1,contractNo:'HD-2026-001',employeeName:'Nguyễn Hoàng Nam',employeeCode:'NV000002',status:'ACTIVE',startDate:'2025-01-01',endDate:'2026-11-30'},{id:2,contractNo:'HD-2026-002',employeeName:'Trần Đức Anh',employeeCode:'NV000001',status:'ACTIVE',startDate:'2025-01-01',endDate:null}];
 for(const query of ['nguyen hoang','NV000002','hd-2026-001'])assert.deepEqual(searchContracts(items,query,'','2026-11-16').map(item=>item.id),[1]);
 assert.deepEqual(searchContracts(items,' duc anh ','active','2026-11-16').map(item=>item.id),[2]);
 assert.equal(searchContracts(items,'nguyen','active','2026-11-16').length,0);
 assert.equal(searchContracts(items,'nguyen','expiringSoon','2026-11-16').length,1);
 assert.equal(searchContracts(items,'').length,2);
 assert.equal(searchContracts(items,'khong co').length,0);
});
test('contract directory loads all employee and contract pages and ignores only out-of-scope 404 groups',async()=>{
 const {loadVisibleContracts}=await import('../assets/js/pages/contracts.js');
 const employeeCalls=[],contractCalls=[];
 const readEmployees=async query=>{
  const page=Number(new URLSearchParams(query).get('page'));employeeCalls.push(page);
  return {total:3,data:page===1?[{id:1,fullName:'One',employeeCode:'NV1'},{id:2,fullName:'Outside'}]:[{id:3,fullName:'Three',employeeCode:'NV3'}]};
 };
 const readContracts=async(id,query)=>{
  const page=Number(new URLSearchParams(query).get('page'));contractCalls.push([id,page]);
  if(id===2)throw Object.assign(Error('Outside scope'),{status:404});
  return id===1?{total:2,data:[{id:page,employeeId:id,contractNo:'C'+page}]}:{total:1,data:[{id:3,employeeId:3,contractNo:'C3'}]};
 };
 const rows=await loadVisibleContracts({canReadEmployees:true,readEmployees,readContracts});
 assert.deepEqual(employeeCalls,[1,2]);assert.equal(rows.length,3);assert.ok(contractCalls.some(([id,page])=>id===1&&page===2));
 assert.deepEqual(rows.map(item=>item.employeeName),['One','One','Three']);assert.ok(rows.every(item=>item.employeeName!=='Outside'));
});
test('contract directory limits concurrent employee reads and never substitutes partial results for errors',async()=>{
 const {loadVisibleContracts}=await import('../assets/js/pages/contracts.js');
 let pending=0,peak=0;
 const readEmployees=async()=>({total:9,data:Array.from({length:9},(_,i)=>({id:i+1}))});
 const readContracts=async id=>{pending++;peak=Math.max(peak,pending);await new Promise(resolve=>setTimeout(resolve,1));pending--;return {total:1,data:[{id,contractNo:'C'+id}]};};
 const rows=await loadVisibleContracts({canReadEmployees:true,readEmployees,readContracts});
 assert.equal(rows.length,9);assert.ok(peak<=4);
 await assert.rejects(loadVisibleContracts({canReadEmployees:false,ownEmployee:{id:1},readContracts:async()=>{throw Object.assign(Error('Missing permission'),{status:403});}}),/Missing permission/);
});
test('contract-only access uses linked employee without Employee VIEW and stops after navigation',async()=>{
 const {loadVisibleContracts}=await import('../assets/js/pages/contracts.js');
 let employeesRead=false,contractsRead=false;
 const rows=await loadVisibleContracts({ownEmployee:{id:42,fullName:'Self',employeeCode:'NV42'},readEmployees:()=>{employeesRead=true;},readContracts:async id=>{contractsRead=true;assert.equal(id,42);return {total:1,data:[{id:1,contractNo:'SELF'}]};}});
 assert.equal(employeesRead,false);assert.equal(contractsRead,true);assert.equal(rows[0].employeeCode,'NV42');
 await assert.rejects(loadVisibleContracts({isCurrent:()=>false,canReadEmployees:true,readEmployees:async()=>{throw Error('must not run');}}),err=>err.name==='AbortError');
});

test('server generates contract numbers and updates retain the issued number without resending it',async()=>{
 const {apiCreateContract}=await import('../assets/js/api/client.js');
 const {contractNo,...fields}=draft;
 const payload=contractPayload(fields);
 assert.equal(Object.hasOwn(payload,'contractNo'),false);
 const original={...payload,contractNo:'HDLD-2026-000001'};
 assert.equal(Object.hasOwn(contractPayload({...payload,contractNo:original.contractNo},{original}),'contractNo'),false);
 assert.throws(()=>contractPayload({...payload,contractNo:'DIFFERENT'},{original}),/Không được thay đổi/);
 const previous=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:1,contractNo:'HDLD-2026-000001'})};};
  const saved=await apiCreateContract({employeeId:42,...payload});
  assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/api/contracts'));assert.equal(calls[0].options.method,'POST');assert.equal(JSON.parse(calls[0].options.body).employeeId,42);assert.equal(Object.hasOwn(JSON.parse(calls[0].options.body),'contractNo'),false);assert.equal(saved.contractNo,'HDLD-2026-000001');
 }finally{globalThis.fetch=previous;}
});
