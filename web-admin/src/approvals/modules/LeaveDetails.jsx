import React from 'react';
export function LeaveDetails({ details }) {
  if (!details) return <p>Không có chi tiết đơn nghỉ phép.</p>;
  return <><p>{details.leaveTypeName}</p><p>{details.fromDate} → {details.toDate} · {details.requestedDays} ngày</p><p>{details.reason}</p></>;
}
