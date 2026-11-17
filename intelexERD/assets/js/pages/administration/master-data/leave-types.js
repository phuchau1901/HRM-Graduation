import {apiWorkflowLeaveTypes,apiSaveLeaveType,apiSession} from '../../../api/client.js';
import {field} from '../../../components/ui.js';
import {e} from '../../../utils.js';

export function leaveTypeGrant(flag,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_LEAVE_TYPES'&&p.canView==='Y'&&p[flag]==='Y');}
export function leaveTypePayload(values){
 const code=String(values.code||'').trim(),name=String(values.name||'').trim();
 if(!/^[A-Z0-9][A-Z0-9_-]{0,29}$/.test(code))throw Error('Mã gồm 1–30 chữ hoa, số, gạch dưới hoặc gạch ngang; bắt đầu bằng chữ hoặc số.');
 if(!name||name.length>100)throw Error('Tên loại nghỉ phép bắt buộc, tối đa 100 ký tự.');
 for(const key of ['paid','requiresBalance','isActive'])if(typeof values[key]!=='boolean')throw Error('Trạng thái loại nghỉ phép không hợp lệ.');
 return {code,name,paid:values.paid,requiresBalance:values.requiresBalance,isActive:values.isActive};
}
const leaveTypeSwitch=(name,label,value)=>`<label class="role-toggle-row"><span>${label}</span><span class="role-switch"><input name="${name}" type="checkbox" role="switch" ${value?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;
export async function mountLeaveTypes(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 if(!root)return;
 let page=1,search='',generation=0,busy=false;
 const current=id=>root.isConnected&&id===generation;
 async function list(){
  const id=++generation;onDirty(false);
  if(!leaveTypeGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem loại nghỉ phép.</p>';return;}
  root.innerHTML='<p role="status">Đang tải loại nghỉ phép…</p>';
  try{
   const result=await apiWorkflowLeaveTypes(new URLSearchParams({page,pageSize:20,search}).toString());if(!current(id))return;
   if(!Array.isArray(result?.data))throw Error('Danh sách loại nghỉ phép không hợp lệ.');
   root.innerHTML=`<form class="toolbar" id="leave-type-search"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã hoặc tên loại nghỉ phép" aria-label="Tìm loại nghỉ phép"><button class="btn">Tìm kiếm</button>${leaveTypeGrant('canNew')?'<button type="button" class="btn primary" id="leave-type-create">Thêm loại nghỉ phép</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên loại nghỉ phép</th><th>Hưởng lương</th><th>Trừ số dư phép</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map((item,index)=>`<tr><td>${e(item.code)}</td><td>${e(item.name)}</td><td>${item.paid?'Có':'Không'}</td><td>${item.requiresBalance?'Có':'Không'}</td><td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-leave-type-edit="${index}">${leaveTypeGrant('canUpdate')?'Chỉnh sửa':'Chi tiết'}</button></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Không có loại nghỉ phép phù hợp.</p>'}<div class="toolbar user-pagination"><button type="button" class="btn" id="leave-type-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} loại nghỉ phép</span><button type="button" class="btn" id="leave-type-next" ${page*20>=result.total?'disabled':''}>Trang sau</button></div>`;
   const form=root.querySelector('#leave-type-search');form.onsubmit=event=>{event.preventDefault();event.stopPropagation();search=form.elements.search.value.trim();page=1;list();};
   root.querySelector('#leave-type-create')?.addEventListener('click',()=>edit());
   root.querySelectorAll('[data-leave-type-edit]').forEach(button=>button.onclick=()=>edit(result.data[Number(button.dataset.leaveTypeEdit)]));
   root.querySelector('#leave-type-prev').onclick=()=>{page--;list();};root.querySelector('#leave-type-next').onclick=()=>{page++;list();};
  }catch(err){if(current(id)){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=list;}}
 }
 function edit(item=null){
  if(busy||!leaveTypeGrant(item?'canView':'canNew'))return;
  const canSave=leaveTypeGrant(item?'canUpdate':'canNew');++generation;
  root.innerHTML=`<button type="button" class="btn" id="leave-type-back">← Danh sách loại nghỉ phép</button><h2 class="role-editor-title">${item?'Chi tiết':'Thêm'} loại nghỉ phép</h2><form id="leave-type-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Mã loại nghỉ phép','code','text',item?.code||'','required maxlength="30" pattern="[A-Z0-9][A-Z0-9_-]*"')}${field('Tên loại nghỉ phép','name','text',item?.name||'','required maxlength="100"')}</div><div class="role-toggles">${leaveTypeSwitch('paid','Hưởng lương',item?.paid??false)}${leaveTypeSwitch('requiresBalance','Trừ số dư phép',item?.requiresBalance??true)}${leaveTypeSwitch('isActive','Hoạt động',item?.isActive??true)}</div>${canSave?'<div class="form-actions"><button type="submit" class="btn primary">Lưu lại</button></div>':''}</fieldset><p id="leave-type-feedback" role="alert"></p></form>`;
  const form=root.querySelector('#leave-type-form'),fieldset=form.querySelector('fieldset'),feedback=root.querySelector('#leave-type-feedback');
  form.oninput=form.onchange=()=>{if(canSave)onDirty(true);};
  root.querySelector('#leave-type-back').onclick=()=>{if(!busy)list();};
  form.onsubmit=async event=>{
   event.preventDefault();event.stopPropagation();if(busy||!canSave)return;
   try{
    if(!leaveTypeGrant(item?'canUpdate':'canNew'))throw Error('Bạn không có quyền lưu loại nghỉ phép.');
    const payload=leaveTypePayload({code:form.elements.code.value,name:form.elements.name.value,paid:form.elements.paid.checked,requiresBalance:form.elements.requiresBalance.checked,isActive:form.elements.isActive.checked});
    busy=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu…';
    await apiSaveLeaveType(item?.id??null,payload);if(form.isConnected){onDirty(false);await list();}
   }catch(err){if(form.isConnected)feedback.textContent=err.message;}
   finally{busy=false;onSaving(false);if(form.isConnected)fieldset.disabled=!canSave;}
  };
 }
 await list();
}
