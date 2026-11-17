import {apiSystemSettings} from './api/client.js';
import {validateSystemSettings} from './pages/administration/system-settings/system-settings.js';
import {e} from './utils.js';

export function passwordPolicyRules(password,username,policy){
 const rules=[{key:'length',label:`Từ ${policy.minimumLength} đến ${policy.maximumLength} ký tự`,passed:!!password.trim()&&password.length>=policy.minimumLength&&password.length<=policy.maximumLength}];
 for(const [key,pattern,label] of [['requireUppercase',/\p{Lu}/u,'Có chữ hoa (A–Z)'],['requireLowercase',/\p{Ll}/u,'Có chữ thường (a–z)'],['requireDigit',/\p{Nd}/u,'Có chữ số (0–9)'],['requireSpecialCharacter',/[^\p{L}\p{N}\s]/u,'Có ký tự đặc biệt (!@#$…)']])if(policy[key])rules.push({key,label,passed:pattern.test(password)});
 if(policy.disallowUsernameInPassword)rules.push({key:'username',label:'Không chứa tên đăng nhập',passed:!username||!password.toLowerCase().includes(username.toLowerCase())});
 return rules;
}
export function passwordPolicyErrors(password,username,policy){
 const errors=[];
 if(!password.trim())errors.push('Mật khẩu không được để trống hoặc chỉ chứa khoảng trắng.');
 return [...errors,...passwordPolicyRules(password,username,policy).filter(rule=>!rule.passed).map(rule=>rule.key==='length'?`Mật khẩu phải dài từ ${policy.minimumLength} đến ${policy.maximumLength} ký tự.`:rule.label+'.')];
}
export function bindPasswordPolicy(form,{passwordName,confirmName=null,username,optional=false}){
 const input=form.elements[passwordName],note=document.createElement('div');note.className='password-policy-help';note.setAttribute('aria-live','polite');
 const host=input.closest('label, .user-password-field');
 host?.classList.add('password-validation-field');
 host?.appendChild(note);
 function decorate(control){
 const wrapper=document.createElement('span');wrapper.className='password-validation-input';control.before(wrapper);wrapper.appendChild(control);
 const tick=document.createElement('span');tick.className='password-validation-tick';tick.textContent='✓';tick.hidden=true;tick.setAttribute('aria-hidden','true');wrapper.appendChild(tick);
 return (valid,invalid)=>{wrapper.classList.toggle('is-valid',valid);wrapper.classList.toggle('is-invalid',invalid);tick.hidden=!valid;if(invalid)control.setAttribute('aria-invalid','true');else control.removeAttribute('aria-invalid');};
 }
 const markInput=decorate(input),confirm=confirmName?form.elements[confirmName]:null,markConfirm=confirm?decorate(confirm):null;
 confirm?.closest('label')?.classList.add('password-validation-field');
 const confirmNote=confirm?document.createElement('span'):null;
 if(confirmNote){confirmNote.className='password-confirm-feedback';confirmNote.setAttribute('aria-live','polite');confirm.closest('label')?.appendChild(confirmNote);}
 let policy=null,unavailable=false;
 function render(){
 const entered=!!input.value;
 const rules=policy?passwordPolicyRules(input.value,username(),policy):[];
 const valid=!!policy&&entered&&rules.every(rule=>rule.passed);
 markInput(valid,!!policy&&entered&&!valid);
 if(policy){
 note.innerHTML=`<ul class="password-policy-rules">${rules.map(rule=>`<li class="password-policy-rule ${entered?(rule.passed?'is-passed':'is-failed'):''}"><span class="password-policy-rule-mark" aria-hidden="true">${entered?(rule.passed?'✓':'×'):'•'}</span><span>${e(rule.label)}</span></li>`).join('')}</ul>${policy.passwordHistoryCount?`<p class="password-policy-history">Không trùng ${policy.passwordHistoryCount} mật khẩu gần nhất — kiểm tra khi lưu.</p>`:''}`;
 }
 if(confirm){const matched=!!confirm.value&&confirm.value===input.value;markConfirm(matched&&valid,!!confirm.value&&!matched);confirmNote.textContent=confirm.value&&!matched?'Mật khẩu nhập lại không khớp.':'';}
 }
 note.textContent='Đang tải chính sách mật khẩu…';
 const ready=apiSystemSettings('password-policy').then(result=>{
 policy=validateSystemSettings('password-policy',result.settings);
 if(!form.isConnected)return;
 for(const name of [passwordName,confirmName].filter(Boolean)){form.elements[name].minLength=policy.minimumLength;form.elements[name].maxLength=policy.maximumLength;}
 render();
 }).catch(()=>{unavailable=true;if(form.isConnected)note.textContent='Không tải được chính sách mật khẩu. Máy chủ sẽ kiểm tra khi lưu.';});
 input.addEventListener('input',render);confirm?.addEventListener('input',render);form.elements.userId?.addEventListener('input',render);
 form.addEventListener('reset',()=>setTimeout(()=>{if(form.isConnected)render();},0));
 return async()=>{
 await ready;render();
 if(optional&&!input.value)return;
 if(!input.value.trim())throw Error('Mật khẩu không được để trống hoặc chỉ chứa khoảng trắng.');
 if(!unavailable){const errors=passwordPolicyErrors(input.value,username(),policy);if(errors.length)throw Error(errors.join(' '));}
 };
}
