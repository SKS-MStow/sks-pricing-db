/* Thin fetch wrapper over the pricing API (field-api, /api/pricing).
   Same-origin, session-cookie auth — a 401 anywhere bounces to /login. */

const BASE = '/api/pricing';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function req(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      credentials: 'include',
      cache: 'no-store',
      headers: body != null ? { 'Content-Type': 'application/json' } : undefined,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Server unreachable');
  }
  if (res.status === 401) {
    location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.search);
    throw new ApiError(401, 'Session expired');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (json && json.error) || 'HTTP ' + res.status);
  return json;
}

function qs(p = {}) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') u.set(k, v);
  }
  const s = u.toString();
  return s ? '?' + s : '';
}

export const pricingApi = {
  freshness: () => req('GET', '/freshness').then(j => j.rows),
  suppliers: () => req('GET', '/suppliers').then(j => j.suppliers),
  search: p => req('GET', '/search' + qs(p)),
  revisions: supplierId => req('GET', '/revisions' + qs({ supplier_id: supplierId })).then(j => j.revisions),
  changes: (revId, p = {}) => req('GET', `/revisions/${revId}/changes` + qs(p)),
};
