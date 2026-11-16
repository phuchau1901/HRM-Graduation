import {apiContractTypes,apiContractType,apiSaveContractType,apiDeleteContractType,apiSession} from '../api/client.js';
import {e} from '../utils.js';
import {field} from '../components/ui.js';

export function contractTypeGrant(flag,session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_CONTRACT_TYPES'&&p.canView==='Y'&&p[flag]==='Y');
}
export function contractTypePayload(values,creating=false){
 const name=String(values.name||'').trim(),description=String(values.description||'').trim()||null;
 if(!name||name.length>150)throw Error('Tên loại hợp đồng bắt buộc, tối đa 150 ký tự.');
 if(description&&description.length>500)throw Error('Mô tả tối đa 500 ký tự.');
 if(values.sortOrder===''||values.sortOrder===undefined)throw Error('Vui lòng nhập thứ tự hiển thị.');
 const sortOrder=Number(values.sortOrder);
 if(!Number.isInteger(sortOrder)||sortOrder<0||sortOrder>2147483647)throw Error('Thứ tự hiển thị phải là số nguyên không âm.');
 if(typeof values.isActive!=='boolean')throw Error('Trạng thái không hợp lệ.');
 const payload={name,description,isActive:values.isActive,sortOrder};
 if(values.prefix!==undefined){
  const prefix=values.prefix===null?null:String(values.prefix).trim()||null;
  if(prefix!==null&&!/^[A-Z][A-Z0-9]{0,19}$/.test(prefix))throw Error('Prefix gồm 1–20 chữ hoa hoặc số, bắt đầu bằng chữ cái.');
  payload.prefix=prefix;
 }
 if(creating){const code=String(values.code||'').trim();if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$/.test(code))throw Error('Mã tối đa 30 ký tự, bắt đầu bằng chữ/số, chỉ gồm chữ, số, dấu gạch dưới hoặc gạch ngang.');payload.code=code;}
 return payload;
}

