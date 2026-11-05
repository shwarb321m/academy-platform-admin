// صفحات لوحة الإدارة — المرحلة A: نظرة عامة، الأشخاص، الدعوات، الإعدادات، سجل التدقيق، حسابي.
import { api, mutate, session, can } from './api.js';
import { esc, $, $$, toast, dialog, bindForm, fmtDateTime, fmtDate, initials, STATUS, ROLE_NAMES, emptyState, loadingRows, icon } from './ui.js';

const head = (eyebrow, title, sub, actions = '') => `
  <div class="page-head"><div>
    <div class="eyebrow"><span class="ornament"></span>${esc(eyebrow)}</div>
    <h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}
  </div><div>${actions}</div></div>`;

const errorBox = (e, retry) => `<div class="card">${emptyState('تعذّر تحميل البيانات', e.message, retry ? '<button class="btn secondary" data-retry>إعادة المحاولة</button>' : '')}</div>`;

async function guarded(root, render) {
  try { await render(); }
  catch (e) {
    root.innerHTML = errorBox(e, true);
    $('[data-retry]', root)?.addEventListener('click', () => guarded(root, render));
  }
}

const roleBadges = (roles) => (roles || []).map((r) => `<span class="badge plain">${esc(ROLE_NAMES[r] || r)}</span>`).join(' ');
const statusBadge = (s) => { const [k, t] = STATUS[s] || ['', s]; return `<span class="badge ${k}">${esc(t)}</span>`; };

const ACTION_NAMES = {
  'setup.createSuperAdmin': 'تأسيس المنصة', 'auth.register': 'تسجيل طالب جديد', 'auth.acceptInvite': 'قبول دعوة',
  'auth.resetPassword': 'استعادة كلمة مرور', 'auth.changePassword': 'تغيير كلمة مرور', 'auth.mfa.enable': 'تفعيل التحقق الثنائي',
  'auth.mfa.disable': 'إيقاف التحقق الثنائي', 'users.setStatus': 'تغيير حالة حساب', 'users.setRole': 'تعديل دور',
  'users.update': 'تعديل بيانات مستخدم', 'users.revokeSessions': 'إنهاء جلسات مستخدم', 'users.sendPasswordReset': 'إرسال رمز استعادة',
  'invites.create': 'إرسال دعوة', 'invites.revoke': 'إلغاء دعوة', 'settings.update': 'تعديل الإعدادات', 'roles.save': 'تعديل صلاحيات دور'
};
const actionName = (a) => ACTION_NAMES[a] || a;

