import React from 'react';
export function PayrollDetails({details}){return details?<section><h3>Duyệt kỳ lương {details.periodKey}</h3><p>Trạng thái: {details.status} · Phiên bản {details.version}</p><a href="#/payroll/management">Xem bảng lương trong Payroll Management ↗</a></section>:<p>Không có thông tin kỳ lương.</p>;}
