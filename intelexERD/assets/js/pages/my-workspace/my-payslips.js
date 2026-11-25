import {apiSession,apiMyPayslips,apiMyPayslipDetail,apiMyPayslipPdf} from '../../api/client.js';
import {toast} from '../../components/dialog.js';
import {e} from '../../utils.js';
import {payrollGrant,payrollPageData,payrollObject,payrollAmount,payrollBadge,payrollSelect,payrollPagination,payrollController} from '../payroll/payroll-common.js';
import {payrollPayslipMarkup} from '../payroll/payroll-management.js';

export function myPayslipRowValid(row,session=apiSession()){
 return !!row&&Number.isSafeInteger(row.id)&&row.id>0&&Number.isSafeInteger(row.employeeId)&&row.employeeId>0&&session?.user?.employeeId!=null&&String(row.employeeId)===String(session.user.employeeId)&&['LOCKED','PAID'].includes(row.status)&&['gross','deductions','net'].every(key=>typeof row[key]==='number'&&Number.isFinite(row[key]))&&/^[A-Z]{3}$/.test(row.currencyCode||'');
}
export function myPayslipPage(response,session=apiSession()){const result=payrollPageData(response);if(result.data.some(row=>!myPayslipRowValid(row,session)))throw Error('Danh sách phiếu lương cá nhân không hợp lệ.');return result;}
export function myPayslipDetail(response,session=apiSession()){const data=payrollObject(response);if(!myPayslipRowValid(data.row,session)||!data.result||!Array.isArray(data.result.lines)||data.snapshot!=null)throw Error('Chi tiết phiếu lương cá nhân không hợp lệ.');return data;}
export function mountMyPayslips(root){
 const screen='WEB_MY_PAYSLIPS';if(!root)return ()=>{};if(!payrollGrant(screen)){root.innerHTML='<p>Bạn cần quyền WEB_MY_PAYSLIPS/VIEW để xem phiếu lương của mình.</p>';return ()=>{};}
 if(apiSession()?.user?.employeeId==null){root.innerHTML='<p>Tài khoản chưa liên kết hồ sơ nhân viên. Vui lòng liên hệ quản trị viên để xem phiếu lương.</p>';return ()=>{};}
 const controller=payrollController(root),active=controller.active;let page=1,filters={},generation=0;
 root.innerHTML=`<form class="payroll-filters" data-my-payslip-filters>${payrollSelect('periodKey','Chọn kỳ lương',[],'',{empty:'Tất cả kỳ lương'})}${payrollSelect('status','Trạng thái',[{id:'LOCKED',label:'Đã chốt'},{id:'PAID',label:'Đã thanh toán'}],'',{empty:'Tất cả trạng thái'})}<button class="btn" type="submit">Lọc</button><button class="btn" type="button" data-my-payslip-refresh>Làm mới</button></form><p role="status" data-my-payslip-period-feedback></p><div data-my-payslip-content></div><div class="user-pagination" data-my-payslip-pages></div>`;
 const form=root.querySelector('form'),content=root.querySelector('[data-my-payslip-content]'),pagination=root.querySelector('[data-my-payslip-pages]');
 function apply(){filters=Object.fromEntries([...new FormData(form)].filter(([,value])=>value));page=1;load();}form.onsubmit=event=>{event.preventDefault();event.stopPropagation();apply();};form.elements.periodKey.onchange=apply;form.elements.status.onchange=apply;root.querySelector('[data-my-payslip-refresh]').onclick=()=>{void load();void loadPeriods();};
 async function loadPeriods(){
 const feedback=root.querySelector('[data-my-payslip-period-feedback]');
 try{
 const periods=new Set();for(let currentPage=1;active();currentPage++){
 const result=myPayslipPage(await apiMyPayslips({page:currentPage,pageSize:100}));if(!active())return;
 for(const row of result.data)if(row.periodKey)periods.add(row.periodKey);
 if(currentPage*100>=result.total)break;if(!result.data.length)throw Error('Chưa tải đủ danh sách kỳ lương.');
 }
 if(!active())return;const select=form.elements.periodKey;select.innerHTML='<option value="">Tất cả kỳ lương</option>'+[...periods].sort().reverse().map(key=>`<option value="${e(key)}">${e(key)}</option>`).join('');select.value=filters.periodKey||'';feedback.textContent='';
 }catch(err){if(active()){feedback.innerHTML=`${e(err.message)} <button class="btn small" type="button">Tải lại kỳ lương</button>`;feedback.querySelector('button').onclick=loadPeriods;}}
 }
 async function load(){if(!active())return;const current=++generation;content.innerHTML='<p role="status">Đang tải phiếu lương của bạn…</p>';pagination.innerHTML='';try{const result=myPayslipPage(await apiMyPayslips({...filters,page,pageSize:20}));if(!active()||current!==generation)return;content.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Kỳ lương</th><th>Nhân viên</th><th>Thu nhập</th><th>Khấu trừ</th><th>Thực lĩnh</th><th>Trạng thái</th><th></th></tr></thead><tbody>${result.data.map((row,index)=>`<tr><td><strong>${e(row.periodKey)}</strong></td><td>${e(row.employeeName)}<small>${e(row.employeeCode)}</small></td><td>${e(payrollAmount(row.gross,row.currencyCode))}</td><td>${e(payrollAmount(row.deductions,row.currencyCode))}</td><td><strong>${e(payrollAmount(row.net,row.currencyCode))}</strong></td><td>${payrollBadge(row.status)}</td><td><div class="payroll-row-actions"><button class="btn small" type="button" data-my-payslip-detail="${index}">Chi tiết</button>${payrollGrant(screen,'canExport')?`<button class="btn small" type="button" data-my-payslip-pdf="${index}">Tải PDF</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>${result.data.length?'':'<div class="empty"><h3>Chưa có phiếu lương</h3><p>Phiếu lương sẽ xuất hiện khi kỳ lương được chốt hoặc đã thanh toán.</p></div>'}`;
 content.querySelectorAll('[data-my-payslip-detail]').forEach(button=>button.onclick=()=>detail(result.data[Number(button.dataset.myPayslipDetail)].id));content.querySelectorAll('[data-my-payslip-pdf]').forEach(button=>button.onclick=()=>download(result.data[Number(button.dataset.myPayslipPdf)],button));payrollPagination(pagination,{page,total:result.total,onPage:next=>{page=next;load();}});
 }catch(err){if(active()&&current===generation){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}}}
 async function detail(id){return controller.dialog('Phiếu lương của tôi',async(host,alive)=>{const data=myPayslipDetail(await apiMyPayslipDetail(id));if(!alive())return;if(data.row.id!==id)throw Error('Phiếu lương trả về không khớp yêu cầu.');host.innerHTML=payrollPayslipMarkup(data)+(payrollGrant(screen,'canExport')?'<button class="btn primary" type="button" data-personal-pdf>Tải PDF</button>':'');host.querySelector('[data-personal-pdf]')?.addEventListener('click',event=>download(data.row,event.currentTarget));});}
 async function download(row,button){if(!myPayslipRowValid(row)||!payrollGrant(screen,'canExport'))return;button.disabled=true;try{const blob=await apiMyPayslipPdf(row.id);if(!active())return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='phieu-luong-'+String(row.periodKey).replace(/[^0-9-]/g,'')+'.pdf';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã tải phiếu lương PDF.');}catch(err){if(active())toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}}
 void load();void loadPeriods();return ()=>{++generation;controller.dispose();};
}
