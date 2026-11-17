import {apiEmployees,apiEmployeeDetail,apiTransferEmployeeDepartment,apiUpdateEmployee,apiCreateEmployee,apiActiveDepartments,apiActivePositions,apiActiveTeams,apiSession} from '../../api/client.js';
import {e,dateLabel} from '../../utils.js';
import {details,field} from '../../components/ui.js';

const employeeStatuses={ACTIVE:'Đang làm việc',INACTIVE:'Ngừng hoạt động',TERMINATED:'Đã nghỉ việc'};
const employeeValue=value=>e(value||'—');
export function employeeCanUpdate(session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_EMPLOYEES'&&p.canUpdate==='Y');
}

function employeeRoleSwitch(kind,employee={},grant){
 const department=kind==='department',name=department?'isDepartmentManager':'isTeamLead',code=department?'WEB_DEPARTMENTS':'WEB_TEAMS';
 return `<label class="employee-inline-role"><span>${department?'Quản lý phòng ban':'Team Lead'}</span><span class="role-switch"><input type="checkbox" role="switch" name="${name}" ${employee[name]?'checked':''} ${grant(code,'canUpdate')&&(department||employee.teamId)?'':'disabled'}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;
}
export function employeeRolePayload(values){
 const flags={};
 for(const key of ['isDepartmentManager','isTeamLead']){
  if(values[key]===undefined||values[key]===null)continue;
  if(typeof values[key]!=='boolean')throw Error('Vai trò quản lý phải là giá trị boolean.');
  flags[key]=values[key];
 }
 if(flags.isTeamLead===true&&!values.teamId)throw Error('Vui lòng chọn team trước khi bổ nhiệm Team Lead.');
 return flags;
}
function employeeFormRoles(form,grant){
 const result={};
 for(const [key,code] of [['isDepartmentManager','WEB_DEPARTMENTS'],['isTeamLead','WEB_TEAMS']]){
  const input=form.elements[key];
  if(!input.disabled){if(!grant(code,'canUpdate'))throw Error('Bạn không có quyền thay đổi vai trò quản lý này.');result[key]=input.checked;}
 }
 return result;
}

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
 root.innerHTML=`<a class="btn" href="#/hr/employees">← Danh sách nhân viên</a><h2 class="role-editor-title">${e(employee.fullName)}</h2>${details([['Mã nhân viên',employeeValue(employee.employeeCode)],['Chức danh',employeeValue(employee.positionName)],['Phòng ban',employeeValue(employee.departmentName)+(employee.isDepartmentManager?' (Quản lý)':'')],['Team',employeeValue(employee.teamName)+(employee.isTeamLead?' (Quản lý)':'')],['Trạng thái',employeeValue(employeeStatuses[employee.employmentStatus]||employee.employmentStatus)],['Email',employeeValue(employee.email)],['Số điện thoại',employeeValue(employee.phoneNumber)],['Ngày sinh',employee.dateOfBirth?dateLabel(employee.dateOfBirth):'—'],['Ngày vào làm',employee.hireDate?dateLabel(employee.hireDate):'—']])}${employeeCanUpdate()?'<button type="button" class="btn primary" id="employee-profile-edit">Chỉnh sửa</button>':''}`;
 root.querySelector('#employee-profile-edit')?.addEventListener('click',()=>editEmployeeProfile(root,employee,load));
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


export function employeeCreationPayload(values){
 const fullName=String(values.fullName||'').trim(),email=String(values.email||'').trim(),phoneNumber=String(values.phoneNumber||'').trim()||null;
 if(!fullName||fullName.length>150)throw Error('Họ và tên bắt buộc, tối đa 150 ký tự.');
 if(!email||email.length>255||!/^\S+@\S+\.\S+$/.test(email))throw Error('Email không hợp lệ.');
 if(phoneNumber&&phoneNumber.length>20)throw Error('Số điện thoại tối đa 20 ký tự.');
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 const hireDate=values.hireDate,dateOfBirth=values.dateOfBirth||null;
 if(!validDate(hireDate))throw Error('Ngày vào làm không hợp lệ.');
 if(dateOfBirth&&(!validDate(dateOfBirth)||dateOfBirth>hireDate||dateOfBirth>new Date().toISOString().slice(0,10)))throw Error('Ngày sinh phải hợp lệ, không sau ngày vào làm hoặc trong tương lai.');
 const positiveId=(value,required=false)=>{if(!value&&!required)return null;const id=Number(value);if(!Number.isSafeInteger(id)||id<=0)throw Error('Vui lòng chọn danh mục hợp lệ.');return id;};
 if(!Object.hasOwn(employeeStatuses,values.employmentStatus))throw Error('Trạng thái nhân viên không hợp lệ.');
 return {fullName,email,phoneNumber,dateOfBirth,hireDate,departmentId:positiveId(values.departmentId,true),teamId:positiveId(values.teamId),positionId:positiveId(values.positionId),employmentStatus:values.employmentStatus,...employeeRolePayload(values)};
}

export function openEmployeeCreation({openDialog,closeDialog,toast,render}){
 const grant=(code,flag='canView')=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');
 if(!grant('WEB_EMPLOYEES','canNew'))throw Error('Bạn không có quyền thêm nhân viên.');
 openDialog('Thêm nhân viên',`<form id="employee-create-api" class="user-registration"><p class="muted">Mã nhân viên sẽ được hệ thống tự động tạo.</p><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Họ và tên','fullName','text','','required maxlength="150"')}${field('Email','email','email','','required maxlength="255"')}${field('Số điện thoại','phoneNumber','tel','','maxlength="20"')}${field('Ngày sinh','dateOfBirth','date','')}${field('Ngày vào làm','hireDate','date','','required')}<div class="employee-assignment-field"><label>Phòng ban<select name="departmentId" required disabled><option value="">Đang tải phòng ban…</option></select></label>${employeeRoleSwitch('department',{},grant)}</div><label>Chức danh (tùy chọn)<select name="positionId" disabled><option value="">Chưa chọn chức danh</option></select></label><div class="employee-assignment-field"><label>Team (tùy chọn)<select name="teamId" disabled><option value="">Chọn phòng ban trước</option></select></label>${employeeRoleSwitch('team',{},grant)}</div><label>Trạng thái<select name="employmentStatus">${Object.entries(employeeStatuses).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label></div><div id="employee-catalog-feedback"></div><div class="form-actions"><button type="button" class="btn" id="employee-create-cancel">Hủy</button><button type="submit" class="btn primary" id="employee-create-submit" disabled>Thêm nhân viên</button></div></fieldset><p id="employee-create-feedback" role="alert"></p></form>`);
 const form=document.getElementById('employee-create-api'),feedback=form.querySelector('#employee-create-feedback'),catalogFeedback=form.querySelector('#employee-catalog-feedback'),submit=form.querySelector('#employee-create-submit'),fieldset=form.querySelector('fieldset');
 let busy=false,departmentReady=false,teamGeneration=0,departments=[],positions=[],teams=[];
 const current=()=>form.isConnected&&document.getElementById('employee-create-api')===form;
 const options=(select,items,name,placeholder)=>{select.innerHTML=`<option value="">${placeholder}</option>`+items.map(item=>`<option value="${e(item.id)}">${e(item[name])}</option>`).join('');select.disabled=false;};
 const catalogError=(key,message,retry)=>{let panel=form.querySelector(`[data-catalog-error="${key}"]`);if(!panel){panel=document.createElement('p');panel.dataset.catalogError=key;catalogFeedback.append(panel);}panel.innerHTML=`<span role="status">${e(message)}</span>${retry?' <button type="button" class="btn">Thử lại</button>':''}`;if(retry)panel.querySelector('button').onclick=()=>{panel.remove();retry();};};
 async function loadDepartments(){
  if(!grant('WEB_DEPARTMENTS')){form.elements.departmentId.innerHTML='<option value="">Không có quyền xem phòng ban</option>';catalogError('department','Bạn cần quyền xem phòng ban để chọn phòng ban khi tạo nhân viên.');return;}
  try{const items=await apiActiveDepartments();if(!current())return;departments=items;options(form.elements.departmentId,items,'departmentName','Chọn phòng ban');departmentReady=items.length>0;submit.disabled=!departmentReady;if(!items.length)catalogError('department','Chưa có phòng ban hoạt động.');}
  catch(err){if(current())catalogError('department',err.message,loadDepartments);}
 }
 async function loadPositions(){
  if(!grant('WEB_POSITIONS')){catalogError('position','Bạn chưa có quyền xem chức danh; nhân viên sẽ được tạo chưa có chức danh.');return;}
  try{const items=await apiActivePositions();if(current()){positions=items;options(form.elements.positionId,items,'name','Chưa chọn chức danh');}}
  catch(err){if(current())catalogError('position',err.message,loadPositions);}
 }
 async function loadTeams(){
  const generation=++teamGeneration,departmentId=form.elements.departmentId.value,select=form.elements.teamId;
  teams=[];form.elements.isTeamLead.checked=false;form.elements.isTeamLead.disabled=true;select.disabled=true;select.innerHTML='<option value="">Chưa chọn team</option>';form.querySelector('[data-catalog-error="team"]')?.remove();
  if(!departmentId)return;
  if(!grant('WEB_TEAMS')){catalogError('team','Bạn chưa có quyền xem team; nhân viên sẽ được tạo chưa có team.');return;}
  select.innerHTML='<option value="">Đang tải team…</option>';
  try{const items=await apiActiveTeams(departmentId);if(current()&&generation===teamGeneration){teams=items;options(select,items,'teamName','Chưa chọn team');}}
  catch(err){if(current()&&generation===teamGeneration){select.innerHTML='<option value="">Chưa chọn team</option>';catalogError('team',err.message,loadTeams);}}
 }
 form.elements.departmentId.onchange=()=>{loadTeams();};
 form.elements.teamId.onchange=()=>{form.elements.isTeamLead.checked=false;form.elements.isTeamLead.disabled=!form.elements.teamId.value||!grant('WEB_TEAMS','canUpdate');};
 form.querySelector('#employee-create-cancel').onclick=()=>{if(!busy)closeDialog();};
 form.onsubmit=async event=>{
  event.preventDefault();event.stopPropagation();if(busy)return;
  feedback.textContent='';
  try{
   if(!grant('WEB_EMPLOYEES','canNew'))throw Error('Bạn không có quyền thêm nhân viên.');
   if(!departmentReady)throw Error('Vui lòng tải và chọn phòng ban.');
   const payload=employeeCreationPayload({...Object.fromEntries(new FormData(form)),...employeeFormRoles(form,grant)});
   if(!departments.some(item=>Number(item.id)===payload.departmentId)||payload.positionId&&!positions.some(item=>Number(item.id)===payload.positionId)||payload.teamId&&!teams.some(item=>Number(item.id)===payload.teamId&&Number(item.departmentId)===payload.departmentId))throw Error('Danh mục đã chọn không hợp lệ. Vui lòng chọn lại.');
   busy=true;fieldset.disabled=true;submit.textContent='Đang tạo…';
   const employee=await apiCreateEmployee(payload);
   if(current()){closeDialog();if(globalThis.location?.hash?.split('?')[0]==='#/hr/employees')render();}
   toast(`Đã thêm nhân viên · ${employee.employeeCode}`);
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{busy=false;if(current()){fieldset.disabled=false;submit.disabled=!departmentReady;submit.textContent='Thêm nhân viên';}}
 };
 loadDepartments();loadPositions();
}


export function employeeUpdatePayload(values,employee){
 const validated=employeeCreationPayload({...values,teamId:values.teamId===undefined?employee.teamId:values.teamId,positionId:values.positionId===undefined?employee.positionId:values.positionId,hireDate:employee.hireDate?.slice(0,10),departmentId:employee.departmentId});
 const {hireDate,departmentId,...payload}=validated;
 if(values.teamId===undefined)delete payload.teamId;
 return payload;
}

async function editEmployeeProfile(root,employee,onBack,draft={}){
 if(!employeeCanUpdate())return;
 const grant=(code,flag='canView')=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p[flag]==='Y');
 root.innerHTML=`<h2 class="role-editor-title">Chỉnh sửa hồ sơ nhân viên</h2><p class="muted">${e(employee.employeeCode)} · ${e(employee.departmentName||'—')} · Ngày vào làm: ${employee.hireDate?dateLabel(employee.hireDate):'—'}</p><form id="employee-profile-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Họ và tên','fullName','text',employee.fullName||'','required maxlength="150"')}${field('Email','email','email',employee.email||'','required maxlength="255"')}${field('Số điện thoại','phoneNumber','tel',employee.phoneNumber||'','maxlength="20"')}${field('Ngày sinh','dateOfBirth','date',employee.dateOfBirth?.slice(0,10)||'')}<div class="employee-assignment-field"><label>Phòng ban<select name="departmentId" disabled><option value="${e(employee.departmentId)}">${e(employee.departmentName||'—')}</option></select></label>${employeeRoleSwitch('department',employee,grant)}</div><label>Chức danh<select name="positionId" disabled><option value="${e(employee.positionId||'')}">${e(employee.positionName||'Chưa có chức danh')}</option></select></label><div class="employee-assignment-field"><label>Team<select name="teamId" disabled><option value="${e(employee.teamId||'')}">${e(employee.teamName||'Chưa có team')}</option></select></label>${employeeRoleSwitch('team',employee,grant)}</div><label>Trạng thái<select name="employmentStatus">${Object.entries(employeeStatuses).map(([value,label])=>`<option value="${value}" ${value===employee.employmentStatus?'selected':''}>${label}</option>`).join('')}</select></label></div><section id="employee-transfer-section" hidden><p class="muted">Chuyển nhân viên sang phòng ban và team đã chọn trước khi lưu hồ sơ hoặc bổ nhiệm quản lý. Cần quyền chuyển phòng trong phạm vi ALL.</p><div class="form-grid">${field('Ngày hiệu lực chuyển phòng','effectiveDate','date',new Date().toISOString().slice(0,10),`min="${e(employee.hireDate?.slice(0,10)||'')}" max="${new Date().toISOString().slice(0,10)}"`)}<label>Lý do chuyển phòng<textarea name="transferReason" maxlength="500"></textarea></label></div><button type="button" class="btn" id="employee-transfer-submit">Áp dụng chuyển phòng</button></section><div id="employee-edit-catalog-feedback"></div><div class="form-actions"><button type="button" class="btn" id="employee-edit-cancel">Hủy</button><button type="submit" class="btn primary">Lưu thay đổi</button></div></fieldset><p id="employee-edit-feedback" role="alert"></p></form>`;
 const form=root.querySelector('#employee-profile-form'),fieldset=form.querySelector('fieldset'),feedback=form.querySelector('#employee-edit-feedback'),catalogFeedback=form.querySelector('#employee-edit-catalog-feedback');
 const current=()=>root.isConnected&&root.querySelector('#employee-profile-form')===form;
 let saving=false,teamRequest=0;
 for(const key of ['fullName','email','phoneNumber','dateOfBirth','employmentStatus'])if(draft[key]!==undefined)form.elements[key].value=draft[key];
 const changedDepartment=()=>String(form.elements.departmentId.value)!==String(employee.departmentId);
 const syncSelection=()=>{
  const changed=changedDepartment();
  form.querySelector('#employee-transfer-section').hidden=!changed;
  form.querySelector('[type="submit"]').disabled=changed;
  form.elements.isDepartmentManager.disabled=changed||!grant('WEB_DEPARTMENTS','canUpdate');
  form.elements.isTeamLead.disabled=changed||!form.elements.teamId.value||!grant('WEB_TEAMS','canUpdate');
 };
 async function catalog(name,code,fetchItems,label){
  if(!grant(code))return;
  try{
   const selectedDepartment=form.elements.departmentId.value;
   const items=await fetchItems();if(!current()||name==='teamId'&&String(form.elements.departmentId.value)!==String(selectedDepartment))return;
   const id=employee[name],title=name==='departmentId'?employee.departmentName:name==='teamId'?employee.teamName:employee.positionName,select=form.elements[name];
   const available=[...items];if(id&&!available.some(item=>String(item.id)===String(id)))available.unshift({id,[label]:title||String(id)});
   select.innerHTML='<option value="">Chưa chọn</option>'+available.map(item=>`<option value="${e(item.id)}" ${String(item.id)===String(id)?'selected':''}>${e(item[label])}</option>`).join('');select.disabled=false;syncSelection();
  }catch(err){if(current()){const message=document.createElement('p');message.setAttribute('role','status');message.textContent=`${err.message}. Giữ nguyên ${name==='teamId'?'team':'chức danh'} hiện tại. `;const retry=document.createElement('button');retry.type='button';retry.className='btn';retry.textContent='Thử lại';retry.onclick=()=>{message.remove();catalog(name,code,fetchItems,label);};message.append(retry);catalogFeedback.append(message);}}
 }
 async function loadSelectedTeams(){
  const request=++teamRequest,departmentId=form.elements.departmentId.value,select=form.elements.teamId;
  select.disabled=true;select.innerHTML='<option value="">Chưa chọn team</option>';
  form.elements.isTeamLead.checked=false;syncSelection();
  if(!departmentId||!grant('WEB_TEAMS'))return;
  try{
   const items=await apiActiveTeams(departmentId);if(!current()||request!==teamRequest)return;
   const available=[...items];
   if(!changedDepartment()&&employee.teamId&&!available.some(item=>String(item.id)===String(employee.teamId)))available.unshift({id:employee.teamId,teamName:employee.teamName||String(employee.teamId)});
   select.innerHTML='<option value="">Chưa chọn team</option>'+available.map(item=>`<option value="${e(item.id)}" ${!changedDepartment()&&String(item.id)===String(employee.teamId)?'selected':''}>${e(item.teamName)}</option>`).join('');select.disabled=false;
   if(!changedDepartment())form.elements.isTeamLead.checked=!!employee.isTeamLead;
   syncSelection();
  }catch(err){if(current()&&request===teamRequest){feedback.textContent=err.message;}}
 }
 form.elements.departmentId.onchange=()=>{
  form.elements.isDepartmentManager.checked=changedDepartment()?false:!!employee.isDepartmentManager;
  loadSelectedTeams();
 };
 form.elements.teamId.onchange=()=>{if(!form.elements.teamId.value)form.elements.isTeamLead.checked=false;syncSelection();};
 form.querySelector('#employee-transfer-submit').onclick=async()=>{
  if(saving||!changedDepartment())return;
  feedback.textContent='';
  try{
   if(!employeeCanUpdate())throw Error('Bạn không có quyền chuyển phòng ban.');
   const values=Object.fromEntries(new FormData(form));
   const payload=employeeTransferPayload(values,employee);
   saving=true;fieldset.disabled=true;
   const transferred=await apiTransferEmployeeDepartment(employee.id,payload);
   if(current()){
    await editEmployeeProfile(root,transferred,onBack,values);
    const note=root.querySelector('#employee-edit-feedback');if(note)note.textContent='Đã chuyển phòng ban. Bạn có thể tiếp tục chỉnh sửa và bổ nhiệm quản lý.';
   }
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{saving=false;if(current()){fieldset.disabled=false;syncSelection();}}
 };
 syncSelection();
 form.querySelector('#employee-edit-cancel').onclick=()=>{if(!saving)onBack();};
 form.onsubmit=async event=>{
  event.preventDefault();event.stopPropagation();if(saving)return;
  feedback.textContent='';
  try{
   if(!employeeCanUpdate())throw Error('Bạn không có quyền chỉnh sửa hồ sơ nhân viên.');
   if(changedDepartment())throw Error('Vui lòng áp dụng chuyển phòng trước khi lưu hồ sơ.');
   const values={...Object.fromEntries(new FormData(form)),...employeeFormRoles(form,grant)};
   if(form.elements.positionId.disabled)values.positionId=employee.positionId??'';
   if(form.elements.teamId.disabled)values.teamId=employee.teamId??'';
   if(employee.isTeamLead&&!values.teamId&&grant('WEB_TEAMS','canUpdate'))values.isTeamLead=false;
   const payload=employeeUpdatePayload(values,employee);
   saving=true;fieldset.disabled=true;
   await apiUpdateEmployee(employee.id,payload);
   if(current())await onBack();
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{saving=false;if(current())fieldset.disabled=false;}
 };
 await Promise.allSettled([catalog('departmentId','WEB_DEPARTMENTS',apiActiveDepartments,'departmentName'),catalog('positionId','WEB_POSITIONS',apiActivePositions,'name'),catalog('teamId','WEB_TEAMS',()=>apiActiveTeams(employee.departmentId),'teamName')]);
}

export function employeeTransferPayload(values,employee){
 const departmentId=Number(values.departmentId),teamId=values.teamId?Number(values.teamId):null;
 if(!Number.isSafeInteger(departmentId)||departmentId<=0||departmentId===Number(employee.departmentId))throw Error('Vui lòng chọn phòng ban đích khác phòng ban hiện tại.');
 if(teamId!==null&&(!Number.isSafeInteger(teamId)||teamId<=0))throw Error('Team không hợp lệ.');
 const effectiveDate=values.effectiveDate,today=new Date().toISOString().slice(0,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)||Number.isNaN(Date.parse(effectiveDate))||new Date(effectiveDate).toISOString().slice(0,10)!==effectiveDate||effectiveDate<employee.hireDate?.slice(0,10)||effectiveDate>today)throw Error('Ngày chuyển phòng phải hợp lệ, từ ngày vào làm đến hôm nay.');
 return {departmentId,teamId,effectiveDate,reason:String(values.transferReason||'').trim()||null};
}
