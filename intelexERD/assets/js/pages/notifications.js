import {notificationService,notificationError} from '../services/notification-service.js';
import {e} from '../utils.js';
import {icon} from '../components/ui.js';

export const notificationTabs=[['all','Tất cả'],['unread','Chưa đọc'],['task','Công việc'],['attendance','Chấm công'],['leave','Nghỉ phép'],['system','Hệ thống']];
export function filterNotificationItems(items,tab){
 if(tab==='all')return items;
 if(tab==='unread')return items.filter(item=>!item.readAt);
 const references={task:['TASK','PROJECT_TASK'],attendance:['ATTENDANCE','WORK_SCHEDULE','SHIFT'],leave:['LEAVE','LEAVE_REQUEST'],system:['SYSTEM']};
 return items.filter(item=>references[tab]?.includes(String(item.referenceType||'').toUpperCase())||(tab==='system'&&String(item.source||'').toUpperCase()==='SYSTEM'));
}
export function notificationTime(value){
 if(!value)return '—';const text=String(value),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'Z');
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
export function notificationRows(items){
 return items.map(item=>`<button type="button" class="notification-row api-notification-row ${item.readAt?'':'unread'}" data-noti-read="${e(item.id)}"><span class="icon-tile blue">${icon('bell',16)}</span><span class="api-notification-content"><strong>${e(item.title)}</strong><span class="api-notification-text">${e(item.content)}</span><small>${e(notificationTime(item.publishedAt||item.createdAt))} · ${item.readAt?'Đã đọc':'Chưa đọc'}</small></span>${item.readAt?'':'<span class="api-notification-dot" aria-label="Chưa đọc"></span>'}</button>`).join('');
}
function realtimeLabel(state){return state.realtime==='connected'?'Đang cập nhật trực tiếp':state.realtime==='connecting'?'Đang kết nối thông báo trực tiếp…':state.realtime==='reconnecting'?'Đang kết nối lại · Bạn vẫn có thể tải thông báo':'Chưa kết nối trực tiếp · Bạn vẫn có thể tải thông báo';}
export function renderNotificationHeader(root,state=notificationService.snapshot(),service=notificationService){
 if(!root)return;
 const focused=root.contains(document.activeElement)?document.activeElement:null,focusId=focused?.id,focusRead=focused?.dataset?.notiRead;
 if(root.notificationGeneration!==state.generation){root.notificationOpen=false;root.notificationError='';root.notificationGeneration=state.generation;}
 const open=!!root.notificationOpen,count=state.count;
 root.innerHTML=`<button type="button" class="icon-button" id="notification-bell" aria-label="Thông báo${count===null?'':`, ${count} chưa đọc`}" aria-expanded="${open}" aria-controls="notification-dropdown">${icon('bell',19)}${count>0?`<span class="notification-count" aria-hidden="true">${count>99?'99+':count}</span>`:''}</button><section id="notification-dropdown" class="notification-dropdown" aria-label="Thông báo mới nhất" ${open?'':'hidden'}><div class="notification-dropdown-heading"><strong>Thông báo</strong><button type="button" class="btn text small" data-noti-all ${root.notificationBusy?'disabled':''}>Đánh dấu tất cả đã đọc</button></div><p class="notification-connection muted">${realtimeLabel(state)}</p>${state.error?`<p class="form-error" role="alert">${e(state.error)}</p>`:''}${root.notificationError?`<p class="form-error" role="alert">${e(root.notificationError)}</p>`:''}<div class="notification-dropdown-list">${!state.loaded&&state.loading?'<p role="status">Đang tải thông báo…</p>':state.items.length?notificationRows(state.items.slice(0,8)):state.loaded?'<p class="notification-empty">Chưa có thông báo.</p>':''}</div><div class="notification-dropdown-footer"><button type="button" class="btn small" data-noti-refresh ${state.loading?'disabled':''}>${state.loading?'Đang tải…':'Làm mới'}</button><a class="btn primary small" href="#/notifications">Xem tất cả</a></div></section>`;
 root.querySelector('#notification-bell').onclick=()=>{root.notificationOpen=!root.notificationOpen;renderNotificationHeader(root,service.snapshot(),service);if(root.notificationOpen)void service.refresh();};
 root.querySelector('[data-noti-refresh]').onclick=()=>{void service.refresh();};
 async function mutate(action){
 if(root.notificationBusy)return;root.notificationBusy=true;root.notificationError='';
 try{await action();}catch(error){root.notificationError=notificationError(error);}
 finally{root.notificationBusy=false;if(root.isConnected)renderNotificationHeader(root,service.snapshot(),service);}
 }
 root.querySelector('[data-noti-all]').onclick=()=>mutate(()=>service.readAll());
 root.querySelectorAll('[data-noti-read]').forEach(button=>button.onclick=()=>mutate(()=>service.read(button.dataset.notiRead)));
 root.querySelector('a').onclick=()=>{root.notificationOpen=false;};
 if(focusId)root.querySelectorAll('[id]').forEach(element=>{if(element.id===focusId)element.focus();});
 else if(focusRead)root.querySelectorAll('[data-noti-read]').forEach(element=>{if(element.dataset.notiRead===focusRead)element.focus();});
}
export function notificationEventInside(event,root){
 return !!root&&(event.composedPath?.().includes(root)||root.contains(event.target));
}
export function closeNotificationHeader(root,focus=false){if(root?.notificationOpen){root.notificationOpen=false;const state=notificationService.snapshot();renderNotificationHeader(root,state);if(focus)root.querySelector('#notification-bell')?.focus();}}
export function mountNotifications(root,service=notificationService){
 if(!root)return ()=>{};
 let selectedTab='all';
 let state=service.snapshot(),cursor=null,history=[],items=state.items,next=state.nextBeforeId,loading=false,error='',busy=false,requestId=0,revision=state.revision,generation=state.generation;
 function draw(){
 if(!root.isConnected)return;
 const visible=filterNotificationItems(items,selectedTab);
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Danh mục thông báo">${notificationTabs.map(([key,label])=>`<button type="button" role="tab" class="tab ${selectedTab===key?'active':''}" aria-selected="${selectedTab===key}" data-noti-filter="${key}">${label}</button>`).join('')}</div><div class="toolbar"><button type="button" class="btn primary" id="notifications-read-all" ${busy?'disabled':''}>Đánh dấu tất cả đã đọc</button><button type="button" class="btn" id="notifications-refresh" ${loading||state.loading?'disabled':''}>Làm mới</button></div><p class="notification-page-status muted">${realtimeLabel(state)} · Giờ Việt Nam (Asia/Ho_Chi_Minh)</p><p id="notifications-error" class="form-error" role="alert">${e(error||state.error)}</p>${selectedTab!=='all'?'<p class="muted notification-filter-note">Lọc trên trang đang xem. Dùng Trang sau để xem các thông báo cũ hơn.</p>':''}${(loading||!state.loaded&&state.loading)?'<p role="status">Đang tải thông báo…</p>':visible.length?`<div class="notifications-inbox">${notificationRows(visible)}</div>`:state.loaded?`<div class="empty"><h3>${selectedTab==='all'?'Chưa có thông báo':'Không có thông báo phù hợp trên trang này'}</h3><p>Các thông báo của tài khoản này sẽ xuất hiện tại đây.</p></div>`:''}<div class="toolbar user-pagination"><button type="button" class="btn" id="notifications-prev" ${!history.length||loading?'disabled':''}>Trang trước</button><span>Trang ${history.length+1}</span><button type="button" class="btn" id="notifications-next" ${next===null||next===undefined||loading?'disabled':''}>Trang sau</button></div>`;
 root.querySelectorAll('[data-noti-filter]').forEach(button=>button.onclick=()=>{selectedTab=button.dataset.notiFilter;draw();});
 root.querySelector('#notifications-read-all').onclick=()=>mutate(()=>service.readAll());
 root.querySelector('#notifications-refresh').onclick=()=>{if(cursor===null)void service.refresh();else void loadPage(cursor);};
 root.querySelectorAll('[data-noti-read]').forEach(button=>button.onclick=()=>mutate(()=>service.read(button.dataset.notiRead)));
 root.querySelector('#notifications-next').onclick=()=>{if(next!==null&&next!==undefined){history.push(cursor);cursor=next;void loadPage(cursor);}};
 root.querySelector('#notifications-prev').onclick=()=>{if(history.length){cursor=history.pop();if(cursor===null){requestId++;loading=false;items=state.items;next=state.nextBeforeId;draw();}else void loadPage(cursor);}};
 }
 async function loadPage(beforeId){
 const current=++requestId;loading=true;error='';draw();
 try{const result=await service.page(beforeId);if(!root.isConnected||current!==requestId)return;items=result.items;next=result.nextBeforeId??null;}
 catch(err){if(current===requestId)error=notificationError(err);}
 finally{if(current===requestId){loading=false;draw();}}
 }
 async function mutate(action){
 if(busy)return;busy=true;error='';draw();
 try{await action();if(cursor!==null)await loadPage(cursor);}
 catch(err){error=notificationError(err);}
 finally{busy=false;draw();}
 }
 let unsubscribe=()=>{};
 unsubscribe=service.subscribe(nextState=>{
 if(!root.isConnected){unsubscribe();return;}
 state=nextState;
 if(generation!==state.generation){generation=state.generation;requestId++;cursor=null;history=[];items=[];next=null;error='';loading=false;busy=false;}
 if(cursor===null){items=state.items;next=state.nextBeforeId;}
 else if(revision!==state.revision&&!loading)void loadPage(cursor);
 revision=state.revision;draw();
 });
 void service.syncAuth();if(!state.loaded&&!state.loading)void service.refresh();
 return ()=>{requestId++;unsubscribe();};
}
