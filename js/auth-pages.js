// صفحات الدخول: ضبط الخادم، التأسيس الأول، الدخول، التحقق الثنائي، إعداده، استعادة كلمة المرور.
import { api, config, session, ApiError } from './api.js';
import { esc, $, bindForm, toast } from './ui.js';

let pub = {};
export const setPublicSettings = (s) => { pub = s || {}; };
const academyName = () => pub['academy.name'] || 'الأكاديمية';

function layout(inner) {
  const name = esc(academyName());
  return `<div class="auth">
    <aside class="auth-art" aria-hidden="true">
      <div class="arches"></div><div class="frame"></div>
      <div class="quote">
        <div class="rule"><span class="ornament"></span></div>
        <div class="display" style="margin-top:18px">العلم صرحٌ يُبنى<br>حجراً فوق حجر</div>
        <p>لوحة إدارة ${name} — حيث تُصاغ الدورات وتُتابَع رحلة كل طالب.</p>
      </div>
    </aside>
    <main class="auth-panel">
      <div class="seal">${esc(academyName().charAt(0))}</div>
      ${inner}
    </main></div>`;
}

const field = (name, label, type = 'text', attrs = '') =>
  `<div class="field"><label for="f-${name}">${label}</label><input class="input" id="f-${name}" name="${name}" type="${type}" ${attrs}><div class="err"></div></div>`;

// ── ضبط رابط الخادم (أول تشغيل على GitHub Pages) ──
export function renderConfig(root, done) {
  root.innerHTML = layout(`
    <h1>ربط لوحة الإدارة بالخادم</h1>
    <p class="lead">الصق رابط تطبيق الويب الخاص بـ Google Apps Script (ينتهي بـ <span class="num">/exec</span>).</p>
    <form novalidate>
      <div class="alert error" hidden data-alert></div>
      ${field('apiUrl', 'رابط الخادم', 'url', 'dir="ltr" required placeholder="https://script.google.com/macros/s/…/exec"')}
      <button class="btn block" type="submit">تحقق واحفظ</button>
    </form>`);
  bindForm($('form', root), async (d) => {
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(d.apiUrl) && !d.apiUrl.startsWith('/'))
      throw new ApiError('VALIDATION', 'الرابط يجب أن يكون رابط Apps Script.', { apiUrl: 'رابط غير صالح' });
    config.apiUrl = d.apiUrl;
    await api('system.health');
    done();
  });
}

// ── التأسيس الأول ──
export function renderSetup(root, done) {
  root.innerHTML = layout(`
    <div class="eyebrow"><span class="ornament"></span> التأسيس لأول مرة</div>
    <h1>إنشاء حساب المدير الأعلى</h1>
    <p class="lead">أدخل رمز التأسيس الذي ظهر لمالك السكربت عند تشغيل <span class="num">setup()</span>. يُستخدم الرمز مرة واحدة فقط.</p>
    <form novalidate>
      <div class="alert error" hidden data-alert></div>
      ${field('setupCode', 'رمز التأسيس', 'text', 'dir="ltr" required autocomplete="off" style="text-transform:uppercase"')}
      ${field('fullName', 'الاسم الكامل', 'text', 'required autocomplete="name"')}
      ${field('email', 'البريد الإلكتروني', 'email', 'dir="ltr" required autocomplete="email"')}
      <div class="field"><label for="f-password">كلمة المرور</label><input class="input" id="f-password" name="password" type="password" dir="ltr" required autocomplete="new-password" minlength="8"><div class="hint">8 أحرف على الأقل، وتحتوي حروفاً وأرقاماً.</div><div class="err"></div></div>
      <button class="btn block" type="submit">إنشاء الحساب</button>
    </form>`);
  bindForm($('form', root), async (d) => {
    const r = await api('setup.createSuperAdmin', { ...d, device: 'Admin Web' });
    session.token = r.session.token;
    done(r);
  });
}

// ── الدخول ──
export function renderLogin(root, { onSession, onMfa }) {
  root.innerHTML = layout(`
    <h1>تسجيل الدخول</h1>
    <p class="lead">مرحباً بعودتك إلى لوحة ${esc(academyName())}.</p>
    <form novalidate data-login>
      <div class="alert error" hidden data-alert></div>
      ${field('email', 'البريد الإلكتروني', 'email', 'dir="ltr" required autocomplete="username"')}
      ${field('password', 'كلمة المرور', 'password', 'dir="ltr" required autocomplete="current-password"')}
      <button class="btn block" type="submit">دخول</button>
    </form>
    <p class="small" style="margin-top:18px"><a href="#/forgot">نسيت كلمة المرور؟</a></p>`);
  bindForm($('form', root), async (d) => {
    const r = await api('auth.login', { ...d, device: 'Admin Web' });
    if (r.mfaRequired) return onMfa(r.mfaTicket);
    session.token = r.session.token;
    onSession(r);
  });
}

