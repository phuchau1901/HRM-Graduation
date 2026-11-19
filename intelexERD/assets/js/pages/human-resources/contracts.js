import {openDialog,closeDialog,toast} from '../../components/dialog.js';
import {apiCreateContract,apiContractStatistics,apiSession,apiEmployees,apiEmployeeContracts,apiEmployeeContract,apiSaveEmployeeContract,apiActiveContractTypes} from '../../api/client.js';
import {e,dateLabel} from '../../utils.js';
import {field,details,icon} from '../../components/ui.js';

export const contractStatuses={DRAFT:'Bản nháp',ACTIVE:'Đang hiệu lực',EXPIRED:'Hết hạn',TERMINATED:'Đã chấm dứt',CANCELLED:'Đã hủy'};
export function contractGrant(flag,session=apiSession()){
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_CONTRACTS'&&p.canView==='Y'&&p[flag]==='Y');
}
const contractCatalogGrant=code=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y');
export function contractClosed(item){return ['EXPIRED','TERMINATED','CANCELLED'].includes(item?.status);}
export const contractBusinessDate=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export function contractAttachment(value){
 if(!value)return null;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?value:null;}catch{return null;}
}
export function contractPayload(values,{original=null,hireDate=null,today=contractBusinessDate()}={}){
 const contractType=String(values.contractType||''),startDate=values.startDate,endDate=values.endDate||null,status=values.status,attachmentUrl=String(values.attachmentUrl||'').trim()||null;
 if(original&&values.contractNo!==undefined&&values.contractNo!==original.contractNo)throw Error('Không được thay đổi số hợp đồng đã cấp.');
 if(!contractType.trim()||contractType.length>30)throw Error('Vui lòng chọn loại hợp đồng hợp lệ.');
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!validDate(startDate)||endDate&&!validDate(endDate))throw Error('Ngày hợp đồng không hợp lệ.');
 if(hireDate&&startDate<hireDate.slice(0,10))throw Error('Ngày bắt đầu không được trước ngày vào làm.');
 if(endDate&&endDate<startDate)throw Error('Ngày kết thúc không được trước ngày bắt đầu.');
 if(!Object.hasOwn(contractStatuses,status))throw Error('Trạng thái hợp đồng không hợp lệ.');
 if(attachmentUrl&&(attachmentUrl.length>500||!contractAttachment(attachmentUrl)))throw Error('Tệp đính kèm phải là liên kết HTTPS không chứa thông tin đăng nhập, tối đa 500 ký tự.');
 if(original?.status==='ACTIVE'&&!['ACTIVE','EXPIRED','TERMINATED'].includes(status))throw Error('Hợp đồng đang hiệu lực chỉ có thể giữ hiệu lực, hết hạn hoặc chấm dứt.');
 if(status==='ACTIVE'&&(startDate>today||endDate&&endDate<today))throw Error('Hợp đồng đang hiệu lực phải bao gồm ngày hôm nay.');
 if(['EXPIRED','TERMINATED'].includes(status)&&(!endDate||endDate>today))throw Error('Hợp đồng đóng phải có ngày kết thúc không sau hôm nay.');
 const payload={contractType,startDate,endDate,status,attachmentUrl};
 if(contractClosed(original)&&Object.keys(payload).some(key=>payload[key]!==original[key]))throw Error('Hợp đồng đã đóng chỉ được xem.');
 return payload;
}
export function contractStatisticsData(response){
 const data=response?.data;
 if(response?.success!==true||!data||!['active','expiringSoon','expired'].every(key=>Number.isSafeInteger(data[key])&&data[key]>=0)||!Number.isInteger(data.expiringWithinDays)||data.expiringWithinDays<1||data.expiringWithinDays>365||!/^\d{4}-\d{2}-\d{2}$/.test(data.asOfDate)||Number.isNaN(Date.parse(data.asOfDate))||new Date(data.asOfDate).toISOString().slice(0,10)!==data.asOfDate)throw Error('Dữ liệu thống kê hợp đồng không hợp lệ.');
 return data;
}
export function contractCategory(item,today=contractBusinessDate(),days=30){
 if(item.startDate>today)return null;
 const cutoff=new Date(today+'T00:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()+days);
 if(['ACTIVE','EXPIRED'].includes(item.status)&&item.endDate&&item.endDate<today)return 'expired';
 if(item.status!=='ACTIVE')return null;
 if(!item.endDate||item.endDate>cutoff.toISOString().slice(0,10))return 'active';
 return 'expiringSoon';
}
export function contractListRows(items,canUpdate=false,employee=null,today=contractBusinessDate(),days=30){
 return items.map((item,index)=>{
  const category=contractCategory(item,today,days),label=({active:'Đang hiệu lực',expiringSoon:'Sắp hết hạn',expired:'Đã hết hạn'})[category]||contractStatuses[item.status]||item.status;
  return `<tr><td><strong class="contract-number">${e(item.contractNo)}</strong><span class="contract-employee-name">${e(item.employeeName||employee?.fullName||`Nhân viên #${item.employeeId||'—'}`)}</span><small>${e(item.employeeCode||employee?.employeeCode||'')}</small></td><td><span class="contract-type-name">${e(item.contractTypeName||item.contractType)}</span><span class="contract-period">${dateLabel(item.startDate)} – ${dateLabel(item.endDate)}</span></td><td><span class="contract-state ${category||e(item.status?.toLowerCase())}"><span aria-hidden="true"></span>${e(label)}</span></td><td class="text-right"><button type="button" class="btn contract-view" data-contract-open="${index}">Xem</button></td></tr>`;
 }).join('');
}

const contractSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,'d').toLocaleLowerCase('vi').trim();
export function searchContracts(items,query='',status='',today=contractBusinessDate(),days=30){
 const term=contractSearchText(query);
 return items.filter(item=>(!term||[item.contractNo,item.employeeName,item.employeeCode].some(value=>contractSearchText(value).includes(term)))&&(!status||(['active','expiringSoon','expired'].includes(status)?contractCategory(item,today,days)===status:item.status===status)));
}
export async function loadVisibleContracts({canReadEmployees=false,ownEmployee=null,signal,isCurrent=()=>true,readEmployees=apiEmployees,readContracts=apiEmployeeContracts}={}){
 const check=()=>{if(signal?.aborted||!isCurrent())throw new DOMException('Request aborted','AbortError');};
 async function pages(read){
  const items=[];let page=1,total=Infinity;
  while(items.length<total){check();const result=await read(new URLSearchParams({page,pageSize:100}).toString());check();
   if(!Array.isArray(result?.data)||!Number.isInteger(result.total)||result.total<0)throw Error('Danh sách hợp đồng hoặc nhân viên không hợp lệ.');
   items.push(...result.data);total=result.total;if(!result.data.length)break;page++;
  }
  return items;
 }
 const employees=canReadEmployees?await pages(query=>readEmployees(query,signal)):ownEmployee?.id?[ownEmployee]:[];
 if(!canReadEmployees&&!employees.length)throw Error('Cần quyền xem nhân viên hoặc hồ sơ nhân viên liên kết để tải danh sách hợp đồng.');
 const contracts=[];let next=0;
 await Promise.all(Array.from({length:Math.min(4,employees.length)},async()=>{
  while(next<employees.length){check();const employee=employees[next++];
   try{const rows=await pages(query=>readContracts(employee.id,query,signal));for(const item of rows)contracts.push({...item,employeeId:employee.id,employeeName:employee.fullName||'',employeeCode:employee.employeeCode||'',employeeHireDate:employee.hireDate||null});}
   catch(err){if(err.status!==404)throw err;}
  }
 }));
 check();return contracts.sort((a,b)=>String(a.contractNo).localeCompare(String(b.contractNo),'vi')||Number(a.employeeId)-Number(b.employeeId)||String(a.id).localeCompare(String(b.id)));
}

