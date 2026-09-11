// store.js — the single source of truth. Everything the app renders comes from here.
// Persists to localStorage and notifies subscribers on every commit.

import { SEED_FLAGS, PROS, proById, planById } from './data.js';

const KEY = 'flagd.v1';
const listeners = new Set();

export const uid = (p = 'x') => p + '_' + Math.random().toString(36).slice(2, 9);
export const now = () => Date.now();

/* ---------------------------------------------------------------- initial state */
function seed() {
  const t = now();
  const flags = SEED_FLAGS.map((f, i) => ({
    id: 'seed_' + i,
    mine: false,
    cat: f.cat,
    ll: f.ll,
    title: f.title,
    desc: '',
    chips: [],
    extra: {},
    budget: f.budget,
    timing: f.timing,
    address: f.where,
    who: f.who,
    ago: f.ago,
    bidCount: f.bids,
    status: 'open',
    createdAt: t - (i + 1) * 3600e3,
  }));

  return {
    v: 1,
    mode: 'buyer',
    me: { name: 'You', initials: 'YO', phone: '', smsOptIn: false },
    home: null,
    flags,
    bids: [],
    threads: {},
    ratings: {},          // proId -> [{stars, text, at}]
    proProfiles: {},      // proId -> { about, interests[], local, photo } written in-app
    pro: {
      profileId: 'p_ridgeline',   // which directory pro you are, in pro mode
      plan: 'starter',
      leadsUsed: 1,
      unlocked: [],
      bidsSent: [],
      periodStart: t,
    },
    ui: { catTab: 'service', bidSort: 'best', minRating: 0, tab: 'map' },
  };
}

/* ---------------------------------------------------------------- load / save */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const s = JSON.parse(raw);
    if (!s || s.v !== 1 || !Array.isArray(s.flags)) return seed();
    // Make sure newly-added seed flags show up for returning users.
    const have = new Set(s.flags.map(f => f.id));
    seed().flags.forEach(f => { if (!have.has(f.id)) s.flags.push(f); });
    const fresh = seed();
    s.ui = Object.assign(fresh.ui, s.ui || {});
    s.me = Object.assign(fresh.me, s.me || {});
    s.proProfiles = s.proProfiles || {};
    return s;
  } catch (e) {
    console.warn('[flagd] could not read saved state, starting fresh', e);
    return seed();
  }
}

export const state = load();

let saveTimer = null;
export function commit(silent = false) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { console.warn('[flagd] save failed', e); }
  }, 120);
  if (!silent) listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function resetAll() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  location.reload();
}

/* ---------------------------------------------------------------- flags */
export const myFlags   = () => state.flags.filter(f => f.mine).sort((a, b) => b.createdAt - a.createdAt);
export const openFlags = () => state.flags.filter(f => f.status === 'open');
export const flagById  = (id) => state.flags.find(f => f.id === id);

export function addFlag(f) {
  const flag = Object.assign({
    id: uid('f'),
    mine: true,
    status: 'open',
    createdAt: now(),
    bidCount: 0,
    who: state.me.name,
  }, f);
  state.flags.unshift(flag);
  commit();
  return flag;
}

export function removeFlag(id) {
  const i = state.flags.findIndex(f => f.id === id);
  if (i < 0) return;
  state.flags.splice(i, 1);
  state.bids = state.bids.filter(b => b.flagId !== id);
  Object.keys(state.threads).forEach(k => { if (state.threads[k].flagId === id) delete state.threads[k]; });
  commit();
}

/* ---------------------------------------------------------------- bids */
export const bidsFor = (flagId) => state.bids.filter(b => b.flagId === flagId && b.status !== 'withdrawn');
export const bidById = (id) => state.bids.find(b => b.id === id);

export function addBid(b) {
  const bid = Object.assign({ id: uid('b'), status: 'live', createdAt: now() }, b);
  state.bids.push(bid);
  const f = flagById(bid.flagId);
  if (f) f.bidCount = (f.bidCount || 0) + 1;
  commit();
  return bid;
}

/* ---------------------------------------------------------------- threads */
export const threadId = (flagId, proId) => flagId + '::' + proId;
export const threadsList = () =>
  Object.values(state.threads).sort((a, b) => b.updatedAt - a.updatedAt);
