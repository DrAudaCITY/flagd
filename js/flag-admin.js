// flag-admin.js — managing a flag after it exists: pause, edit, close, repost,
// delete, and report someone else's.
//
// The rule that shapes all of it: a flag is not just a post, it is something pros
// have spent real money to open. So closing one asks WHY (that answer is the
// difference between "closed successfully" and "wasted everyone's time" in the
// funnel), deleting one that has bids is a heavier action than deleting an empty
// one, and neither is possible while money is being held.

import { state, commit, now, flagById, bidsFor, removeFlag, pushMsg } from './store.js';
import { paymentFor, refundPayment, money as cents } from './payments.js';
import { openCase } from './support.js';
import { onAbandoned } from './rewards.js';

/* ================================================================ lifecycle */
export const FLAG_STATES = {
  open:   { label: 'Taking bids', tone: 'open' },
  paused: { label: 'Paused', tone: 'done', blurb: 'Hidden from pros. No new bids.' },
  hired:  { label: 'Hired', tone: 'hired' },
  done:   { label: 'Completed', tone: 'done' },
  closed: { label: 'Closed', tone: 'done' },
};

/** Why a flag was closed. This is the honest outcome data the funnel needs. */
export const CLOSE_REASONS = {
  hired_here:     { id: 'hired_here', label: 'I hired someone through Flagd', outcome: 'success' },
  hired_elsewhere:{ id: 'hired_elsewhere', label: 'I hired someone else, not through Flagd', outcome: 'lost' },
  did_myself:     { id: 'did_myself', label: 'I sorted it myself', outcome: 'lost' },
  no_longer:      { id: 'no_longer', label: 'I no longer need it', outcome: 'lost' },
  too_expensive:  { id: 'too_expensive', label: 'The quotes were too expensive', outcome: 'lost' },
  no_responses:   { id: 'no_responses', label: 'Nobody responded', outcome: 'failed' },
  wrong_post:     { id: 'wrong_post', label: 'I posted it by mistake', outcome: 'failed' },
};

/* ================================================================ guards
 * Anything that would strand money or silently burn a pro's paid unlock has to be
 * refused with a reason, not quietly allowed.
 */
export function canDelete(flag) {
  const pay = paymentFor(flag.id);
  if (pay && (pay.status === 'authorized' || pay.status === 'held')) {
    return { ok: false, why: 'Money is being held on this job. Cancel the booking first and the hold is released.' };
  }
  if (pay && pay.status === 'disputed') {
    return { ok: false, why: 'This job is part of an open dispute and cannot be removed.' };
  }
  if (flag.status === 'hired') {
    return { ok: false, why: 'You have hired someone. Cancel the booking before deleting.' };
  }
  return { ok: true, heavy: bidsFor(flag.id).length > 0 };
}

export function canEdit(flag) {
  if (flag.status === 'hired' || flag.status === 'done') {
    return { ok: false, why: 'The job is already agreed — message the pro instead of changing the flag.' };
  }
  return { ok: true, warnBidders: bidsFor(flag.id).length > 0 };
}

/* ================================================================ actions */
export function pauseFlag(flagId, paused) {
  const f = flagById(flagId);
  if (!f) return null;
  f.status = paused ? 'paused' : 'open';
  f.pausedAt = paused ? now() : null;
  commit();
  return f;
}

export function editFlag(flagId, patch) {
  const f = flagById(flagId);
  if (!f) return null;
  const changed = Object.keys(patch).filter(k => patch[k] !== f[k] && patch[k] !== undefined);
  Object.assign(f, patch);
  f.editedAt = now();
  f.edits = (f.edits || 0) + 1;

  // Anyone who already priced this deserves to know the brief moved.
  if (changed.length) {
    bidsFor(flagId).forEach(b => {
      pushMsg(flagId, b.proId, {
        from: 'sys',
        text: `The customer updated this request (${changed.join(', ')}). Revise your quote if it no longer fits.`,
      });
    });
  }
  commit();
  return { flag: f, notified: bidsFor(flagId).length, changed };
}

export function closeFlag(flagId, reasonId, note) {
  const f = flagById(flagId);
  const reason = CLOSE_REASONS[reasonId];
  if (!f || !reason) return null;

  f.status = 'closed';
  f.closedAt = now();
  f.closeReason = reasonId;
  f.closeOutcome = reason.outcome;
  f.closeNote = note || '';

  const bids = bidsFor(flagId);
  if (bids.length) {
    bids.forEach(b => {
      pushMsg(flagId, b.proId, {
        from: 'sys',
        text: `The customer closed this request — ${reason.label.toLowerCase()}. No further action needed.`,
      });
    });
    // Pros paid to open this and got nothing. It counts against buyer standing.
    if (reason.outcome !== 'success') onAbandoned(flagId);
  }
  commit();
  return { flag: f, notified: bids.length };
}

