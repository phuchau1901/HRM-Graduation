import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,within,waitFor} from '@testing-library/react';
import {UnscheduledAttendancePanel} from './UnscheduledAttendancePanel';
afterEach(cleanup);
const permissions=[{code:'WEB_MY_ATTENDANCE',canView:'Y',canUpdate:'Y'}];
it('captures unscheduled time without sending scheduleId and keeps key on network retry',async()=>{
 let fails=true;const api=vi.fn(async(p,o)=>{if(o?.method){if(fails)throw new Error('Network error');return {recordType:'UNSCHEDULED',status:'OPEN'};}if(p.includes('punch-context'))return {recordType:'UNSCHEDULED',requireQr:false,requireGps:false};return {total:0,data:[]};});
 render(<UnscheduledAttendancePanel api={api} personal permissions={permissions}/>);fireEvent.click(screen.getByText('Check-in tự động'));const dialog=await screen.findByRole('dialog');fireEvent.click(within(dialog).getByText('Xác nhận'));await screen.findAllByText('Network error');fails=false;fireEvent.click(within(dialog).getByText('Xác nhận'));await screen.findByText('Đã lưu giờ ngoài lịch: Đang làm ngoài lịch');
 const writes=api.mock.calls.filter(([,o])=>o?.method);expect(writes).toHaveLength(2);expect(writes[0][1].body).toBe(writes[1][1].body);expect(JSON.parse(writes[0][1].body)).not.toHaveProperty('scheduleId');
});
it('shows saved evidence and confirmation retry when workflow is unavailable',async()=>{
 const row={id:5,employeeCode:'NV1',fullName:'An',status:'RECORDED',version:2,startAtUtc:'2026-11-25T02:00:00Z',endAtUtc:'2026-11-25T03:00:00Z'};
 const api=vi.fn(async(p,o)=>o?.method?{success:true,data:{status:'PENDING'}}:{total:1,data:[row]});render(<UnscheduledAttendancePanel api={api} personal permissions={permissions}/>);fireEvent.click(await screen.findByText('Gửi xác nhận tăng ca'));const d=screen.getByRole('dialog');fireEvent.change(within(d).getByLabelText('Lý do'),{target:{value:'Confirmed actual work'}});fireEvent.click(within(d).getByText('Xác nhận'));await waitFor(()=>expect(api.mock.calls.some(([p,o])=>p==='/attendances/unscheduled/5/submit'&&JSON.parse(o.body).version===2)).toBe(true));
});
it('does not expose personal write controls in management or VIEW-only mode',async()=>{
 const api=vi.fn(async()=>({total:0,data:[]}));render(<UnscheduledAttendancePanel api={api} personal={false} permissions={permissions}/>);await screen.findByText('Chưa có giờ ngoài lịch trong khoảng đã chọn.');expect(screen.queryByText('Check-in tự động')).toBeNull();expect(api.mock.calls[0][0]).toContain('/attendances/unscheduled?');
});
it('shows captured checkout message instead of claiming overtime was approved',async()=>{
 const api=vi.fn(async(p,o)=>o?.method?{recordType:'UNSCHEDULED',status:'RECORDED',confirmationMessage:'Giờ đã lưu; chưa có luồng duyệt.'}:p.includes('punch-context')?{recordType:'UNSCHEDULED',requireQr:false,requireGps:false}:{total:0,data:[]});render(<UnscheduledAttendancePanel api={api} personal permissions={permissions}/>);fireEvent.click(screen.getByText('Check-out tự động'));const d=await screen.findByRole('dialog');fireEvent.click(within(d).getByText('Xác nhận'));expect(await screen.findByText('Giờ đã lưu; chưa có luồng duyệt.')).toBeTruthy();
});
