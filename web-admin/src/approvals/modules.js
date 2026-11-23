import { LeaveDetails } from './modules/LeaveDetails';
import { OvertimeDetails } from './modules/OvertimeDetails';
import { AttendanceDetails } from './modules/AttendanceDetails';
import { PerformanceDetails } from './modules/PerformanceDetails';
// Add future approval modules here without adding domain switches to ApprovalCenter.
export const approvalModules = [
  { code: 'PERFORMANCE', label: 'Performance', page: 'approvalPerformance', path: '/approvals/performance', requestTypes: ['KPI_EVALUATION'], Details: PerformanceDetails },
  { code: 'LEAVE', label: 'Leave', page: 'approvalLeave', path: '/approvals/leave', requestTypes: ['LEAVE', 'LEAVE_CANCELLATION'], Details: LeaveDetails },
  { code: 'OVERTIME', label: 'Overtime', page: 'approvalOvertime', path: '/approvals/overtime', requestTypes: ['OVERTIME'], Details: OvertimeDetails },
  { code: 'ATTENDANCE', label: 'Attendance', page: 'approvalAttendance', path: '/approvals/attendance', requestTypes: ['ATTENDANCE_ADJUSTMENT'], Details: AttendanceDetails },
];
export const approvalRequestTypes = approvalModules.flatMap(module => module.requestTypes);
