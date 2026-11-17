import {apiMyLeaveBalances,apiSession} from '../../api/client.js';
import {e,dateLabel} from '../../utils.js';
import {icon} from '../../components/ui.js';

const leaveBalanceNumbers=['entitledDays','carriedOverDays','adjustmentDays','usedDays','reservedDays','remainingDays','availableDays'];
const leaveDayNumber=value=>Number(value).toLocaleString('vi-VN',{maximumFractionDigits:2});
export function myLeaveGrant(code,session=apiSession()){return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y');}
export function myLeaveBalanceData(response){
 const data=response?.data;
 if(response?.success!==true||!data||!Number.isSafeInteger(data.employeeId)||data.employeeId<=0||!Number.isInteger(data.year)||data.year<1900||data.year>9999||!/^\d{4}-\d{2}-\d{2}$/.test(data.asOfDate)||Number.isNaN(Date.parse(data.asOfDate))||new Date(data.asOfDate).toISOString().slice(0,10)!==data.asOfDate||!['totalDays','usedDays','remainingDays','reservedDays','availableDays'].every(key=>typeof data[key]==='number'&&Number.isFinite(data[key]))||!Array.isArray(data.balances))throw Error('Số dư phép trả về không hợp lệ.');
 for(const item of data.balances)if(item.employeeId!==data.employeeId||!Number.isSafeInteger(item.leaveTypeId)||item.leaveTypeId<=0||!leaveBalanceNumbers.every(key=>typeof item[key]==='number'&&Number.isFinite(item[key])))throw Error('Chi tiết số dư phép không hợp lệ.');
 return data;
}
export function myLeaveBalanceMarkup(data){
 return `<div class="my-leave-summary">${[['totalDays','Tổng phép','calendar','blue'],['usedDays','Đã sử dụng','check','purple'],['remainingDays','Còn lại','sun','teal']].map(([key,label,glyph,tone])=>`<article class="card my-leave-stat"><div class="icon-tile ${tone}">${icon(glyph,20)}</div><div><span>${label}</span><strong>${leaveDayNumber(data[key])}<small> ngày</small></strong></div></article>`).join('')}</div><div class="my-leave-availability"><span>Đang giữ cho đơn chờ duyệt: <strong>${leaveDayNumber(data.reservedDays)} ngày</strong></span><span>Khả dụng: <strong>${leaveDayNumber(data.availableDays)} ngày</strong></span><span class="muted">Cập nhật ${dateLabel(data.asOfDate)}</span></div><div class="table-wrap"><table><thead><tr><th>Loại nghỉ phép</th><th>Được cấp</th><th>Chuyển năm</th><th>Điều chỉnh</th><th>Đã dùng</th><th>Đang giữ</th><th>Còn lại</th><th>Khả dụng</th></tr></thead><tbody>${data.balances.map(item=>`<tr><td>${e(item.leaveTypeName||`Loại phép #${item.leaveTypeId}`)}</td>${leaveBalanceNumbers.map(key=>`<td>${leaveDayNumber(item[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${data.balances.length?'':'<div class="empty"><h3>Chưa có số dư phép</h3><p>Chưa có số dư được cấp trong năm đã chọn.</p></div>'}`;
}
export async function mountMyLeave(root){
 if(!root)return;
 if(!myLeaveGrant('WEB_LEAVE_MANAGEMENT')){root.innerHTML='<p>Bạn chưa có quyền xem Leave Management.</p>';return;}
 if(!myLeaveGrant('WEB_LEAVE_BALANCES')){root.innerHTML='<p>Bạn cần quyền WEB_LEAVE_BALANCES/VIEW để xem số dư phép của mình.</p>';return;}
 let year=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric'}).format(new Date())),generation=0;
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Leave Management"><button type="button" class="tab active" role="tab" aria-selected="true" aria-controls="my-leave-balances" id="my-leave-balance-tab">Số dư phép</button></div><form class="toolbar" id="my-leave-year"><label>Năm<input type="number" name="year" min="1900" max="9999" step="1" required value="${year}" aria-label="Năm số dư phép"></label><button type="button" class="btn" id="my-leave-refresh">Làm mới</button></form><section id="my-leave-balances" role="tabpanel" aria-labelledby="my-leave-balance-tab"></section>`;
 const panel=root.querySelector('#my-leave-balances'),form=root.querySelector('#my-leave-year');
 async function load(){
  const id=++generation;panel.innerHTML='<p role="status">Đang tải số dư phép…</p>';
  try{
   if(!myLeaveGrant('WEB_LEAVE_MANAGEMENT')||!myLeaveGrant('WEB_LEAVE_BALANCES'))throw Error('Bạn không có quyền xem số dư phép.');
   const data=myLeaveBalanceData(await apiMyLeaveBalances({year}));if(!root.isConnected||id!==generation)return;
   panel.innerHTML=myLeaveBalanceMarkup(data);
  }catch(err){if(root.isConnected&&id===generation){panel.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;panel.querySelector('button').onclick=load;}}
 }
 const changeYear=()=>{const value=Number(form.elements.year.value);if(!Number.isInteger(value)||value<1900||value>9999)return;year=value;load();};
 form.elements.year.onchange=changeYear;
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();changeYear();};
 root.querySelector('#my-leave-refresh').onclick=load;
 await load();
}
