import {openDialog,closeDialog} from '../../components/dialog.js';
import {notificationService,notificationError} from '../../services/notification-service.js';
import {e} from '../../utils.js';
import {icon} from '../../components/ui.js';

export const notificationTabs=[['all','Tất cả'],['unread','Chưa đọc'],['task','Công việc'],['attendance','Chấm công'],['leave','Nghỉ phép'],['kpi','KPI'],['payroll','Lương'],['system','Hệ thống']];
export function notificationCategory(item){
 const source=String(item.source||'').toUpperCase(),reference=String(item.referenceType||'').toUpperCase();
 if(reference==='PAYROLL'||String(item.type||'').toUpperCase()==='PAYROLL')return 'payroll';
 if(reference.startsWith('KPI'))return 'kpi';
 const attendance=['ATTENDANCE','WORK_SCHEDULE','SHIFT'];
 if(source==='SYSTEM')return attendance.includes(reference)?'attendance':'system';
 if(source==='WORKFLOW')return 'leave';
 if(attendance.includes(reference))return 'attendance';
 if(['TASK','PROJECT_TASK'].includes(reference))return 'task';
 if(['LEAVE','LEAVE_REQUEST'].includes(reference))return 'leave';
 return 'system';
}
export function filterNotificationItems(items,tab){
 if(tab==='all')return items;
 if(tab==='unread')return items.filter(item=>!item.readAt);
 return items.filter(item=>notificationCategory(item)===tab);
}
export function notificationTime(value){
 if(!value)return '—';const text=String(value),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'Z');
 return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
