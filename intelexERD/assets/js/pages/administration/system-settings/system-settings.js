import {mountLeaveAccrualSettings} from './leave-accrual-settings.js';
import {mountApprovalWorkflowSettings} from './approval-workflow-settings.js';
import {apiSystemSettings,apiSession} from '../../../api/client.js';
import {e} from '../../../utils.js';
import {field,icon} from '../../../components/ui.js';

export const systemSettingTabs={'password-policy':'Chính sách mật khẩu',attendance:'Chấm công','leave-accrual':'Cấp/Thu hồi phép','approval-workflow':'Quy trình phê duyệt'};
const passwordSettingFlags=[['requireUppercase','Yêu cầu chữ hoa'],['requireLowercase','Yêu cầu chữ thường'],['requireDigit','Yêu cầu chữ số'],['requireSpecialCharacter','Yêu cầu ký tự đặc biệt'],['disallowUsernameInPassword','Không cho chứa tên đăng nhập']];
const attendanceSettingFlags=[['requireQr','Yêu cầu mã QR'],['requireGps','Yêu cầu vị trí GPS'],['allowOvernightShifts','Cho phép ca qua đêm']];
const attendanceSettingNumbers=[['checkInBeforeStartMinutes','Cho phép check-in trước giờ bắt đầu (phút)',1440],['checkInAfterStartMinutes','Cho phép check-in sau giờ bắt đầu (phút)',1440],['checkOutBeforeEndMinutes','Cho phép check-out trước giờ kết thúc (phút)',1440],['checkOutAfterEndMinutes','Cho phép check-out sau giờ kết thúc (phút)',1440],['lateGraceMinutes','Thời gian đi trễ được bỏ qua (phút)',240],['earlyLeaveGraceMinutes','Thời gian về sớm được bỏ qua (phút)',240]];
const missingPunchRules=['REJECT_CHECKOUT_WITHOUT_CHECKIN','INCOMPLETE'];
function systemSettingsGrant(flag){return apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_SYSTEM_SETTINGS'&&p.canView==='Y'&&p[flag]==='Y');}
export function validateSystemSettings(kind,settings){
 const integer=(key,min,max)=>{if(!Number.isInteger(settings[key])||settings[key]<min||settings[key]>max)throw Error(`${key} phải là số nguyên từ ${min} đến ${max}.`);};
 const boolean=key=>{if(typeof settings[key]!=='boolean')throw Error(`${key} phải là giá trị bật/tắt.`);};
 if(kind==='password-policy'){
 integer('minimumLength',1,1024);integer('maximumLength',1,1024);integer('passwordHistoryCount',0,100);
 passwordSettingFlags.forEach(([key])=>boolean(key));
 if(settings.minimumLength>settings.maximumLength)throw Error('Độ dài tối thiểu không được lớn hơn độ dài tối đa.');
 const groups=passwordSettingFlags.slice(0,4).filter(([key])=>settings[key]).length;
 if(settings.maximumLength<groups)throw Error('Độ dài tối đa phải đủ cho số nhóm ký tự bắt buộc.');
 }else if(kind==='attendance'){
 if(typeof settings.timezone!=='string'||!settings.timezone.trim())throw Error('Vui lòng nhập múi giờ.');
 attendanceSettingNumbers.forEach(([key,,max])=>integer(key,0,max));attendanceSettingFlags.forEach(([key])=>boolean(key));
 if(!Array.isArray(settings.workingDays)||!settings.workingDays.length||new Set(settings.workingDays).size!==settings.workingDays.length||settings.workingDays.some(day=>!Number.isInteger(day)||day<1||day>7))throw Error('Chọn ít nhất một ngày làm việc hợp lệ, không trùng.');
 if(!missingPunchRules.includes(settings.missingPunchRule))throw Error('Quy tắc thiếu lượt chấm công không hợp lệ.');
 const holidays=settings.holidayDates??[];
 if(!Array.isArray(holidays)||holidays.length>3660||holidays.some(day=>typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number.isNaN(Date.parse(day))||new Date(day).toISOString().slice(0,10)!==day))throw Error('Ngày lễ phải có định dạng YYYY-MM-DD hợp lệ, tối đa 3660 ngày.');
 if(!Array.isArray(settings.locations)||settings.locations.length>20)throw Error('Cho phép tối đa 20 địa điểm.');
 if((settings.requireQr||settings.requireGps)&&!settings.locations.length)throw Error('Cần ít nhất một địa điểm khi bật QR hoặc GPS.');
 const codes=new Set();
 for(const location of settings.locations){
 if(typeof location.code!=='string'||!location.code.trim()||location.code.length>50||location.code!==location.code.toUpperCase()||codes.has(location.code))throw Error('Mã địa điểm phải viết hoa, không trùng và dài tối đa 50 ký tự.');
 codes.add(location.code);
 if(typeof location.name!=='string'||!location.name.trim()||location.name.length>150)throw Error('Tên địa điểm phải có từ 1 đến 150 ký tự.');
 for(const [key,min,max] of [['latitude',-90,90],['longitude',-180,180],['radiusMeters',10,10000]])if(!Number.isFinite(location[key])||location[key]<min||location[key]>max)throw Error(`${key} của địa điểm phải từ ${min} đến ${max}.`);
 }
 }else throw Error('Loại cấu hình không hợp lệ.');
 return settings;
}
function systemSettingToggle(key,label,value){return `<label class="role-toggle-row"><span>${label}</span><span class="role-switch"><input name="${key}" type="checkbox" role="switch" ${value?'checked':''}><span class="role-switch-track" aria-hidden="true"></span></span></label>`;}
function systemSettingNumber(label,key,value,min,max){return field(label,key,'number',value,`required min="${min}" max="${max}" step="1"`);}
export function passwordPolicySelect(label,key,value,choices,unit){
 const values=[...new Set([...choices,value])].sort((a,b)=>a-b);
 return `<label>${label}<select name="${key}">${values.map(option=>`<option value="${option}" ${option===value?'selected':''}>${option} ${unit}</option>`).join('')}</select></label>`;
}
export async function mountSystemSettings(root,filters={},options={}){
 if(!root)return;
 const tabs=options.embedded?{attendance:'Chấm công'}:systemSettingTabs;
 let tab=tabs[filters.tab]?filters.tab:Object.keys(tabs).find(key=>apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code===(key==='approval-workflow'?'WEB_APPROVAL_SETTINGS':'WEB_SYSTEM_SETTINGS')&&p.canView==='Y'))||Object.keys(tabs)[0],generation=0,saving=false,dirty=false;
 async function load(){
 const current=++generation,kind=tab;dirty=false;options.onDirty?.(false);
 root.innerHTML=`<div class="tabs" role="tablist" aria-label="Cấu hình hệ thống">${Object.entries(tabs).map(([key,label])=>`<button type="button" role="tab" class="tab ${key===kind?'active':''}" aria-selected="${key===kind}" data-system-tab="${key}">${label}</button>`).join('')}</div><div id="system-settings-panel" role="tabpanel"><p role="status">Đang tải cấu hình…</p></div>`;
 root.querySelectorAll('[data-system-tab]').forEach(button=>button.onclick=()=>{if(saving||button.dataset.systemTab===tab)return;if(dirty&&!confirm('Bỏ các thay đổi cấu hình chưa lưu?'))return;tab=button.dataset.systemTab;load();});
 if(options.embedded)root.querySelector('[role=tablist]').remove();
 const panel=root.querySelector('#system-settings-panel');
 if(kind==='approval-workflow'||kind==='leave-accrual'){await (kind==='leave-accrual'?mountLeaveAccrualSettings:mountApprovalWorkflowSettings)(panel,{onDirty:value=>{if(panel.isConnected){dirty=value;options.onDirty?.(value);}},onSaving:value=>{if(panel.isConnected){saving=value;options.onSaving?.(value);root.querySelectorAll('[data-system-tab]').forEach(button=>button.disabled=value);}}});return;}

 try{
 if(!systemSettingsGrant('canView'))throw Error('Bạn chưa có quyền xem WEB_SYSTEM_SETTINGS.');
 const result=await apiSystemSettings(kind);if(!root.isConnected||current!==generation)return;
 if(!result?.settings||!Number.isSafeInteger(result.version)||result.version<1)throw Error('Cấu hình hoặc phiên bản trả về không hợp lệ.');
 let version=result.version,locationSequence=0;
 const settings=result.settings,canUpdate=systemSettingsGrant('canUpdate');
 panel.innerHTML=`<form id="system-settings-form" class="user-registration ${kind==='password-policy'?'password-policy-card':''}">${kind==='password-policy'?`<div class="password-policy-heading"><div><h2>Password Policy</h2><p>Chính sách mật khẩu hệ thống</p></div>${icon('shield',18)}</div>`:''}<fieldset class="user-edit-fieldset" ${canUpdate?'':'disabled'}>${kind==='password-policy'?`<div class="form-grid">${passwordPolicySelect('Độ dài tối thiểu','minimumLength',settings.minimumLength,[8,10,12,14,16],'ký tự')}${passwordPolicySelect('Độ dài tối đa','maximumLength',settings.maximumLength,[32,64,128],'ký tự')}</div><div class="system-settings-switches">${passwordSettingFlags.map(([key,label])=>`<label class="password-policy-check"><span>${label}</span><input type="checkbox" name="${key}" ${settings[key]?'checked':''}><span class="password-policy-checkmark" aria-hidden="true">✓</span></label>`).join('')}</div>${passwordPolicySelect('Không được trùng mật khẩu gần nhất','passwordHistoryCount',settings.passwordHistoryCount,[0,1,3,5,10],'mật khẩu')}<p class="muted">Áp dụng khi tạo hoặc đổi mật khẩu. Mật khẩu hiện có vẫn giữ hiệu lực. Đặt số mật khẩu ghi nhớ bằng 0 để tắt kiểm tra lịch sử.</p>`:`<div class="form-grid">${field('Múi giờ','timezone','text',settings.timezone,'required maxlength="150" placeholder="Asia/Ho_Chi_Minh"')}${attendanceSettingNumbers.map(([key,label,max])=>systemSettingNumber(label,key,settings[key],0,max)).join('')}<label>Khi thiếu lượt check-in<select name="missingPunchRule"><option value="REJECT_CHECKOUT_WITHOUT_CHECKIN" ${settings.missingPunchRule==='REJECT_CHECKOUT_WITHOUT_CHECKIN'?'selected':''}>Từ chối check-out khi chưa check-in</option><option value="INCOMPLETE" ${settings.missingPunchRule==='INCOMPLETE'?'selected':''}>Ghi nhận chưa đầy đủ</option></select></label></div><fieldset class="system-working-days"><legend>Ngày làm việc</legend><div>${['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ nhật'].map((label,index)=>`<label><input type="checkbox" name="workingDays" value="${index+1}" ${settings.workingDays?.includes(index+1)?'checked':''}> ${label}</label>`).join('')}</div></fieldset><label>Ngày lễ (mỗi ngày một dòng, định dạng YYYY-MM-DD)<textarea name="holidayDates" rows="4">${e((settings.holidayDates||[]).join('\n'))}</textarea></label><div class="system-settings-switches attendance-settings-switches">${attendanceSettingFlags.map(([key,label])=>systemSettingToggle(key,label,settings[key])).join('')}</div><h3>Địa điểm chấm công</h3><div id="system-settings-locations"></div><button type="button" class="btn" id="system-settings-add-location">Thêm địa điểm</button><p class="muted">Tối đa 20 địa điểm. Bật QR hoặc GPS cần ít nhất một địa điểm. Cấu hình mới áp dụng cho lịch được tạo hoặc cập nhật sau đó; lịch và lượt chấm công đã lưu giữ nguyên quy tắc.</p>`}<div class="form-actions"><button type="submit" class="btn primary">Lưu cấu hình</button></div></fieldset><p id="system-settings-feedback" role="status">${canUpdate?'':'Bạn có quyền xem; cần WEB_SYSTEM_SETTINGS/UPDATE để lưu.'}</p></form>`;
 const form=panel.querySelector('form'),fieldset=form.querySelector('fieldset'),feedback=panel.querySelector('#system-settings-feedback');
 form.oninput=form.onchange=()=>{dirty=true;options.onDirty?.(true);};
 function addLocation(location={}){
 const container=panel.querySelector('#system-settings-locations');if(container.children.length>=20)return;
 const index=locationSequence++,prefix=`location-${index}-`,row=document.createElement('section');row.className='system-settings-location';row.dataset.locationPrefix=prefix;
 row.innerHTML=`<div class="form-grid">${field('Mã địa điểm',prefix+'code','text',location.code||'','required maxlength="50"')}${field('Tên địa điểm',prefix+'name','text',location.name||'','required maxlength="150"')}${field('Vĩ độ',prefix+'latitude','number',location.latitude??'','required min="-90" max="90" step="any"')}${field('Kinh độ',prefix+'longitude','number',location.longitude??'','required min="-180" max="180" step="any"')}${field('Bán kính (mét)',prefix+'radiusMeters','number',location.radiusMeters??100,'required min="10" max="10000" step="1"')}</div><button type="button" class="btn danger" data-remove-location>Xóa địa điểm</button>`;
 row.querySelector('[data-remove-location]').onclick=()=>{if(saving)return;row.remove();dirty=true;options.onDirty?.(true);panel.querySelector('#system-settings-add-location').disabled=false;};container.appendChild(row);
 panel.querySelector('#system-settings-add-location').disabled=container.children.length>=20;
 }
 if(kind==='attendance'){
 (settings.locations||[]).forEach(addLocation);
 panel.querySelector('#system-settings-add-location').onclick=()=>{if(!saving){addLocation();dirty=true;options.onDirty?.(true);}};
 }
 form.onsubmit=async ev=>{
 ev.preventDefault();ev.stopPropagation();if(saving||!canUpdate)return;
 const data=new FormData(form),payload={};
 if(kind==='password-policy'){
 for(const key of ['minimumLength','maximumLength','passwordHistoryCount'])payload[key]=Number(data.get(key));
 passwordSettingFlags.forEach(([key])=>{payload[key]=data.has(key);});
 }else{
 payload.timezone=data.get('timezone').trim();attendanceSettingNumbers.forEach(([key])=>{payload[key]=Number(data.get(key));});
 attendanceSettingFlags.forEach(([key])=>{payload[key]=data.has(key);});
 payload.holidayDates=String(data.get('holidayDates')||'').split(/[\s,;]+/).filter(Boolean);payload.workingDays=data.getAll('workingDays').map(Number);payload.missingPunchRule=data.get('missingPunchRule');
 payload.locations=[...panel.querySelectorAll('[data-location-prefix]')].map(row=>{const prefix=row.dataset.locationPrefix;return {code:data.get(prefix+'code').trim().toUpperCase(),name:data.get(prefix+'name').trim(),latitude:Number(data.get(prefix+'latitude')),longitude:Number(data.get(prefix+'longitude')),radiusMeters:Number(data.get(prefix+'radiusMeters'))};});
 }
 try{validateSystemSettings(kind,payload);}catch(err){feedback.textContent=err.message;return;}
 saving=true;options.onSaving?.(true);fieldset.disabled=true;root.querySelectorAll('[data-system-tab]').forEach(button=>button.disabled=true);feedback.textContent='Đang lưu cấu hình…';
 try{const saved=await apiSystemSettings(kind,payload,version);if(!form.isConnected)return;
 if(!Number.isSafeInteger(saved?.version)||saved.version<1)throw Error('Chưa nhận phiên bản mới. Hãy tải lại trang để xác nhận trước khi lưu tiếp.');
 version=saved.version;dirty=false;options.onDirty?.(false);feedback.textContent='Đã lưu cấu hình thành công.';
 }catch(err){if(form.isConnected)feedback.textContent=err.message+' Nếu có xung đột phiên bản, tải lại cấu hình trước khi sửa và lưu lại.';}
 finally{saving=false;options.onSaving?.(false);if(form.isConnected){fieldset.disabled=!canUpdate;root.querySelectorAll('[data-system-tab]').forEach(button=>button.disabled=false);}}
 };
 }catch(err){if(!root.isConnected||current!==generation)return;panel.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn" id="system-settings-retry">Thử lại</button>`;panel.querySelector('button').onclick=load;}
 }
 await load();
}
