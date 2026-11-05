// نقطة تشغيل لوحة الإدارة: التوجيه، الإطار، حالة الجلسة.
import { api, config, session, can, onUnauthenticated, prefetch } from './api.js';
import { esc, $, $$, icon, toast, initials, ROLE_NAMES } from './ui.js';
import * as A from './auth-pages.js';
import * as P from './admin-pages.js';
import * as E from './edu-pages.js';
import * as O from './ops-pages.js';

const app = $('#app');
let pub = {};
let mfaTicket = null;

// عناصر القائمة تظهر حسب الصلاحيات فقط. الأقسام غير المبنية بعد لا تظهر (لا أزرار لا تعمل).
const NAV = [
  { group: null, items: [
    { path: 'dashboard', label: 'نظرة عامة', icon: 'home', perm: 'dashboard.view', page: P.dashboard },
    { path: 'analytics', label: 'التحليلات', icon: 'chart', perm: 'analytics.view.own', page: O.analytics }
  ] },
  { group: 'التعليم', items: [
    { path: 'categories', label: 'الأقسام', icon: 'layers', perm: 'categories.manage', page: E.categories },
    { path: 'courses', label: 'الدورات', icon: 'book', perm: 'courses.manage.own', page: E.courses },
    { path: 'media', label: 'مكتبة الوسائط', icon: 'folder', perm: 'media.upload', page: E.media }
  ] },
  { group: 'التقييم', items: [
    { path: 'questions', label: 'بنك الأسئلة', icon: 'quiz', perm: 'quizzes.manage.own', page: E.questions },
    { path: 'quizzes', label: 'الاختبارات والنتائج', icon: 'clipboard', perm: 'quizzes.manage.own', page: E.quizzes },
    { path: 'assignments', label: 'الواجبات والتصحيح', icon: 'scroll', perm: 'assignments.manage.own', page: E.assignments }
  ] },
  { group: 'البث والتواصل', items: [
    { path: 'live', label: 'البث المباشر والحضور', icon: 'video', perm: 'sessions.manage.own', page: O.live },
    { path: 'notifications', label: 'الإشعارات', icon: 'bell', perm: 'notifications.send.own', page: O.notifications },
    { path: 'support', label: 'طلبات الدعم', icon: 'chat', perm: 'support.manage', page: O.support }
  ] },
  { group: 'الأشخاص', items: [
    { path: 'people', label: 'الطلاب والمدرسون', icon: 'users', perm: 'users.view', page: P.people },
    { path: 'cohorts', label: 'الدفعات', icon: 'group', perm: 'cohorts.manage', page: O.cohorts },
    { path: 'invites', label: 'الدعوات', icon: 'mail', perm: 'invites.manage', page: P.invites },
    { path: 'certificates', label: 'الشهادات', icon: 'award', perm: 'certificates.manage', page: O.certificates }
  ] },
  { group: 'النظام', items: [
    { path: 'settings', label: 'إعدادات المنصة', icon: 'settings', perm: 'settings.view', page: P.settings },
    { path: 'audit', label: 'سجل التدقيق', icon: 'shield', perm: 'audit.view', page: P.audit },
    { path: 'account', label: 'حسابي وأمانه', icon: 'user', perm: null, page: P.account }
  ] }
];
// صفحات فرعية لا تظهر في القائمة
const HIDDEN = [
  { path: 'course', label: 'محرر الدورة', parent: 'courses', perm: 'content.manage.own', page: E.courseBuilder },
  { path: 'quiz', label: 'الاختبار', parent: 'quizzes', perm: 'quizzes.manage.own', page: E.quizEditor },
  { path: 'assignment', label: 'الواجب', parent: 'assignments', perm: 'grading.manage.own', page: E.assignmentDetail }
];
const ROUTES = Object.fromEntries([...NAV.flatMap((g) => g.items), ...HIDDEN].map((i) => [i.path, i]));

function parseHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  return { path: path || '', params: new URLSearchParams(qs || '') };
}

function renderShell() {
  const me = session.me;
  const name = pub['academy.name'] || 'الأكاديمية';
  app.innerHTML = `<div class="shell">
    <aside class="sidebar" aria-label="القائمة الرئيسية">
      <div class="brand"><div class="seal">${esc(name.charAt(0))}</div><div><div class="brand-name">${esc(name)}</div><div class="brand-sub">لوحة الإدارة</div></div></div>
      <nav class="nav">${NAV.map((g) => {
        const items = g.items.filter((i) => !i.perm || can(i.perm));
        if (!items.length) return '';
        return (g.group ? `<div class="nav-group">${g.group}</div>` : '') +
          items.map((i) => `<a href="#/${i.path}" data-path="${i.path}">${icon(i.icon)}<span>${i.label}</span></a>`).join('');
      }).join('')}</nav>
      <div class="sidebar-foot"><span class="avatar">${initials(me.user.fullName)}</span>
        <div class="who"><b>${esc(me.user.fullName)}</b><span class="muted">${esc(me.roles.map((r) => ROLE_NAMES[r] || r).join('، '))}</span></div>
        <button class="btn ghost sm" data-logout title="تسجيل الخروج" aria-label="تسجيل الخروج">${icon('logout')}</button></div>
    </aside>
    <div class="main">
      <header class="topbar"><div style="display:flex;align-items:center;gap:8px">
        <button class="btn ghost sm menu-btn" data-menu aria-label="القائمة">${icon('menu')}</button>
        <span class="crumbs" data-crumbs></span></div>
        <span class="small muted num" data-clock></span></header>
      <div class="content" data-content></div>
    </div></div>`;
  $('[data-logout]').onclick = async () => { try { await api('auth.logout'); } catch (e) { /* الجلسة قد تكون منتهية */ } session.token = null; session.me = null; location.hash = '#/login'; };
  $('[data-menu]').onclick = () => $('.shell').classList.toggle('nav-open');
}

