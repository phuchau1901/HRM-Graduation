import {apiOrganization,apiActiveDepartments,apiSession} from '../api/client.js';
import {e} from '../utils.js';
import {field} from '../components/ui.js';

export const organizationCatalogs={
 departments:{label:'Phòng ban',screen:'WEB_DEPARTMENTS',code:'departmentCode',name:'departmentName',max:20,description:true},
 positions:{label:'Chức vụ',screen:'WEB_POSITIONS',code:'code',name:'name',max:30},
 teams:{label:'Teams',screen:'WEB_TEAMS',code:'teamCode',name:'teamName',max:30,description:true}
};
function organizationGrant(kind,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===organizationCatalogs[kind].screen&&p.canView==='Y'&&p[flag]==='Y');}
export function organizationPayload(kind,values,original=null){
 const config=organizationCatalogs[kind];
 const payload={[config.code]:values.code.trim(),[config.name]:values.name.trim(),isActive:values.isActive};
 if(config.description)payload.description=values.description.trim()||null;
 if(kind==='teams')payload.departmentId=original?original.departmentId:Number(values.departmentId);
 return payload;
}
export async function mountMasterData(root,filters={}){
 if(!root)return;
 let kind=organizationCatalogs[filters.tab]?filters.tab:Object.keys(organizationCatalogs).find(key=>organizationGrant(key,'canView'))||'departments',page=1,search='',active='',generation=0;
 const error=(err,retry)=>{if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="organization-retry">Thử lại</button>`;root.querySelector('#organization-retry').onclick=retry;};
 async function list(){
 const current=++generation,config=organizationCatalogs[kind];
 root.innerHTML='<p role="status">Đang tải danh mục…</p>';
 try{
 const canView=organizationGrant(kind,'canView');
 let result={data:[],total:0};
 if(canView){const query=new URLSearchParams({page,pageSize:30,search});if(active!=='')query.set('isActive',active);result=await apiOrganization(kind,null,null,query.toString());}
 if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách danh mục không hợp lệ.');
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Danh mục tổ chức">${Object.entries(organizationCatalogs).map(([key,item])=>`<button type="button" role="tab" aria-selected="${kind===key}" class="tab ${kind===key?'active':''}" data-org-tab="${key}">${item.label}</button>`).join('')}</div>${canView?`<form id="organization-search" class="toolbar"><input name="search" maxlength="150" value="${e(search)}" placeholder="Tìm mã hoặc tên" aria-label="Tìm danh mục"><select name="active" aria-label="Trạng thái"><option value="">Tất cả trạng thái</option><option value="true" ${active==='true'?'selected':''}>Hoạt động</option><option value="false" ${active==='false'?'selected':''}>Ngừng hoạt động</option></select><button class="btn">Tìm kiếm</button>${organizationGrant(kind,'canNew')?'<button type="button" class="btn primary" id="organization-create">Thêm mới</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Tên</th>${kind==='teams'?'<th>Phòng ban</th>':''}${config.description?'<th>Mô tả</th>':''}<th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map(item=>`<tr><td>${e(item[config.code])}</td><td>${e(item[config.name])}</td>${kind==='teams'?`<td>${e(item.departmentName||'—')}</td>`:''}${config.description?`<td class="organization-description">${e(item.description||'—')}</td>`:''}<td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-org-edit="${e(item.id)}" ${organizationGrant(kind,'canUpdate')?'':'disabled'}>Chỉnh sửa</button></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Không có dữ liệu phù hợp.</p>'}<div class="toolbar user-pagination"><button class="btn" id="organization-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} bản ghi</span><button class="btn" id="organization-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`:'<p>Bạn chưa có quyền xem danh mục này.</p>'}`;
 root.querySelectorAll('[data-org-tab]').forEach(button=>button.onclick=()=>{kind=button.dataset.orgTab;page=1;search='';active='';list();});
 root.querySelector('#organization-create')?.addEventListener('click',()=>edit());
 root.querySelectorAll('[data-org-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.orgEdit));
 const form=root.querySelector('#organization-search');if(form)form.onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=form.elements.search.value.trim();active=form.elements.active.value;page=1;list();};
 root.querySelector('#organization-prev')?.addEventListener('click',()=>{page--;list();});root.querySelector('#organization-next')?.addEventListener('click',()=>{page++;list();});
 }catch(err){if(current===generation)error(err,list);}
 }
 async function edit(id=null){
 if(!organizationGrant(kind,id===null?'canNew':'canUpdate'))return;
 const current=++generation,config=organizationCatalogs[kind];root.innerHTML='<p role="status">Đang tải thông tin…</p>';
 try{
 const item=id===null?null:await apiOrganization(kind,id);
 const departments=kind==='teams'&&id===null?await apiActiveDepartments():[];
 if(!root.isConnected||current!==generation)return;
 root.innerHTML=`<button type="button" class="btn" id="organization-back">← Danh sách</button><h2 class="role-editor-title">${id===null?'Thêm':'Chỉnh sửa'} ${config.label}</h2><form id="organization-edit" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Mã','code','text',item?.[config.code]||'',`required maxlength="${config.max}" ${kind==='teams'?'pattern="[A-Za-z0-9][A-Za-z0-9_-]*"':''}`)}${field('Tên','name','text',item?.[config.name]||'','required maxlength="150"')}${kind==='teams'?(item?`${field('Phòng ban','departmentName','text',item.departmentName||String(item.departmentId),'readonly')}<p class="muted">Phòng ban của team không thể thay đổi sau khi tạo.</p>`:`<label>Phòng ban<select name="departmentId" required><option value="">Chọn phòng ban</option>${departments.map(dep=>`<option value="${e(dep.id)}">${e(dep.departmentName)}</option>`).join('')}</select></label>`):''}${config.description?`<label>Mô tả<textarea name="description" maxlength="500">${e(item?.description||'')}</textarea></label>`:''}<label>Trạng thái<select name="isActive"><option value="true" ${item?.isActive!==false?'selected':''}>Hoạt động</option><option value="false" ${item?.isActive===false?'selected':''}>Ngừng hoạt động</option></select></label></div><div class="form-actions"><button type="submit" class="btn primary">Lưu lại</button></div></fieldset><p id="organization-feedback" role="status"></p></form>`;
 const form=root.querySelector('#organization-edit'),feedback=root.querySelector('#organization-feedback');let saving=false;
 root.querySelector('#organization-back').onclick=()=>{if(!saving)list();};
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving)return;
 const data=new FormData(form),values={code:data.get('code'),name:data.get('name'),description:data.get('description')||'',isActive:data.get('isActive')==='true',departmentId:data.get('departmentId')};
 if(!values.code.trim()||!values.name.trim()){feedback.textContent='Mã và tên không được để trống.';return;}
 const payload=organizationPayload(kind,values,item);
 if(kind==='teams'&&!item&&!departments.some(dep=>dep.id===payload.departmentId)){feedback.textContent='Vui lòng chọn phòng ban đang hoạt động.';return;}
 saving=true;form.querySelector('fieldset').disabled=true;feedback.textContent='Đang lưu…';
 try{await apiOrganization(kind,id,payload);if(!form.isConnected)return;await list();}
 catch(err){if(form.isConnected)feedback.textContent=err.message;}
 finally{saving=false;if(form.isConnected)form.querySelector('fieldset').disabled=false;}
 };
 }catch(err){if(current===generation)error(err,()=>edit(id));}
 }
 await list();
}
