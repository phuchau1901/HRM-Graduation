import {apiUsers,apiAllRoles,apiActiveDepartments,apiActiveTeams,apiActivePositions,apiCreateUser,apiSession,apiUnlinkedEmployees,apiResetUserPassword,apiUserDetail,apiUpdateUser,apiUpdateUserRoles} from '../api/client.js';
import {e} from '../utils.js';
import {field} from '../components/ui.js';

function userApiGrant(code,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');}
export async function registerSystemUser(input){
 const {employeeId,...account}=input.account;
 if(input.employee){
 const {employeeCode,...employee}=input.employee;
 return apiCreateUser({...account,createEmployee:true,employee});
 }
 return apiCreateUser({...account,createEmployee:false,employeeId:employeeId??null});
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
 let departments=null,departmentsLoading=false,busy=false,teams=[],teamsLoading=false,teamGeneration=0,positions=null,positionsLoading=false;
 const canTeams=userApiGrant('WEB_TEAMS','canView'),canPositions=userApiGrant('WEB_POSITIONS','canView');
 root.innerHTML=`<a class="btn" href="#/admin/users">← Danh sách tài khoản</a><form id="system-user-register" class="user-registration"><section class="user-form-section"><h2>Thông tin tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text','','required maxlength="100" pattern="[A-Za-z0-9][A-Za-z0-9_.-]*" autocomplete="off"')}${field('Email','email','email','','required maxlength="255" autocomplete="off"')}${field('Mật khẩu','password','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}${field('Nhập lại mật khẩu','confirmPassword','password','','required minlength="12" maxlength="128" autocomplete="new-password"')}</div></section><section class="user-form-section"><h2>Vai trò</h2><p class="muted">Có thể chọn nhiều vai trò cho tài khoản.</p><div id="system-role-options" class="user-role-picker">${canAssign?'Đang tải vai trò…':'Bạn chưa có quyền gán vai trò. Tài khoản sẽ được tạo chưa có vai trò.'}</div></section><section class="user-form-section"><label class="role-toggle-row"><span><strong>Tạo kèm hồ sơ nhân viên</strong><small class="user-field-note">Tạo và liên kết cùng lúc; mã nhân viên được hệ thống tự cấp</small></span><span class="role-switch"><input type="checkbox" role="switch" name="createEmployee" ${canEmployee?'':'disabled'}><span class="role-switch-track" aria-hidden="true"></span></span></label>${!canEmployee?'<p class="muted">Bạn chưa có quyền tạo hồ sơ nhân viên.</p>':''}<fieldset id="system-employee-fields" hidden disabled><div class="form-grid">${field('Email nhân viên','employeeEmail','email','','required maxlength="255" autocomplete="off"')}${field('Họ và tên','fullName','text','','required maxlength="150"')}${field('Ngày sinh','dateOfBirth','date','','')}${field('Số điện thoại','phoneNumber','tel','','maxlength="20"')}${field('Ngày vào làm','hireDate','date','','required')}<label>Phòng ban<select name="departmentId" required><option value="">Chọn phòng ban</option></select></label><label>Chức danh (tùy chọn)<select name="positionId" disabled><option value="">Chưa chọn chức danh</option></select></label><label>Team (tùy chọn)<select name="teamId" disabled><option value="">Chọn phòng ban trước</option></select></label></div><p id="system-position-feedback" role="status"></p><p id="system-team-feedback" role="status"></p><p id="system-department-error" role="alert"></p></fieldset></section><p id="system-register-feedback" class="form-error" role="alert"></p><div class="form-actions"><a class="btn" href="#/admin/users">Hủy</a><button type="submit" class="btn primary" id="system-register-submit">Đăng ký tài khoản</button></div></form>`;
 const form=root.querySelector('#system-user-register'),feedback=root.querySelector('#system-register-feedback'),employeeFields=root.querySelector('#system-employee-fields');
 async function loadDepartments(){if(departmentsLoading)return;departmentsLoading=true;const error=root.querySelector('#system-department-error');error.textContent='Đang tải phòng ban…';
 try{departments=await apiActiveDepartments();if(!root.isConnected)return;form.elements.departmentId.innerHTML='<option value="">Chọn phòng ban</option>'+departments.map(dep=>`<option value="${e(dep.id)}">${e(dep.departmentName)}</option>`).join('');error.textContent=departments.length?'':'Chưa có phòng ban đang hoạt động.';}
 catch(err){if(!root.isConnected)return;error.textContent=err.message;}finally{departmentsLoading=false;}}
 async function loadPositions(){
 if(positionsLoading||positions!==null)return;
 const select=form.elements.positionId,note=root.querySelector('#system-position-feedback');
 if(!canPositions){note.textContent='Cần quyền WEB_POSITIONS/VIEW để chọn chức danh. Có thể tạo nhân viên chưa gán chức danh.';return;}
 positionsLoading=true;select.disabled=true;note.textContent='Đang tải chức danh…';
 try{const result=await apiActivePositions();if(!form.isConnected)return;
 positions=result;select.innerHTML='<option value="">Chưa chọn chức danh</option>'+positions.map(position=>`<option value="${e(position.id)}">${e(position.name)} (${e(position.code)})</option>`).join('');select.disabled=false;
 note.textContent=positions.length?'':'Chưa có chức danh đang hoạt động.';
 }catch(err){if(form.isConnected)note.textContent=err.message;}
 finally{positionsLoading=false;}
 }
 async function loadTeams(){
 const generation=++teamGeneration,departmentId=form.elements.departmentId.value,select=form.elements.teamId,note=root.querySelector('#system-team-feedback');
 teams=[];teamsLoading=false;select.disabled=true;select.innerHTML='<option value="">Không gán team</option>';note.textContent='';
 if(!departmentId){select.innerHTML='<option value="">Chọn phòng ban trước</option>';return;}
 if(!canTeams){note.textContent='Cần quyền WEB_TEAMS/VIEW để chọn team. Có thể tạo nhân viên chưa gán team.';return;}
 teamsLoading=true;note.textContent='Đang tải team…';
 try{const result=await apiActiveTeams(departmentId);if(!form.isConnected||generation!==teamGeneration)return;
 teams=result;select.innerHTML='<option value="">Không gán team</option>'+teams.map(team=>`<option value="${e(team.id)}">${e(team.teamName)} (${e(team.teamCode)})</option>`).join('');
 select.disabled=false;note.textContent=teams.length?'':'Phòng ban chưa có team đang hoạt động.';
 }catch(err){if(form.isConnected&&generation===teamGeneration){note.textContent=err.message;}}
 finally{if(generation===teamGeneration)teamsLoading=false;}
 }
 form.elements.departmentId.onchange=loadTeams;
 form.elements.createEmployee.onchange=()=>{employeeFields.hidden=!form.elements.createEmployee.checked;employeeFields.disabled=!form.elements.createEmployee.checked;if(form.elements.createEmployee.checked){if(!departments)loadDepartments();loadPositions();}};
 let rolesReady=!canAssign;
 if(canAssign){apiAllRoles().then(roles=>{if(!root.isConnected)return;rolesReady=true;mountUserRolePicker(root.querySelector('#system-role-options'),roles);}).catch(err=>{if(!root.isConnected)return;root.querySelector('#system-role-options').textContent=err.message+' Quay lại trang đăng ký để tải lại vai trò.';});}
 form.onsubmit=async ev=>{ev.preventDefault();ev.stopPropagation();if(busy)return;feedback.textContent='';
 if(!rolesReady){feedback.textContent='Chưa tải được danh sách vai trò. Vui lòng thử lại.';return;}
 const data=new FormData(form),staff=form.elements.createEmployee.checked;
 if(data.get('password')!==data.get('confirmPassword')){feedback.textContent='Mật khẩu nhập lại không khớp.';return;}
 if(staff&&(!departments||departmentsLoading||!departments.some(dep=>String(dep.id)===data.get('departmentId')))){feedback.textContent='Vui lòng chọn phòng ban hợp lệ.';return;}
 if(staff&&data.get('dateOfBirth')&&data.get('dateOfBirth')>data.get('hireDate')){feedback.textContent='Ngày sinh phải trước hoặc bằng ngày vào làm.';return;}
 const selectedPosition=data.get('positionId');
 if(staff&&selectedPosition&&(positionsLoading||!positions?.some(position=>String(position.id)===selectedPosition))){feedback.textContent='Vui lòng chọn chức danh hợp lệ đang hoạt động.';return;}
 const selectedTeam=data.get('teamId');
 if(staff&&selectedTeam&&(teamsLoading||!teams.some(team=>String(team.id)===selectedTeam&&Number(team.departmentId)===Number(data.get('departmentId'))))){feedback.textContent='Vui lòng chọn team hợp lệ thuộc phòng ban đã chọn.';return;}
 const account={userId:data.get('userId').trim(),email:data.get('email').trim(),password:data.get('password'),roleIds:data.getAll('roleIds').map(Number)};
 const employee=staff?{fullName:data.get('fullName').trim(),email:data.get('employeeEmail').trim(),teamId:selectedTeam?Number(selectedTeam):null,positionId:selectedPosition?Number(selectedPosition):null,dateOfBirth:data.get('dateOfBirth')||null,phoneNumber:data.get('phoneNumber').trim()||null,hireDate:data.get('hireDate'),departmentId:Number(data.get('departmentId')),employmentStatus:'ACTIVE'}:null;
 busy=true;const submit=root.querySelector('#system-register-submit');submit.disabled=true;submit.textContent='Đang đăng ký…';form.elements.createEmployee.disabled=true;
 try{const created=await registerSystemUser({account,employee});if(!root.isConnected)return;form.reset();root.innerHTML=`<div class="empty"><h2>Đăng ký tài khoản thành công</h2><p>Tài khoản và các vai trò đã được lưu vào hệ thống.</p>${created?.employeeCode?`<p>Mã nhân viên: <strong>${e(created.employeeCode)}</strong></p>`:''}<a class="btn primary" href="#/admin/users">Về danh sách tài khoản</a></div>`;}
 catch(err){if(!root.isConnected)return;feedback.textContent=err.message;}
 finally{busy=false;if(root.isConnected&&submit.isConnected){submit.disabled=false;submit.textContent='Đăng ký tài khoản';form.elements.createEmployee.disabled=!canEmployee;}}

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
 if(changes.newPassword){
 const latest=await apiUserDetail(current.userId);Object.assign(current,latest);
 saved=await apiResetUserPassword(current.userId,current.version,{type:'ADMIN_RESET',newPassword:changes.newPassword});
 if(!saved?.version)throw Error('Chưa nhận phiên bản sau đổi mật khẩu. Hãy mở lại tài khoản để xác nhận.');
 Object.assign(current,saved);
 }
 return saved;
}
async function editSystemUser(root,userId,back){
 root.innerHTML='<p role="status">Đang tải thông tin tài khoản…</p>';
 try{const current=await apiUserDetail(userId);if(!root.isConnected)return;
 const canUpdate=userApiGrant('WEB_USERS','canUpdate'),canRoles=userApiGrant('WEB_USERS','canApprove')&&apiSession()?.user?.userId!==userId;
 let busy=false,employeeId=current.employeeId??null,employeePage=1,employeeSearch='',searchGeneration=0;
 root.innerHTML=`<button type="button" class="btn" id="system-edit-back">← Danh sách tài khoản</button><form id="system-edit-form" class="user-registration"><fieldset class="user-edit-fieldset"><section class="user-form-section"><h2>Chỉnh sửa tài khoản</h2><div class="form-grid">${field('Tên đăng nhập','userId','text',current.userId,'readonly')}${field('Email','email','email',current.email,`required maxlength="255" ${canUpdate?'':'readonly'}`)}<div class="user-password-field"><label for="system-new-password">Mật khẩu</label><div class="user-password-control"><input id="system-new-password" name="newPassword" type="password" placeholder="********" minlength="12" maxlength="128" autocomplete="new-password" ${canRoles?'':'disabled'}><button type="button" class="btn" id="system-password-eye" aria-label="Xem mật khẩu mới" aria-pressed="false" ${canRoles?'':'disabled'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><small class="muted">Để trống để giữ nguyên mật khẩu. Nút mắt chỉ hiển thị mật khẩu mới bạn nhập.</small></div></div></section><section class="user-form-section"><h2>Vai trò</h2><div id="system-edit-role-picker" class="user-role-picker">Đang tải vai trò…</div></section><section class="user-form-section"><h2>Liên kết nhân viên</h2><div id="system-linked-employee"></div>${canUpdate&&userApiGrant('WEB_EMPLOYEES','canView')?'<div class="toolbar user-employee-search"><input id="system-employee-search" placeholder="Tìm mã hoặc tên nhân viên" maxlength="150" aria-label="Tìm nhân viên"><button type="button" class="btn" id="system-employee-find">Tìm kiếm</button></div><div id="system-employee-results"></div>':'<p class="muted">Cần quyền xem nhân viên để tìm hồ sơ liên kết.</p>'}</section></fieldset><p id="system-edit-feedback" class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="btn" id="system-edit-cancel">Hủy</button><button type="submit" class="btn primary">Lưu lại</button></div></form>`;
 const form=root.querySelector('#system-edit-form'),feedback=root.querySelector('#system-edit-feedback');
 const passwordInput=form.elements.newPassword;
 root.querySelector('#system-password-eye')?.addEventListener('click',ev=>{
 const visible=passwordInput.type==='password';passwordInput.type=visible?'text':'password';
 ev.currentTarget.setAttribute('aria-pressed',String(visible));ev.currentTarget.setAttribute('aria-label',visible?'Ẩn mật khẩu mới':'Xem mật khẩu mới');
 });

 const leave=()=>{if(!busy)back();};root.querySelector('#system-edit-back').onclick=leave;root.querySelector('#system-edit-cancel').onclick=leave;
 let getRoles=()=>null,rolesReady=!canRoles;
 if(canRoles){try{const roles=await apiAllRoles();if(!root.isConnected)return;getRoles=mountUserRolePicker(root.querySelector('#system-edit-role-picker'),roles,current.roles||[]);rolesReady=true;}
 catch(err){if(!root.isConnected)return;root.querySelector('#system-edit-role-picker').textContent=err.message;}}
 else mountUserRolePicker(root.querySelector('#system-edit-role-picker'),[],current.roles||[],true);
 function linked(label){const area=root.querySelector('#system-linked-employee');area.innerHTML=employeeId?`<div class="user-employee-linked"><span>${e(label||'Đã liên kết hồ sơ nhân viên')}</span>${canUpdate?'<button type="button" class="btn danger" id="system-unlink-employee">Gỡ liên kết</button>':''}</div>`:'<p class="muted">Chưa liên kết nhân viên.</p>';
 area.querySelector('#system-unlink-employee')?.addEventListener('click',()=>{employeeId=null;linked();});}
 linked();
 async function findEmployees(){const results=root.querySelector('#system-employee-results');if(!results)return;const generation=++searchGeneration;results.innerHTML='<p>Đang tìm nhân viên…</p>';
 try{const result=await apiUnlinkedEmployees(new URLSearchParams({page:employeePage,pageSize:10,search:employeeSearch}).toString());if(!root.isConnected||generation!==searchGeneration)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
 results.innerHTML=result.data.map(employee=>`<div class="user-employee-result"><div><strong>${e(employee.fullName)}</strong><small>${e(employee.employeeCode)} · ${e(employee.email)}</small></div><button type="button" class="btn" data-link-employee="${e(employee.id)}">Liên kết</button></div>`).join('')||'<p>Không có nhân viên chưa liên kết phù hợp.</p>';
 results.innerHTML+=`<div class="toolbar user-pagination"><button type="button" class="btn" id="system-employee-prev" ${employeePage<=1?'disabled':''}>Trước</button><span>Trang ${employeePage}</span><button type="button" class="btn" id="system-employee-next" ${employeePage*10>=result.total?'disabled':''}>Sau</button></div><p class="muted">Danh sách chỉ gồm nhân viên chưa liên kết tài khoản trong phạm vi bạn được xem.</p>`;
 results.querySelectorAll('[data-link-employee]').forEach(button=>button.onclick=()=>{const employee=result.data.find(item=>String(item.id)===button.dataset.linkEmployee);employeeId=employee.id;linked(employee.fullName+' · '+employee.employeeCode);});
 results.querySelector('#system-employee-prev').onclick=()=>{employeePage--;findEmployees();};results.querySelector('#system-employee-next').onclick=()=>{employeePage++;findEmployees();};
 }catch(err){if(root.isConnected&&generation===searchGeneration)results.textContent=err.message;}}
 if(canUpdate&&userApiGrant('WEB_EMPLOYEES','canView'))findEmployees();
 root.querySelector('#system-employee-find')?.addEventListener('click',()=>{employeeSearch=root.querySelector('#system-employee-search').value.trim();employeePage=1;findEmployees();});
 root.querySelector('#system-employee-search')?.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();root.querySelector('#system-employee-find').click();}});
 form.onsubmit=async ev=>{ev.preventDefault();ev.stopPropagation();if(busy)return;
 if(!rolesReady){feedback.textContent='Chưa tải được vai trò. Vui lòng mở lại tài khoản.';return;}
 busy=true;form.querySelector('fieldset').disabled=true;const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Đang lưu…';feedback.textContent='';
 const previousVersion=current.version;
 try{await saveSystemUserChanges(current,{profile:canUpdate?{email:form.elements.email.value.trim(),employeeId}:null,roleIds:canRoles?getRoles():null,newPassword:canRoles?passwordInput.value:undefined});if(!root.isConnected)return;passwordInput.value='';passwordInput.type='password';root.querySelector('#system-password-eye')?.setAttribute('aria-pressed','false');feedback.textContent='Đã lưu tài khoản thành công.';findEmployees();}
 catch(err){if(!root.isConnected)return;feedback.textContent=(current.version!==previousVersion?'Một phần thay đổi đã được lưu; các thay đổi còn lại chưa hoàn tất. ':'')+err.message+' Nếu có xung đột phiên bản, mở lại tài khoản để tải dữ liệu mới.';}
 finally{busy=false;if(root.isConnected){form.querySelector('fieldset').disabled=false;submit.disabled=false;submit.textContent='Lưu lại';}}
 };
 }catch(err){if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="system-edit-error-back">Về danh sách</button>`;root.querySelector('#system-edit-error-back').onclick=back;}
}
