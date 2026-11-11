import {icon} from './ui.js';
let returnFocus;
export function openDialog(title,body){const dialog=document.getElementById('modal');returnFocus=document.activeElement;dialog.innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="Đóng">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;if(!dialog.open)dialog.showModal();}
export function closeDialog(){document.getElementById('modal').close();returnFocus?.isConnected&&returnFocus.focus();}
let timer;
export function toast(text){const el=document.getElementById('toast');el.textContent=text;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),3500);}
