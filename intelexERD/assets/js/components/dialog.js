import {icon} from './ui.js';
let returnFocus;
export function openDialog(title,body){const dialog=document.getElementById('modal');returnFocus=document.activeElement;dialog.innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Đóng">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;if(!dialog.open)dialog.showModal();}
export function closeDialog(){document.getElementById('modal').close();returnFocus?.isConnected&&returnFocus.focus();}
let toastVersion=0;
export function toastRevision(){return toastVersion;}
export function clearToasts(){const container=document.getElementById('toast');container?.replaceChildren();}
export function toast(text,{type='success',duration=5000,automatic=false}={}){
 const container=document.getElementById('toast');if(!container)return;
 if(!automatic)toastVersion++;container.className='toast-stack';container.setAttribute('aria-live','polite');
 if(typeof container.showPopover==='function'){container.setAttribute('popover','manual');try{container.showPopover();}catch{}}
 const item=document.createElement('div');item.className='toast-message toast-'+type;item.setAttribute('role',type==='error'?'alert':'status');
 const message=document.createElement('span');message.textContent=String(text);const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='toast-dismiss';dismiss.setAttribute('aria-label','Đóng thông báo');dismiss.textContent='×';
 item.append(message,dismiss);container.prepend(item);
 const timer=setTimeout(()=>item.remove(),duration);dismiss.onclick=()=>{clearTimeout(timer);item.remove();};
}
