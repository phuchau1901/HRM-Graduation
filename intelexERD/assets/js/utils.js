export const escapeHtml=(v='')=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const e=escapeHtml;
export const initials=n=>n.split(' ').slice(-2).map(x=>x[0]).join('');
export const dateLabel=d=>d?d.slice(0,10).split('-').reverse().join('/'):'—';
export const timeLabel=d=>d?d.slice(11,16):'—';
export const pct=(a,b)=>b?Math.round(a/b*100):0;
export const id=p=>`${p}-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)}`;
export const labels={todo:'Chưa bắt đầu',in_progress:'Đang thực hiện',review:'Chờ review',done:'Hoàn thành',high:'Cao',medium:'Trung bình',low:'Thấp',on_track:'Đúng kế hoạch',at_risk:'Có nguy cơ',pending_leader:'Chờ Leader',pending_manager:'Chờ Manager',pending_hr:'Chờ HR',pending_admin:'Chờ Admin',approved:'Đã duyệt',rejected:'Từ chối',cancelled:'Đã hủy',leave:'Nghỉ phép',overtime:'Tăng ca',adjustment:'Điều chỉnh công',general:'Yêu cầu khác',active:'Đang làm việc',locked:'Đã khóa',ontime:'Đúng giờ',late:'Đi trễ',absent:'Chưa check-in'};
export function workDays(start,end){let total=0;for(let d=new Date(start+'T12:00:00+07:00');d<=new Date(end+'T12:00:00+07:00');d.setDate(d.getDate()+1))if(![0,6].includes(d.getDay()))total++;return total;}
export function workMinutes(a,shift={shiftStart:'08:30',shiftEnd:'17:30'}){if(!a?.checkIn||!a?.checkOut)return 0;const minutes=t=>parseInt(t.slice(0,2))*60+parseInt(t.slice(3,5));const start=Math.max(minutes(shift.shiftStart),minutes(a.checkIn.slice(11,16))),end=Math.min(minutes(shift.shiftEnd),minutes(a.checkOut.slice(11,16)));return Math.max(0,end-start-Math.max(0,Math.min(end,780)-Math.max(start,720)));}
export function hours(a,shift){if(!a?.checkIn||!a?.checkOut)return '—';return (workMinutes(a,shift)/60).toFixed(1)+'h';}
export function csvDownload(name,headers,rows){const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';const blob=new Blob(['\uFEFF'+[headers,...rows].map(r=>r.map(quote).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
