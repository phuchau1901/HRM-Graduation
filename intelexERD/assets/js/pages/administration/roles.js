import {navigationForScreens} from '../../screen-navigation.js';
import {apiCreateScreen,apiRoles,apiUpdateRole,apiAllScreens,apiRolePermissions,apiSaveRolePermissions,apiSession} from '../../api/client.js';
import {nav} from '../../router.js';
import {roleScreenRoutes} from '../../permissions.js';
import {e} from '../../utils.js';
import {icon} from '../../components/ui.js';

const requestScopeScreens=['WEB_LEAVE_REQUESTS','WEB_OVERTIME_REQUESTS','WEB_ATTENDANCE_ADJUSTMENTS'];
export const roleUsesEmployeeScope=code=>['WEB_WORK_SCHEDULES','WEB_EMPLOYEES','WEB_CONTRACTS','WEB_APPROVALS','WEB_LEAVE_BALANCES','WEB_LEAVE_MANAGEMENT',...requestScopeScreens].includes(code);
export const roleHasScopeAction=(code,flag)=>code==='WEB_WORK_SCHEDULES'?['VIEW','NEW','UPDATE','DELETE','EXPORT'].includes(flag):requestScopeScreens.includes(code)?flag==='VIEW':code==='WEB_APPROVALS'?['VIEW','APPROVE'].includes(flag):['WEB_LEAVE_BALANCES','WEB_LEAVE_MANAGEMENT'].includes(code)?['VIEW','UPDATE'].includes(flag):roleUsesEmployeeScope(code);

export function roleScopeSelect(code,flag,label,value='SELF',disabled=false){
 if(!roleHasScopeAction(code,flag))return '';
 return `<div class="role-scope"><label>Phạm vi dữ liệu<select data-role-scope="${e(flag)}" aria-label="Phạm vi ${e(label)}" ${disabled?'disabled':''}>${[['SELF','Chính mình'],['DEPARTMENT','Cùng phòng ban'],['ALL','Tất cả']].map(([scope,text])=>`<option value="${scope}" ${value===scope?'selected':''}>${text}</option>`).join('')}</select></label></div>`;
}

export const roleFlags=[['NEW','Thêm mới','can_new'],['VIEW','Xem','can_view'],['UPDATE','Chỉnh sửa','can_update'],['DELETE','Xóa','can_delete'],['APPROVE','Phê duyệt','can_approve'],['EXPORT','Xuất dữ liệu','can_export']];
export function roleScopeDraft(screens,matrixScreens){
 const scopes=new Map();
 for(const screen of screens){
  if(!roleUsesEmployeeScope(screen.code))continue;
  const original=matrixScreens.find(item=>item.screenCode===screen.code)?.dataScopes||{};
  const values={...original};
  for(const [flag] of roleFlags)if(roleHasScopeAction(screen.code,flag))values[flag]=['SELF','DEPARTMENT','ALL'].includes(original[flag])?original[flag]:'SELF';
  scopes.set(screen.code,values);
 }
 return scopes;
}

