import {apiSession,apiUsers,apiTerminalLoggingSettings,apiTerminalLoggingModules} from '../../../api/client.js';
import {e} from '../../../utils.js';
import {icon} from '../../../components/ui.js';
import {toast} from '../../../components/dialog.js';

export function terminalLoggingGrant(flag,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_SYSTEM_SETTINGS'&&p.canView==='Y'&&p[flag]==='Y');}
export function terminalLoggingCatalog(response){if(!Array.isArray(response?.modules)||response.modules.some(name=>typeof name!=='string'||!name.trim())||!Array.isArray(response.specialUsers)||response.specialUsers.some(name=>typeof name!=='string'||!name.trim()))throw Error('Danh mục module log không hợp lệ.');return response;}
export function terminalLoggingValidate(settings,catalog){
 if(!settings||typeof settings!=='object'||Array.isArray(settings))throw Error('Cấu hình log không hợp lệ.');
 for(const key of ['enabled','defaultUser','defaultModule','includeSql'])if(!['Y','N'].includes(settings[key]))throw Error('Cấu hình log chỉ nhận Y hoặc N.');
 for(const key of ['users','modules']){
 const rules=settings[key];if(!rules||typeof rules!=='object'||Array.isArray(rules)||Object.keys(rules).length>500)throw Error('Tối đa 500 cấu hình riêng cho user hoặc module.');const used=new Set();
 for(const [name,flag] of Object.entries(rules)){const normalized=name.toLowerCase();if(!name.trim()||name!==name.trim()||key==='users'&&name.length>100||used.has(normalized)||!['Y','N'].includes(flag))throw Error('User/module không được trống, trùng tên hoặc có cờ khác Y/N.');used.add(normalized);if(key==='modules'&&!catalog.modules.some(module=>module.toLowerCase()===normalized))throw Error('Module không thuộc danh mục: '+name);}
 }
 if(settings.userModules!==undefined){
 const entries=settings.userModules;if(!entries||typeof entries!=='object'||Array.isArray(entries)||Object.keys(entries).length>500)throw Error('Tối đa 500 cấu hình module theo user.');const seen=new Set();
 for(const [user,modules] of Object.entries(entries)){if(!user.trim()||user!==user.trim()||user.length>100||seen.has(user.toLowerCase()))throw Error('User không hợp lệ hoặc trùng tên.');seen.add(user.toLowerCase());terminalLoggingValidate({...settings,userModules:undefined,users:{},modules},catalog);}
 }
 return settings;
}
export function terminalLoggingEffective(rules,key,fallback){const existing=Object.keys(rules).find(name=>name.toLowerCase()===key.toLowerCase());return existing===undefined?fallback:rules[existing];}
export function terminalLoggingModuleMode(settings,modules){return settings.defaultModule==='Y'&&modules.every(name=>terminalLoggingEffective(settings.modules,name,settings.defaultModule)==='Y')?'ALL':'SELECTED';}
export function terminalLoggingSelectAll(settings){settings.defaultModule='Y';settings.modules={};return settings;}
export function terminalLoggingSetModule(settings,module,enabled,modules){
 const next={...settings.modules};for(const name of modules){const key=Object.keys(next).find(key=>key.toLowerCase()===name.toLowerCase())||name;next[key]=terminalLoggingEffective(settings.modules,name,settings.defaultModule);}
 const key=Object.keys(next).find(key=>key.toLowerCase()===module.toLowerCase())||module;next[key]=enabled?'Y':'N';settings.defaultModule='N';settings.modules=next;return settings;
}
export function terminalLoggingUserModules(settings,user,modules){
 const key=Object.keys(settings.userModules||{}).find(key=>key.toLowerCase()===user.toLowerCase());
 if(key!==undefined)return settings.userModules[key];
 return Object.fromEntries(modules.map(module=>[module,terminalLoggingEffective(settings.modules,module,settings.defaultModule)]));
}
export function terminalLoggingSetUserModules(settings,user,rules){
 settings.userModules||={};const key=Object.keys(settings.userModules).find(key=>key.toLowerCase()===user.toLowerCase())||user;
 if(rules===null)delete settings.userModules[key];else settings.userModules[key]={...rules};return settings;
}
export function terminalLoggingAddUser(settings,userId){const id=String(userId||'').trim();if(!id||id.length>100)throw Error('Chọn hoặc nhập User ID hợp lệ.');if(Object.keys(settings.users).some(key=>key.toLowerCase()===id.toLowerCase()))throw Error('User này đã có trong danh sách.');if(Object.keys(settings.users).length>=500)throw Error('Tối đa 500 user.');settings.users={...settings.users,[id]:'Y'};terminalLoggingSetUserModules(settings,id,{});return settings;}
// Keep the API-required fallback disabled; only explicitly configured users may log.
export function terminalLoggingExplicitUsers(settings){return {...JSON.parse(JSON.stringify(settings)),defaultUser:'N'};}
export function terminalLoggingState(response){
 if(!Number.isSafeInteger(response?.version)||response.version<0||!response.settings)throw Error('Cấu hình hoặc phiên bản log trả về không hợp lệ.');
 const settings=JSON.parse(JSON.stringify(response.settings));for(const key of ['enabled','defaultUser','defaultModule','includeSql'])if(typeof settings[key]==='string')settings[key]=settings[key].toUpperCase();
 for(const map of ['users','modules'])if(settings[map]&&typeof settings[map]==='object'&&!Array.isArray(settings[map]))for(const key of Object.keys(settings[map]))if(typeof settings[map][key]==='string')settings[map][key]=settings[map][key].toUpperCase();
 for(const rules of Object.values(settings.userModules||{}))if(rules&&typeof rules==='object'&&!Array.isArray(rules))for(const key of Object.keys(rules))if(typeof rules[key]==='string')rules[key]=rules[key].toUpperCase();
 terminalLoggingValidate(settings,{modules:[...Object.keys(settings.modules||{}),...Object.values(settings.userModules||{}).flatMap(rules=>Object.keys(rules||{}))]});const etag=response.etag||`"${response.version}"`;if(!/^"(?:0|[1-9]\d*)"$/.test(etag))throw Error('ETag cấu hình log không hợp lệ.');return {settings,etag,version:response.version,updatedAtUtc:response.updatedAtUtc};
}

function terminalLoggingToggle(name,label,enabled){return `<label class="role-toggle-row terminal-toggle"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" name="${name}" ${enabled?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;}

export async function mountTerminalLogging(root,options={}){
 if(!root)return;if(!terminalLoggingGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền WEB_SYSTEM_SETTINGS/VIEW.</p>';return;}
 let catalog,state,draft,busy=false,dirty=false,stale=false,pickerOpen=false,userPage=1,userSearch='',userGeneration=0,userTimer,userRows=[],userTotal=0;
 const canUpdate=terminalLoggingGrant('canUpdate'),canListUsers=!!apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_USERS'&&p.canView==='Y');
 function setDirty(value){dirty=value;options.onDirty?.(value);}
 function setBusy(value){busy=value;options.onSaving?.(value);}
 async function load(){
 root.innerHTML='<p role="status">Đang tải cấu hình log terminal…</p>';
 try{const [response,modules]=await Promise.all([apiTerminalLoggingSettings(),apiTerminalLoggingModules()]);if(!root.isConnected)return;catalog=terminalLoggingCatalog(modules);state=terminalLoggingState(response);draft=state.settings;
 for(const user of Object.keys(draft.userModules||{}))if(!Object.keys(draft.users).some(key=>key.toLowerCase()===user.toLowerCase()))draft.users[user]=draft.defaultUser;
 // Display saved overrides even if a module was removed from the current catalog.
 if(!['enabled','defaultUser','defaultModule','includeSql'].every(key=>['Y','N'].includes(draft[key]))||!draft.users||Array.isArray(draft.users)||!draft.modules||Array.isArray(draft.modules))throw Error('Cấu hình log trả về không hợp lệ.');
 stale=false;pickerOpen=false;setDirty(false);render();
 }catch(err){if(root.isConnected){root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;root.querySelector('button').onclick=load;}}
 }
 function userModuleForm(user,index){
 const custom=Object.keys(draft.userModules||{}).some(key=>key.toLowerCase()===user.toLowerCase()),rules=terminalLoggingUserModules(draft,user,catalog.modules),all=catalog.modules.length>0&&catalog.modules.every(module=>terminalLoggingEffective(rules,module,'N')==='Y');
 return `<div class="terminal-user-module-form"><label>Module của ${e(user)}<select data-terminal-user-mode="${index}"><option value="DEFAULT" ${!custom?'selected':''}>Dùng module mặc định</option><option value="ALL" ${custom&&all?'selected':''}>Tất cả module hiện tại</option><option value="SELECTED" ${custom&&!all?'selected':''}>Chọn nhiều module</option></select></label>${custom?`<div class="terminal-modules">${catalog.modules.map((module,moduleIndex)=>`<label><input type="checkbox" data-terminal-user-module="${index}" data-module-index="${moduleIndex}" ${terminalLoggingEffective(rules,module,'N')==='Y'?'checked':''}><span>${e(module)}</span></label>`).join('')}</div>${Object.keys(rules).filter(key=>!catalog.modules.some(module=>module.toLowerCase()===key.toLowerCase())).map(key=>`<div class="terminal-unknown-module"><span>${e(key)} (ngoài danh mục)</span><button type="button" class="btn small" data-terminal-remove-user-module="${index}" data-module="${e(key)}">Xóa</button></div>`).join('')}`:''}</div>`;
 }
 function render(){
 ++userGeneration;clearTimeout(userTimer);const mode=terminalLoggingModuleMode(draft,catalog.modules);
 root.innerHTML=`<form id="terminal-logging-form" class="terminal-logging-form"><div class="terminal-heading"><div><h2>Terminal Logging</h2><p>Cấu hình log theo user và module</p></div><span class="muted">${state.version===0?'Cấu hình mặc định của máy chủ':'Phiên bản '+state.version}</span></div><fieldset class="user-edit-fieldset" ${canUpdate?'':'disabled'}><div class="terminal-global-switches">${terminalLoggingToggle('enabled','Bật log terminal',draft.enabled==='Y')}${terminalLoggingToggle('includeSql','Ghi log SQL',draft.includeSql==='Y')}</div><div class="terminal-rule-grid"><section class="terminal-rule-section"><div class="terminal-section-heading"><h3>User</h3><button type="button" class="btn" data-terminal-add-user ${Object.keys(draft.users).length>=500?'disabled':''}>${icon('plus',16)} Thêm user</button></div><p class="muted">Chỉ user được thêm và bật trong danh sách mới được ghi log.</p><div data-terminal-user-list>${Object.keys(draft.users).length?Object.entries(draft.users).map(([user,flag],index)=>`<div class="terminal-user-card"><div class="terminal-user-row"><span class="terminal-user-name">${e(user)}</span><span class="role-switch"><input type="checkbox" role="switch" data-terminal-user="${index}" aria-label="Bật log cho ${e(user)}" ${flag==='Y'?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span><button type="button" class="icon-button" data-terminal-remove-user="${index}" aria-label="Xóa cấu hình user ${e(user)}">${icon('close',16)}</button></div>${userModuleForm(user,index)}</div>`).join(''):'<p class="empty terminal-empty">Chưa có cấu hình user riêng.</p>'}</div><div class="terminal-user-picker" data-terminal-user-picker ${pickerOpen?'':'hidden'}>${canListUsers?'<label>Tìm user<input type="search" data-terminal-user-search placeholder="User ID hoặc email"></label><label>Chọn user<select data-terminal-user-choice><option value="">Chọn user…</option></select></label><div class="terminal-user-pagination" data-terminal-user-pages></div>':`<label>User ID<input type="text" maxlength="100" list="terminal-special-users" data-terminal-user-choice placeholder="Nhập đúng User ID"><datalist id="terminal-special-users">${catalog.specialUsers.map(user=>`<option value="${e(user)}"></option>`).join('')}</datalist></label>`}<button type="button" class="btn primary" data-terminal-confirm-user>Thêm vào danh sách</button><p class="muted" role="status" data-terminal-user-feedback></p></div></section><section class="terminal-rule-section"><h3>Module mặc định</h3><p class="muted">Áp dụng cho user chưa có cấu hình module riêng.</p><label>Phạm vi module<select name="moduleMode"><option value="ALL" ${mode==='ALL'?'selected':''}>Tất cả module</option><option value="SELECTED" ${mode==='SELECTED'?'selected':''}>Chọn nhiều module</option></select></label><div class="terminal-modules" ${mode==='ALL'?'hidden':''}>${catalog.modules.map((module,index)=>`<label><input type="checkbox" data-terminal-module="${index}" ${terminalLoggingEffective(draft.modules,module,draft.defaultModule)==='Y'?'checked':''}><span>${e(module)}</span></label>`).join('')||'<p>Chưa có module trong danh mục.</p>'}</div>${mode==='ALL'?'<p class="muted terminal-all-modules">Áp dụng cho tất cả module hiện tại và module mới.</p>':''}${Object.keys(draft.modules).filter(key=>!catalog.modules.some(module=>module.toLowerCase()===key.toLowerCase())).map(key=>`<div class="terminal-unknown-module"><span>${e(key)} (ngoài danh mục)</span><button class="btn small danger" type="button" data-terminal-remove-module="${e(key)}">Xóa cấu hình cũ</button></div>`).join('')}</section></div><div class="form-actions">${canUpdate?`<button class="btn primary" type="submit" ${stale?'disabled':''}>Lưu cấu hình</button>`:''}</div></fieldset><div class="terminal-feedback"><p role="status" data-terminal-feedback>${!canUpdate?'Bạn chỉ có quyền xem. Lưu cần WEB_SYSTEM_SETTINGS/UPDATE.':stale?'Cấu hình đã thay đổi. Tải lại trước khi lưu tiếp.':''}</p><button class="btn" type="button" data-terminal-reload>Tải lại cấu hình</button></div></form>`;
 const form=root.querySelector('form'),fieldset=form.querySelector('fieldset'),feedback=form.querySelector('[data-terminal-feedback]');
 for(const key of ['enabled','includeSql'])form.elements.namedItem(key).onchange=event=>{if(busy||!canUpdate)return;draft[key]=event.target.checked?'Y':'N';setDirty(true);};
 form.elements.moduleMode.onchange=event=>{if(busy||!canUpdate)return;if(event.target.value==='ALL')terminalLoggingSelectAll(draft);else{const next={...draft.modules};for(const module of catalog.modules){const key=Object.keys(next).find(key=>key.toLowerCase()===module.toLowerCase())||module;next[key]=terminalLoggingEffective(draft.modules,module,draft.defaultModule);}draft.defaultModule='N';draft.modules=next;}setDirty(true);render();};
 root.querySelectorAll('[data-terminal-module]').forEach(input=>input.onchange=()=>{if(busy||!canUpdate)return;terminalLoggingSetModule(draft,catalog.modules[Number(input.dataset.terminalModule)],input.checked,catalog.modules);setDirty(true);});
 root.querySelectorAll('[data-terminal-user]').forEach(input=>input.onchange=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(input.dataset.terminalUser)];draft.users[user]=input.checked?'Y':'N';setDirty(true);});
 root.querySelectorAll('[data-terminal-remove-user]').forEach(button=>button.onclick=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(button.dataset.terminalRemoveUser)];delete draft.users[user];terminalLoggingSetUserModules(draft,user,null);setDirty(true);render();});
 root.querySelectorAll('[data-terminal-remove-module]').forEach(button=>button.onclick=()=>{if(busy||!canUpdate)return;delete draft.modules[button.dataset.terminalRemoveModule];setDirty(true);render();});
 root.querySelectorAll('[data-terminal-user-mode]').forEach(select=>select.onchange=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(select.dataset.terminalUserMode)];terminalLoggingSetUserModules(draft,user,select.value==='DEFAULT'?null:select.value==='ALL'?Object.fromEntries(catalog.modules.map(module=>[module,'Y'])):terminalLoggingUserModules(draft,user,catalog.modules));setDirty(true);render();});
 root.querySelectorAll('[data-terminal-user-module]').forEach(input=>input.onchange=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(input.dataset.terminalUserModule)],rules={...terminalLoggingUserModules(draft,user,catalog.modules)},module=catalog.modules[Number(input.dataset.moduleIndex)],key=Object.keys(rules).find(key=>key.toLowerCase()===module.toLowerCase())||module;rules[key]=input.checked?'Y':'N';terminalLoggingSetUserModules(draft,user,rules);setDirty(true);});
 root.querySelectorAll('[data-terminal-remove-user-module]').forEach(button=>button.onclick=()=>{if(busy||!canUpdate)return;const user=Object.keys(draft.users)[Number(button.dataset.terminalRemoveUserModule)],rules={...terminalLoggingUserModules(draft,user,catalog.modules)};delete rules[button.dataset.module];terminalLoggingSetUserModules(draft,user,rules);setDirty(true);render();});
 root.querySelector('[data-terminal-add-user]').onclick=()=>{if(busy||!canUpdate)return;pickerOpen=!pickerOpen;render();};
 root.querySelector('[data-terminal-confirm-user]').onclick=()=>{if(busy||!canUpdate)return;try{const id=root.querySelector('[data-terminal-user-choice]').value;terminalLoggingAddUser(draft,id);pickerOpen=false;setDirty(true);render();}catch(err){root.querySelector('[data-terminal-user-feedback]').textContent=err.message;}};
 root.querySelector('[data-terminal-reload]').onclick=()=>{if(busy)return;if(dirty&&!confirm('Bỏ thay đổi cấu hình log chưa lưu để tải lại?'))return;++userGeneration;clearTimeout(userTimer);load();};
 if(pickerOpen&&canListUsers){const input=root.querySelector('[data-terminal-user-search]');input.value=userSearch;input.oninput=()=>{clearTimeout(userTimer);++userGeneration;userSearch=input.value.trim();userPage=1;userTimer=setTimeout(loadUsers,300);};void loadUsers();}
 form.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||stale||!terminalLoggingGrant('canUpdate'))return;let payload;
 try{payload=terminalLoggingExplicitUsers(draft);terminalLoggingValidate(payload,catalog);}catch(err){feedback.textContent=err.message;return;}
 setBusy(true);fieldset.disabled=true;root.querySelector('[data-terminal-reload]').disabled=true;feedback.textContent='Đang lưu cấu hình log…';
 try{const response=await apiTerminalLoggingSettings(payload,state.etag);if(!form.isConnected)return;const saved=terminalLoggingState(response);if(saved.version<=state.version)throw Error('Chưa nhận phiên bản mới. Tải lại cấu hình để xác nhận trước khi lưu tiếp.');terminalLoggingValidate(saved.settings,catalog);state=saved;draft=state.settings;pickerOpen=false;setDirty(false);setBusy(false);render();root.querySelector('[data-terminal-feedback]').textContent='Đã lưu cấu hình log terminal.';toast('Đã lưu cấu hình log terminal.');}
 catch(err){if(form.isConnected){stale=[409,412,428].includes(err.status);feedback.textContent=err.message+(stale?' Tải lại cấu hình trước khi sửa và lưu tiếp.':'');}}
 finally{setBusy(false);if(form.isConnected){fieldset.disabled=!canUpdate;const save=form.querySelector('[type=submit]');if(save)save.disabled=stale;root.querySelector('[data-terminal-reload]').disabled=false;}}
 };
 }
 async function loadUsers(){
 const current=++userGeneration;if(!root.isConnected||!pickerOpen)return;const status=root.querySelector('[data-terminal-user-feedback]');status.textContent='Đang tải user…';
 try{const result=await apiUsers(userPage,userSearch);if(!root.isConnected||current!==userGeneration||!pickerOpen)return;if(!Array.isArray(result.data)||!Number.isSafeInteger(result.total))throw Error('Danh sách user không hợp lệ.');userRows=result.data;userTotal=result.total;
 const selected=new Set(Object.keys(draft.users).map(key=>key.toLowerCase())),special=catalog.specialUsers.filter(user=>!userSearch||user.toLowerCase().includes(userSearch.toLowerCase())),seen=new Set(special.map(user=>user.toLowerCase())),ordinary=userRows.filter(user=>!seen.has(user.userId.toLowerCase()));
 const select=root.querySelector('[data-terminal-user-choice]');select.innerHTML='<option value="">Chọn user…</option>'+special.map(user=>`<option value="${e(user)}" ${selected.has(user.toLowerCase())?'disabled':''}>${e(user)}</option>`).join('')+ordinary.map(user=>`<option value="${e(user.userId)}" ${selected.has(user.userId.toLowerCase())?'disabled':''}>${e(user.userId)} · ${e(user.email)}</option>`).join('');
 const pages=root.querySelector('[data-terminal-user-pages]');pages.innerHTML=`<button class="btn small" type="button" data-prev ${userPage===1?'disabled':''}>Trước</button><small>Trang ${userPage}</small><button class="btn small" type="button" data-next ${userPage*30>=userTotal?'disabled':''}>Sau</button>`;pages.querySelector('[data-prev]').onclick=()=>{userPage--;loadUsers();};pages.querySelector('[data-next]').onclick=()=>{userPage++;loadUsers();};status.textContent='';
 }catch(err){if(root.isConnected&&current===userGeneration){status.innerHTML=`${e(err.message)} <button class="btn small" type="button">Thử lại</button>`;status.querySelector('button').onclick=loadUsers;}}
 }
 await load();
}
