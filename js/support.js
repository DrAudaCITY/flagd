// support.js — the help desk: triage, self-resolution, and escalation to a human.
//
// Three principles, in priority order. They conflict sometimes; this order is how
// the conflict gets settled.
//
//   1. SAFETY IS NEVER TRIAGED. Anyone reporting a threat, an injury, theft or
//      harassment goes straight to a human. Nobody in that situation should have to
//      argue with an assistant first.
//
//   2. AUTOMATE ONLY THE REVERSIBLE. Refunding a lead credit, reopening a flag,
//      nudging the other party — cheap, undoable, safe to get wrong. Money disputes,
//      quality disputes and anything where the two parties disagree about facts are
//      NOT auto-resolved, ever.
//
//   3. TWO-SIDED CASES NEED TWO SIDES. "Fair to both" is not a feeling. Before any
//      decision that costs someone money, both accounts are on the record and the
//      decision cites the policy it applied.
//
// A note on the structural bias in this marketplace: pros pay, buyers do not. That
// creates constant quiet pressure to decide for the pro. Every resolution that
// favours the paying side is tagged `favoursPayingSide` so the bias is measurable
// instead of invisible. See biasReport().

import { state, commit, uid, now, flagById, bidsFor, pushMsg } from './store.js';
import { proById } from './data.js';

/* ================================================================ issue catalog */
export const AUDIENCE = { buyer: 'buyer', pro: 'pro', both: 'both' };

/**
 * severity:  'safety' -> straight to a human, no triage
 *            'dispute' -> two-sided, human decides
 *            'standard' -> assistant may resolve
 * auto:      resolution actions the assistant is allowed to take unaided
 */
export const ISSUES = {
  safety: {
    id: 'safety', who: 'both', severity: 'safety',
    label: 'Safety, harassment or something serious',
    blurb: 'Threats, injury, theft, damage, discrimination, or anything that felt unsafe.',
    auto: [], escalate: true, sla: 15,
  },
  fraud: {
    id: 'fraud', who: 'both', severity: 'safety',
    label: 'Fraud or a scam',
    blurb: 'Someone tried to take payment off-platform, impersonated a business, or the listing was fake.',
    auto: [], escalate: true, sla: 60,
  },

  no_show: {
    id: 'no_show', who: 'buyer', severity: 'dispute',
    label: 'The pro did not show up',
    blurb: 'Booked, but nobody arrived.',
    auto: ['nudge_pro', 'reopen_flag'], escalate: false, sla: 120,
  },
  late: {
    id: 'late', who: 'buyer', severity: 'standard',
    label: 'The pro is running late',
    blurb: 'Still coming, but not when they said.',
    auto: ['nudge_pro', 'resend_tracking'], escalate: false, sla: 120,
  },
  quality: {
    id: 'quality', who: 'buyer', severity: 'dispute',
    label: 'The work was not done properly',
    blurb: 'Finished, but badly, incompletely, or not what was agreed.',
    auto: [], escalate: true, sla: 1440,
  },
  price_changed: {
    id: 'price_changed', who: 'buyer', severity: 'dispute',
    label: 'I was charged more than the quote',
    blurb: 'The final price did not match what was agreed in the app.',
    auto: [], escalate: true, sla: 1440,
  },
  unreachable: {
    id: 'unreachable', who: 'both', severity: 'standard',
    label: 'I cannot reach the other party',
    blurb: 'Messages are not being answered.',
    auto: ['nudge_other', 'resend_tracking'], escalate: false, sla: 240,
  },
  cancel: {
    id: 'cancel', who: 'buyer', severity: 'standard',
    label: 'I need to cancel',
    blurb: 'Change of plans after hiring.',
    auto: ['cancel_booking', 'reopen_flag'], escalate: false, sla: 240,
  },
  off_platform: {
    id: 'off_platform', who: 'both', severity: 'dispute',
    label: 'They asked to deal outside the app',
    blurb: 'Cash on the side, or moving the job off Flagd.',
    auto: [], escalate: true, sla: 480,
  },
  no_responses: {
    id: 'no_responses', who: 'buyer', severity: 'standard',
    label: 'My flag is not getting responses',
    blurb: 'Posted a while ago and nothing has come in.',
    auto: ['widen_flag', 'reopen_flag'], escalate: false, sla: 480,
  },

  bad_lead: {
    id: 'bad_lead', who: 'pro', severity: 'standard',
    label: 'This lead was junk',
    blurb: 'Fake, duplicate, out of area, or the customer never intended to hire.',
    auto: ['refund_credit'], escalate: false, sla: 240,
  },
  buyer_no_show: {
    id: 'buyer_no_show', who: 'pro', severity: 'dispute',
    label: 'The customer was not there',
    blurb: 'Drove out and nobody was home.',
    auto: ['nudge_other'], escalate: true, sla: 480,
  },
  unfair_review: {
    id: 'unfair_review', who: 'pro', severity: 'dispute',
    label: 'I received an unfair review',
    blurb: 'A rating that misrepresents what happened.',
    auto: [], escalate: true, sla: 1440,
  },
  billing: {
    id: 'billing', who: 'pro', severity: 'standard',
    label: 'Billing or subscription',
    blurb: 'Charges, plan changes, unlock allowance.',
    auto: ['explain_billing'], escalate: false, sla: 480,
  },

  other: {
    id: 'other', who: 'both', severity: 'standard',
    label: 'Something else',
    blurb: 'Describe it and we will route it.',
    auto: [], escalate: false, sla: 480,
  },
};

