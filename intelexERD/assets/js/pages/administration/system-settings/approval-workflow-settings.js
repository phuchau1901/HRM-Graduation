import {apiApprovalWorkflowSettings,apiEmployees,apiSession} from '../../../api/client.js';
import {e} from '../../../utils.js';

export const workflowRouteTypes={LEAVE:'Nghỉ phép',LEAVE_CANCELLATION:'Hủy nghỉ phép',OVERTIME:'Tăng ca',ATTENDANCE_ADJUSTMENT:'Điều chỉnh công',KPI_EVALUATION:'Đánh giá KPI',PAYROLL_PERIOD:'Kỳ lương'};
const workflowApprovers={TEAM_LEAD:'Trưởng team',DEPARTMENT_MANAGER:'Quản lý phòng ban',USER:'Nhân viên được chỉ định',HR:'HR (tương thích cũ)'};
export function approvalSettingsGrant(flag,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_APPROVAL_SETTINGS'&&p.canView==='Y'&&p[flag]==='Y');}
export function approvalSettingsPayload(version,routes){
 if(!Number.isSafeInteger(version)||version<0)throw Error('Phiên bản cấu hình không hợp lệ.');
 if(!Array.isArray(routes)||routes.length<1||routes.length>Object.keys(workflowRouteTypes).length)throw Error('Cần từ 1 đến '+Object.keys(workflowRouteTypes).length+' loại quy trình.');
 const used=new Set();
 const normalized=routes.map(route=>{
  if(!Object.hasOwn(workflowRouteTypes,route.requestType)||used.has(route.requestType))throw Error('Loại yêu cầu không hợp lệ hoặc bị trùng.');used.add(route.requestType);
  if(typeof route.allowSelfApproval!=='boolean')throw Error('Cho phép tự duyệt phải là giá trị bật/tắt.');
  if(!Array.isArray(route.steps)||route.steps.length<1||route.steps.length>10)throw Error('Mỗi quy trình cần từ 1 đến 10 bước duyệt.');
  if(route.requestType==='PAYROLL_PERIOD'&&(route.allowSelfApproval||route.steps.some(step=>step.approverType==='TEAM_LEAD')))throw Error('Quy trình kỳ lương không được tự duyệt hoặc dùng Trưởng team; chọn HR, nhân viên chỉ định hoặc Quản lý phòng ban phù hợp.');
  return {requestType:route.requestType,allowSelfApproval:route.allowSelfApproval,steps:route.steps.map(step=>{
   if(!Object.hasOwn(workflowApprovers,step.approverType))throw Error('Loại người duyệt không hợp lệ.');
   if(step.approverType==='USER'){
    const employeeId=Number(step.employeeId);
    if(!Number.isSafeInteger(employeeId)||employeeId<=0)throw Error('Bước chỉ định cần chọn nhân viên duyệt hợp lệ, không dùng User ID.');
    return {approverType:'USER',employeeId};
   }
   if(step.approverType==='HR'){
    const userId=String(step.userId||'').trim(),roleCode=String(step.roleCode??'HR').trim();
    if(!userId||userId.length>100||!roleCode||roleCode.length>50)throw Error('Bước HR cần tài khoản duyệt (tối đa 100 ký tự) và mã role (tối đa 50 ký tự).');
    return {approverType:'HR',userId,roleCode};
   }
   return {approverType:step.approverType};
  })};
 });
 return {version,routes:normalized};
}

export function approvalStepForType(step,type){
 if(type==='USER')return {approverType:type,employeeId:step.employeeId??null};
 if(type==='HR')return {approverType:type,userId:step.userId||'',roleCode:step.roleCode||'HR'};
 return {approverType:type};
}
const approvalEmployeeSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim();
export function approvalEmployeeOptions(employees,employeeId,query=''){
 const term=approvalEmployeeSearchText(query);
 const available=employees.filter(item=>String(item.id)===String(employeeId)||!term||[item.fullName,item.employeeCode].some(value=>approvalEmployeeSearchText(value).includes(term)));
 if(employeeId&&!available.some(item=>String(item.id)===String(employeeId)))available.unshift({id:employeeId,fullName:`Nhân viên #${employeeId} (đã cấu hình)`,employeeCode:''});
 return '<option value="">Chọn nhân viên duyệt</option>'+available.map(item=>`<option value="${e(item.id)}" ${String(item.id)===String(employeeId)?'selected':''}>${e(item.fullName)}${item.employeeCode?` · ${e(item.employeeCode)}`:''}</option>`).join('')+(available.length?'':'<option value="" disabled>Không tìm thấy nhân viên phù hợp</option>');
}
export function approvalStepFields(step,i,j,employees=null,employeeQuery=''){
 const attrs=`data-route="${i}" data-step="${j}"`;
 const selector=`<label>Người duyệt<select ${attrs} data-step-field="approverType">${Object.entries(workflowApprovers).map(([value,label])=>`<option value="${value}" ${value===step.approverType?'selected':''}>${label}</option>`).join('')}</select></label>`;
 if(step.approverType==='TEAM_LEAD'||step.approverType==='DEPARTMENT_MANAGER')return selector+`<p class="muted approval-step-hint">${step.approverType==='TEAM_LEAD'?'Tự lấy trưởng team của nhân viên gửi đơn.':'Tự lấy quản lý phòng ban của nhân viên gửi đơn.'}</p>`;
 if(step.approverType==='USER'){
  let input;
  if(employees){
   input=`<div class="approval-employee-picker"><label>Tìm nhân viên<input type="search" maxlength="150" value="${e(employeeQuery)}" ${attrs} data-approval-employee-search placeholder="Tìm tên hoặc mã nhân viên" aria-label="Tìm nhân viên duyệt bước ${j+1}"></label><label>Nhân viên duyệt<select ${attrs} data-step-field="employeeId" required>${approvalEmployeeOptions(employees,step.employeeId,employeeQuery)}</select></label></div>`;
  }else input=`<input type="number" min="1" step="1" required value="${e(step.employeeId??'')}" ${attrs} data-step-field="employeeId" placeholder="ID nhân viên duyệt">`;
  return selector+`${employees?input:`<label>Nhân viên duyệt${input}</label>`}<p class="muted approval-step-hint">Nhân viên phải đang làm việc và có tài khoản đang hoạt động.${!step.employeeId&&step.userId?' Cấu hình cũ cần chọn lại nhân viên duyệt trước khi lưu.':''}</p>`;
 }
 return selector+`<label>Tài khoản HR (User ID)<input type="text" maxlength="100" required value="${e(step.userId||'')}" ${attrs} data-step-field="userId"></label><label>Mã role HR<input type="text" maxlength="50" required value="${e(step.roleCode??'HR')}" ${attrs} data-step-field="roleCode"></label>`;
}

export async function mountApprovalWorkflowSettings(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 if(!root)return;
 let generation=0,saving=false;
 async function load(){
  const current=++generation;onDirty(false);
  if(!approvalSettingsGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem quy trình phê duyệt.</p>';return;}
  root.innerHTML='<p role="status">Đang tải quy trình phê duyệt…</p>';
  try{
   const result=await apiApprovalWorkflowSettings();if(!root.isConnected||generation!==current)return;
   if(!Number.isSafeInteger(result?.version)||result.version<0||!Array.isArray(result.routes))throw Error('Cấu hình quy trình hoặc phiên bản không hợp lệ.');
   let employees=null;const employeeSearches=new WeakMap();
   let version=result.version,routes=result.routes.map(route=>({...route,steps:(route.steps||[]).map(step=>({...step}))}));
   const editable=approvalSettingsGrant('canUpdate');
   root.innerHTML=`<form id="approval-settings-form" class="user-registration"><h2>Quy trình phê duyệt</h2><p class="muted">Cấu hình các bước duyệt theo thứ tự cho từng loại yêu cầu. Áp dụng cho đơn gửi sau khi lưu.</p><fieldset class="user-edit-fieldset" ${editable?'':'disabled'}><div id="approval-settings-employee-feedback" role="status"></div><div id="approval-settings-routes"></div><button type="button" class="btn" id="approval-settings-add">Thêm quy trình</button>${editable?'<div class="form-actions"><button type="submit" class="btn primary">Lưu quy trình</button></div>':''}</fieldset><p id="approval-settings-feedback" role="status">${editable?'':'Bạn có quyền xem; cần quyền cập nhật để lưu.'}</p></form>`;
   const form=root.querySelector('form'),container=root.querySelector('#approval-settings-routes'),fieldset=form.querySelector('fieldset'),feedback=root.querySelector('#approval-settings-feedback');
   const changed=()=>onDirty(true);
   function drawRoutes(){
    container.innerHTML=routes.map((route,i)=>`<section class="approval-route"><div class="approval-route-heading"><h3>Quy trình ${i+1}</h3><button type="button" class="btn danger small" data-route-remove="${i}">Xóa quy trình</button></div><div class="form-grid"><label>Loại yêu cầu<select data-route="${i}" data-route-field="requestType">${Object.entries(workflowRouteTypes).map(([value,label])=>`<option value="${value}" ${value===route.requestType?'selected':''}>${label}</option>`).join('')}</select></label><label class="approval-self-toggle"><span>Cho phép người gửi tự duyệt</span><span class="role-switch"><input type="checkbox" role="switch" data-route="${i}" data-route-field="allowSelfApproval" ${route.allowSelfApproval?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label></div><ol class="approval-route-steps">${route.steps.map((step,j)=>`<li><div class="approval-step-heading"><strong>Bước ${j+1}</strong><div><button type="button" class="btn small" data-route="${i}" data-step-up="${j}" ${j===0?'disabled':''}>Lên</button><button type="button" class="btn small" data-route="${i}" data-step-down="${j}" ${j===route.steps.length-1?'disabled':''}>Xuống</button><button type="button" class="btn danger small" data-route="${i}" data-step-remove="${j}" ${route.steps.length<=1?'disabled':''}>Xóa bước</button></div></div><div class="form-grid">${approvalStepFields(step,i,j,employees,employeeSearches.get(step)||'')}</div></li>`).join('')}</ol><button type="button" class="btn" data-step-add="${i}" ${route.steps.length>=10?'disabled':''}>Thêm bước duyệt</button></section>`).join('')||'<p>Chưa cấu hình quy trình. Thêm quy trình để bắt đầu.</p>';
    root.querySelector('#approval-settings-add').disabled=routes.length>=Object.keys(workflowRouteTypes).length;
    container.querySelectorAll('[data-route-field]').forEach(input=>input.onchange=()=>{if(saving)return;routes[Number(input.dataset.route)][input.dataset.routeField]=input.type==='checkbox'?input.checked:input.value;changed();});
    container.querySelectorAll('[data-step-field]').forEach(input=>{
 const update=()=>{if(saving)return;const route=routes[Number(input.dataset.route)],j=Number(input.dataset.step),key=input.dataset.stepField;
 if(key==='approverType'){route.steps[j]=approvalStepForType(route.steps[j],input.value);changed();drawRoutes();}
 else{route.steps[j][key]=input.value;changed();}
 };
 input.onchange=update;if(input.tagName==='INPUT')input.oninput=update;
 });
    container.querySelectorAll('[data-approval-employee-search]').forEach(input=>{
     input.oninput=()=>{if(saving)return;const step=routes[Number(input.dataset.route)].steps[Number(input.dataset.step)];employeeSearches.set(step,input.value);input.closest('.approval-employee-picker').querySelector('select').innerHTML=approvalEmployeeOptions(employees||[],step.employeeId,input.value);};
     input.onkeydown=event=>{if(event.key==='Enter')event.preventDefault();};
    });
    container.querySelectorAll('[data-route-remove]').forEach(button=>button.onclick=()=>{if(saving)return;routes.splice(Number(button.dataset.routeRemove),1);changed();drawRoutes();});
    container.querySelectorAll('[data-step-add]').forEach(button=>button.onclick=()=>{if(saving)return;const steps=routes[Number(button.dataset.stepAdd)].steps;if(steps.length<10){steps.push({approverType:'USER',employeeId:null});changed();drawRoutes();}});
    for(const operation of ['remove','up','down'])container.querySelectorAll(`[data-step-${operation}]`).forEach(button=>button.onclick=()=>{if(saving)return;const steps=routes[Number(button.dataset.route)].steps,index=Number(button.dataset['step'+operation[0].toUpperCase()+operation.slice(1)]);if(operation==='remove'){if(steps.length<=1)return;steps.splice(index,1);}else{const target=index+(operation==='up'?-1:1);if(target<0||target>=steps.length)return;[steps[index],steps[target]]=[steps[target],steps[index]];}changed();drawRoutes();});
   }
   drawRoutes();
   async function loadEmployees(){
    const canView=apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_EMPLOYEES'&&p.canView==='Y');if(!canView)return;
    const feedback=root.querySelector('#approval-settings-employee-feedback');feedback.textContent='Đang tải danh sách nhân viên duyệt…';
    try{
     const items=[];let page=1,total=Infinity;
     while(items.length<total){const response=await apiEmployees(new URLSearchParams({page,pageSize:100,employmentStatus:'ACTIVE'}).toString());if(!form.isConnected)return;if(!Array.isArray(response?.data)||!Number.isInteger(response.total))throw Error('Danh sách nhân viên không hợp lệ.');items.push(...response.data);total=response.total;if(!response.data.length)break;page++;}
     employees=items.filter(item=>item.employmentStatus==='ACTIVE');feedback.textContent='';drawRoutes();
    }catch(err){if(form.isConnected){feedback.innerHTML=`${e(err.message)}. Bạn có thể nhập ID nhân viên. <button type="button" class="btn">Thử lại</button>`;feedback.querySelector('button').onclick=loadEmployees;}}
   }
   loadEmployees();
   root.querySelector('#approval-settings-add').onclick=()=>{if(saving||routes.length>=Object.keys(workflowRouteTypes).length)return;const requestType=Object.keys(workflowRouteTypes).find(type=>!routes.some(route=>route.requestType===type));if(requestType){routes.push({requestType,allowSelfApproval:false,steps:[{approverType:requestType==='PAYROLL_PERIOD'?'USER':'TEAM_LEAD'}]});changed();drawRoutes();}};
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(saving||!editable)return;
    try{
     if(!approvalSettingsGrant('canUpdate'))throw Error('Bạn không có quyền cập nhật quy trình phê duyệt.');
     const payload=approvalSettingsPayload(version,routes);saving=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu quy trình…';
     const saved=await apiApprovalWorkflowSettings(payload);if(!form.isConnected)return;
     if(!Number.isSafeInteger(saved?.version)||saved.version<0||!Array.isArray(saved.routes))throw Error('Chưa nhận cấu hình mới. Hãy tải lại để xác nhận trước khi lưu tiếp.');
     version=saved.version;routes=saved.routes.map(route=>({...route,steps:route.steps.map(step=>({...step}))}));onDirty(false);drawRoutes();feedback.textContent='Đã lưu quy trình phê duyệt.';
    }catch(err){if(form.isConnected)feedback.textContent=err.message;}
    finally{saving=false;onSaving(false);if(form.isConnected)fieldset.disabled=!editable;}
   };
  }catch(err){if(root.isConnected&&generation===current){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=load;}}
 }
 await load();
}
