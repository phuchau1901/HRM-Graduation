import {apiSession,apiWorkflowList,apiWorkflowDetail,apiCreateWorkflow,apiWorkflowAction,apiWorkflowLeaveTypes} from '../../api/client.js';
import {openDialog,closeDialog,toast} from '../../components/dialog.js';
import {e,dateLabel} from '../../utils.js';
import {field,details} from '../../components/ui.js';

export const approvalTabs={all:{label:'Tất cả',screen:'WEB_APPROVALS'},leave:{label:'Nghỉ phép',screen:'WEB_LEAVE_REQUESTS'},overtime:{label:'Tăng ca',screen:'WEB_OVERTIME_REQUESTS'},adjustment:{label:'Điều chỉnh công',screen:'WEB_ATTENDANCE_ADJUSTMENTS'}};
export const workflowStatuses={PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Từ chối',CANCELLED:'Đã hủy',CANCELLATION_PENDING:'Chờ duyệt hủy'};
export function workflowGrant(kind,flag='canView',session=apiSession()){
 const code=approvalTabs[kind]?.screen;
 return !!session?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y'&&p[flag]==='Y');
}
export function visibleApprovalTabs(session=apiSession()){return Object.keys(approvalTabs).filter(kind=>workflowGrant(kind,'canView',session));}
const workflowTime=value=>{if(!value)return '—';const text=String(value),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'Z');return Number.isNaN(date.getTime())?'—':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short',hour12:false}).format(date);};
export function workflowCreatePayload(kind,values){
 const reason=String(values.reason||'').trim();if(!reason||reason.length>1000)throw Error('Lý do bắt buộc, tối đa 1000 ký tự.');
 const positive=value=>{const number=Number(value);if(!Number.isSafeInteger(number)||number<=0)throw Error('Vui lòng chọn bản ghi hợp lệ.');return number;};
 const date=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error('Ngày không hợp lệ.');return value;};
 const time=value=>{if(!value)return null;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value))throw Error('Ngày giờ không hợp lệ.');date(value.slice(0,10));const match=value.slice(11).split(':').map(Number);if(match[0]>23||match[1]>59||(match[2]||0)>59)throw Error('Ngày giờ không hợp lệ.');return value+(value.length===16?':00':'')+'+07:00';};
 if(kind==='leave'){const fromDate=date(values.fromDate),toDate=date(values.toDate);if(toDate<fromDate)throw Error('Ngày kết thúc không được trước ngày bắt đầu.');return {leaveTypeId:positive(values.leaveTypeId),fromDate,toDate,reason};}
 if(kind==='overtime'){const startAt=time(values.startAt),endAt=time(values.endAt);if(!startAt||!endAt||Date.parse(endAt)<=Date.parse(startAt))throw Error('Giờ kết thúc phải sau giờ bắt đầu.');return {startAt,endAt,reason};}
 if(kind==='adjustment'){const proposedCheckIn=time(values.proposedCheckIn),proposedCheckOut=time(values.proposedCheckOut);if(!proposedCheckIn&&!proposedCheckOut)throw Error('Nhập ít nhất một giờ chấm công đề nghị.');if(proposedCheckIn&&proposedCheckOut&&Date.parse(proposedCheckOut)<=Date.parse(proposedCheckIn))throw Error('Giờ ra phải sau giờ vào.');return {attendanceId:positive(values.attendanceId),proposedCheckIn,proposedCheckOut,reason};}
 throw Error('Loại yêu cầu không hợp lệ.');
}
export function workflowCanCancel(kind,item,session=apiSession()){
 return !!session?.user?.employeeId&&kind!=='all'&&workflowGrant(kind,'canUpdate',session)&&String(item.employeeId)===String(session?.user?.employeeId)&&((kind==='leave'&&item.status==='APPROVED')||item.status==='PENDING');
}
function workflowPeriod(kind,item){return kind==='leave'?`${dateLabel(item.fromDate)} – ${dateLabel(item.toDate)}`:kind==='overtime'?`${workflowTime(item.startAt)} – ${workflowTime(item.endAt)}`:kind==='adjustment'?`${workflowTime(item.proposedCheckIn)} – ${workflowTime(item.proposedCheckOut)}`:workflowTime(item.createdAt);}
export function workflowRows(kind,items){return items.map((item,index)=>`<tr><td>${e(item.employeeName||`Nhân viên #${item.employeeId||'—'}`)}</td><td>${e(kind==='leave'?item.leaveTypeName:kind==='all'?({LEAVE:'Nghỉ phép',LEAVE_CANCELLATION:'Hủy nghỉ phép',OVERTIME:'Tăng ca',ATTENDANCE_ADJUSTMENT:'Điều chỉnh công'})[item.requestType]||item.requestType:approvalTabs[kind].label)}</td><td class="organization-description">${e(item.reason||'—')}</td><td>${e(workflowPeriod(kind,item))}</td><td><span class="badge ${item.status==='APPROVED'?'active':''}">${e(workflowStatuses[item.status]||item.status)}</span></td><td><button type="button" class="btn small" data-workflow-detail="${index}">Chi tiết</button></td></tr>`).join('');}

export function openWorkflowCreate(type,onCreated=async()=>{}){
  if(!workflowGrant(type,'canNew'))return;
  openDialog('Tạo yêu cầu '+approvalTabs[type].label.toLowerCase(),`<form id="workflow-create-form" class="user-registration"><fieldset class="user-edit-fieldset"><div class="form-grid">${type==='leave'?`<label>Loại nghỉ phép<select name="leaveTypeId" required disabled><option value="">Đang tải loại nghỉ phép…</option></select></label>${field('Từ ngày','fromDate','date','','required')}${field('Đến ngày','toDate','date','','required')}`:type==='overtime'?`${field('Bắt đầu tăng ca','startAt','datetime-local','','required')}${field('Kết thúc tăng ca','endAt','datetime-local','','required')}`:`${field('ID bản ghi chấm công','attendanceId','number','','required min="1" step="1"')}${field('Giờ vào đề nghị','proposedCheckIn','datetime-local','')}${field('Giờ ra đề nghị','proposedCheckOut','datetime-local','')}`}<label class="full">Lý do<textarea name="reason" required maxlength="1000"></textarea></label></div><div class="form-actions"><button type="button" class="btn" data-workflow-cancel>Hủy</button><button class="btn primary" type="submit">Gửi yêu cầu</button></div></fieldset><p id="workflow-create-error" role="alert"></p></form>`);
  const form=document.getElementById('workflow-create-form'),feedback=form.querySelector('[role=alert]'),fieldset=form.querySelector('fieldset');let busy=false,types=[];
  form.querySelector('[data-workflow-cancel]').onclick=()=>{if(!busy)closeDialog();};
  if(type==='leave'){
   const loadTypes=async()=>{try{let page=1,total=Infinity;types=[];while(types.length<total){const response=await apiWorkflowLeaveTypes(new URLSearchParams({page,pageSize:100}).toString());if(!form.isConnected)return;if(!Array.isArray(response?.data))throw Error('Danh sách loại nghỉ phép không hợp lệ.');types.push(...response.data);total=response.total;if(!response.data.length)break;page++;}const select=form.elements.leaveTypeId;select.innerHTML='<option value="">Chọn loại nghỉ phép</option>'+types.filter(item=>item.isActive).map(item=>`<option value="${e(item.id)}">${e(item.name)}</option>`).join('');select.disabled=false;feedback.textContent='';}catch(err){if(form.isConnected){feedback.innerHTML=`${e(err.message)} <button type="button" class="btn">Thử lại</button>`;feedback.querySelector('button')?.addEventListener('click',loadTypes);}}};
   loadTypes();
  }
  form.onsubmit=async event=>{
   event.preventDefault();event.stopPropagation();if(busy)return;
   try{if(!workflowGrant(type,'canNew'))throw Error('Bạn không có quyền tạo yêu cầu này.');const payload=workflowCreatePayload(type,Object.fromEntries(new FormData(form)));if(type==='leave'&&!types.some(item=>item.isActive&&Number(item.id)===payload.leaveTypeId))throw Error('Chọn loại nghỉ phép đang hoạt động.');busy=true;fieldset.disabled=true;await apiCreateWorkflow(type,payload);if(form.isConnected){closeDialog();toast('Đã gửi yêu cầu');await onCreated();}}
   catch(err){if(form.isConnected)feedback.textContent=err.message;}
   finally{busy=false;if(form.isConnected)fieldset.disabled=false;}
  };
 }

export async function mountApprovals(root,filters={},options={}){
 if(!root)return;
 const tabs=options.kind?(workflowGrant(options.kind)?[options.kind]:[]):visibleApprovalTabs();if(!tabs.length){root.innerHTML='<p>Bạn chưa có quyền xem yêu cầu hoặc phê duyệt.</p>';return;}
 let kind=tabs.includes(filters.tab)?filters.tab:tabs[0],page=1,status='',view=options.own?'MY':'ALL',generation=0;
 async function list(){
  const current=++generation;root.innerHTML='<p role="status">Đang tải yêu cầu…</p>';
  try{
   if(!workflowGrant(kind))throw Error('Bạn chưa có quyền xem loại yêu cầu này.');
   const query=new URLSearchParams({page,pageSize:20,view});if(status)query.set('status',status);
   const result=await apiWorkflowList(kind,query.toString());if(!root.isConnected||current!==generation)return;
   if(!Array.isArray(result?.data))throw Error('Danh sách yêu cầu không hợp lệ.');
   root.innerHTML=`${options.kind?'':`<div class="tabs" role="tablist" aria-label="Loại yêu cầu">${tabs.map(key=>`<button type="button" role="tab" aria-selected="${key===kind}" class="tab ${key===kind?'active':''}" data-workflow-tab="${key}">${approvalTabs[key].label}</button>`).join('')}</div>`}<form class="toolbar" id="workflow-filters">${options.own?'':`<select name="view" aria-label="Phạm vi yêu cầu">${[['ALL','Trong phạm vi được phép'],['MY','Của tôi'],['TEAM','Cùng phòng ban']].map(([value,label])=>`<option value="${value}" ${value===view?'selected':''}>${label}</option>`).join('')}</select>`}<select name="status" aria-label="Trạng thái yêu cầu"><option value="">Tất cả trạng thái</option>${Object.entries(workflowStatuses).map(([value,label])=>`<option value="${value}" ${value===status?'selected':''}>${label}</option>`).join('')}</select><button class="btn">Lọc</button>${kind!=='all'&&workflowGrant(kind,'canNew')?'<button type="button" class="btn primary" id="workflow-create">Tạo yêu cầu</button>':''}</form><div class="table-wrap"><table><thead><tr><th>Người gửi</th><th>Loại yêu cầu</th><th>Lý do</th><th>Thời gian</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>${workflowRows(kind,result.data)}</tbody></table></div>${result.data.length?'':'<p>Không có yêu cầu phù hợp.</p>'}<div class="toolbar user-pagination"><button type="button" class="btn" id="workflow-prev" ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} yêu cầu</span><button type="button" class="btn" id="workflow-next" ${page*20>=result.total?'disabled':''}>Trang sau</button></div>`;
   root.querySelectorAll('[data-workflow-tab]').forEach(button=>button.onclick=()=>{kind=button.dataset.workflowTab;page=1;status='';view='ALL';list();});
   const form=root.querySelector('#workflow-filters');form.onsubmit=event=>{event.preventDefault();event.stopPropagation();view=options.own?'MY':form.elements.view.value;status=form.elements.status.value;page=1;list();};
   root.querySelector('#workflow-prev').onclick=()=>{page--;list();};root.querySelector('#workflow-next').onclick=()=>{page++;list();};
   root.querySelector('#workflow-create')?.addEventListener('click',()=>openWorkflowCreate(kind,()=>{if(root.isConnected)return list();}));
   root.querySelectorAll('[data-workflow-detail]').forEach(button=>button.onclick=()=>detail(kind,result.data[Number(button.dataset.workflowDetail)]));
  }catch(err){if(root.isConnected&&current===generation){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=list;}}
 }
 async function detail(type,row){
  if(!workflowGrant(type))return;
  openDialog('Chi tiết yêu cầu','<div id="workflow-detail"><p role="status">Đang tải…</p></div>');const panel=document.getElementById('workflow-detail');
  try{
   const data=type==='adjustment'?row:await apiWorkflowDetail(type,row.id);if(!panel.isConnected)return;
   const item=type==='all'?data.request:data;
   const pairs=[['Người gửi',e(item.employeeName||`Nhân viên #${item.employeeId||'—'}`)],['Trạng thái',e(workflowStatuses[item.status]||item.status)],['Lý do',e(item.reason||data.details?.reason||'—')],['Thời gian',e(workflowPeriod(type,item))]];
   if(type==='leave')pairs.push(['Loại nghỉ phép',e(item.leaveTypeName)],['Số ngày',e(item.requestedDays)]);
   if(type==='overtime')pairs.push(['Số giờ đề nghị',e(item.requestedHours)],['Số giờ được duyệt',e(item.approvedHours??'—')]);
   if(type==='adjustment')pairs.push(['ID chấm công',e(item.attendanceId)]);
   const currentStep=type==='all'?data.steps?.find(step=>Number(step.stepNo)===Number(item.currentStepNo)&&step.approverUserId===apiSession()?.user?.userId&&step.decision==='PENDING'):null;
   const canDecide=type==='all'&&workflowGrant('all','canApprove')&&currentStep&&['PENDING','CANCELLATION_PENDING'].includes(item.status),canCancel=workflowCanCancel(type,item);
   panel.innerHTML=`${details(pairs)}${type==='all'?`<h3>Tiến trình duyệt</h3>${(data.steps||[]).map(step=>`<p>Bước ${e(step.stepNo)} · ${e(step.approverUserId)} · ${e(workflowStatuses[step.decision]||step.decision)}${step.comment?` · ${e(step.comment)}`:''}</p>`).join('')}`:''}${canCancel||canDecide?`<form id="workflow-action-form"><label>Lý do<textarea name="reason" required maxlength="1000"></textarea></label><div class="form-actions">${canCancel?'<button class="btn danger" name="action" value="cancel">Hủy yêu cầu</button>':'<button class="btn danger" name="action" value="reject">Từ chối</button><button class="btn primary" name="action" value="approve">Phê duyệt</button>'}</div><p role="alert"></p></form>`:''}`;
   const form=panel.querySelector('form');if(!form)return;let busy=false;
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();if(busy)return;
    const feedback=form.querySelector('[role=alert]');
    try{const action=event.submitter?.value;if(action==='cancel'?!workflowCanCancel(type,item):!canDecide||!workflowGrant('all','canApprove'))throw Error('Bạn không có quyền thực hiện thao tác này.');const reason=form.elements.reason.value.trim();if(!reason)throw Error('Vui lòng nhập lý do.');busy=true;form.querySelectorAll('button,textarea').forEach(control=>control.disabled=true);await apiWorkflowAction(type,item.id,action,{version:item.version,reason});if(panel.isConnected&&root.isConnected){closeDialog();toast('Đã cập nhật yêu cầu');await list();}}
    catch(err){if(panel.isConnected)feedback.textContent=err.message;}
    finally{busy=false;if(panel.isConnected)form.querySelectorAll('button,textarea').forEach(control=>control.disabled=false);}
   };
  }catch(err){if(panel.isConnected)panel.innerHTML=`<p role="alert">${e(err.message)}</p>`;}
 }
 await list();
}