export async function mountContractTypes(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 if(!root)return;
 let page=1,search='',active='',generation=0,busy=false;
 const current=id=>root.isConnected&&generation===id;
 function failure(err,retry){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn" data-retry>Thử lại</button>`;root.querySelector('[data-retry]').onclick=retry;}
 async function list(){
  const id=++generation;onDirty(false);
  if(!contractTypeGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem loại hợp đồng.</p>';return;}
  root.innerHTML='<p role="status">Đang tải loại hợp đồng…</p>';
  try{
   const query=new URLSearchParams({page,pageSize:30,search});if(active!=='')query.set('isActive',active);
   const result=await apiContractTypes(query.toString());if(!current(id))return;
   if(!Array.isArray(result?.data))throw Error('Danh sách loại hợp đồng không hợp lệ.');
   root.innerHTML=`<form class="toolbar" id="contract-type-search"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã hoặc tên loại hợp đồng" aria-label="Tìm loại hợp đồng"><select name="active" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option><option value="true" ${active==='true'?'selected':''}>Hoạt động</option><option value="false" ${active==='false'?'selected':''}>Ngừng hoạt động</option></select><button class="btn">Tìm kiếm</button>${contractTypeGrant('canNew')?'<button type="button" class="btn primary" id="contract-type-create">Thêm loại hợp đồng</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên loại hợp đồng</th><th>Prefix</th><th>Mô tả</th><th>Thứ tự</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map((item,index)=>`<tr><td>${e(item.code)}</td><td>${e(item.name)}</td><td>${e(item.prefix||'—')}</td><td class="organization-description">${e(item.description||'—')}</td><td>${e(item.sortOrder)}</td><td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-contract-type-edit="${index}">${contractTypeGrant('canUpdate')?'Chỉnh sửa':'Chi tiết'}</button>${contractTypeGrant('canDelete')?` <button type="button" class="btn danger" data-contract-type-delete="${index}">Xóa</button>`:''}</td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Không có loại hợp đồng phù hợp.</p>'}<p id="contract-type-list-feedback" role="alert"></p><div class="toolbar user-pagination"><button type="button" class="btn" id="contract-type-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} loại hợp đồng</span><button type="button" class="btn" id="contract-type-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
   const form=root.querySelector('#contract-type-search');form.onsubmit=event=>{event.preventDefault();event.stopPropagation();if(busy)return;search=form.elements.search.value.trim();active=form.elements.active.value;page=1;list();};
   root.querySelector('#contract-type-create')?.addEventListener('click',()=>edit());
   root.querySelectorAll('[data-contract-type-edit]').forEach(button=>button.onclick=()=>{if(!busy)edit(result.data[Number(button.dataset.contractTypeEdit)].code);});
   root.querySelectorAll('[data-contract-type-delete]').forEach(button=>button.onclick=async()=>{
    if(busy||!contractTypeGrant('canDelete'))return;
    const item=result.data[Number(button.dataset.contractTypeDelete)];if(!confirm(`Xóa loại hợp đồng “${item.name}”?`))return;
    busy=true;onSaving(true);root.querySelectorAll('button,input,select').forEach(control=>control.disabled=true);
    try{await apiDeleteContractType(item.code);if(current(id)){if(result.data.length===1&&page>1)page--;await list();}}
    catch(err){if(current(id)){root.querySelector('#contract-type-list-feedback').textContent=err.message+(err.status===409?' Bạn có thể chỉnh sửa và chuyển sang ngừng hoạt động.':'');root.querySelectorAll('button,input,select').forEach(control=>control.disabled=false);root.querySelector('#contract-type-prev').disabled=page<=1;root.querySelector('#contract-type-next').disabled=page*30>=result.total;}}
    finally{busy=false;onSaving(false);}
   });
   root.querySelector('#contract-type-prev').onclick=()=>{if(!busy){page--;list();}};root.querySelector('#contract-type-next').onclick=()=>{if(!busy){page++;list();}};
  }catch(err){if(current(id))failure(err,list);}
 }
 async function edit(code=null){
  if(busy||!contractTypeGrant(code===null?'canNew':'canView'))return;
  const id=++generation;root.innerHTML='<p role="status">Đang tải loại hợp đồng…</p>';
  try{
   const item=code===null?{isActive:true,sortOrder:0}:await apiContractType(code);if(!current(id))return;
   const canSave=contractTypeGrant(code===null?'canNew':'canUpdate');
   root.innerHTML=`<button type="button" class="btn" id="contract-type-back">← Danh sách loại hợp đồng</button><h2 class="role-editor-title">${code===null?'Thêm':'Chi tiết'} loại hợp đồng</h2><form id="contract-type-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Mã','code','text',item.code||'',code===null?'required maxlength="30" pattern="[A-Za-z0-9][A-Za-z0-9_-]*"':'readonly')}${field('Tên loại hợp đồng','name','text',item.name||'','required maxlength="150"')}${field('Prefix số hợp đồng','prefix','text',item.prefix||'','maxlength="20" pattern="[A-Z][A-Z0-9]{0,19}" placeholder="Ví dụ: HDLD"')}<label>Mô tả<textarea name="description" maxlength="500">${e(item.description||'')}</textarea></label>${field('Thứ tự hiển thị','sortOrder','number',item.sortOrder,'required min="0" max="2147483647" step="1"')}<label>Trạng thái<select name="isActive"><option value="true" ${item.isActive?'selected':''}>Hoạt động</option><option value="false" ${!item.isActive?'selected':''}>Ngừng hoạt động</option></select></label></div><p class="muted">Prefix dùng để cấp số cho hợp đồng mới; thay đổi không đổi số hợp đồng đã cấp.</p>${canSave?'<div class="form-actions"><button type="submit" class="btn primary">Lưu lại</button></div>':''}</fieldset><p id="contract-type-feedback" role="status"></p></form>`;
   const form=root.querySelector('#contract-type-form'),feedback=root.querySelector('#contract-type-feedback'),fieldset=form.querySelector('fieldset');
   form.oninput=form.onchange=()=>{if(canSave)onDirty(true);};root.querySelector('#contract-type-back').onclick=()=>{if(!busy)list();};
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(busy||!canSave)return;
    try{
     if(!contractTypeGrant(code===null?'canNew':'canUpdate'))throw Error('Bạn không có quyền lưu loại hợp đồng.');
     const values=Object.fromEntries(new FormData(form)),payload=contractTypePayload({...values,isActive:values.isActive==='true'},code===null);
     busy=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu…';
     await apiSaveContractType(code,payload);if(current(id)){onDirty(false);await list();}
    }catch(err){if(current(id))feedback.textContent=err.message;}
    finally{busy=false;onSaving(false);if(form.isConnected)fieldset.disabled=!canSave;}
   };
  }catch(err){if(current(id))failure(err,()=>edit(code));}
 }
 await list();
}