export async function mountContracts(root){
 if(!root)return;
 if(!contractGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem hợp đồng.</p>';return;}
 let employeeId=null,employee=null,page=1,search='',generation=0,statisticsGeneration=0,saving=false,dirty=false,statusFilter='',expiringWithinDays=30,statistics=null,directory=null,directoryRequest=null,directoryController=null,searchTimer;
 const ownId=apiSession()?.user?.employeeId;
 root.innerHTML=`<div class="contracts-heading page-content-actions">${contractGrant('canNew')?`<button type="button" class="btn primary" id="contracts-create">${icon('plus',18)} Tạo hợp đồng</button>`:''}</div><div id="contract-statistics" aria-live="polite"></div><div class="contracts-statistics-note"><span id="contracts-as-of"></span><label>Cảnh báo sắp hết hạn<select id="contracts-window" aria-label="Khoảng thời gian sắp hết hạn"><option value="7">7 ngày</option><option value="30" selected>30 ngày</option><option value="60">60 ngày</option><option value="90">90 ngày</option><option value="365">365 ngày</option></select></label></div><form class="contracts-filters" id="contract-search"><div class="contracts-search-input">${icon('search',18)}<input type="search" name="search" maxlength="150" placeholder="Tìm nhân viên, mã hợp đồng…" aria-label="Tìm theo tên nhân viên, mã nhân viên hoặc mã hợp đồng"></div><select name="status" aria-label="Lọc trạng thái hợp đồng"><option value="">Tất cả</option><option value="active">Đang hiệu lực</option><option value="expiringSoon">Sắp hết hạn</option><option value="expired">Đã hết hạn</option></select></form><section id="contract-workspace"><p role="status">Đang tải hợp đồng…</p></section>`;
 async function loadStatistics(){
  const id=++statisticsGeneration,panel=root.querySelector('#contract-statistics');
  statistics=null;root.querySelector('#contracts-as-of').textContent='';
  panel.innerHTML=`<div class="contracts-stats" aria-busy="true" role="status" aria-label="Đang tải thống kê">${[1,2,3].map(()=>'<div class="contract-stat contract-stat-loading"><span></span><strong></strong><span></span></div>').join('')}</div>`;
  try{
   const data=contractStatisticsData(await apiContractStatistics(expiringWithinDays));if(!root.isConnected||id!==statisticsGeneration)return;
   statistics=data;
   panel.innerHTML=`<div class="contracts-stats">${[['active','Đang hiệu lực','approval'],['expiringSoon','Sắp hết hạn','clock'],['expired','Đã hết hạn','file']].map(([key,label,glyph])=>`<article class="contract-stat ${key}"><span class="contract-stat-icon">${icon(glyph,21)}</span><strong>${data[key].toLocaleString('vi-VN')}</strong><span>${label}</span></article>`).join('')}</div>`;
   root.querySelector('#contracts-as-of').textContent=`Trong phạm vi được xem · Cập nhật ${dateLabel(data.asOfDate)}`;
  }catch(err){if(root.isConnected&&id===statisticsGeneration){panel.innerHTML=`<div class="contracts-stats-error"><p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại thống kê</button></div>`;panel.querySelector('button').onclick=loadStatistics;}}
 }
 root.querySelector('#contracts-window').onchange=event=>{expiringWithinDays=Number(event.target.value);loadStatistics();if(!dirty&&!saving)list();};
 root.querySelector('#contracts-create')?.addEventListener('click',()=>{
  if(!canLeave())return;
  openContractCreation({isPageCurrent:()=>root.isConnected,onSaved:async()=>{directory=null;loadStatistics();await list();}});
 });
 const workspace=root.querySelector('#contract-workspace'),searchForm=root.querySelector('#contract-search');
 const applySearch=()=>{if(!canLeave())return;search=searchForm.elements.search.value.trim();statusFilter=searchForm.elements.status.value;page=1;list();};
 searchForm.onsubmit=event=>{event.preventDefault();event.stopPropagation();clearTimeout(searchTimer);applySearch();};
 searchForm.elements.search.oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(root.isConnected)applySearch();},250);};
 searchForm.elements.status.onchange=()=>{clearTimeout(searchTimer);applySearch();};
 const alive=id=>root.isConnected&&generation===id;
 const canLeave=()=>!saving&&(!dirty||confirm('Bỏ các thay đổi hợp đồng chưa lưu?'));
 function showError(err,retry){workspace.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;workspace.querySelector('button').onclick=retry;}
 async function getDirectory(){
  if(directory)return directory;
  if(!directoryRequest){
   directoryController=new AbortController();
   directoryRequest=loadVisibleContracts({canReadEmployees:!!contractCatalogGrant('WEB_EMPLOYEES'),ownEmployee:ownId?{id:ownId,fullName:apiSession()?.user?.fullName||'',employeeCode:apiSession()?.user?.employeeCode||''}:null,signal:directoryController.signal,isCurrent:()=>root.isConnected}).then(items=>{directory=items;return items;}).catch(err=>{directoryController?.abort();throw err;}).finally(()=>{directoryRequest=null;});
  }
  return directoryRequest;
 }
 async function list(){
  clearTimeout(searchTimer);const id=++generation;dirty=false;searchForm.hidden=false;
  workspace.innerHTML='<p role="status">Đang tải hợp đồng…</p>';
  try{
   if(!contractGrant('canView'))throw Error('Bạn chưa có quyền xem hợp đồng.');
   const items=await getDirectory();if(!alive(id))return;
   const filtered=searchContracts(items,search,statusFilter,statistics?.asOfDate||contractBusinessDate(),expiringWithinDays);
   page=Math.min(page,Math.max(1,Math.ceil(filtered.length/30)));
   const result={data:filtered.slice((page-1)*30,page*30),total:filtered.length};
   workspace.innerHTML=`<div class="table-wrap"><table class="contracts-table"><thead><tr><th>Hợp đồng / Nhân viên</th><th>Loại / Hiệu lực</th><th>Trạng thái</th><th><span class="sr-only">Hành động</span></th></tr></thead><tbody>${contractListRows(result.data,contractGrant('canUpdate'),null,statistics?.asOfDate||contractBusinessDate(),expiringWithinDays)}</tbody></table></div>${result.data.length?'':'<div class="empty"><h3>Không có hợp đồng phù hợp</h3><p>Thử thay đổi từ khóa hoặc trạng thái.</p></div>'}<div class="toolbar user-pagination contracts-pagination"><span>${e(result.total)} hợp đồng · Trang ${page}</span><div><button type="button" class="btn" id="contract-prev" ${page<=1?'disabled':''}>Trang trước</button><button type="button" class="btn" id="contract-next" ${page*30>=result.total?'disabled':''}>Trang sau</button></div></div>`;
   workspace.querySelectorAll('[data-contract-open]').forEach(button=>button.onclick=()=>{const item=result.data[Number(button.dataset.contractOpen)];employeeId=item.employeeId;employee={id:item.employeeId,fullName:item.employeeName,employeeCode:item.employeeCode,hireDate:item.employeeHireDate};edit(item.id);});
   workspace.querySelector('#contract-prev').onclick=()=>{page--;list();};workspace.querySelector('#contract-next').onclick=()=>{page++;list();};
  }catch(err){if(alive(id))showError(err,list);}
 }
 async function edit(contractId=null,editing=false){
  if(contractId===null&&!contractGrant('canNew'))return;
  clearTimeout(searchTimer);searchForm.hidden=true;const id=++generation,target=employeeId;workspace.innerHTML='<p role="status">Đang tải thông tin hợp đồng…</p>';
  try{
   const item=contractId===null?null:await apiEmployeeContract(target,contractId);if(!alive(id))return;
   const editable=contractGrant(contractId===null?'canNew':'canUpdate')&&!contractClosed(item);
   if(item&&(!editable||!editing)){
    const attachment=contractAttachment(item?.attachmentUrl);
    workspace.innerHTML=`<button type="button" class="btn" id="contract-back">← Danh sách hợp đồng</button><h2 class="role-editor-title">${e(item.contractNo)}</h2>${details([['Loại hợp đồng',e(item.contractTypeName||item.contractType)],['Bắt đầu',dateLabel(item.startDate)],['Kết thúc',dateLabel(item.endDate)],['Trạng thái',e(contractStatuses[item.status]||item.status)],['Tệp đính kèm',attachment?`<a href="${e(attachment)}" target="_blank" rel="noopener noreferrer">Xem tệp đính kèm</a>`:'—']])}${contractClosed(item)?'<p class="muted">Hợp đồng đã đóng chỉ được xem.</p>':''}${editable?'<button type="button" class="btn primary" id="contract-edit-detail">Chỉnh sửa hợp đồng</button>':''}`;
    workspace.querySelector('#contract-back').onclick=list;workspace.querySelector('#contract-edit-detail')?.addEventListener('click',()=>edit(contractId,true));return;
   }
   workspace.innerHTML=`<button type="button" class="btn" id="contract-back">← Danh sách hợp đồng</button><h2 class="role-editor-title">${item?'Chỉnh sửa':'Thêm'} hợp đồng · ${employee?e(employee.fullName):`Nhân viên #${e(target)}`}</h2><form class="user-registration" id="contract-form"><fieldset class="user-edit-fieldset"><div class="form-grid">${field('Số hợp đồng','contractNo','text',item?.contractNo||'','readonly')}<label>Loại hợp đồng<select name="contractType" required disabled>${item?`<option value="${e(item.contractType)}">${e(item.contractTypeName||item.contractType)}</option>`:'<option value="">Đang tải loại hợp đồng…</option>'}</select></label>${field('Ngày bắt đầu','startDate','date',item?.startDate||'','required')}${field('Ngày kết thúc (tùy chọn)','endDate','date',item?.endDate||'')}<label>Trạng thái<select name="status">${Object.entries(contractStatuses).filter(([value])=>item?.status!=='ACTIVE'||['ACTIVE','EXPIRED','TERMINATED'].includes(value)).map(([value,label])=>`<option value="${value}" ${(item?.status||'DRAFT')===value?'selected':''}>${label}</option>`).join('')}</select></label>${field('Liên kết tệp đính kèm (HTTPS)','attachmentUrl','url',item?.attachmentUrl||'','maxlength="500"')}</div><p id="contract-type-feedback" role="status"></p><div class="form-actions"><button type="submit" class="btn primary" ${!item?'disabled':''}>Lưu hợp đồng</button></div></fieldset><p id="contract-feedback" role="alert"></p></form>`;
   const form=workspace.querySelector('#contract-form'),fieldset=form.querySelector('fieldset'),feedback=workspace.querySelector('#contract-feedback'),typeFeedback=workspace.querySelector('#contract-type-feedback'),submit=form.querySelector('[type=submit]');
   let types=[],typeReady=!!item;
   form.oninput=form.onchange=()=>{dirty=true;};
   workspace.querySelector('#contract-back').onclick=()=>{if(canLeave())list();};
   async function loadTypes(){
    if(!contractCatalogGrant('WEB_CONTRACT_TYPES')){typeFeedback.textContent=item?'Giữ loại hợp đồng hiện tại. Cần quyền xem loại hợp đồng để đổi loại.':'Bạn cần quyền xem WEB_CONTRACT_TYPES để chọn loại hợp đồng.';return;}
    try{
     const result=await apiActiveContractTypes();if(!alive(id)||!form.isConnected)return;types=result;
     const choices=[...types];if(item&&!choices.some(type=>type.code===item.contractType))choices.unshift({code:item.contractType,name:item.contractTypeName||item.contractType});
     form.elements.contractType.innerHTML='<option value="">Chọn loại hợp đồng</option>'+choices.map(type=>`<option value="${e(type.code)}" ${item?.contractType===type.code?'selected':''}>${e(type.name)}</option>`).join('');form.elements.contractType.disabled=false;typeReady=choices.length>0;submit.disabled=!typeReady;
     typeFeedback.textContent=choices.length?'':'Chưa có loại hợp đồng hoạt động. Thêm loại hợp đồng trong Master Data trước.';
    }catch(err){if(alive(id)&&form.isConnected){typeFeedback.innerHTML=`${e(err.message)} <button type="button" class="btn">Thử lại</button>`;typeFeedback.querySelector('button').onclick=loadTypes;}}
   }
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(saving)return;feedback.textContent='';
    try{
     if(!contractGrant(item?'canUpdate':'canNew'))throw Error('Bạn không có quyền lưu hợp đồng.');
     if(!typeReady)throw Error('Vui lòng tải và chọn loại hợp đồng.');
     const values=Object.fromEntries(new FormData(form));if(form.elements.contractType.disabled)values.contractType=item?.contractType;
     const payload=contractPayload(values,{original:item,hireDate:employee?.hireDate});
     if(payload.contractType!==item?.contractType&&!types.some(type=>type.code===payload.contractType))throw Error('Vui lòng chọn loại hợp đồng đang hoạt động.');
     saving=true;fieldset.disabled=true;submit.textContent='Đang lưu…';
     await apiSaveEmployeeContract(target,contractId,payload);if(alive(id)){dirty=false;directory=null;loadStatistics();await list();}
    }catch(err){if(alive(id)&&form.isConnected)feedback.textContent=err.message;}
    finally{saving=false;if(form.isConnected){fieldset.disabled=false;submit.disabled=!typeReady;submit.textContent='Lưu hợp đồng';}}
   };
   loadTypes();
  }catch(err){if(alive(id))showError(err,()=>edit(contractId,editing));}
 }
 loadStatistics();
 await list();
}

