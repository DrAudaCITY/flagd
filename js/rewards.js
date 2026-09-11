// rewards.js — the two-sided reward system.
//
// Deliberately asymmetric, because the two sides are motivated by different things
// and only one of them costs money:
//
//   BUYERS earn STANDING. Points, tiers, a badge pros can see, and priority in pro
//          feeds. Costs nothing, and it buys the thing the marketplace most lacks:
//          confirmed outcomes. Pros want to spend unlocks on buyers who actually
//          close, so buyer standing is genuinely useful information to them.
//
//   PROS   earn CREDITS. One credit = one lead unlock. Self-funding, since an
//          unlock has no marginal cost, and it targets churn — the metric that
//          decides whether a pro-pays marketplace lives.
//
// Two rules hold the whole thing up:
//
//   1. NOTHING IS EARNED FOR CREATING A FLAG. Pros pay per unlock; paying people to
//      post would flood the feed with junk and burn the paying side's money. Every
//      award below requires a verified outcome.
//   2. AN ACCEPTED OFFER IS NOT A COMPLETED JOB. Awards vest on confirmed
//      completion, never on hiring.

import { state, commit, uid, now, flagById } from './store.js';
import { proById } from './data.js';

/* ================================================================ tiers */
export const BUYER_TIERS = [
  { id: 'new',      label: 'New',      min: 0,   perks: ['Standard placement in pro feeds'] },
  { id: 'trusted',  label: 'Trusted',  min: 50,  perks: ['Trusted badge on your flags', 'Slight boost in pro feeds'] },
  { id: 'verified', label: 'Verified', min: 200, perks: ['Verified badge', 'Priority placement', 'Reviews marked verified'] },
  { id: 'gold',     label: 'Gold',     min: 500, perks: ['Top placement in pro feeds', 'Gold badge', 'Faster response times in practice'] },
];

export const PRO_TIERS = [
  { id: 'bronze', label: 'Bronze', min: 0,  perks: ['Standard placement in bid lists'] },
  { id: 'silver', label: 'Silver', min: 15, perks: ['Higher placement in bid lists', 'Silver badge on your profile'] },
  { id: 'gold',   label: 'Gold',   min: 40, perks: ['Top placement in bid lists', 'Gold badge', '10% off your subscription'] },
];

const tierFor = (tiers, score) =>
  tiers.slice().reverse().find(t => score >= t.min) || tiers[0];

export const buyerTier = () => tierFor(BUYER_TIERS, buyerPoints());
export const proTier = (proId) => tierFor(PRO_TIERS, proScore(proId));

export function nextTier(tiers, score) {
  const up = tiers.find(t => score < t.min);
  return up ? { tier: up, need: up.min - score } : null;
}

/* ================================================================ award table
 * Every entry names the verified event that triggers it. If an event cannot be
 * verified by the other party, it does not belong in this table.
 */
export const BUYER_AWARDS = {
  job_completed:  { points: 50, label: 'Confirmed a job was completed' },
  rating_left:    { points: 20, label: 'Rated a pro' },
  review_written: { points: 10, label: 'Wrote a review, not just stars' },
  // A negative. Pros spent real unlocks on a flag that went nowhere.
  abandoned:      { points: -15, label: 'Closed a flag with no outcome after pros responded' },
};

export const PRO_AWARDS = {
  job_completed:  { credits: 2, score: 3, label: 'Completed a job, confirmed by the customer' },
  fast_response:  { credits: 1, score: 1, label: 'First response in under 15 minutes' },
  five_star:      { credits: 1, score: 2, label: 'Earned a 5-star rating' },
  poor_rating:    { credits: -2, score: -4, label: 'Received a rating of 2 stars or below' },
  monthly_streak: { credits: 5, score: 2, label: 'Five completed jobs in a calendar month' },
};

/* ================================================================ state */
function bucket() {
  state.rewards = state.rewards || { buyer: { points: 0, ledger: [] }, pros: {} };
  state.rewards.buyer = state.rewards.buyer || { points: 0, ledger: [] };
  state.rewards.pros = state.rewards.pros || {};
  return state.rewards;
}

function proBucket(proId) {
  const b = bucket();
  b.pros[proId] = b.pros[proId] || { credits: 0, score: 0, ledger: [] };
  return b.pros[proId];
}

export const buyerPoints = () => Math.max(0, bucket().buyer.points || 0);
export const buyerLedger = () => bucket().buyer.ledger.slice().reverse();
export const proCredits = (proId) => Math.max(0, proBucket(proId).credits || 0);
export const proScore = (proId) => Math.max(0, proBucket(proId).score || 0);
export const proLedger = (proId) => proBucket(proId).ledger.slice().reverse();

/* ================================================================ anti-gaming
 * Two accounts can always agree to fake a job. The cheapest effective brake is a
 * cap per counterparty per month, so a collusion loop stops paying quickly.
 * A real build adds payment evidence and device/identity signals on top.
 */
const PAIR_CAP_PER_MONTH = 3;

function pairKey(proId) {
  const d = new Date();
  return `${proId}:${d.getFullYear()}-${d.getMonth()}`;
}

function pairCountOk(proId) {
  const b = bucket();
  b.pairs = b.pairs || {};
  const k = pairKey(proId);
  return (b.pairs[k] || 0) < PAIR_CAP_PER_MONTH;
}

function bumpPair(proId) {
  const b = bucket();
  b.pairs = b.pairs || {};
  const k = pairKey(proId);
  b.pairs[k] = (b.pairs[k] || 0) + 1;
}

