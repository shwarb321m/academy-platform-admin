// عميل الـ API إلى Apps Script Web App — مُحسّن للسرعة:
// 1) دمج تلقائي: طلبات القراءة التي تصدر معاً تُرسل في اتصال واحد (batch) بدل عدة اتصالات.
// 2) ذاكرة مؤقتة للقراءات (60 ثانية) تجعل التنقل بين الصفحات فورياً، وتُفرَّغ عند أي تعديل.
// 3) منع تكرار الطلب نفسه أثناء انتظاره.
// نستخدم Content-Type: text/plain لتفادي طلب CORS المسبق الذي لا يدعمه Apps Script.

const TOKEN_KEY = 'academy_admin_token';
const READ_TTL_MS = 60000;
const BATCH_WINDOW_MS = 12;
const BATCH_MAX = 12;

export const config = {
  get apiUrl() { return (window.ACADEMY_CONFIG && window.ACADEMY_CONFIG.apiUrl) || localStorage.getItem('academy_api_url') || ''; },
  set apiUrl(v) { localStorage.setItem('academy_api_url', v); }
};

export const session = {
  get token() { return sessionStorage.getItem(TOKEN_KEY); },
  set token(v) { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); clearCache(); },
  me: null
};

export class ApiError extends Error {
  constructor(code, message, fields) { super(message); this.code = code; this.fields = fields; }
}

const listeners = { unauthenticated: [] };
export const onUnauthenticated = (fn) => listeners.unauthenticated.push(fn);

const rid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

// إجراءات القراءة القابلة للتخزين المؤقت والدمج
const READS = new Set(['settings.public', 'setup.status', 'system.health', 'dashboard.summary', 'analytics.overview', 'categories.list',
  'courses.adminList', 'courses.adminGet', 'teachers.list', 'users.list', 'users.get', 'roles.list', 'invites.list', 'settings.get',
  'audit.list', 'media.list', 'banks.list', 'questions.list', 'quizzes.list', 'quizzes.get', 'quizzes.attempts', 'assignments.list',
  'assignments.submissions', 'live.adminList', 'live.attendance', 'notifications.adminList', 'support.adminList', 'certificates.adminList',
  'cohorts.list', 'cohorts.members', 'enrollments.list', 'auth.sessions.list', 'auth.me']);

const cache = new Map();
const inflight = new Map();
let pending = 0;
let unauthFired = false;

export function clearCache() { cache.clear(); }

function keyOf(action, payload) {
  const clean = {};
  Object.keys(payload || {}).sort().forEach((k) => {
    const v = payload[k];
    if (v !== '' && v !== undefined && v !== null) clean[k] = v;
  });
  return action + '|' + JSON.stringify(clean);
}

function setBusy(delta) {
  pending += delta;
  document.documentElement.classList.toggle('net-busy', pending > 0);
}

function toError(e) {
  e = e || {};
  if ((e.code === 'UNAUTHENTICATED' || e.code === 'ACCOUNT_SUSPENDED') && session.token) {
    session.token = null; session.me = null;
    if (!unauthFired) { unauthFired = true; setTimeout(() => { unauthFired = false; }, 2000); listeners.unauthenticated.forEach((fn) => fn(e)); }
  }
  return new ApiError(e.code, e.message, e.fields);
}

/** اتصال HTTP واحد مع إعادة محاولة عند انقطاع الشبكة. */
async function send(action, payload, requestId, retries) {
  if (!config.apiUrl) throw new ApiError('NOT_CONFIGURED', 'لم يتم ضبط رابط الخادم بعد.');
  const body = JSON.stringify({ action, payload, token: session.token, requestId });
  let lastErr;
  setBusy(1);
  try {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(config.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, redirect: 'follow' });
        if (!res.ok) throw new ApiError('NETWORK', 'تعذر الوصول إلى الخادم (' + res.status + ').');
        const json = await res.json();
        if (json.ok) return json.data;
        throw toError(json.error);
      } catch (ex) {
        if (ex instanceof ApiError && ex.code !== 'NETWORK') throw ex;
        lastErr = ex instanceof ApiError ? ex : new ApiError('NETWORK', 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.');
        if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    throw lastErr;
  } finally { setBusy(-1); }
}

// ───── الدمج التلقائي ─────
let queue = [];
let timer = null;

function enqueue(action, payload) {
  return new Promise((resolve, reject) => {
    queue.push({ action, payload, resolve, reject });
    if (!timer) timer = setTimeout(flush, BATCH_WINDOW_MS);
  });
}

async function flush() {
  timer = null;
  const items = queue.splice(0, BATCH_MAX);
  if (queue.length) timer = setTimeout(flush, 0);
  if (items.length === 1) {
    const it = items[0];
    try { it.resolve(await send(it.action, it.payload, undefined, 1)); } catch (e) { it.reject(e); }
    return;
  }
  try {
    const results = await send('batch', { calls: items.map((i) => ({ action: i.action, payload: i.payload })) }, undefined, 1);
    results.forEach((r, k) => (r.ok ? items[k].resolve(r.data) : items[k].reject(toError(r.error))));
  } catch (e) { items.forEach((i) => i.reject(e)); }
}

/**
 * @param {string} action
 * @param {object} payload
 * @param {{requestId?: string, retries?: number, fresh?: boolean}} opts
 */
export async function api(action, payload = {}, opts = {}) {
  if (READS.has(action) && !opts.requestId) {
    const key = keyOf(action, payload);
    const hit = cache.get(key);
    if (!opts.fresh && hit && Date.now() - hit.t < READ_TTL_MS) return hit.data;
    if (inflight.has(key)) return inflight.get(key);
    const p = enqueue(action, payload).then((data) => { cache.set(key, { t: Date.now(), data }); return data; })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }
  // كتابة: اتصال مباشر، ثم تفريغ الذاكرة المؤقتة ليرى المستخدم التعديل فوراً
  const data = await send(action, payload, opts.requestId, opts.retries ?? (opts.requestId ? 2 : 0));
  clearCache();
  return data;
}

/** تحميل مسبق في الخلفية (اتصال واحد مدمج) لتصبح الصفحات التالية فورية. */
export function prefetch(list) {
  list.forEach(([action, payload]) => { api(action, payload || {}).catch(() => {}); });
}

/** للعمليات التي يجب ألا تتكرر (إنشاء، تسليم): requestId ثابت لكل محاولة إرسال. */
export const mutate = (action, payload) => api(action, payload, { requestId: rid() });

export const can = (perm) => {
  const p = session.me?.permissions || [];
  if (p.includes('*') || p.includes(perm)) return true;
  if (p.includes(perm.split('.')[0] + '.*')) return true;
  return perm.endsWith('.own') && p.includes(perm.replace(/\.own$/, ''));
};
