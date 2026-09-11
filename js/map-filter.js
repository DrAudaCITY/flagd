// map-filter.js — filtering what the map shows, and the legend that goes with it.
//
// The map has always drawn every flag it was given, colour-coded, with nothing
// explaining the colours. So this control does two jobs at once: it filters, and
// the category list IS the legend. Counts come from the flags actually on the map,
// so you never see an option that would return nothing.
//
// One rule that matters more than the rest: in pro mode a filter can only ever
// NARROW what eligibility already allowed. Filters are a view preference, never a
// way to see a lead you have not opted into and paid for.

import { CATEGORIES, cat } from './data.js';
import { state, setUI } from './store.js';
import { flagTypeOf } from './matching.js';
import { FLAG_TYPES, FLAG_TYPE_ORDER } from './taxonomy.js';
import { esc, icon, actions, toast } from './ui.js';
import { render } from './router.js';
import * as gmap from './map.js';

/* ================================================================ state */
const blank = () => ({ types: [], cats: [], scope: 'all' });

export function filterState() {
  if (!state.ui.mapFilter) state.ui.mapFilter = blank();
  const f = state.ui.mapFilter;
  f.types = f.types || [];
  f.cats = f.cats || [];
  f.scope = f.scope || 'all';
  return f;
}

export const filterCount = () => {
  const f = filterState();
  return f.types.length + f.cats.length + (f.scope !== 'all' ? 1 : 0);
};

export const isFiltered = () => filterCount() > 0;

/* ================================================================ predicate */
/**
 * Wraps the caller's base predicate. The base is the authority — in pro mode it
 * carries eligibility — and this only ever removes more.
 */
export function mapPredicate(base) {
  const f = filterState();
  const pro = state.mode === 'pro';

  return (flag) => {
    if (base && !base(flag)) return false;          // never widen

    if (f.scope === 'mine' && !flag.mine) return false;
    if (f.scope === 'others' && flag.mine) return false;
    if (f.scope === 'unlocked' && !(state.pro.unlocked || []).includes(flag.id)) return false;
    if (f.types.length && !f.types.includes(flagTypeOf(flag))) return false;
    if (f.cats.length && !f.cats.includes(flag.cat)) return false;
    return true;
  };
}

/* ================================================================ counts
 * What is on the map right now, before this filter is applied — so toggling an
 * option never shows a zero you could not have predicted.
 */
function pool(base) {
  return state.flags.filter(f => (base ? base(f) : true));
}

export function facets(base) {
  const rows = pool(base);
  const byType = {};
  const byCat = {};
  rows.forEach(f => {
    const t = flagTypeOf(f);
    byType[t] = (byType[t] || 0) + 1;
    byCat[f.cat] = (byCat[f.cat] || 0) + 1;
  });
  return { total: rows.length, byType, byCat };
}

/* ================================================================ view */
let open = false;
export const isOpen = () => open;

export function renderMapFilter(base) {
  const f = filterState();
  const n = filterCount();
  const fx = facets(base);
  const pro = state.mode === 'pro';

  const cats = Object.keys(fx.byCat)
    .filter(k => CATEGORIES[k])
    .sort((a, b) => fx.byCat[b] - fx.byCat[a] || CATEGORIES[a].name.localeCompare(CATEGORIES[b].name));

  const shown = pool(mapPredicate(base)).length;

  return `
    <button class="mf-btn ${n ? 'on' : ''}" data-act="mfToggle" aria-expanded="${open}">
      ${icon('filter')}
      <span>${n ? `${shown} of ${fx.total}` : 'Filter map'}</span>
      ${n ? `<span class="mf-count">${n}</span>` : ''}
    </button>

    ${open ? `
    <div class="mf-panel" role="dialog" aria-label="Filter the map">
      <div class="mf-head">
        <strong>Show on map</strong>
        ${n ? `<button class="mf-reset" data-act="mfReset">Reset</button>` : ''}
      </div>

      <div class="mf-group">
        <div class="mf-label">Kind</div>
        <div class="mf-chips">
          ${FLAG_TYPE_ORDER.filter(t => fx.byType[t]).map(t => `
            <button class="chip ${f.types.includes(t) ? 'on' : ''}" data-act="mfType" data-v="${esc(t)}">
              ${esc(FLAG_TYPES[t].icon)} ${esc(shortType(t))}
              <span class="mf-n">${fx.byType[t]}</span>
            </button>`).join('')}
        </div>
      </div>

      <div class="mf-group">
        <div class="mf-label">Category <span class="mf-hint">— also the map legend</span></div>
        <div class="mf-cats">
          ${cats.map(k => {
            const c = CATEGORIES[k];
            const on = f.cats.includes(k);
            return `<button class="mf-cat ${on ? 'on' : ''}" data-act="mfCat" data-v="${esc(k)}">
              <span class="mf-dot" style="background:${esc(c.color)}"></span>
              <span class="mf-nm">${esc(c.name)}</span>
              <span class="mf-n">${fx.byCat[k]}</span>
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="mf-group">
        <div class="mf-label">Whose</div>
        <div class="mf-chips">
          ${scopeOptions(pro).map(o => `
            <button class="chip ${f.scope === o.id ? 'on' : ''}" data-act="mfScope" data-v="${esc(o.id)}">${esc(o.label)}</button>`).join('')}
        </div>
      </div>

      ${pro ? `<p class="mf-note">Filters narrow what you already have access to. They never reveal a lead outside your capabilities or plan radius.</p>` : ''}

      <button class="btn mf-done" data-act="mfToggle">Done</button>
    </div>` : ''}
  `;
}

const shortType = (t) => ({ service: 'Services', sell: 'Selling', buy: 'Buying' }[t] || t);

const scopeOptions = (pro) => pro
  ? [
      { id: 'all', label: 'Everything in range' },
      { id: 'unlocked', label: 'Unlocked only' },
    ]
  : [
      { id: 'all', label: 'Everyone' },
      { id: 'mine', label: 'Just mine' },
      { id: 'others', label: 'Neighbours' },
    ];

/* ================================================================ actions */
actions({
  mfToggle: () => { open = !open; render(); },

  mfType: (el) => {
    const f = filterState();
    const v = el.dataset.v;
    const i = f.types.indexOf(v);
    if (i < 0) f.types.push(v); else f.types.splice(i, 1);
    setUI({ mapFilter: f });
    render();
  },

  mfCat: (el) => {
    const f = filterState();
    const v = el.dataset.v;
    const i = f.cats.indexOf(v);
    if (i < 0) f.cats.push(v); else f.cats.splice(i, 1);
    setUI({ mapFilter: f });
    render();
  },

  mfScope: (el) => {
    const f = filterState();
    f.scope = f.scope === el.dataset.v ? 'all' : el.dataset.v;
    setUI({ mapFilter: f });
    render();
  },

  mfReset: () => {
    setUI({ mapFilter: blank() });
    render();
    toast('Filters cleared');
  },
});
