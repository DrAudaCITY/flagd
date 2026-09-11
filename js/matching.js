// matching.js — business capabilities and the matching rules.
//
// The central rule of this file: a business only ever sees a flag it has EXPLICITLY
// opted into. Never infer that a dealership repairs cars, that a repair shop buys
// stock, or that a furniture retailer wants your used sofa. Opting in is an act.
//
// Matching has two tiers, kept deliberately separate:
//   HARD    type + category + capability + geography. Fails = not eligible, full stop.
//   SOFT    price band, brands, condition, specialisms. Fails = ranked lower.
// Missing information is never treated as a satisfied requirement.

import { PROS, proById, CATEGORIES } from './data.js';
import { state, commit } from './store.js';
import {
  migrateLegacyCategory, parentOf, nodeById, isEnabled, ITEM_CATALOG,
} from './taxonomy.js';
import { distance } from './geo.js';

const MILES = 1609.34;

/* ================================================================ capability model */
/**
 * A business profile's capabilities:
 *   businessTypes  ['service_provider','buyer',...]
 *   caps           { service:[categoryId], buy:[categoryId], sell:[categoryId] }
 *   prefs          { radiusMi, deliveryMi, remoteOk, minJob, maxJob,
 *                    brands:[], conditions:[], notify:{} }
 *
 * Seeded from the legacy single-trade profile so nothing is lost on migration:
 * a legacy service pro gets that one service capability and nothing else; a legacy
 * item pro is seeded as a buyer of that category, because that is what the old
 * "item" pros actually did (they answered wanted-posts with stock they had).
 */
export function seedCapabilities(pro) {
  const legacy = migrateLegacyCategory(pro.cat);
  const caps = { service: [], buy: [], sell: [] };
  const businessTypes = [];

  if (legacy.type === 'service') {
    caps.service.push(legacy.categoryId);
    businessTypes.push('service_provider');
  } else {
    // Legacy item pros answered "wanted" posts, i.e. they SELL to the buyer.
    caps.sell.push(legacy.categoryId);
    businessTypes.push(/dealer|dealership/i.test(pro.name) ? 'dealership' : 'retailer');
  }

  return {
    businessTypes,
    caps,
    prefs: {
      radiusMi: 25,
      deliveryMi: 25,
      remoteOk: false,
      minJob: 0,
      maxJob: 0,          // 0 = no ceiling
      brands: [],
      conditions: [],
      notify: { instant: true },
    },
  };
}

/** Capabilities for a business, with any in-app edits layered over the seed. */
export function capsFor(proId) {
  const pro = proById(proId);
  if (!pro) return null;
  const stored = (state.proCaps || {})[proId];
  if (stored) return stored;
  return seedCapabilities(pro);
}

export function saveCaps(proId, patch) {
  state.proCaps = state.proCaps || {};
  const current = capsFor(proId);
  state.proCaps[proId] = {
    businessTypes: patch.businessTypes || current.businessTypes,
    caps: Object.assign({}, current.caps, patch.caps || {}),
    prefs: Object.assign({}, current.prefs, patch.prefs || {}),
  };
  commit();
  return state.proCaps[proId];
}

/** Toggle one capability. This is the only way a business gains access to a lane. */
export function toggleCapability(proId, type, categoryId, on) {
  const c = capsFor(proId);
  const list = (c.caps[type] || []).slice();
  const i = list.indexOf(categoryId);
  if (on && i < 0) list.push(categoryId);
  if (!on && i >= 0) list.splice(i, 1);
  return saveCaps(proId, { caps: Object.assign({}, c.caps, { [type]: list }) });
}

/**
 * The flag type and the capability lane are NOT the same axis, and this is the
 * easiest thing in the whole domain to get backwards:
 *
 *   flag "I want to sell"  ->  needs a business that BUYS   (caps.buy)
 *   flag "I want to buy"   ->  needs a business that SELLS  (caps.sell)
 *   flag "I need a service"->  needs a business that SERVES (caps.service)
 *
 * The user's verb and the business's verb are opposites. Route through this map
 * rather than indexing caps by flag type.
 */
