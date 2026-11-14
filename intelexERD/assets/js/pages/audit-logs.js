import {apiAuditLogs,apiAuditLogDetail,apiSession} from '../api/client.js';
import {e} from '../utils.js';
import {icon,field} from '../components/ui.js';

export const auditActionNames={SETTINGS_UPDATED:'Cập nhật cấu hình',SHIFT_SAVED:'Lưu ca làm việc',SCHEDULE_SAVED:'Lưu lịch phân ca',SCHEDULE_CANCELLED:'Hủy lịch phân ca',CHECK_IN:'Chấm công vào',CHECK_OUT:'Chấm công ra',ATTENDANCE_CLOSED:'Chốt chấm công',QR_SESSION_CREATED:'Tạo phiên QR',USER_CREATE:'Tạo tài khoản',USER_UPDATE:'Cập nhật tài khoản',USER_STATUS:'Đổi trạng thái tài khoản',USER_ROLES:'Cập nhật vai trò tài khoản',PASSWORD_RESET:'Đổi/đặt lại mật khẩu',ROLE_SAVE:'Lưu vai trò',ROLE_DELETE:'Xóa vai trò',PERMISSIONS_UPDATE:'Cập nhật phân quyền',SCREEN_SAVE:'Lưu màn hình',EMPLOYEE_CREATED:'Tạo hồ sơ nhân viên',EMPLOYEE_UPDATED:'Cập nhật hồ sơ nhân viên',EMPLOYEE_DEACTIVATED:'Ngừng hoạt động nhân viên',EMPLOYEE_DEPARTMENT_CHANGED:'Chuyển phòng ban',EMPLOYEE_TEAM_CHANGED:'Đổi team nhân viên',CONTRACT_CREATED:'Tạo hợp đồng',CONTRACT_UPDATED:'Cập nhật hợp đồng',TEAM_CREATED:'Tạo team',TEAM_UPDATED:'Cập nhật team',TEAM_DELETED:'Xóa team'};
const auditModules={System:'Hệ thống',User:'Tài khoản',Role:'Vai trò',Screen:'Màn hình',Employee:'Nhân viên',Contract:'Hợp đồng',Team:'Teams'};
export function auditTime(value){
 if(!value)return '—';
 const text=String(value),date=new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)?text:text+'Z');
 return Number.isNaN(date.getTime())?'Thời gian không hợp lệ':new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(date);
}
function auditSafeText(value){
 return value.replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,'[Đã ẩn]').replace(/\bBearer\s+\S+/gi,'Bearer [Đã ẩn]').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'[Đã ẩn]').replace(/((?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*)[^\s,;]+/gi,'$1[Đã ẩn]');
}
export function redactAudit(value){
 if(Array.isArray(value))return value.map(redactAudit);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>{
 const normalized=key.replace(/[^a-z0-9]/gi,'').toLowerCase();
 const sensitive=/(password|token|secret|credential|nonce|salt|hash|authorization|cookie|apikey|privatekey|accesskey|signingkey|encryptionkey|connectionstring)/.test(normalized)&&!['passwordhistorycount','disallowusernameinpassword'].includes(normalized);
 return [auditSafeText(key),sensitive?'[Đã ẩn]':redactAudit(item)];
 }));
 if(typeof value==='string'){
 if(/^[\[{]/.test(value.trim())){try{const parsed=JSON.parse(value);if(parsed&&typeof parsed==='object')return JSON.stringify(redactAudit(parsed));}catch{}}
 return auditSafeText(value);
 }
 return value;
}
const auditObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function auditCanonical(value){return JSON.stringify(auditObject(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,JSON.parse(auditCanonical(value[key]))])):Array.isArray(value)?value.map(item=>JSON.parse(auditCanonical(item))):value);}
export function auditChanges(before,after){
 if(!auditObject(before)||!auditObject(after))return null;
 const rows=[];
 function visit(left,right,path){
 const keys=new Set([...Object.keys(left),...Object.keys(right)]);
 for(const key of keys){
 const hasBefore=Object.hasOwn(left,key),hasAfter=Object.hasOwn(right,key),a=left[key],b=right[key],next=path+'/'+key.replaceAll('~','~0').replaceAll('/','~1');
 if(hasBefore&&hasAfter&&auditCanonical(a)===auditCanonical(b))continue;
 if(hasBefore&&hasAfter&&auditObject(a)&&auditObject(b))visit(a,b,next);
 else rows.push({path:next,hasBefore,hasAfter,before:hasBefore?a:undefined,after:hasAfter?b:undefined});
 }
 }
 visit(redactAudit(before),redactAudit(after),'');return rows;
}
export function auditQuery(values){
 const query=new URLSearchParams({page:values.page||1,pageSize:values.pageSize||30});
 for(const key of ['search','actorUserId','action','entityType','entityId'])if(values[key]?.trim())query.set(key,values[key].trim());
 let from=null,to=null;
 for(const [input,key] of [['from','fromUtc'],['to','toUtc']])if(values[input]){
 const date=new Date(values[input]+'+07:00');if(Number.isNaN(date.getTime()))throw Error('Khoảng thời gian không hợp lệ.');
 query.set(key,date.toISOString());if(input==='from')from=date;else to=date;
 }
 if(from&&to&&from>to)throw Error('Thời gian bắt đầu phải trước hoặc bằng thời gian kết thúc.');
 return query.toString();
}
function auditError(error){return error.status===401?'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':error.status===403?'Bạn không có quyền WEB_AUDIT_LOGS/VIEW hoặc quyền đã bị thu hồi.':error.status===404?'Không tìm thấy nhật ký này.':error.status===400?'Bộ lọc không hợp lệ. Vui lòng kiểm tra giá trị và khoảng thời gian.':'Không tải được nhật ký. Kiểm tra kết nối và thử lại.';}
function auditJson(value){return value===undefined?'Không có trường trong payload':JSON.stringify(value,null,2);}
export function auditPayloadView(before,after,raw=false){
 const safeBefore=redactAudit(before),safeAfter=redactAudit(after),rows=auditChanges(safeBefore,safeAfter);
 if(raw||rows===null)return `<p class="muted">${raw?'JSON từ API sau khi che dữ liệu nhạy cảm.':'Không có đủ hai object trước/sau để so sánh. Hiển thị đúng payload được trả về.'}</p><div class="audit-json-grid"><section><h3>BeforeJson</h3><pre>${e(auditJson(safeBefore))}</pre></section><section><h3>AfterJson</h3><pre>${e(auditJson(safeAfter))}</pre></section></div>`;
 return `<p class="muted">So sánh các trường trong payload; dữ liệu có thể chỉ là metadata, không phải toàn bộ hồ sơ. Trường nhạy cảm đã được che.</p>${rows.length?`<div class="table-wrap"><table class="audit-diff"><thead><tr><th>Trường (JSON Pointer)</th><th>Trước</th><th>Sau</th></tr></thead><tbody>${rows.map(row=>`<tr><td><code>${e(row.path)}</code></td><td><pre>${e(row.hasBefore?auditJson(row.before):'Không có trường')}</pre></td><td><pre>${e(row.hasAfter?auditJson(row.after):'Không có trường')}</pre></td></tr>`).join('')}</tbody></table></div>`:'<p>Không có khác biệt trong các trường có thể hiển thị. Có thể xem Raw JSON để đối chiếu payload.</p>'}`;
}
export async function mountAuditLogs(root){
 if(!root)return;
 const allowed=()=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_AUDIT_LOGS'&&p.canView==='Y');
 if(!allowed()){root.innerHTML='<p role="alert">Bạn không có quyền WEB_AUDIT_LOGS/VIEW.</p>';return;}
 let values={page:1,pageSize:30},generation=0,detailGeneration=0;
 root.innerHTML=`<form id="audit-filters" class="audit-filters"><div class="form-grid">${field('Tìm kiếm','search','search','','maxlength="150" placeholder="Người thực hiện, thao tác hoặc đối tượng"')}${field('Người thực hiện (khớp chính xác)','actorUserId','text','','maxlength="100"')}<label>Action Code (khớp chính xác)<input name="action" list="audit-actions" maxlength="100"><datalist id="audit-actions">${Object.entries(auditActionNames).map(([code,label])=>`<option value="${code}">${label}</option>`).join('')}</datalist></label>${field('EntityType (khớp chính xác)','entityType','text','','maxlength="100"')}${field('EntityId (khớp chính xác)','entityId','text','','maxlength="60"')}${field('Từ thời điểm (giờ Việt Nam)','from','datetime-local','','')}${field('Đến thời điểm (giờ Việt Nam)','to','datetime-local','','')}<label>Số dòng mỗi trang<select name="pageSize"><option>10</option><option selected>30</option><option>50</option><option>100</option></select></label></div><div class="toolbar"><button type="submit" class="btn primary">Tìm kiếm / Lọc</button><button type="button" class="btn" id="audit-clear">Xóa bộ lọc</button></div><p class="muted">Thời gian hiển thị theo Asia/Ho_Chi_Minh (UTC+7). Tìm kiếm không bao gồm nội dung JSON.</p><p id="audit-filter-error" role="alert"></p></form><div id="audit-list" aria-live="polite"></div><dialog class="audit-drawer" aria-labelledby="audit-detail-title"><div class="audit-drawer-header"><h2 id="audit-detail-title">Chi tiết nhật ký</h2><button type="button" class="icon-button" data-audit-close aria-label="Đóng chi tiết">${icon('close')}</button></div><div id="audit-detail" class="audit-drawer-body"></div></dialog>`;
 const form=root.querySelector('form'),list=root.querySelector('#audit-list'),drawer=root.querySelector('dialog'),detail=root.querySelector('#audit-detail'),filterError=root.querySelector('#audit-filter-error');let returnFocus=null;
 function close(){detailGeneration++;drawer.close();detail.replaceChildren();returnFocus?.isConnected&&returnFocus.focus();}
 drawer.querySelector('[data-audit-close]').onclick=close;drawer.addEventListener('cancel',ev=>{ev.preventDefault();close();});drawer.addEventListener('click',ev=>{if(ev.target===drawer&&ev.clientX<drawer.getBoundingClientRect().left)close();});
 async function showDetail(id,trigger){
 const current=++detailGeneration;returnFocus=trigger;detail.innerHTML='<p role="status">Đang tải chi tiết…</p>';if(!drawer.open)drawer.showModal();
 try{
 if(!allowed())throw Object.assign(Error(),{status:403});
 const raw=await apiAuditLogDetail(id);if(!drawer.isConnected||!drawer.open||current!==detailGeneration)return;
 const item=redactAudit(raw);
 detail.innerHTML=`<dl class="audit-metadata">${[['ID nhật ký',item.id],['ActorUserId',item.actorUserId??null],['Action',item.action],['EntityType',item.entityType],['EntityId',item.entityId],['CreatedAt',auditTime(item.createdAt)+' (Asia/Ho_Chi_Minh)']].map(([label,value])=>`<div><dt>${label}</dt><dd>${e(value===null?'null':value??'Không có trường')}</dd></div>`).join('')}</dl><p>${e(auditActionNames[item.action]||'Thao tác chưa có bản dịch')}</p><div class="tabs audit-detail-tabs" role="tablist" aria-label="Hiển thị payload"><button type="button" class="tab active" role="tab" aria-selected="true" data-audit-mode="compare">So sánh trường</button><button type="button" class="tab" role="tab" aria-selected="false" data-audit-mode="raw">Raw JSON</button></div><div id="audit-payload" role="tabpanel"></div>`;
 const panel=detail.querySelector('#audit-payload');panel.innerHTML=auditPayloadView(item.beforeJson,item.afterJson);
 detail.querySelectorAll('[data-audit-mode]').forEach(button=>button.onclick=()=>{detail.querySelectorAll('[data-audit-mode]').forEach(tab=>{tab.classList.toggle('active',tab===button);tab.setAttribute('aria-selected',String(tab===button));});panel.innerHTML=auditPayloadView(item.beforeJson,item.afterJson,button.dataset.auditMode==='raw');});
 }catch(err){if(drawer.isConnected&&drawer.open&&current===detailGeneration){detail.innerHTML=`<p role="alert">${auditError(err)}</p><button class="btn" id="audit-detail-retry">Thử lại</button>`;detail.querySelector('button').onclick=()=>showDetail(id,trigger);}}
 }
 async function load(){
 const current=++generation;list.innerHTML='<p role="status">Đang tải nhật ký…</p>';
 try{
 if(!allowed())throw Object.assign(Error(),{status:403});
 const result=await apiAuditLogs(auditQuery(values));if(!list.isConnected||current!==generation)return;
 if(!Array.isArray(result?.data)||!Number.isFinite(result.total))throw Error('Invalid response');
 list.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Phân hệ</th><th>Đối tượng</th><th>Chi tiết</th></tr></thead><tbody>${result.data.map(raw=>{const item=redactAudit(raw);return `<tr><td>${e(auditTime(item.createdAt))}</td><td>${e(item.actorUserId??'Không có người thực hiện (null)')}</td><td><strong>${e(auditActionNames[item.action]||'Thao tác chưa có bản dịch')}</strong><code class="audit-action-code">${e(item.action)}</code></td><td>${e(auditModules[item.entityType]||item.entityType)}</td><td>${e(item.entityType)} · ${e(item.entityId)}</td><td><button type="button" class="btn small" data-audit-id="${e(item.id)}">Xem chi tiết</button></td></tr>`;}).join('')}</tbody></table></div>${result.data.length?'':'<div class="empty"><h3>Không có nhật ký phù hợp</h3><p>Thử thay đổi hoặc xóa bộ lọc.</p></div>'}<div class="toolbar user-pagination"><button class="btn" id="audit-prev" ${values.page<=1?'disabled':''}>Trang trước</button><span>Trang ${values.page} / ${Math.max(1,Math.ceil(result.total/values.pageSize))} · ${result.total} nhật ký</span><button class="btn" id="audit-next" ${values.page*values.pageSize>=result.total?'disabled':''}>Trang sau</button></div>`;
 list.querySelectorAll('[data-audit-id]').forEach(button=>button.onclick=()=>showDetail(button.dataset.auditId,button));list.querySelector('#audit-prev').onclick=()=>{values.page--;load();};list.querySelector('#audit-next').onclick=()=>{values.page++;load();};
 }catch(err){if(list.isConnected&&current===generation){list.innerHTML=`<p role="alert">${auditError(err)}</p><button class="btn" id="audit-retry">Thử lại</button>`;list.querySelector('button').onclick=load;}}
 }
 form.onsubmit=ev=>{ev.preventDefault();ev.stopPropagation();const next={...Object.fromEntries(new FormData(form)),page:1};next.pageSize=Number(next.pageSize);try{auditQuery(next);filterError.textContent='';values=next;load();}catch(err){filterError.textContent=err.message;}};
 root.querySelector('#audit-clear').onclick=()=>{form.reset();filterError.textContent='';values={page:1,pageSize:30};load();};
 await load();
}
