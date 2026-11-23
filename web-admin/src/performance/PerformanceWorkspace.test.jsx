import React from 'react';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import {PerformanceWorkspace} from './PerformanceWorkspace';
afterEach(cleanup);
const permissions=[{code:'WEB_KPI_EVALUATION',canView:'Y',canUpdate:'Y'},{code:'WEB_KPI_CONFIGURATION',canView:'Y',canNew:'Y',canUpdate:'Y'}];
const row={id:9,employeeId:1,employeeCode:'NV001',employeeName:'Alice',departmentName:'Engineering',periodKey:'2026-11',status:'DRAFT',version:1};
function apiFor(path){if(path.endsWith('/lookups'))return {departments:[],teams:[],positions:[]};if(path.includes('/statistics'))return {data:{total:1,averageScore:null,statuses:[{status:'DRAFT',count:1}]}};if(path.includes('/periods'))return {data:[{id:2,code:'2026-11'}],total:1};return {data:[row],total:21};}
it('loads scoped KPI API, filters and paginates',async()=>{const api=vi.fn(async p=>apiFor(p));render(<PerformanceWorkspace api={api} permissions={permissions} employeeId={1}/>);await screen.findByText('NV001 · Alice');fireEvent.change(screen.getByLabelText('Trạng thái'),{target:{value:'SUBMITTED'}});await waitFor(()=>expect(api.mock.calls.some(([p])=>p.includes('statistics?')&&p.includes('status=SUBMITTED'))).toBe(true));await screen.findByText('NV001 · Alice');fireEvent.click(screen.getByText('Sau'));await waitFor(()=>expect(api.mock.calls.some(([p])=>p.includes('page=2'))).toBe(true));});
it('shows API error without invented statistics',async()=>{const api=vi.fn(async p=>{if(p.includes('statistics'))throw new Error('KPI unavailable');return apiFor(p);});render(<PerformanceWorkspace api={api} permissions={permissions}/>);expect((await screen.findByRole('alert')).textContent).toBe('KPI unavailable');expect(document.querySelector('.kpi-statistics')).toBeNull();});
it('starts own assignment using its server version',async()=>{const api=vi.fn(async(p,o)=>{if(o?.method)return {};if(p==='/kpi/evaluations/9')return {data:{target:row,criteria:[],results:[],history:[],isClosed:false}};return apiFor(p);});render(<PerformanceWorkspace api={api} permissions={permissions} employeeId={1}/>);fireEvent.click(await screen.findByText('Chi tiết'));fireEvent.click(await screen.findByText('Bắt đầu'));await waitFor(()=>expect(api.mock.calls.some(([p,o])=>p==='/kpi/evaluations/9/start'&&JSON.parse(o.body).version===1)).toBe(true));});
it('does not load KPI without screen VIEW',()=>{const api=vi.fn();render(<PerformanceWorkspace api={api} permissions={[]}/>);expect(screen.getByRole('alert')).toBeTruthy();expect(api).not.toHaveBeenCalled();});
it('creates real monthly period',async()=>{const api=vi.fn(async(p,o)=>o?.method?{data:{id:1}}:p.endsWith('/lookups')?{departments:[],teams:[],positions:[]}:{data:[],total:0});render(<PerformanceWorkspace api={api} permissions={permissions} configuration/>);fireEvent.click(screen.getByText('Thêm / Giao KPI'));fireEvent.change(screen.getByLabelText('Năm'),{target:{value:'2027'}});await waitFor(()=>expect(screen.getByText('Lưu').disabled).toBe(false));fireEvent.click(screen.getByText('Lưu'));await waitFor(()=>expect(api.mock.calls.some(([p,o])=>p==='/kpi/configuration/periods'&&o?.method==='POST'&&JSON.parse(o.body).year===2027)).toBe(true));});
it('loads KPI unit dropdown from catalog and sends selected code',async()=>{
 const api=vi.fn(async(p,o)=>{
  if(o?.method)return {data:{id:1}};
  if(p.includes('/units?'))return {data:[{id:22,code:'KG',name:'Kilogram',isActive:true}],total:1};
  if(p.endsWith('/lookups'))return {departments:[],teams:[],positions:[]};
  return {data:[],total:0};
 });
 render(<PerformanceWorkspace api={api} permissions={permissions} configuration/>);
 fireEvent.click(screen.getByText('Chỉ tiêu'));fireEvent.click(screen.getByText('Thêm / Giao KPI'));
 await screen.findByRole('option',{name:'Kilogram'});
 expect(screen.getByLabelText('Đơn vị').tagName).toBe('SELECT');
 fireEvent.change(screen.getByLabelText('Mã chỉ tiêu'),{target:{value:'PRODUCTION'}});
 fireEvent.change(screen.getByLabelText('Tên chỉ tiêu'),{target:{value:'Sản lượng'}});
 fireEvent.change(screen.getByLabelText('Đơn vị'),{target:{value:'KG'}});
 await waitFor(()=>expect(screen.getByText('Lưu').disabled).toBe(false));fireEvent.click(screen.getByText('Lưu'));
 await waitFor(()=>expect(api.mock.calls.some(([p,o])=>p==='/kpi/configuration/metrics'&&o?.method==='POST'&&JSON.parse(o.body).unit==='KG')).toBe(true));
 expect(api.mock.calls.some(([p])=>p.includes('/units?isActive=true&'))).toBe(true);
});
it('creates a new unit through the units configuration tab',async()=>{
 const api=vi.fn(async(p,o)=>o?.method?{data:{id:22}}:p.endsWith('/lookups')?{departments:[],teams:[],positions:[]}:{data:[],total:0});
 render(<PerformanceWorkspace api={api} permissions={permissions} configuration/>);
 fireEvent.click(screen.getByText('Đơn vị KPI'));fireEvent.click(screen.getByText('Thêm / Giao KPI'));
 fireEvent.change(screen.getByLabelText('Mã đơn vị'),{target:{value:'KG'}});
 fireEvent.change(screen.getByLabelText('Tên đơn vị'),{target:{value:'Kilogram'}});
 await waitFor(()=>expect(screen.getByText('Lưu').disabled).toBe(false));fireEvent.click(screen.getByText('Lưu'));
 await waitFor(()=>expect(api.mock.calls.some(([p,o])=>p==='/kpi/configuration/units'&&o?.method==='POST'&&JSON.parse(o.body).code==='KG')).toBe(true));
});
