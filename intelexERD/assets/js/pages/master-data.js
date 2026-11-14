import {mountSystemSettings} from './system-settings.js';
import {apiOrganization,apiActiveDepartments,apiSession,apiShifts,apiShiftDetail,apiSaveShift} from '../api/client.js';
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
async function mountOrganizationData(root,filters={},options={}){
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
 root.querySelector('[role=tablist]')?.remove();
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
 form.oninput=form.onchange=()=>options.onDirty?.(true);
 root.querySelector('#organization-back').onclick=()=>{if(!saving){options.onDirty?.(false);list();}};
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving)return;
 const data=new FormData(form),values={code:data.get('code'),name:data.get('name'),description:data.get('description')||'',isActive:data.get('isActive')==='true',departmentId:data.get('departmentId')};
 if(!values.code.trim()||!values.name.trim()){feedback.textContent='Mã và tên không được để trống.';return;}
 const payload=organizationPayload(kind,values,item);
 if(kind==='teams'&&!item&&!departments.some(dep=>dep.id===payload.departmentId)){feedback.textContent='Vui lòng chọn phòng ban đang hoạt động.';return;}
 saving=true;options.onSaving?.(true);form.querySelector('fieldset').disabled=true;feedback.textContent='Đang lưu…';
 try{await apiOrganization(kind,id,payload);if(!form.isConnected)return;options.onDirty?.(false);await list();}
 catch(err){if(form.isConnected)feedback.textContent=err.message;}
 finally{saving=false;options.onSaving?.(false);if(form.isConnected)form.querySelector('fieldset').disabled=false;}
 };
 }catch(err){if(current===generation)error(err,()=>edit(id));}
 }
 await list();
}

export const masterDataTabs={departments:'Phòng ban',positions:'Chức vụ',teams:'Teams',attendance:'Chấm công',shifts:'Ca làm việc'};
export async function mountMasterData(root,filters={}){
 if(!root)return;
 const screens={departments:'WEB_DEPARTMENTS',positions:'WEB_POSITIONS',teams:'WEB_TEAMS',attendance:'WEB_SYSTEM_SETTINGS',shifts:'WEB_SHIFTS'};
 let tab=masterDataTabs[filters.tab]?filters.tab:Object.keys(masterDataTabs).find(key=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===screens[key]&&p.canView==='Y'))||'departments',dirty=false,saving=false;
 async function draw(){
 dirty=false;
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Master Data">${Object.entries(masterDataTabs).map(([key,label])=>`<button type="button" role="tab" aria-selected="${key===tab}" class="tab ${key===tab?'active':''}" data-master-tab="${key}">${label}</button>`).join('')}</div><div id="master-data-panel" role="tabpanel"></div>`;
 root.querySelectorAll('[data-master-tab]').forEach(button=>button.onclick=()=>{if(saving||button.dataset.masterTab===tab)return;if(dirty&&!confirm('Bỏ các thay đổi chưa lưu?'))return;tab=button.dataset.masterTab;draw();});
 const panel=root.querySelector('#master-data-panel'),options={onDirty:value=>{if(panel.isConnected)dirty=value;},onSaving:value=>{if(!panel.isConnected)return;saving=value;root.querySelectorAll('[data-master-tab]').forEach(button=>button.disabled=value);}};
 if(tab==='attendance')await mountSystemSettings(panel,{tab:'attendance'},{...options,embedded:true});
 else if(tab==='shifts')await mountShifts(panel,options);
 else await mountOrganizationData(panel,{tab},options);
 }
 await draw();
}