export const issuesFor = (side) =>
  Object.values(ISSUES).filter(i => i.who === side || i.who === 'both');

/* ================================================================ triage
 * Deterministic intent classification. This is the seam where a real model goes —
 * see askAssistant() below for the contract.
 */
const SIGNALS = {
  safety: ['unsafe', 'threat', 'threaten', 'assault', 'hurt', 'injur', 'harass', 'abusive',
           'racist', 'discriminat', 'stole', 'stolen', 'theft', 'damage to my', 'police', 'weapon', 'scared'],
  fraud: ['scam', 'fraud', 'fake', 'impersonat', 'phish', 'wire', 'gift card', 'venmo', 'zelle', 'cash app'],
  off_platform: ['off the app', 'outside the app', 'off platform', 'cash deal', 'pay him direct',
                 'pay her direct', 'text me instead', 'do it privately'],
  no_show: ['no show', 'never showed', 'did not show', 'didnt show', 'nobody came', 'never came', 'never arrived'],
  late: ['late', 'running behind', 'still waiting', 'hours late', 'delayed'],
  quality: ['bad job', 'botched', 'poor work', 'not finished', 'incomplete', 'leaking again',
            'broke', 'worse than', 'shoddy', 'not what we agreed', 'redo'],
  price_changed: ['charged more', 'more than the quote', 'price went up', 'extra charge',
                  'overcharged', 'bill was higher', 'surprise fee'],
  unreachable: ['not answering', 'no reply', 'cannot reach', 'cant reach', 'ghosted', 'ignoring', 'unresponsive'],
  cancel: ['cancel', 'call it off', 'no longer need', 'changed my mind'],
  no_responses: ['no bids', 'no responses', 'no quotes', 'nobody bid', 'no one responded', 'still nothing'],
  bad_lead: ['junk lead', 'fake lead', 'wasted my unlock', 'refund my credit', 'duplicate lead',
             'out of my area', 'tire kicker', 'not a real job'],
  buyer_no_show: ['nobody was home', 'no one was home', 'customer was not there', 'wasted trip', 'drove out'],
  unfair_review: ['unfair review', 'bad review', 'wrong rating', 'one star', 'remove the review', 'false review'],
  billing: ['billing', 'charged me', 'subscription', 'invoice', 'refund my plan', 'upgrade', 'downgrade'],
};