export function renderMfaVerify(root, ticket, onSession) {
  root.innerHTML = layout(`
    <div class="eyebrow"><span class="ornament"></span> التحقق الثنائي</div>
    <h1>أدخل رمز التحقق</h1>
    <p class="lead">افتح تطبيق المصادقة (مثل Google Authenticator) وأدخل الرمز المكوّن من 6 أرقام.</p>
    <form novalidate>
      <div class="alert error" hidden data-alert></div>
      <div class="field"><input class="input otp" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required aria-label="رمز التحقق"></div>
      <button class="btn block" type="submit">تحقق</button>
    </form>
    <p class="small" style="margin-top:18px"><a href="#/login">العودة لتسجيل الدخول</a></p>`);
  bindForm($('form', root), async (d) => {
    const r = await api('auth.verifyMfa', { mfaTicket: ticket, code: d.code });
    session.token = r.session.token;
    onSession(r);
  });
}

export async function renderMfaSetup(root, onDone) {
  root.innerHTML = layout(`<h1>تفعيل التحقق الثنائي</h1><p class="lead">جارٍ التحضير…</p>`);
  const s = await api('auth.mfa.setup');
  let qr = '';
  if (window.qrcode) { const q = window.qrcode(0, 'M'); q.addData(s.otpauthUri); q.make(); qr = q.createSvgTag(4, 0); }
  root.innerHTML = layout(`
    <div class="eyebrow"><span class="ornament"></span> خطوة أمان إلزامية</div>
    <h1>تفعيل التحقق الثنائي</h1>
    <p class="lead">حسابات الإدارة محمية برمز يتغير كل 30 ثانية. امسح الرمز بتطبيق المصادقة ثم أدخل الرمز الظاهر.</p>
    <div class="qr-box">${qr}</div>
    <p class="small muted" style="margin:0 0 6px">أو أدخل المفتاح يدوياً:</p>
    <div class="secret" style="margin-bottom:20px">${esc(s.secret.replace(/(.{4})/g, '$1 ').trim())}</div>
    <form novalidate>
      <div class="alert error" hidden data-alert></div>
      <div class="field"><input class="input otp" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required aria-label="رمز التحقق"></div>
      <button class="btn block" type="submit">تفعيل ومتابعة</button>
    </form>`);
  bindForm($('form', root), async (d) => {
    const r = await api('auth.mfa.enable', { code: d.code });
    if (r.session) session.token = r.session.token;
    toast('تم تفعيل التحقق الثنائي');
    onDone();
  });
}

export function renderForgot(root) {
  root.innerHTML = layout(`
    <h1>استعادة كلمة المرور</h1>
    <p class="lead">سنرسل رمزاً من 6 أرقام إلى بريدك إن كان مسجلاً لدينا.</p>
    <form novalidate data-step="1">
      <div class="alert error" hidden data-alert></div>
      ${field('email', 'البريد الإلكتروني', 'email', 'dir="ltr" required')}
      <button class="btn block" type="submit">إرسال الرمز</button>
    </form>
    <form novalidate data-step="2" hidden>
      <div class="alert info">إذا كان البريد مسجلاً، فقد أُرسل الرمز. صالح لمدة 15 دقيقة.</div>
      <div class="alert error" hidden data-alert></div>
      <div class="field"><label>رمز الاستعادة</label><input class="input otp" name="code" inputmode="numeric" maxlength="6" required></div>
      ${field('newPassword', 'كلمة المرور الجديدة', 'password', 'dir="ltr" required autocomplete="new-password"')}
      <button class="btn block" type="submit">تعيين كلمة المرور</button>
    </form>
    <p class="small" style="margin-top:18px"><a href="#/login">العودة لتسجيل الدخول</a></p>`);
  let email = '';
  const [f1, f2] = root.querySelectorAll('form');
  bindForm(f1, async (d) => { email = d.email; await api('auth.requestPasswordReset', d); f1.hidden = true; f2.hidden = false; });
  bindForm(f2, async (d) => {
    await api('auth.resetPassword', { email, code: d.code, newPassword: d.newPassword });
    toast('تم تعيين كلمة المرور. سجّل الدخول الآن.');
    location.hash = '#/login';
  });
}
