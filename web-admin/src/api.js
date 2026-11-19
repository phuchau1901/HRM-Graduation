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

export function newRequestId() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