/** Returns { issue, confidence, alternatives }. */
export function classify(text, side) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return { issue: null, confidence: 0, alternatives: [] };

  const scores = {};
  Object.keys(SIGNALS).forEach(key => {
    const hits = SIGNALS[key].filter(s => t.includes(s)).length;
    if (hits) scores[key] = hits;
  });

  // Safety always wins, regardless of how many other signals fired.
  if (scores.safety) return { issue: ISSUES.safety, confidence: 1, alternatives: [] };
  if (scores.fraud) return { issue: ISSUES.fraud, confidence: 1, alternatives: [] };

  const ranked = Object.keys(scores)
    .filter(k => {
      const i = ISSUES[k];
      return i && (!side || i.who === side || i.who === 'both');
    })
    .sort((a, b) => scores[b] - scores[a]);

  if (!ranked.length) return { issue: null, confidence: 0, alternatives: [] };

  const top = scores[ranked[0]];
  const second = ranked[1] ? scores[ranked[1]] : 0;
  const confidence = top >= 2 && top > second ? 0.9 : top > second ? 0.65 : 0.4;

  return {
    issue: ISSUES[ranked[0]],
    confidence,
    alternatives: ranked.slice(1, 3).map(k => ISSUES[k]),
  };
}

/**
 * THE MODEL SEAM.
 *
 * Today this runs the deterministic classifier above and a scripted playbook. It is
 * the one function a real build replaces:
 *
 *   const r = await fetch('/api/support/assist', { method:'POST',
 *     body: JSON.stringify({ caseId, history, context }) });
 *
 * The call MUST go through your own server. Putting a model API key in this page
 * would publish it to every visitor — unlike the Maps key, an LLM key cannot be
 * restricted by referrer, so anyone could drain the account. The server is also
 * where the policy prompt, the tool allow-list and the escalation rules belong, so
 * a user cannot talk the assistant out of them.
 */
export async function askAssistant(caseObj, text) {
  const side = caseObj.openedBy;
  const t = classify(text, side);

  if (!t.issue) {
    return {
      reply: 'I want to route this correctly rather than guess. Which of these is closest?',
      choices: issuesFor(side).slice(0, 6).map(i => ({ id: i.id, label: i.label })),
    };
  }

  if (t.confidence < 0.65 && t.alternatives.length) {
    return {
      reply: `This sounds like "${t.issue.label}" — is that right?`,
      choices: [t.issue].concat(t.alternatives).map(i => ({ id: i.id, label: i.label })),
    };
  }

  return { reply: null, issue: t.issue, confidence: t.confidence };
}

/* ================================================================ case model */
export function openCase({ openedBy, issueId, flagId, proId, text }) {
  const issue = ISSUES[issueId] || ISSUES.other;
  const c = {
    id: uid('case'),
    ref: 'FLG-' + String(Math.abs(hash(uid('r'))) % 900000 + 100000),
    openedBy,
    issue: issue.id,
    severity: issue.severity,
    flagId: flagId || null,
    proId: proId || null,
    status: issue.severity === 'safety' ? 'escalated' : 'triage',
    createdAt: now(),
    slaDueAt: now() + issue.sla * 60000,
    messages: [],
    actions: [],
    accounts: { buyer: null, pro: null },     // both sides, before any decision
    decision: null,
  };
  if (text) c.messages.push({ from: openedBy, text, at: now() });
  if (issue.severity === 'safety') {
    c.messages.push({
      from: 'system', at: now(),
      text: 'This has gone straight to a person on our team. You will not be asked to explain it to an assistant.',
    });
  }
  state.cases = state.cases || [];
  state.cases.unshift(c);
  commit();
  return c;
}

export const casesFor = (side) => (state.cases || []).filter(c => c.openedBy === side);
export const allCases = () => state.cases || [];
export const caseById = (id) => (state.cases || []).find(c => c.id === id);
export const openCaseCount = (side) =>
  casesFor(side).filter(c => c.status !== 'resolved' && c.status !== 'closed').length;

export function addCaseMessage(caseId, from, text) {
  const c = caseById(caseId);
  if (!c) return null;
  c.messages.push({ from, text, at: now() });
  commit();
  return c;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0;
  return h;
}

