// أدوات الواجهة المشتركة: الهروب من HTML، الأيقونات، التنبيهات، الحوارات، التواريخ، النماذج.

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// أيقونات خطية موحدة (سماكة 1.6، زوايا دائرية)
const P = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.8a3.3 3.3 0 0 1 0 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
  teacher: '<path d="M2 8.5 12 4l10 4.5-10 4.5z"/><path d="M6 10.5V16c2 1.8 4 2.5 6 2.5s4-.7 6-2.5v-5.5"/><path d="M22 8.5V14"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6 8.5-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1.2z"/>',
  scroll: '<path d="M8 3h11a2 2 0 0 1 2 2v1H10"/><path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 0 1-2 2h11a2 2 0 0 0 2-2V6"/><path d="M10 9h5M10 13h5M10 17h3"/>',
  shield: '<path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6z"/><path d="m9 12 2 2 4-4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17 5 12l5-5M5 12h11"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4-4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  quiz: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 11l2 2 4-4"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  award: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13-1.5 8 5-3 5 3-1.5-8"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  folder: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  group: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 19c.6-2.8 3-4.5 6-4.5s5.4 1.7 6 4.5M14 14.6c.6-.1 1.3-.1 2-.1 3 0 5.4 1.7 6 4.5"/>'
};
export const icon = (name, size = 18) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

export function toast(msg, kind = '') {
  let box = $('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.append(box); }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.append(t);
  setTimeout(() => t.remove(), 4200);
}

/** حوار تأكيد/نموذج. يُرجع Promise بقيمة onSubmit أو null عند الإلغاء. */
export function dialog({ title, body, submitLabel = 'تأكيد', danger = false, onSubmit }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = `<form method="dialog" novalidate>
      <div class="dialog-head"><h3>${esc(title)}</h3></div>
      <div class="dialog-body">${body}<div class="alert error" hidden data-err></div></div>
      <div class="dialog-foot">
        <button class="btn ${danger ? 'danger' : ''}" value="ok" data-ok>${esc(submitLabel)}</button>
        <button class="btn secondary" value="cancel" formnovalidate data-cancel>إلغاء</button>
      </div></form>`;
    document.body.append(d);
    const form = $('form', d);
    const done = (v) => { d.close(); d.remove(); resolve(v); };
    $('[data-cancel]', d).addEventListener('click', (e) => { e.preventDefault(); done(null); });
    d.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('[data-ok]', d);
      const err = $('[data-err]', d);
      if (err) err.hidden = true;
      btn.classList.add('loading');
      try {
        const res = onSubmit ? await onSubmit(formData(form), d) : true;
        if (res !== undefined && res !== false) done(res);
      } catch (ex) {
        if (err) { err.textContent = ex.message; err.hidden = false; } else toast(ex.message, 'error');
        showFieldErrors(form, ex.fields);
      } finally { btn.classList.remove('loading'); }
    });
    d.showModal();
    $('input,select,textarea', d)?.focus();
  });
}

export function formData(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
  return o;
}

export function showFieldErrors(form, fields) {
  $$('.field', form).forEach((f) => { f.classList.remove('invalid'); const e = $('.err', f); if (e) e.textContent = ''; });
  if (!fields) return;
  Object.entries(fields).forEach(([name, msg]) => {
    const input = form.querySelector(`[name="${name}"]`);
    const f = input?.closest('.field');
    if (!f) return;
    f.classList.add('invalid');
    let e = $('.err', f);
    if (!e) { e = document.createElement('div'); e.className = 'err'; f.append(e); }
    e.textContent = msg;
  });
}

/** يربط نموذجاً بعملية غير متزامنة: يمنع الإرسال المزدوج ويعرض الأخطاء. */
export function bindForm(form, handler) {
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const btn = form.querySelector('[type="submit"]');
    const alert = form.querySelector('[data-alert]');
    btn?.classList.add('loading');
    if (alert) alert.hidden = true;
    showFieldErrors(form, null);
    try { await handler(formData(form)); }
    catch (ex) {
      if (alert) { alert.textContent = ex.message; alert.hidden = false; } else toast(ex.message, 'error');
      showFieldErrors(form, ex.fields);
    } finally { busy = false; btn?.classList.remove('loading'); }
  });
}

const dtf = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });
const df = new Intl.DateTimeFormat('ar-SY-u-nu-latn', { dateStyle: 'medium' });
export const fmtDateTime = (iso) => (iso ? dtf.format(new Date(iso)) : '—');
export const fmtDate = (iso) => (iso ? df.format(new Date(iso)) : '—');
export const initials = (name) => esc(String(name || '؟').trim().charAt(0));

export const STATUS = {
  active: ['ok', 'نشط'], suspended: ['bad', 'معلّق'], invited: ['warn', 'بانتظار القبول']
};
export const ROLE_NAMES = { super_admin: 'المدير الأعلى', admin: 'مدير', teacher: 'مدرس', student: 'طالب', support: 'دعم', grader: 'مصحح' };

export const emptyState = (title, text, action = '') =>
  `<div class="empty"><span class="ornament"></span><h4>${esc(title)}</h4><p>${esc(text)}</p>${action}</div>`;

export const loadingRows = (n = 4, cols = 4) =>
  Array.from({ length: n }, () => `<tr>${Array.from({ length: cols }, () => '<td><div class="skeleton"></div></td>').join('')}</tr>`).join('');

