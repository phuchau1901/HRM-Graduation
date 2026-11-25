import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeListRows} from '../assets/js/pages/human-resources/employees.js';
import {apiEmployees,apiEmployeeDetail} from '../assets/js/api/client.js';

test('employee rows display backend names, status, and API employee profile link',()=>{
 const row=employeeListRows([{id:42,employeeCode:'NV000042',fullName:'Nguyen A',positionName:'Developer',departmentName:'Engineering',teamName:'Platform',employmentStatus:'ACTIVE'}]);
 for(const value of ['Nguyen A','NV000042','Developer','Engineering','Platform','Đang làm việc','href="#/hr/employees/42"'])assert.ok(row.includes(value));
 assert.equal((row.match(/<td>/g)||[]).length,6);
});
test('employee rows safely render unassigned names and untrusted API values',()=>{
 const row=employeeListRows([{id:1,fullName:'<script>alert(1)</script>',employeeCode:'NV1',positionName:null,departmentName:null,teamName:null,employmentStatus:'TERMINATED'}]);
 assert.ok(!row.includes('<script>'));assert.ok(row.includes('&lt;script&gt;'));
 assert.equal((row.match(/<td>—<\/td>/g)||[]).length,3);assert.ok(row.includes('Đã nghỉ việc'));
});
test('employee list and detail use separate API endpoints with server query filters',async()=>{
 const calls=[],original=globalThis.fetch;
 try{
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>url.includes('?')?{total:0,data:[]}:{id:42,fullName:'Employee'}};};
 await apiEmployees(new URLSearchParams({page:2,pageSize:30,search:'Nguyen & A',employmentStatus:'ACTIVE'}).toString());
 const url=new URL(calls[0].url,'http://local');assert.equal(url.pathname,'/api/employees');assert.equal(url.searchParams.get('search'),'Nguyen & A');assert.equal(url.searchParams.get('page'),'2');assert.equal(url.searchParams.get('employmentStatus'),'ACTIVE');
 const detail=await apiEmployeeDetail(42);assert.ok(calls[1].url.endsWith('/api/employees/42'));assert.equal(detail.id,42);
 globalThis.fetch=async()=>({ok:false,status:404,json:async()=>({message:'Không tìm thấy nhân viên'})});
 await assert.rejects(apiEmployeeDetail(999),/Không tìm thấy nhân viên/);
 }finally{globalThis.fetch=original;}
});

test('employee creation payload follows profile contract without accepting client employee code',async()=>{
 const {employeeCreationPayload}=await import('../assets/js/pages/human-resources/employees.js');
 const input={fullName:' Nguyen A ',email:' a@example.com ',phoneNumber:' ',dateOfBirth:'1995-01-01',hireDate:'2026-01-01',departmentId:'2',positionId:'3',teamId:'4',employmentStatus:'ACTIVE',employeeCode:'FAKE',departmentName:'Fake'};
 assert.deepEqual(employeeCreationPayload(input),{fullName:'Nguyen A',email:'a@example.com',phoneNumber:null,dateOfBirth:'1995-01-01',hireDate:'2026-01-01',departmentId:2,positionId:3,teamId:4,employmentStatus:'ACTIVE'});
 const optional=employeeCreationPayload({...input,dateOfBirth:'',teamId:'',positionId:''});
 assert.equal(optional.dateOfBirth,null);assert.equal(optional.teamId,null);assert.equal(optional.positionId,null);
 for(const invalid of [{hireDate:''},{dateOfBirth:'2025-02-30'},{dateOfBirth:'2027-01-01'},{departmentId:''},{teamId:'-1'},{positionId:'abc'},{employmentStatus:'UNKNOWN'},{fullName:' '},{email:'broken'},{phoneNumber:'1'.repeat(21)}])assert.throws(()=>employeeCreationPayload({...input,...invalid}));
});
test('creating an employee posts once to profiles endpoint and surfaces duplicate errors',async()=>{
 const {apiCreateEmployee}=await import('../assets/js/api/client.js');
 const original=globalThis.fetch,calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({id:42,employeeCode:'NV000042'})};};
  const payload={fullName:'A',email:'a@example.com',departmentId:2,hireDate:'2026-01-01',employmentStatus:'ACTIVE',teamId:null,positionId:null,dateOfBirth:null,phoneNumber:null};
  const result=await apiCreateEmployee(payload);
  assert.equal(result.employeeCode,'NV000042');assert.equal(calls.length,1);assert.ok(calls[0].url.endsWith('/api/employees'));assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),payload);
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Email đã tồn tại'})});
  await assert.rejects(apiCreateEmployee(payload),/Email đã tồn tại/);
 }finally{globalThis.fetch=original;}
});