/* ================================================================ resolutions
 * Each action states plainly whether it favours the side that pays us.
 */
export const ACTIONS = {
  nudge_pro: {
    label: 'Message the pro for you',
    describe: 'Send an urgent note asking them to confirm timing.',
    favoursPayingSide: false,
    run: (c) => {
      if (!c.flagId || !c.proId) return 'No booking attached.';
      pushMsg(c.flagId, c.proId, {
        from: 'sys',
        text: 'Flagd support: the customer is asking for an update on arrival. Please reply.',
      });
      return 'Sent an urgent request to the pro. They usually reply within the hour.';
    },
  },
  nudge_other: {
    label: 'Nudge the other party',
    describe: 'Send a support-flagged message into the thread.',
    favoursPayingSide: false,
    run: (c) => {
      if (!c.flagId || !c.proId) return 'No conversation attached.';
      pushMsg(c.flagId, c.proId, { from: 'sys', text: 'Flagd support: the other party is waiting on a reply.' });
      return 'Nudged them in the thread.';
    },
  },
  resend_tracking: {
    label: 'Resend the tracking link',
    describe: 'Text the arrival link and technician details again.',
    favoursPayingSide: false,
    run: (c) => {
      const f = c.flagId ? flagById(c.flagId) : null;
      if (!f || !f.tracking) return 'No active trip to track.';
      return 'Resent the tracking link to your phone.';
    },
  },
  reopen_flag: {
    label: 'Reopen your flag',
    describe: 'Put it back in front of pros without re-entering anything.',
    favoursPayingSide: false,
    run: (c) => {
      const f = c.flagId ? flagById(c.flagId) : null;
      if (!f) return 'No flag attached.';
      f.status = 'open';
      delete f.hiredBidId;
      commit();
      return 'Reopened. Pros in range can bid again.';
    },
  },
  cancel_booking: {
    label: 'Cancel the booking',
    describe: 'Release the pro and reopen the flag.',
    favoursPayingSide: false,
    run: (c) => {
      const f = c.flagId ? flagById(c.flagId) : null;
      if (!f) return 'No booking attached.';
      f.status = 'open';
      delete f.hiredBidId;
      if (c.proId) {
        pushMsg(f.id, c.proId, { from: 'sys', text: 'Flagd support: the customer cancelled this booking.' });
      }
      commit();
      return 'Cancelled and the pro has been told. No penalty applied to either side.';
    },
  },
  widen_flag: {
    label: 'Widen the reach',
    describe: 'Show the flag to pros in a larger radius.',
    favoursPayingSide: false,
    run: (c) => {
      const f = c.flagId ? flagById(c.flagId) : null;
      if (!f) return 'No flag attached.';
      f.widened = true;
      commit();
      return 'Widened the radius and bumped it back to the top of pro feeds.';
    },
  },
  refund_credit: {
    label: 'Refund the lead unlock',
    describe: 'Return the credit spent on this lead.',
    // Honest label: this one does favour the paying side.
    favoursPayingSide: true,
    run: (c) => {
      if (!c.proId) return 'No lead attached.';
      state.pro.leadsUsed = Math.max(0, (state.pro.leadsUsed || 0) - 1);
      commit();
      return 'Refunded the unlock. It is back in your monthly allowance.';
    },
  },
  explain_billing: {
    label: 'Explain the charge',
    describe: 'Break down the current plan and allowance.',
    favoursPayingSide: false,
    run: () => {
      const plan = state.pro && state.pro.plan ? state.pro.plan : 'starter';
      return `You are on the ${plan} plan. Unlocks reset on the first of each month, ` +
             `earned credits are spent before your allowance, and nothing is charged per job.`;
    },
  },
};

