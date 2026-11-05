// صفحات التشغيل: البث المباشر والحضور، الدفعات، الإشعارات، الدعم، الشهادات، التحليلات.
import { api, mutate, can, session } from './api.js';
import { esc, $, $$, toast, dialog, icon, fmtDateTime, fmtDate, emptyState, loadingRows, formDialog, confirmDialog, downloadText, downloadBase64, statusBadgeOf, initials } from './ui.js';

const head = (eyebrow, title, sub, actions = '') => `
  <div class="page-head"><div><div class="eyebrow"><span class="ornament"></span>${esc(eyebrow)}</div>
  <h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div></div>`;
async function guarded(root, fn) {
  try { await fn(); } catch (e) {
    root.innerHTML = `<div class="card">${emptyState('تعذّر تحميل البيانات', e.message, '<button class="btn secondary" data-retry>إعادة المحاولة</button>')}</div>`;
    $('[data-retry]', root).onclick = () => guarded(root, fn);
  }
}
const run = async (btn, fn, okMsg) => {
  btn?.classList.add('loading');
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, 'error'); return null; } finally { btn?.classList.remove('loading'); }
};
const PROVIDER = { meet: 'Google Meet', zoom: 'Zoom', youtube: 'YouTube Live', teams: 'Teams', link: 'رابط' };
const LIVE_STATE = { live: ['bad', 'مباشر الآن'], scheduled: ['', 'مجدولة'], ended: ['ok', 'انتهت'], cancelled: ['', 'ملغاة'] };