export function notificationRows(items){
 return items.map(item=>`<button type="button" class="notification-row api-notification-row ${item.readAt?'':'unread'}" data-noti-read="${e(item.id)}"><span class="icon-tile blue">${icon('bell',16)}</span><span class="api-notification-content"><strong>${e(item.title)}</strong><span class="api-notification-text">${e(item.content)}</span><small>${e(notificationTime(item.publishedAt||item.createdAt))} · ${item.readAt?'Đã đọc':'Chưa đọc'}</small></span>${item.readAt?'':'<span class="api-notification-dot" aria-label="Chưa đọc"></span>'}</button>`).join('');
}
export function notificationPayslipHref(item){
 if(notificationCategory(item)!=='payroll')return '';
 const id=Number(item.referenceId);return Number.isSafeInteger(id)&&id>0?'#/workspace/payslips?periodId='+id:'';
}
export function notificationDetailMarkup(item){
 const label=({system:'Thông báo chung',attendance:'Chấm công',leave:'Nghỉ phép',task:'Công việc',kpi:'KPI',payroll:'Lương'})[notificationCategory(item)];
 return `<section id="notification-detail"><div class="notification-detail-meta"><span class="notification-detail-category">${label}</span><time>${e(notificationTime(item.publishedAt||item.createdAt))}</time></div><h3>${e(item.title)}</h3><p class="notification-detail-content">${e(item.content)}</p>${notificationPayslipHref(item)?`<div class="form-actions"><a class="btn primary" data-notification-payslip href="${notificationPayslipHref(item)}">Xem chi tiết</a></div>`:''}<p id="notification-detail-error" class="form-error" role="alert"></p></section>`;
}
export async function openNotificationDetail(item,service=notificationService,showDialog=openDialog){
 if(!item)return;
 const generation=service.snapshot().generation;
 showDialog('Chi tiết thông báo',notificationDetailMarkup(item));
 const popup=globalThis.document?.getElementById('notification-detail');
 popup?.querySelector('[data-notification-payslip]')?.addEventListener?.('click',()=>closeDialog());
 if(item.readAt)return;
 try{await service.read(item.id);}
 catch(error){if(popup?.isConnected&&service.snapshot().generation===generation){const feedback=popup.querySelector('#notification-detail-error');if(feedback)feedback.textContent=notificationError(error);}}
}
export function renderNotificationHeader(root,state=notificationService.snapshot(),service=notificationService){
 if(!root)return;
 const focused=root.contains(document.activeElement)?document.activeElement:null,focusId=focused?.id,focusRead=focused?.dataset?.notiRead;
 if(root.notificationGeneration!==state.generation){root.notificationOpen=false;root.notificationError='';root.notificationGeneration=state.generation;}
 const open=!!root.notificationOpen,count=state.count;
 root.innerHTML=`<button type="button" class="icon-button" id="notification-bell" aria-label="Thông báo${count===null?'':`, ${count} chưa đọc`}" aria-expanded="${open}" aria-controls="notification-dropdown">${icon('bell',19)}${count>0?`<span class="notification-count" aria-hidden="true">${count>99?'99+':count}</span>`:''}</button><section id="notification-dropdown" class="notification-dropdown" aria-label="Thông báo mới nhất" ${open?'':'hidden'}><div class="notification-dropdown-heading"><strong>Thông báo</strong><button type="button" class="btn text small" data-noti-all ${root.notificationBusy?'disabled':''}>Đánh dấu tất cả đã đọc</button></div>${state.error?`<p class="form-error" role="alert">${e(state.error)}</p>`:''}${root.notificationError?`<p class="form-error" role="alert">${e(root.notificationError)}</p>`:''}<div class="notification-dropdown-list">${!state.loaded&&state.loading?'<p role="status">Đang tải thông báo…</p>':state.items.length?notificationRows(state.items.slice(0,8)):state.loaded?'<p class="notification-empty">Chưa có thông báo.</p>':''}</div><div class="notification-dropdown-footer"><button type="button" class="btn small" data-noti-refresh ${state.loading?'disabled':''}>${state.loading?'Đang tải…':'Làm mới'}</button><a class="btn primary small" href="#/notifications">Xem tất cả</a></div></section>`;
 root.querySelector('#notification-bell').onclick=()=>{root.notificationOpen=!root.notificationOpen;renderNotificationHeader(root,service.snapshot(),service);if(root.notificationOpen)void service.refresh();};
 root.querySelector('[data-noti-refresh]').onclick=()=>{void service.refresh();};
 async function mutate(action){
 if(root.notificationBusy)return;root.notificationBusy=true;root.notificationError='';
 try{await action();}catch(error){root.notificationError=notificationError(error);}
 finally{root.notificationBusy=false;if(root.isConnected)renderNotificationHeader(root,service.snapshot(),service);}
 }
 root.querySelector('[data-noti-all]').onclick=()=>mutate(()=>service.readAll());
 root.querySelectorAll('[data-noti-read]').forEach(button=>button.onclick=()=>{
  const item=state.items.find(item=>String(item.id)===String(button.dataset.notiRead));if(!item)return;
  root.notificationOpen=false;renderNotificationHeader(root,service.snapshot(),service);void openNotificationDetail(item,service);
 });
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
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Danh mục thông báo">${notificationTabs.map(([key,label])=>`<button type="button" role="tab" class="tab ${selectedTab===key?'active':''}" aria-selected="${selectedTab===key}" data-noti-filter="${key}">${label}</button>`).join('')}</div><div class="toolbar"><button type="button" class="btn primary" id="notifications-read-all" ${busy?'disabled':''}>Đánh dấu tất cả đã đọc</button><button type="button" class="btn" id="notifications-refresh" ${loading||state.loading?'disabled':''}>Làm mới</button></div><p id="notifications-error" class="form-error" role="alert">${e(error||state.error)}</p>${(loading||!state.loaded&&state.loading)?'<p role="status">Đang tải thông báo…</p>':visible.length?`<div class="notifications-inbox">${notificationRows(visible)}</div>`:state.loaded?`<div class="empty"><h3>${selectedTab==='all'?'Chưa có thông báo':'Không có thông báo phù hợp trên trang này'}</h3><p>Các thông báo của tài khoản này sẽ xuất hiện tại đây.</p></div>`:''}<div class="toolbar user-pagination"><button type="button" class="btn" id="notifications-prev" ${!history.length||loading?'disabled':''}>Trang trước</button><span>Trang ${history.length+1}</span><button type="button" class="btn" id="notifications-next" ${next===null||next===undefined||loading?'disabled':''}>Trang sau</button></div>`;
 root.querySelectorAll('[data-noti-filter]').forEach(button=>button.onclick=()=>{selectedTab=button.dataset.notiFilter;draw();});
 root.querySelector('#notifications-read-all').onclick=()=>mutate(()=>service.readAll());
 root.querySelector('#notifications-refresh').onclick=()=>{if(cursor===null)void service.refresh();else void loadPage(cursor);};
 root.querySelectorAll('[data-noti-read]').forEach(button=>button.onclick=()=>{const item=items.find(item=>String(item.id)===String(button.dataset.notiRead));if(item)void openNotificationDetail(item,service);});
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