/** Run an auto-resolution. Refuses anything outside the issue's allow-list. */
export function runAction(caseId, actionId) {
  const c = caseById(caseId);
  const action = ACTIONS[actionId];
  if (!c || !action) return null;

  const issue = ISSUES[c.issue];
  if (!issue.auto.includes(actionId)) {
    return { ok: false, text: 'That needs a person to decide. Escalating instead.' };
  }

  const result = action.run(c);
  c.actions.push({
    id: uid('act'), actionId, label: action.label, result,
    favoursPayingSide: action.favoursPayingSide, at: now(),
  });
  c.status = 'auto_resolved';
  c.messages.push({ from: 'assistant', text: result, at: now() });
  commit();
  return { ok: true, text: result };
}

/* ================================================================ escalation */
export const ESCALATION_REASONS = {
  safety: 'Safety or conduct — always handled by a person',
  dispute: 'The two sides disagree about what happened',
  money: 'Money moves, or someone loses money',
  requested: 'The user asked for a human',
  unresolved: 'The assistant could not resolve it',
};

export function escalate(caseId, reason, note) {
  const c = caseById(caseId);
  if (!c) return null;
  c.status = 'escalated';
  c.escalation = { reason, note: note || '', at: now() };
  c.messages.push({
    from: 'system', at: now(),
    text: `Passed to the support team. Reference ${c.ref}. ` +
          (c.severity === 'safety' ? 'Marked urgent.' : `Target response: ${slaText(c)}.`),
  });
  // A two-sided case cannot be decided until both accounts are recorded.
  if (c.severity === 'dispute' && c.proId && c.flagId) {
    c.needsOtherSide = true;
    c.messages.push({
      from: 'system', at: now(),
      text: 'The other party will be asked for their account before any decision. ' +
            'You will see what they said.',
    });
  }
  commit();
  return c;
}

export function recordAccount(caseId, side, text) {
  const c = caseById(caseId);
  if (!c) return null;
  c.accounts[side] = { text, at: now() };
  if (c.accounts.buyer && c.accounts.pro) c.needsOtherSide = false;
  commit();
  return c;
}

/** An admin decision. Requires both accounts on a two-sided case. */
export function decide(caseId, { outcome, rationale, policy, favours }) {
  const c = caseById(caseId);
  if (!c) return { ok: false, why: 'Case not found' };
  if (c.severity === 'dispute' && (!c.accounts.buyer || !c.accounts.pro)) {
    return { ok: false, why: 'Both sides must be on record before deciding a dispute.' };
  }
  c.decision = { outcome, rationale, policy, favours, at: now() };
  c.status = 'resolved';
  c.messages.push({ from: 'admin', text: `${outcome} — ${rationale}`, at: now() });
  commit();
  return { ok: true };
}

export const slaText = (c) => {
  const mins = ISSUES[c.issue].sla;
  if (mins <= 60) return `${mins} minutes`;
  if (mins < 1440) return `${Math.round(mins / 60)} hours`;
  return `${Math.round(mins / 1440)} business day${mins >= 2880 ? 's' : ''}`;
};

export const isOverdue = (c) =>
  c.status !== 'resolved' && c.status !== 'closed' && now() > c.slaDueAt;

/* ================================================================ bias report
 * The number nobody wants to look at, which is exactly why it is here. If
 * resolutions systematically favour the side that pays, buyers will feel it long
 * before this dashboard admits it.
 */
export function biasReport() {
  const cases = allCases();
  const decided = cases.filter(c => c.decision);
  const favouredPro = decided.filter(c => c.decision.favours === 'pro').length;
  const favouredBuyer = decided.filter(c => c.decision.favours === 'buyer').length;
  const autoFavouring = cases.reduce(
    (n, c) => n + c.actions.filter(a => a.favoursPayingSide).length, 0);

  return {
    decided: decided.length,
    favouredPro,
    favouredBuyer,
    split: decided.length ? Math.round((favouredPro / decided.length) * 100) : null,
    autoActionsFavouringPayingSide: autoFavouring,
    escalated: cases.filter(c => c.status === 'escalated').length,
    overdue: cases.filter(isOverdue).length,
    note: 'Pros pay and buyers do not. If the split drifts toward pros over time, ' +
          'assume the policy is bending toward revenue and audit it.',
  };
}
