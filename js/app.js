// app.js — bootstrap and the render loop. Owns the panel, the tab bar, the top bar,
// and translates router state into HTML.

import { state, subscribe, unreadTotal, setMode, commit } from './store.js';
import { view, setRenderer, go, render } from './router.js';
import { bindDelegation, actions, icon, toast, esc } from './ui.js';
import * as gmap from './map.js';
import { attachAutocomplete, reverse } from './geo.js';
import {
  renderHome, renderMyFlags, renderPicker, renderIntake, renderFlagView,
  renderProProfile, renderAccount, setPlacingBar,
} from './flags.js';
import { renderInbox, renderThread } from './chat.js';
import { renderTracking, stopTicking } from './dispatch.js';
import { renderSupport, renderCase, renderAdmin } from './support-view.js';
import { renderProFeed, renderProFlag, renderPlans, renderProAccount } from './pro.js';

const panel = document.getElementById('panel');
const body = document.getElementById('panelBody');
const tabsEl = document.getElementById('tabs');

/* ---------------------------------------------------------------- tabs */
const BUYER_TABS = [
  { id: 'home',    label: 'Map',      ico: 'map' },
  { id: 'myflags', label: 'My flags', ico: 'flag' },
  { id: 'inbox',   label: 'Messages', ico: 'chat', badge: true },
  { id: 'account', label: 'Account',  ico: 'user' },
];
const PRO_TABS = [
  { id: 'proFeed',    label: 'Leads',    ico: 'bolt' },
  { id: 'proPlans',   label: 'Plans',    ico: 'card' },
  { id: 'inbox',      label: 'Messages', ico: 'chat', badge: true },
  { id: 'proAccount', label: 'Profile',  ico: 'user' },
];

// Which tab should look active for a given view.
const TAB_OF = {
  home: 'home', picker: 'home', intake: 'home', flag: 'home', pro: 'home', tracking: 'home',
  myflags: 'myflags', inbox: 'inbox', thread: 'inbox', account: 'account',
  support: 'account', supportCase: 'account', admin: 'account',
  proFeed: 'proFeed', proFlag: 'proFeed', proPlans: 'proPlans', proAccount: 'proAccount',
};

function renderTabs() {
  const list = state.mode === 'pro' ? PRO_TABS : BUYER_TABS;
  const active = TAB_OF[view.name] || list[0].id;
  const unread = unreadTotal();
  tabsEl.innerHTML = list.map(t => `
    <button data-act="tab" data-tab="${t.id}" class="${t.id === active ? 'on' : ''}">
      ${icon(t.ico)}<span>${t.label}</span>
      ${t.badge && unread ? `<span class="dot">${unread > 9 ? '9+' : unread}</span>` : ''}
    </button>`).join('');
}

/* ---------------------------------------------------------------- view dispatch */
function viewHtml() {
  switch (view.name) {
    case 'home':       return renderHome();
    case 'myflags':    return renderMyFlags();
    case 'picker':     return renderPicker();
    case 'intake':     return renderIntake();
    case 'flag':       return renderFlagView(view.p.id);
    case 'tracking':   return renderTracking(view.p.id);
    case 'support':     return renderSupport();
    case 'supportCase': return renderCase(view.p.id);
    case 'admin':       return renderAdmin();
    case 'pro':        return renderProProfile(view.p.id);
    case 'account':    return renderAccount();
    case 'inbox':      return renderInbox();
    case 'thread':     return renderThread(view.p.flagId, view.p.proId);
    case 'proFeed':    return renderProFeed();
    case 'proFlag':    return renderProFlag(view.p.id);
    case 'proPlans':   return renderPlans();
    case 'proAccount': return renderProAccount();
    default:           return renderHome();
  }
}

/* ---------------------------------------------------------------- render */
let lastView = '';
let enterT = null;

function doRender() {
  // Preserve what the user has typed and where they had scrolled.
  const typed = new Map();
  body.querySelectorAll('input[id], textarea[id]').forEach(el => {
    if (el.type !== 'hidden') typed.set(el.id, el.value);
  });
  const scrollers = new Map();
  body.querySelectorAll('[data-autoscroll]').forEach(el => scrollers.set('auto', el.scrollTop));
  const bodyScroll = body.scrollTop;

  // Leaving the tracking screen stops its timer and takes the courier off the map.
  if (view.name !== 'tracking') {
    stopTicking();
    gmap.clearCourier();
  }

  body.innerHTML = viewHtml();
  body.classList.toggle('thread-mode', view.name === 'thread');

  typed.forEach((v, id) => {
    const el = body.querySelector('#' + CSS.escape(id));
    if (el && !el.value) el.value = v;
  });

  const auto = body.querySelector('[data-autoscroll]');
  const sameView = lastView === view.name + JSON.stringify(view.p);
  lastView = view.name + JSON.stringify(view.p);

  // Animate in only when the screen actually changed — not on every state repaint,
  // which would make arriving bids and messages jitter the whole panel.
  if (!sameView) {
    body.classList.remove('entering');
    void body.offsetWidth;                 // restart the animation
    body.classList.add('entering');
    clearTimeout(enterT);
    enterT = setTimeout(() => body.classList.remove('entering'), 700);
  }
  if (auto) auto.scrollTop = auto.scrollHeight;
  else body.scrollTop = sameView ? bodyScroll : 0;   // new screen starts at the top

  // Address field inside the intake form gets its own autocomplete.
  const fAddr = body.querySelector('#fAddr');
  if (fAddr && !fAddr.dataset.ac) {
    fAddr.dataset.ac = '1';
    attachAutocomplete(fAddr, () => {}, { minWidth: 300 });
  }

  const composer = body.querySelector('[data-enter-send]');
  if (composer && !composer.dataset.bound) {
    composer.dataset.bound = '1';
    composer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const btn = body.querySelector('.composer .send');
        if (btn) btn.click();
      }
    });
    composer.addEventListener('input', () => {
      composer.style.height = 'auto';
      composer.style.height = Math.min(110, composer.scrollHeight) + 'px';
    });
    composer.focus();
  }

  renderTabs();
  syncMapFilter();
}

