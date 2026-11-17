import {apiSession,apiOrganizationTree,apiOrganizationMembers} from '../../api/client.js';
import {e} from '../../utils.js';

const organizationSearchText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLocaleLowerCase('vi').trim();
export function organizationMatches(department,query,kind='all'){
 const term=organizationSearchText(query);
 const departmentMatch=kind!=='team'&&organizationSearchText(department.departmentName).includes(term);
 const teams=(department.teams||[]).map(team=>kind!=='department'&&organizationSearchText(team.teamName).includes(term));
 return {departmentMatch,teams,visible:!term||departmentMatch||teams.some(Boolean)};
}

export function organizationManagerLabel(manager){
 if(!manager)return 'Chưa có quản lý';
 return `${manager.positionName?`${e(manager.positionName)}: `:''}${e(manager.fullName)}`;
}

export function mountOrganization(root){
 if(!root)return ()=>{};
 const allowed=apiSession()?.permissions?.some(p=>p.platform==='WEB'&&p.code==='WEB_ORGANIZATION'&&p.canView==='Y');
 if(!allowed){root.innerHTML='<p>Bạn chưa có quyền xem cơ cấu tổ chức.</p>';return ()=>{};}
 let disposed=false,treeController;
 const requests=new Map();
 const alive=()=>!disposed&&root.isConnected;
 const abortWithin=panel=>{for(const [node,controller] of requests)if(panel.contains(node)){controller.abort();requests.delete(node);}};
 const employeeMarkup=item=>`<li><a class="org-employee" href="#/hr/employees/${encodeURIComponent(item.id)}"><span class="org-avatar" aria-hidden="true">${e((item.fullName||'?').slice(0,1))}</span><span><strong>${e(item.fullName)}</strong><small>${e(item.employeeCode)} · ${e(item.positionName||'Chưa có chức vụ')}</small></span><span class="org-status">${e(({ACTIVE:'Đang làm việc',INACTIVE:'Ngừng hoạt động',TERMINATED:'Đã nghỉ việc',PROBATION:'Thử việc'})[item.employmentStatus]||item.employmentStatus||'')}</span></a></li>`;
 async function members(panel,kind,id,page=1){
  requests.get(panel)?.abort();const controller=new AbortController();requests.set(panel,controller);
  panel.innerHTML='<p role="status">Đang tải nhân viên…</p>';
  try{
   const result=await apiOrganizationMembers(kind,id,page,controller.signal);
   if(!alive()||controller.signal.aborted||requests.get(panel)!==controller)return;
   if(!Array.isArray(result?.data))throw Error('Danh sách nhân viên không hợp lệ.');
   panel.dataset.loaded='true';
   panel.innerHTML=result.data.length?`<ul class="org-employees">${result.data.map(employeeMarkup).join('')}</ul>${kind==='unassigned'&&result.total<=20?'':`<div class="org-pagination"><button type="button" class="btn" data-prev ${page<=1?'disabled':''}>Trang trước</button><span>Trang ${page} · ${e(result.total)} nhân viên</span><button type="button" class="btn" data-next ${page*20>=result.total?'disabled':''}>Trang sau</button></div>`}`:'<p class="muted">Chưa có nhân viên trong nhóm này.</p>';
   panel.querySelector('[data-prev]')?.addEventListener('click',()=>members(panel,kind,id,page-1));
   panel.querySelector('[data-next]')?.addEventListener('click',()=>members(panel,kind,id,page+1));
  }catch(err){if(alive()&&!controller.signal.aborted){panel.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;panel.querySelector('button').onclick=()=>members(panel,kind,id,page);}}
  finally{if(requests.get(panel)===controller)requests.delete(panel);}
 }
 function bindToggle(button,panel,onOpen){button.onclick=()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));panel.hidden=!open;if(open)onOpen?.();else abortWithin(panel);};}
 async function load(){
  treeController?.abort();treeController=new AbortController();
  root.innerHTML='<p role="status">Đang tải cơ cấu tổ chức…</p>';
  try{
   const departments=await apiOrganizationTree(treeController.signal);
   if(!alive()||treeController.signal.aborted)return;
   if(!Array.isArray(departments))throw Error('Cơ cấu tổ chức không hợp lệ.');
   root.innerHTML=`<form id="organization-search" class="toolbar"><input type="search" name="search" maxlength="150" placeholder="Tìm tên phòng ban hoặc team" aria-label="Tìm phòng ban hoặc team"><select name="kind" aria-label="Loại tìm kiếm"><option value="all">Phòng ban và team</option><option value="department">Phòng ban</option><option value="team">Team</option></select><button class="btn">Tìm kiếm</button></form><p id="organization-search-result" role="status" hidden></p><p class="org-intro muted">Chọn phòng ban để xem team, chọn team để xem nhân viên.</p><div class="org-grid">${departments.map((dep,i)=>`<article class="card org-department"><h2><button type="button" class="org-toggle org-department-toggle" aria-expanded="false" aria-controls="org-dep-${i}"><span class="org-department-icon" aria-hidden="true">▦</span><span><strong>${e(dep.departmentName)}</strong><small>${e(dep.teamCount)} team · ${e(dep.employeeCount)} nhân viên<br>${organizationManagerLabel(dep.manager)}</small></span><span class="org-chevron" aria-hidden="true">›</span></button></h2><div class="org-teams" id="org-dep-${i}" hidden></div></article>`).join('')}</div>${departments.length?'':'<p>Chưa có phòng ban trong phạm vi của bạn.</p>'}`;
   departments.forEach((dep,i)=>{
    const panel=root.querySelector(`#org-dep-${i}`),button=panel.previousElementSibling.querySelector('button');
    const groups=(dep.teams||[]).map(team=>({...team,kind:'team'}));
    panel.innerHTML=(dep.unassignedCount>0?`<div class="org-direct-members" id="org-direct-${i}" aria-label="Nhân viên trực thuộc phòng ban"></div>`:'')+groups.map((team,j)=>`<section class="org-team"><h3><button type="button" class="org-toggle" aria-expanded="false" aria-controls="org-members-${i}-${j}"><span><strong>${e(team.teamName)}</strong><small>${e(team.employeeCount)} nhân viên${team.kind==='team'?`<br>${organizationManagerLabel(team.lead)}`:''}</small></span><span class="org-chevron" aria-hidden="true">›</span></button></h3><div class="org-members" id="org-members-${i}-${j}" hidden></div></section>`).join('')||'<p class="muted">Phòng ban chưa có team.</p>';
    bindToggle(button,panel,()=>{const direct=panel.querySelector('.org-direct-members');if(direct&&!direct.hidden)members(direct,'unassigned',dep.id);});
    groups.forEach((team,j)=>{const target=panel.querySelector(`#org-members-${i}-${j}`);bindToggle(target.previousElementSibling.querySelector('button'),target,()=>members(target,team.kind,team.id));});
   });
   const searchForm=root.querySelector('#organization-search');
   function searchOrganization(){
    const query=searchForm.elements.search.value.trim(),kind=searchForm.elements.kind.value;
    let count=0;
    departments.forEach((dep,i)=>{
     const match=organizationMatches(dep,query,kind),panel=root.querySelector(`#org-dep-${i}`),card=panel.closest('.org-department');
     card.hidden=!match.visible;
     if(!match.visible){abortWithin(panel);return;}
     count++;
     const direct=panel.querySelector('.org-direct-members');
     if(direct){direct.hidden=!!query&&!match.departmentMatch;if(direct.hidden)abortWithin(direct);}
     panel.querySelectorAll('.org-team').forEach((team,j)=>{team.hidden=!!query&&!match.departmentMatch&&!match.teams[j];if(team.hidden)abortWithin(team);});
     if(query){const open=match.departmentMatch||match.teams.some(Boolean);panel.hidden=!open;panel.previousElementSibling.querySelector('button').setAttribute('aria-expanded',String(open));}
     if(direct&&!direct.hidden&&!panel.hidden&&!requests.has(direct)&&direct.dataset.loaded!=='true')members(direct,'unassigned',dep.id);
    });
    const result=root.querySelector('#organization-search-result');
    result.hidden=!query;
    result.textContent=count?`Tìm thấy ${count} phòng ban phù hợp.`:'Không có phòng ban hoặc team phù hợp.';
   }
   searchForm.onsubmit=event=>{event.preventDefault();event.stopPropagation();searchOrganization();};
   searchForm.elements.search.addEventListener('input',searchOrganization);
   searchForm.elements.kind.addEventListener('change',searchOrganization);
  }catch(err){if(alive()&&!treeController.signal.aborted){root.innerHTML=`<p role="alert">${e(err.message)}</p><button type="button" class="btn">Thử lại</button>`;root.querySelector('button').onclick=load;}}
 }
 load();
 return ()=>{disposed=true;treeController?.abort();for(const controller of requests.values())controller.abort();requests.clear();};
}