export const CAP_LANE = { service: 'service', sell: 'buy', buy: 'sell' };

export const hasCapability = (proId, flagType, categoryId) => {
  const c = capsFor(proId);
  if (!c) return false;
  const lane = CAP_LANE[flagType];
  if (!lane) return false;
  const list = c.caps[lane] || [];
  const parent = parentOf(categoryId);
  // A capability on the parent covers its subcategories; the reverse is not true.
  return list.includes(categoryId) || (parent && list.includes(parent.id));
};

/* ================================================================ hard gate */
/**
 * The authoritative eligibility check. Every feed, every search result and every
 * response submission goes through this — so a business cannot reach a flag by
 * calling an action directly instead of clicking through the UI.
 *
 * NOTE: in this prototype "server-side" does not exist; this runs in the browser
 * and is therefore advisory only. When a backend lands, this exact function is
 * what must run there, with the client copy kept purely for display.
 */
export function eligibility(proId, flag) {
  const pro = proById(proId);
  const caps = capsFor(proId);
  if (!pro || !caps || !flag) return fail('Unknown business or flag');

  const type = flagTypeOf(flag);
  const categoryId = categoryOf(flag);

  if (!isEnabled(categoryId)) return fail('This category is not open in your market');
  if (flag.status !== 'open') return fail('This flag is no longer taking responses');
  if (!hasCapability(proId, type, categoryId)) {
    return fail(`You have not enabled ${labelForType(type)}`);
  }

  const geo = geoCheck(pro, caps, flag, type);
  if (!geo.ok) return fail(geo.why);

  return { ok: true, reasons: [], soft: softSignals(pro, caps, flag) };
}

const fail = (why) => ({ ok: false, why, reasons: [why], soft: [] });

const labelForType = (t) =>
  t === 'service' ? 'service work in this category'
  : t === 'buy' ? 'selling items in this category'
  : 'buying items in this category';

/** Geography: remote-capable digital services bypass the radius entirely. */
function geoCheck(pro, caps, flag, type) {
  if (flag.remote && caps.prefs.remoteOk) return { ok: true };

  const base = state.home ? state.home.ll : null;
  if (!base || !flag.ll) return { ok: true };          // unknown distance is not a pass/fail

  const radius = (type === 'service' ? caps.prefs.radiusMi : caps.prefs.deliveryMi) || 25;
  const miles = distance(base, flag.ll) / MILES;
  return miles <= radius
    ? { ok: true }
    : { ok: false, why: `${Math.round(miles)} mi away — outside your ${radius} mi radius` };
}

/* ================================================================ soft signals */
/** Preference-level fit. Never blocks; explains ranking and warns on gaps. */
function softSignals(pro, caps, flag) {
  const out = [];
  const p = caps.prefs;
  const budget = Number(flag.budgetMax || 0);

  if (p.minJob && budget && budget < p.minJob) {
    out.push({ kind: 'warn', text: `Below your ${money(p.minJob)} minimum job size` });
  }
  if (p.maxJob && budget && budget > p.maxJob) {
    out.push({ kind: 'info', text: `Above your usual ${money(p.maxJob)} ceiling` });
  }
  if (p.brands.length) {
    const hay = `${flag.title || ''} ${flag.desc || ''}`.toLowerCase();
    const hit = p.brands.find(b => hay.includes(String(b).toLowerCase()));
    out.push(hit
      ? { kind: 'good', text: `Matches your specialty: ${hit}` }
      : { kind: 'unknown', text: 'Brand not stated' });
  }
  if (p.conditions.length && flag.condition && !p.conditions.includes(flag.condition)) {
    out.push({ kind: 'warn', text: `Condition "${flag.condition}" is outside your preferences` });
  }
  return out;
}

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

/* ================================================================ normalisation
 * Flags created before the taxonomy existed carry a legacy `cat`. Read through
 * these helpers everywhere rather than touching flag.cat directly.
 */
