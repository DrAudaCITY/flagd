// deals.js — the bid lifecycle: simulated incoming bids, accepting one,
// marking the job done, and rating the pro afterwards.
//
// In a real build every function here is a network call. The shapes it writes into
// the store are deliberately the shapes an API would return.

import { CATEGORIES, cat, prosFor, proById, PROS, PRO_LINES, SELLER_LINES } from './data.js';
import {
  state, addBid, bidsFor, bidById, flagById, pushMsg, getThread, rateP, commit, uid,
} from './store.js';
import { money, toast } from './ui.js';

/* ---------------------------------------------------------------- pricing model */
// [typical low, typical high] in USD for one job / one item.
const PRICE = {
  plumber:     [180, 950],
  electrician: [160, 1300],
  hvac:        [140, 1100],
  handyman:    [90, 420],
  roofer:      [350, 9500],
  landscaper:  [45, 320],
  cleaner:     [130, 420],
  mover:       [380, 1400],
  painter:     [400, 4200],
  pest:        [90, 320],
  appliance:   [120, 480],
  autoshop:    [90, 1600],
  usedcar:     [18000, 42000],
  furniture:   [250, 1600],
  electronics: [300, 1800],
  tools:       [120, 650],
  other:       [40, 600],
};

const UNIT_LABEL = {
  job: 'flat rate', visit: 'per visit', move: 'all in', repair: 'parts + labor', vehicle: 'out the door', item: 'delivered',
};

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Pull a numeric range out of a free-text budget like "$400–900" or "$45–80/visit". */
function budgetRange(text) {
  if (!text) return null;
  const nums = (String(text).match(/[\d][\d,]*/g) || [])
    .map(n => Number(n.replace(/,/g, '')))
    .filter(n => n >= 20);
  if (!nums.length) return null;
  return nums.length === 1 ? [nums[0] * 0.8, nums[0]] : [nums[0], nums[1]];
}

/**
 * A stable "market price" for one flag, so re-renders never shuffle the numbers.
 * When the buyer stated a budget, bids cluster inside it — that is the whole
 * reason the intake form asks for one.
 */
function anchorPrice(flag) {
  const t = (hash(flag.id) % 1000) / 1000;
  const stated = budgetRange(flag.budget);
  if (stated) {
    const [lo, hi] = stated;
    return Math.round(lo + (hi - lo) * (0.18 + t * 0.55));   // lower-middle of the budget
  }
  const [lo, hi] = PRICE[flag.cat] || PRICE.other;
  // Bias toward the lower half — most jobs are ordinary jobs.
  return Math.round(lo + (hi - lo) * (t * t * 0.85 + 0.08));
}

function roundNice(n) {
  if (n >= 10000) return Math.round(n / 250) * 250;
  if (n >= 1000) return Math.round(n / 50) * 50;
  if (n >= 200) return Math.round(n / 5) * 5;
  return Math.round(n);
}

/* ---------------------------------------------------------------- pro pool */
// Returns candidate pros for a category, ordered fastest-responder first.
// Categories with a thin directory borrow generic pros so a flag never sits empty.
export function poolFor(catKey) {
  let pool = prosFor(catKey);
  if (pool.length < 3) {
    const kind = cat(catKey).kind;
    const extra = PROS.filter(p => CATEGORIES[p.cat] && CATEGORIES[p.cat].kind === kind && !pool.includes(p));
    pool = pool.concat(extra.slice(0, 3 - pool.length));
  }
  return pool.slice().sort((a, b) => a.resp - b.resp);
}

const linesFor = (catKey) => (cat(catKey).kind === 'item' ? SELLER_LINES : PRO_LINES);
const pickOne = (arr, salt) => arr[hash(String(salt)) % arr.length];
// Offsetting by the bidder's position guarantees two pros on the same flag never
// open with the identical line, which instantly reads as canned.
const pickNth = (arr, salt, i) => arr[(hash(String(salt)) + i) % arr.length];

/* ---------------------------------------------------------------- bid notes */
const SERVICE_NOTES = [
  'Covers parts, labor and haul-off. No trip charge.',
  'Includes the diagnostic. If it is a bigger job than described I will call before doing anything.',
  'Price holds for 7 days. I can usually be out within 24 hours.',
  'Two-person crew. Everything cleaned up before we leave.',
  'Includes a 1-year workmanship warranty in writing.',
  'Straight quote, no hourly surprises. Permit is extra if the city requires one.',
];
const VEHICLE_NOTES = [
  'Clean title, no accidents on the Carfax. Happy to arrange an inspection.',
  'One owner, all service records. I can send a walkaround video today.',
  'Out-the-door price including tax, title and dealer fees.',
  'Just off a lease, still under factory powertrain warranty.',
  'Can hold it for 48 hours with no deposit while you arrange financing.',
  'Fresh state inspection and four new tires on it.',
];
const ITEM_NOTES = [
  'In stock now. Price includes delivery inside the metro.',
  'Comes with the original box and accessories. 90-day warranty.',
  'Can hold it for 48 hours with no deposit.',
  'Price is firm but I will throw in delivery and setup.',
  'Barely used — happy to send photos of every angle before you commit.',
  'Local pickup, or I can drop it off for a flat $40.',
];

/* ---------------------------------------------------------------- simulation */
const timers = new Map();   // flagId -> [timeoutId]

/**
 * Drip 3–6 bids into a freshly planted flag, each opening a chat thread.
 * onUpdate fires after every arrival so the open view can re-render.
 */
