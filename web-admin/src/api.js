export function createApi(token, onUnauthorized = () => {}) {
  return async (path, options = {}) => {
    const { responseType, ...fetchOptions } = options;
    const response = await fetch(`/api${path}`, { ...fetchOptions, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
    if (response.status === 204) return null;
    if (response.ok && responseType === 'blob') return response.blob();
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && token) onUnauthorized();
      throw new Error(body?.message || (body?.errors ? Object.values(body.errors).flat().join(' ') : null) || `Yêu cầu thất bại (${response.status}).`);
    }
    return body;
  };
}
export function can(permissions, code, action) { return permissions?.some(p => p.code === code && p[{ VIEW: 'canView', NEW: 'canNew', UPDATE: 'canUpdate', DELETE: 'canDelete', APPROVE: 'canApprove', EXPORT: 'canExport' }[action]] === 'Y') || false; }
export async function allPages(api, path, signal) {
  const rows = [];
  for (let page = 1; ; page++) {
    const result = await api(`${path}${path.includes('?') ? '&' : '?'}pageSize=100&page=${page}`, { signal }); rows.push(...result.data);
    if (rows.length >= result.total || !result.data.length) return rows;
  }
}
