import test from 'node:test';
import assert from 'node:assert/strict';
import {employeeListRows} from '../assets/js/pages/employees.js';
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