export function simulateBids(flag, onUpdate) {
  const pool = poolFor(flag.cat);
  const count = Math.min(pool.length, 3 + (hash(flag.id) % 4));
  const anchor = anchorPrice(flag);
  const isItem = cat(flag.cat).kind === 'item';
  const ids = [];

  for (let i = 0; i < count; i++) {
    const pro = pool[i];
    // Cheaper bids skew toward lower-rated pros; the best pro is rarely the cheapest.
    const quality = (pro.rating - 4.0) / 1.0;                 // ~0 .. ~0.9
    const spread = 1 + (quality * 0.16) + ((hash(pro.id + flag.id) % 21) - 10) / 100;
    const price = roundNice(anchor * spread);

    const delay = 2600 + i * (2400 + (hash(pro.id) % 2200));
    const t = setTimeout(() => {
      const bid = addBid({
        flagId: flag.id,
        proId: pro.id,
        price,
        unit: UNIT_LABEL[cat(flag.cat).unit] || 'flat rate',
        note: pickOne(
          flag.cat === 'usedcar' ? VEHICLE_NOTES : isItem ? ITEM_NOTES : SERVICE_NOTES,
          pro.id + flag.id),
        etaMin: pro.resp,
      });

      // Every bid opens a conversation — that is the whole point of the platform.
      getThread(flag.id, pro.id);
      pushMsg(flag.id, pro.id, { from: 'sys', text: `${pro.name} bid ${money(price)} on your flag.` });
      pushMsg(flag.id, pro.id, { from: 'them', text: pickNth(linesFor(flag.cat).open, flag.id, i) });
      setTimeout(() => {
        pushMsg(flag.id, pro.id, { from: 'them', text: pickNth(linesFor(flag.cat).qualify, flag.id, i) });
        onUpdate && onUpdate(bid);
      }, 1800);

      toast(`New bid: ${pro.name} — ${money(price)}`);
      onUpdate && onUpdate(bid);
    }, delay);
    ids.push(t);
  }
  timers.set(flag.id, ids);
}

export function cancelSimulation(flagId) {
  (timers.get(flagId) || []).forEach(clearTimeout);
  timers.delete(flagId);
}

/* ---------------------------------------------------------------- sorting & filtering */
export function sortBids(list, mode, homeLL) {
  const arr = list.slice();
  const rate = (b) => {
    const p = proById(b.proId);
    return p ? p.rating : 0;
  };
  if (mode === 'price') return arr.sort((a, b) => a.price - b.price);
  if (mode === 'rating') return arr.sort((a, b) => rate(b) - rate(a));
  if (mode === 'fast') return arr.sort((a, b) => a.etaMin - b.etaMin);
  // "best" = value score: rating carries more weight than raw price.
  const max = Math.max(...arr.map(b => b.price), 1);
  return arr.sort((a, b) =>
    (rate(b) * 2 - b.price / max) - (rate(a) * 2 - a.price / max));
}

export function filterBids(list, minRating) {
  if (!minRating) return list;
  return list.filter(b => {
    const p = proById(b.proId);
    return p && p.rating >= minRating;
  });
}

/* ---------------------------------------------------------------- close the deal */
export function acceptBid(bidId) {
  const bid = bidById(bidId);
  if (!bid) return null;
  const flag = flagById(bid.flagId);
  if (!flag) return null;

  bid.status = 'accepted';
  bidsFor(flag.id).forEach(b => { if (b.id !== bid.id && b.status === 'live') b.status = 'declined'; });
  flag.status = 'hired';
  flag.hiredBidId = bid.id;
  flag.hiredAt = Date.now();
  commit();

  const pro = proById(bid.proId);
  pushMsg(flag.id, bid.proId, { from: 'sys', text: `You hired ${pro.name} for ${money(bid.price)}.` });
  setTimeout(() => {
    pushMsg(flag.id, bid.proId, { from: 'them', text: pickOne(linesFor(flag.cat).hired, bid.proId) });
    pushMsg(flag.id, bid.proId, { from: 'them', text: pickOne(linesFor(flag.cat).scheduling, bid.proId + 's') });
  }, 1400);

  return bid;
}

export function completeJob(flagId) {
  const f = flagById(flagId);
  if (!f) return;
  f.status = 'done';
  f.doneAt = Date.now();
  commit();
}

export function reopenFlag(flagId) {
  const f = flagById(flagId);
  if (!f) return;
  f.status = 'open';
  delete f.hiredBidId;
  bidsFor(flagId).forEach(b => { if (b.status !== 'withdrawn') b.status = 'live'; });
  commit();
}

export function submitRating(flagId, proId, stars, text) {
  rateP(proId, stars, text);
  const f = flagById(flagId);
  if (f) { f.rated = true; commit(); }
  pushMsg(flagId, proId, { from: 'sys', text: `You rated this ${stars} star${stars > 1 ? 's' : ''}.` });
}

/* ---------------------------------------------------------------- pro-side bidding */
export function proSendBid(flagId, price, note) {
  const me = state.pro.profileId;
  const flag = flagById(flagId);
  if (!flag) return null;
  const bid = addBid({
    flagId,
    proId: me,
    price: Number(price),
    unit: UNIT_LABEL[cat(flag.cat).unit] || 'flat rate',
    note: note || '',
    etaMin: proById(me).resp,
    fromMe: true,
  });
  if (!state.pro.bidsSent.includes(flagId)) state.pro.bidsSent.push(flagId);
  commit();
  return bid;
}

export const priceHintFor = (flag) => {
  const a = anchorPrice(flag);
  return [roundNice(a * 0.85), roundNice(a * 1.15)];
};

export { anchorPrice };