test('profile edit access requires WEB_EMPLOYEES canUpdate Y on WEB',async()=>{
 const {employeeCanUpdate}=await import('../assets/js/pages/human-resources/employees.js');
 const permission={platform:'WEB',code:'WEB_EMPLOYEES',canView:'Y',canUpdate:'Y'};
 assert.equal(employeeCanUpdate({permissions:[permission]}),true);
 for(const session of [null,{permissions:[]},{permissions:[{...permission,canUpdate:'N'}]},{permissions:[{...permission,code:'WEB_ORGANIZATION'}]},{permissions:[{...permission,platform:'MOBILE'}]}])assert.equal(employeeCanUpdate(session),false);
});
test('profile update sends editable fields and preserves assigned ids without writable identity fields',async()=>{
 const {employeeUpdatePayload}=await import('../assets/js/pages/human-resources/employees.js');
 const employee={id:42,employeeCode:'NV000042',departmentId:2,hireDate:'2024-01-01'};
 const values={fullName:' Updated ',email:'updated@example.com',phoneNumber:'',dateOfBirth:'1990-01-01',employmentStatus:'INACTIVE',positionId:'3',teamId:'4',employeeCode:'FAKE',departmentId:'999',hireDate:'2099-01-01'};
 const payload=employeeUpdatePayload(values,employee);
 assert.deepEqual(payload,{fullName:'Updated',email:'updated@example.com',phoneNumber:null,dateOfBirth:'1990-01-01',employmentStatus:'INACTIVE',teamId:4,positionId:3});
 assert.equal(employeeUpdatePayload({...values,teamId:'',positionId:''},employee).teamId,null);
 const {apiUpdateEmployee}=await import('../assets/js/api/client.js');const original=globalThis.fetch;const calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({...employee,...payload})};};
  await apiUpdateEmployee(42,payload);
  assert.ok(calls[0].url.endsWith('/api/employees/42'));assert.equal(calls[0].options.method,'PUT');assert.deepEqual(JSON.parse(calls[0].options.body),payload);
  globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({message:'Không có quyền cập nhật'})});
  await assert.rejects(apiUpdateEmployee(42,payload),/Không có quyền cập nhật/);
 }finally{globalThis.fetch=original;}
});

test('create and update accept explicit manager flags, preserve omitted roles and require a team for lead',async()=>{
 const {employeeCreationPayload,employeeUpdatePayload}=await import('../assets/js/pages/human-resources/employees.js');
 const values={fullName:'Manager',email:'manager@example.com',hireDate:'2020-01-01',departmentId:1,teamId:2,positionId:null,employmentStatus:'ACTIVE'};
 assert.equal(employeeCreationPayload({...values,isDepartmentManager:true,isTeamLead:true}).isTeamLead,true);
 assert.equal(employeeCreationPayload({...values,isDepartmentManager:false,isTeamLead:false}).isDepartmentManager,false);
 const omitted=employeeCreationPayload({...values,isDepartmentManager:null});
 assert.equal(Object.hasOwn(omitted,'isDepartmentManager'),false);assert.equal(Object.hasOwn(omitted,'isTeamLead'),false);
 assert.throws(()=>employeeCreationPayload({...values,teamId:null,isTeamLead:true}),/chọn team/);
 assert.throws(()=>employeeCreationPayload({...values,isDepartmentManager:'on'}),/boolean/);
 const employee={...values,id:42,isTeamLead:true,positionId:3};
 const updated=employeeUpdatePayload({...values,teamId:null,isTeamLead:false,isDepartmentManager:true},employee);
 assert.equal(updated.teamId,null);assert.equal(updated.isTeamLead,false);assert.equal(updated.isDepartmentManager,true);
 const {teamId,positionId,...scalarValues}=values;
 const preserve=employeeUpdatePayload({...scalarValues,isTeamLead:null},employee);
 assert.equal(Object.hasOwn(preserve,'teamId'),false);assert.equal(Object.hasOwn(preserve,'isTeamLead'),false);assert.equal(preserve.positionId,3);
 assert.equal(employeeUpdatePayload({...scalarValues,isTeamLead:true},employee).isTeamLead,true);
});

test('department transfer uses PATCH independently of profile PUT and validates date and target',async()=>{
 const {employeeTransferPayload}=await import('../assets/js/pages/human-resources/employees.js');
 const {apiTransferEmployeeDepartment}=await import('../assets/js/api/client.js');
 const employee={id:42,departmentId:1,hireDate:'2020-01-01'};
 const values={departmentId:'2',teamId:'3',effectiveDate:'2025-01-01',transferReason:' New department '};
 const payload=employeeTransferPayload(values,employee);
 assert.deepEqual(payload,{departmentId:2,teamId:3,effectiveDate:'2025-01-01',reason:'New department'});
 assert.equal(employeeTransferPayload({...values,teamId:''},employee).teamId,null);
 for(const invalid of [{departmentId:'1'},{departmentId:''},{teamId:'-1'},{effectiveDate:'2019-01-01'},{effectiveDate:'2099-01-01'},{effectiveDate:'2025-02-30'}])assert.throws(()=>employeeTransferPayload({...values,...invalid},employee));
 const original=globalThis.fetch;const calls=[];
 try{
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({...employee,departmentId:2,teamId:3})};};
  await apiTransferEmployeeDepartment(42,payload);
  assert.ok(calls[0].url.endsWith('/api/employees/42/department'));assert.equal(calls[0].options.method,'PATCH');assert.deepEqual(JSON.parse(calls[0].options.body),payload);
  globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({message:'Cần gỡ vai trò quản lý trước khi chuyển'})});
  await assert.rejects(apiTransferEmployeeDepartment(42,payload),/gỡ vai trò/);
 }finally{globalThis.fetch=original;}
});

test('dashboard department links apply server department scope before pagination and retain active filter',async()=>{
 const {mountEmployees}=await import('../assets/js/pages/human-resources/employees.js');
 const previousFetch=globalThis.fetch,previousLocation=globalThis.location,calls=[];
 try{
 globalThis.location={hash:'#/hr/employees?departmentId=4&departmentName=%3Cscript%3E&employmentStatus=ACTIVE'};
 globalThis.fetch=async url=>{calls.push(new URL(url,'http://local'));return {ok:true,json:async()=>({success:true,total:0,data:[]})};};
 const control={},root={isConnected:true,innerHTML:'',querySelector:()=>control};await mountEmployees(root);
 assert.equal(calls[0].searchParams.get('departmentId'),'4');assert.equal(calls[0].searchParams.get('employmentStatus'),'ACTIVE');assert.ok(root.innerHTML.includes('&lt;script&gt;'));assert.ok(root.innerHTML.includes('Bỏ lọc phòng ban'));
 }finally{globalThis.fetch=previousFetch;if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;}
});
