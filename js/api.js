// عميل الـ API: طلب واحد لكل عملية إلى Apps Script Web App.
// نستخدم Content-Type: text/plain لتفادي طلب CORS المسبق (preflight) الذي لا يدعمه Apps Script.

const TOKEN_KEY = 'academy_admin_token';

export const config = {
  get apiUrl() { return (window.ACADEMY_CONFIG && window.ACADEMY_CONFIG.apiUrl) || localStorage.getItem('academy_api_url') || ''; },
  set apiUrl(v) { localStorage.setItem('academy_api_url', v); }
};

export const session = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  set token(v) { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); },
  me: null
};

export class ApiError extends Error {
  constructor(code, message, fields) { super(message); this.code = code; this.fields = fields; }
}

const listeners = { unauthenticated: [] };
export const onUnauthenticated = (fn) => listeners.unauthenticated.push(fn);

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

/**
 * @param {string} action
 * @param {object} payload
 * @param {{requestId?: string, retries?: number}} opts
 */
export async function api(action, payload = {}, opts = {}) {
  if (!config.apiUrl) throw new ApiError('NOT_CONFIGURED', 'لم يتم ضبط رابط الخادم بعد.');
  const body = JSON.stringify({ action, payload, token: session.token, requestId: opts.requestId });
  const retries = opts.retries ?? (opts.requestId ? 2 : 0);
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(config.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' });
      if (!res.ok) throw new ApiError('NETWORK', 'تعذر الوصول إلى الخادم (' + res.status + ').');
      const json = await res.json();
      if (json.ok) return json.data;
      const e = json.error || {};
      if (e.code === 'UNAUTHENTICATED' || e.code === 'ACCOUNT_SUSPENDED') {
        session.token = null; session.me = null;
        listeners.unauthenticated.forEach((fn) => fn(e));
      }
      throw new ApiError(e.code, e.message, e.fields);
    } catch (ex) {
      if (ex instanceof ApiError && ex.code !== 'NETWORK') throw ex;
      lastErr = ex instanceof ApiError ? ex : new ApiError('NETWORK', 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.');
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** للعمليات التي يجب ألا تتكرر (إنشاء، تسليم): requestId ثابت لكل محاولة إرسال. */
export const mutate = (action, payload) => api(action, payload, { requestId: rid() });

export const can = (perm) => {
  const p = session.me?.permissions || [];
  if (p.includes('*') || p.includes(perm)) return true;
  if (p.includes(perm.split('.')[0] + '.*')) return true;
  return perm.endsWith('.own') && p.includes(perm.replace(/\.own$/, ''));
};