export const unreadTotal = () =>
  Object.values(state.threads).reduce((n, t) => n + (t.unread || 0), 0);

export function getThread(flagId, proId, create = true) {
  const id = threadId(flagId, proId);
  let t = state.threads[id];
  if (!t && create) {
    t = state.threads[id] = { id, flagId, proId, msgs: [], unread: 0, updatedAt: now() };
    commit();
  }
  return t;
}

export function pushMsg(flagId, proId, msg) {
  const t = getThread(flagId, proId);
  const m = Object.assign({ id: uid('m'), ts: now() }, msg);
  t.msgs.push(m);
  t.updatedAt = m.ts;
  if (m.from === 'them') t.unread = (t.unread || 0) + 1;
  commit();
  return m;
}

export function markRead(flagId, proId) {
  const t = state.threads[threadId(flagId, proId)];
  if (t && t.unread) { t.unread = 0; commit(); }
}

/* ---------------------------------------------------------------- ratings */
// A pro's shown rating blends the directory baseline with anything you rated in-app.
export function proRating(proId) {
  const base = proById(proId);
  if (!base) return { rating: 0, reviews: 0 };
  const mine = state.ratings[proId] || [];
  if (!mine.length) return { rating: base.rating, reviews: base.reviews };
  const total = base.rating * base.reviews + mine.reduce((s, r) => s + r.stars, 0);
  const count = base.reviews + mine.length;
  return { rating: Math.round((total / count) * 10) / 10, reviews: count };
}

export function rateP(proId, stars, text) {
  (state.ratings[proId] = state.ratings[proId] || []).push({ stars, text: text || '', at: now() });
  commit();
}

export const myRatingFor = (proId) => (state.ratings[proId] || [])[0] || null;

/* ---------------------------------------------------------------- pro side */
export const myProProfile = () => proById(state.pro.profileId) || PROS[0];
export const myPlan = () => planById(state.pro.plan);
export const leadsLeft = () => {
  const cap = myPlan().leads;
  return cap === Infinity ? Infinity : Math.max(0, cap - state.pro.leadsUsed);
};
export const hasUnlocked = (flagId) => state.pro.unlocked.includes(flagId);

export function unlockLead(flagId) {
  if (hasUnlocked(flagId)) return true;
  if (leadsLeft() <= 0) return false;
  state.pro.unlocked.push(flagId);
  state.pro.leadsUsed++;
  commit();
  return true;
}

/**
 * Unlock without touching the monthly allowance — used when an earned reward
 * credit pays for it instead. Kept here (rather than importing rewards.js) so the
 * store stays a leaf module with no cycles.
 */
export function grantUnlock(flagId) {
  if (hasUnlocked(flagId)) return true;
  state.pro.unlocked.push(flagId);
  commit();
  return true;
}

export function setPlan(id) {
  state.pro.plan = id;
  state.pro.leadsUsed = 0;
  state.pro.periodStart = now();
  commit();
}

/* ---------------------------------------------------------------- pro profiles */
export const proOverrides = (proId) => state.proProfiles[proId] || null;

export function saveProProfile(proId, patch) {
  state.proProfiles[proId] = Object.assign({}, state.proProfiles[proId] || {}, patch);
  commit();
}

/* ---------------------------------------------------------------- contact & dispatch */
export function setPhone(phone, optIn) {
  state.me.phone = phone || '';
  state.me.smsOptIn = !!optIn;
  commit();
}

/** Dispatch state lives on the flag: one hired pro, one trip. */
export function startTracking(flagId, trip) {
  const f = flagById(flagId);
  if (!f) return null;
  f.tracking = Object.assign({ startedAt: now(), status: 'enroute' }, trip);
  commit();
  return f.tracking;
}

export function updateTracking(flagId, patch) {
  const f = flagById(flagId);
  if (!f || !f.tracking) return;
  Object.assign(f.tracking, patch);
  commit(true);          // silent: the tracking view repaints on its own timer
}

export function logSms(flagId, msg) {
  const f = flagById(flagId);
  if (!f) return;
  (f.sms = f.sms || []).push(Object.assign({ id: uid('s'), at: now() }, msg));
  commit();
}

export function setMode(m) { state.mode = m; commit(); }
export function setUI(patch) { Object.assign(state.ui, patch); commit(); }
