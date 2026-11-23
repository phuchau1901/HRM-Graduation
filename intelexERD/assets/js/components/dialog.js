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

export function confirmDialog({title='Xác nhận',message='',confirmLabel='Xác nhận',cancelLabel='Hủy',role='dialog'}={}){
 const previousFocus=document.activeElement,dialog=document.createElement('dialog');dialog.className='app-confirm-dialog';dialog.setAttribute('role',role);dialog.setAttribute('aria-labelledby','app-confirm-title');dialog.setAttribute('aria-describedby','app-confirm-message');
 dialog.innerHTML=`<div class="app-confirm-content"><span class="app-confirm-icon" aria-hidden="true">${icon('shield',24)}</span><h2 id="app-confirm-title"></h2><p id="app-confirm-message"></p></div><div class="app-confirm-actions"><button type="button" class="btn" data-confirm-cancel autofocus></button><button type="button" class="btn primary" data-confirm-accept></button></div>`;
 dialog.querySelector('h2').textContent=title;dialog.querySelector('p').textContent=message;dialog.querySelector('[data-confirm-cancel]').textContent=cancelLabel;dialog.querySelector('[data-confirm-accept]').textContent=confirmLabel;if(cancelLabel===null){dialog.querySelector('[data-confirm-cancel]').hidden=true;dialog.querySelector('[data-confirm-cancel]').removeAttribute('autofocus');dialog.querySelector('[data-confirm-accept]').setAttribute('autofocus','');}
 return new Promise(resolve=>{let settled=false;function finish(accepted){if(settled)return;settled=true;if(dialog.open)dialog.close();dialog.remove();if(previousFocus?.isConnected&&!previousFocus.disabled)previousFocus.focus();resolve(accepted);}
 dialog.querySelector('[data-confirm-cancel]').onclick=()=>finish(false);dialog.querySelector('[data-confirm-accept]').onclick=()=>finish(true);dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();}});dialog.addEventListener('keyup',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(false);}});dialog.addEventListener('cancel',event=>{event.preventDefault();finish(false);});dialog.addEventListener('close',()=>finish(false));document.body.appendChild(dialog);dialog.showModal();});
}

export function alertDialog({title='Thông báo',message='',buttonLabel='OK'}={}){
 // A dedicated popup replaces the automatic mutation toast for this handled error.
 toastVersion++;return confirmDialog({title,message,confirmLabel:buttonLabel,cancelLabel:null,role:'alertdialog'});
}
