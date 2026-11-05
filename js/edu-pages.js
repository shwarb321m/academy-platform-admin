// صفحات التعليم: الأقسام، الدورات ومحرر البناء، مكتبة الوسائط، بنك الأسئلة، الاختبارات، الواجبات.
import { api, mutate, can } from './api.js';
import {
  esc, $, $$, toast, dialog, icon, fmtDateTime, fmtDate, emptyState, loadingRows, formDialog, confirmDialog, fieldsHtml, readFields,
  readFileBase64, downloadText, downloadBase64, COURSE_STATUS, statusBadgeOf, fmtSize, initials, showFieldErrors
} from './ui.js';

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

const SVG = {
  up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 15 6-6 6 6"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 9 6 6 6-6"/></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  clip: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7"/></svg>'
};

// ════════════ الأقسام ════════════
const CAT_FIELDS = [
  { name: 'name', label: 'اسم القسم', required: true },
  { name: 'description', label: 'الوصف', type: 'textarea', rows: 3 },
  { name: 'order', label: 'الترتيب', type: 'number', default: 0 },
  { name: 'status', label: 'الحالة', type: 'select', options: [['published', 'منشور'], ['draft', 'مسودة'], ['archived', 'مؤرشف']] }
];

export function categories(root) {
  return guarded(root, async () => {
    const list = await api('categories.list');
    root.innerHTML = head('التعليم', 'الأقسام', 'تنظيم الدورات في أقسام رئيسية تظهر للطالب.', `<button class="btn" data-add>${icon('plus')} قسم جديد</button>`) +
      `<section class="card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>القسم</th><th>الدورات</th><th>الحالة</th><th>الترتيب</th><th></th></tr></thead><tbody>
      ${list.map((c) => `<tr><td><b style="font-weight:500">${esc(c.name)}</b><div class="small muted">${esc(c.description || '')}</div></td><td>${c.courseCount}</td>
      <td>${statusBadgeOf(COURSE_STATUS, c.status)}</td><td class="num">${c.order || 0}</td>
      <td style="text-align:left;white-space:nowrap"><button class="icon-btn" data-edit="${c.id}" title="تعديل">${SVG.edit}</button><button class="icon-btn" data-del="${c.id}" title="حذف">${SVG.trash}</button></td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا أقسام بعد', 'أنشئ أول قسم لتنظيم دوراتك (مثل: اللغة العربية، الرياضيات).', `<button class="btn" data-add>${icon('plus')} قسم جديد</button>`)}</section>`;
    const edit = async (c) => {
      const r = await formDialog({ title: c ? 'تعديل القسم' : 'قسم جديد', fields: CAT_FIELDS, values: c || { status: 'published' },
        onSubmit: (v) => mutate('categories.save', { ...v, id: c?.id }) });
      if (r) { toast('حُفظ القسم'); categories(root); }
    };
    $$('[data-add]', root).forEach((b) => (b.onclick = () => edit(null)));
    $$('[data-edit]', root).forEach((b) => (b.onclick = () => edit(list.find((x) => x.id === b.dataset.edit))));
    $$('[data-del]', root).forEach((b) => (b.onclick = async () => {
      if (await confirmDialog('حذف القسم', 'سيُحذف القسم نهائياً.', 'حذف')) await run(b, () => mutate('categories.delete', { id: b.dataset.del }), 'حُذف القسم') && categories(root);
    }));
  });
}

// ════════════ الدورات ════════════
async function courseFields(course) {
  const [cats, teachers] = await Promise.all([api('categories.list'), can('courses.manage') ? api('teachers.list') : Promise.resolve([])]);
  const f = [
    { name: 'title', label: 'عنوان الدورة', required: true, full: true },
    { name: 'summary', label: 'وصف مختصر (يظهر في البطاقة)', full: true },
    { name: 'description', label: 'الوصف الكامل', type: 'textarea', rows: 5, full: true },
    { name: 'categoryId', label: 'القسم', type: 'select', options: [['', '— بدون —'], ...cats.map((c) => [c.id, c.name])] },
    { name: 'level', label: 'المستوى', type: 'select', options: [['', '—'], ['مبتدئ', 'مبتدئ'], ['متوسط', 'متوسط'], ['متقدم', 'متقدم']] },
    { name: 'estimatedHours', label: 'المدة التقديرية (ساعات)', type: 'number', min: 0 },
    { name: 'enrollmentMode', label: 'طريقة التسجيل', type: 'select', options: [['open', 'مفتوح — يسجّل الطالب بنفسه'], ['approval', 'بطلب يحتاج موافقة'], ['admin', 'الإدارة فقط تسجّل الطلاب'], ['invite', 'بالدعوة فقط']] },
    { name: 'outcomes', label: 'ماذا سيتعلم الطالب؟ (سطر لكل نقطة)', type: 'textarea', rows: 3, list: true, full: true },
    { name: 'requirements', label: 'المتطلبات (سطر لكل نقطة)', type: 'textarea', rows: 2, list: true, full: true },
    { name: 'publishAt', label: 'جدولة النشر (اختياري)', type: 'datetime' },
    { name: 'availableUntil', label: 'متاحة حتى (اختياري)', type: 'datetime' }
  ];
  if (can('courses.manage')) f.push({ name: 'teacherIds', label: 'المدرسون المسؤولون', type: 'checks', full: true, options: teachers.map((t) => [t.userId, t.fullName]) });
  f.push({ name: 'cert', label: 'إصدار شهادة تلقائياً عند إكمال الدورة', type: 'checkbox', full: true });
  const values = course ? { ...course, outcomes: (course.outcomes || []).join('\n'), requirements: (course.requirements || []).join('\n'), cert: course.completionRules?.certificate !== false } : { enrollmentMode: 'open', cert: true };
  return { f, values };
}

async function coverPicker(dlg, current) {
  const box = document.createElement('div');
  box.className = 'field';
  box.innerHTML = `<label>صورة الغلاف</label><div style="display:flex;gap:12px;align-items:center"><div class="course-cover" style="width:160px;border-radius:8px;${current ? `background-image:url('${esc(current.url)}')` : ''}" data-prev>${current ? '' : '<span class="ornament"></span>'}</div>
    <div><input type="file" accept="image/*" data-file hidden><button type="button" class="btn secondary sm" data-pick>اختيار صورة</button><div class="hint">JPG/PNG حتى 5 ميغابايت، نسبة 16:9.</div></div></div>`;
  $('.form-grid', dlg).prepend(box);
  const state = { fileId: current?.fileId || '' };
  $('[data-pick]', box).onclick = () => $('[data-file]', box).click();
  $('[data-file]', box).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const btn = $('[data-pick]', box); btn.classList.add('loading');
    try {
      const b64 = await readFileBase64(file, 5);
      const a = await mutate('media.upload', { title: file.name, mimeType: file.type, base64: b64, visibility: 'public' });
      state.fileId = a.driveFileId;
      const prev = $('[data-prev]', box); prev.style.backgroundImage = `url('${a.url}')`; prev.innerHTML = '';
    } catch (ex) { toast(ex.message, 'error'); } finally { btn.classList.remove('loading'); }
  };
  return state;
}

export async function editCourseDialog(course) {
  const { f, values } = await courseFields(course);
  let cover;
  const p = formDialog({ title: course ? 'تفاصيل الدورة' : 'دورة جديدة', fields: f, values, wide: true, submitLabel: course ? 'حفظ' : 'إنشاء الدورة',
    onSubmit: (v) => {
      const payload = { ...v, id: course?.id, coverFileId: cover.fileId, completionRules: { ...(course?.completionRules || {}), certificate: v.cert } };
      delete payload.cert;
      return mutate('courses.save', payload);
    } });
  cover = await coverPicker($$('dialog.dialog').pop(), course?.coverFileId ? { fileId: course.coverFileId, url: course.coverUrl } : null);
  return p;
}

