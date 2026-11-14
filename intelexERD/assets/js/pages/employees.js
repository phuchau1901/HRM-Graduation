import {apiEmployees,apiEmployeeDetail} from '../api/client.js';
import {e,dateLabel} from '../utils.js';
import {details} from '../components/ui.js';

const employeeStatuses={ACTIVE:'Đang làm việc',INACTIVE:'Ngừng hoạt động',TERMINATED:'Đã nghỉ việc'};
const employeeValue=value=>e(value||'—');
export function employeeListRows(items){
 return items.map(employee=>`<tr><td><strong>${e(employee.fullName)}</strong><div class="person-sub">${e(employee.employeeCode)}</div></td><td>${employeeValue(employee.positionName)}</td><td>${employeeValue(employee.departmentName)}</td><td>${employeeValue(employee.teamName)}</td><td><span class="badge ${employee.employmentStatus==='ACTIVE'?'active':''}">${e(employeeStatuses[employee.employmentStatus]||employee.employmentStatus)}</span></td><td><a class="btn small" href="#/hr/employees/${encodeURIComponent(employee.id)}">Hồ sơ</a></td></tr>`).join('');
}
export async function mountEmployees(root,filters={},employeeId=null){
 if(!root)return;
 let page=Number(filters.page)||1,search=filters.search||'',status='',generation=0;
 async function load(){
 const current=++generation;root.innerHTML='<p role="status">Đang tải nhân viên…</p>';
 try{
 if(employeeId!==null){
 const employee=await apiEmployeeDetail(employeeId);if(!root.isConnected||current!==generation)return;
 root.innerHTML=`<a class="btn" href="#/hr/employees">← Danh sách nhân viên</a><h2 class="role-editor-title">${e(employee.fullName)}</h2>${details([['Mã nhân viên',employeeValue(employee.employeeCode)],['Chức danh',employeeValue(employee.positionName)],['Phòng ban',employeeValue(employee.departmentName)],['Team',employeeValue(employee.teamName)],['Trạng thái',employeeValue(employeeStatuses[employee.employmentStatus]||employee.employmentStatus)],['Email',employeeValue(employee.email)],['Số điện thoại',employeeValue(employee.phoneNumber)],['Ngày sinh',employee.dateOfBirth?dateLabel(employee.dateOfBirth):'—'],['Ngày vào làm',employee.hireDate?dateLabel(employee.hireDate):'—']])}`;
 return;
 }
 const query=new URLSearchParams({page,pageSize:30,search});if(status)query.set('employmentStatus',status);
 const result=await apiEmployees(query.toString());if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
 root.innerHTML=`<form id="employee-api-search" class="toolbar"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã, tên hoặc email nhân viên" aria-label="Tìm nhân viên"><select name="status" aria-label="Trạng thái nhân viên"><option value="">Tất cả trạng thái</option>${Object.entries(employeeStatuses).map(([value,label])=>`<option value="${value}" ${value===status?'selected':''}>${label}</option>`).join('')}</select><button class="btn">Tìm kiếm</button></form><div class="table-wrap"><table><thead><tr><th>Nhân viên</th><th>Chức danh</th><th>Phòng ban</th><th>Team</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${employeeListRows(result.data)}</tbody></table></div>${result.data.length?'':'<p>Không có nhân viên phù hợp.</p>'}<div class="toolbar user-pagination"><button class="btn" id="employee-api-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} nhân viên</span><button class="btn" id="employee-api-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
 root.querySelector('#employee-api-search').onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=ev.currentTarget.elements.search.value.trim();status=ev.currentTarget.elements.status.value;page=1;load();};
 root.querySelector('#employee-api-prev').onclick=()=>{page--;load();};root.querySelector('#employee-api-next').onclick=()=>{page++;load();};
 }catch(err){if(!root.isConnected||current!==generation)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="employee-api-retry">Thử lại</button>`;root.querySelector('#employee-api-retry').onclick=load;}
 }
 await load();
}
