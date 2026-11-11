import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.localStorage={data:new Map(),getItem(k){return this.data.get(k)||null;},setItem(k,v){this.data.set(k,v);}};
const store=await import('../assets/js/store.js');
const scope=await import('../assets/js/permissions.js');
const utils=await import('../assets/js/utils.js');
const dash=await import('../assets/js/pages/dashboard.js');
const work=await import('../assets/js/pages/work.js');
const ops=await import('../assets/js/pages/operations.js');
const report=await import('../assets/js/pages/attendance-report.js');
const {nav}=await import('../assets/js/router.js');
const filters=()=>({search:'',status:'',team:'',project:'',date:'2026-10-19',page:1,size:10,view:'',tab:'',sort:''});
test('Seed khớp KPI, quan hệ và trạng thái chấm công trong spec',()=>{
 store.reset();const s=store.state,u=store.user();
 assert.equal(s.users.length,30);assert.equal(scope.employees(s,u).length,24);assert.equal(scope.projects(s,u).length,4);
 const ts=scope.tasks(s,u);assert.equal(ts.length,48);assert.equal(ts.filter(t=>t.status==='done').length,36);
 assert.deepEqual(['in_progress','review','todo'].map(st=>ts.filter(t=>t.status===st).length),[6,3,3]);
 const ids=new Set(scope.employees(s,u).map(u=>u.id));const records=s.attendance.filter(a=>a.date==='2026-10-19'&&ids.has(a.userId));
 assert.deepEqual(['ontime','late','leave','absent'].map(st=>records.filter(a=>store.attendanceStatus(a)===st).length),[19,2,2,1]);
 for(const t of s.tasks){assert.ok(s.projects.some(p=>p.id===t.projectId&&p.memberIds.includes(t.assigneeId)));assert.ok(s.users.some(u=>u.id===t.assigneeId));}
 for(const r of s.requests){assert.equal(new Date(r.startDate+'T12:00:00Z').toISOString().slice(0,10),r.startDate);}
});
test('Phạm vi role chặn nhân sự QA và tài liệu HR riêng tư',()=>{
 store.reset();const s=store.state;
 assert.ok(!scope.employees(s,store.user()).some(u=>u.teamId==='qa'));
 for(const role of ['Dev','Leader','Manager','HR','Admin']){
 const u=s.users.find(u=>u.role===role);const ts=scope.tasks(s,u);
 if(role==='Dev'){assert.ok(ts.every(t=>t.assigneeId===u.id));assert.equal(scope.routeAllowed(s,u,'/hr/employees'),false);assert.equal(scope.routeAllowed(s,u,'/team/tasks'),false);}
 if(role==='Leader'){assert.ok(scope.employees(s,u).every(x=>x.teamId===u.teamId));assert.ok(ts.every(t=>s.users.find(x=>x.id===t.assigneeId).teamId===u.teamId));}
 if(role==='HR'){assert.equal(ts.length,0);assert.equal(scope.can(s,u,'task.create'),false);assert.equal(scope.routeAllowed(s,u,'/projects/tasks'),false);}
 if(!['Admin','HR'].includes(role))assert.ok(scope.documents(s,u).every(d=>d.visibility!=='hr'));
 assert.equal(scope.routeAllowed(s,u,'/admin/users'),role==='Admin');
 }
});
test('Cập nhật ERP-010 đồng bộ tổng task và tiến độ dự án',()=>{
 store.reset();store.updateTask('tsk-10','done');const s=store.state;
 assert.equal(scope.tasks(s,store.user()).filter(t=>t.status==='done').length,37);
 assert.equal(s.tasks.filter(t=>t.projectId==='prj-1'&&t.status==='done').length,10);
 assert.ok(dash.projectChart(filters()).includes('83%'));
 store.switchUser('usr-02');assert.throws(()=>store.updateTask('tsk-10','todo'),/quyền/);
});
test('Chuỗi Dev → Leader → Manager → HR trừ phép đúng một lần',()=>{
 store.reset();store.switchUser('usr-02');const start=store.state.leaveBalances.find(b=>b.userId==='usr-02').usedDays;
 store.createRequest({type:'leave',leaveType:'Phép năm',startDate:'2026-11-02',endDate:'2026-11-03',reason:'Nghỉ phép demo'});const request=store.state.requests[0];
 assert.equal(request.status,'pending_leader');assert.throws(()=>store.decideRequest(request.id,true),/quyền/);
 store.switchUser('usr-01');store.decideRequest(request.id,true);assert.equal(request.status,'pending_manager');
 store.switchUser('usr-manager');store.decideRequest(request.id,true);assert.equal(request.status,'pending_hr');
 store.switchUser('usr-hr');store.decideRequest(request.id,true);assert.equal(request.status,'approved');
 assert.equal(store.state.leaveBalances.find(b=>b.userId==='usr-02').usedDays,start+2);assert.throws(()=>store.decideRequest(request.id,true),/quyền/);
});
test('Form phép chặn trùng, cuối tuần, sai thứ tự và vượt số dư',()=>{
 store.reset();store.switchUser('usr-02');const data={type:'leave',leaveType:'Phép năm',startDate:'2026-11-02',endDate:'2026-11-03',reason:'Demo'};
 store.createRequest(data);assert.throws(()=>store.createRequest(data),/trùng/);
 assert.throws(()=>store.createRequest({...data,startDate:'2026-11-07',endDate:'2026-11-08'}),/ngày làm/);
 assert.throws(()=>store.createRequest({...data,endDate:'2026-11-01'}),/kết thúc/);
 assert.throws(()=>store.createRequest({...data,startDate:'2026-12-01',endDate:'2026-12-31'}),/số dư/);
 const request=store.state.requests[0];store.switchUser('usr-01');assert.throws(()=>store.decideRequest(request.id,false),/lý do/);store.decideRequest(request.id,false,'Không phù hợp lịch team');assert.equal(request.status,'rejected');
});
test('Tính công trừ nghỉ trưa và không tạo giờ công khi chưa check-out',()=>{
 assert.equal(utils.hours({checkIn:'2026-10-16T08:15:00+07:00',checkOut:'2026-10-16T17:30:00+07:00'}),'8.0h');
 assert.equal(utils.hours({checkIn:'2026-10-19T08:15:00+07:00'}),'—');
 assert.equal(utils.workDays('2026-10-23','2026-10-26'),2);
 assert.equal(utils.e('<script>"x"</script>'),'&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});
test('Các route, view và tab được render cho đủ 5 role',()=>{
 store.reset();let count=0;
 const check=html=>{assert.equal(typeof html,'string');assert.ok(!html.includes('undefined'),'View contains undefined');assert.ok(!html.includes('NaN'),'View contains NaN');count++;};
 for(const role of ['Admin','Dev','Leader','Manager','HR']){
 store.switchUser(store.state.users.find(u=>u.role===role).id);const f=filters();
 check(dash.dashboard(f));check(work.taskPage(f));check(work.taskPage({...f,view:'kanban'}));check(work.projectCards(f));check(work.projectDetail(f,scope.projects(store.state,store.user())[0]?.id));check(work.attendancePage(f,true));check(work.approvalPage(f,true));check(work.documentsPage(f));check(work.reportsPage(f));
 for(const tab of ['all','leave','overtime','adjustment','general','history'])check(work.approvalPage({...f,tab}));
 for(const n of nav)for(const [,path] of n.children||[]){if(!scope.routeAllowed(store.state,store.user(),path))continue;if(path.startsWith('/team/'))check(work.teamPage(f,path));if(path.startsWith('/hr/'))check(ops.hrPage(f,path));if(path.startsWith('/admin/'))check(ops.adminPage(f,path));}
 }
 console.log('Rendered view scenarios:',count);
});
test('Reset và lưu trạng thái hợp lệ',()=>{store.reset();store.switchUser('usr-hr');store.save();assert.equal(store.load().currentUserId,'usr-hr');store.reset();assert.equal(store.user().role,'Manager');});
test('Báo cáo tháng lọc theo phạm vi, ca chưa hoàn tất và ngày cuối tuần',()=>{
 store.reset();const f={...filters(),period:'month',month:'2026-10'};const rows=report.reportRows(f);
 assert.equal(rows.length,24);assert.ok(rows.every(r=>r.u.teamId!=='qa'));assert.equal(rows[0].standard,13);assert.equal(rows[0].worked,'93.0');assert.equal(rows[1].worked,'96.0');
 assert.equal(report.reportRows({...f,team:'frontend'}).length,12);
 assert.equal(report.reportRows({...f,employee:'usr-qa-0'}).length,0);
 assert.equal(dash.attendanceRows({...filters(),date:'2026-10-18'}).length,0);
 assert.ok(report.attendanceReport(f).includes('Công thực tế'));
 assert.ok(!report.attendanceReport({...f,month:'2026-11'}).includes('NaN'));
});
