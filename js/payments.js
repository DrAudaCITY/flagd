// payments.js — escrow: money is committed when a pro is hired and released when
// the customer confirms the work is done. This is what makes "hired" mean something.
//
// ─────────────────────────────────────────────────────────────────────────────
// THIS FILE CANNOT TAKE REAL MONEY, AND MUST NOT PRETEND TO.
//
// Stripe needs a server. Specifically:
//   • Creating a PaymentIntent requires your SECRET key. It must never reach the
//     browser. Unlike the Maps key it cannot be restricted by referrer — anyone
//     who loads the page would be able to charge and refund at will.
//   • Webhooks are the only trustworthy signal that money moved. A browser cannot
//     receive them, and a client-side "success" callback can be forged.
//   • Paying pros out requires Stripe Connect, which is server-side only.
//
// So `gateway` below is a simulator with exactly the shape the real adapter has.
// Swapping it is replacing one object — see SERVER_CONTRACT at the bottom.
//
// AND: never build a form that collects raw card numbers. Not here, not later.
// That drags you into PCI-DSS scope for no benefit. Stripe Elements or Checkout
// holds the card; Flagd only ever sees a token and the last four digits.
// ─────────────────────────────────────────────────────────────────────────────
//
// Money is integer CENTS everywhere. No floats, ever — 0.1 + 0.2 problems in a
// payments ledger are the kind of bug you find in an angry support ticket.

import { state, commit, uid, now, flagById, bidsFor } from './store.js';
import { proById } from './data.js';

/* ================================================================ economics */
/**
 * The user's decision: Flagd takes NO cut of job payments. Revenue is the pro
 * subscription only, and the platform absorbs the processing fee.
 *
 * That keeps "what you quote is what you keep" literally true, which is the
 * clearest differentiator against Angi and Thumbtack. It is also a real cost:
 * at scale, ~2.9% + 30c per job comes out of subscription margin. If that ever
 * stops working, PLATFORM_FEE_BPS is the single number to change — but changing
 * it also means rewriting the promise on the plans page.
 */
export const PLATFORM_FEE_BPS = 0;              // basis points. 0 = no commission.
export const STRIPE_PCT = 0.029;
export const STRIPE_FLAT_CENTS = 30;

export const processingFeeCents = (amountCents) =>
  Math.round(amountCents * STRIPE_PCT) + STRIPE_FLAT_CENTS;

export const platformFeeCents = (amountCents) =>
  Math.round((amountCents * PLATFORM_FEE_BPS) / 10000);

/** What the pro actually receives. With no platform fee, the full quote. */
export const proReceivesCents = (amountCents) =>
  amountCents - platformFeeCents(amountCents);

/**
 * A card authorisation expires after about a week. If the job is further out than
 * that, holding an auth will silently fail — so past this window we capture into
 * the platform balance instead and hold the money there.
 */
export const AUTH_HOLD_DAYS = 7;

/* ================================================================ states */
export const PAYMENT_STATES = {
  none:        { label: 'No payment set up', tone: 'done' },
  authorized:  { label: 'Card authorised', tone: 'open', blurb: 'Funds reserved on the customer’s card. Nothing has been taken yet.' },
  held:        { label: 'Funds held', tone: 'open', blurb: 'Taken and held by Flagd. Released when you confirm the work is done.' },
  released:    { label: 'Paid out', tone: 'hired', blurb: 'Sent to the pro.' },
  refunded:    { label: 'Refunded', tone: 'done', blurb: 'Returned to the customer.' },
  part_refund: { label: 'Partly refunded', tone: 'done' },
  disputed:    { label: 'Disputed', tone: 'new', blurb: 'On hold while support decides.' },
  failed:      { label: 'Payment failed', tone: 'new' },
};

