import React from 'react';
import { can } from '../api';
import { approvalModules } from './modules';
export function ApprovalsNavigation({ permissions, page, navigate }) {
  const view = can(permissions, 'WEB_APPROVALS', 'VIEW'), settings = can(permissions, 'WEB_APPROVAL_SETTINGS', 'VIEW');
  if (!view && !settings) return null;
  return <div className="approval-navigation"><span className="eyebrow">APPROVALS</span>{view && <><button className={page === 'approvals' ? 'active' : ''} onClick={() => navigate('approvals')}>Approval Center ↗</button>{approvalModules.map(module => <button className={`approval-subnav ${page === module.page ? 'active' : ''}`} key={module.code} onClick={() => navigate(module.page)}>{module.label}</button>)}</>}{settings && <button className={page === 'approvalSettings' ? 'active' : ''} onClick={() => navigate('approvalSettings')}>Cấu hình luồng duyệt ↗</button>}</div>;
}
