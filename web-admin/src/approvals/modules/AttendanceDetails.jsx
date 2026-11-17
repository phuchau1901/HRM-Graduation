import React from 'react';
import { approvalTime } from '../date';
export function AttendanceDetails({ details }) {
  if (!details) return <p>Không có chi tiết điều chỉnh công.</p>;
  return <><p>Công #{details.attendanceID ?? details.attendanceId}: {approvalTime(details.proposedCheckIn)} → {approvalTime(details.proposedCheckOut)}</p><p>{details.reason}</p></>;
}