export function flagTypeOf(flag) {
  if (flag.type) return flag.type;
  const legacy = migrateLegacyCategory(flag.cat);
  return legacy.type;
}

export function categoryOf(flag) {
  if (flag.categoryId) return flag.categoryId;
  return migrateLegacyCategory(flag.cat).categoryId;
}

/* ================================================================ feeds */
/** Every open flag this business is eligible to respond to, nearest first. */
export function feedFor(proId) {
  const base = state.home ? state.home.ll : null;
  return state.flags
    .filter(f => f.status === 'open' && !f.mine)
    .map(f => ({ flag: f, elig: eligibility(proId, f) }))
    .filter(x => x.elig.ok)
    .map(x => Object.assign(x, {
      miles: base && x.flag.ll ? distance(base, x.flag.ll) / MILES : null,
    }))
    .sort((a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9));
}

/** Every business eligible for a flag — the other direction of the same rule. */
export function matchesForFlag(flag) {
  return PROS
    .map(p => ({ pro: p, elig: eligibility(p.id, flag) }))
    .filter(x => x.elig.ok);
}

export const matchCountFor = (flag) => matchesForFlag(flag).length;

/* ================================================================ suggestions
 * When a business first enables a lane, suggest categories rather than making
 * them hunt. Suggestions are proposals only — nothing is enabled automatically.
 */
export function suggestedAcquisitionCategories(pro) {
  const legacy = migrateLegacyCategory(pro.cat);
  const node = nodeById(legacy.categoryId);
  if (!node) return [];
  // An appliance repairer plausibly buys used appliances; propose the item
  // category that shares the subject matter, and let them decide.
  const RELATED = {
    'svc.appliance-repair': 'item.appliances',
    'svc.auto-repair': 'item.cars',
    'svc.device-repair': 'item.computers',
    'svc.moving': 'item.estate',
    'svc.carpentry': 'item.furniture',
    'svc.flooring': 'item.building-materials',
  };
  const related = RELATED[legacy.categoryId];
  return related ? [nodeById(related)].filter(Boolean) : [];
}

/** Business types that plausibly acquire a given item category, from the catalog. */
export const acquirersFor = (itemCategoryId) => {
  const n = ITEM_CATALOG.find(i => i.id === (parentOf(itemCategoryId) || {}).id);
  return n ? n.buyers : [];
};

/* ================================================================ analytics */
/** Funnel counters computed from local state. Wire to a real analytics sink later. */
export function funnel() {
  const flags = state.flags.filter(f => f.mine);
  const byType = { service: 0, sell: 0, buy: 0 };
  const byCategory = {};
  let responded = 0, accepted = 0, completed = 0, closedNoOutcome = 0;
  let firstResponseTotal = 0, firstResponseCount = 0;

  flags.forEach(f => {
    byType[flagTypeOf(f)] = (byType[flagTypeOf(f)] || 0) + 1;
    const cid = categoryOf(f);
    byCategory[cid] = (byCategory[cid] || 0) + 1;

    const bids = state.bids.filter(b => b.flagId === f.id);
    if (bids.length) {
      responded++;
      const first = Math.min(...bids.map(b => b.createdAt));
      firstResponseTotal += first - f.createdAt;
      firstResponseCount++;
    }
    if (f.hiredBidId) accepted++;
    if (f.status === 'done') completed++;
    if (f.status === 'closed' && !f.hiredBidId) closedNoOutcome++;
  });

  return {
    flagsCreated: flags.length,
    byType,
    byCategory,
    activeQualified: flags.filter(f => f.status === 'open').length,
    responseRate: flags.length ? Math.round((responded / flags.length) * 100) : 0,
    avgFirstResponseMin: firstResponseCount
      ? Math.round(firstResponseTotal / firstResponseCount / 60000) : null,
    responsesSubmitted: state.bids.length,
    acceptedResponses: accepted,
    // Deliberately NOT the same number as accepted: an accepted offer is a promise,
    // a completed job is an outcome the user confirmed.
    confirmedCompleted: completed,
    closedWithoutOutcome: closedNoOutcome,
  };
}