/** بعد فتح اللوحة: تحميل مسبق لأكثر الصفحات استخداماً في اتصال واحد بالخلفية. */
function warmUp() {
  const list = [];
  if (can('dashboard.view')) list.push(['dashboard.summary']);
  if (can('courses.manage.own')) list.push(['courses.adminList', { pageSize: 100 }]);
  if (can('categories.manage')) list.push(['categories.list']);
  if (can('users.view')) list.push(['users.list', { role: 'student', page: 1 }]);
  if (can('sessions.manage.own')) list.push(['live.adminList']);
  if (can('quizzes.manage.own')) list.push(['quizzes.list']);
  if (can('assignments.manage.own')) list.push(['assignments.list']);
  setTimeout(() => prefetch(list), 400);
}

function renderPage(route, params) {
  if (!$('.shell')) { renderShell(); warmUp(); }
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === (route.parent || route.path)));
  $('.shell').classList.remove('nav-open');
  $('[data-crumbs]').textContent = route.label;
  document.title = route.label + ' — ' + (pub['academy.name'] || 'الأكاديمية');
  const root = $('[data-content]');
  root.innerHTML = '';
  route.page(root, params);
  root.focus?.();
}

async function loadMe() {
  session.me = await api('auth.me', {}, { fresh: true });
  return session.me;
}

async function route() {
  const { path, params } = parseHash();
  if (!config.apiUrl) return A.renderConfig(app, boot);

  const publicPaths = { login: 1, forgot: 1, setup: 1, mfa: 1 };
  if (publicPaths[path]) {
    $('.shell') && (app.innerHTML = '');
    if (path === 'setup') return A.renderSetup(app, afterLogin);
    if (path === 'forgot') return A.renderForgot(app);
    if (path === 'mfa' && mfaTicket) return A.renderMfaVerify(app, mfaTicket, afterLogin);
    return A.renderLogin(app, { onSession: afterLogin, onMfa: (t) => { mfaTicket = t; location.hash = '#/mfa'; } });
  }

  if (!session.token) return (location.hash = '#/login');
  if (!session.me) {
    try { await loadMe(); } catch (e) { return; }
  }
  if (session.me.mfaSetupRequired) { app.innerHTML = ''; return A.renderMfaSetup(app, async () => { session.me = null; await loadMe(); go('dashboard'); }); }

  const r = ROUTES[path] || ROUTES[firstAllowed()];
  if (!r || (r.perm && !can(r.perm))) {
    app.innerHTML = '';
    return A.renderLogin(app, { onSession: afterLogin, onMfa: (t) => { mfaTicket = t; location.hash = '#/mfa'; } }),
      toast('هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة.', 'error');
  }
  if (!ROUTES[path]) return go(r.path);
  renderPage(r, params);
}

const firstAllowed = () => NAV.flatMap((g) => g.items).find((i) => !i.perm || can(i.perm))?.path;
const go = (p) => { if (location.hash === '#/' + p) route(); else location.hash = '#/' + p; };

async function afterLogin() {
  mfaTicket = null;
  session.me = null;
  app.innerHTML = '';
  await loadMe();
  const staff = session.me.roles.some((r) => r !== 'student');
  if (!staff) {
    await api('auth.logout').catch(() => {});
    session.token = null; session.me = null;
    toast('حسابات الطلاب تستخدم تطبيق الهاتف. لوحة الإدارة مخصصة لفريق الأكاديمية.', 'error');
    return go('login');
  }
  go(session.me.mfaSetupRequired ? 'dashboard' : 'dashboard');
}

onUnauthenticated((e) => {
  app.innerHTML = '';
  toast(e.message, 'error');
  location.hash = '#/login';
});

document.addEventListener('settings-changed', async () => { pub = await api('settings.public'); A.setPublicSettings(pub); app.innerHTML = ''; route(); });
document.addEventListener('me-changed', () => { app.innerHTML = ''; route(); });
window.addEventListener('hashchange', route);

async function boot() {
  app.innerHTML = '<div class="empty" style="padding-top:30vh"><span class="ornament"></span><p>جارٍ التحميل…</p></div>';
  try {
    // الإعدادات + حالة التأسيس + بيانات المستخدم في اتصال واحد مدمج
    const [settings, setup] = await Promise.all([api('settings.public'), api('setup.status'),
      session.token ? api('auth.me').then((me) => { session.me = me; }).catch(() => {}) : null]);
    pub = settings; A.setPublicSettings(pub);
    applyBrand(pub['brand.colors']);
    if (setup.needsSuperAdmin && !session.token) { location.hash = '#/setup'; return route(); }
  } catch (e) {
    if (e.code === 'NOT_CONFIGURED' || e.code === 'NETWORK') {
      app.innerHTML = `<div class="empty" style="padding-top:24vh"><span class="ornament"></span><h4>تعذّر الوصول إلى الخادم</h4><p>${esc(e.message)}</p>
        <button class="btn secondary" data-retry>إعادة المحاولة</button> <button class="btn ghost" data-reconfig>تغيير رابط الخادم</button></div>`;
      $('[data-retry]').onclick = boot;
      $('[data-reconfig]').onclick = () => { localStorage.removeItem('academy_api_url'); A.renderConfig(app, boot); };
      return;
    }
  }
  route();
}

function applyBrand(c) {
  if (!c) return;
  const map = { ivory: '--ivory', ink: '--ink', green: '--green', brass: '--brass', warmWhite: '--warm-white', stone: '--stone' };
  Object.entries(map).forEach(([k, v]) => c[k] && document.documentElement.style.setProperty(v, c[k]));
}

boot();