// ════════════ نظرة عامة ════════════
export function dashboard(root) {
  return guarded(root, async () => {
    root.innerHTML = head('نظرة عامة', 'الأكاديمية اليوم', 'أرقام حية من قاعدة البيانات.') +
      `<div class="grid cols-4">${Array.from({ length: 4 }, () => '<div class="card stat"><div class="skeleton" style="width:60%"></div><div class="skeleton" style="height:30px;margin-top:14px;width:40%"></div></div>').join('')}</div>`;
    const d = await api('dashboard.summary');
    const stat = (label, value, sub = '') => `<div class="card stat"><div class="label">${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
    root.innerHTML = head('نظرة عامة', 'الأكاديمية اليوم', 'أرقام حية من قاعدة البيانات.',
      can('invites.manage') ? `<button class="btn" data-invite>${icon('plus')} دعوة مستخدم</button>` : '') + `
      <div class="grid cols-4" style="margin-bottom:20px">
        ${stat('إجمالي الطلاب', d.students, `${d.activeStudents7d} نشط خلال 7 أيام`)}
        ${stat('المدرسون', d.teachers)}
        ${stat('الدورات', d.courses, `${d.categories} قسم · ${d.lessons} درس`)}
        ${stat('التسجيلات', d.enrollments, `معدل الإكمال <span class="num">${d.completionRate}%</span>`)}
      </div>
      <div class="grid cols-main">
        <section class="card"><div class="card-head"><h3>آخر الأنشطة المهمة</h3>${can('audit.view') ? '<a class="small" href="#/audit">السجل الكامل</a>' : ''}</div>
          ${d.recentActivity.length ? `<ul class="list-plain">${d.recentActivity.map((a) => `
            <li><span class="dot"></span><div style="flex:1"><b style="font-weight:500">${esc(actionName(a.action))}</b>
            <div class="small muted">${esc(a.actorName)} · ${fmtDateTime(a.createdAt)}</div></div></li>`).join('')}</ul>`
            : emptyState('لا أنشطة بعد', 'ستظهر هنا العمليات الإدارية فور حدوثها.')}
        </section>
        <section class="card"><div class="card-head"><h3>الحصص القادمة</h3></div>
          ${d.upcomingSessions.length ? `<ul class="list-plain">${d.upcomingSessions.map((s) => `<li><span class="dot"></span><div><b style="font-weight:500">${esc(s.title)}</b><div class="small muted">${fmtDateTime(s.startsAt)}</div></div></li>`).join('')}</ul>`
            : emptyState('لا حصص مجدولة', 'ابدأ بثاً مباشراً أو جدول حصة من «البث المباشر».', can('sessions.manage.own') ? '<a class="btn secondary sm" href="#/live">البث المباشر</a>' : '')}
        </section>
      </div>`;
    $('[data-invite]', root)?.addEventListener('click', () => inviteDialog());
  });
}

// ════════════ الأشخاص ════════════
const PEOPLE_TABS = [
  { key: 'student', label: 'الطلاب' }, { key: 'teacher', label: 'المدرسون' },
  { key: 'staff', label: 'فريق الإدارة' }
];

export function people(root, params) {
  const state = { role: params.get('role') || 'student', q: '', status: '', page: 1 };
  root.innerHTML = head('الأشخاص', 'الطلاب والمدرسون', 'ابحث، تابع، ونظّم حسابات الأكاديمية.',
    can('invites.manage') ? `<button class="btn" data-invite>${icon('plus')} دعوة</button>` : '') + `
    <div class="tabs" role="tablist">${PEOPLE_TABS.map((t) => `<button class="tab" role="tab" data-tab="${t.key}" aria-selected="${t.key === state.role}">${t.label}</button>`).join('')}</div>
    <section class="card">
      <div class="toolbar">
        <input class="input search" type="search" placeholder="بحث بالاسم أو البريد أو الهاتف" aria-label="بحث" data-q>
        <select class="input" style="width:auto" data-status aria-label="الحالة">
          <option value="">كل الحالات</option><option value="active">نشط</option><option value="suspended">معلّق</option>
        </select>
      </div>
      <div class="table-wrap"><table class="table"><thead><tr><th>الاسم</th><th>الدور</th><th>الحالة</th><th>آخر دخول</th><th>تاريخ الانضمام</th><th></th></tr></thead><tbody data-rows></tbody></table></div>
      <div class="pager" data-pager></div>
    </section>`;

  const rows = $('[data-rows]', root);
  const pager = $('[data-pager]', root);
  let seq = 0;

  async function load() {
    const my = ++seq;
    rows.innerHTML = loadingRows(5, 6);
    try {
      let res;
      if (state.role === 'staff') {
        const [a, b, c, d] = await Promise.all(['super_admin', 'admin', 'support', 'grader'].map((role) => api('users.list', { role, q: state.q, status: state.status, pageSize: 100 })));
        const seen = {};
        const items = [...a.items, ...b.items, ...c.items, ...d.items].filter((u) => !seen[u.id] && (seen[u.id] = 1));
        res = { items, total: items.length, page: 1, pages: 1 };
      } else {
        res = await api('users.list', { role: state.role, q: state.q, status: state.status, page: state.page });
      }
      if (my !== seq) return;
      if (!res.items.length) {
        rows.innerHTML = `<tr><td colspan="6">${emptyState(state.q ? 'لا نتائج مطابقة' : 'لا يوجد أحد هنا بعد', state.q ? 'جرّب كلمات بحث أخرى.' : 'ادعُ أول شخص لينضم إلى الأكاديمية.')}</td></tr>`;
      } else {
        rows.innerHTML = res.items.map((u) => `
          <tr data-id="${esc(u.id)}">
            <td><div class="person"><span class="avatar">${initials(u.fullName)}</span><div><div style="font-weight:500">${esc(u.fullName)}</div><div class="small muted num">${esc(u.email)}</div></div></div></td>
            <td>${roleBadges(u.roles)}</td>
            <td>${statusBadge(u.status)}</td>
            <td class="small">${fmtDateTime(u.lastLoginAt)}</td>
            <td class="small">${fmtDate(u.createdAt)}</td>
            <td style="text-align:left"><button class="btn ghost sm" data-open>التفاصيل</button></td>
          </tr>`).join('');
      }
      pager.innerHTML = `<span>${res.total} نتيجة</span><span style="display:flex;gap:6px;align-items:center">
        <button class="btn secondary sm" data-prev ${res.page <= 1 ? 'disabled' : ''}>السابق</button>
        <span class="num">${res.page} / ${res.pages}</span>
        <button class="btn secondary sm" data-next ${res.page >= res.pages ? 'disabled' : ''}>التالي</button></span>`;
      $('[data-prev]', pager).onclick = () => { state.page--; load(); };
      $('[data-next]', pager).onclick = () => { state.page++; load(); };
    } catch (e) {
      if (my !== seq) return;
      rows.innerHTML = `<tr><td colspan="6">${emptyState('تعذّر التحميل', e.message, '<button class="btn secondary" data-retry>إعادة المحاولة</button>')}</td></tr>`;
      $('[data-retry]', rows).onclick = load;
      pager.innerHTML = '';
    }
  }

  let t;
  $('[data-q]', root).addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.page = 1; load(); }, 300); });
  $('[data-status]', root).addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  $$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => {
    state.role = b.dataset.tab; state.page = 1;
    $$('[data-tab]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    history.replaceState(null, '', '#/people?role=' + state.role);
    load();
  }));
  rows.addEventListener('click', (e) => { const tr = e.target.closest('[data-open]') && e.target.closest('tr'); if (tr) userDetails(tr.dataset.id, load); });
  $('[data-invite]', root)?.addEventListener('click', () => inviteDialog(state.role === 'staff' ? 'admin' : state.role));
  load();
}

async function userDetails(id, refresh) {
  let u;
  try { u = await api('users.get', { id }); } catch (e) { return toast(e.message, 'error'); }
  const isMe = u.id === session.me.user.id;
  const actions = [];
  if (can('users.manage') && !isMe) {
    actions.push(u.status === 'active'
      ? '<button type="button" class="btn danger sm" data-act="suspend">تعليق الحساب</button>'
      : '<button type="button" class="btn secondary sm" data-act="activate">إعادة التفعيل</button>');
    actions.push('<button type="button" class="btn secondary sm" data-act="reset">إرسال رمز استعادة كلمة المرور</button>');
    if (u.activeSessions) actions.push('<button type="button" class="btn secondary sm" data-act="sessions">إنهاء كل الجلسات</button>');
  }
  if (can('roles.manage') && !isMe) actions.push('<button type="button" class="btn secondary sm" data-act="roles">تعديل الأدوار</button>');
  const body = `
    <div class="person" style="margin-bottom:16px"><span class="avatar" style="width:48px;height:48px;font-size:18px">${initials(u.fullName)}</span>
      <div><div class="display" style="font-size:19px">${esc(u.fullName)}</div><div class="small muted num">${esc(u.email)}</div></div></div>
    <dl class="kv">
      <dt>الحالة</dt><dd>${statusBadge(u.status)}</dd>
      <dt>الأدوار</dt><dd>${roleBadges(u.roles)}</dd>
      <dt>الهاتف</dt><dd class="num">${esc(u.phone || '—')}</dd>
      <dt>التحقق الثنائي</dt><dd>${u.mfaEnabled ? 'مفعّل' : 'غير مفعّل'}</dd>
      <dt>الجلسات النشطة</dt><dd>${u.activeSessions}</dd>
      <dt>آخر دخول</dt><dd>${fmtDateTime(u.lastLoginAt)}</dd>
      <dt>تاريخ الانضمام</dt><dd>${fmtDateTime(u.createdAt)}</dd>
    </dl>
    ${actions.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">${actions.join('')}</div>` : ''}
    `;
  const p = dialog({ title: 'ملف المستخدم', body, submitLabel: 'إغلاق' });
  const d = $$('dialog.dialog').pop();
  $('[data-cancel]', d).hidden = true;
  $$('[data-act]', d).forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.act;
    d.close(); d.remove();
    if (act === 'suspend' || act === 'activate') {
      const ok = await dialog({ title: act === 'suspend' ? 'تعليق الحساب' : 'إعادة تفعيل الحساب', danger: act === 'suspend',
        submitLabel: act === 'suspend' ? 'تعليق' : 'إعادة التفعيل',
        body: act === 'suspend' ? `<p style="margin-top:0">سيُسجَّل خروج <b>${esc(u.fullName)}</b> من كل الأجهزة فوراً ولن يتمكن من الدخول.</p>
          <div class="field"><label>السبب (يُحفظ في سجل التدقيق)</label><input class="input" name="reason"></div>` : `<p style="margin-top:0">سيتمكن ${esc(u.fullName)} من الدخول مجدداً.</p>`,
        onSubmit: (f) => mutate('users.setStatus', { id: u.id, status: act === 'suspend' ? 'suspended' : 'active', reason: f.reason }) });
      if (ok) { toast(act === 'suspend' ? 'تم تعليق الحساب' : 'تمت إعادة التفعيل'); refresh(); }
    } else if (act === 'reset') {
      await mutate('users.sendPasswordReset', { id: u.id }).then(() => toast('أُرسل رمز الاستعادة إلى بريد المستخدم'), (e) => toast(e.message, 'error'));
    } else if (act === 'sessions') {
      await mutate('users.revokeSessions', { id: u.id }).then(() => { toast('تم إنهاء الجلسات'); refresh(); }, (e) => toast(e.message, 'error'));
    } else if (act === 'roles') {
      const roles = await api('roles.list');
      const ok = await dialog({ title: 'أدوار ' + u.fullName, submitLabel: 'حفظ',
        body: roles.map((r) => `<label style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--line)">
          <input type="checkbox" name="r_${esc(r.key)}" ${u.roles.includes(r.key) ? 'checked' : ''} style="margin-top:6px">
          <span><b style="font-weight:500">${esc(r.name)}</b><br><span class="small muted">${esc(r.description)}</span></span></label>`).join('') +
          '<p class="small muted">سيُطلب من المستخدم الدخول من جديد لتطبيق الصلاحيات.</p>',
        onSubmit: async (f) => {
          for (const r of roles) {
            const want = f['r_' + r.key] === 'on', has = u.roles.includes(r.key);
            if (want !== has) await mutate('users.setRole', { id: u.id, roleKey: r.key, op: want ? 'add' : 'remove' });
          }
          return true;
        } });
      if (ok) { toast('تم تحديث الأدوار'); refresh(); }
    }
  }));
  await p;
}

async function inviteDialog(defaultRole = 'student') {
  const options = [['student', 'طالب'], ['teacher', 'مدرس']];
  if (can('roles.manage')) options.push(['admin', 'مدير'], ['support', 'موظف دعم'], ['grader', 'مصحح']);
  const res = await dialog({ title: 'دعوة مستخدم جديد', submitLabel: 'إرسال الدعوة', body: `
    <div class="field"><label>البريد الإلكتروني</label><input class="input" name="email" type="email" dir="ltr" required><div class="err"></div></div>
    <div class="field"><label>الدور</label><select class="input" name="roleKey">${options.map(([k, l]) => `<option value="${k}" ${k === defaultRole ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="sendEmail" checked> إرسال الدعوة بالبريد أيضاً</label>`,
    onSubmit: (f) => mutate('invites.create', { email: f.email, roleKey: f.roleKey, sendEmail: f.sendEmail === 'on' }) });
  if (!res) return;
  await dialog({ title: 'تم إنشاء الدعوة', submitLabel: 'تم', body: `
    <p style="margin-top:0">شارك هذا الرمز مع <b class="num">${esc(res.invite.email)}</b> (يظهر الآن فقط ولا يُحفظ نصاً في النظام):</p>
    <div class="secret" style="font-size:22px;letter-spacing:.2em">${esc(res.code)}</div>
    <p class="small muted">صالح حتى ${fmtDate(res.invite.expiresAt)}. يفتح المستخدم التطبيق ← «لدي رمز دعوة».</p>
    <button type="button" class="btn secondary sm" data-copy>نسخ الرمز</button>` });
}
document.addEventListener('click', (e) => {
  if (e.target.matches('[data-copy]')) {
    const code = e.target.closest('.dialog-body').querySelector('.secret').textContent;
    navigator.clipboard?.writeText(code).then(() => toast('نُسخ الرمز'));
  }
});

// ════════════ الدعوات ════════════
export function invites(root) {
  return guarded(root, async () => {
    const res = await api('invites.list', { pageSize: 100 });
    root.innerHTML = head('الأشخاص', 'الدعوات المعلّقة', 'دعوات أُرسلت ولم تُقبل بعد.', `<button class="btn" data-invite>${icon('plus')} دعوة</button>`) + `
      <section class="card">${res.items.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>البريد</th><th>الدور</th><th>أُرسلت</th><th>تنتهي</th><th></th></tr></thead><tbody>
        ${res.items.map((i) => `<tr><td class="num">${esc(i.email)}</td><td>${roleBadges([i.roleKey])}</td><td class="small">${fmtDateTime(i.createdAt)}</td><td class="small">${fmtDate(i.expiresAt)}</td>
          <td style="text-align:left"><button class="btn danger sm" data-revoke="${esc(i.id)}">إلغاء</button></td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا دعوات معلّقة', 'كل الدعوات المرسلة قُبلت أو انتهت.')}</section>`;
    $('[data-invite]', root).onclick = async () => { await inviteDialog(); invites(root); };
    $$('[data-revoke]', root).forEach((b) => b.onclick = async () => {
      b.classList.add('loading');
      try { await mutate('invites.revoke', { id: b.dataset.revoke }); toast('أُلغيت الدعوة'); invites(root); } catch (e) { toast(e.message, 'error'); b.classList.remove('loading'); }
    });
  });
}

// ════════════ الإعدادات ════════════
export function settings(root) {
  return guarded(root, async () => {
    const all = await api('settings.get');
    const v = (k) => all[k]?.value;
    const editable = can('settings.manage');
    const dis = editable ? '' : 'disabled';
    const colors = v('brand.colors') || {};
    const contact = v('contact') || {}; const social = v('social') || {};
    const reg = v('registration') || {}; const comp = v('completion.defaults') || {};
    const cert = v('certificates.template') || {}; const nd = v('notifications.defaults') || {};
    const txt = (name, label, val, attrs = '') => `<div class="field"><label>${label}</label><input class="input" name="${name}" value="${esc(val ?? '')}" ${attrs} ${dis}><div class="err"></div></div>`;
    root.innerHTML = head('النظام', 'إعدادات المنصة', 'تنعكس فوراً على التطبيق ولوحة الإدارة دون إعادة بناء.') +
      (editable ? '' : '<div class="alert info">يمكنك الاطلاع على الإعدادات فقط. التعديل متاح للمدير الأعلى.</div>') + `
      <form novalidate data-settings>
        <div class="alert error" hidden data-alert></div>
        <div class="grid cols-2">
          <section class="card card-pad"><h3 style="margin-bottom:16px">هوية الأكاديمية</h3>
            ${txt('academy.name', 'اسم الأكاديمية', v('academy.name'), 'required')}
            ${txt('academy.tagline', 'الشعار النصي', v('academy.tagline'))}
            <div class="field"><label>نبذة تعريفية</label><textarea class="input" name="about.text" rows="3" ${dis}>${esc(v('about.text'))}</textarea></div>
            <div class="field"><label>الألوان المؤسسية</label><div style="display:flex;gap:14px;flex-wrap:wrap">
              ${[['ivory', 'الخلفية'], ['ink', 'النصوص'], ['green', 'الأساسي'], ['brass', 'اللمسات'], ['warmWhite', 'البطاقات'], ['stone', 'الثانوي']].map(([k, l]) =>
                `<label class="small" style="display:grid;gap:4px;justify-items:center"><input type="color" name="color.${k}" value="${esc(colors[k] || '#000000')}" ${dis} style="width:44px;height:34px;border:1px solid var(--line);border-radius:6px;background:none;padding:2px">${l}</label>`).join('')}
            </div><div class="hint">استخدم ألواناً متقاربة مع الهوية الكلاسيكية؛ النحاسي باعتدال.</div></div>
          </section>
          <section class="card card-pad"><h3 style="margin-bottom:16px">التواصل</h3>
            ${txt('contact.email', 'البريد', contact.email, 'dir="ltr" type="email"')}
            ${txt('contact.phone', 'الهاتف', contact.phone, 'dir="ltr"')}
            ${txt('contact.whatsapp', 'واتساب', contact.whatsapp, 'dir="ltr"')}
            ${txt('contact.address', 'العنوان', contact.address)}
            ${['facebook', 'instagram', 'youtube', 'telegram'].map((k) => txt('social.' + k, k[0].toUpperCase() + k.slice(1), social[k], 'dir="ltr" type="url"')).join('')}
          </section>
          <section class="card card-pad"><h3 style="margin-bottom:16px">التسجيل والتوقيت</h3>
            <div class="field"><label>طريقة التسجيل</label><select class="input" name="registration.mode" ${dis}>
              <option value="open" ${reg.mode === 'open' ? 'selected' : ''}>مفتوح — يستطيع أي شخص إنشاء حساب</option>
              <option value="invite_only" ${reg.mode === 'invite_only' ? 'selected' : ''}>بالدعوة فقط</option></select></div>
            ${txt('timezone', 'المنطقة الزمنية الافتراضية', v('timezone'), 'dir="ltr"')}
          </section>
          <section class="card card-pad"><h3 style="margin-bottom:16px">سياسة إكمال الدورات (افتراضية)</h3>
            ${txt('comp.videoWatchPercent', 'نسبة مشاهدة الفيديو لاعتبار الدرس مكتملاً (%)', comp.videoWatchPercent, 'type="number" min="10" max="100" dir="ltr"')}
            <label class="small" style="display:flex;gap:8px;margin-bottom:8px"><input type="checkbox" name="comp.requireQuizzes" ${comp.requireQuizzes ? 'checked' : ''} ${dis}> النجاح في الاختبارات المطلوبة شرط للإكمال</label>
            <label class="small" style="display:flex;gap:8px"><input type="checkbox" name="comp.requireAssignments" ${comp.requireAssignments ? 'checked' : ''} ${dis}> تسليم الواجبات الإلزامية شرط للإكمال</label>
          </section>
          <section class="card card-pad"><h3 style="margin-bottom:16px">الشهادات</h3>
            ${txt('cert.issuerName', 'الجهة المانحة (افتراضياً اسم الأكاديمية)', cert.issuerName)}
            ${txt('cert.signatureName', 'اسم الموقّع', cert.signatureName)}
            ${txt('cert.signatureTitle', 'صفة الموقّع', cert.signatureTitle)}
            ${txt('cert.verifyBaseUrl', 'رابط صفحة التحقق', cert.verifyBaseUrl || (location.origin + location.pathname.replace(/[^/]*$/, '') + 'verify.html'), 'dir="ltr"')}
          </section>
          <section class="card card-pad"><h3 style="margin-bottom:16px">التذكيرات والنسخ الاحتياطي</h3>
            ${txt('nd.liveSessionReminderMin', 'تذكير الطلاب قبل الحصة المباشرة (دقائق)', nd.liveSessionReminderMin ?? 30, 'type="number" min="5" dir="ltr"')}
            <p class="small muted">تُحفظ نسخة احتياطية من قاعدة البيانات يومياً في مجلد backups على Drive (آخر 14 نسخة).</p>
            ${editable ? '<button type="button" class="btn secondary sm" data-backup>نسخة احتياطية الآن</button>' : ''}
          </section>
          <section class="card card-pad" style="grid-column:1/-1"><h3 style="margin-bottom:16px">النصوص القانونية</h3>
            <div class="field"><label>سياسة الخصوصية</label><textarea class="input" name="legal.privacy" rows="4" ${dis}>${esc(v('legal.privacy'))}</textarea></div>
            <div class="field"><label>الشروط والأحكام</label><textarea class="input" name="legal.terms" rows="4" ${dis}>${esc(v('legal.terms'))}</textarea></div>
          </section>
        </div>
        ${editable ? '<div style="margin-top:20px"><button class="btn" type="submit">حفظ الإعدادات</button></div>' : ''}
      </form>`;
    if (!editable) return;
    const form = $('[data-settings]', root);
    $('[data-backup]', root)?.addEventListener('click', async (e) => {
      e.target.classList.add('loading');
      try { const r = await api('backup.run'); toast('حُفظت النسخة: ' + r.name); } catch (ex) { toast(ex.message, 'error'); } finally { e.target.classList.remove('loading'); }
    });
    bindForm(form, async (f) => {
      const chk = (n) => form.querySelector(`[name="${n}"]`).checked;
      const patch = {
        'academy.name': f['academy.name'], 'academy.tagline': f['academy.tagline'], 'about.text': f['about.text'],
        'brand.colors': Object.fromEntries(Object.keys(colors).map((k) => [k, f['color.' + k]])),
        contact: { email: f['contact.email'], phone: f['contact.phone'], whatsapp: f['contact.whatsapp'], address: f['contact.address'] },
        social: { facebook: f['social.facebook'], instagram: f['social.instagram'], youtube: f['social.youtube'], telegram: f['social.telegram'] },
        registration: { ...reg, mode: f['registration.mode'] }, timezone: f.timezone,
        'completion.defaults': { videoWatchPercent: Number(f['comp.videoWatchPercent']) || 90, requireQuizzes: chk('comp.requireQuizzes'), requireAssignments: chk('comp.requireAssignments') },
        'legal.privacy': f['legal.privacy'], 'legal.terms': f['legal.terms'],
        'certificates.template': { ...cert, issuerName: f['cert.issuerName'], signatureName: f['cert.signatureName'], signatureTitle: f['cert.signatureTitle'], verifyBaseUrl: f['cert.verifyBaseUrl'] },
        'notifications.defaults': { ...nd, liveSessionReminderMin: Number(f['nd.liveSessionReminderMin']) || 30 }
      };
      if (!patch['academy.name']) throw Object.assign(new Error('اسم الأكاديمية مطلوب.'), { fields: { 'academy.name': 'مطلوب' } });
      await mutate('settings.update', patch);
      toast('حُفظت الإعدادات');
      document.dispatchEvent(new CustomEvent('settings-changed'));
    });
  });
}

// ════════════ سجل التدقيق ════════════
export function audit(root) {
  const state = { page: 1, action: '' };
  root.innerHTML = head('النظام', 'سجل التدقيق', 'كل عملية إدارية مسجلة: من نفّذها ومتى.') + `
    <section class="card"><div class="toolbar"><select class="input" data-action style="width:auto" aria-label="نوع العملية"><option value="">كل العمليات</option>
      <option value="users.">إدارة المستخدمين</option><option value="auth.">الأمان والدخول</option><option value="invites.">الدعوات</option><option value="settings.">الإعدادات</option></select></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>العملية</th><th>المنفّذ</th><th>التفاصيل</th><th>الوقت</th></tr></thead><tbody data-rows></tbody></table></div><div class="pager" data-pager></div></section>`;
  const rows = $('[data-rows]', root), pager = $('[data-pager]', root);
  async function load() {
    rows.innerHTML = loadingRows(6, 4);
    try {
      const r = await api('audit.list', { page: state.page, action: state.action });
      rows.innerHTML = r.items.length ? r.items.map((a) => `<tr><td>${esc(actionName(a.action))}</td><td>${esc(a.actorName)}</td>
        <td class="small muted">${esc(Object.entries(a.details || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('، ') : v}`).join(' · ') || '—')}</td>
        <td class="small">${fmtDateTime(a.createdAt)}</td></tr>`).join('') : `<tr><td colspan="4">${emptyState('لا سجلات', 'لا توجد عمليات مطابقة.')}</td></tr>`;
      pager.innerHTML = `<span>${r.total} سجل</span><span style="display:flex;gap:6px;align-items:center"><button class="btn secondary sm" data-prev ${r.page <= 1 ? 'disabled' : ''}>السابق</button><span class="num">${r.page} / ${r.pages}</span><button class="btn secondary sm" data-next ${r.page >= r.pages ? 'disabled' : ''}>التالي</button></span>`;
      $('[data-prev]', pager).onclick = () => { state.page--; load(); };
      $('[data-next]', pager).onclick = () => { state.page++; load(); };
    } catch (e) { rows.innerHTML = `<tr><td colspan="4">${emptyState('تعذّر التحميل', e.message)}</td></tr>`; }
  }
  $('[data-action]', root).onchange = (e) => { state.action = e.target.value; state.page = 1; load(); };
  load();
}

// ════════════ حسابي ════════════
export function account(root) {
  return guarded(root, async () => {
    const me = session.me;
    const sessions = await api('auth.sessions.list');
    root.innerHTML = head('حسابي', me.user.fullName, me.user.email) + `
      <div class="grid cols-2">
        <section class="card card-pad"><h3 style="margin-bottom:16px">البيانات الشخصية</h3>
          <form novalidate data-profile><div class="alert error" hidden data-alert></div>
            <div class="field"><label>الاسم الكامل</label><input class="input" name="fullName" value="${esc(me.user.fullName)}" required><div class="err"></div></div>
            <div class="field"><label>الهاتف</label><input class="input" name="phone" dir="ltr" value="${esc(me.user.phone)}"></div>
            <button class="btn" type="submit">حفظ</button></form>
        </section>
        <section class="card card-pad"><h3 style="margin-bottom:16px">تغيير كلمة المرور</h3>
          <form novalidate data-password><div class="alert error" hidden data-alert></div>
            <div class="field"><label>كلمة المرور الحالية</label><input class="input" type="password" name="currentPassword" dir="ltr" required autocomplete="current-password"><div class="err"></div></div>
            <div class="field"><label>كلمة المرور الجديدة</label><input class="input" type="password" name="newPassword" dir="ltr" required autocomplete="new-password"><div class="hint">سيتم إنهاء جلساتك على الأجهزة الأخرى.</div><div class="err"></div></div>
            <button class="btn" type="submit">تغيير</button></form>
        </section>
        <section class="card" style="grid-column:1/-1"><div class="card-head"><h3>الجلسات النشطة</h3><span class="badge ${me.user.mfaEnabled ? 'ok' : 'warn'}">التحقق الثنائي ${me.user.mfaEnabled ? 'مفعّل' : 'غير مفعّل'}</span></div>
          <div class="table-wrap"><table class="table"><thead><tr><th>الجهاز</th><th>آخر نشاط</th><th>تنتهي</th><th></th></tr></thead><tbody>
          ${sessions.map((s) => `<tr><td>${esc(s.device || 'غير معروف')} ${s.current ? '<span class="badge ok">هذه الجلسة</span>' : ''}</td><td class="small">${fmtDateTime(s.lastSeenAt)}</td><td class="small">${fmtDateTime(s.expiresAt)}</td>
            <td style="text-align:left">${s.current ? '' : `<button class="btn danger sm" data-revoke="${esc(s.id)}">إنهاء</button>`}</td></tr>`).join('')}
          </tbody></table></div></section>
      </div>`;
    bindForm($('[data-profile]', root), async (f) => { const u = await mutate('profile.update', f); session.me.user = u; toast('حُفظت البيانات'); document.dispatchEvent(new CustomEvent('me-changed')); });
    bindForm($('[data-password]', root), async (f) => { await mutate('auth.changePassword', f); toast('تم تغيير كلمة المرور'); $('[data-password]', root).reset(); account(root); });
    $$('[data-revoke]', root).forEach((b) => b.onclick = async () => { await mutate('auth.sessions.revoke', { sessionId: b.dataset.revoke }); toast('أُنهيت الجلسة'); account(root); });
  });
}