// ═══════════ أدوات النماذج العامة (المراحل B–F) ═══════════

/** تحويل ISO ↔ قيمة حقل datetime-local بالتوقيت المحلي للمتصفح. */
export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : '');

/**
 * يبني حقول نموذج من تعريف:
 * {name, label, type: text|textarea|number|select|datetime|checkbox|checks|email|url|color|hint, options:[[v,l]], hint, required, rows, ltr, full}
 */
export function fieldsHtml(defs, values = {}) {
  return defs.map((f) => {
    const v = values[f.name];
    const req = f.required ? 'required' : '';
    const dir = f.ltr ? 'dir="ltr"' : '';
    const hint = f.hint ? `<div class="hint">${esc(f.hint)}</div>` : '';
    const wrap = (inner) => `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ''}><label>${esc(f.label)}${f.required ? ' *' : ''}</label>${inner}${hint}<div class="err"></div></div>`;
    switch (f.type) {
      case 'hint': return `<p class="small muted" style="grid-column:1/-1;margin:0 0 12px">${esc(f.label)}</p>`;
      case 'textarea': return wrap(`<textarea class="input" name="${f.name}" rows="${f.rows || 4}" ${req} ${dir}>${esc(v ?? '')}</textarea>`);
      case 'select': return wrap(`<select class="input" name="${f.name}" ${req}>${(f.options || []).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(v ?? f.default ?? '') === String(ov) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`);
      case 'datetime': return wrap(`<input class="input" type="datetime-local" name="${f.name}" value="${esc(toLocalInput(v))}" ${req}>`);
      case 'number': return wrap(`<input class="input" type="number" name="${f.name}" value="${esc(v ?? f.default ?? '')}" ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.max !== undefined ? `max="${f.max}"` : ''} step="${f.step || 'any'}" dir="ltr" ${req}>`);
      case 'checkbox': return `<label class="check" ${f.full ? 'style="grid-column:1/-1"' : ''}><input type="checkbox" name="${f.name}" ${v ?? f.default ? 'checked' : ''}> <span>${esc(f.label)}</span></label>`;
      case 'checks': {
        const set = new Set(v || []);
        return wrap(`<div class="checks">${(f.options || []).length ? f.options.map(([ov, ol]) => `<label class="check"><input type="checkbox" name="${f.name}" value="${esc(ov)}" ${set.has(ov) ? 'checked' : ''}> <span>${esc(ol)}</span></label>`).join('') : '<span class="small muted">لا توجد خيارات بعد.</span>'}</div>`);
      }
      default: return wrap(`<input class="input" type="${f.type || 'text'}" name="${f.name}" value="${esc(v ?? '')}" ${req} ${dir} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>`);
    }
  }).join('');
}

/** يقرأ قيم النموذج حسب التعريف (أنواع صحيحة: أرقام، تواريخ، قوائم، منطقي). */
export function readFields(form, defs) {
  const out = {};
  defs.forEach((f) => {
    if (f.type === 'hint') return;
    if (f.type === 'checkbox') { out[f.name] = !!form.querySelector(`[name="${f.name}"]`)?.checked; return; }
    if (f.type === 'checks') { out[f.name] = $$(`[name="${f.name}"]:checked`, form).map((x) => x.value); return; }
    const el = form.querySelector(`[name="${f.name}"]`);
    if (!el) return;
    const v = el.value.trim();
    if (f.type === 'number') out[f.name] = v === '' ? null : Number(v);
    else if (f.type === 'datetime') out[f.name] = fromLocalInput(v);
    else if (f.list) out[f.name] = v.split('\n').map((x) => x.trim()).filter(Boolean);
    else out[f.name] = v;
  });
  return out;
}

/** نموذج كامل في نافذة: يعيد نتيجة onSubmit أو null. */
export function formDialog({ title, fields, values = {}, submitLabel = 'حفظ', onSubmit, wide = false, extra = '' }) {
  const p = dialog({
    title, submitLabel,
    body: `<div class="form-grid ${wide ? 'two' : ''}">${fieldsHtml(fields, values)}</div>${extra}`,
    onSubmit: async (_raw, d) => onSubmit(readFields($('form', d), fields), d)
  });
  const d = $$('dialog.dialog').pop();
  if (wide) d.classList.add('wide');
  return p;
}

export const confirmDialog = (title, text, label = 'تأكيد', danger = true) =>
  dialog({ title, body: `<p style="margin-top:0">${esc(text)}</p>`, submitLabel: label, danger, onSubmit: () => true });

/** قراءة ملف كـ base64 مع حد الحجم. */
export function readFileBase64(file, maxMb = 25) {
  return new Promise((resolve, reject) => {
    if (file.size > maxMb * 1024 * 1024) return reject(new Error(`حجم الملف أكبر من ${maxMb} ميغابايت.`));
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('تعذّرت قراءة الملف.'));
    r.readAsDataURL(file);
  });
}

export function downloadText(name, text, mime = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function downloadBase64(name, b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
}

export const COURSE_STATUS = { draft: ['warn', 'مسودة'], published: ['ok', 'منشور'], archived: ['', 'مؤرشف'] };
export const statusBadgeOf = (map, s) => { const [k, t] = map[s] || ['', s]; return `<span class="badge ${k}">${esc(t)}</span>`; };
export const fmtSize = (b) => (!b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.ceil(b / 1024) + ' KB');
