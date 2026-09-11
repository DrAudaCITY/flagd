// support-view.js — the help desk screens. Logic lives in support.js.

import {
  ISSUES, ACTIONS, issuesFor, openCase, caseById, casesFor, allCases, addCaseMessage,
  askAssistant, runAction, escalate, recordAccount, decide, slaText, isOverdue,
  biasReport, openCaseCount,
} from './support.js';
import { state, flagById } from './store.js';
import { proById } from './data.js';
import {
  esc, icon, toast, actions, backHead, badge, timeAgo, clockTime, val, emptyState, openModal, closeModal,
} from './ui.js';
import { go, back, render } from './router.js';

let thinking = null;          // caseId currently showing the typing indicator
let pendingChoices = null;    // choices the assistant last offered

/* ================================================================ entry */
export function renderSupport() {
  const side = state.mode === 'pro' ? 'pro' : 'buyer';
  const mine = casesFor(side);
  const open = mine.filter(c => c.status !== 'resolved' && c.status !== 'closed');

  return `<div class="view">
    ${backHead('Help and support', 'goBack', 'Most things get sorted here in a minute. Anything involving safety or money goes to a person.')}

    <label class="fl" for="supText">What is going on?</label>
    <textarea class="inp" id="supText" style="min-height:92px"
      placeholder="${esc(side === 'pro' ? 'e.g. Drove out and nobody was home' : 'e.g. The plumber never showed up this morning')}"></textarea>
    <button class="btn" style="margin-top:12px" data-act="supStart">Get help</button>

    ${open.length ? `<div class="sec">
      <div class="sec-t">Your open cases</div>
      ${open.map(caseRow).join('')}
    </div>` : ''}

    <div class="sec">
      <div class="sec-t">Common issues</div>
      <div class="cats">
        ${issuesFor(side).map(i => `
          <button class="cat" data-act="supIssue" data-issue="${esc(i.id)}">
            <span class="cat-ico">${i.severity === 'safety' ? '🛟' : i.severity === 'dispute' ? '⚖️' : '💬'}</span>
            <span class="cat-nm">${esc(i.label)}
              <span style="display:block;font-weight:400;font-size:12.5px;color:var(--ink-3);margin-top:2px">${esc(i.blurb)}</span>
            </span>
            <span class="cat-go">${icon('go')}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="sec">
      <div class="wash">
        <div class="sec-t" style="margin-bottom:8px">How we decide</div>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:var(--ink-2)">
          When both sides disagree, we do not take the word of whoever complained first — and
          not the word of whoever pays us either. Both accounts go on the record, then a person
          decides and tells you which rule they applied.
        </p>
        <p class="hint" style="margin:0">Pros pay for Flagd and customers do not. We publish how often decisions land on each side, so that imbalance stays visible.</p>
      </div>
    </div>

    ${mine.length > open.length ? `<div class="sec">
      <div class="sec-t">Closed</div>
      ${mine.filter(c => c.status === 'resolved' || c.status === 'closed').map(caseRow).join('')}
    </div>` : ''}

    <div class="sec">
      <button class="btn ghost" data-act="goAdmin">Open the admin queue (demo)</button>
    </div>
  </div>`;
}

function caseRow(c) {
  const issue = ISSUES[c.issue];
  const st = c.status === 'resolved' ? badge('done', 'Resolved')
    : c.status === 'escalated' ? badge('hired', 'With the team')
    : c.status === 'auto_resolved' ? badge('open', 'Sorted')
    : badge('new', 'In progress');
  return `<div class="card tap" data-act="supOpen" data-id="${esc(c.id)}">
    <div style="display:flex;gap:10px;align-items:flex-start">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--ink);font-size:14px">${esc(issue.label)}</div>
        <div class="pro-meta">${esc(c.ref)} · ${esc(timeAgo(c.createdAt))}${isOverdue(c) ? ' · overdue' : ''}</div>
      </div>
      ${st}
    </div>
  </div>`;
}

/* ================================================================ case thread */
export function renderCase(caseId) {
  const c = caseById(caseId);
  if (!c) return emptyState('🤷', 'Case not found', '', 'Back to help', 'goSupport');
  const issue = ISSUES[c.issue];
  const pro = c.proId ? proById(c.proId) : null;
  const flag = c.flagId ? flagById(c.flagId) : null;

  const canAuto = issue.auto.length && c.status === 'triage';

  return `<div class="view">
    ${backHead(issue.label, 'goSupport')}
    <div class="pro-meta" style="margin-top:8px">
      ${c.severity === 'safety' ? badge('new', 'Urgent') : badge('cat', issue.severity)}
      <span>${esc(c.ref)}</span>
      <span>Target reply: ${esc(slaText(c))}</span>
    </div>
    ${flag ? `<p class="sub">On: ${esc(flag.title)}${pro ? ` · ${esc(pro.name)}` : ''}</p>` : ''}

    <div class="sup-thread">
      ${c.messages.map(m => msgHtml(m)).join('')}
      ${thinking === c.id ? `<div class="typing"><i></i><i></i><i></i></div>` : ''}
    </div>

    ${pendingChoices && pendingChoices.caseId === c.id ? `
      <div class="chips" style="margin-top:12px">
        ${pendingChoices.choices.map(ch => `
          <button class="chip" data-act="supChoose" data-id="${esc(c.id)}" data-issue="${esc(ch.id)}">${esc(ch.label)}</button>`).join('')}
      </div>` : ''}

    ${canAuto ? `<div class="sec">
      <div class="sec-t">What I can do right now</div>
      ${issue.auto.map(a => `
        <button class="card tap" style="width:100%;text-align:left;display:block" data-act="supRun" data-id="${esc(c.id)}" data-action="${esc(a)}">
          <div style="font-weight:700;color:var(--ink);font-size:14px">${esc(ACTIONS[a].label)}</div>
          <div class="pro-meta">${esc(ACTIONS[a].describe)}</div>
        </button>`).join('')}
    </div>` : ''}

    ${c.decision ? `<div class="sec">
      <div class="sec-t">Decision</div>
      <div class="card hi">
        <div style="font-weight:700;color:var(--ink);font-size:15px">${esc(c.decision.outcome)}</div>
        <p class="sub" style="margin-top:6px">${esc(c.decision.rationale)}</p>
        <p class="hint">Rule applied: ${esc(c.decision.policy)}</p>
      </div>
    </div>` : ''}

    ${c.needsOtherSide ? `<div class="sec">
      <div class="waiting"><span class="pulse"></span> Waiting on the other party's account before any decision.</div>
    </div>` : ''}

    ${c.status !== 'resolved' ? `
      <div class="composer" style="border:0;padding:14px 0 0">
        <textarea id="supReply" rows="1" placeholder="Add anything else…" style="border:1px solid var(--line)"></textarea>
        <button class="send" data-act="supSend" data-id="${esc(c.id)}" aria-label="Send">${icon('send')}</button>
      </div>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn ghost" data-act="supEscalate" data-id="${esc(c.id)}">Talk to a person</button>
      </div>` : ''}
  </div>`;
}

function msgHtml(m) {
  if (m.from === 'system') return `<div class="msg sys">${esc(m.text)}</div>`;
  if (m.from === 'admin') return `<div class="sup-admin"><b>Support team</b>${esc(m.text)}</div>`;
  const mine = m.from === 'buyer' || m.from === 'pro';
  return `<div class="msg ${mine ? 'me' : 'them'}">${esc(m.text)}
    <div class="msg-t">${esc(clockTime(m.at))}</div></div>`;
}

/* ================================================================ admin queue */
export function renderAdmin() {
  const cases = allCases();
  const queue = cases.filter(c => c.status === 'escalated');
  const bias = biasReport();

  return `<div class="view">
    ${backHead('Admin queue', 'goSupport', 'Escalated cases, oldest first. A dispute cannot be decided until both sides are on record.')}

    <div class="kpis" style="margin-top:16px">
      <div class="kpi"><b>${queue.length}</b><span>escalated</span></div>
      <div class="kpi"><b>${bias.overdue}</b><span>overdue</span></div>
      <div class="kpi"><b>${bias.split === null ? '—' : bias.split + '%'}</b><span>decided for pro</span></div>
    </div>

    <div class="sec">
      <div class="wash">
        <div class="sec-t" style="margin-bottom:8px">Bias check</div>
        <p style="margin:0;font-size:14px;line-height:1.6;color:var(--ink-2)">${esc(bias.note)}</p>
        <div class="kv" style="margin-top:10px"><span>Decided for pro</span><b>${bias.favouredPro}</b></div>
        <div class="kv"><span>Decided for customer</span><b>${bias.favouredBuyer}</b></div>
        <div class="kv"><span>Auto-actions favouring the paying side</span><b>${bias.autoActionsFavouringPayingSide}</b></div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-t">Queue</div>
      ${queue.length ? queue
        .sort((a, b) => a.slaDueAt - b.slaDueAt)
        .map(c => {
          const issue = ISSUES[c.issue];
          const both = c.accounts.buyer && c.accounts.pro;
          return `<div class="card">
            <div style="display:flex;gap:10px;align-items:flex-start">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;color:var(--ink);font-size:14px">${esc(issue.label)}</div>
                <div class="pro-meta">${esc(c.ref)} · opened by ${esc(c.openedBy)} · ${esc(timeAgo(c.createdAt))}</div>
              </div>
              ${isOverdue(c) ? badge('new', 'Overdue') : badge('cat', slaText(c))}
            </div>
            <div class="kv" style="margin-top:10px"><span>Customer account</span><b>${c.accounts.buyer ? 'On record' : 'Not yet'}</b></div>
            <div class="kv"><span>Pro account</span><b>${c.accounts.pro ? 'On record' : 'Not yet'}</b></div>
            <div class="btn-row" style="margin-top:12px">
              <button class="btn ghost sm" style="flex:1" data-act="supOpen" data-id="${esc(c.id)}">Open</button>
              <button class="btn sm" style="flex:1" data-act="supDecide" data-id="${esc(c.id)}" ${c.severity === 'dispute' && !both ? 'disabled' : ''}>Decide</button>
            </div>
            ${c.severity === 'dispute' && !both
              ? `<p class="hint">Both accounts are required before this one can be decided.</p>` : ''}
          </div>`;
        }).join('')
        : emptyState('✅', 'Nothing escalated', 'Everything is either self-served or already resolved.', '', '')}
    </div>
  </div>`;
}

/* ================================================================ actions */
actions({
  goSupport: () => go('support'),
  goAdmin: () => go('admin'),
  supOpen: (el) => { pendingChoices = null; go('supportCase', { id: el.dataset.id }); },

  supStart: () => {
    const text = val('supText');
    if (!text) { toast('Tell me what happened first'); return; }
    const side = state.mode === 'pro' ? 'pro' : 'buyer';
    const ctx = latestContext(side);
    const c = openCase({ openedBy: side, issueId: 'other', flagId: ctx.flagId, proId: ctx.proId, text });
    go('supportCase', { id: c.id });
    runAssistant(c.id, text);
  },

  supIssue: (el) => {
    const side = state.mode === 'pro' ? 'pro' : 'buyer';
    const ctx = latestContext(side);
    const c = openCase({ openedBy: side, issueId: el.dataset.issue, flagId: ctx.flagId, proId: ctx.proId });
    pendingChoices = null;
    go('supportCase', { id: c.id });
    if (ISSUES[c.issue].severity !== 'safety') {
      setTimeout(() => {
        addCaseMessage(c.id, 'assistant', openingLine(ISSUES[c.issue]));
        render();
      }, 500);
    }
  },

  supChoose: (el) => {
    const c = caseById(el.dataset.id);
    if (!c) return;
    c.issue = el.dataset.issue;
    c.severity = ISSUES[c.issue].severity;
    pendingChoices = null;
    addCaseMessage(c.id, 'assistant', openingLine(ISSUES[c.issue]));
    if (c.severity === 'safety') escalate(c.id, 'safety');
    render();
  },

  supSend: (el) => {
    const box = document.getElementById('supReply');
    const text = (box ? box.value : '').trim();
    if (!text) return;
    const c = caseById(el.dataset.id);
    if (box) box.value = '';
    addCaseMessage(c.id, c.openedBy, text);
    // On an escalated dispute, the user's own words become their account of record.
    if (c.status === 'escalated' && c.severity === 'dispute') {
      recordAccount(c.id, c.openedBy, text);
    }
    render();
    runAssistant(c.id, text);
  },

  supRun: (el) => {
    const res = runAction(el.dataset.id, el.dataset.action);
    render();
    if (res) toast(res.ok ? 'Done' : res.text);
    if (res && !res.ok) escalate(el.dataset.id, 'unresolved');
  },

  supEscalate: (el) => {
    const c = caseById(el.dataset.id);
    escalate(c.id, c.severity === 'dispute' ? 'dispute' : 'requested');
    render();
    toast('Passed to the support team');
  },

  supDecide: (el) => {
    const c = caseById(el.dataset.id);
    if (!c) return;
    openModal(`
      <h3 style="margin-bottom:6px">Decide ${esc(c.ref)}</h3>
      <p class="sub" style="margin-bottom:2px">${esc(ISSUES[c.issue].label)}</p>
      <label class="fl" for="dOutcome">Outcome</label>
      <input class="inp" id="dOutcome" placeholder="e.g. Lead unlock refunded, no fault recorded" />
      <label class="fl" for="dPolicy">Rule applied</label>
      <input class="inp" id="dPolicy" placeholder="e.g. Lead quality policy 3.2" />
      <label class="fl" for="dWhy">Reasoning shown to both parties</label>
      <textarea class="inp" id="dWhy" placeholder="What you concluded and why."></textarea>
      <label class="fl" for="dFav">This decision favours</label>
      <select class="inp" id="dFav">
        <option value="neither">Neither — split or no fault</option>
        <option value="buyer">The customer</option>
        <option value="pro">The pro</option>
      </select>
      <p class="hint">Recorded for the bias report. Pros pay for Flagd; if decisions drift toward them, that needs to be visible.</p>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn" data-act="supConfirmDecide" data-id="${esc(c.id)}">Record decision</button>
      </div>`);
  },

  supConfirmDecide: (el) => {
    const outcome = val('dOutcome');
    if (!outcome) { toast('An outcome is required'); return; }
    const res = decide(el.dataset.id, {
      outcome,
      policy: val('dPolicy') || 'Unspecified',
      rationale: val('dWhy') || 'No reasoning recorded',
      favours: val('dFav') || 'neither',
    });
    if (!res.ok) { toast(res.why); return; }
    closeModal();
    render();
    toast('Decision recorded and shown to both parties');
  },
});

/* ================================================================ helpers */
/** Attach the most relevant booking so the assistant is not asking "which job?". */
function latestContext(side) {
  if (side === 'pro') {
    const id = (state.pro && state.pro.bidsSent || []).slice(-1)[0];
    return { flagId: id || null, proId: state.pro ? state.pro.profileId : null };
  }
  const f = state.flags.find(x => x.mine && x.hiredBidId) ||
            state.flags.find(x => x.mine);
  if (!f) return { flagId: null, proId: null };
  const bid = f.hiredBidId ? (state.bids.find(b => b.id === f.hiredBidId) || {}) : {};
  return { flagId: f.id, proId: bid.proId || null };
}

const openingLine = (issue) => {
  if (issue.severity === 'safety') {
    return 'This is with a person on our team now.';
  }
  if (issue.auto.length) {
    return `Understood. Here is what I can do right now without waiting for anyone.`;
  }
  return `Understood. This one needs a person — they decide, not me, because it affects money or a rating. ` +
         `Tell me what happened in your own words and I will put it on the record.`;
};

/** Runs the assistant with a short delay so it reads as a conversation. */
function runAssistant(caseId, text) {
  thinking = caseId;
  render();
  setTimeout(async () => {
    const c = caseById(caseId);
    thinking = null;
    if (!c) { render(); return; }

    const out = await askAssistant(c, text);

    if (out.choices) {
      pendingChoices = { caseId, choices: out.choices };
      addCaseMessage(caseId, 'assistant', out.reply);
      render();
      return;
    }

    if (out.issue) {
      c.issue = out.issue.id;
      c.severity = out.issue.severity;
      c.slaDueAt = c.createdAt + out.issue.sla * 60000;
      addCaseMessage(caseId, 'assistant', openingLine(out.issue));
      if (out.issue.severity === 'safety') escalate(caseId, 'safety');
      else if (!out.issue.auto.length) escalate(caseId, out.issue.severity === 'dispute' ? 'dispute' : 'unresolved');
    }
    render();
  }, 900);
}

export const supportBadgeCount = () => openCaseCount(state.mode === 'pro' ? 'pro' : 'buyer');