export function repostFlag(flagId) {
  const f = flagById(flagId);
  if (!f) return null;
  const copy = Object.assign({}, f, {
    id: 'f_' + Math.random().toString(36).slice(2, 9),
    status: 'open',
    createdAt: now(),
    bidCount: 0,
  });
  ['hiredBidId', 'hiredAt', 'doneAt', 'rated', 'tracking', 'sms', 'payment',
   'settlement', 'closedAt', 'closeReason', 'closeOutcome', 'closeNote', 'editedAt', 'edits']
    .forEach(k => delete copy[k]);
  state.flags.unshift(copy);
  commit();
  return copy;
}

export async function deleteFlag(flagId) {
  const f = flagById(flagId);
  if (!f) return { ok: false, why: 'Not found' };
  const guard = canDelete(f);
  if (!guard.ok) return guard;

  // A flag with bids is being deleted, not closed — tell the pros why.
  bidsFor(flagId).forEach(b => {
    pushMsg(flagId, b.proId, { from: 'sys', text: 'The customer removed this request.' });
  });
  if (bidsFor(flagId).length) onAbandoned(flagId);

  removeFlag(flagId);
  return { ok: true };
}

/** Cancel a booking and release the money before anything else happens. */
export async function cancelBooking(flagId, reason) {
  const f = flagById(flagId);
  if (!f) return { ok: false, why: 'Not found' };
  const pay = paymentFor(flagId);

  if (pay && (pay.status === 'authorized' || pay.status === 'held')) {
    const r = await refundPayment(flagId, { reason: reason || 'Booking cancelled' });
    if (!r.ok) return { ok: false, why: 'Could not release the hold: ' + r.why };
  }

  const hired = f.hiredBidId ? bidsFor(flagId).find(b => b.id === f.hiredBidId) : null;
  if (hired) {
    pushMsg(flagId, hired.proId, {
      from: 'sys',
      text: 'The customer cancelled this booking. Any hold on their card has been released.',
    });
  }
  f.status = 'open';
  delete f.hiredBidId;
  delete f.tracking;
  commit();
  return { ok: true, refunded: !!pay };
}

/* ================================================================ reporting
 * Reporting someone ELSE's flag. Goes into the same case system as support so
 * there is one queue, one SLA and one audit trail.
 */
export const REPORT_REASONS = {
  spam:        { id: 'spam', label: 'Spam or duplicate', severity: 'standard' },
  scam:        { id: 'scam', label: 'Looks like a scam', severity: 'safety' },
  offensive:   { id: 'offensive', label: 'Offensive or abusive content', severity: 'safety' },
  wrong_cat:   { id: 'wrong_cat', label: 'Wrong category', severity: 'standard' },
  not_real:    { id: 'not_real', label: 'Not a real request', severity: 'standard' },
  prohibited:  { id: 'prohibited', label: 'Prohibited item or service', severity: 'safety' },
  personal:    { id: 'personal', label: 'Contains someone’s personal information', severity: 'safety' },
};

export function reportFlag(flagId, reasonId, note) {
  const f = flagById(flagId);
  const reason = REPORT_REASONS[reasonId];
  if (!f || !reason) return null;

  f.reports = f.reports || [];
  // One report per reporter, so a single angry user cannot bury a listing.
  const side = state.mode === 'pro' ? 'pro' : 'buyer';
  const already = f.reports.some(r => r.by === side);
  if (!already) {
    f.reports.push({ by: side, reason: reasonId, note: note || '', at: now() });
  }

  // Enough independent reports, or anything safety-flavoured, hides it pending review.
  if (reason.severity === 'safety' || f.reports.length >= 3) {
    f.underReview = true;
  }
  commit();

  const c = openCase({
    openedBy: side,
    issueId: reason.severity === 'safety' ? 'safety' : 'other',
    flagId,
    text: `Reported a flag — ${reason.label}${note ? `: ${note}` : ''}`,
  });
  return { flag: f, case: c, hidden: !!f.underReview };
}

export const isHidden = (flag) => !!flag.underReview;

/** Flags hidden from pro feeds: paused, closed, or under review. */
export const isVisibleToPros = (flag) =>
  flag.status === 'open' && !flag.underReview;
