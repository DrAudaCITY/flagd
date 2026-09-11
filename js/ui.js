// ui.js — presentation primitives: formatting, stars, toast, modal, and the
// delegated-action system every view uses instead of inline onclick handlers.

/* ---------------------------------------------------------------- formatting */
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

export const moneyFine = (n) => {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

export function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' hr ago';
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : d + ' days ago';
}

export function clockTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function initials(name) {
  const parts = String(name || '?').replace(/[^A-Za-z0-9 &.]/g, '').trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export const miles = (m) => {
  const mi = m / 1609.34;
  return mi < 0.15 ? 'nearby' : mi.toFixed(mi < 10 ? 1 : 0) + ' mi';
};

/* ---------------------------------------------------------------- stars */
const STAR_PATH = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9z';

export function stars(rating, cls = '') {
  const r = Number(rating) || 0;
  let out = `<span class="stars ${cls}" aria-label="${r.toFixed(1)} out of 5">`;
  for (let i = 1; i <= 5; i++) {
    const full = r >= i - 0.25;
    out += `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="${full ? 's-full' : 's-empty'}" d="${STAR_PATH}"/></svg>`;
  }
  return out + '</span>';
}

export function ratingLine(rating, reviews) {
  return `${stars(rating)}<span class="rate-n">${Number(rating).toFixed(1)}</span>` +
         `<span class="rate-c">(${reviews})</span>`;
}

export function starPicker(name, value = 0) {
  let out = `<div class="starpick" data-starpick="${esc(name)}">`;
  for (let i = 1; i <= 5; i++) {
    out += `<button type="button" data-act="star" data-pick="${esc(name)}" data-n="${i}" class="${i <= value ? 'on' : ''}" aria-label="${i} star${i > 1 ? 's' : ''}">
      <svg viewBox="0 0 24 24"><path d="${STAR_PATH}"/></svg></button>`;
  }
  return out + `</div><input type="hidden" id="${esc(name)}" value="${value}">`;
}

export const VERIF_SVG =
  `<svg class="verif" viewBox="0 0 24 24" aria-label="Verified"><path fill="#000000" d="M12 1.8l2.5 2 3.2-.2.9 3 2.6 1.9-1.3 2.9 1.3 2.9-2.6 1.9-.9 3-3.2-.2-2.5 2-2.5-2-3.2.2-.9-3-2.6-1.9L4.6 11.4 3.3 8.5l2.6-1.9.9-3 3.2.2z"/><path fill="#fff" d="M10.8 14.6l-2.6-2.5 1.2-1.2 1.4 1.3 3.8-3.8 1.2 1.2z"/></svg>`;

/* ---------------------------------------------------------------- avatars & badges */
export function avatar(name, color) {
  return `<div class="av" style="background:${esc(color || '#000000')}">${esc(initials(name))}</div>`;
}

export function badge(kind, text) {
  return `<span class="badge b-${esc(kind)}">${esc(text)}</span>`;
}

export function icon(name) {
  const P = {
    back:  '<path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    map:   '<path d="M9 3L3 5.5v15L9 18l6 3 6-2.5v-15L15 6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 3v15M15 6v15" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    flag:  '<path d="M6 3v18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M6 4.5h12l-2.6 3.9L18 12.3H6z" fill="currentColor"/>',
    chat:  '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-6.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    user:  '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 5h14l2 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    card:  '<rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2.5 10h19" stroke="currentColor" stroke-width="1.8"/>',
    send:  '<path d="M3.5 11.5L21 4l-7 17-2.8-6.8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M11.2 14.2L21 4" fill="none" stroke="currentColor" stroke-width="1.9"/>',
    bolt:  '<path d="M13 2L4 14h6l-1 8 9-12h-6z" fill="currentColor"/>',
    go:    '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
    filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
}

/* ---------------------------------------------------------------- toast */
let toastT;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------------------------------------------------------------- modal */
export function openModal(html) {
  const m = document.getElementById('modal');
  const inner = document.getElementById('modalIn');
  inner.innerHTML = `<button class="modal-x" data-act="closeModal" aria-label="Close">✕</button>` + html;
  document.getElementById('modalScrim').classList.add('show');
  m.classList.add('show');
  inner.scrollTop = 0;
}
export function closeModal() {
  document.getElementById('modal').classList.remove('show');
  document.getElementById('modalScrim').classList.remove('show');
}

/* ---------------------------------------------------------------- delegated actions */
const ACTIONS = {};
export function actions(map) { Object.assign(ACTIONS, map); }

// Called once from app.js. Any element with data-act="name" fires ACTIONS.name(el, event).
export function bindDelegation() {
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    ev.preventDefault();
    fn(el, ev);
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-chg]');
    if (!el) return;
    const fn = ACTIONS[el.dataset.chg];
    if (fn) fn(el, ev);
  });

  document.getElementById('modalScrim').addEventListener('click', closeModal);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });

  // Star picker: light up the score you are about to give as the pointer crosses it.
  document.addEventListener('mouseover', (ev) => {
    const btn = ev.target.closest('.starpick button');
    const wrap = ev.target.closest('.starpick');
    if (!wrap) return;
    const n = btn ? Number(btn.dataset.n) : 0;
    [...wrap.children].forEach((b, i) => b.classList.toggle('preview', i < n && !b.classList.contains('on')));
  });
  document.addEventListener('mouseout', (ev) => {
    const wrap = ev.target.closest('.starpick');
    if (wrap && !wrap.contains(ev.relatedTarget)) {
      [...wrap.children].forEach(b => b.classList.remove('preview'));
    }
  });
}

// Generic toggle for chip groups.
actions({
  chip: (el) => el.classList.toggle('on'),
  closeModal: () => closeModal(),
  star: (el) => {
    const wrap = el.closest('.starpick');
    const n = Number(el.dataset.n);
    [...wrap.children].forEach((b, i) => b.classList.toggle('on', i < n));
    const hidden = document.getElementById(el.dataset.pick);
    if (hidden) hidden.value = String(n);
  },
});

/* ---------------------------------------------------------------- small helpers */
export const val = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
export const num = (id) => { const v = val(id).replace(/[^0-9.]/g, ''); return v ? Number(v) : NaN; };
export const chipsOn = (wrapId) =>
  [...document.querySelectorAll(`#${wrapId} .chip.on`)].map(c => c.textContent.trim());

export function chipRow(items, wrapId) {
  return `<div class="chips" id="${esc(wrapId)}">` +
    items.map(x => `<button type="button" class="chip" data-act="chip">${esc(x)}</button>`).join('') +
    `</div>`;
}

export function backHead(title, actName, sub) {
  return `<div class="view-head">
      <button class="back" data-act="${esc(actName)}" aria-label="Back">${icon('back')}</button>
      <h2>${esc(title)}</h2>
    </div>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}`;
}

export function emptyState(ico, title, body, ctaLabel, ctaAct) {
  return `<div class="empty">
    <div class="empty-ico">${ico}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(body)}</p>
    ${ctaLabel ? `<button class="btn brand sm" data-act="${esc(ctaAct)}">${esc(ctaLabel)}</button>` : ''}
  </div>`;
}