/* ================================================================ awarding */
function pushLedger(list, entry) {
  list.push(Object.assign({ id: uid('rw'), at: now() }, entry));
  if (list.length > 200) list.shift();
}

/** Award the buyer. Silently ignores unknown reasons rather than inventing points. */
export function awardBuyer(reason, meta) {
  const rule = BUYER_AWARDS[reason];
  if (!rule) return null;
  const b = bucket().buyer;
  b.points = Math.max(0, (b.points || 0) + rule.points);
  pushLedger(b.ledger, { reason, label: rule.label, points: rule.points, meta: meta || null });
  commit();
  return { points: rule.points, total: b.points };
}

/** Award a pro. Positive awards are capped per counterparty per month. */
export function awardPro(proId, reason, meta) {
  const rule = PRO_AWARDS[reason];
  if (!rule || !proById(proId)) return null;

  const positive = rule.credits > 0 || rule.score > 0;
  if (positive && !pairCountOk(proId)) {
    return { capped: true, credits: 0, total: proCredits(proId) };
  }

  const p = proBucket(proId);
  p.credits = Math.max(0, (p.credits || 0) + rule.credits);
  p.score = Math.max(0, (p.score || 0) + rule.score);
  pushLedger(p.ledger, { reason, label: rule.label, credits: rule.credits, score: rule.score, meta: meta || null });
  if (positive) bumpPair(proId);
  commit();
  return { credits: rule.credits, total: p.credits, tier: proTier(proId) };
}

/** Spend one credit. Callers fall back to the plan allowance when this returns false. */
export function spendCredit(proId, why) {
  const p = proBucket(proId);
  if ((p.credits || 0) < 1) return false;
  p.credits -= 1;
  pushLedger(p.ledger, { reason: 'spent', label: why || 'Unlocked a lead with a credit', credits: -1, score: 0 });
  commit();
  return true;
}

/* ================================================================ hooks
 * Called from the existing lifecycle so rewards cannot drift out of sync with
 * what actually happened.
 */

/** Fired when the CUSTOMER confirms the work is done — never on hire. */
export function onJobCompleted(flagId, proId) {
  const out = { buyer: awardBuyer('job_completed', { flagId }), pro: null };
  if (proId) {
    out.pro = awardPro(proId, 'job_completed', { flagId });
    out.streak = checkMonthlyStreak(proId);
  }
  return out;
}

export function onRated(flagId, proId, stars, hasText) {
  awardBuyer('rating_left', { flagId, stars });
  if (hasText) awardBuyer('review_written', { flagId });
  if (stars >= 5) awardPro(proId, 'five_star', { flagId });
  else if (stars <= 2) awardPro(proId, 'poor_rating', { flagId });
  return { points: buyerPoints(), tier: buyerTier() };
}

/** Measured from flag creation to this pro's first response. */
export function onResponded(flag, proId, respondedAt) {
  const mins = (respondedAt - flag.createdAt) / 60000;
  if (mins <= 15) return awardPro(proId, 'fast_response', { flagId: flag.id, mins: Math.round(mins) });
  return null;
}

/** Flag closed with responses but no hire — the case that costs pros money. */
export function onAbandoned(flagId) {
  const had = state.bids.some(b => b.flagId === flagId);
  return had ? awardBuyer('abandoned', { flagId }) : null;
}

function checkMonthlyStreak(proId) {
  const p = proBucket(proId);
  const d = new Date();
  const thisMonth = p.ledger.filter(e => {
    const t = new Date(e.at);
    return e.reason === 'job_completed' &&
           t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
  }).length;
  const already = p.ledger.some(e => {
    const t = new Date(e.at);
    return e.reason === 'monthly_streak' &&
           t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
  });
  if (thisMonth >= 5 && !already) return awardPro(proId, 'monthly_streak', {});
  return null;
}

/* ================================================================ feed priority
 * Buyer standing is the perk that costs nothing: a Gold buyer's flag surfaces
 * above a stranger's, because pros would rather spend an unlock on someone with a
 * track record of closing. Seed flags get a deterministic tier so the demo feed is
 * not uniformly "New".
 */
export function buyerTierForFlag(flag) {
  if (flag.mine) return buyerTier();
  let h = 0;
  const s = String(flag.id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return BUYER_TIERS[Math.abs(h) % BUYER_TIERS.length];
}

/** Rank boost applied in pro feeds. Never overrides eligibility — only order. */
export function feedBoost(flag) {
  const t = buyerTierForFlag(flag);
  return { new: 0, trusted: 1, verified: 2, gold: 3 }[t.id] || 0;
}

/* ================================================================ reporting */
export function rewardsSummary() {
  const b = bucket().buyer;
  const points = buyerPoints();
  const tier = buyerTier();
  const next = nextTier(BUYER_TIERS, points);
  return {
    points,
    tier,
    next,
    completed: b.ledger.filter(e => e.reason === 'job_completed').length,
    reviews: b.ledger.filter(e => e.reason === 'review_written').length,
  };
}

export function proRewardsSummary(proId) {
  const credits = proCredits(proId);
  const score = proScore(proId);
  const tier = proTier(proId);
  const next = nextTier(PRO_TIERS, score);
  const led = proBucket(proId).ledger;
  return {
    credits,
    score,
    tier,
    next,
    completed: led.filter(e => e.reason === 'job_completed').length,
    fiveStars: led.filter(e => e.reason === 'five_star').length,
    spent: led.filter(e => e.reason === 'spent').length,
  };
}
