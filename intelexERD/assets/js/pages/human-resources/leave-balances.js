import {apiLeaveBalances,apiGrantLeaveBalances,apiSaveLeaveBalance,apiAdjustLeaveBalance,apiLeaveBalanceHistory,apiWorkflowLeaveTypes,apiEmployees,apiActiveDepartments,apiSession} from '../../api/client.js';
import {openDialog,closeDialog,toast} from '../../components/dialog.js';
import {field,icon} from '../../components/ui.js';
import {e,dateLabel} from '../../utils.js';

const balanceDayKeys=['entitledDays','carriedOverDays','adjustmentDays','usedDays','reservedDays','remainingDays','availableDays'];
const balanceDayText=value=>Number(value).toLocaleString('vi-VN',{maximumFractionDigits:2});
export function leaveBalanceGrant(flag,session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_LEAVE_BALANCES'&&p.canView==='Y'&&p[flag]==='Y'&&(flag!=='canUpdate'||p.dataScopes?.UPDATE!=='SELF'));
}
export function leaveBalanceList(response){
 if(response?.success!==true||!Array.isArray(response.data)||!Number.isSafeInteger(response.total)||response.total<0)throw Error('Danh sách số dư phép không hợp lệ.');
 for(const row of response.data)if(!['id','employeeId','leaveTypeId'].every(key=>Number.isSafeInteger(row[key])&&row[key]>0)||!Number.isSafeInteger(row.version)||row.version<0||!balanceDayKeys.every(key=>typeof row[key]==='number'&&Number.isFinite(row[key])))throw Error('Chi tiết số dư phép không hợp lệ.');
 return response;
}
export function leaveBalanceTotals(rows){return rows.reduce((sum,row)=>({total:sum.total+row.entitledDays+row.carriedOverDays+row.adjustmentDays,used:sum.used+row.usedDays,remaining:sum.remaining+row.remainingDays}),{total:0,used:0,remaining:0});}
export function leaveBalanceAmount(value,{signed=false}={}){
 const number=Number(value);
 if(value===null||String(value).trim()===''||!Number.isFinite(number)||Math.abs(number)>99999.99||(!signed&&number<0)||Math.abs(number*100-Math.round(number*100))>1e-7)throw Error('Số ngày phải hợp lệ, tối đa 99999.99 và 2 chữ số thập phân.');
 return number;
}
export function leaveBalanceOperationId(){
 if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
 const bytes=new Uint8Array(16);if(!globalThis.crypto?.getRandomValues)throw Error('Trình duyệt không hỗ trợ tạo mã cấp phép an toàn.');
 globalThis.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
 const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function leaveBalanceGrantPayload(values,operationId){
 const target=values.target,year=Number(values.year),leaveTypeId=Number(values.leaveTypeId),reason=String(values.reason||'').trim();
 if(!['EMPLOYEE','DEPARTMENT','ALL'].includes(target)||!Number.isInteger(year)||year<1900||year>9999||!Number.isSafeInteger(leaveTypeId)||leaveTypeId<1||!reason)throw Error('Chọn đối tượng, loại phép, năm và nhập lý do hợp lệ.');
 const payload={operationId,target,year,leaveTypeId,entitledDays:leaveBalanceAmount(values.entitledDays),carriedOverDays:leaveBalanceAmount(values.carriedOverDays),reason};
 const key=target==='EMPLOYEE'?'employeeId':target==='DEPARTMENT'?'departmentId':null;
 if(key){const id=Number(values[key]);if(!Number.isSafeInteger(id)||id<1)throw Error('Chọn nhân viên hoặc phòng ban hợp lệ.');payload[key]=id;}
 return payload;
}
export function leaveBalanceRows(rows,canUpdate){return rows.map(row=>`<tr><td><strong>${e(row.employeeName||'')}</strong>${row.employeeCode?`<small>${e(row.employeeCode)}</small>`:''}<small>${e(row.leaveTypeName||'')}</small></td>${['entitledDays','carriedOverDays','adjustmentDays','usedDays','reservedDays','remainingDays'].map(key=>`<td class="${key==='reservedDays'?'balance-reserved':key==='remainingDays'?'balance-remaining':''}">${balanceDayText(row[key])}</td>`).join('')}<td>${balanceDayText(row.availableDays)}</td><td><div class="balance-row-actions">${canUpdate?`<button type="button" class="btn small" data-balance-edit="${row.id}">Sửa</button><button type="button" class="btn small" data-balance-adjust="${row.id}">Điều chỉnh</button>`:''}<button type="button" class="btn small" data-balance-history="${row.id}">Lịch sử</button></div></td></tr>`).join('');}

export function leaveBalanceLookupFields(key,label,placeholder){
 return `<div class="balance-lookup"><label>${label}<input type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="balance-options-${key}" data-balance-lookup="${key}" autocomplete="off" placeholder="${placeholder}" aria-describedby="balance-selection-${key}"></label><input type="hidden" name="${key}"><div class="balance-lookup-options" id="balance-options-${key}" role="listbox" aria-label="${label}" hidden></div><span class="user-field-note balance-lookup-status" id="balance-selection-${key}" role="status"></span></div>`;
}
export function leaveBalanceLookupMatch(items,value){
 const code=String(value||'').trim().toLocaleLowerCase('vi');
 return code?items.find(item=>String(item.code).toLocaleLowerCase('vi')===code)||null:null;
}
export function mountLeaveBalanceLookup(form,key,loadOptions){
 const input=form.querySelector(`[data-balance-lookup="${key}"]`),hidden=form.elements.namedItem(key),list=form.querySelector(`#balance-options-${key}`),status=form.querySelector(`#balance-selection-${key}`);
 let items=[],visible=[],generation=0,timer,blurTimer,active=-1;
 const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();
 const show=value=>{list.hidden=!value;input.setAttribute?.('aria-expanded',String(value));if(!value)input.removeAttribute?.('aria-activedescendant');};
 const resolve=()=>{const selected=leaveBalanceLookupMatch(items,input.value);hidden.value=selected?.id||'';input.setCustomValidity(input.value&&!selected?'Chọn một mục hợp lệ từ danh sách gợi ý.':'');status.textContent=selected?selected.name:'';return selected;};
 function render(){
 const query=normalize(input.value.trim());visible=items.filter(item=>normalize(item.code+' '+item.name).includes(query));
 list.innerHTML=visible.length?visible.map((item,index)=>`<button type="button" role="option" aria-selected="${index===active}" id="balance-option-${key}-${index}" data-lookup-index="${index}"><strong>${e(item.code)}</strong>${item.name!==item.code?`<small>${e(item.name)}</small>`:''}</button>`).join(''):'<p>Không có kết quả phù hợp.</p>';
 show(true);
 if(active>=0)input.setAttribute?.('aria-activedescendant',`balance-option-${key}-${active}`);
 }
 function choose(index){const item=visible[index];if(!item)return;input.value=item.code;resolve();generation++;clearTimeout(timer);show(false);input.focus?.();}
 list.onpointerdown=event=>event.preventDefault();
 list.onclick=event=>{const button=event.target.closest('[data-lookup-index]');if(button)choose(Number(button.dataset.lookupIndex));};
 async function search(){
 const current=++generation,query=input.value.trim();status.textContent='Đang tìm…';list.innerHTML='<p>Đang tải danh sách…</p>';show(true);
 try{const result=await loadOptions(query);if(!form.isConnected||current!==generation||input.disabled)return;
 items=result;active=-1;resolve();render();if(!hidden.value)status.textContent=visible.length?'Chọn trong danh sách gợi ý.':'Không có kết quả phù hợp.';
 }catch(err){if(form.isConnected&&current===generation){hidden.value='';list.innerHTML='';show(false);status.textContent=err.message;}}
 }
 input.oninput=()=>{clearTimeout(timer);generation++;resolve();active=-1;render();timer=setTimeout(search,250);};
 input.onchange=resolve;
 input.onfocus=()=>{clearTimeout(blurTimer);clearTimeout(timer);return search();};
 input.onclick=()=>{if(list.hidden){clearTimeout(timer);return search();}};
 input.onblur=()=>{blurTimer=setTimeout(()=>show(false),150);};
 input.onkeydown=event=>{
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();show(false);return;}
 if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();choose(active);return;}
 if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();if(list.hidden)render();active=Math.max(0,Math.min(visible.length-1,active+(event.key==='ArrowDown'?1:-1)));render();list.querySelector?.(`[data-lookup-index="${active}"]`)?.scrollIntoView?.({block:'nearest'});}
 };
}