export function courses(root) {
  const state = { q: '', status: '', categoryId: '' };
  root.innerHTML = head('التعليم', 'الدورات', 'أنشئ الدورات، نظّم محتواها، وتابع طلابها.', can('courses.manage') ? `<button class="btn" data-add>${icon('plus')} دورة جديدة</button>` : '') + `
    <div class="card" style="margin-bottom:18px"><div class="toolbar" style="border:0">
      <input class="input search" type="search" placeholder="ابحث في الدورات" data-q>
      <select class="input" style="width:auto" data-status><option value="">كل الحالات</option><option value="published">منشورة</option><option value="draft">مسودات</option><option value="archived">مؤرشفة</option></select>
    </div></div><div data-list></div>`;
  const listEl = $('[data-list]', root);
  async function load() {
    listEl.innerHTML = '<div class="course-grid">' + Array.from({ length: 3 }, () => '<div class="card"><div class="course-cover"></div><div class="body"><div class="skeleton"></div></div></div>').join('') + '</div>';
    try {
      const r = await api('courses.adminList', { ...state, pageSize: 100 });
      listEl.innerHTML = r.items.length ? `<div class="course-grid">${r.items.map((c) => `
        <a class="card course-card" href="#/course?id=${c.id}">
          <div class="course-cover" style="${c.coverUrl ? `background-image:url('${esc(c.coverUrl)}')` : ''}">${c.coverUrl ? '' : '<span class="ornament"></span>'}${statusBadgeOf(COURSE_STATUS, c.status)}</div>
          <div class="body"><span class="small" style="color:var(--brass)">${esc(c.categoryName || 'بدون قسم')}</span><h4>${esc(c.title)}</h4>
            <div class="meta"><span>${c.lessonCount} درس</span><span>${c.enrolledCount} طالب</span>${c.pendingCount ? `<span style="color:var(--warning)">${c.pendingCount} بانتظار الموافقة</span>` : ''}</div>
            <div class="small muted">${esc(c.teacherNames.join('، ') || 'لا مدرس مسند')}</div></div></a>`).join('')}</div>`
        : `<div class="card">${emptyState(state.q ? 'لا نتائج' : 'لا دورات بعد', state.q ? 'جرّب كلمات أخرى.' : 'ابدأ بإنشاء أول دورة، ثم أضف وحداتها ودروسها.', can('courses.manage') && !state.q ? `<button class="btn" data-add2>${icon('plus')} دورة جديدة</button>` : '')}</div>`;
      $('[data-add2]', listEl)?.addEventListener('click', add);
    } catch (e) { listEl.innerHTML = `<div class="card">${emptyState('تعذّر التحميل', e.message)}</div>`; }
  }
  const add = async () => { const c = await editCourseDialog(null); if (c) { toast('أُنشئت الدورة'); location.hash = '#/course?id=' + c.id; } };
  $('[data-add]', root)?.addEventListener('click', add);
  let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; load(); }, 300); };
  $('[data-status]', root).onchange = (e) => { state.status = e.target.value; load(); };
  load();
}

// ════════════ محرر بناء الدورة ════════════
const VIDEO_PROVIDERS = [['none', 'بدون فيديو'], ['youtube', 'YouTube (غير مدرج)'], ['drive', 'Google Drive'], ['url', 'رابط مباشر (mp4)']];

export function courseBuilder(root, params) {
  const id = params.get('id');
  let tab = params.get('tab') || 'content';
  return guarded(root, async () => {
    const c = await api('courses.adminGet', { id });
    root.innerHTML = `
      <div class="page-head"><div>
        <div class="eyebrow"><span class="ornament"></span><a href="#/courses">الدورات</a> / ${esc(c.categoryName || 'بدون قسم')}</div>
        <h1>${esc(c.title)}</h1><p>${statusBadgeOf(COURSE_STATUS, c.status)} · ${c.lessonCount} درس · ${c.enrolledCount} طالب</p>
      </div><div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn secondary" data-edit>تفاصيل الدورة</button>
        ${can('courses.manage') ? '<button class="btn secondary" data-dup>نسخ الدورة</button>' : ''}
        ${c.status === 'published' ? '<button class="btn secondary" data-status="draft">إلغاء النشر</button>' : '<button class="btn" data-status="published">نشر الدورة</button>'}
      </div></div>
      <div class="tabs" role="tablist">
        ${[['content', 'المحتوى'], ['students', 'الطلاب'], ['assess', 'الاختبارات والواجبات']].map(([k, l]) => `<button class="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}
      </div><div data-pane></div>`;
    $('[data-edit]', root).onclick = async () => { if (await editCourseDialog(c)) { toast('حُفظت التفاصيل'); courseBuilder(root, params); } };
    $('[data-dup]', root)?.addEventListener('click', async (e) => { const d = await run(e.target, () => mutate('courses.duplicate', { id: c.id }), 'نُسخت الدورة كمسودة'); if (d) location.hash = '#/course?id=' + d.id; });
    $$('[data-status]', root).forEach((b) => (b.onclick = async () => { if (await run(b, () => api('courses.setStatus', { id: c.id, status: b.dataset.status }), b.dataset.status === 'published' ? 'نُشرت الدورة' : 'أُلغي النشر')) courseBuilder(root, params); }));
    const pane = $('[data-pane]', root);
    const show = () => {
      $$('[data-tab]', root).forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === tab)));
      history.replaceState(null, '', `#/course?id=${c.id}&tab=${tab}`);
      if (tab === 'content') contentPane(pane, c, () => courseBuilder(root, new URLSearchParams(`id=${c.id}&tab=content`)));
      else if (tab === 'students') studentsPane(pane, c);
      else assessPane(pane, c);
    };
    $$('[data-tab]', root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; show(); }));
    show();
  });
}

