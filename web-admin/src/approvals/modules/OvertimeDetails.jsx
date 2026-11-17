import React from 'react';
import { approvalTime } from '../date';
export function OvertimeDetails({ details }) {
  if (!details) return <p>Không có chi tiết tăng ca.</p>;
  return <><p>{approvalTime(details.startAt)} → {approvalTime(details.endAt)}</p><p>Đăng ký {details.requestedHours} giờ · Được duyệt {details.approvedHours ?? '—'} giờ</p><p>{details.reason}</p></>;
}