// ════════════ البث المباشر ════════════
export function live(root) {
  return guarded(root, async () => {
    const [list, courses] = await Promise.all([api('live.adminList'), api('courses.adminList', { pageSize: 100 })]);
    const nowLive = list.filter((s) => s.state === 'live');
    root.innerHTML = head('البث والحضور', 'الحصص المباشرة', 'ابدأ بثاً بضغطة واحدة، يصل الطلاب إليه من التطبيق ويُسجَّل حضورهم تلقائياً.',
      `<button class="btn secondary" data-schedule>${icon('plus')} جدولة حصة</button>`) + `
      <div class="live-hero"><div><h3>${nowLive.length ? '<span class="live-dot"></span>' + esc(nowLive[0].title) : 'ابدأ بثاً مباشراً الآن'}</h3>
        <p>${nowLive.length ? 'البث جارٍ — الطلاب يرون زر «انضم الآن» في الصفحة الرئيسية للتطبيق.' : 'يُنشأ رابط Google Meet تلقائياً ويصل إشعار «انضم الآن» لكل طلاب الدورة. أو الصق رابط Zoom / YouTube Live.'}</p></div>
        <div style="display:flex;gap:8px">${nowLive.length ? `<a class="btn" href="${esc(nowLive[0].joinUrl)}" target="_blank" rel="noopener">فتح البث</a><button class="btn secondary" style="--fg:var(--ivory);--bd:rgba(255,255,255,.4)" data-end="${nowLive[0].id}">إنهاء</button>` : '<button class="btn" data-start>🔴 ابدأ البث الآن</button>'}</div></div>
      <section class="card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الحصة</th><th>الدورة</th><th>الموعد</th><th>المنصة</th><th>الحالة</th><th>الحضور</th><th></th></tr></thead><tbody>
      ${list.map((s) => `<tr><td><b style="font-weight:500">${esc(s.title)}</b></td><td class="small">${esc(s.courseTitle)}</td><td class="small">${fmtDateTime(s.startsAt)}</td><td class="small">${PROVIDER[s.provider] || '—'}</td>
        <td>${statusBadgeOf(LIVE_STATE, s.state)}</td><td class="num">${s.attendanceCount}</td><td style="text-align:left;white-space:nowrap">
        ${s.joinUrl && s.state !== 'ended' && s.state !== 'cancelled' ? `<a class="btn ghost sm" href="${esc(s.joinUrl)}" target="_blank" rel="noopener">فتح</a>` : ''}
        <button class="btn ghost sm" data-att="${s.id}">الحضور</button>${s.state === 'scheduled' ? `<button class="btn ghost sm" data-edit="${s.id}">تعديل</button><button class="btn danger sm" data-cancel="${s.id}">إلغاء</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا حصص بعد', 'ابدأ بثاً الآن أو جدول حصة قادمة.')}</section>`;
    const courseOpts = courses.items.map((c) => [c.id, c.title]);
    if (!courseOpts.length) { $('[data-start]', root)?.setAttribute('disabled', ''); }
    $('[data-start]', root)?.addEventListener('click', async () => {
      const r = await formDialog({ title: 'بث مباشر الآن', submitLabel: 'ابدأ البث', fields: [
        { name: 'courseId', label: 'لطلاب دورة', type: 'select', options: courseOpts, required: true },
        { name: 'title', label: 'عنوان البث', placeholder: 'مثلاً: مراجعة الوحدة الأولى' },
        { name: 'joinUrl', label: 'رابط البث (اختياري)', ltr: true, placeholder: 'اتركه فارغاً لإنشاء رابط Google Meet تلقائياً', hint: 'يمكنك لصق رابط Zoom أو YouTube Live أو Meet موجود.' },
        { name: 'durationMin', label: 'المدة المتوقعة (دقائق)', type: 'number', default: 90, min: 10 }
      ], onSubmit: (v) => mutate('live.startNow', v) });
      if (r) {
        toast('بدأ البث وأُرسل الإشعار للطلاب');
        window.open(r.joinUrl, '_blank', 'noopener');
        live(root);
      }
    });
    const sched = async (s) => {
      const r = await formDialog({ title: s ? 'تعديل الحصة' : 'جدولة حصة مباشرة', wide: true, values: s || { durationMin: 60 }, fields: [
        { name: 'title', label: 'العنوان', required: true, full: true },
        { name: 'courseId', label: 'الدورة', type: 'select', options: courseOpts, required: true },
        { name: 'startsAt', label: 'الموعد', type: 'datetime', required: true },
        { name: 'durationMin', label: 'المدة (دقائق)', type: 'number', min: 5 },
        { name: 'joinUrl', label: 'رابط البث (اختياري)', ltr: true, hint: 'فارغ = يُنشأ رابط Google Meet تلقائياً.' },
        { name: 'description', label: 'وصف', type: 'textarea', rows: 2, full: true }
      ], onSubmit: (v) => mutate('live.save', { ...v, id: s?.id }) });
      if (r) { toast(s ? 'حُفظت الحصة' : 'جُدولت الحصة وأُشعر الطلاب'); live(root); }
    };
    $('[data-schedule]', root).onclick = () => sched(null);
    $$('[data-edit]', root).forEach((b) => (b.onclick = () => sched(list.find((x) => x.id === b.dataset.edit))));
    $$('[data-cancel]', root).forEach((b) => (b.onclick = async () => { if (await confirmDialog('إلغاء الحصة', 'ستختفي الحصة من تقويم الطلاب.', 'إلغاء الحصة')) (await run(b, () => api('live.end', { id: b.dataset.cancel, cancel: true }), 'أُلغيت')) && live(root); }));
    $$('[data-end]', root).forEach((b) => (b.onclick = async () => (await run(b, () => api('live.end', { id: b.dataset.end }), 'انتهى البث')) && live(root)));
    $$('[data-att]', root).forEach((b) => (b.onclick = () => attendanceDialog(b.dataset.att)));
  });
}

async function attendanceDialog(id) {
  const r = await api('live.attendance', { id });
  const body = r.items.length ? `<p class="small muted" style="margin-top:0">من ضغط «انضم» في التطبيق يُسجّل حاضراً تلقائياً. عدّل يدوياً عند الحاجة.</p>
    <table class="table"><tbody>${r.items.map((x) => `<tr><td>${esc(x.fullName)}<div class="small muted">${x.markedBy === 'auto' ? 'تسجيل تلقائي' : ''}</div></td>
    <td><select class="input" data-u="${x.userId}" style="min-height:36px;padding:4px 10px">${[['present', 'حاضر'], ['late', 'متأخر'], ['absent', 'غائب']].map(([k, l]) => `<option value="${k}" ${x.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`
    : emptyState('لا طلاب', 'لا يوجد طلاب مسجلون في دورة هذه الحصة.');
  const changed = {};
  const p = dialog({ title: 'حضور: ' + r.session.title, body, submitLabel: 'حفظ', onSubmit: async () => {
    for (const [userId, status] of Object.entries(changed)) await api('live.mark', { id, userId, status });
    return true;
  } });
  const d = $$('dialog.dialog').pop();
  $$('[data-u]', d).forEach((s) => (s.onchange = () => { changed[s.dataset.u] = s.value; }));
  if (await p && Object.keys(changed).length) toast('حُفظ الحضور');
}

// ════════════ الدفعات ════════════
export function cohorts(root) {
  return guarded(root, async () => {
    const [list, courses] = await Promise.all([api('cohorts.list'), api('courses.adminList', { pageSize: 100 })]);
    root.innerHTML = head('الأشخاص', 'الدفعات والمجموعات', 'أضف طلاب الدفعة مرة واحدة فيُسجَّلون في كل دوراتها.', `<button class="btn" data-add>${icon('plus')} دفعة جديدة</button>`) +
      `<section class="card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الدفعة</th><th>الدورات</th><th>الأعضاء</th><th>الفترة</th><th></th></tr></thead><tbody>
      ${list.map((c) => `<tr><td><b style="font-weight:500">${esc(c.name)}</b></td><td class="small">${esc(c.courseTitles.join('، ') || '—')}</td><td class="num">${c.memberCount}</td>
      <td class="small">${c.startDate ? fmtDate(c.startDate) : '—'} ${c.endDate ? '← ' + fmtDate(c.endDate) : ''}</td>
      <td style="text-align:left;white-space:nowrap"><button class="btn ghost sm" data-members="${c.id}">الأعضاء</button><button class="btn ghost sm" data-edit="${c.id}">تعديل</button></td></tr>`).join('')}</tbody></table></div>`
        : emptyState('لا دفعات', 'الدفعة طريقة سريعة لتسجيل مجموعة طلاب في عدة دورات معاً.')}</section>`;
    const edit = async (c) => {
      if (await formDialog({ title: c ? 'تعديل الدفعة' : 'دفعة جديدة', values: c || {}, fields: [
        { name: 'name', label: 'اسم الدفعة', required: true },
        { name: 'courseIds', label: 'دورات الدفعة', type: 'checks', options: courses.items.map((x) => [x.id, x.title]) },
        { name: 'startDate', label: 'تاريخ البدء', type: 'datetime' }, { name: 'endDate', label: 'تاريخ الانتهاء', type: 'datetime' },
        { name: 'description', label: 'وصف', type: 'textarea', rows: 2 }
      ], onSubmit: (v) => mutate('cohorts.save', { ...v, id: c?.id }) })) { toast('حُفظت الدفعة'); cohorts(root); }
    };
    $('[data-add]', root).onclick = () => edit(null);
    $$('[data-edit]', root).forEach((b) => (b.onclick = () => edit(list.find((x) => x.id === b.dataset.edit))));
    $$('[data-members]', root).forEach((b) => (b.onclick = async () => {
      const id = b.dataset.members;
      const members = await api('cohorts.members', { cohortId: id });
      const p = dialog({ title: 'أعضاء الدفعة', submitLabel: 'إضافة', body: `
        ${members.length ? `<ul class="list-plain" style="border:1px solid var(--line);border-radius:8px;margin-bottom:14px">${members.map((m) => `<li><span class="avatar" style="width:28px;height:28px;font-size:12px">${initials(m.fullName)}</span><div style="flex:1">${esc(m.fullName)}<div class="small muted num">${esc(m.email)}</div></div><button type="button" class="btn danger sm" data-rm="${m.id}">إزالة</button></li>`).join('')}</ul>` : '<p class="muted small">لا أعضاء بعد.</p>'}
        <div class="field"><label>إضافة طلاب (بريد في كل سطر)</label><textarea class="input" name="emails" rows="4" dir="ltr"></textarea></div>`,
        onSubmit: (f) => { const emails = f.emails.split('\n').map((x) => x.trim()).filter(Boolean); return emails.length ? mutate('cohorts.addMembers', { cohortId: id, emails }) : true; } });
      const d = $$('dialog.dialog').pop();
      $$('[data-rm]', d).forEach((x) => (x.onclick = async () => { if (await run(x, () => api('cohorts.removeMember', { id: x.dataset.rm }))) x.closest('li').remove(); }));
      const r = await p;
      if (r && r.added) { toast(`أُضيف ${r.added} طالب وسُجّلوا في دورات الدفعة`); cohorts(root); }
    }));
  });
}

// ════════════ الإشعارات ════════════
export function notifications(root) {
  return guarded(root, async () => {
    const [list, courses, cohortList] = await Promise.all([api('notifications.adminList', { pageSize: 50 }), api('courses.adminList', { pageSize: 100 }), can('cohorts.manage') ? api('cohorts.list') : Promise.resolve([])]);
    const ST = { sent: ['ok', 'أُرسل'], scheduled: ['warn', 'مجدول'], sending: ['', 'قيد الإرسال'] };
    const TARGET = { all: 'كل الطلاب', course: 'طلاب دورة', cohort: 'دفعة' };
    root.innerHTML = head('التواصل', 'الإشعارات والإعلانات', 'تصل داخل التطبيق فوراً أو في موعد تحدده.', `<button class="btn" data-new>${icon('plus')} إشعار جديد</button>`) +
      `<section class="card">${list.items.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الإشعار</th><th>الجمهور</th><th>الحالة</th><th>قرأه</th><th>التاريخ</th></tr></thead><tbody>
      ${list.items.map((n) => `<tr><td><b style="font-weight:500">${esc(n.title)}</b><div class="small muted">${esc(n.body)}</div></td><td class="small">${TARGET[n.targetType] || n.targetType}</td>
      <td>${statusBadgeOf(ST, n.status)}</td><td class="num small">${n.status === 'sent' ? `${n.readCount} / ${n.recipientCount || 0}` : '—'}</td><td class="small">${fmtDateTime(n.sentAt || n.scheduledAt || n.createdAt)}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لم تُرسل إشعارات بعد', 'أرسل إعلاناً لكل الطلاب أو لطلاب دورة محددة.')}</section>`;
    $('[data-new]', root).onclick = async () => {
      const targets = [];
      if (can('notifications.send')) targets.push(['all', 'كل الطلاب']);
      targets.push(['course', 'طلاب دورة']);
      if (cohortList.length) targets.push(['cohort', 'دفعة']);
      const p = formDialog({ title: 'إشعار جديد', submitLabel: 'إرسال', fields: [
        { name: 'title', label: 'العنوان', required: true },
        { name: 'body', label: 'النص', type: 'textarea', rows: 4 },
        { name: 'targetType', label: 'إلى', type: 'select', options: targets },
        { name: 'courseId', label: 'الدورة', type: 'select', options: courses.items.map((c) => [c.id, c.title]) },
        { name: 'cohortId', label: 'الدفعة', type: 'select', options: cohortList.map((c) => [c.id, c.name]) },
        { name: 'scheduledAt', label: 'جدولة الإرسال (اختياري)', type: 'datetime', hint: 'فارغ = إرسال فوري.' }
      ], onSubmit: (v) => mutate('notifications.send', { title: v.title, body: v.body, targetType: v.targetType, targetId: v.targetType === 'course' ? v.courseId : v.targetType === 'cohort' ? v.cohortId : '', scheduledAt: v.scheduledAt }) });
      const d = $$('dialog.dialog').pop();
      const sync = () => {
        const t = $('[name="targetType"]', d).value;
        $('[name="courseId"]', d).closest('.field').hidden = t !== 'course';
        $('[name="cohortId"]', d).closest('.field').hidden = t !== 'cohort';
      };
      $('[name="targetType"]', d).onchange = sync; sync();
      if (await p) { toast('أُرسل الإشعار'); notifications(root); }
    };
  });
}

// ════════════ الدعم ════════════
export function support(root) {
  const state = { status: 'open' };
  root.innerHTML = head('التواصل', 'طلبات الدعم', 'استفسارات الطلاب ومشكلاتهم التقنية.') + `
    <div class="tabs">${[['open', 'مفتوحة'], ['answered', 'تم الرد'], ['closed', 'مغلقة'], ['', 'الكل']].map(([k, l]) => `<button class="tab" data-st="${k}" aria-selected="${k === state.status}">${l}</button>`).join('')}</div>
    <section class="card"><div class="table-wrap"><table class="table"><thead><tr><th>الموضوع</th><th>الطالب</th><th>التصنيف</th><th>آخر رسالة</th><th></th></tr></thead><tbody data-rows></tbody></table></div></section>`;
  const rows = $('[data-rows]', root);
  const CAT = { technical: 'تقني', academic: 'أكاديمي', account: 'الحساب', other: 'أخرى' };
  async function load() {
    rows.innerHTML = loadingRows(3, 5);
    try {
      const r = await api('support.adminList', { status: state.status, pageSize: 100 });
      rows.innerHTML = r.items.length ? r.items.map((t) => `<tr><td><b style="font-weight:500">${esc(t.subject)}</b></td><td>${esc(t.fullName)}<div class="small muted num">${esc(t.email)}</div></td>
        <td><span class="mini">${CAT[t.category]}</span></td><td class="small">${fmtDateTime(t.lastMessageAt)}</td><td style="text-align:left"><button class="btn sm ghost" data-open="${t.id}">فتح</button></td></tr>`).join('')
        : `<tr><td colspan="5">${emptyState('لا طلبات', 'لا توجد طلبات دعم في هذا القسم.')}</td></tr>`;
      $$('[data-open]', rows).forEach((b) => (b.onclick = async () => {
        const t = r.items.find((x) => x.id === b.dataset.open);
        const p = dialog({ title: t.subject, submitLabel: 'إرسال الرد', body: `<div class="thread">${(t.messages || []).map((m) => `<div class="msg ${m.staff ? 'staff' : ''}"><div class="who">${esc(m.fromName)} · ${fmtDateTime(m.at)}</div>${esc(m.text)}</div>`).join('')}</div>
          <div class="field" style="margin-top:14px"><label>ردّك</label><textarea class="input" name="text" rows="3" required></textarea></div>
          ${t.status !== 'closed' ? '<button type="button" class="btn secondary sm" data-close>إغلاق الطلب</button>' : ''}`,
          onSubmit: (f) => (f.text ? mutate('support.reply', { id: t.id, text: f.text }) : true) });
        const d = $$('dialog.dialog').pop();
        $('[data-close]', d)?.addEventListener('click', async (e) => { if (await run(e.target, () => api('support.setStatus', { id: t.id, status: 'closed' }), 'أُغلق الطلب')) { d.close(); d.remove(); load(); } });
        if (await p) { toast('أُرسل الرد وأُشعر الطالب'); load(); }
      }));
    } catch (e) { rows.innerHTML = `<tr><td colspan="5">${emptyState('تعذّر التحميل', e.message)}</td></tr>`; }
  }
  $$('[data-st]', root).forEach((b) => (b.onclick = () => { state.status = b.dataset.st; $$('[data-st]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b))); load(); }));
  load();
}

// ════════════ الشهادات ════════════
export function certificates(root) {
  const state = { q: '' };
  root.innerHTML = head('التشغيل', 'الشهادات', 'تُصدر تلقائياً عند إكمال الدورة، ويمكن التحقق منها برقمها التسلسلي.', `<a class="btn secondary" href="verify.html" target="_blank" rel="noopener">صفحة التحقق العامة</a><button class="btn" data-issue>${icon('plus')} إصدار يدوي</button>`) + `
    <section class="card"><div class="toolbar"><input class="input search" type="search" placeholder="بحث بالاسم أو الرقم أو الدورة" data-q></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>الطالب</th><th>الدورة</th><th>الرقم</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody data-rows></tbody></table></div></section>`;
  const rows = $('[data-rows]', root);
  async function load() {
    rows.innerHTML = loadingRows(3, 6);
    try {
      const r = await api('certificates.adminList', { q: state.q, pageSize: 100 });
      rows.innerHTML = r.items.length ? r.items.map((c) => `<tr><td>${esc(c.studentName)}</td><td class="small">${esc(c.courseTitle)}</td><td class="num small">${esc(c.serial)}</td><td class="small">${fmtDate(c.issuedAt)}</td>
        <td>${c.status === 'valid' ? '<span class="badge ok">صالحة</span>' : `<span class="badge bad" title="${esc(c.revokedReason)}">ملغاة</span>`}</td>
        <td style="text-align:left;white-space:nowrap"><button class="btn ghost sm" data-pdf="${c.id}">PDF</button>${c.status === 'valid' ? `<button class="btn danger sm" data-revoke="${c.id}">إلغاء</button>` : ''}</td></tr>`).join('')
        : `<tr><td colspan="6">${emptyState('لا شهادات بعد', 'تظهر هنا الشهادات فور إكمال الطلاب دوراتهم.')}</td></tr>`;
      $$('[data-pdf]', rows).forEach((b) => (b.onclick = async () => { const f = await run(b, () => api('files.get', { certificateId: b.dataset.pdf })); if (f) downloadBase64(f.name, f.base64, f.mimeType); }));
      $$('[data-revoke]', rows).forEach((b) => (b.onclick = async () => {
        if (await formDialog({ title: 'إلغاء الشهادة', submitLabel: 'إلغاء الشهادة', fields: [{ name: 'reason', label: 'السبب (يظهر في صفحة التحقق)', required: true }], onSubmit: (v) => api('certificates.revoke', { id: b.dataset.revoke, reason: v.reason }) })) { toast('أُلغيت الشهادة'); load(); }
      }));
    } catch (e) { rows.innerHTML = `<tr><td colspan="6">${emptyState('تعذّر التحميل', e.message)}</td></tr>`; }
  }
  $('[data-issue]', root).onclick = async () => {
    const courses = await api('courses.adminList', { pageSize: 100 });
    const r = await formDialog({ title: 'إصدار شهادة يدوياً', fields: [
      { name: 'email', label: 'بريد الطالب', type: 'email', ltr: true, required: true },
      { name: 'courseId', label: 'الدورة', type: 'select', options: courses.items.map((c) => [c.id, c.title]) }
    ], onSubmit: async (v) => {
      const u = await api('users.list', { q: v.email, role: 'student' });
      const user = u.items.find((x) => x.email === v.email.toLowerCase());
      if (!user) throw Object.assign(new Error('لا يوجد طالب بهذا البريد.'), { fields: { email: 'غير موجود' } });
      return mutate('certificates.issue', { userId: user.id, courseId: v.courseId });
    } });
    if (r) { toast('صدرت الشهادة ' + r.serial); load(); }
  };
  let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; load(); }, 300); };
  load();
}

// ════════════ التحليلات ════════════
export function analytics(root) {
  return guarded(root, async () => {
    const a = await api('analytics.overview');
    const max = Math.max(1, ...a.enrollmentsByDay.map((d) => d.enrollments));
    const stat = (l, v, s = '') => `<div class="card stat"><div class="label">${l}</div><div class="value">${v}</div>${s ? `<div class="sub">${s}</div>` : ''}</div>`;
    root.innerHTML = head('نظرة عامة', 'التحليلات', 'أرقام فعلية من نشاط الطلاب.', `<select class="input" style="width:auto" data-type><option value="enrollments">التسجيلات والتقدم</option><option value="grades">الدرجات</option><option value="attendance">الحضور</option>${can('reports.export') ? '<option value="students">الطلاب</option>' : ''}</select><button class="btn secondary" data-export>تصدير CSV</button>`) + `
      <div class="grid cols-4" style="margin-bottom:20px">${stat('التسجيلات', a.totals.enrollments)}${stat('أكملوا دوراتهم', a.totals.completed)}${stat('متوسط الدرجات', a.totals.avgScore === null ? '—' : a.totals.avgScore + '%')}${stat('شهادات صادرة', a.totals.certificates)}</div>
      <section class="card" style="margin-bottom:20px"><div class="card-head"><h3>التسجيلات الجديدة — آخر 30 يوماً</h3></div>
        <div class="chart">${a.enrollmentsByDay.map((d) => `<div style="height:${Math.max(2, (d.enrollments / max) * 100)}%" data-tip="${d.date}: ${d.enrollments}"></div>`).join('')}</div></section>
      <div class="grid cols-main">
        <section class="card"><div class="card-head"><h3>أداء الدورات</h3></div>${a.courses.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الدورة</th><th>مسجلون</th><th>أكملوا</th><th>متوسط التقدم</th><th>متوسط الدرجات</th></tr></thead><tbody>
          ${a.courses.map((c) => `<tr><td>${esc(c.title)}</td><td class="num">${c.enrolled}</td><td class="num">${c.completed}</td><td><div style="display:flex;gap:8px;align-items:center"><div class="bar"><i style="width:${c.avgProgress}%"></i></div><span class="small num">${c.avgProgress}%</span></div></td><td class="num">${c.avgScore === null ? '—' : c.avgScore + '%'}</td></tr>`).join('')}
          </tbody></table></div>` : emptyState('لا دورات', '')}</section>
        <section class="card"><div class="card-head"><h3>طلاب يحتاجون متابعة</h3><span class="mini">${a.struggling.length}</span></div>
          ${a.struggling.length ? `<ul class="list-plain">${a.struggling.slice(0, 15).map((s) => `<li><span class="dot" style="background:var(--warning)"></span><div style="flex:1"><b style="font-weight:500">${esc(s.fullName)}</b><div class="small muted">${esc(s.courseTitle)} · ${esc(s.reason)} · تقدم ${s.percent}%</div></div></li>`).join('')}</ul>` : emptyState('لا متعثرين', 'كل الطلاب النشطين يتقدمون بشكل جيد.')}</section>
      </div>`;
    $('[data-export]', root).onclick = async (e) => { const r = await run(e.target, () => api('reports.export', { type: $('[data-type]', root).value })); if (r) downloadText(r.fileName, r.csv); };
  });
}