function contentPane(pane, c, reload) {
  const mods = c.modules;
  pane.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:16px"><button class="btn" data-addmod>${icon('plus')} وحدة جديدة</button></div>
    ${mods.length ? `<div class="tree">${mods.map((m, mi) => `
      <section class="module" data-mod="${m.id}">
        <div class="module-head"><span class="mini">الوحدة ${mi + 1}</span><h4>${esc(m.title)}</h4>${m.status === 'draft' ? '<span class="badge warn">مسودة</span>' : ''}
          <button class="icon-btn" data-mup="${mi}" ${mi === 0 ? 'disabled' : ''} title="أعلى">${SVG.up}</button><button class="icon-btn" data-mdown="${mi}" ${mi === mods.length - 1 ? 'disabled' : ''} title="أسفل">${SVG.down}</button>
          <button class="icon-btn" data-medit="${m.id}" title="تعديل">${SVG.edit}</button><button class="icon-btn" data-mdel="${m.id}" title="حذف">${SVG.trash}</button>
          <button class="btn secondary sm" data-addles="${m.id}">${icon('plus', 15)} درس</button></div>
        ${m.lessons.length ? m.lessons.map((l, li) => `
          <div class="lesson-row"><span class="num muted" style="width:22px">${li + 1}</span>
            <div class="t"><b>${esc(l.title)}</b><div class="tags">
              ${l.status === 'published' ? '<span class="mini" style="color:var(--success)">منشور</span>' : '<span class="mini" style="color:var(--warning)">مسودة</span>'}
              ${l.videoProvider !== 'none' ? `<span class="mini">فيديو ${l.videoProvider === 'youtube' ? 'YouTube' : l.videoProvider === 'drive' ? 'Drive' : 'رابط'}</span>` : ''}
              ${l.resources.length ? `<span class="mini">${l.resources.length} مرفق</span>` : ''}${l.quizId ? '<span class="mini">اختبار</span>' : ''}${l.isPreview ? '<span class="mini">معاينة مجانية</span>' : ''}</div></div>
            <button class="icon-btn" data-lup="${mi}:${li}" ${li === 0 ? 'disabled' : ''}>${SVG.up}</button><button class="icon-btn" data-ldown="${mi}:${li}" ${li === m.lessons.length - 1 ? 'disabled' : ''}>${SVG.down}</button>
            <button class="icon-btn" data-res="${l.id}" title="المرفقات">${SVG.clip}</button><button class="icon-btn" data-ledit="${l.id}" title="تعديل">${SVG.edit}</button><button class="icon-btn" data-ldel="${l.id}" title="حذف">${SVG.trash}</button>
          </div>`).join('') : '<div class="lesson-row muted small">لا دروس في هذه الوحدة بعد.</div>'}
      </section>`).join('')}</div>` : `<div class="card">${emptyState('ابدأ ببناء المحتوى', 'الدورة تتكون من وحدات، وكل وحدة تحتوي دروساً.', `<button class="btn" data-addmod>${icon('plus')} وحدة جديدة</button>`)}</div>`}`;

  const allLessons = mods.flatMap((m) => m.lessons);
  const structure = () => mods.map((m) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) }));
  const reorder = async (s) => { try { await api('content.reorder', { courseId: c.id, modules: s }); reload(); } catch (e) { toast(e.message, 'error'); } };
  const swap = (arr, i, j) => { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; return arr; };

  const MOD_FIELDS = [{ name: 'title', label: 'عنوان الوحدة', required: true }, { name: 'description', label: 'وصف', type: 'textarea', rows: 2 },
    { name: 'status', label: 'الحالة', type: 'select', options: [['published', 'منشورة'], ['draft', 'مسودة (مخفية)']] }];
  const editMod = async (m) => { if (await formDialog({ title: m ? 'تعديل الوحدة' : 'وحدة جديدة', fields: MOD_FIELDS, values: m || { status: 'published' }, onSubmit: (v) => mutate('modules.save', { ...v, id: m?.id, courseId: c.id }) })) reload(); };
  $$('[data-addmod]', pane).forEach((b) => (b.onclick = () => editMod(null)));
  $$('[data-medit]', pane).forEach((b) => (b.onclick = () => editMod(mods.find((m) => m.id === b.dataset.medit))));
  $$('[data-mdel]', pane).forEach((b) => (b.onclick = async () => { if (await confirmDialog('حذف الوحدة', 'يجب أن تكون الوحدة فارغة.', 'حذف')) (await run(b, () => api('modules.delete', { id: b.dataset.mdel }), 'حُذفت')) && reload(); }));
  $$('[data-mup]', pane).forEach((b) => (b.onclick = () => { const i = +b.dataset.mup; reorder(swap(structure(), i, i - 1)); }));
  $$('[data-mdown]', pane).forEach((b) => (b.onclick = () => { const i = +b.dataset.mdown; reorder(swap(structure(), i, i + 1)); }));
  $$('[data-lup]', pane).forEach((b) => (b.onclick = () => { const [mi, li] = b.dataset.lup.split(':').map(Number); const s = structure(); swap(s[mi].lessonIds, li, li - 1); reorder(s); }));
  $$('[data-ldown]', pane).forEach((b) => (b.onclick = () => { const [mi, li] = b.dataset.ldown.split(':').map(Number); const s = structure(); swap(s[mi].lessonIds, li, li + 1); reorder(s); }));

  const editLesson = async (l, moduleId) => {
    const fields = [
      { name: 'title', label: 'عنوان الدرس', required: true, full: true },
      { name: 'moduleId', label: 'الوحدة', type: 'select', options: mods.map((m) => [m.id, m.title]) },
      { name: 'status', label: 'الحالة', type: 'select', options: [['draft', 'مسودة'], ['published', 'منشور']] },
      { name: 'description', label: 'شرح الدرس (يظهر تحت الفيديو)', type: 'textarea', rows: 5, full: true },
      { name: 'videoProvider', label: 'الفيديو', type: 'select', options: VIDEO_PROVIDERS },
      { name: 'videoRef', label: 'رابط الفيديو', ltr: true, placeholder: 'https://youtu.be/...', hint: 'YouTube: اجعل الفيديو «غير مدرج». Drive: يُشارك تلقائياً لمن لديه الرابط.' },
      { name: 'durationMin', label: 'مدة الفيديو (دقائق)', type: 'number', min: 0 },
      { name: 'completionThreshold', label: 'نسبة المشاهدة للإكمال % (فارغ = الافتراضي)', type: 'number', min: 10, max: 100 },
      { name: 'quizId', label: 'اختبار الدرس (اختياري)', type: 'select', options: [['', '— بدون —'], ...c.quizzes.map((q) => [q.id, q.title])] },
      { name: 'prerequisiteLessonIds', label: 'دروس يجب إكمالها قبل هذا الدرس', type: 'checks', full: true, options: allLessons.filter((x) => x.id !== l?.id).map((x) => [x.id, x.title]) },
      { name: 'isPreview', label: 'معاينة مجانية (يراه غير المسجلين)', type: 'checkbox', full: true }
    ];
    const values = l ? { ...l, durationMin: l.durationSec ? Math.round(l.durationSec / 60) : '', completionThreshold: l.completionThreshold || '',
      videoRef: l.videoProvider === 'youtube' ? 'https://youtu.be/' + l.videoRef : l.videoProvider === 'drive' ? 'https://drive.google.com/file/d/' + l.videoRef + '/view' : l.videoRef } : { moduleId, status: 'draft', videoProvider: 'youtube' };
    if (await formDialog({ title: l ? 'تعديل الدرس' : 'درس جديد', fields, values, wide: true, onSubmit: (v) => mutate('lessons.save', { ...v, id: l?.id, courseId: c.id }) })) { toast('حُفظ الدرس'); reload(); }
  };
  $$('[data-addles]', pane).forEach((b) => (b.onclick = () => editLesson(null, b.dataset.addles)));
  $$('[data-ledit]', pane).forEach((b) => (b.onclick = () => editLesson(allLessons.find((x) => x.id === b.dataset.ledit))));
  $$('[data-ldel]', pane).forEach((b) => (b.onclick = async () => { if (await confirmDialog('حذف الدرس', 'سيُحذف الدرس ومرفقاته من الدورة.', 'حذف')) (await run(b, () => api('lessons.delete', { id: b.dataset.ldel }), 'حُذف الدرس')) && reload(); }));
  $$('[data-res]', pane).forEach((b) => (b.onclick = () => resourcesDialog(allLessons.find((x) => x.id === b.dataset.res), reload)));
}

async function resourcesDialog(l, reload) {
  let changed = false;
  const render = (d) => {
    $('[data-resbox]', d).innerHTML = `
      ${l.resources.length ? `<ul class="list-plain" style="border:1px solid var(--line);border-radius:8px;margin-bottom:16px">${l.resources.map((r) => `<li><span class="dot"></span><div style="flex:1">${esc(r.title)}<div class="small muted">${esc(r.mimeType)}</div></div><button type="button" class="icon-btn" data-rdel="${r.id}">${SVG.trash}</button></li>`).join('')}</ul>` : '<p class="muted small">لا مرفقات بعد.</p>'}
      <div class="drop" data-drop>اسحب ملف PDF أو صورة هنا، أو <b style="color:var(--green)">اختر ملفاً</b><div class="small">حتى 25 ميغابايت · يبقى الملف خاصاً ولا يصل إليه إلا طلاب الدورة</div></div>
      <input type="file" hidden data-file accept=".pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,audio/*">
      <div class="small muted" style="margin-top:10px" data-status></div>`;
    const drop = $('[data-drop]', d), input = $('[data-file]', d);
    drop.onclick = () => input.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); upload(e.dataTransfer.files[0], d); };
    input.onchange = (e) => upload(e.target.files[0], d);
    $$('[data-rdel]', d).forEach((b) => (b.onclick = async () => {
      if (await run(b, () => api('resources.delete', { id: b.dataset.rdel }))) { l.resources = l.resources.filter((r) => r.id !== b.dataset.rdel); changed = true; render(d); }
    }));
  };
  const upload = async (file, d) => {
    if (!file) return;
    const st = $('[data-status]', d);
    st.textContent = 'جارٍ رفع ' + file.name + '…';
    try {
      const b64 = await readFileBase64(file);
      const a = await mutate('media.upload', { title: file.name, mimeType: file.type || 'application/octet-stream', base64: b64 });
      const r = await mutate('resources.add', { lessonId: l.id, mediaAssetId: a.id });
      l.resources.push({ ...r, mimeType: a.mimeType });
      changed = true; render(d); toast('أُضيف المرفق');
    } catch (e) { st.textContent = e.message; }
  };
  const p = dialog({ title: 'مرفقات: ' + l.title, body: '<div data-resbox></div>', submitLabel: 'تم' });
  const d = $$('dialog.dialog').pop();
  $('[data-cancel]', d).hidden = true;
  render(d);
  await p;
  if (changed) reload();
}

function studentsPane(pane, c) {
  const state = { q: '', status: '' };
  pane.innerHTML = `<section class="card"><div class="toolbar"><input class="input search" type="search" placeholder="بحث" data-q>
    <select class="input" style="width:auto" data-st><option value="">الكل</option><option value="pending">بانتظار الموافقة</option><option value="active">نشط</option><option value="completed">أكمل الدورة</option></select>
    ${can('enrollments.manage') ? `<button class="btn sm" data-add>${icon('plus', 15)} تسجيل طلاب</button>` : ''}</div>
    <div class="table-wrap"><table class="table"><thead><tr><th>الطالب</th><th>الحالة</th><th>التقدم</th><th>آخر نشاط</th><th></th></tr></thead><tbody data-rows></tbody></table></div></section>`;
  const rows = $('[data-rows]', pane);
  const ST = { active: ['ok', 'نشط'], pending: ['warn', 'بانتظار الموافقة'], completed: ['ok', 'أكمل'] };
  async function load() {
    rows.innerHTML = loadingRows(4, 5);
    try {
      const r = await api('enrollments.list', { courseId: c.id, ...state, pageSize: 100 });
      rows.innerHTML = r.items.length ? r.items.map((e) => `<tr><td><div class="person"><span class="avatar">${initials(e.fullName)}</span><div>${esc(e.fullName)}<div class="small muted num">${esc(e.email)}</div></div></div></td>
        <td>${statusBadgeOf(ST, e.status)}</td><td><div style="display:flex;align-items:center;gap:8px"><div class="bar"><i style="width:${e.percent}%"></i></div><span class="small num">${e.percent}%</span></div></td>
        <td class="small">${fmtDateTime(e.lastActivityAt)}</td><td style="text-align:left;white-space:nowrap">
        ${can('enrollments.manage') && e.status === 'pending' ? `<button class="btn sm" data-approve="${e.userId}">موافقة</button>` : ''}
        ${can('enrollments.manage') ? `<button class="btn danger sm" data-remove="${e.id}">إزالة</button>` : ''}</td></tr>`).join('')
        : `<tr><td colspan="5">${emptyState('لا طلاب', 'لم يسجّل أحد في هذه الدورة بعد.')}</td></tr>`;
      $$('[data-approve]', rows).forEach((b) => (b.onclick = async () => (await run(b, () => mutate('enrollments.add', { courseId: c.id, userIds: [b.dataset.approve] }), 'تمت الموافقة')) && load()));
      $$('[data-remove]', rows).forEach((b) => (b.onclick = async () => { if (await confirmDialog('إزالة الطالب', 'سيفقد الطالب الوصول إلى الدورة. يبقى سجله محفوظاً.', 'إزالة')) (await run(b, () => api('enrollments.setStatus', { id: b.dataset.remove, status: 'removed' }), 'أُزيل')) && load(); }));
    } catch (e) { rows.innerHTML = `<tr><td colspan="5">${emptyState('تعذّر التحميل', e.message)}</td></tr>`; }
  }
  let t; $('[data-q]', pane).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; load(); }, 300); };
  $('[data-st]', pane).onchange = (e) => { state.status = e.target.value; load(); };
  $('[data-add]', pane)?.addEventListener('click', async () => {
    const r = await formDialog({ title: 'تسجيل طلاب في الدورة', fields: [{ name: 'emails', label: 'بريد الطلاب (سطر لكل بريد)', type: 'textarea', rows: 6, list: true, ltr: true, required: true, hint: 'يجب أن يكون لدى الطالب حساب. لغير المسجلين استخدم «الدعوات».' }],
      onSubmit: (v) => mutate('enrollments.add', { courseId: c.id, emails: v.emails }) });
    if (r) { toast(`سُجّل ${r.added} طالب`); load(); }
  });
  load();
}

function assessPane(pane, c) {
  pane.innerHTML = `<div class="grid cols-2">
    <section class="card"><div class="card-head"><h3>الاختبارات</h3><a class="btn sm" href="#/quiz?courseId=${c.id}">${icon('plus', 15)} اختبار</a></div>
      ${c.quizzes.length ? `<ul class="list-plain">${c.quizzes.map((q) => `<li><span class="dot"></span><a style="flex:1" href="#/quiz?id=${q.id}">${esc(q.title)}</a>${statusBadgeOf(COURSE_STATUS, q.status)}</li>`).join('')}</ul>` : emptyState('لا اختبارات', 'أنشئ اختباراً واربطه بدرس أو اجعله اختباراً نهائياً.')}</section>
    <section class="card"><div class="card-head"><h3>الواجبات</h3><button class="btn sm" data-asg>${icon('plus', 15)} واجب</button></div>
      ${c.assignments.length ? `<ul class="list-plain">${c.assignments.map((a) => `<li><span class="dot"></span><a style="flex:1" href="#/assignment?id=${a.id}">${esc(a.title)}</a><span class="small muted">${a.dueAt ? 'التسليم ' + fmtDate(a.dueAt) : ''}</span></li>`).join('')}</ul>` : emptyState('لا واجبات', 'أضف واجباً يسلّمه الطالب نصاً أو ملفاً.')}</section></div>`;
  $('[data-asg]', pane).onclick = async () => { const a = await assignmentDialog(null, c); if (a) location.hash = '#/assignment?id=' + a.id; };
}

// ════════════ مكتبة الوسائط ════════════
export function media(root) {
  const state = { kind: '', q: '' };
  root.innerHTML = head('التعليم', 'مكتبة الوسائط', 'الملفات المرفوعة إلى Google Drive الخاص بالأكاديمية.', `<button class="btn" data-up>${icon('plus')} رفع ملف</button><input type="file" hidden data-file>`) + `
    <section class="card"><div class="toolbar"><input class="input search" type="search" placeholder="بحث" data-q>
      <select class="input" style="width:auto" data-kind><option value="">كل الأنواع</option><option value="pdf">PDF</option><option value="image">صور</option><option value="video">فيديو</option><option value="audio">صوت</option><option value="file">أخرى</option></select></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>الملف</th><th>النوع</th><th>الحجم</th><th>مستخدم في</th><th>تاريخ الرفع</th><th></th></tr></thead><tbody data-rows></tbody></table></div></section>`;
  const rows = $('[data-rows]', root);
  const KIND = { pdf: 'PDF', image: 'صورة', video: 'فيديو', audio: 'صوت', file: 'ملف' };
  async function load() {
    rows.innerHTML = loadingRows(4, 6);
    try {
      const r = await api('media.list', { ...state, pageSize: 100 });
      rows.innerHTML = r.items.length ? r.items.map((m) => `<tr><td>${m.url ? `<img src="${esc(m.url)}" alt="" style="width:44px;height:30px;object-fit:cover;border-radius:4px;vertical-align:middle;margin-left:8px">` : ''}${esc(m.title)}</td>
        <td><span class="mini">${KIND[m.kind] || m.kind}</span></td><td class="small num">${fmtSize(m.sizeBytes)}</td><td class="small">${m.usedIn ? m.usedIn + ' درس' : '—'}</td><td class="small">${fmtDate(m.createdAt)}</td>
        <td style="text-align:left;white-space:nowrap"><button class="btn ghost sm" data-dl="${m.id}">تنزيل</button><button class="icon-btn" data-del="${m.id}">${SVG.trash}</button></td></tr>`).join('')
        : `<tr><td colspan="6">${emptyState('المكتبة فارغة', 'ارفع ملفات PDF والصور والفيديو لاستخدامها في الدروس.')}</td></tr>`;
      $$('[data-dl]', rows).forEach((b) => (b.onclick = async () => { const f = await run(b, () => api('files.get', { mediaAssetId: b.dataset.dl })); if (f) downloadBase64(f.name, f.base64, f.mimeType); }));
      $$('[data-del]', rows).forEach((b) => (b.onclick = async () => { if (await confirmDialog('حذف الملف', 'سيُنقل الملف إلى سلة Drive.', 'حذف')) (await run(b, () => api('media.delete', { id: b.dataset.del }), 'حُذف')) && load(); }));
    } catch (e) { rows.innerHTML = `<tr><td colspan="6">${emptyState('تعذّر التحميل', e.message)}</td></tr>`; }
  }
  $('[data-up]', root).onclick = () => $('[data-file]', root).click();
  $('[data-file]', root).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const b = $('[data-up]', root);
    await run(b, async () => mutate('media.upload', { title: file.name, mimeType: file.type || 'application/octet-stream', base64: await readFileBase64(file) }), 'رُفع الملف');
    e.target.value = ''; load();
  };
  let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; load(); }, 300); };
  $('[data-kind]', root).onchange = (e) => { state.kind = e.target.value; load(); };
  load();
}

// ════════════ بنك الأسئلة ════════════
const QTYPE_NAMES = { single: 'اختيار من متعدد (إجابة واحدة)', multi: 'اختيار من متعدد (عدة إجابات)', truefalse: 'صح أو خطأ', short: 'إجابة قصيرة', essay: 'سؤال مقالي', match: 'مطابقة', order: 'ترتيب' };

export async function questionDialog(q, bankId) {
  const type0 = q?.type || 'single';
  const body = `<div class="form-grid two">
      <div class="field"><label>نوع السؤال</label><select class="input" name="type">${Object.entries(QTYPE_NAMES).map(([k, v]) => `<option value="${k}" ${k === type0 ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="field"><label>الدرجة</label><input class="input" type="number" name="points" min="0" step="0.5" dir="ltr" value="${q?.points ?? 1}"></div>
      <div class="field" style="grid-column:1/-1"><label>نص السؤال *</label><textarea class="input" name="text" rows="3" required>${esc(q?.text || '')}</textarea><div class="err"></div></div>
    </div><div data-answer></div>
    <div class="form-grid two"><div class="field"><label>الصعوبة</label><select class="input" name="difficulty">${[['easy', 'سهل'], ['medium', 'متوسط'], ['hard', 'صعب']].map(([k, l]) => `<option value="${k}" ${(q?.difficulty || 'medium') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label>شرح الإجابة (يظهر بعد التصحيح)</label><input class="input" name="explanation" value="${esc(q?.explanation || '')}"></div></div>`;
  const p = dialog({ title: q ? 'تعديل السؤال' : 'سؤال جديد', body, submitLabel: 'حفظ السؤال', onSubmit: (_r, d) => {
    const f = $('form', d);
    const type = f.type.value;
    const payload = { id: q?.id, bankId, type, text: f.text.value.trim(), points: Number(f.points.value) || 1, difficulty: f.difficulty.value, explanation: f.explanation.value.trim() };
    if (type === 'truefalse') payload.correctAnswer = f.querySelector('[name="tf"]:checked')?.value === 'true';
    else if (type === 'short') payload.correctAnswer = f.short.value.split('\n').map((x) => x.trim()).filter(Boolean);
    else if (type !== 'essay') payload.options = $$('.opt-row', f).map((row) => ({ text: $('[data-t]', row).value.trim(), isCorrect: !!$('[data-c]', row)?.checked, matchKey: $('[data-m]', row)?.value.trim() || '' })).filter((o) => o.text);
    return mutate('questions.save', payload);
  } });
  const d = $$('dialog.dialog').pop();
  d.classList.add('wide');
  const box = $('[data-answer]', d);
  const optRow = (type, o = {}) => `<div class="opt-row">
      ${type === 'single' ? `<input type="radio" name="correct" data-c ${o.isCorrect ? 'checked' : ''} title="الإجابة الصحيحة">` : type === 'multi' ? `<input type="checkbox" data-c ${o.isCorrect ? 'checked' : ''} title="إجابة صحيحة">` : `<span class="mini num">${type === 'order' ? '⇅' : '↔'}</span>`}
      <input class="input" data-t placeholder="${type === 'match' ? 'العنصر' : type === 'order' ? 'عنصر (بالترتيب الصحيح)' : 'نص الخيار'}" value="${esc(o.text || '')}">
      ${type === 'match' ? `<input class="input" data-m placeholder="نظيره الصحيح" value="${esc(o.matchKey || '')}">` : ''}
      <button type="button" class="icon-btn" data-rm>${SVG.trash}</button></div>`;
  const draw = (type) => {
    const opts = q && q.type === type ? q.options : [];
    if (type === 'truefalse') box.innerHTML = `<div class="field"><label>الإجابة الصحيحة</label><div style="display:flex;gap:18px"><label class="check"><input type="radio" name="tf" value="true" ${q?.correctAnswer === true ? 'checked' : ''}> صح</label><label class="check"><input type="radio" name="tf" value="false" ${q?.correctAnswer === false ? 'checked' : ''}> خطأ</label></div></div>`;
    else if (type === 'short') box.innerHTML = `<div class="field"><label>الإجابات المقبولة (سطر لكل صيغة)</label><textarea class="input" name="short" rows="3">${esc((q?.type === 'short' ? q.correctAnswer || [] : []).join('\n'))}</textarea><div class="hint">المقارنة تتجاهل التشكيل والهمزات والتاء المربوطة.</div></div>`;
    else if (type === 'essay') box.innerHTML = '<p class="alert info">السؤال المقالي يُصحَّح يدوياً من صفحة نتائج الاختبار.</p>';
    else {
      const hint = { single: 'حدد الدائرة بجانب الإجابة الصحيحة.', multi: 'حدد كل الإجابات الصحيحة.', match: 'اكتب كل عنصر ونظيره الصحيح؛ تُخلط النظائر للطالب.', order: 'اكتب العناصر بالترتيب الصحيح؛ تُخلط للطالب.' }[type];
      const list = opts.length ? opts : [{}, {}, {}];
      box.innerHTML = `<div class="field"><label>الخيارات</label><div class="hint" style="margin-bottom:8px">${hint}</div><div data-opts>${list.map((o) => optRow(type, o)).join('')}</div>
        <button type="button" class="btn secondary sm" data-addopt>${icon('plus', 14)} خيار</button></div>`;
      $('[data-addopt]', box).onclick = () => { $('[data-opts]', box).insertAdjacentHTML('beforeend', optRow(type)); bindRm(); };
      bindRm();
    }
  };
  const bindRm = () => $$('[data-rm]', box).forEach((b) => (b.onclick = () => b.closest('.opt-row').remove()));
  $('[name="type"]', d).onchange = (e) => draw(e.target.value);
  draw(type0);
  return p;
}

export function questions(root, params) {
  return guarded(root, async () => {
    const [banks, courseList] = await Promise.all([api('banks.list'), api('courses.adminList', { pageSize: 100 })]);
    let bankId = params.get('bank') || banks[0]?.id || '';
    root.innerHTML = head('التقييم', 'بنك الأسئلة', 'أسئلة قابلة لإعادة الاستخدام في عدة اختبارات.', `<button class="btn secondary" data-newbank>${icon('plus')} بنك جديد</button>${banks.length ? `<button class="btn" data-newq>${icon('plus')} سؤال</button>` : ''}`) +
      (banks.length ? `<div class="tabs">${banks.map((b) => `<button class="tab" data-bank="${b.id}" aria-selected="${b.id === bankId}">${esc(b.name)} <span class="mini">${b.questionCount}</span></button>`).join('')}</div>
      <section class="card"><div class="toolbar"><input class="input search" type="search" placeholder="بحث في الأسئلة" data-q></div><div data-list></div></section>`
        : `<div class="card">${emptyState('لا بنوك أسئلة', 'أنشئ بنكاً لكل دورة أو موضوع، ثم أضف أسئلته.', `<button class="btn" data-newbank2>${icon('plus')} بنك جديد</button>`)}</div>`);
    const newBank = async () => {
      const b = await formDialog({ title: 'بنك أسئلة جديد', fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'courseId', label: 'الدورة', type: 'select', options: [['', '— عام —'], ...courseList.items.map((c) => [c.id, c.title])] }, { name: 'description', label: 'وصف', type: 'textarea', rows: 2 }],
        onSubmit: (v) => mutate('banks.save', v) });
      if (b) questions(root, new URLSearchParams('bank=' + b.id));
    };
    $('[data-newbank]', root).onclick = newBank;
    $('[data-newbank2]', root)?.addEventListener('click', newBank);
    if (!banks.length) return;
    const list = $('[data-list]', root);
    let q = '';
    async function load() {
      list.innerHTML = '<div style="padding:20px"><div class="skeleton"></div></div>';
      const r = await api('questions.list', { bankId, q });
      list.innerHTML = r.items.length ? `<ul class="list-plain">${r.items.map((x) => `<li><span class="dot"></span><div style="flex:1"><div>${esc(x.text)}</div><div class="tags" style="display:flex;gap:6px;margin-top:4px"><span class="mini">${QTYPE_NAMES[x.type]}</span><span class="mini">${x.points} درجة</span></div></div>
        <button class="icon-btn" data-e="${x.id}">${SVG.edit}</button><button class="icon-btn" data-d="${x.id}">${SVG.trash}</button></li>`).join('')}</ul>` : emptyState('البنك فارغ', 'أضف أول سؤال.');
      $$('[data-e]', list).forEach((b) => (b.onclick = async () => { if (await questionDialog(r.items.find((x) => x.id === b.dataset.e), bankId)) { toast('حُفظ السؤال'); load(); } }));
      $$('[data-d]', list).forEach((b) => (b.onclick = async () => { if (await confirmDialog('حذف السؤال', 'سيُحذف السؤال نهائياً.', 'حذف')) (await run(b, () => api('questions.delete', { id: b.dataset.d }), 'حُذف')) && load(); }));
    }
    $$('[data-bank]', root).forEach((b) => (b.onclick = () => { bankId = b.dataset.bank; $$('[data-bank]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b))); load(); }));
    $('[data-newq]', root).onclick = async () => { if (await questionDialog(null, bankId)) { toast('أُضيف السؤال'); load(); } };
    let t; $('[data-q]', root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; load(); }, 300); };
    load();
  });
}

// ════════════ الاختبارات ════════════
export function quizzes(root) {
  return guarded(root, async () => {
    const list = await api('quizzes.list');
    root.innerHTML = head('التقييم', 'الاختبارات', 'إعداد الاختبارات ومتابعة النتائج والتصحيح.', `<a class="btn" href="#/quiz">${icon('plus')} اختبار جديد</a>`) +
      `<section class="card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الاختبار</th><th>الدورة</th><th>الحالة</th><th>المحاولات</th><th>المتوسط</th><th>بانتظار التصحيح</th></tr></thead><tbody>
      ${list.map((q) => `<tr><td><a href="#/quiz?id=${q.id}">${esc(q.title)}</a></td><td class="small">${esc(q.courseTitle)}</td><td>${statusBadgeOf(COURSE_STATUS, q.status)}</td>
      <td class="num">${q.attemptCount}</td><td class="num">${q.avgPercent === null ? '—' : q.avgPercent + '%'}</td><td>${q.pendingReview ? `<span class="badge warn">${q.pendingReview}</span>` : '—'}</td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا اختبارات', 'أنشئ أول اختبار من الأسئلة في بنك الأسئلة.')}</section>`;
  });
}

export function quizEditor(root, params) {
  return guarded(root, async () => {
    const id = params.get('id');
    const [quiz, courseList, banks] = await Promise.all([id ? api('quizzes.get', { id }) : Promise.resolve(null), api('courses.adminList', { pageSize: 100 }), api('banks.list')]);
    const courseId = quiz?.courseId || params.get('courseId') || courseList.items[0]?.id;
    if (!courseList.items.length) { root.innerHTML = head('التقييم', 'اختبار جديد', '') + `<div class="card">${emptyState('لا دورات', 'أنشئ دورة أولاً.')}</div>`; return; }
    const course = await api('courses.adminGet', { id: courseId });
    const lessons = course.modules.flatMap((m) => m.lessons);
    const pool = (await Promise.all(banks.filter((b) => !b.courseId || b.courseId === courseId).map((b) => api('questions.list', { bankId: b.id })))).flatMap((r) => r.items);
    const selected = new Set(quiz?.questionIds || []);
    let tab = params.get('tab') || 'settings';
    const fields = [
      { name: 'title', label: 'عنوان الاختبار', required: true, full: true },
      { name: 'courseId', label: 'الدورة', type: 'select', options: courseList.items.map((c) => [c.id, c.title]) },
      { name: 'lessonId', label: 'مرتبط بدرس (اختياري)', type: 'select', options: [['', '— اختبار مستقل —'], ...lessons.map((l) => [l.id, l.title])] },
      { name: 'description', label: 'التعليمات', type: 'textarea', rows: 3, full: true },
      { name: 'durationMin', label: 'المدة بالدقائق (0 = بلا حد)', type: 'number', min: 0, default: 0 },
      { name: 'passPercent', label: 'درجة النجاح %', type: 'number', min: 0, max: 100, default: 50 },
      { name: 'maxAttempts', label: 'عدد المحاولات (0 = غير محدود)', type: 'number', min: 0, default: 1 },
      { name: 'status', label: 'الحالة', type: 'select', options: [['draft', 'مسودة'], ['published', 'منشور']] },
      { name: 'opensAt', label: 'يفتح في (اختياري)', type: 'datetime' },
      { name: 'closesAt', label: 'يُغلق في (اختياري)', type: 'datetime' },
      { name: 'resultMode', label: 'إظهار النتيجة', type: 'select', options: [['immediate', 'فور التسليم'], ['after_close', 'بعد إغلاق الاختبار'], ['manual', 'يدوياً من الإدارة']] },
      { name: 'showAnswers', label: 'إظهار الإجابات الصحيحة', type: 'select', options: [['after_submit', 'بعد ظهور النتيجة'], ['after_close', 'بعد إغلاق الاختبار'], ['never', 'لا تظهر']] },
      { name: 'shuffleQuestions', label: 'خلط ترتيب الأسئلة', type: 'checkbox' },
      { name: 'shuffleOptions', label: 'خلط ترتيب الخيارات', type: 'checkbox' }
    ];
    root.innerHTML = head('التقييم', quiz ? quiz.title : 'اختبار جديد', course.title, quiz ? `<button class="btn secondary" data-export>تصدير النتائج CSV</button>` : '') +
      (quiz ? `<div class="tabs">${[['settings', 'الإعداد والأسئلة'], ['results', 'النتائج والتصحيح']].map(([k, l]) => `<button class="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</div>` : '') + '<div data-pane></div>';
    const pane = $('[data-pane]', root);
    const showSettings = () => {
      pane.innerHTML = `<form novalidate data-form><div class="alert error" hidden data-alert></div><div class="grid cols-main">
        <section class="card card-pad"><h3 style="margin-bottom:14px">الإعدادات</h3><div class="form-grid two">${fieldsHtml(fields, quiz || { courseId, maxAttempts: 1, passPercent: 50, durationMin: 0, resultMode: 'immediate', showAnswers: 'after_submit' })}</div></section>
        <section class="card"><div class="card-head"><h3>الأسئلة <span class="mini" data-count>${selected.size}</span></h3><button type="button" class="btn secondary sm" data-newq>${icon('plus', 14)} سؤال جديد</button></div>
          <div data-pool style="max-height:560px;overflow-y:auto"></div></section></div>
        <div style="margin-top:18px"><button class="btn" type="submit">حفظ الاختبار</button></div></form>`;
      const drawPool = () => {
        $('[data-pool]', pane).innerHTML = pool.length ? `<ul class="list-plain">${pool.map((x) => `<li><label class="check" style="margin:0;flex:1;align-items:flex-start"><input type="checkbox" data-q="${x.id}" ${selected.has(x.id) ? 'checked' : ''}> <span>${esc(x.text)}<br><span class="mini">${QTYPE_NAMES[x.type]} · ${x.points}</span></span></label></li>`).join('')}</ul>`
          : emptyState('لا أسئلة', banks.length ? 'أضف أسئلة إلى بنك هذه الدورة.' : 'أنشئ بنك أسئلة أولاً من «بنك الأسئلة».');
        $$('[data-q]', pane).forEach((cb) => (cb.onchange = () => { cb.checked ? selected.add(cb.dataset.q) : selected.delete(cb.dataset.q); $('[data-count]', pane).textContent = selected.size; }));
      };
      drawPool();
      $('[data-newq]', pane).onclick = async () => {
        let bank = banks.find((b) => b.courseId === courseId);
        if (!bank) bank = await mutate('banks.save', { name: 'أسئلة ' + course.title, courseId });
        const q = await questionDialog(null, bank.id);
        if (q) { pool.unshift(q); selected.add(q.id); drawPool(); $('[data-count]', pane).textContent = selected.size; }
      };
      const form = $('[data-form]', pane);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('[type="submit"]', form); btn.classList.add('loading');
        $('[data-alert]', form).hidden = true;
        try {
          const v = readFields(form, fields);
          const saved = await mutate('quizzes.save', { ...v, id: quiz?.id, questionIds: pool.filter((x) => selected.has(x.id)).map((x) => x.id) });
          toast('حُفظ الاختبار');
          location.hash = '#/quiz?id=' + saved.id;
          if (quiz) quizEditor(root, new URLSearchParams('id=' + saved.id));
        } catch (ex) { $('[data-alert]', form).textContent = ex.message; $('[data-alert]', form).hidden = false; showFieldErrors(form, ex.fields); }
        finally { btn.classList.remove('loading'); }
      });
    };
    const showResults = async () => {
      pane.innerHTML = '<div class="card card-pad"><div class="skeleton"></div></div>';
      const rows = await api('quizzes.attempts', { quizId: quiz.id });
      const ST = { graded: ['ok', 'مصحح'], pending_review: ['warn', 'بانتظار التصحيح'], submitted: ['', 'مُسلّم'] };
      pane.innerHTML = `<section class="card">${quiz.resultMode === 'manual' ? `<div class="toolbar"><span class="small muted" style="flex:1">النتائج مخفية عن الطلاب حتى تظهرها.</span><button class="btn sm" data-release>إظهار النتائج للطلاب</button></div>` : ''}
        ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الطالب</th><th>المحاولة</th><th>الدرجة</th><th>النتيجة</th><th>الحالة</th><th>التسليم</th><th></th></tr></thead><tbody>
        ${rows.map((a) => `<tr><td>${esc(a.fullName)}<div class="small muted num">${esc(a.email)}</div></td><td class="num">${a.attemptNo}</td><td class="num">${a.score ?? '—'} / ${a.maxScore ?? '—'}</td>
          <td>${a.status === 'graded' ? (a.passed ? `<span class="badge ok">ناجح ${a.percent}%</span>` : `<span class="badge bad">راسب ${a.percent}%</span>`) : '—'}</td><td>${statusBadgeOf(ST, a.status)}</td>
          <td class="small">${fmtDateTime(a.submittedAt)}</td><td style="text-align:left"><button class="btn ghost sm" data-open="${a.id}">${a.status === 'pending_review' ? 'تصحيح' : 'عرض'}</button></td></tr>`).join('')}
        </tbody></table></div>` : emptyState('لا محاولات بعد', 'ستظهر هنا محاولات الطلاب فور تسليمها.')}</section>`;
      $('[data-release]', pane)?.addEventListener('click', async (e) => (await run(e.target, () => api('quizzes.release', { quizId: quiz.id }), 'ظهرت النتائج للطلاب')) && showResults());
      $$('[data-open]', pane).forEach((b) => (b.onclick = () => attemptDialog(b.dataset.open, showResults)));
    };
    const show = () => {
      $$('[data-tab]', root).forEach((x) => x.setAttribute('aria-selected', String(x.dataset.tab === tab)));
      tab === 'results' && quiz ? showResults() : showSettings();
    };
    $$('[data-tab]', root).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; show(); }));
    $('[data-export]', root)?.addEventListener('click', async (e) => { const r = await run(e.target, () => api('quizzes.export', { quizId: quiz.id })); if (r) downloadText(r.fileName, r.csv); });
    show();
  });
}

async function attemptDialog(attemptId, refresh) {
  const d0 = await api('quizzes.attemptDetail', { attemptId });
  const fmtAns = (it) => {
    const q = it.question, a = it.answer;
    if (a === null || a === undefined || a === '') return '<span class="muted">لم يُجب</span>';
    if (q.type === 'single') return esc(q.options.find((o) => o.id === a)?.text || '');
    if (q.type === 'multi') return esc((a || []).map((x) => q.options.find((o) => o.id === x)?.text).join('، '));
    if (q.type === 'truefalse') return a === true || a === 'true' ? 'صح' : 'خطأ';
    if (q.type === 'match') return q.options.map((o) => `${esc(o.text)} ← ${esc(a[o.id] || '—')}`).join('<br>');
    if (q.type === 'order') return (a || []).map((x, i) => `${i + 1}. ${esc(q.options.find((o) => o.id === x)?.text || '')}`).join('<br>');
    return esc(a);
  };
  const body = `<p style="margin-top:0"><b>${esc(d0.fullName)}</b> · الدرجة ${d0.attempt.score} / ${d0.attempt.maxScore}</p>` + d0.items.map((it, i) => `
    <div style="border-top:1px solid var(--line);padding:14px 0">
      <div style="display:flex;gap:8px;justify-content:space-between"><b style="font-weight:500">${i + 1}. ${esc(it.question.text)}</b><span class="mini">${QTYPE_NAMES[it.question.type]}</span></div>
      <div class="answer-box" style="margin:8px 0">${fmtAns(it)}</div>
      ${it.question.type === 'essay' && it.answerId ? `<div class="form-grid two" data-grade="${it.answerId}"><div class="field"><label>الدرجة (من ${it.question.points})</label><input class="input" type="number" min="0" max="${it.question.points}" step="0.5" dir="ltr" data-pts value="${it.pointsAwarded ?? ''}"></div>
        <div class="field"><label>ملاحظة للطالب</label><input class="input" data-fb value="${esc(it.feedback || '')}"></div></div>`
        : `<span class="small ${it.isCorrect ? '' : 'muted'}" style="color:${it.isCorrect ? 'var(--success)' : it.isCorrect === false ? 'var(--danger)' : ''}">${it.isCorrect ? '✓ صحيحة' : it.isCorrect === false ? '✗ خاطئة' : ''} · ${it.pointsAwarded ?? 0} / ${it.question.points}</span>`}
    </div>`).join('');
  const hasEssay = d0.items.some((it) => it.question.type === 'essay' && it.answerId);
  const r = await dialog({ title: 'محاولة: ' + d0.quizTitle, body, submitLabel: hasEssay ? 'حفظ التصحيح' : 'إغلاق', onSubmit: async (_v, d) => {
    if (!hasEssay) return true;
    for (const box of $$('[data-grade]', d)) {
      const pts = $('[data-pts]', box).value;
      if (pts === '') continue;
      await api('quizzes.gradeAnswer', { answerId: box.dataset.grade, points: Number(pts), feedback: $('[data-fb]', box).value });
    }
    return true;
  } });
  $$('dialog.dialog').pop()?.classList.add('wide');
  if (r && hasEssay) { toast('حُفظ التصحيح'); refresh(); }
}

// ════════════ الواجبات ════════════
export async function assignmentDialog(a, course) {
  const courseList = course ? { items: [course] } : await api('courses.adminList', { pageSize: 100 });
  const c = course || (a ? await api('courses.adminGet', { id: a.courseId }) : null);
  const lessons = c ? c.modules.flatMap((m) => m.lessons) : [];
  return formDialog({ title: a ? 'تعديل الواجب' : 'واجب جديد', wide: true, values: a || { courseId: c?.id, submissionType: 'both', maxScore: 100, status: 'published' }, fields: [
    { name: 'title', label: 'العنوان', required: true, full: true },
    { name: 'courseId', label: 'الدورة', type: 'select', options: courseList.items.map((x) => [x.id, x.title]) },
    { name: 'lessonId', label: 'الدرس (اختياري)', type: 'select', options: [['', '—'], ...lessons.map((l) => [l.id, l.title])] },
    { name: 'instructions', label: 'التعليمات', type: 'textarea', rows: 5, full: true },
    { name: 'dueAt', label: 'موعد التسليم', type: 'datetime' },
    { name: 'maxScore', label: 'الدرجة القصوى', type: 'number', min: 1 },
    { name: 'submissionType', label: 'طريقة التسليم', type: 'select', options: [['both', 'نص أو ملف'], ['text', 'نص فقط'], ['file', 'ملف فقط']] },
    { name: 'status', label: 'الحالة', type: 'select', options: [['published', 'منشور'], ['draft', 'مسودة']] },
    { name: 'isRequired', label: 'إلزامي لإكمال الدورة', type: 'checkbox', full: true }
  ], onSubmit: (v) => mutate('assignments.save', { ...v, id: a?.id }) });
}

export function assignments(root) {
  return guarded(root, async () => {
    const list = await api('assignments.list');
    root.innerHTML = head('التقييم', 'الواجبات', 'صندوق التسليمات والتصحيح.', `<button class="btn" data-add>${icon('plus')} واجب جديد</button>`) +
      `<section class="card">${list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الواجب</th><th>الدورة</th><th>التسليم</th><th>التسليمات</th><th>بانتظار التصحيح</th></tr></thead><tbody>
      ${list.map((a) => `<tr><td><a href="#/assignment?id=${a.id}">${esc(a.title)}</a> ${a.isRequired ? '<span class="mini">إلزامي</span>' : ''}</td><td class="small">${esc(a.courseTitle)}</td><td class="small">${fmtDateTime(a.dueAt)}</td>
      <td class="num">${a.submittedCount}</td><td>${a.ungradedCount ? `<span class="badge warn">${a.ungradedCount}</span>` : '—'}</td></tr>`).join('')}</tbody></table></div>`
        : emptyState('لا واجبات', 'أنشئ واجباً يسلّمه الطالب من التطبيق.')}</section>`;
    $('[data-add]', root).onclick = async () => { const a = await assignmentDialog(null); if (a) location.hash = '#/assignment?id=' + a.id; };
  });
}

export function assignmentDetail(root, params) {
  return guarded(root, async () => {
    const r = await api('assignments.submissions', { assignmentId: params.get('id') });
    const a = r.assignment;
    const ST = { submitted: ['warn', 'بانتظار التصحيح'], graded: ['ok', 'مصحح'], reopened: ['', 'أُعيد فتحه'] };
    root.innerHTML = head('الواجبات', a.title, `${a.dueAt ? 'التسليم ' + fmtDateTime(a.dueAt) + ' · ' : ''}الدرجة القصوى ${a.maxScore}`, '<button class="btn secondary" data-edit>تعديل</button>') +
      `<section class="card">${r.items.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>الطالب</th><th>التسليم</th><th>الحالة</th><th>الدرجة</th><th></th></tr></thead><tbody>
      ${r.items.map((s) => `<tr><td>${esc(s.fullName)}<div class="small muted num">${esc(s.email)}</div></td><td class="small">${fmtDateTime(s.submittedAt)} ${s.late ? '<span class="badge bad">متأخر</span>' : ''}</td>
      <td>${statusBadgeOf(ST, s.status)}</td><td class="num">${s.status === 'graded' ? s.score + ' / ' + a.maxScore : '—'}</td><td style="text-align:left"><button class="btn sm ${s.status === 'submitted' ? '' : 'ghost'}" data-open="${s.id}">${s.status === 'submitted' ? 'تصحيح' : 'عرض'}</button></td></tr>`).join('')}
      </tbody></table></div>` : emptyState('لا تسليمات بعد', 'ستظهر تسليمات الطلاب هنا.')}</section>`;
    $('[data-edit]', root).onclick = async () => { if (await assignmentDialog(a)) assignmentDetail(root, params); };
    $$('[data-open]', root).forEach((b) => (b.onclick = async () => {
      const s = r.items.find((x) => x.id === b.dataset.open);
      const pending = dialog({ title: 'تسليم ' + s.fullName, submitLabel: 'حفظ الدرجة', body: `
        ${s.textAnswer ? `<div class="answer-box" style="margin-bottom:12px">${esc(s.textAnswer)}</div>` : ''}
        ${s.files.length ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${s.files.map((f) => `<button type="button" class="btn secondary sm" data-file="${f.index}">${SVG.clip} ${esc(f.name)}</button>`).join('')}</div>` : ''}
        <div class="form-grid two"><div class="field"><label>الدرجة (من ${a.maxScore})</label><input class="input" type="number" name="score" min="0" max="${a.maxScore}" dir="ltr" value="${s.score ?? ''}"></div>
        <div class="field"><label>الإجراء</label><select class="input" name="act"><option value="grade">اعتماد الدرجة</option><option value="reopen">إعادة فتح للتعديل</option></select></div>
        <div class="field" style="grid-column:1/-1"><label>ملاحظات للطالب</label><textarea class="input" name="feedback" rows="3">${esc(s.feedback || '')}</textarea></div></div>`,
        onSubmit: (f) => mutate('assignments.grade', { submissionId: s.id, score: Number(f.score) || 0, feedback: f.feedback, reopen: f.act === 'reopen' }) });
      const dlg = $$('dialog.dialog').pop();
      $$('[data-file]', dlg).forEach((btn) => (btn.onclick = async () => { const f = await run(btn, () => api('files.get', { submissionId: s.id, index: Number(btn.dataset.file) })); if (f) downloadBase64(f.name, f.base64, f.mimeType); }));
      const res = await pending;
      if (res) { toast('حُفظ'); assignmentDetail(root, params); }
    }));
  });
}