export const money = (cents) =>
  '$' + (Math.round(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ================================================================ gateway adapter
 * Every method mirrors a real Stripe call. The simulator resolves optimistically;
 * the real one must be driven by webhooks, not by these return values.
 */
export const gateway = {
  name: 'simulator',

  /** POST /api/payments/intent  ->  stripe.paymentIntents.create(...) */
  async createIntent({ amountCents, captureLater }) {
    await tick();
    return {
      id: 'pi_sim_' + uid('x').slice(2),
      status: captureLater ? 'requires_capture' : 'succeeded',
      amountCents,
    };
  },

  /** POST /api/payments/:id/capture  ->  stripe.paymentIntents.capture(id) */
  async capture(intentId) {
    await tick();
    return { id: intentId, status: 'succeeded' };
  },

  /** POST /api/payouts  ->  stripe.transfers.create({ destination: acct_… }) */
  async transfer({ amountCents, destination }) {
    await tick();
    if (!destination) throw new Error('PRO_NOT_ONBOARDED');
    return { id: 'tr_sim_' + uid('x').slice(2), amountCents, destination };
  },

  /** POST /api/payments/:id/refund  ->  stripe.refunds.create(...) */
  async refund({ intentId, amountCents }) {
    await tick();
    return { id: 're_sim_' + uid('x').slice(2), intentId, amountCents };
  },
};

const tick = () => new Promise(r => setTimeout(r, 420));

/* ================================================================ payment methods
 * A saved card is a TOKEN plus display metadata. The number itself never exists
 * in this application, in this state object, or in localStorage.
 */
export function savedCard() {
  return state.billing && state.billing.card ? state.billing.card : null;
}

export function saveCardToken({ brand, last4, expMonth, expYear, token }) {
  state.billing = state.billing || {};
  state.billing.card = {
    brand: brand || 'Visa',
    last4: String(last4 || '4242').slice(-4),
    expMonth: expMonth || 12,
    expYear: expYear || 2030,
    token: token || 'pm_sim_' + uid('x').slice(2),   // Stripe PaymentMethod id
    addedAt: now(),
  };
  commit();
  return state.billing.card;
}

export function removeCard() {
  if (state.billing) delete state.billing.card;
  commit();
}

/* ================================================================ pro payouts
 * Stripe Connect. A pro cannot be paid until they have onboarded and Stripe has
 * cleared their KYC — this is a hard gate, not a formality.
 */
export function payoutAccount(proId) {
  state.payouts = state.payouts || {};
  return state.payouts[proId] || { status: 'not_onboarded', accountId: null, balanceCents: 0 };
}

export function startOnboarding(proId) {
  state.payouts = state.payouts || {};
  state.payouts[proId] = {
    status: 'pending',
    accountId: 'acct_sim_' + uid('x').slice(2),
    balanceCents: payoutAccount(proId).balanceCents || 0,
    startedAt: now(),
  };
  commit();
  return state.payouts[proId];
}

/** Stripe signals this via the account.updated webhook, never from the client. */
export function completeOnboarding(proId) {
  const a = payoutAccount(proId);
  state.payouts[proId] = Object.assign({}, a, { status: 'active', activeAt: now() });
  commit();
  return state.payouts[proId];
}

export const canReceivePayouts = (proId) => payoutAccount(proId).status === 'active';

/* ================================================================ the escrow flow */
function attach(flag, patch) {
  flag.payment = Object.assign(flag.payment || { events: [] }, patch);
  flag.payment.events = flag.payment.events || [];
  return flag.payment;
}

function logEvent(flag, type, text) {
  flag.payment.events.push({ id: uid('pe'), type, text, at: now() });
  commit();
}

/**
 * Called when the buyer hires. Reserves the money so "hired" is a commitment
 * rather than a status label.
 *
 * Jobs scheduled beyond the authorisation window are captured immediately and
 * held by the platform, because an auth would expire before the work happened.
 */
export async function authorizeForHire(flagId, bidId, { scheduledInDays } = {}) {
  const flag = flagById(flagId);
  const bid = bidsFor(flagId).find(b => b.id === bidId);
  if (!flag || !bid) return { ok: false, why: 'No booking found' };

  const card = savedCard();
  if (!card) return { ok: false, why: 'NO_CARD' };

  const amountCents = Math.round(Number(bid.price) * 100);
  const captureLater = !(scheduledInDays > AUTH_HOLD_DAYS);

  attach(flag, {
    id: uid('pay'),
    proId: bid.proId,
    bidId: bid.id,
    amountCents,
    currency: 'usd',
    platformFeeCents: platformFeeCents(amountCents),
    processingFeeCents: processingFeeCents(amountCents),
    proReceivesCents: proReceivesCents(amountCents),
    status: 'pending',
    cardLast4: card.last4,
  });

  try {
    const intent = await gateway.createIntent({ amountCents, captureLater, method: card.token });
    flag.payment.intentId = intent.id;

    if (captureLater) {
      flag.payment.status = 'authorized';
      flag.payment.authorizedAt = now();
      flag.payment.expiresAt = now() + AUTH_HOLD_DAYS * 86400000;
      logEvent(flag, 'authorized',
        `${money(amountCents)} reserved on ${card.brand} ending ${card.last4}. Not charged yet.`);
    } else {
      flag.payment.status = 'held';
      flag.payment.capturedAt = now();
      logEvent(flag, 'held',
        `${money(amountCents)} charged and held by Flagd — the job is scheduled beyond the ${AUTH_HOLD_DAYS}-day authorisation window.`);
    }
    commit();
    return { ok: true, payment: flag.payment };
  } catch (e) {
    flag.payment.status = 'failed';
    logEvent(flag, 'failed', 'The card was declined.');
    return { ok: false, why: 'DECLINED' };
  }
}

/**
 * Called when the CUSTOMER confirms the work is done. Captures if still on an
 * authorisation, then pays the pro. Never triggered by the pro alone.
 */
export async function releaseOnCompletion(flagId) {
  const flag = flagById(flagId);
  if (!flag || !flag.payment) return { ok: false, why: 'No payment on this job' };
  const p = flag.payment;
  if (p.status === 'released') return { ok: true, payment: p };
  if (p.status !== 'authorized' && p.status !== 'held') {
    return { ok: false, why: `Cannot release from "${p.status}"` };
  }

  if (p.status === 'authorized') {
    await gateway.capture(p.intentId);
    p.status = 'held';
    p.capturedAt = now();
    logEvent(flag, 'captured', `${money(p.amountCents)} captured.`);
  }

  const acct = payoutAccount(p.proId);
  if (acct.status !== 'active') {
    // Money stays safe with the platform rather than disappearing into a void.
    logEvent(flag, 'payout_blocked',
      'Held — the pro has not finished payout onboarding. They will be paid as soon as they do.');
    return { ok: false, why: 'PRO_NOT_ONBOARDED', payment: p };
  }

  const tr = await gateway.transfer({ amountCents: p.proReceivesCents, destination: acct.accountId });
  p.status = 'released';
  p.releasedAt = now();
  p.transferId = tr.id;
  acct.balanceCents = (acct.balanceCents || 0) + p.proReceivesCents;
  state.payouts[p.proId] = acct;
  logEvent(flag, 'released', `${money(p.proReceivesCents)} paid to ${proById(p.proId).name}.`);
  return { ok: true, payment: p };
}

/** Support-initiated. Full or partial; partial is how a split decision settles. */
export async function refundPayment(flagId, { amountCents, reason } = {}) {
  const flag = flagById(flagId);
  if (!flag || !flag.payment) return { ok: false, why: 'No payment on this job' };
  const p = flag.payment;
  if (p.status === 'released') {
    return { ok: false, why: 'ALREADY_PAID_OUT' };
  }

  const amt = Math.min(amountCents || p.amountCents, p.amountCents - (p.refundedCents || 0));
  await gateway.refund({ intentId: p.intentId, amountCents: amt });
  p.refundedCents = (p.refundedCents || 0) + amt;
  p.status = p.refundedCents >= p.amountCents ? 'refunded' : 'part_refund';
  p.refundedAt = now();
  logEvent(flag, 'refunded', `${money(amt)} returned to the customer${reason ? ` — ${reason}` : ''}.`);
  return { ok: true, payment: p };
}

/** Freeze a payment while a dispute is decided. Nothing moves either way. */
export function markDisputed(flagId, caseRef) {
  const flag = flagById(flagId);
  if (!flag || !flag.payment) return null;
  flag.payment.status = 'disputed';
  flag.payment.caseRef = caseRef || null;
  logEvent(flag, 'disputed', `Frozen pending support case ${caseRef || ''}.`.trim());
  return flag.payment;
}

/* ================================================================ peer settlement
 * SELL flags run money the other way: a business pays a private individual. Putting
 * that through Connect would mean KYC-onboarding someone selling one sofa, which
 * nobody will do. So the seller can nominate Zelle / Cash App / Venmo / cash.
 *
 * This is the dangerous path and the product should say so. Those rails are
 * instant, irreversible and carry no buyer or seller protection — which is exactly
 * why "just Zelle me" is the most common marketplace scam there is. The support
 * module classifies those words as fraud when they appear in open chat.
 *
 * The rules that make the difference between a payment method and a scam vector:
 *   1. A handle is NEVER shown on the flag or to bidders at large. It is revealed
 *      to exactly one counterparty, after an offer is accepted.
 *   2. The seller is told plainly that Flagd cannot reverse it.
 *   3. Escrow stays the default and the recommended option wherever it can work.
 */
export const SETTLEMENT_METHODS = {
  platform: { id: 'platform', label: 'Through Flagd', hint: 'Held until both sides confirm. Reversible if it goes wrong.', safe: true },
  zelle:    { id: 'zelle', label: 'Zelle', hint: 'Instant and irreversible. No protection if it goes wrong.', safe: false, handle: 'Phone or email on your Zelle' },
  cashapp:  { id: 'cashapp', label: 'Cash App', hint: 'Instant and irreversible. No protection if it goes wrong.', safe: false, handle: '$Cashtag' },
  venmo:    { id: 'venmo', label: 'Venmo', hint: 'Reversals are rare and slow. Treat it as cash.', safe: false, handle: '@username' },
  cash:     { id: 'cash', label: 'Cash on collection', hint: 'Count it before the item leaves with them.', safe: false },
};

/** Seller nominates how they want paid. The handle is stored, not published. */
export function setSettlement(flagId, { method, handle }) {
  const flag = flagById(flagId);
  if (!flag) return null;
  flag.settlement = {
    method,
    handle: handle || '',
    revealedTo: null,
    revealedAt: null,
    confirmedAt: null,
  };
  commit();
  return flag.settlement;
}

/**
 * Reveal the handle to ONE accepted counterparty. Anything that reads a handle
 * goes through here, so a handle cannot leak to a bidder who was not chosen.
 */
export function revealSettlement(flagId, proId) {
  const flag = flagById(flagId);
  if (!flag || !flag.settlement) return { ok: false, why: 'No payment method set' };
  if (flag.hiredBidId == null) return { ok: false, why: 'Nothing has been agreed yet' };
  const accepted = bidsFor(flagId).find(b => b.id === flag.hiredBidId);
  if (!accepted || accepted.proId !== proId) {
    return { ok: false, why: 'Only the accepted buyer can see this' };
  }
  flag.settlement.revealedTo = proId;
  flag.settlement.revealedAt = now();
  commit();
  return { ok: true, settlement: flag.settlement };
}

/** Read a handle. Returns null unless this viewer is the agreed counterparty. */
export function settlementHandleFor(flag, viewerProId) {
  const s = flag && flag.settlement;
  if (!s || !s.handle) return null;
  if (!s.revealedTo || s.revealedTo !== viewerProId) return null;
  return s.handle;
}

/** Both sides tick it off. Deliberately not proof — just a shared record. */
export function confirmSettlementPaid(flagId, side) {
  const flag = flagById(flagId);
  if (!flag || !flag.settlement) return null;
  flag.settlement[side === 'pro' ? 'proConfirmedAt' : 'sellerConfirmedAt'] = now();
  if (flag.settlement.proConfirmedAt && flag.settlement.sellerConfirmedAt) {
    flag.settlement.confirmedAt = now();
  }
  commit();
  return flag.settlement;
}

export const isPeerMethod = (method) =>
  !!SETTLEMENT_METHODS[method] && !SETTLEMENT_METHODS[method].safe;

/* ================================================================ reporting */
export const paymentFor = (flagId) => {
  const f = flagById(flagId);
  return f ? f.payment || null : null;
};

export function proEarnings(proId) {
  const acct = payoutAccount(proId);
  let pendingCents = 0, paidCents = 0, jobs = 0;
  state.flags.forEach(f => {
    const p = f.payment;
    if (!p || p.proId !== proId) return;
    if (p.status === 'authorized' || p.status === 'held') pendingCents += p.proReceivesCents;
    if (p.status === 'released') { paidCents += p.proReceivesCents; jobs++; }
  });
  return { acct, pendingCents, paidCents, jobs };
}

/* ================================================================ SERVER CONTRACT
 *
 * What has to exist before any of this touches real money. Everything below is
 * server-side; none of it can be done from the page.
 *
 *   POST /api/payments/setup-intent
 *        -> stripe.setupIntents.create({ customer })
 *        Client renders Stripe Elements with the returned client_secret. The card
 *        goes from the browser straight to Stripe. Flagd stores only the returned
 *        payment_method id and last4.
 *
 *   POST /api/payments/authorize   { flagId, bidId }
 *        -> stripe.paymentIntents.create({
 *             amount, currency:'usd', customer, payment_method,
 *             capture_method: 'manual',            // the escrow hold
 *             transfer_group: flagId,
 *             off_session: true, confirm: true })
 *        Server re-derives the amount from the accepted bid. NEVER trust an amount
 *        sent by the client.
 *
 *   POST /api/payments/release     { flagId }
 *        Authorisation required: the BUYER on that flag, or an admin. A pro must
 *        never be able to release their own escrow.
 *        -> stripe.paymentIntents.capture(intentId)
 *        -> stripe.transfers.create({ amount, destination: acct, transfer_group })
 *
 *   POST /api/payments/refund      { flagId, amount, reason }   admin/support only
 *   POST /api/connect/onboard      -> stripe.accountLinks.create(...)
 *
 *   POST /api/webhooks/stripe      the source of truth. Verify the signature with
 *        STRIPE_WEBHOOK_SECRET and treat these as authoritative:
 *          payment_intent.succeeded          -> mark held
 *          payment_intent.payment_failed     -> mark failed, tell the buyer
 *          payment_intent.amount_capturable_updated -> mark authorized
 *          charge.refunded                   -> mark refunded
 *          charge.dispute.created            -> freeze, open a support case
 *          transfer.paid / transfer.failed   -> settle the payout
 *          account.updated                   -> flip a pro to payouts-active
 *        Make every handler idempotent; Stripe retries and will deliver twice.
 *
 * Obligations that come with holding other people's money, worth knowing before
 * launch rather than after: chargeback liability sits with the platform, Connect
 * requires KYC on every pro before payout, refund policy has to be written and
 * shown, and in several US states holding funds between two parties raises money
 * transmitter questions. Stripe Connect's standard accounts push most of that onto
 * Stripe — take that route unless you have a reason not to.
 */
export const SERVER_CONTRACT = true;