export function roleScreenCatalog(catalog){
 const names={WEB_CONTRACT_TYPES:'Loại hợp đồng',WEB_LEAVE_TYPES:'Loại nghỉ phép',WEB_LEAVE_BALANCES:'Số dư phép',WEB_APPROVAL_SETTINGS:'Quy trình phê duyệt',WEB_LEAVE_REQUESTS:'Nghỉ phép',WEB_OVERTIME_REQUESTS:'Tăng ca',WEB_ATTENDANCE_ADJUSTMENTS:'Điều chỉnh công',WEB_LEAVE_MANAGEMENT:'Leave Management',WEB_WORK_SCHEDULES:'Lịch phân ca'};
 const screens=catalog.map(screen=>names[screen.code]?{...screen,name:names[screen.code]}:{...screen});
 for(const [code,name] of Object.entries(names))if(!screens.some(screen=>screen.code===code))screens.push({id:'pending-'+code,code,name,platform:'WEB',isActive:true,registrationRequired:true});
 return screens;
}
export function roleMenuGroups(catalog,platform='WEB'){
 catalog=catalog.filter(screen=>(!screen.platform||screen.platform===platform)).map(screen=>['WEB_LEAVE_MANAGEMENT','WEB_LEAVE_BALANCES'].includes(screen.code)?{...screen,name:screen.code==='WEB_LEAVE_MANAGEMENT'?'Leave Management':'Số dư phép'}:screen);
 const used=new Set();const groups=navigationForScreens(nav,catalog,platform).map(group=>{
 const entries=(group.children||[[group.name,group.route]]).flatMap(([label,path])=>{
 const dynamic=/^\/screens\/([A-Z0-9_]+)$/.exec(path);
 const codes=dynamic?[dynamic[1]]:(roleScreenRoutes[path]||['WEB_'+path.slice(1).replaceAll('/','_').replaceAll('-','_').toUpperCase()]).map(code=>platform==='MOBILE'?code.replace(/^WEB_/,'MOBILE_'):code);
 return codes.flatMap(code=>catalog.filter(screen=>screen.code===code&&!used.has(screen.id)).map(screen=>{used.add(screen.id);return {...screen,label:screen.code==='WEB_LEAVE_BALANCES'?'Số dư phép':screen.code==='WEB_LEAVE_MANAGEMENT'?'Leave Management':path==='/workspace/leave'?screen.name:group.route==='/approvals'?(screen.code==='WEB_APPROVALS'?'Phê duyệt':screen.name):codes.length>1?label+' · '+screen.name:label,...(path==='/workspace/leave'?{parentMenu:'My Leave'}:path==='/admin/master-data'?{parentMenu:'Master Data'}:path==='/admin/settings'?{parentMenu:'System Settings'}:{})};}));
 });return {name:group.name,icon:group.icon,section:group.section,nested:!!group.children||group.route==='/approvals',entries};
 }).filter(group=>group.entries.length);
 for(const group of groups){
 const myLeaveEntries=group.entries.filter(screen=>screen.parentMenu==='My Leave');
 const entries=group.entries.filter(screen=>screen.parentMenu==='Master Data'&&!screen.code.endsWith('_MASTER_DATA')).map(screen=>({...screen,label:screen.name}));
 group.subgroups=entries.length?[{name:'Master Data',key:group.name+'/Master Data',entries}]:[];
 if(myLeaveEntries.length)group.subgroups.push({name:'My Leave',key:group.name+'/My Leave',entries:myLeaveEntries});
 const settingsEntries=group.entries.filter(screen=>screen.parentMenu==='System Settings').flatMap(screen=>screen.code.endsWith('_SYSTEM_SETTINGS')?[
  {...screen,label:'Chính sách mật khẩu',menuKey:'system/password-policy'},
  {...screen,label:'Chấm công',menuKey:'system/attendance'},
  {...screen,label:'Cấp/Thu hồi phép',menuKey:'system/leave-accrual'}
 ]:[{...screen,label:'Quy trình phê duyệt',menuKey:'system/approval-workflow'}]);
 if(settingsEntries.length)group.subgroups.push({name:'System Settings',key:group.name+'/System Settings',entries:settingsEntries});
 }

 const remaining=catalog.filter(screen=>!used.has(screen.id));
 if(remaining.length)groups.push({name:'Màn hình khác',icon:'grid',nested:true,entries:remaining.map(screen=>({...screen,label:screen.name}))});
 return groups;
}
export function applyMyLeaveViewDependency(draft,changed,scopes=new Map(),enabledScreens=null,screens=null){
 if(draft.get('WEB_LEAVE_MANAGEMENT')?.VIEW!==true)return;
 const target='WEB_LEAVE_BALANCES',existing=draft.get(target),scope=scopes.get(target)||{};
 if(existing?.VIEW===true&&['SELF','DEPARTMENT','ALL'].includes(scope.VIEW)){enabledScreens?.add(target);return;}
 if(screens){const screen=screens.find(item=>item.code===target);if(!screen||screen.registrationRequired||screen.isActive===false)throw Error('Cần đăng ký và kích hoạt màn hình Số dư phép (WEB_LEAVE_BALANCES) trước khi cấp quyền Leave Management.');}
 draft.set(target,{...Object.fromEntries(roleFlags.map(([flag])=>[flag,false])),...existing,VIEW:true});
 scopes.set(target,{...scope,VIEW:['SELF','DEPARTMENT','ALL'].includes(scope.VIEW)?scope.VIEW:'SELF'});
 changed.add(target);enabledScreens?.add(target);
}
export function rolePermissionPatch(draft,changed,disabled=new Set(),scopes=new Map()){
 const effectiveDraft=new Map([...draft].map(([code,flags])=>[code,{...flags}])),effectiveScopes=new Map([...scopes].map(([code,values])=>[code,{...values}])),effectiveChanged=new Set(changed);
 applyMyLeaveViewDependency(effectiveDraft,effectiveChanged,effectiveScopes);
 return [...effectiveChanged].map(code=>({screenCode:code,standard:{...effectiveDraft.get(code)},...(effectiveScopes.has(code)?{dataScopes:{...effectiveScopes.get(code)}}:{}),...(disabled.has(code)?{extendedActions:[]}: {})}));
}
function roleGrant(code,flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y'&&p[flag]==='Y');}
export function roleSessionIdentity(session=apiSession()){
 const account=session?.user;
 return {id:account?.userId||'',name:account?.fullName||account?.userId||'Tài khoản',role:(session?.roles||[]).map(role=>role.name||role.code||'').filter(Boolean).join(', ')};
}
export async function mountRoles(root,filters={}){
 if(!root)return;
 if(!apiSession()){root.innerHTML='<p>Vui lòng đăng nhập để xem vai trò và phân quyền.</p>';return;}
 let rolePage=Number(filters.page)||1,roleSearch=filters.search||'';
 const showError=(err,retry)=>{if(!root.isConnected)return;root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" data-role-retry>Thử lại</button>`;root.querySelector('[data-role-retry]').onclick=retry;};
 async function list(){
 root.innerHTML='<p role="status">Đang tải danh sách role…</p>';
 try{const result=await apiRoles(rolePage,roleSearch);if(!root.isConnected)return;
 if(!Array.isArray(result?.data))throw Error('Danh sách role không hợp lệ.');
 root.innerHTML=`<form id="role-search" class="toolbar"><input name="search" value="${e(roleSearch)}" placeholder="Tìm mã hoặc tên role" aria-label="Tìm role"><button class="btn">Tìm kiếm</button></form><div class="table-wrap"><table><thead><tr><th>Mã role</th><th>Tên role</th><th>Hành động</th></tr></thead><tbody>${result.data.map(role=>`<tr><td>${e(role.code)}</td><td>${e(role.name)}</td><td><button class="btn" data-edit-role="${e(role.id)}" ${roleGrant('WEB_PERMISSIONS','canView')?'':'disabled'}>Chỉnh sửa</button></td></tr>`).join('')}</tbody></table></div>${!result.data.length?'<p>Không có role phù hợp.</p>':''}<div class="toolbar"><button class="btn" id="role-prev" ${rolePage<=1?'disabled':''}>Trang trước</button><span>Trang ${rolePage} · ${e(result.total)} role</span><button class="btn" id="role-next" ${rolePage*30>=result.total?'disabled':''}>Trang sau</button></div><p class="muted">Chỉnh sửa quyền cần quyền xem WEB_PERMISSIONS. Lưu cần quyền cập nhật và phê duyệt.</p>`;
 root.querySelector('#role-search').onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();roleSearch=ev.currentTarget.elements.search.value.trim();rolePage=1;list();};
 root.querySelector('#role-prev').onclick=()=>{rolePage--;list();};root.querySelector('#role-next').onclick=()=>{rolePage++;list();};
 root.querySelectorAll('[data-edit-role]').forEach(el=>el.onclick=()=>edit(result.data.find(r=>String(r.id)===el.dataset.editRole)));
 }catch(err){showError(err,list);}
 }
 async function edit(role){
 root.innerHTML='<p role="status">Đang tải màn hình và quyền của role…</p>';
 try{const [catalog,matrix]=await Promise.all([apiAllScreens(),apiRolePermissions(role.id)]);if(!root.isConnected)return;
 if(!Array.isArray(matrix?.screens)||!matrix.version)throw Error('Ma trận quyền hoặc version không hợp lệ.');
 // Keep inactive grants visible and read-only; extended actions are omitted from patches to preserve them.
 const mergedCatalog=[...catalog];for(const item of matrix.screens)if(!mergedCatalog.some(x=>x.code===item.screenCode))mergedCatalog.push({id:item.screenId,code:item.screenCode,name:item.name,platform:item.platform,isActive:false});
 const screens=roleScreenCatalog(mergedCatalog);
 const draft=new Map(screens.map(screen=>{const original=matrix.screens.find(x=>x.screenCode===screen.code);return [screen.code,Object.fromEntries(roleFlags.map(([flag])=>[flag,original?.standard?.[flag]===true]))];}));
 const scopes=roleScopeDraft(screens,matrix.screens);
 const enabledScreens=new Set(matrix.screens.filter(item=>Object.values(item.standard||{}).some(value=>value===true)||item.extendedActions?.length).map(item=>item.screenCode));
 const disabledScreens=new Set();
 const changed=new Set();let activePlatform='WEB';
 const selectedByPlatform={WEB:screens.find(screen=>screen.platform==='WEB'),MOBILE:screens.find(screen=>screen.platform==='MOBILE')};
 let selected=selectedByPlatform.WEB;
 const menuKeyByPlatform={WEB:selected?.code==='WEB_SYSTEM_SETTINGS'?'system/password-policy':selected?.code==='WEB_APPROVAL_SETTINGS'?'system/approval-workflow':null,MOBILE:selectedByPlatform.MOBILE?.code==='MOBILE_SYSTEM_SETTINGS'?'system/password-policy':selectedByPlatform.MOBILE?.code==='MOBILE_APPROVAL_SETTINGS'?'system/approval-workflow':null};
 const menuLabelByPlatform={WEB:selected?.code==='WEB_SYSTEM_SETTINGS'?'Chính sách mật khẩu':selected?.name,MOBILE:selectedByPlatform.MOBILE?.code==='MOBILE_SYSTEM_SETTINGS'?'Chính sách mật khẩu':selectedByPlatform.MOBILE?.name};
 let saving=false;let nameDraft=role.name;
 const openByPlatform={WEB:new Set(),MOBILE:new Set()};
 for(const platform of ['WEB','MOBILE'])for(const group of roleMenuGroups(screens,platform)){
 if(group.entries.some(screen=>screen.id===selectedByPlatform[platform]?.id))openByPlatform[platform].add(group.name);
 for(const subgroup of group.subgroups||[])if(subgroup.entries.some(screen=>screen.id===selectedByPlatform[platform]?.id)){openByPlatform[platform].add(group.name);openByPlatform[platform].add(subgroup.key);}
 }
 const canSave=roleGrant('WEB_PERMISSIONS','canUpdate')&&roleGrant('WEB_PERMISSIONS','canApprove');
 function dependencyReady(){
 const target=screens.find(screen=>screen.code==='WEB_LEAVE_BALANCES');
 if(target&&!target.registrationRequired&&target.isActive!==false)return true;
 root.querySelector('#role-feedback').textContent='Cần đăng ký và kích hoạt màn hình Số dư phép (WEB_LEAVE_BALANCES) trước.';
 return false;
 }
 let dependencyError='';
 function syncMyLeave(strict=false){try{applyMyLeaveViewDependency(draft,changed,scopes,enabledScreens,screens);dependencyError='';}catch(error){dependencyError=error.message;if(strict)throw error;}}

 function screenSwitch(screen){return `<span class="role-switch role-screen-switch"><input type="checkbox" role="switch" aria-label="Phân quyền màn hình ${e(screen.name)}" data-screen-enabled="${e(screen.id)}" data-screen-menu-key="${e(screen.menuKey||'')}" data-screen-label="${e(screen.label||screen.name)}" ${enabledScreens.has(screen.code)?'checked':''} ${!canSave||screen.isActive===false||screen.registrationRequired||saving?'disabled':''}><span class="role-switch-track" aria-hidden="true"></span></span>`;}
 function draw(){
 const menuGroups=roleMenuGroups(screens,activePlatform),openGroups=openByPlatform[activePlatform];
 root.innerHTML=`<button class="btn" id="role-back">← Danh sách role</button><h2 class="role-editor-title">Chỉnh sửa role</h2><form id="role-rename" class="role-name-editor"><label for="role-name">Tên role</label><input id="role-name" name="name" required maxlength="100" value="${e(nameDraft)}" ${!roleGrant('WEB_ROLES','canUpdate')||saving?'disabled':''}><button class="btn" ${!roleGrant('WEB_ROLES','canUpdate')||saving?'disabled':''}>Lưu tên role</button><span class="muted">${e(role.code)}</span></form><p class="muted">Chọn màn hình trong menu, sau đó bật các chức năng được phép.</p><div class="tabs role-platform-tabs" role="tablist" aria-label="Nền tảng phân quyền">${['WEB','MOBILE'].map(platform=>`<button type="button" role="tab" id="role-platform-${platform}" class="tab ${activePlatform===platform?'active':''}" aria-selected="${activePlatform===platform}" aria-controls="role-platform-panel" data-role-platform="${platform}">${icon(platform==='WEB'?'grid':'person',16)} ${platform}</button>`).join('')}</div><div class="role-editor" id="role-platform-panel" role="tabpanel" aria-labelledby="role-platform-${activePlatform}"><nav class="role-menu" aria-label="Màn hình phân quyền">${menuGroups.map(group=>{
 const active=group.entries.some(screen=>screen.id===selected?.id),open=openGroups.has(group.name);
 const screenButton=screen=>{
 const selectedEntry=screen.menuKey?screen.menuKey===menuKeyByPlatform[activePlatform]:selected?.id===screen.id;
 return `<div class="role-screen-row"><button type="button" class="role-screen ${selectedEntry?'selected':''}" data-screen-id="${e(screen.id)}" data-screen-menu-key="${e(screen.menuKey||'')}" data-screen-label="${e(screen.label)}" ${selectedEntry?'aria-current="true"':''}><span>${e(screen.label)}</span>${changed.has(screen.code)?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${screenSwitch(screen)}</div>`;
 };
 const renderedSubgroups=new Set();
 const menuEntries=group.entries.map(screen=>{
 if(!screen.parentMenu)return screenButton(screen);
 if(renderedSubgroups.has(screen.parentMenu))return '';
 renderedSubgroups.add(screen.parentMenu);
 const subgroup=group.subgroups.find(item=>item.name===screen.parentMenu);if(!subgroup)return '';
 const expanded=openGroups.has(subgroup.key),subActive=subgroup.entries.some(item=>item.id===selected?.id);
 return `<button type="button" class="role-subgroup-toggle ${subActive?'active':''}" data-role-group="${e(subgroup.key)}" aria-expanded="${expanded}"><span>${e(subgroup.name)}</span><span class="chev ${expanded?'role-chevron-open':''}">${icon('chevron',12)}</span>${subgroup.entries.some(item=>changed.has(item.code))?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${expanded?`<div class="submenu role-submenu role-subgroup-items">${subgroup.entries.map(screenButton).join('')}</div>`:''}`;
 }).join('');
 return `${group.section?`<div class="nav-caption">${e(group.section)}</div>`:''}${group.nested?`<button type="button" class="nav-item ${active?'active':''}" data-role-group="${e(group.name)}" aria-expanded="${open}">${icon(group.icon,18)}<span class="role-nav-group-copy"><span class="nav-label">${e(group.name)}</span>${group.description?`<small>${e(group.description)}</small>`:''}</span><span class="chev ${open?'role-chevron-open':''}">${icon('chevron',12)}</span></button>${open?`<div class="submenu role-submenu">${menuEntries}</div>`:''}`:`<div class="role-screen-row"><button type="button" class="nav-item ${active?'active':''}" data-screen-id="${e(group.entries[0].id)}" ${active?'aria-current="true"':''}>${icon(group.icon,18)}<span>${e(group.name)}</span>${changed.has(group.entries[0].code)?'<span class="role-change-dot" aria-label="Chưa lưu"></span>':''}</button>${screenSwitch(group.entries[0])}</div>`}`;
 }).join('')||'<p class="muted role-menu-empty">Chưa có màn hình cho nền tảng này.</p>'}</nav><section class="role-functions">${selected?`<div class="role-functions-heading"><span class="icon-tile blue">${icon('shield',20)}</span><div><h3>${e(menuLabelByPlatform[activePlatform]||selected.name)}</h3><p class="muted">${enabledScreens.has(selected.code)?'Thiết lập quyền thao tác trên màn hình':'Bật nút gạt ở menu để phân quyền màn hình này'}</p></div></div>${selected.registrationRequired?`<p>Màn hình chưa được đăng ký trên hệ thống.</p><button type="button" class="btn primary" id="role-register-screen" ${!roleGrant('WEB_PERMISSIONS','canNew')||saving?'disabled':''}>Đăng ký màn hình ${e(selected.name)}</button>${!roleGrant('WEB_PERMISSIONS','canNew')?'<p class="muted">Cần quyền thêm mới trong Phân quyền để đăng ký màn hình.</p>':''}`:''}${selected.isActive===false?'<p>Màn hình ngừng hoạt động · chỉ xem quyền đã cấp.</p>':''}${['WEB_LEAVE_MANAGEMENT','WEB_LEAVE_BALANCES'].includes(selected.code)?'<p class="muted role-scope-note">Bật Xem cho Leave Management sẽ tự cấp Xem số dư phép. Phạm vi số dư mặc định là Chính mình; quyền và phạm vi đã có vẫn được giữ.</p>':''}${selected.code==='WEB_SYSTEM_SETTINGS'?'<p class="muted role-scope-note">Quyền này áp dụng cho Chính sách mật khẩu, Chấm công và Cấp/Thu hồi phép trong System Settings.</p>':''}<div class="role-toggles">${roleFlags.map(([flag,label])=>`<div class="role-permission-item"><label class="role-toggle-row"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" aria-label="${label}" data-role-flag="${flag}" ${draft.get(selected.code)[flag]?'checked':''} ${!canSave||!enabledScreens.has(selected.code)||selected.isActive===false||selected.registrationRequired||saving?'disabled':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>${roleScopeSelect(selected.code,flag,label,scopes.get(selected.code)?.[flag]||'SELF',!canSave||!enabledScreens.has(selected.code)||!draft.get(selected.code)[flag]||selected.isActive===false||selected.registrationRequired||saving)}</div>`).join('')}</div>${requestScopeScreens.includes(selected.code)?'<p class="muted role-scope-note">Phạm vi áp dụng khi xem yêu cầu. Tạo và hủy đơn dùng nhân viên liên kết với tài khoản hiện tại.</p>':selected.code==='WEB_APPROVALS'?'<p class="muted role-scope-note">Phạm vi xem và duyệt được cấu hình riêng. Chỉ người được gán ở bước hiện tại mới có thể duyệt.</p>':roleUsesEmployeeScope(selected.code)?'<p class="muted role-scope-note">Chính mình chỉ cho phép đọc. Các thao tác ghi cần phạm vi Cùng phòng ban hoặc Tất cả.</p>':''}`:'<p>Chưa có màn hình trong danh mục.</p>'}</section></div><div class="role-save"><p id="role-feedback" role="status">${e(dependencyError)}</p><span>${changed.size} màn hình thay đổi</span><button id="role-save" class="btn primary" ${!canSave||!changed.size||saving?'disabled':''}>${saving?'Đang lưu…':'Lưu lại'}</button></div>`;
 root.querySelector('#role-register-screen')?.addEventListener('click',async()=>{
 if(saving||!selected?.registrationRequired||!roleGrant('WEB_PERMISSIONS','canNew'))return;
 const target=selected;saving=true;draw();
 try{
  let registered;
  try{registered=await apiCreateScreen({code:target.code,name:target.name,platform:target.platform,isActive:true});}
  catch(err){if(err.status!==409)throw err;registered=(await apiAllScreens()).find(screen=>screen.code===target.code);}
  if(!root.isConnected)return;
  if(!registered?.id||registered.code!==target.code)throw Error('Chưa nhận được màn hình đã đăng ký. Vui lòng mở lại role.');
  Object.assign(target,registered,{registrationRequired:false});
  saving=false;draw();root.querySelector('#role-feedback').textContent='Đã đăng ký màn hình. Bật màn hình và chọn các quyền cần cấp, sau đó lưu lại.';
 }catch(err){saving=false;if(root.isConnected){draw();root.querySelector('#role-feedback').textContent=err.message;}}
 });
 root.querySelector('#role-name').oninput=ev=>{nameDraft=ev.target.value;};
 root.querySelector('#role-rename').onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving||!roleGrant('WEB_ROLES','canUpdate'))return;
 const name=nameDraft.trim();if(!name){root.querySelector('#role-feedback').textContent='Vui lòng nhập tên role.';return;}
 saving=true;draw();
 try{const saved=await apiUpdateRole(role.id,matrix.version,{code:role.code,name});if(!root.isConnected)return;
 if(!saved?.version)throw Error('Chưa nhận version mới. Hãy tải lại role để xác nhận.');
 matrix.version=saved.version;role.name=saved.name??name;nameDraft=role.name;saving=false;draw();root.querySelector('#role-feedback').textContent='Đã cập nhật tên role.';
 }catch(err){saving=false;if(root.isConnected){draw();root.querySelector('#role-feedback').textContent=err.message;}}
 };
 root.querySelectorAll('[data-role-platform]').forEach(el=>el.onclick=()=>{selectedByPlatform[activePlatform]=selected;activePlatform=el.dataset.rolePlatform;selected=selectedByPlatform[activePlatform];draw();root.querySelector(`[data-role-platform="${activePlatform}"]`)?.focus();});
 root.querySelectorAll('[data-role-group]').forEach(el=>el.onclick=()=>{const name=el.dataset.roleGroup;openGroups.has(name)?openGroups.delete(name):openGroups.add(name);draw();root.querySelectorAll('[data-role-group]').forEach(button=>{if(button.dataset.roleGroup===name)button.focus();});});
 root.querySelector('#role-back').onclick=()=>{if(saving)return;if((!changed.size&&nameDraft===role.name)||confirm('Bỏ các thay đổi chưa lưu?'))list();};
 root.querySelectorAll('[data-screen-id]').forEach(el=>el.onclick=()=>{selected=screens.find(x=>String(x.id)===el.dataset.screenId);menuKeyByPlatform[activePlatform]=el.dataset.screenMenuKey||null;menuLabelByPlatform[activePlatform]=el.dataset.screenLabel||selected?.name;draw();});
 root.querySelectorAll('[data-screen-enabled]').forEach(el=>el.onchange=()=>{
 const screen=screens.find(item=>String(item.id)===el.dataset.screenEnabled);
 if(!screen||!canSave||screen.isActive===false||screen.registrationRequired||saving)return;
 if(screen.code==='WEB_LEAVE_MANAGEMENT'&&el.checked&&!dependencyReady()){el.checked=false;return;}
 selected=screen;menuKeyByPlatform[activePlatform]=el.dataset.screenMenuKey||null;menuLabelByPlatform[activePlatform]=el.dataset.screenLabel||screen.name;
 if(el.checked){enabledScreens.add(screen.code);draft.get(screen.code).VIEW=true;if(roleUsesEmployeeScope(screen.code)){if(!scopes.has(screen.code))scopes.set(screen.code,{});scopes.get(screen.code).VIEW??='SELF';}}
 else{enabledScreens.delete(screen.code);disabledScreens.add(screen.code);roleFlags.forEach(([flag])=>{draft.get(screen.code)[flag]=false;});}
 changed.add(screen.code);syncMyLeave();draw();root.querySelector(`[data-screen-enabled="${screen.id}"][data-screen-menu-key="${menuKeyByPlatform[activePlatform]||''}"]`)?.focus();
 });
 root.querySelectorAll('[data-role-flag]').forEach(el=>el.onchange=()=>{if(!canSave||saving)return;if(selected.code==='WEB_LEAVE_MANAGEMENT'&&el.dataset.roleFlag==='VIEW'&&el.checked&&!dependencyReady()){el.checked=false;return;}draft.get(selected.code)[el.dataset.roleFlag]=el.checked;if(roleHasScopeAction(selected.code,el.dataset.roleFlag)&&el.checked){if(!scopes.has(selected.code))scopes.set(selected.code,{});scopes.get(selected.code)[el.dataset.roleFlag]??='SELF';}changed.add(selected.code);syncMyLeave();const flag=el.dataset.roleFlag;draw();root.querySelector(`[data-role-flag="${flag}"]`)?.focus();});
 root.querySelectorAll('[data-role-scope]').forEach(el=>el.onchange=()=>{
 if(!canSave||saving||selected.isActive===false||selected.registrationRequired)return;
 const flag=el.dataset.roleScope;
 if(!roleHasScopeAction(selected.code,flag)||!['SELF','DEPARTMENT','ALL'].includes(el.value))return;
 if(!enabledScreens.has(selected.code)||!draft.get(selected.code)[flag])return;
 if(!scopes.has(selected.code))scopes.set(selected.code,{});
 scopes.get(selected.code)[flag]=el.value;
 changed.add(selected.code);draw();
 root.querySelector(`[data-role-scope="${flag}"]`)?.focus();
 });
 root.querySelector('#role-save').onclick=async()=>{
 if(saving||!canSave||!changed.size)return;saving=true;draw();
 try{syncMyLeave(true);const saved=await apiSaveRolePermissions(role.id,matrix.version,rolePermissionPatch(draft,changed,disabledScreens,scopes));if(!root.isConnected)return;
 if(!saved?.version)throw Error('Đã gửi lưu nhưng chưa nhận version mới. Hãy quay lại và tải lại role để xác nhận.');
 matrix.version=saved.version;changed.clear();disabledScreens.clear();saving=false;draw();root.querySelector('#role-feedback').textContent='Đã lưu quyền thành công.';
 }catch(err){saving=false;if(!root.isConnected)return;draw();root.querySelector('#role-feedback').textContent=err.message+' Nếu dữ liệu đã thay đổi, quay lại danh sách và mở role để tải phiên bản mới.';}
 };
 }
 draw();
 }catch(err){showError(err,()=>edit(role));}
 }
 await list();
}
