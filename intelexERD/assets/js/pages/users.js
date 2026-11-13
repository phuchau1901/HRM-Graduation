import {apiUsers,apiAllRoles,apiActiveDepartments,apiCreateEmployee,apiCreateUser,apiSession,apiEmployees,apiUserDetail,apiUpdateUser,apiUpdateUserRoles} from '../api/client.js';
import {e} from '../utils.js';
import {field} from '../components/ui.js';

function userApiGrant(code,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');}
export async function registerSystemUser(input,progress){
 if(input.employee&&!progress.employeeId){
 const employee=await apiCreateEmployee(input.employee);
 if(!Number.isInteger(employee?.id)||employee.id<=0)throw Error('Không nhận được mã hồ sơ nhân viên. Hãy kiểm tra danh sách nhân viên trước khi thử lại.');
 progress.employeeId=employee.id;
 }
 return apiCreateUser({...input.account,employeeId:progress.employeeId||null});
}
export async function mountUsers(root,filters,register=false){
 if(!root)return;
 if(register){await userRegistration(root);return;}
 let page=Number(filters.page)||1,search=filters.search||'',generation=0;
 async function load(){const current=++generation;root.innerHTML='<p role="status">Đang tải tài khoản…</p>';
 try{const result=await apiUsers(page,search);if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách tài khoản không hợp lệ.');
 const statuses={ACTIVE:'Hoạt động',LOCKED:'Đã khóa',INACTIVE:'Ngừng hoạt động'};
 root.innerHTML=`<form id="system-user-search" class="toolbar"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm tài khoản hoặc email" aria-label="Tìm tài khoản"><button class="btn">Tìm kiếm</button>${userApiGrant('WEB_USERS','canNew')?'<a class="btn primary" href="#/admin/users/register">Đăng ký tài khoản</a>':''}</form><div class="table-wrap"><table><thead><tr><th>Tài khoản</th><th>Email</th><th>Vai trò</th><th>Trạng thái</th><th>Hồ sơ nhân viên</th><th>Hành động</th></tr></thead><tbody>${result.data.map(account=>`<tr><td>${e(account.userId)}</td><td>${e(account.email)}</td><td>${(account.roles||[]).map(role=>`<span class="tag">${e(role.name||role.code)}</span>`).join(' ')||'Chưa phân vai trò'}</td><td>${e(statuses[account.status]||account.status)}</td><td>${account.employeeId?'Đã liên kết':'Chưa liên kết'}</td><td>${userApiGrant('WEB_USERS','canUpdate')||userApiGrant('WEB_USERS','canApprove')?`<button type="button" class="btn" data-system-edit-user="${e(account.userId)}">Chỉnh sửa</button>`:''}</td></tr>`).join('')}</tbody></table></div>${!result.data.length?'<p>Không có tài khoản phù hợp.</p>':''}<div class="toolbar user-pagination"><button class="btn" id="system-user-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} tài khoản</span><button class="btn" id="system-user-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
 root.querySelectorAll('[data-system-edit-user]').forEach(button=>button.onclick=()=>editSystemUser(root,button.dataset.systemEditUser,load));
 root.querySelector('#system-user-search').onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=ev.currentTarget.elements.search.value.trim();page=1;load();};
 root.querySelector('#system-user-prev').onclick=()=>{page--;load();};root.querySelector('#system-user-next').onclick=()=>{page++;load();};
 }catch(err){if(!root.isConnected||current!==generation)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="system-user-retry">Thử lại</button>`;root.querySelector('#system-user-retry').onclick=load;}
 }
 await load();
}
async function userRegistration(root){
 if(!userApiGrant('WEB_USERS','canNew')){root.innerHTML='<p>Bạn không có quyền tạo tài khoản.</p>';return;}
 const canAssign=userApiGrant('WEB_USERS','canApprove'),canEmployee=userApiGrant('WEB_EMPLOYEES','canNew');
 let departments=null,departmentsLoading=false,busy=false;const progress={employeeId:null};
 root.innerHTML=`<a class="btn" href="#/admin/users">← Danh sách tài khoản</a><form id="system-user-register" class="user-registration"><section class="user-form-section"><h2>Thông tin tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text','','required maxlength="100" pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" autocomplete="off"')}${field('Email','email','email','','required maxlength="255" autocomplete="off"')}${field('Mật khẩu','password','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}${field('Nhập lại mật khẩu','confirmPassword','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}</div></section><section class="user-form-section"><h2>Vai trò</h2><p class="muted">Có thể chọn nhiều vai trò cho tài khoản.</p><div id="system-role-options" class="user-role-picker">${canAssign?'Đang tải vai trò…':'Bạn chưa có quyền gán vai trò. Tài khoản sẽ được tạo chưa có vai trò.'}</div></section><section class="user-form-section"><label class="role-toggle-row"><span><strong>Cán bộ nhân viên</strong><small class="user-field-note">Tạo hồ sơ nhân viên và liên kết với tài khoản này</small></span><span class="role-switch"><input type="checkbox" role="switch" name="createEmployee" ${canEmployee?'':'disabled'}><span class="role-switch-track" aria-hidden="true"></span></span></label>${!canEmployee?'<p class="muted">Bạn chưa có quyền tạo hồ sơ nhân viên.</p>':''}<fieldset id="system-employee-fields" hidden disabled><div class="form-grid">${field('Mã nhân viên','employeeCode','text','','required maxlength="20"')}${field('Họ và tên','fullName','text','','required maxlength="150"')}${field('Ngày sinh','dateOfBirth','date','','')}${field('Số điện thoại','phoneNumber','tel','','maxlength="20"')}${field('Ngày vào làm','hireDate','date','','required')}<label>Phòng ban<select name="departmentId" required><option value="">Chọn phòng ban</option></select></label></div><p id="system-department-error" role="alert"></p><button type="button" class="btn" id="system-department-retry" hidden>Tải lại phòng ban</button></fieldset></section><p id="system-register-feedback" class="form-error" role="alert"></p><div class="form-actions"><a class="btn" href="#/admin/users">Hủy</a><button type="submit" class="btn primary" id="system-register-submit">Đăng ký tài khoản</button></div></form>`;
 const form=root.querySelector('#system-user-register'),feedback=root.querySelector('#system-register-feedback'),employeeFields=root.querySelector('#system-employee-fields');
 async function loadDepartments(){if(departmentsLoading)return;departmentsLoading=true;const error=root.querySelector('#system-department-error'),retry=root.querySelector('#system-department-retry');error.textContent='Đang tải phòng ban…';retry.hidden=true;
 try{departments=await apiActiveDepartments();if(!root.isConnected)return;form.elements.departmentId.innerHTML='<option value="">Chọn phòng ban</option>'+departments.map(dep=>`<option value="${e(dep.id)}">${e(dep.departmentName)}</option>`).join('');error.textContent=departments.length?'':'Chưa có phòng ban đang hoạt động.';}
 catch(err){if(!root.isConnected)return;error.textContent=err.message;retry.hidden=false;}finally{departmentsLoading=false;}}
 root.querySelector('#system-department-retry').onclick=loadDepartments;
 form.elements.createEmployee.onchange=()=>{employeeFields.hidden=!form.elements.createEmployee.checked;employeeFields.disabled=!form.elements.createEmployee.checked;if(form.elements.createEmployee.checked&&!departments)loadDepartments();};
 let rolesReady=!canAssign;
 if(canAssign){apiAllRoles().then(roles=>{if(!root.isConnected)return;rolesReady=true;mountUserRolePicker(root.querySelector('#system-role-options'),roles);}).catch(err=>{if(!root.isConnected)return;root.querySelector('#system-role-options').textContent=err.message+' Quay lại trang đăng ký để tải lại vai trò.';});}
 form.onsubmit=async ev=>{ev.preventDefault();ev.stopPropagation();if(busy)return;feedback.textContent='';
 if(!rolesReady){feedback.textContent='Chưa tải được danh sách vai trò. Vui lòng thử lại.';return;}
 const data=new FormData(form),staff=form.elements.createEmployee.checked;
 if(data.get('password')!==data.get('confirmPassword')){feedback.textContent='Mật khẩu nhập lại không khớp.';return;}
 if(staff&&!progress.employeeId&&(!departments||departmentsLoading||!departments.some(dep=>String(dep.id)===data.get('departmentId')))){feedback.textContent='Vui lòng chọn phòng ban hợp lệ.';return;}
 if(staff&&!progress.employeeId&&data.get('dateOfBirth')&&data.get('dateOfBirth')>data.get('hireDate')){feedback.textContent='Ngày sinh phải trước hoặc bằng ngày vào làm.';return;}
 const account={userId:data.get('userId').trim(),email:data.get('email').trim(),password:data.get('password'),roleIds:data.getAll('roleIds').map(Number)};
 const employee=staff&&!progress.employeeId?{employeeCode:data.get('employeeCode').trim(),fullName:data.get('fullName').trim(),email:account.email,dateOfBirth:data.get('dateOfBirth')||null,phoneNumber:data.get('phoneNumber').trim()||null,hireDate:data.get('hireDate'),departmentId:Number(data.get('departmentId')),employmentStatus:'ACTIVE'}:null;
 busy=true;const submit=root.querySelector('#system-register-submit');submit.disabled=true;submit.textContent='Đang đăng ký…';form.elements.createEmployee.disabled=true;
 try{await registerSystemUser({account,employee},progress);if(!root.isConnected)return;form.reset();root.innerHTML='<div class="empty"><h2>Đăng ký tài khoản thành công</h2><p>Tài khoản và các vai trò đã được lưu vào hệ thống.</p><a class="btn primary" href="#/admin/users">Về danh sách tài khoản</a></div>';}
 catch(err){if(!root.isConnected)return;feedback.textContent=(progress.employeeId?'Hồ sơ nhân viên đã tạo. Nhấn đăng ký lại để tiếp tục tạo tài khoản, không tạo lại hồ sơ. ':'')+err.message;if(progress.employeeId){employeeFields.disabled=true;form.elements.createEmployee.disabled=true;}}
 finally{busy=false;if(root.isConnected&&submit.isConnected){submit.disabled=false;submit.textContent='Đăng ký tài khoản';if(!progress.employeeId)form.elements.createEmployee.disabled=!canEmployee;}}
 };
}

export function mountUserRolePicker(container,roles,initial=[],disabled=false){
 const selected=new Map(initial.map(role=>[String(role.id),role]));
 function draw(){
 container.innerHTML=`<label class="user-role-select-label">Thêm vai trò<select aria-label="Chọn vai trò để thêm" ${disabled?'disabled':''}><option value="">Chọn vai trò…</option>${roles.filter(role=>!selected.has(String(role.id))).map(role=>`<option value="${e(role.id)}">${e(role.name||role.code)}</option>`).join('')}</select></label><div class="user-role-chips">${[...selected.values()].map(role=>`<span class="user-role-chip"><input type="hidden" name="roleIds" value="${e(role.id)}"><span>${e(role.name||role.code)}</span>${disabled?'':`<button type="button" data-remove-role="${e(role.id)}" aria-label="Bỏ vai trò ${e(role.name||role.code)}">×</button>`}</span>`).join('')||'<span class="muted">Chưa chọn vai trò</span>'}</div>`;
 container.querySelector('select').onchange=ev=>{const role=roles.find(item=>String(item.id)===ev.target.value);if(!role||disabled)return;selected.set(String(role.id),role);draw();container.querySelector('select').focus();};
 container.querySelectorAll('[data-remove-role]').forEach(button=>button.onclick=()=>{selected.delete(button.dataset.removeRole);draw();container.querySelector('select').focus();});
 }
 draw();return ()=>[...selected.keys()].map(Number);
}
export async function saveSystemUserChanges(current,changes){
 let saved=current;
 if(changes.profile&&(changes.profile.email!==current.email||changes.profile.employeeId!==(current.employeeId??null))){
 saved=await apiUpdateUser(current.userId,current.version,changes.profile);
 Object.assign(current,saved);
 }
 if(changes.roleIds&&JSON.stringify([...changes.roleIds].sort((a,b)=>a-b))!==JSON.stringify((current.roles||[]).map(role=>Number(role.id)).sort((a,b)=>a-b))){
 // Re-read the aggregate after updating metadata before changing memberships.
 const latest=await apiUserDetail(current.userId);Object.assign(current,latest);
 saved=await apiUpdateUserRoles(current.userId,current.version,changes.roleIds);Object.assign(current,saved);
 }
 return saved;
}
async function editSystemUser(root,userId,back){
 root.innerHTML='<p role="status">Đang tải thông tin tài khoản…</p>';
 try{const current=await apiUserDetail(userId);if(!root.isConnected)return;
 const canUpdate=userApiGrant('WEB_USERS','canUpdate'),canRoles=userApiGrant('WEB_USERS','canApprove')&&apiSession()?.user?.userId!==userId;
 let busy=false,employeeId=current.employeeId??null,employeePage=1,employeeSearch='',searchGeneration=0;
 root.innerHTML=`<button type="button" class="btn" id="system-edit-back">← Danh sách tài khoản</button><form id="system-edit-form" class="user-registration"><fieldset class="user-edit-fieldset"><section class="user-form-section"><h2>Chỉnh sửa tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text',current.userId,'readonly')}${field('Email','email','email',current.email,`required maxlength="255" ${canUpdate?'':'readonly'}`)}</div></section><section class="user-form-section"><h2>Vai trò</h2><div id="system-edit-role-picker" class="user-role-picker">Đang tải vai trò…</div></section><section class="user-form-section"><h2>Liên kết nhân viên</h2><div id="system-linked-employee"></div>${canUpdate&&userApiGrant('WEB_EMPLOYEES','canView')?'<div class="toolbar user-employee-search"><input id="system-employee-search" placeholder="Tìm mã hoặc tên nhân viên" maxlength="150" aria-label="Tìm nhân viên"><button type="button" class="btn" id="system-employee-find">Tìm kiếm</button></div><div id="system-employee-results"></div>':'<p class="muted">Cần quyền xem nhân viên để tìm hồ sơ liên kết.</p>'}</section></fieldset><p id="system-edit-feedback" class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="btn" id="system-edit-cancel">Hủy</button><button type="submit" class="btn primary">Lưu lại</button></div></form>`;
 const form=root.querySelector('#system-edit-form'),feedback=root.querySelector('#system-edit-feedback');
 const leave=()=>{if(!busy)back();};root.querySelector('#system-edit-back').onclick=leave;root.querySelector('#system-edit-cancel').onclick=leave;
 let getRoles=()=>null,rolesReady=!canRoles;
 if(canRoles){try{const roles=await apiAllRoles();if(!root.isConnected)return;getRoles=mountUserRolePicker(root.querySelector('#system-edit-role-picker'),roles,current.roles||[]);rolesReady=true;}
 catch(err){if(!root.isConnected)return;root.querySelector('#system-edit-role-picker').textContent=err.message;}}
 else mountUserRolePicker(root.querySelector('#system-edit-role-picker'),[],current.roles||[],true);
 function linked(label){const area=root.querySelector('#system-linked-employee');area.innerHTML=employeeId?`<div class="user-employee-linked"><span>${e(label||'Đã liên kết hồ sơ nhân viên')}</span>${canUpdate?'<button type="button" class="btn danger" id="system-unlink-employee">Gỡ liên kết</button>':''}</div>`:'<p class="muted">Chưa liên kết nhân viên.</p>';
 area.querySelector('#system-unlink-employee')?.addEventListener('click',()=>{employeeId=null;linked();});}
 linked();
 async function findEmployees(){const results=root.querySelector('#system-employee-results');if(!results)return;const generation=++searchGeneration;results.innerHTML='<p>Đang tìm nhân viên…</p>';
 try{const result=await apiEmployees(new URLSearchParams({page:employeePage,pageSize:10,search:employeeSearch}).toString());if(!root.isConnected||generation!==searchGeneration)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
 results.innerHTML=result.data.map(employee=>`<div class="user-employee-result"><div><strong>${e(employee.fullName)}</strong><small>${e(employee.employeeCode)} · ${e(employee.email)}</small></div><button type="button" class="btn" data-link-employee="${e(employee.id)}">Liên kết</button></div>`).join('')||'<p>Không có nhân viên phù hợp.</p>';
 results.innerHTML+=`<div class="toolbar user-pagination"><button type="button" class="btn" id="system-employee-prev" ${employeePage<=1?'disabled':''}>Trước</button><span>Trang ${employeePage}</span><button type="button" class="btn" id="system-employee-next" ${employeePage*10>=result.total?'disabled':''}>Sau</button></div><p class="muted">Hồ sơ đã gắn tài khoản khác sẽ bị hệ thống từ chối khi lưu.</p>`;
 results.querySelectorAll('[data-link-employee]').forEach(button=>button.onclick=()=>{const employee=result.data.find(item=>String(item.id)===button.dataset.linkEmployee);employeeId=employee.id;linked(employee.fullName+' · '+employee.employeeCode);});
 results.querySelector('#system-employee-prev').onclick=()=>{employeePage--;findEmployees();};results.querySelector('#system-employee-next').onclick=()=>{employeePage++;findEmployees();};
 }catch(err){if(root.isConnected&&generation===searchGeneration)results.textContent=err.message;}}
 root.querySelector('#system-employee-find')?.addEventListener('click',()=>{employeeSearch=root.querySelector('#system-employee-search').value.trim();employeePage=1;findEmployees();});
 root.querySelector('#system-employee-search')?.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();root.querySelector('#system-employee-find').click();}});
 form.onsubmit=async ev=>{ev.preventDefault();ev.stopPropagation();if(busy)return;
 if(!rolesReady){feedback.textContent='Chưa tải được vai trò. Vui lòng mở lại tài khoản.';return;}
 busy=true;form.querySelector('fieldset').disabled=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Đang lưu…';feedback.textContent='';
 const previousVersion=current.version;
 try{await saveSystemUserChanges(current,{profile:canUpdate?{email:form.elements.email.value.trim(),employeeId}:null,roleIds:canRoles?getRoles():null});if(!root.isConnected)return;feedback.textContent='Đã lưu tài khoản thành công.';}
 catch(err){if(!root.isConnected)return;feedback.textContent=(current.version!==previousVersion?'Thông tin tài khoản đã được lưu; phần vai trò chưa lưu thành công. ':'')+err.message+' Nếu có xung đột phiên bản, mở lại tài khoản để tải dữ liệu mới.';}
 finally{busy=false;if(root.isConnected){form.querySelector('fieldset').disabled=false;submit.disabled=false;submit.textContent='Lưu lại';}}
 };
 }catch(err){if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="system-edit-error-back">Về danh sách</button>`;root.querySelector('#system-edit-error-back').onclick=back;}
}