export function openContractCreation({onSaved=()=>{},isPageCurrent=()=>true}={}){
 if(!contractGrant('canNew'))throw Error('Bạn không có quyền tạo hợp đồng.');
 const canEmployees=!!contractCatalogGrant('WEB_EMPLOYEES'),ownId=apiSession()?.user?.employeeId;
 openDialog('Tạo hợp đồng',`<section id="contract-create-popup">${canEmployees?'<label class="contract-popup-employee-search">Tìm nhân viên<input type="search" id="contract-create-employee-search" maxlength="150" placeholder="Tìm tên hoặc mã nhân viên"></label>':''}<form id="contract-create-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${canEmployees?'<label>Nhân viên<select name="employeeId" required disabled><option value="">Đang tải nhân viên…</option></select></label>':field('ID nhân viên','employeeId','number',ownId||'','required min="1" step="1"')}<label>Loại hợp đồng<select name="contractType" required disabled><option value="">Đang tải loại hợp đồng…</option></select></label>${field('Ngày bắt đầu','startDate','date','','required')}${field('Ngày kết thúc (tùy chọn)','endDate','date','')}<label>Trạng thái<select name="status">${Object.entries(contractStatuses).map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select></label>${field('Liên kết tệp đính kèm (HTTPS)','attachmentUrl','url','','maxlength="500"')}</div><p id="contract-create-catalog-feedback" role="status"></p><div class="form-actions"><button type="button" class="btn" id="contract-create-cancel">Hủy</button><button type="submit" class="btn primary" disabled>Tạo hợp đồng</button></div></fieldset><p id="contract-create-feedback" role="alert"></p></form></section>`);
 const popup=document.getElementById('contract-create-popup'),form=popup.querySelector('form'),fieldset=form.querySelector('fieldset'),submit=form.querySelector('[type=submit]'),feedback=popup.querySelector('#contract-create-feedback'),catalogFeedback=popup.querySelector('#contract-create-catalog-feedback');
 let employees=[],types=[],employeesReady=!canEmployees,typesReady=false,busy=false;
 const modal=document.getElementById('modal'),closeButton=modal.querySelector('[data-action="close"]');
 const preventBusyClose=event=>{if(busy)event.preventDefault();};
 modal.addEventListener('cancel',preventBusyClose);
 modal.addEventListener('close',()=>modal.removeEventListener('cancel',preventBusyClose),{once:true});
 const current=()=>isPageCurrent()&&popup.isConnected&&document.getElementById('contract-create-popup')===popup&&document.getElementById('modal').open;
 const ready=()=>{submit.disabled=busy||!employeesReady||!typesReady;};
 function catalogError(key,err,retry){
  const previous=catalogFeedback.querySelector(`[data-catalog="${key}"]`);previous?.remove();
  const row=document.createElement('span');row.dataset.catalog=key;row.textContent=err.message+' ';
  if(retry){const button=document.createElement('button');button.type='button';button.className='btn';button.textContent='Thử lại';button.onclick=()=>{row.remove();retry();};row.append(button);}
  catalogFeedback.append(row);
 }
 function drawEmployees(){
  const selected=form.elements.employeeId.value||String(ownId||''),query=popup.querySelector('#contract-create-employee-search').value;
  const filtered=employees.filter(item=>!query||[item.fullName,item.employeeCode].some(value=>contractSearchText(value).includes(contractSearchText(query)))||String(item.id)===selected);
  form.elements.employeeId.innerHTML='<option value="">Chọn nhân viên</option>'+filtered.map(item=>`<option value="${e(item.id)}" ${String(item.id)===selected?'selected':''}>${e(item.employeeCode)} · ${e(item.fullName)}</option>`).join('');
  form.elements.employeeId.disabled=false;
 }
 async function loadEmployees(){
  try{
   const items=[];let page=1,total=Infinity;
   while(items.length<total){const result=await apiEmployees(new URLSearchParams({page,pageSize:100}).toString());if(!current())return;if(!Array.isArray(result?.data)||!Number.isInteger(result.total))throw Error('Danh sách nhân viên không hợp lệ.');items.push(...result.data);total=result.total;if(!result.data.length)break;page++;}
   employees=items;employeesReady=items.length>0;drawEmployees();ready();if(!employeesReady)catalogError('employees',Error('Không có nhân viên trong phạm vi được xem.'));
  }catch(err){if(current())catalogError('employees',err,loadEmployees);}
 }
 async function loadTypes(){
  if(!contractCatalogGrant('WEB_CONTRACT_TYPES')){catalogError('types',Error('Bạn cần quyền xem loại hợp đồng để chọn loại hợp đồng.'));return;}
  try{
   const items=await apiActiveContractTypes();if(!current())return;
   types=items.filter(item=>/^[A-Z][A-Z0-9]{0,19}$/.test(item.prefix||''));typesReady=types.length>0;
   form.elements.contractType.innerHTML='<option value="">Chọn loại hợp đồng</option>'+types.map(item=>`<option value="${e(item.code)}">${e(item.name)} · ${e(item.prefix)}</option>`).join('');form.elements.contractType.disabled=false;ready();
   if(!typesReady)catalogError('types',Error('Chưa có loại hợp đồng hoạt động có prefix hợp lệ. Cấu hình prefix tại Master Data.'));
  }catch(err){if(current())catalogError('types',err,loadTypes);}
 }
 popup.querySelector('#contract-create-employee-search')?.addEventListener('input',()=>{if(employeesReady)drawEmployees();});
 popup.querySelector('#contract-create-cancel').onclick=()=>{if(!busy)closeDialog();};
 form.onsubmit=async event=>{
  event.preventDefault();event.stopPropagation();if(busy)return;feedback.textContent='';
  try{
   if(!contractGrant('canNew'))throw Error('Bạn không có quyền tạo hợp đồng.');
   if(!employeesReady||!typesReady)throw Error('Vui lòng tải danh sách nhân viên và loại hợp đồng.');
   const values=Object.fromEntries(new FormData(form)),employeeId=Number(values.employeeId),employee=employees.find(item=>Number(item.id)===employeeId);
   if(!Number.isSafeInteger(employeeId)||employeeId<=0||canEmployees&&!employee)throw Error('Vui lòng chọn nhân viên hợp lệ.');
   if(!types.some(item=>item.code===values.contractType))throw Error('Vui lòng chọn loại hợp đồng có prefix hợp lệ.');
   const payload={employeeId,...contractPayload(values,{hireDate:employee?.hireDate})};
   busy=true;fieldset.disabled=true;if(closeButton)closeButton.disabled=true;submit.textContent='Đang tạo…';
   const saved=await apiCreateContract(payload);
   if(current()){closeDialog();toast(`Đã tạo hợp đồng · ${saved.contractNo}`);await onSaved(saved);}
  }catch(err){if(current())feedback.textContent=err.message;}
  finally{busy=false;if(current()){fieldset.disabled=false;if(closeButton)closeButton.disabled=false;submit.textContent='Tạo hợp đồng';ready();}}
 };
 if(canEmployees)loadEmployees();loadTypes();
}
