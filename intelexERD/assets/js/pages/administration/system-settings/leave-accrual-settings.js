import {apiLeaveAccrualSettings,apiRunLeaveAccrual,apiSession,apiActivePositions,apiWorkflowLeaveTypes} from '../../../api/client.js';
import {e} from '../../../utils.js';
import {field} from '../../../components/ui.js';

export function leaveAccrualGrant(flag,session=apiSession()){
 const has=(code,action)=>session?.permissions?.some(p=>p.platform==='WEB'&&p.code===code&&p.canView==='Y'&&p[action]==='Y');
 return !!has('WEB_SYSTEM_SETTINGS',flag);
}
export function firstLeaveCycle(schedule){
 if(!schedule)return null;
 const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(schedule.startDate||'');
 if(!match||!Number.isInteger(schedule.interval)||schedule.interval<1||schedule.interval>120||!['MONTH','YEAR'].includes(schedule.unit))throw Error('Lịch cần ngày mốc hợp lệ, chu kỳ từ 1 đến 120 tháng hoặc năm.');
 const date=new Date(schedule.startDate+'T00:00:00Z');
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==schedule.startDate)throw Error('Ngày mốc không hợp lệ.');
 const months=Number(match[1])*12+Number(match[2])-1+schedule.interval*(schedule.unit==='YEAR'?12:1),year=Math.floor(months/12),month=months%12;
 if(year>9999)throw Error('Ngày kích hoạt vượt giới hạn năm 9999.');
 const day=Math.min(Number(match[3]),new Date(Date.UTC(year,month+1,0)).getUTCDate());
 return `${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
export function validateLeaveAccrual(settings,original=null,today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),defaultLeaveTypeId=null){
 if(settings.scheduleVersion!==2||typeof settings.enabled!=='boolean')throw Error('Cấu hình lịch không hợp lệ.');
 if(settings.enabled&&!settings.accrualSchedule&&!settings.resetSchedule)throw Error('Chọn ít nhất một lịch khi bật tự động.');
 for(const key of ['accrualSchedule','resetSchedule']){
 const schedule=settings[key];if(schedule===null)continue;
 firstLeaveCycle(schedule);
 }
 if(!['ACTIVE_ON_DATE','ONE_MONTH'].includes(settings.newHireEligibility))throw Error('Điều kiện nhân viên mới không hợp lệ.');
 const defaultDays=settings.defaultDaysPerCycle===undefined?1:settings.defaultDaysPerCycle;
 if(!Number.isFinite(defaultDays)||defaultDays<=0||defaultDays>99999||Math.abs(defaultDays*100-Math.round(defaultDays*100))>1e-7)throw Error('Số ngày mặc định mỗi chu kỳ phải dương, tối đa 99999 và 2 chữ số thập phân.');
 if(!Array.isArray(settings.rules)||settings.rules.length>200)throw Error('Tối đa 200 quy tắc.');
 const pairs=new Set();
 for(const rule of settings.rules){
 if(!Number.isSafeInteger(rule.positionId)||rule.positionId<1||(rule.leaveTypeId!=null&&(!Number.isSafeInteger(rule.leaveTypeId)||rule.leaveTypeId<1)))throw Error('Chọn chức vụ và loại phép hợp lệ.');
 const days=rule.daysPerCycle;
 if((settings.accrualSchedule||days!=null)&&(!Number.isFinite(days)||days<=0||days>99999||Math.abs(days*100-Math.round(days*100))>1e-7))throw Error('Số ngày mỗi chu kỳ phải dương, tối đa 99999 và 2 chữ số thập phân.');
 const pair=`${rule.positionId}/${rule.leaveTypeId??defaultLeaveTypeId??'ANNUAL'}`;if(pairs.has(pair))throw Error('Trùng chức vụ và loại phép.');pairs.add(pair);
 }
 return settings;
}
export function leaveCycleFields(key,label,schedule){
 return `<section class="system-settings-location"><label class="role-toggle-row" style="flex-direction:row"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" name="${key}-enabled" ${schedule?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label><div class="form-grid">${field('Ngày mốc',key+'-startDate','date',schedule?.startDate||'')}${field('Chu kỳ',key+'-interval','number',schedule?.interval??'','min="1" max="120" step="1"')}<label>Đơn vị<select name="${key}-unit"><option value="MONTH" ${schedule?.unit==='MONTH'?'selected':''}>Tháng</option><option value="YEAR" ${schedule?.unit==='YEAR'?'selected':''}>Năm</option></select></label></div><p class="muted" data-cycle-preview="${key}"></p></section>`;
}
export async function mountLeaveAccrualSettings(root,options={}){
 if(!leaveAccrualGrant('canView')){root.innerHTML='<p>Bạn chưa có quyền xem WEB_SYSTEM_SETTINGS.</p>';return;}
 root.innerHTML='<p role="status">Đang tải cấu hình…</p>';
 try{
 const result=await apiLeaveAccrualSettings();if(!root.isConnected)return;
 if(!result?.settings||!Number.isSafeInteger(result.version)||result.version<0)throw Error('Cấu hình trả về không hợp lệ.');
 let version=result.version,original=result.version>0?result.settings:null,busy=false,dirty=false,sequence=0;
 const settings=result.settings,canUpdate=leaveAccrualGrant('canUpdate');
 const catalogs=await Promise.allSettled([apiActivePositions(),apiWorkflowLeaveTypes()]);if(!root.isConnected)return;
 const positions=catalogs[0].status==='fulfilled'?catalogs[0].value:[];
 const rawTypes=catalogs[1].status==='fulfilled'?catalogs[1].value:[];
 const types=(Array.isArray(rawTypes)?rawTypes:rawTypes?.data||rawTypes?.items||[]).filter(item=>item.isActive&&item.requiresBalance);
 const toggle=(name,label,value)=>`<label class="role-toggle-row" style="flex-direction:row"><span>${label}</span><span class="role-switch"><input type="checkbox" role="switch" name="${name}" ${value?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;
 root.innerHTML=`<form class="user-registration"><h2>Cấp/Thu hồi phép</h2><fieldset class="user-edit-fieldset" ${canUpdate?'':'disabled'}>${toggle('enabled','Tự động cấp và thu hồi phép',settings.enabled)}${settings.scheduleVersion!==2&&!settings.accrualSchedule&&!settings.resetSchedule?'<p role="status">Cấu hình cũ: hãy chọn lại ngày mốc và chu kỳ trước khi lưu chuyển sang lịch mới.</p>':''}${leaveCycleFields('accrualSchedule','Lịch cấp phép',settings.accrualSchedule)}${leaveCycleFields('resetSchedule','Lịch thu hồi phép',settings.resetSchedule)}<label>Điều kiện nhân viên mới<select name="newHireEligibility"><option value="ACTIVE_ON_DATE" ${settings.newHireEligibility==='ACTIVE_ON_DATE'?'selected':''}>Đã vào làm tại ngày đến hạn</option><option value="ONE_MONTH" ${settings.newHireEligibility==='ONE_MONTH'?'selected':''}>Đủ một tháng làm việc</option></select></label>${field('Số ngày cấp mặc định mỗi chu kỳ','defaultDaysPerCycle','number',settings.defaultDaysPerCycle??1,'required min="0.01" max="99999" step="0.01"')}<h3>Quy tắc cộng phép theo chức vụ</h3><div data-accrual-rules></div><button type="button" class="btn" data-accrual-add>Thêm quy tắc</button><div class="form-actions"><button class="btn primary" type="submit">Lưu cấu hình</button><button class="btn" type="button" data-accrual-run>Chạy lịch đến hạn</button></div></fieldset><p role="status" data-accrual-feedback>${canUpdate?'Chạy lịch sử dụng cấu hình đã lưu.':'Để lưu hoặc chạy lịch cần WEB_SYSTEM_SETTINGS/UPDATE.'}</p></form>`;
 const form=root.querySelector('form'),fieldset=form.querySelector('fieldset'),feedback=form.querySelector('[data-accrual-feedback]'),container=form.querySelector('[data-accrual-rules]'),add=form.querySelector('[data-accrual-add]'),run=form.querySelector('[data-accrual-run]');
 const readSchedule=key=>form.elements.namedItem(key+'-enabled').checked?{startDate:form.elements.namedItem(key+'-startDate').value,interval:Number(form.elements.namedItem(key+'-interval').value),unit:form.elements.namedItem(key+'-unit').value}:null;
 function preview(){for(const key of ['accrualSchedule','resetSchedule']){const schedule=readSchedule(key);for(const suffix of ['startDate','interval','unit']){const control=form.elements.namedItem(key+'-'+suffix);control.disabled=!schedule;control.required=!!schedule;}const target=form.querySelector(`[data-cycle-preview="${key}"]`);try{target.textContent=schedule?'Lần kích hoạt đầu tiên: '+firstLeaveCycle(schedule):'Không áp dụng lịch này.';}catch(err){target.textContent=err.message;}}}
 const markDirty=()=>{dirty=true;options.onDirty?.(true);run.disabled=true;preview();};form.oninput=form.onchange=markDirty;
 const choice=(label,name,value,items)=>items.length?`<label>${label}<select name="${name}" ${label==='Loại phép'?'':'required'}><option value="">${label==='Loại phép'?'Nghỉ phép năm (ANNUAL)':'Chọn '+label.toLowerCase()}</option>${value&&!items.some(item=>item.id===value)?`<option value="${e(value)}" selected>ID ${e(value)} (ngoài danh mục hiện tại)</option>`:''}${items.map(item=>`<option value="${e(item.id)}" ${item.id===value?'selected':''}>${e(item.name)}</option>`).join('')}</select></label>`:field(`${label} (ID)`,name,'number',value??'',`${label==='Loại phép'?'':'required'} min="1" step="1" placeholder="${label==='Loại phép'?'ANNUAL':''}"`);
 function addRule(rule={}){
 if(container.children.length>=200)return;const row=document.createElement('section'),prefix=`accrual-${sequence++}-`;row.className='system-settings-location';row.dataset.rulePrefix=prefix;
 row.innerHTML=`<div class="form-grid">${choice('Chức vụ',prefix+'positionId',rule.positionId,positions)}${choice('Loại phép',prefix+'leaveTypeId',rule.leaveTypeId,types)}${field('Số ngày cấp mỗi chu kỳ',prefix+'daysPerCycle','number',rule.daysPerCycle??rule.daysPerMonth??'','min="0.01" max="99999" step="0.01"')}</div><button type="button" class="btn danger">Xóa quy tắc</button>`;
 row.querySelector('button').onclick=()=>{if(busy)return;row.remove();add.disabled=false;markDirty();};container.appendChild(row);add.disabled=container.children.length>=200;
 }
 settings.rules.forEach(addRule);preview();add.onclick=()=>{if(!busy){addRule();markDirty();}};
 function setBusy(value){busy=value;fieldset.disabled=value||!canUpdate;options.onSaving?.(value);}
 form.onsubmit=async event=>{
 event.preventDefault();event.stopPropagation();if(busy||!canUpdate)return;
 const data=new FormData(form),payload={scheduleVersion:2,enabled:data.has('enabled'),defaultDaysPerCycle:Number(data.get('defaultDaysPerCycle')),accrualSchedule:readSchedule('accrualSchedule'),resetSchedule:readSchedule('resetSchedule'),newHireEligibility:data.get('newHireEligibility'),rules:[...container.children].map(row=>{const get=key=>data.get(row.dataset.rulePrefix+key);return {positionId:Number(get('positionId')),leaveTypeId:get('leaveTypeId')?Number(get('leaveTypeId')):null,daysPerCycle:get('daysPerCycle')?Number(get('daysPerCycle')):null};})};
 try{if(original&&original.scheduleVersion!==2&&!original.accrualSchedule&&!original.resetSchedule&&!payload.accrualSchedule&&!payload.resetSchedule)throw Error('Chọn ngày mốc và chu kỳ để chuyển cấu hình cũ sang lịch mới.');validateLeaveAccrual(payload,original,undefined,result.defaultLeaveTypeId);}catch(err){feedback.textContent=err.message;return;}
 setBusy(true);feedback.textContent='Đang lưu…';
 try{const saved=await apiLeaveAccrualSettings({version,settings:payload});if(!Number.isSafeInteger(saved?.version)||saved.version<0)throw Error('Chưa nhận được phiên bản mới; tải lại cấu hình trước khi lưu tiếp.');version=saved.version;original=saved.settings||payload;dirty=false;options.onDirty?.(false);feedback.textContent='Đã lưu cấu hình.';}
 catch(err){feedback.textContent=err.message+' Nếu phiên bản đã thay đổi, tải lại trang trước khi lưu lại.';}
 finally{setBusy(false);run.disabled=dirty;}
 };
 run.onclick=async()=>{
 if(busy||dirty||!canUpdate)return;setBusy(true);feedback.textContent='Đang chạy lịch đến hạn…';
 try{const result=await apiRunLeaveAccrual();feedback.textContent=`Ngày xử lý: ${result.asOfDate} · Đã cộng: ${result.creditedBalances} số dư · Đã thu hồi: ${result.expiredBalances} số dư${result.accrualAlreadyProcessed?' · Kỳ cộng đã xử lý':''}${result.resetAlreadyProcessed?' · Kỳ thu hồi đã xử lý':''}.`;}
 catch(err){feedback.textContent=err.message;}finally{setBusy(false);}
 };
 }catch(err){if(root.isConnected)root.innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button">Thử lại</button>`;root.querySelector('button')?.addEventListener('click',()=>mountLeaveAccrualSettings(root,options));}
}