setRenderer(doRender);

// Any state change repaints — except while a form is mid-fill.
subscribe(() => {
  if (view.name === 'intake') { renderTabs(); return; }
  doRender();
});

/* ---------------------------------------------------------------- map filtering */
// In pro mode the map shows other people's open flags; in buyer mode, everything.
function syncMapFilter() {
  gmap.renderFlags(state.mode === 'pro' ? (f) => !f.mine && f.status === 'open' : null);
}

/* ---------------------------------------------------------------- top bar */
function bindTopBar() {
  const input = document.getElementById('addrInput');
  const form = document.getElementById('addrForm');

  form.addEventListener('submit', (e) => e.preventDefault());

  attachAutocomplete(input, (item) => {
    gmap.setHome(item.ll, item.label);
    commit();
    toast('Centered on ' + (item.short || item.label));
  }, {
    onMiss: () => toast('Could not find that address — try adding the city or ZIP'),
  });

  document.getElementById('gpsBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { toast('Location is not available in this browser'); return; }
    toast('Finding you…');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      const a = await reverse(ll[0], ll[1]);
      gmap.setHome(ll, a.label);
      input.value = a.label;
      commit();
      toast('Centered on your location');
    }, () => toast('Could not get your location'), { enableHighAccuracy: true, timeout: 9000 });
  });

  const buyerBtn = document.getElementById('modeBuyer');
  const proBtn = document.getElementById('modePro');
  buyerBtn.addEventListener('click', () => { setMode('buyer'); go('home'); });
  proBtn.addEventListener('click', () => { setMode('pro'); go('proFeed'); });
}

function syncModeSwitch() {
  const pro = state.mode === 'pro';
  const b = document.getElementById('modeBuyer');
  const p = document.getElementById('modePro');
  b.classList.toggle('on', !pro);
  p.classList.toggle('on', pro);
  b.setAttribute('aria-selected', String(!pro));
  p.setAttribute('aria-selected', String(pro));
}

/* ---------------------------------------------------------------- mobile panel */
function bindPanelSheet() {
  const grab = document.getElementById('panelGrab');
  grab.addEventListener('click', () => {
    if (panel.classList.contains('down')) panel.classList.remove('down');
    else if (panel.classList.contains('up')) panel.classList.remove('up');
    else panel.classList.add('up');
    gmap.resize();
  });

  let startY = 0, startState = '';
  grab.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    startState = panel.className;
  }, { passive: true });
  grab.addEventListener('touchend', (e) => {
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dy) < 26) return;
    panel.classList.remove('up', 'down');
    if (dy > 0) panel.classList.add(startState.includes('up') ? '' : 'down');
    else panel.classList.add('up');
    gmap.resize();
  });
}

const isMobile = () => window.matchMedia('(max-width:860px)').matches;
export function collapsePanel() { if (isMobile()) { panel.classList.add('down'); panel.classList.remove('up'); } }
export function expandPanel() { if (isMobile()) panel.classList.remove('down'); }

/* ---------------------------------------------------------------- provider notice */
// Flagd is meant to run on Google Maps. Say so plainly when it is not.
function announceFallback(reason) {
  const msg = {
    'key-rejected': 'Google rejected that Maps key — running on the OpenStreetMap fallback.',
    'load-failed': 'Google Maps could not load — running on the OpenStreetMap fallback.',
    'no-key': 'No Google Maps key set — running on the OpenStreetMap fallback.',
  }[reason] || 'Running on the OpenStreetMap fallback.';
  setTimeout(() => toast(msg), 900);
}

/* ---------------------------------------------------------------- extra actions */
actions({
  tab: (el) => {
    const id = el.dataset.tab;
    if (id === 'home' || id === 'proFeed') {
      if (view.name === id) { collapsePanel(); gmap.resize(); return; }
      expandPanel();
    } else expandPanel();
    go(id);
  },
  confirmReset: () => {
    try { localStorage.removeItem('flagd.v1'); } catch (e) { /* ignore */ }
    location.reload();
  },
});

/* ---------------------------------------------------------------- boot */
async function boot() {
  bindDelegation();
  bindTopBar();
  bindPanelSheet();

  const { provider, reason } = await gmap.initMap({ onFallback: announceFallback });
  if (provider !== 'google') announceFallback(reason);

  if (state.home) gmap.setHome(state.home.ll, state.home.label);

  document.getElementById('fab').addEventListener('click', () => {
    expandPanel();
    go(state.mode === 'pro' ? 'proFeed' : 'picker');
  });

  document.getElementById('placingCancel').addEventListener('click', () => {
    gmap.stopPlacing();
    setPlacingBar(false);
    go('picker');
  });

  // Keep the mode switch in sync with whatever the store says.
  subscribe(syncModeSwitch);
  syncModeSwitch();

  go(state.mode === 'pro' ? 'proFeed' : 'home');

  window.addEventListener('resize', () => gmap.resize());

  console.info('%cFlagd', 'font:700 15px system-ui;color:#ff4b26', 'prototype — state lives in localStorage under "flagd.v1"');
}

boot();