function shiftGrant(flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_SHIFTS'&&p.canView==='Y'&&p[flag]==='Y');}
export function validateShift(payload){
 if(!payload.code.trim()||payload.code.length>30)throw Error('Mã ca bắt buộc và tối đa 30 ký tự.');
 if(!payload.name.trim()||payload.name.length>100)throw Error('Tên ca bắt buộc và tối đa 100 ký tự.');
 const seconds=value=>{const match=/^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);if(!match||Number(match[1])>23||Number(match[2])>59||Number(match[3]||0)>59)throw Error('Giờ ca không hợp lệ.');return Number(match[1])*3600+Number(match[2])*60+Number(match[3]||0);};
 const start=seconds(payload.startTime),end=seconds(payload.endTime);
 if(start===end)throw Error('Giờ bắt đầu và kết thúc không được trùng nhau.');
 const duration=((end-start+86400)%86400)/60;
 if(!Number.isInteger(payload.breakMinutes)||payload.breakMinutes<0||payload.breakMinutes>=duration)throw Error('Phút nghỉ phải không âm và nhỏ hơn thời lượng ca.');
 if(payload.lateGraceMinutes!==null&&(!Number.isInteger(payload.lateGraceMinutes)||payload.lateGraceMinutes<0||payload.lateGraceMinutes>240||payload.lateGraceMinutes>=duration))throw Error('Phút cho phép đi trễ phải từ 0 đến 240 và nhỏ hơn thời lượng ca.');
 return payload;
}
export async function mountShifts(root,{onDirty=()=>{},onSaving=()=>{}}={}){
 let page=1,search='',generation=0;
 const showError=(err,retry)=>{if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" id="shift-retry">Thử lại</button>`;root.querySelector('#shift-retry').onclick=retry;};
 async function list(){
 const current=++generation;onDirty(false);root.innerHTML='<p role="status">Đang tải ca làm việc…</p>';
 try{
 if(!shiftGrant('canView'))throw Error('Bạn chưa có quyền WEB_SHIFTS/VIEW để xem ca làm việc.');
 const result=await apiShifts(page,search);if(!root.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách ca không hợp lệ.');
 root.innerHTML=`<form class="toolbar" id="shift-search"><input name="search" value="${e(search)}" maxlength="150" placeholder="Tìm mã hoặc tên ca" aria-label="Tìm ca làm việc"><button class="btn">Tìm kiếm</button>${shiftGrant('canNew')?'<button type="button" id="shift-create" class="btn primary">Thêm ca làm việc</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Mã ca</th><th>Tên ca</th><th>Bắt đầu</th><th>Kết thúc</th><th>Nghỉ (phút)</th><th>Đi trễ cho phép (phút)</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${result.data.map(item=>`<tr><td>${e(item.code)}</td><td>${e(item.name)}</td><td>${e(item.startTime)}</td><td>${e(item.endTime)}${item.endTime<item.startTime?' <span class="tag">Qua đêm</span>':''}</td><td>${e(item.breakMinutes)}</td><td>${e(item.lateGraceMinutes??'Mặc định')}</td><td>${item.isActive?'Hoạt động':'Ngừng hoạt động'}</td><td><button type="button" class="btn" data-shift-edit="${e(item.id)}">${shiftGrant('canUpdate')?'Chỉnh sửa':'Chi tiết'}</button></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<p>Chưa có ca phù hợp.</p>'}<div class="toolbar user-pagination"><button class="btn" id="shift-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} ca</span><button class="btn" id="shift-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div>`;
 const form=root.querySelector('#shift-search');form.onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();search=form.elements.search.value.trim();page=1;list();};
 root.querySelector('#shift-create')?.addEventListener('click',()=>edit());
 root.querySelectorAll('[data-shift-edit]').forEach(button=>button.onclick=()=>edit(button.dataset.shiftEdit));
 root.querySelector('#shift-prev').onclick=()=>{page--;list();};root.querySelector('#shift-next').onclick=()=>{page++;list();};
 }catch(err){if(current===generation)showError(err,list);}
 }
 async function edit(id=null){
 const current=++generation;root.innerHTML='<p role="status">Đang tải thông tin ca…</p>';
 try{
 const item=id===null?{}:await apiShiftDetail(id);if(!root.isConnected||current!==generation)return;
 const canSave=shiftGrant(id===null?'canNew':'canUpdate');let saving=false,dirty=false;
 root.innerHTML=`<button type="button" class="btn" id="shift-back">← Danh sách ca</button><h2 class="role-editor-title">${id===null?'Thêm':'Chi tiết'} ca làm việc</h2><form id="shift-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Mã ca','code','text',item.code||'','required maxlength="30"')}${field('Tên ca','name','text',item.name||'','required maxlength="100"')}${field('Giờ bắt đầu','startTime','time',item.startTime||'','required step="1"')}${field('Giờ kết thúc','endTime','time',item.endTime||'','required step="1"')}${field('Nghỉ giữa ca (phút)','breakMinutes','number',item.breakMinutes??0,'required min="0" max="1439" step="1"')}${field('Cho phép đi trễ (phút)','lateGraceMinutes','number',item.lateGraceMinutes??'','min="0" max="240" step="1" placeholder="Dùng mặc định cấu hình chấm công"')}<label>Trạng thái<select name="isActive"><option value="true" ${item.isActive!==false?'selected':''}>Hoạt động</option><option value="false" ${item.isActive===false?'selected':''}>Ngừng hoạt động</option></select></label></div><p class="muted">Để trống phút đi trễ để lấy mặc định từ cấu hình chấm công. Ca qua đêm cần được bật trong cấu hình. Sửa ca không thay đổi lịch làm việc đã tạo.</p><div class="form-actions"><button type="submit" class="btn primary">Lưu ca làm việc</button></div></fieldset><p id="shift-feedback" role="status"></p></form>`;
 const form=root.querySelector('#shift-form'),fieldset=form.querySelector('fieldset'),feedback=root.querySelector('#shift-feedback');
 form.oninput=form.onchange=()=>{dirty=true;onDirty(true);};
 root.querySelector('#shift-back').onclick=()=>{if(!saving&&(!dirty||confirm('Bỏ thay đổi ca chưa lưu?')))list();};
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving||!canSave)return;
 const data=new FormData(form),normalizeTime=value=>value.length===5?value+':00':value;
 const payload={code:data.get('code').trim().toUpperCase(),name:data.get('name').trim(),startTime:normalizeTime(data.get('startTime')),endTime:normalizeTime(data.get('endTime')),breakMinutes:Number(data.get('breakMinutes')),lateGraceMinutes:data.get('lateGraceMinutes')===''?null:Number(data.get('lateGraceMinutes')),isActive:data.get('isActive')==='true'};
 try{validateShift(payload);}catch(err){feedback.textContent=err.message;return;}
 saving=true;onSaving(true);fieldset.disabled=true;feedback.textContent='Đang lưu ca…';
 try{await apiSaveShift(id,payload,item.version);if(form.isConnected){onDirty(false);await list();}}
 catch(err){if(form.isConnected)feedback.textContent=err.message+' Nếu phiên bản đã thay đổi, hãy mở lại ca trước khi lưu.';}
 finally{saving=false;onSaving(false);if(form.isConnected)fieldset.disabled=!canSave;}
 };
 }catch(err){if(current===generation)showError(err,()=>edit(id));}
 }
 await list();
}