export async function mountLeaveBalances(root){
 if(!root)return;
 if(!leaveBalanceGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem WEB_LEAVE_BALANCES.</p>';return;}
 let year=Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric'}).format(new Date())),type='',search='',page=1,rows=[],types=[],generation=0,timer;
 const canUpdate=leaveBalanceGrant('canUpdate'),pageSize=20;
 root.innerHTML=`<div class="contracts-heading"><div><h2>Leave Management</h2><p>Theo dõi và phân bổ ngày phép nhân viên</p></div>${canUpdate?`<button type="button" class="btn primary" data-balance-grant>${icon('plus',18)} Cấp phép</button>`:''}</div><div data-balance-summary></div><form class="toolbar balance-filters"><label>Năm<input name="year" type="number" min="1900" max="9999" required value="${year}"></label><label>Loại phép<select name="leaveTypeId"><option value="">Tất cả loại phép</option></select></label><label class="balance-search">Tìm nhân viên<input name="search" placeholder="Tên hoặc mã nhân viên" type="search"></label><button class="btn" type="submit">Lọc</button><button class="btn" type="button" data-balance-refresh>Làm mới</button></form><div data-balance-content></div>`;
 const content=root.querySelector('[data-balance-content]'),summary=root.querySelector('[data-balance-summary]'),form=root.querySelector('form');
 function currentFilters(){return {year,leaveTypeId:type,search,view:'ALL'};}
 async function load(){
 if(!root.isConnected)return;
 const current=++generation;content.innerHTML='<p role="status">Đang tải số dư phép…</p>';summary.innerHTML='<div class="my-leave-summary" aria-busy="true">'+Array.from({length:3},()=>'<div class="card my-leave-stat">Đang tải…</div>').join('')+'</div>';
 try{
 const all=[];let serverPage=1;
 while(true){const result=leaveBalanceList(await apiLeaveBalances({...currentFilters(),page:serverPage,pageSize:100}));if(!root.isConnected||current!==generation)return;all.push(...result.data);if(all.length>=result.total)break;if(!result.data.length)throw Error('Danh sách thay đổi trong lúc tải. Hãy làm mới.');serverPage++;}
 rows=all;
 for(const row of rows)if(!types.some(item=>item.id===row.leaveTypeId))types.push({id:row.leaveTypeId,name:row.leaveTypeName||`Loại phép #${row.leaveTypeId}`});
 form.elements.leaveTypeId.innerHTML='<option value="">Tất cả loại phép</option>'+types.map(item=>`<option value="${item.id}" ${String(item.id)===type?'selected':''}>${e(item.name)}</option>`).join('');
 page=Math.min(page,Math.max(1,Math.ceil(rows.length/pageSize)));const totals=leaveBalanceTotals(rows);
 summary.innerHTML=`<div class="my-leave-summary">${[['total','Tổng phép được cấp'],['used','Phép đã sử dụng'],['remaining','Phép còn lại']].map(([key,label])=>`<article class="card my-leave-stat"><div><span>${label}</span><strong>${balanceDayText(totals[key])}<small> ngày</small></strong></div></article>`).join('')}</div>`;draw();
 }catch(err){if(!root.isConnected||current!==generation)return;summary.innerHTML='';content.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button" data-retry>Thử lại</button>`;content.querySelector('button').onclick=load;}
 }
 function draw(){
 const totalPages=Math.max(1,Math.ceil(rows.length/pageSize));
 content.innerHTML=`<div class="table-wrap"><table class="leave-balances-table"><thead><tr><th>Nhân viên</th><th>Được cấp</th><th>Chuyển năm</th><th>Điều chỉnh</th><th>Đã nghỉ</th><th>Chờ duyệt</th><th>Còn lại</th><th>Khả dụng</th><th></th></tr></thead><tbody>${leaveBalanceRows(rows.slice((page-1)*pageSize,page*pageSize),canUpdate)}</tbody></table></div>${rows.length?'':'<div class="empty">Chưa có số dư phép theo bộ lọc.</div>'}<div class="user-pagination contracts-pagination"><span>${rows.length} số dư · Trang ${page}/${totalPages}</span><div><button type="button" class="btn" data-prev ${page===1?'disabled':''}>Trang trước</button><button type="button" class="btn" data-next ${page>=totalPages?'disabled':''}>Trang sau</button></div></div>`;
 content.querySelector('[data-prev]').onclick=()=>{page--;draw();};content.querySelector('[data-next]').onclick=()=>{page++;draw();};
 for(const [attribute,action] of [['data-balance-edit','edit'],['data-balance-adjust','adjust'],['data-balance-history','history']])content.querySelectorAll(`[${attribute}]`).forEach(button=>button.onclick=()=>{const row=rows.find(item=>item.id===Number(button.getAttribute(attribute)));if(action==='history')showHistory(row);else editBalance(row,action);});
 }
 const apply=()=>{if(!form.reportValidity())return;year=Number(form.elements.year.value);type=form.elements.leaveTypeId.value;search=form.elements.search.value.trim();page=1;load();};
 form.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(timer);apply();};form.elements.year.onchange=form.elements.leaveTypeId.onchange=apply;form.elements.search.oninput=()=>{clearTimeout(timer);timer=setTimeout(apply,300);};root.querySelector('[data-balance-refresh]').onclick=()=>{clearTimeout(timer);apply();};
 function typeOptions(selected=''){return `<option value="">Chọn loại phép</option>${types.map(item=>`<option value="${item.id}" ${Number(selected)===item.id?'selected':''}>${e(item.name)}</option>`).join('')}`;}
 async function grantBalance(){
 if(!leaveBalanceGrant('canUpdate'))return;
 openDialog('Cấp phép',`<form id="balance-grant-form" class="user-registration"><div class="form-grid"><label>Đối tượng<select name="target"><option value="EMPLOYEE">Nhân viên</option><option value="DEPARTMENT">Phòng ban</option><option value="ALL">Tất cả nhân viên trong phạm vi được cấp quyền</option></select></label><label>Loại phép${types.length?`<select name="leaveTypeId" required>${typeOptions(type)}</select>`:'<input name="leaveTypeId" type="number" min="1" required placeholder="ID loại phép">'}</label><div data-grant-employee class="balance-grant-target">${leaveBalanceLookupFields('employeeId','Mã nhân viên','Nhập mã nhân viên để tìm')}</div><div data-grant-department class="balance-grant-target" hidden><label>Phòng ban<select name="departmentId"><option value="">Chọn phòng ban</option></select></label></div>${field('Năm','year','number',year,'required min="1900" max="9999"')}${field('Số ngày được cấp','entitledDays','number','','required min="0" max="99999.99" step="0.01"')}${field('Số ngày chuyển năm','carriedOverDays','number',0,'required min="0" max="99999.99" step="0.01"')}</div><label>Lý do<textarea name="reason" required maxlength="1000"></textarea></label><p data-feedback role="status"></p><div class="form-actions"><button class="btn primary" type="submit">Cấp phép</button></div></form>`);
 const grantForm=document.querySelector('#balance-grant-form'),feedback=grantForm.querySelector('[data-feedback]');let busy=false,lastContent='',operationId='';
 let departmentsPromise,departmentsLoaded=false;
 mountLeaveBalanceLookup(grantForm,'employeeId',async query=>{
 const result=await apiEmployees(new URLSearchParams({page:1,pageSize:20,search:query,employmentStatus:'ACTIVE'}));
 if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
 return result.data.filter(item=>item.employeeCode).map(item=>({id:item.id,code:item.employeeCode,name:item.fullName||item.name||''}));
 });
 const departmentSelect=grantForm.elements.departmentId;
 async function loadDepartments(){
 if(departmentsLoaded||departmentsPromise)return;
 departmentSelect.innerHTML='<option value="">Đang tải phòng ban…</option>';
 departmentsPromise=apiActiveDepartments();
 try{const items=await departmentsPromise;if(!grantForm.isConnected)return;
 departmentSelect.innerHTML='<option value="">Chọn phòng ban</option>'+items.map(item=>`<option value="${e(item.id)}">${e(item.departmentName)}</option>`).join('');departmentsLoaded=true;
 if(!items.length)feedback.textContent='Chưa có phòng ban đang hoạt động.';
 }catch(err){if(grantForm.isConnected){departmentSelect.innerHTML='<option value="">Không tải được phòng ban</option>';feedback.textContent=err.message;}}
 finally{departmentsPromise=null;}
 }
 departmentSelect.onfocus=loadDepartments;
 function syncTarget(){
 for(const [target,key,selector] of [['EMPLOYEE','employeeId','[data-grant-employee]'],['DEPARTMENT','departmentId','[data-grant-department]']]){
 const active=grantForm.elements.target.value===target,input=key==='departmentId'?departmentSelect:grantForm.querySelector(`[data-balance-lookup="${key}"]`);
 grantForm.querySelector(selector).hidden=!active;input.required=active;input.disabled=!active;
 if(active&&key==='departmentId')loadDepartments();
 }
 }
 grantForm.elements.target.onchange=syncTarget;syncTarget();
 grantForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||!leaveBalanceGrant('canUpdate'))return;let payload;
 try{payload=leaveBalanceGrantPayload(Object.fromEntries(new FormData(grantForm)),'');const signature=JSON.stringify(payload);if(signature!==lastContent){operationId=leaveBalanceOperationId();lastContent=signature;}payload.operationId=operationId;}catch(err){feedback.textContent=err.message;return;}
 busy=true;const submit=grantForm.querySelector('[type=submit]');submit.disabled=true;feedback.textContent='Đang cấp phép…';
 try{const receipt=await apiGrantLeaveBalances(payload);if(!grantForm.isConnected)return;closeDialog();toast(`Đã tạo ${receipt.created} số dư; bỏ qua ${receipt.skipped} số dư đã có.`);if(root.isConnected)load();}catch(err){if(grantForm.isConnected)feedback.textContent=err.message;}finally{busy=false;submit.disabled=false;}
 };
 }
 function editBalance(row,action){
 if(!leaveBalanceGrant('canUpdate'))return;
 openDialog(action==='adjust'?'Điều chỉnh số dư phép':'Sửa cấp phép',`<p>${e(row.employeeName)} · ${e(row.leaveTypeName)} · ${row.year}</p><form id="balance-edit-form" class="user-registration">${action==='adjust'?field('Số ngày điều chỉnh (âm để giảm)','days','number','','required min="-99999.99" max="99999.99" step="0.01"'):`<div class="form-grid">${field('Số ngày được cấp','entitledDays','number',row.entitledDays,'required min="0" max="99999.99" step="0.01"')}${field('Số ngày chuyển năm','carriedOverDays','number',row.carriedOverDays,'required min="0" max="99999.99" step="0.01"')}</div>`}<label>Lý do<textarea name="reason" required maxlength="1000"></textarea></label><p role="status" data-feedback></p><div class="form-actions"><button class="btn primary" type="submit">Lưu</button></div></form>`);
 const editForm=document.querySelector('#balance-edit-form'),feedback=editForm.querySelector('[data-feedback]');let busy=false,stale=false;
 editForm.onsubmit=async event=>{event.preventDefault();event.stopPropagation();if(busy||stale||!leaveBalanceGrant('canUpdate'))return;const data=Object.fromEntries(new FormData(editForm));let payload;
 try{const reason=data.reason.trim();if(!reason)throw Error('Nhập lý do.');if(action==='adjust'){const days=leaveBalanceAmount(data.days,{signed:true});if(days===0||row.availableDays+days<0)throw Error('Điều chỉnh phải khác 0 và không giảm vào phép đã dùng hoặc đang giữ.');payload={version:row.version,days,reason};}else{const entitledDays=leaveBalanceAmount(data.entitledDays),carriedOverDays=leaveBalanceAmount(data.carriedOverDays),allocated=entitledDays+carriedOverDays+row.adjustmentDays;if(allocated<row.usedDays+row.reservedDays||allocated>99999.99)throw Error('Tổng phân bổ phải đủ phép đã dùng/đang giữ và không vượt 99999.99.');payload={employeeId:row.employeeId,leaveTypeId:row.leaveTypeId,year:row.year,version:row.version,entitledDays,carriedOverDays,reason};}}catch(err){feedback.textContent=err.message;return;}
 busy=true;const submit=editForm.querySelector('button');submit.disabled=true;
 try{if(action==='adjust')await apiAdjustLeaveBalance(row.id,payload);else await apiSaveLeaveBalance(payload);if(!editForm.isConnected)return;closeDialog();toast('Đã cập nhật số dư phép.');if(root.isConnected)load();}catch(err){stale=err.status===409;if(editForm.isConnected)feedback.textContent=err.message+(stale?' Đóng cửa sổ và làm mới danh sách trước khi sửa lại.':'');}finally{busy=false;submit.disabled=stale;}
 };
 }
 async function showHistory(row){
 openDialog('Lịch sử số dư phép',`<p>${e(row.employeeName)} · ${e(row.leaveTypeName)}</p><div id="balance-history-content"></div>`);const target=document.querySelector('#balance-history-content');let historyPage=1;
 async function loadHistory(){target.innerHTML='<p>Đang tải lịch sử…</p>';try{const result=await apiLeaveBalanceHistory(row.id,historyPage);if(!target.isConnected)return;if(!Array.isArray(result.data))throw Error('Lịch sử không hợp lệ.');target.innerHTML=`${result.data.map(item=>{let after={};try{after=typeof item.afterJson==='string'?JSON.parse(item.afterJson):item.afterJson||{};}catch{}return `<article class="system-settings-location"><strong>${e(item.action)}</strong><p>${e(item.actorUserId||'Hệ thống')} · ${e(dateLabel(item.createdAt))}</p><p>${e(after.reason||'')}</p></article>`;}).join('')||'<p>Chưa có lịch sử.</p>'}<div class="user-pagination"><button class="btn" type="button" data-history-prev ${historyPage===1?'disabled':''}>Trang trước</button><span>Trang ${historyPage}</span><button class="btn" type="button" data-history-next ${historyPage*20>=result.total?'disabled':''}>Trang sau</button></div>`;target.querySelector('[data-history-prev]').onclick=()=>{historyPage--;loadHistory();};target.querySelector('[data-history-next]').onclick=()=>{historyPage++;loadHistory();};}catch(err){if(target.isConnected)target.innerHTML=`<p role="alert">${e(err.message)}</p>`;}}
 await loadHistory();
 }
 root.querySelector('[data-balance-grant]')?.addEventListener('click',grantBalance);
 const catalogAllowed=apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_LEAVE_TYPES'&&p.canView==='Y');
 if(catalogAllowed){try{const result=await apiWorkflowLeaveTypes('page=1&pageSize=100');types=(Array.isArray(result)?result:result.data||[]).filter(item=>item.isActive&&item.requiresBalance);if(root.isConnected)form.elements.leaveTypeId.innerHTML='<option value="">Tất cả loại phép</option>'+types.map(item=>`<option value="${item.id}">${e(item.name)}</option>`).join('');}catch{}}
 await load();
}
