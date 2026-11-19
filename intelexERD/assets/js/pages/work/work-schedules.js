import {apiSession,apiWorkScheduleCalendar,apiWorkScheduleDetail,apiSaveWorkSchedule,apiCancelWorkSchedule,apiPreviewWorkSchedules,apiAssignWorkSchedules,apiExportWorkSchedules} from '../../api/client.js';
import {openDialog,closeDialog,toast} from '../../components/dialog.js';
import {field,icon} from '../../components/ui.js';
import {e,dateLabel} from '../../utils.js';

export function workScheduleGrant(flag,session=apiSession()){
 const actions={canNew:'NEW',canUpdate:'UPDATE',canDelete:'DELETE',canExport:'EXPORT'};
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_WORK_SCHEDULES'&&p.canView==='Y'&&p[flag]==='Y'&&(!['canNew','canUpdate','canDelete'].includes(flag)||p.dataScopes?.[actions[flag]]!=='SELF'));
}
export const workScheduleToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function workScheduleDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export function workScheduleAddDays(value,days){const date=new Date(value+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function workScheduleRange(anchor,mode='week'){
 if(!workScheduleDate(anchor))throw Error('Ngày lịch không hợp lệ.');const date=new Date(anchor+'T00:00:00Z');
 if(mode==='month'){const from=anchor.slice(0,7)+'-01',last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0));return {from,to:last.toISOString().slice(0,10)};}
 const from=workScheduleAddDays(anchor,-((date.getUTCDay()+6)%7));return {from,to:workScheduleAddDays(from,6)};
}
export function workScheduleDays(from,to){if(!workScheduleDate(from)||!workScheduleDate(to)||to<from)throw Error('Khoảng ngày không hợp lệ.');const count=Math.round((Date.parse(to)-Date.parse(from))/86400000)+1;if(count>92)throw Error('Khoảng ngày tối đa 92 ngày.');return Array.from({length:count},(_,index)=>workScheduleAddDays(from,index));}
export function workScheduleColor(id){return ['#2563eb','#8b5cf6','#0f8b77','#b87516','#d44d66','#5262a3'][Math.abs(Number(id))%6];}
export function workScheduleCalendarData(data){
 if(data?.success!==true||!Number.isSafeInteger(data.total)||data.total<0||!['employees','schedules','shifts','departments','teams','holidayDates'].every(key=>Array.isArray(data[key])))throw Error('Lịch phân ca trả về không hợp lệ.');
 const employees=new Set(data.employees.map(item=>item.id));
 if(data.schedules.some(item=>!employees.has(item.employeeId)||!workScheduleDate(item.workDate)||!Number.isSafeInteger(item.id)||!Number.isSafeInteger(item.version)))throw Error('Chi tiết lịch phân ca không hợp lệ.');return data;
}
export function workScheduleBatchPayload(values,{operationId,today=workScheduleToday()}={}){
 const target=values.target,from=values.from,to=values.to,dates=workScheduleDays(from,to),positive=value=>{const id=Number(value);if(!Number.isSafeInteger(id)||id<1)throw Error('Chọn đối tượng và ca làm việc hợp lệ.');return id;};
 if(from<today)throw Error('Ngày phân ca mới không được ở quá khứ.');if(!['ALL','DEPARTMENT','TEAM','EMPLOYEE'].includes(target))throw Error('Đối tượng phân ca không hợp lệ.');
 const weekdays=(values.weekdays||[]).map(Number);if(!weekdays.length||new Set(weekdays).size!==weekdays.length||weekdays.some(day=>!Number.isInteger(day)||day<1||day>7))throw Error('Chọn các thứ trong tuần hợp lệ, không trùng.');
 const payload={operationId,target,employeeIds:[],from,to,weekdays,excludeHolidays:!!values.excludeHolidays,overwrite:!!values.overwrite};
 if(target==='DEPARTMENT')payload.departmentId=positive(values.departmentId);if(target==='TEAM')payload.teamId=positive(values.teamId);
 if(target==='EMPLOYEE'){payload.employeeIds=(values.employeeIds||[]).map(positive);if(!payload.employeeIds.length||payload.employeeIds.length>500||new Set(payload.employeeIds).size!==payload.employeeIds.length)throw Error('Chọn từ 1 đến 500 nhân viên, không trùng.');const selectedDays=dates.filter(day=>weekdays.includes((new Date(day+'T00:00:00Z').getUTCDay()+6)%7+1)).length;if(selectedDays*payload.employeeIds.length>5000)throw Error('Mỗi đợt tối đa 5000 lượt nhân viên/ngày.');}
 if(values.mode==='copy'){if(!workScheduleDate(values.copyFrom))throw Error('Chọn ngày bắt đầu lịch nguồn.');payload.copyFrom=values.copyFrom;}else payload.shiftId=positive(values.shiftId);
 return payload;
}
export function workScheduleOperationId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const bytes=new Uint8Array(16);if(!globalThis.crypto?.getRandomValues)throw Error('Trình duyệt không hỗ trợ tạo mã phân ca.');globalThis.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export const workScheduleOutcomes={READY:'Sẵn sàng',INACTIVE:'Nhân viên ngừng hoạt động',BEFORE_HIRE:'Trước ngày vào làm',PAST_DATE:'Ngày đã qua',HOLIDAY:'Ngày lễ',NON_WORKING_DAY:'Ngày không làm việc',PERIOD_LOCKED:'Kỳ công đã khóa',APPROVED_LEAVE:'Đã có phép được duyệt',SOURCE_MISSING_OR_MULTIPLE:'Lịch nguồn thiếu hoặc có nhiều ca',SHIFT_INACTIVE:'Ca ngừng hoạt động',MULTIPLE_SCHEDULES:'Có nhiều lịch',ATTENDANCE_OR_CLOSED:'Đã có chấm công hoặc đóng lịch',EXISTS:'Đã có lịch',STARTED_OR_LEGACY:'Lịch đã bắt đầu hoặc snapshot cũ',STARTED:'Ca đã bắt đầu',OVERLAP:'Trùng giờ ca',OVERLAP_OR_LEGACY:'Trùng ca hoặc snapshot cũ'};
export function workSchedulePreviewMarkup(preview){
 if(typeof preview?.previewToken!=='string'||!preview.previewToken||!Number.isInteger(preview.ready)||!Number.isInteger(preview.skipped)||!Array.isArray(preview.items))throw Error('Kết quả xem trước không hợp lệ.');
 return `<p class="work-preview-summary">Sẵn sàng: <strong>${preview.ready}</strong> · Bỏ qua: <strong>${preview.skipped}</strong></p><div class="table-wrap work-preview-table"><table><thead><tr><th>Nhân viên</th><th>Ngày</th><th>Ca</th><th>Kết quả</th></tr></thead><tbody>${preview.items.map(item=>`<tr><td>${e(item.employeeCode)} · ${e(item.employeeName)}</td><td>${dateLabel(item.workDate)}</td><td>${e(item.rules?.shiftCode||item.shiftId||'—')}</td><td class="${item.outcome==='READY'?'work-ready':''}">${e(workScheduleOutcomes[item.outcome]||item.outcome)}</td></tr>`).join('')}</tbody></table></div>`;
}
export function workScheduleCalendarMarkup(data,days,selected=new Set(),session=apiSession()){
 const byCell=new Map();for(const schedule of data.schedules){if(schedule.status==='CANCELLED')continue;const key=schedule.employeeId+'/'+schedule.workDate;if(!byCell.has(key))byCell.set(key,[]);byCell.get(key).push(schedule);}
 const canNew=workScheduleGrant('canNew',session),canDelete=workScheduleGrant('canDelete',session),today=workScheduleToday();
 return `<div class="table-wrap work-calendar-wrap"><table class="work-calendar"><thead><tr><th class="work-employee-col">${canNew?'<input type="checkbox" data-work-select-all aria-label="Chọn tất cả nhân viên trên trang"> ':''}Nhân viên</th>${days.map(day=>`<th class="${data.holidayDates.includes(day)?'work-holiday':''}"><span>${['CN','T2','T3','T4','T5','T6','T7'][new Date(day+'T00:00:00Z').getUTCDay()]}</span><strong>${dateLabel(day).slice(0,5)}</strong>${data.holidayDates.includes(day)?'<small>Ngày lễ</small>':''}</th>`).join('')}</tr></thead><tbody>${data.employees.map(employee=>`<tr><th class="work-employee-col"><div>${canNew?`<input type="checkbox" data-work-select="${employee.id}" aria-label="Chọn ${e(employee.fullName)}" ${selected.has(employee.id)?'checked':''}>`:''}<span>${e(employee.fullName)}<small>${e(employee.employeeCode)}</small></span></div></th>${days.map(day=>{const schedules=byCell.get(employee.id+'/'+day)||[];return `<td class="${day===today?'work-today':''}">${schedules.length?schedules.map(schedule=>{const shift=data.shifts.find(item=>item.id===schedule.shiftId),code=schedule.rules?.shiftCode||shift?.code||'Ca #'+schedule.shiftId;return `<div class="work-shift" style="--shift-color:${workScheduleColor(schedule.shiftId)}"><button type="button" data-work-schedule="${schedule.id}" title="Xem hoặc thay đổi ca ${e(code)}">${e(code)}</button>${canDelete&&schedule.status==='SCHEDULED'&&day>=today?`<button type="button" data-work-cancel="${schedule.id}" aria-label="Hủy ca ${e(code)}">×</button>`:''}</div>`;}).join(''):canNew&&day>=today?`<button type="button" class="work-empty-cell" data-work-assign="${employee.id}" data-work-date="${day}" aria-label="Phân ca cho ${e(employee.fullName)} ngày ${day}">+</button>`:'<span class="muted">—</span>'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>${data.employees.length?'':'<div class="empty">Không có nhân viên phù hợp trong phạm vi được xem.</div>'}`;
}

export async function mountWorkSchedules(root){
 if(!root)return;if(!workScheduleGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem WEB_WORK_SCHEDULES.</p>';return;}
 let anchor=workScheduleToday(),mode='week',page=1,departmentId='',teamId='',search='',generation=0,calendar=null,range=workScheduleRange(anchor,mode),selected=new Set(),searchTimer;
 const pageSize=20;
 root.innerHTML=`<div class="work-heading page-content-actions"><div class="heading-actions">${workScheduleGrant('canExport')?'<button type="button" class="btn" data-work-export>Xuất CSV</button>':''}${workScheduleGrant('canNew')?`<button type="button" class="btn primary" data-work-bulk>${icon('plus',16)} Phân ca hàng loạt</button>`:''}</div></div><form class="work-filters"><label>Hiển thị<select name="mode"><option value="week">Tuần</option><option value="month">Tháng</option></select></label>${field('Ngày','anchor','date',anchor,'required')}<label>Phòng ban<select name="departmentId"><option value="">Tất cả phòng ban</option></select></label><label>Team<select name="teamId"><option value="">Tất cả team</option></select></label><label class="work-search">Nhân viên<input name="search" type="search" placeholder="Mã hoặc tên nhân viên"></label><button class="btn" type="submit">Lọc</button></form><div class="work-calendar-toolbar"><div><button class="btn" type="button" data-work-prev-period aria-label="Kỳ trước">←</button><button class="btn" type="button" data-work-today>Hôm nay</button><button class="btn" type="button" data-work-next-period aria-label="Kỳ sau">→</button></div><strong data-work-range></strong><button class="btn" type="button" data-work-refresh>Làm mới</button></div><p class="muted" data-work-selected></p><div data-work-content></div><div class="user-pagination contracts-pagination" data-work-pagination></div>`;
 const form=root.querySelector('form'),content=root.querySelector('[data-work-content]'),pagination=root.querySelector('[data-work-pagination]');
 const query=()=>({...range,page,pageSize,departmentId,teamId,search});
 function filterOptions(items,value,label){return `<option value="">${label}</option>`+items.map(item=>`<option value="${item.id}" ${String(item.id)===value?'selected':''}>${e(item.name)}</option>`).join('');}
 function selection(){root.querySelector('[data-work-selected]').textContent=selected.size?`Đã chọn ${selected.size} nhân viên trên trang.`:'';const all=content.querySelector('[data-work-select-all]');if(all){all.checked=!!calendar?.employees.length&&calendar.employees.every(item=>selected.has(item.id));all.indeterminate=selected.size>0&&!all.checked;}}
 function draw(){
 content.innerHTML=workScheduleCalendarMarkup(calendar,workScheduleDays(range.from,range.to),selected);
 selection();pagination.innerHTML=`<span>${calendar.total} nhân viên · Trang ${page}/${Math.max(1,Math.ceil(calendar.total/pageSize))}</span><div><button class="btn" type="button" data-prev ${page===1?'disabled':''}>Trang trước</button><button class="btn" type="button" data-next ${page*pageSize>=calendar.total?'disabled':''}>Trang sau</button></div>`;
 pagination.querySelector('[data-prev]').onclick=()=>{page--;selected.clear();load();};pagination.querySelector('[data-next]').onclick=()=>{page++;selected.clear();load();};
 content.querySelectorAll('[data-work-select]').forEach(input=>input.onchange=()=>{const id=Number(input.dataset.workSelect);input.checked?selected.add(id):selected.delete(id);selection();});
 content.querySelector('[data-work-select-all]')?.addEventListener('change',event=>{selected=new Set(event.target.checked?calendar.employees.map(item=>item.id):[]);draw();});
 content.querySelectorAll('[data-work-assign]').forEach(button=>button.onclick=()=>single(null,Number(button.dataset.workAssign),button.dataset.workDate));
 content.querySelectorAll('[data-work-schedule]').forEach(button=>button.onclick=()=>single(calendar.schedules.find(item=>item.id===Number(button.dataset.workSchedule))));
 content.querySelectorAll('[data-work-cancel]').forEach(button=>button.onclick=()=>cancel(calendar.schedules.find(item=>item.id===Number(button.dataset.workCancel))));
 }
 async function load(){
 if(!root.isConnected)return;const current=++generation;range=workScheduleRange(anchor,mode);root.querySelector('[data-work-range]').textContent=dateLabel(range.from)+' – '+dateLabel(range.to);calendar=null;content.innerHTML='<div class="work-calendar-loading" role="status">Đang tải lịch phân ca…</div>';pagination.innerHTML='';
 try{const data=workScheduleCalendarData(await apiWorkScheduleCalendar(query()));if(!root.isConnected||current!==generation)return;calendar=data;
 form.elements.departmentId.innerHTML=filterOptions(data.departments,departmentId,'Tất cả phòng ban');form.elements.teamId.innerHTML=filterOptions(data.teams,teamId,'Tất cả team');selected=new Set([...selected].filter(id=>data.employees.some(item=>item.id===id)));draw();
 }catch(err){if(root.isConnected&&current===generation){content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;content.querySelector('button').onclick=load;}}
 }
 function apply(){if(!form.reportValidity())return;anchor=form.elements.anchor.value;mode=form.elements.mode.value;departmentId=form.elements.departmentId.value;teamId=form.elements.teamId.value;search=form.elements.search.value.trim();page=1;selected.clear();load();}
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(searchTimer);apply();};form.elements.mode.onchange=form.elements.anchor.onchange=form.elements.teamId.onchange=apply;
 form.elements.departmentId.onchange=()=>{form.elements.teamId.value='';apply();};form.elements.search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(apply,300);};
 root.querySelector('[data-work-refresh]').onclick=()=>{clearTimeout(searchTimer);load();};
 function movePeriod(direction){const current=new Date(anchor+'T00:00:00Z');anchor=mode==='week'?workScheduleAddDays(anchor,direction*7):new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()+direction,1)).toISOString().slice(0,10);form.elements.anchor.value=anchor;page=1;selected.clear();load();}
 root.querySelector('[data-work-prev-period]').onclick=()=>movePeriod(-1);root.querySelector('[data-work-next-period]').onclick=()=>movePeriod(1);root.querySelector('[data-work-today]').onclick=()=>{anchor=workScheduleToday();form.elements.anchor.value=anchor;page=1;selected.clear();load();};
 root.querySelector('[data-work-export]')?.addEventListener('click',async event=>{
 if(!workScheduleGrant('canExport'))return;const button=event.currentTarget;button.disabled=true;
 try{const blob=await apiExportWorkSchedules(query()),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='work-schedules.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất lịch phân ca của trang nhân viên hiện tại.');}catch(err){toast(err.message,{type:'error'});}finally{if(button.isConnected)button.disabled=false;}
 });
 function shiftOptions(value){return '<option value="">Chọn ca</option>'+calendar.shifts.filter(item=>item.isActive||item.id===value).map(item=>`<option value="${item.id}" ${item.id===value?'selected':''}>${e(item.code)} · ${e(item.name)} (${e(item.startTime?.slice(0,5))}–${e(item.endTime?.slice(0,5))})${item.isActive?'':' · Ngừng hoạt động'}</option>`).join('');}
 async function single(original,employeeId=null,day=null){
 if(!calendar)return;const dataAtOpen=calendar;
 try{
 if(original){original=await apiWorkScheduleDetail(original.id);if(!root.isConnected||calendar!==dataAtOpen)return;employeeId=original.employeeId;day=original.workDate;}
 const employee=calendar.employees.find(item=>item.id===employeeId),canSave=original?workScheduleGrant('canUpdate'):workScheduleGrant('canNew');if(!employee)return;
 openDialog(original?'Chi tiết lịch phân ca':'Phân ca một ngày',`<p>${e(employee.employeeCode)} · ${e(employee.fullName)}</p>${original?`<p class="muted">Ca đã phân: ${e(original.rules?.shiftCode||'—')} · Trạng thái: ${e(original.status)}</p>`:''}<form id="work-single-form" class="user-registration"><fieldset class="user-edit-fieldset" ${canSave?'':'disabled'}><div class="form-grid">${field('Ngày làm việc','workDate','date',day,`required min="${workScheduleToday()}"`)}<label>Ca làm việc<select name="shiftId" required>${shiftOptions(original?.shiftId)}</select></label></div>${canSave?'<div class="form-actions"><button class="btn primary" type="submit">Lưu phân ca</button></div>':''}</fieldset><p role="alert"></p></form>`);
 const editForm=document.querySelector('#work-single-form'),feedback=editForm.querySelector('[role=alert]'),fieldset=editForm.querySelector('fieldset');let busy=false,stale=false;
 editForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||stale||!canSave||!workScheduleGrant(original?'canUpdate':'canNew'))return;
 const workDate=editForm.elements.workDate.value,shiftId=Number(editForm.elements.shiftId.value);if(!workScheduleDate(workDate)||workDate<workScheduleToday()||!calendar?.shifts.some(item=>item.id===shiftId&&item.isActive)){feedback.textContent='Chọn ngày từ hôm nay và ca đang hoạt động.';return;}
 busy=true;fieldset.disabled=true;
 try{await apiSaveWorkSchedule(original?.id??null,{employeeId,shiftId,workDate},original?.version);if(!editForm.isConnected)return;closeDialog();toast('Đã lưu phân ca.');if(root.isConnected)load();}catch(err){stale=err.status===409;if(editForm.isConnected)feedback.textContent=err.message+(stale?' Đóng cửa sổ và tải lại lịch trước khi sửa tiếp.':'');}finally{busy=false;if(editForm.isConnected)fieldset.disabled=stale;}
 };
 }catch(err){toast(err.message,{type:'error'});}
 }
 async function cancel(schedule){
 if(!workScheduleGrant('canDelete'))return;
 try{const current=await apiWorkScheduleDetail(schedule.id);if(!root.isConnected)return;const employee=calendar?.employees.find(item=>item.id===current.employeeId);
 openDialog('Hủy lịch phân ca',`<p>Hủy ca ${e(current.rules?.shiftCode||'')} ngày ${dateLabel(current.workDate)} của ${e(employee?.fullName||'nhân viên')}?</p><form id="work-cancel-form"><p role="alert"></p><div class="form-actions"><button type="submit" class="btn danger">Xác nhận hủy ca</button></div></form>`);
 const cancelForm=document.querySelector('#work-cancel-form');let busy=false;
 cancelForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||!workScheduleGrant('canDelete'))return;busy=true;cancelForm.querySelector('button').disabled=true;
 try{await apiCancelWorkSchedule(current.id,current.version);if(!cancelForm.isConnected)return;closeDialog();toast('Đã hủy lịch phân ca.');if(root.isConnected)load();}catch(err){if(cancelForm.isConnected){cancelForm.querySelector('[role=alert]').textContent=err.message+(err.status===409?' Tải lại lịch trước khi thử lại.':'');cancelForm.querySelector('button').disabled=err.status===409;}}finally{busy=false;}
 };
 }catch(err){toast(err.message,{type:'error'});}
 }
 root.querySelector('[data-work-bulk]')?.addEventListener('click',()=>{if(calendar&&workScheduleGrant('canNew'))openBatch();});
 function openBatch(){
 const dataAtOpen=calendar,earliest=range.from<workScheduleToday()?workScheduleToday():range.from;
 openDialog('Phân ca hàng loạt',`<form id="work-batch-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid"><label>Đối tượng<select name="target"><option value="EMPLOYEE">Nhân viên được chọn</option><option value="DEPARTMENT">Phòng ban</option><option value="TEAM">Team</option><option value="ALL">Tất cả trong phạm vi được cấp quyền</option></select></label><label>Cách phân ca<select name="mode"><option value="shift">Chọn ca</option><option value="copy">Sao chép lịch</option></select></label><label data-batch-target="DEPARTMENT">Phòng ban<select name="departmentId">${filterOptions(dataAtOpen.departments,departmentId,'Chọn phòng ban')}</select></label><label data-batch-target="TEAM">Team<select name="teamId">${filterOptions(dataAtOpen.teams,teamId,'Chọn team')}</select></label><label data-batch-mode="shift">Ca làm việc<select name="shiftId">${shiftOptions(null)}</select></label><div data-batch-mode="copy">${field('Ngày bắt đầu lịch nguồn','copyFrom','date','')}</div>${field('Từ ngày','from','date',earliest,`required min="${workScheduleToday()}"`)}${field('Đến ngày','to','date',range.to<earliest?earliest:range.to,'required')}</div><fieldset class="work-batch-employees" data-batch-target="EMPLOYEE"><legend>Nhân viên trên trang hiện tại</legend><div>${dataAtOpen.employees.map(item=>`<label><input type="checkbox" name="employeeIds" value="${item.id}" ${selected.has(item.id)?'checked':''}><span>${e(item.employeeCode)} · ${e(item.fullName)}</span></label>`).join('')||'<p>Chưa có nhân viên trên trang.</p>'}</div></fieldset><fieldset class="work-weekdays"><legend>Các thứ cần phân ca</legend>${['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ nhật'].map((label,index)=>`<label><input type="checkbox" name="weekdays" value="${index+1}" ${index<5?'checked':''}>${label}</label>`).join('')}</fieldset><div class="work-batch-flags"><label><input type="checkbox" name="excludeHolidays" checked>Loại trừ ngày lễ</label><label><input type="checkbox" name="overwrite" ${workScheduleGrant('canUpdate')?'':'disabled'}>Ghi đè lịch đủ điều kiện</label></div><div class="form-actions"><button type="submit" class="btn" name="action" value="preview">Xem trước</button><button type="submit" class="btn primary" name="action" value="confirm" disabled>Xác nhận phân ca</button></div></fieldset><p role="status" data-work-batch-feedback></p><div data-work-preview></div></form>`);
 const batchForm=document.querySelector('#work-batch-form'),fieldset=batchForm.querySelector('.user-edit-fieldset'),feedback=batchForm.querySelector('[data-work-batch-feedback]'),previewPanel=batchForm.querySelector('[data-work-preview]'),confirm=batchForm.querySelector('[value=confirm]');let busy=false,preview=null,payload=null,signature='',operationId='';
 function invalidate(){preview=null;payload=null;confirm.disabled=true;previewPanel.innerHTML='';feedback.textContent='';}
 function syncFields(){for(const row of batchForm.querySelectorAll('[data-batch-target]')){const active=row.dataset.batchTarget===batchForm.elements.target.value;row.hidden=!active;row.querySelectorAll('input,select').forEach(input=>input.disabled=!active);}for(const row of batchForm.querySelectorAll('[data-batch-mode]')){const active=row.dataset.batchMode===batchForm.elements.mode.value;row.hidden=!active;row.querySelectorAll('input,select').forEach(input=>input.disabled=!active);}}
 batchForm.oninput=batchForm.onchange=()=>{if(busy)return;invalidate();syncFields();};syncFields();
 batchForm.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||!workScheduleGrant('canNew'))return;
 const action=event.submitter?.value||'preview';if(action==='confirm'&&(!preview||!payload||preview.ready<1))return;
 try{
 if(action==='preview'){
 const data=new FormData(batchForm),draft=workScheduleBatchPayload({...Object.fromEntries(data),employeeIds:data.getAll('employeeIds'),weekdays:data.getAll('weekdays'),excludeHolidays:data.has('excludeHolidays'),overwrite:data.has('overwrite')},{operationId:''});
 if(draft.overwrite&&!workScheduleGrant('canUpdate'))throw Error('Ghi đè cần quyền cập nhật lịch.');const nextSignature=JSON.stringify(draft);if(nextSignature!==signature){operationId=workScheduleOperationId();signature=nextSignature;}payload={...draft,operationId};preview=null;previewPanel.innerHTML='';confirm.disabled=true;
 }
 busy=true;fieldset.disabled=true;feedback.textContent=action==='preview'?'Đang kiểm tra phân ca…':'Đang phân ca…';
 if(action==='preview'){const result=await apiPreviewWorkSchedules(payload);if(!batchForm.isConnected)return;const markup=workSchedulePreviewMarkup(result);preview=result;previewPanel.innerHTML=markup;feedback.textContent=result.ready?'Kiểm tra kết quả trước khi xác nhận.':'Không có dòng sẵn sàng để phân ca.';}
 else{const result=await apiAssignWorkSchedules({...payload,previewToken:preview.previewToken});if(!batchForm.isConnected)return;closeDialog();toast(`Đã tạo ${result.created} lịch, cập nhật ${result.updated}, bỏ qua ${result.skipped}.`);if(root.isConnected){selected.clear();load();}}
 }catch(err){if(batchForm.isConnected){feedback.textContent=err.message;if(err.status===409||action==='preview'){preview=null;previewPanel.innerHTML='';}if(err.status===409)feedback.textContent+=' Dữ liệu đã thay đổi; xem trước lại trước khi xác nhận.';}}
 finally{busy=false;if(batchForm.isConnected){fieldset.disabled=false;syncFields();batchForm.elements.overwrite.disabled=!workScheduleGrant('canUpdate');confirm.disabled=!preview||preview.ready<1;}}
 };
 }
 await load();
}
