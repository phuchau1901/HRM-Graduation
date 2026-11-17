export function approvalTime(value) {
  return value ? new Date(`${value}${/Z$|[+-]\d\d:\d\d$/.test(value) ? '' : 'Z'}`).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—';
}
