// chat.js — the inbox and the message thread, including in-chat price negotiation.
// The other side is simulated: a small stage machine picks a plausible reply.

import { cat, proById, PRO_LINES, SELLER_LINES } from './data.js';
import {
  state, threadsList, getThread, pushMsg, markRead, flagById, bidsFor, proRating,
} from './store.js';
import {
  esc, money, avatar, stars, ratingLine, icon, timeAgo, clockTime, toast,
  actions, openModal, closeModal, val, emptyState, VERIF_SVG,
} from './ui.js';
import { go, back, render } from './router.js';
import { acceptBid } from './deals.js';

let typingIn = null;   // threadId currently showing the "…" bubble

const linesFor = (catKey) => (cat(catKey).kind === 'item' ? SELLER_LINES : PRO_LINES);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------------------------------------------------------------- inbox */
export function renderInbox() {
  const rows = threadsList();

  if (!rows.length) {
    return `<div class="view">
      <div class="view-head"><h2>Messages</h2></div>
      <p class="sub">Every bid opens a conversation. Plant a flag and the pros will start the chat.</p>
    </div>` + emptyState('💬', 'No messages yet', 'When a pro or seller bids on one of your flags, their message lands here.', 'Plant a flag', 'startFlag');
  }

  const list = rows.map(t => {
    const pro = proById(t.proId);
    const flag = flagById(t.flagId);
    if (!pro || !flag) return '';
    const last = t.msgs[t.msgs.length - 1];
    const c = cat(flag.cat);
    const preview = last
      ? (last.offer ? `${last.from === 'me' ? 'You offered' : 'Offer'} ${money(last.offer.price)}` : last.text)
      : 'No messages yet';
    return `<div class="inbox-row ${t.unread ? 'unread' : ''}" data-act="openThread" data-flag="${esc(t.flagId)}" data-pro="${esc(t.proId)}">
      ${avatar(pro.name)}
      <div class="ib-main">
        <div class="ib-top">
          <span class="ib-nm">${esc(pro.name)}</span>
          <span class="ib-t">${esc(timeAgo(t.updatedAt))}</span>
        </div>
        <div class="ib-sub">${esc(c.icon + ' ' + flag.title)}</div>
        <div class="ib-prev">${esc(preview)}</div>
      </div>
      ${t.unread ? '<span class="ib-dot"></span>' : ''}
    </div>`;
  }).join('');

  return `<div class="view" style="padding-bottom:8px">
      <div class="view-head"><h2>Messages</h2></div>
      <p class="sub">${rows.length} conversation${rows.length === 1 ? '' : 's'}</p>
    </div>${list}`;
}

/* ---------------------------------------------------------------- thread */
export function renderThread(flagId, proId) {
  const pro = proById(proId);
  const flag = flagById(flagId);
  if (!pro || !flag) return emptyState('🤷', 'Conversation not found', 'It may have been removed.', 'Back to messages', 'goInbox');

  const t = getThread(flagId, proId);
  markRead(flagId, proId);
  const c = cat(flag.cat);
  const r = proRating(proId);
  const bid = bidsFor(flagId).find(b => b.proId === proId);
  const hired = flag.hiredBidId && bid && flag.hiredBidId === bid.id;

  const msgs = t.msgs.map(m => msgHtml(m, flag, pro)).join('') +
    (typingIn === t.id ? `<div class="typing"><i></i><i></i><i></i></div>` : '');

  return `<div class="thread">
    <div class="thread-head">
      <button class="back" data-act="goInbox" aria-label="Back">${icon('back')}</button>
      ${avatar(pro.name)}
      <div style="flex:1;min-width:0">
        <div class="pro-nm">${esc(pro.name)}${pro.verified ? VERIF_SVG : ''}</div>
        <div class="pro-meta">${ratingLine(r.rating, r.reviews)}</div>
      </div>
      <button class="btn ghost sm" data-act="openPro" data-pro="${esc(proId)}">Profile</button>
    </div>

    <div class="thread-msgs" data-autoscroll>
      <div class="msg sys">${esc(c.icon + ' ' + flag.title)}<br>${esc(flag.address || '')}</div>
      ${msgs}
    </div>

    ${bid && !hired && flag.status === 'open' ? `
      <div style="display:flex;gap:8px;padding:10px 12px 0">
        <button class="btn ghost sm" style="flex:1" data-act="offerModal" data-flag="${esc(flagId)}" data-pro="${esc(proId)}">Counter ${money(bid.price)}</button>
        <button class="btn brand sm" style="flex:1" data-act="confirmHire" data-bid="${esc(bid.id)}" data-flag="${esc(flagId)}">Hire · ${money(bid.price)}</button>
      </div>` : ''}
    ${hired ? `<div style="padding:10px 12px 0"><div class="waiting" style="background:#e8f6ee;color:#0d7a3d"><b>Hired</b> — ${money(bid.price)} agreed</div></div>` : ''}

    <div class="composer">
      <button class="attach" data-act="offerModal" data-flag="${esc(flagId)}" data-pro="${esc(proId)}" title="Send a price">$</button>
      <textarea id="composerBox" rows="1" placeholder="Write a message…" data-enter-send></textarea>
      <button class="send" data-act="sendMsg" data-flag="${esc(flagId)}" data-pro="${esc(proId)}" aria-label="Send">${icon('send')}</button>
    </div>
  </div>`;
}

function msgHtml(m, flag, pro) {
  if (m.from === 'sys') {
    return `<div class="msg sys">${esc(m.text)}</div>`;
  }
  if (m.offer) {
    const mine = m.from === 'me';
    const st = m.offer.state;
    return `<div class="msg offer">
      <div class="o-h">${mine ? 'Your offer' : pro.name + "'s price"}${st === 'accepted' ? ' · accepted' : st === 'rejected' ? ' · declined' : ''}</div>
      <div class="o-p">${money(m.offer.price)}</div>
      ${m.text ? `<div style="margin-top:7px;font-size:13px;line-height:1.5">${esc(m.text)}</div>` : ''}
      ${!mine && st === 'open' && flag.status === 'open' ? `
        <div class="btn-row" style="margin-top:11px">
          <button class="btn ghost sm" style="flex:1" data-act="offerModal" data-flag="${esc(flag.id)}" data-pro="${esc(pro.id)}">Counter</button>
          <button class="btn brand sm" style="flex:1" data-act="acceptOffer" data-msg="${esc(m.id)}" data-flag="${esc(flag.id)}" data-pro="${esc(pro.id)}">Accept</button>
        </div>` : ''}
      <div class="msg-t" style="color:var(--ink-3)">${esc(clockTime(m.ts))}</div>
    </div>`;
  }
  return `<div class="msg ${m.from === 'me' ? 'me' : 'them'}">${esc(m.text)}<div class="msg-t">${esc(clockTime(m.ts))}</div></div>`;
}

/* ---------------------------------------------------------------- reply simulator */
function proReplies(flagId, proId, userText) {
  const flag = flagById(flagId);
  if (!flag) return;
  const L = linesFor(flag.cat);
  const t = getThread(flagId, proId);
  typingIn = t.id;
  render();

  const themCount = t.msgs.filter(m => m.from === 'them' && !m.offer).length;
  const wantsSchedule = /when|time|today|tomorrow|schedule|available|come out|monday|tuesday|wednesday|thursday|friday|weekend/i.test(userText);
  const wantsTrust = /licen|insur|warrant|guarantee|review|reference|bonded|permit/i.test(userText);

  const line = wantsSchedule ? pick(L.scheduling)
    : wantsTrust ? pick(L.reassure)
    : themCount < 2 ? pick(L.qualify)
    : themCount < 4 ? pick(L.reassure)
    : pick(L.scheduling);

  setTimeout(() => {
    typingIn = null;
    pushMsg(flagId, proId, { from: 'them', text: line });
    render();
  }, 1100 + Math.random() * 1300);
}

/** Counter-offer logic: accept, split the difference, or hold firm. */
function proAnswersOffer(flagId, proId, offered) {
  const flag = flagById(flagId);
  const bid = bidsFor(flagId).find(b => b.proId === proId);
  if (!flag || !bid) return;
  const L = linesFor(flag.cat);
  const t = getThread(flagId, proId);
  typingIn = t.id;
  render();

  const ratio = offered / bid.price;

  setTimeout(() => {
    typingIn = null;
    if (ratio >= 0.92) {
      bid.price = offered;
      const last = [...t.msgs].reverse().find(m => m.offer && m.from === 'me');
      if (last) last.offer.state = 'accepted';
      pushMsg(flagId, proId, { from: 'them', text: pick(L.haggleAccept) });
      pushMsg(flagId, proId, { from: 'sys', text: `Price updated to ${money(offered)}.` });
      toast(`${proById(proId).name} accepted ${money(offered)}`);
    } else if (ratio >= 0.76) {
      const mid = Math.round(((offered + bid.price) / 2) / 5) * 5;
      pushMsg(flagId, proId, {
        from: 'them',
        text: pick(L.haggleCounter),
        offer: { price: mid, state: 'open' },
      });
    } else {
      pushMsg(flagId, proId, { from: 'them', text: pick(L.haggleHold) });
      pushMsg(flagId, proId, {
        from: 'them',
        text: 'Here is my number again:',
        offer: { price: bid.price, state: 'open' },
      });
    }
    render();
  }, 1500 + Math.random() * 1400);
}

/* ---------------------------------------------------------------- actions */
actions({
  goInbox: () => go('inbox'),

  openThread: (el) => go('thread', { flagId: el.dataset.flag, proId: el.dataset.pro }),

  sendMsg: (el) => {
    const box = document.getElementById('composerBox');
    const text = (box ? box.value : '').trim();
    if (!text) return;
    const { flag, pro } = el.dataset;
    if (box) box.value = '';
    pushMsg(flag, pro, { from: 'me', text });
    render();
    proReplies(flag, pro, text);
  },

  offerModal: (el) => {
    const { flag: flagId, pro: proId } = el.dataset;
    const bid = bidsFor(flagId).find(b => b.proId === proId);
    const pro = proById(proId);
    const current = bid ? bid.price : 0;
    openModal(`
      <h3 style="font-size:19px;margin-bottom:6px">Send ${esc(pro.name)} a price</h3>
      <p class="sub" style="margin-bottom:2px">${bid ? `Their current price is <b>${money(current)}</b>. Offers within about 8% usually get accepted.` : 'Name the price you want to pay.'}</p>
      <label class="fl" for="offerAmt">Your offer (USD)</label>
      <input class="inp" id="offerAmt" type="number" inputmode="numeric" placeholder="${current ? Math.round(current * 0.88) : 500}" />
      <label class="fl" for="offerMsg">Message <span class="opt">(optional)</span></label>
      <input class="inp" id="offerMsg" placeholder="e.g. I can pay cash today" />
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn brand" data-act="sendOffer" data-flag="${esc(flagId)}" data-pro="${esc(proId)}">Send offer</button>
      </div>`);
    setTimeout(() => { const f = document.getElementById('offerAmt'); if (f) f.focus(); }, 60);
  },

  sendOffer: (el) => {
    const amt = Number(val('offerAmt'));
    if (!amt || amt <= 0) { toast('Enter an amount first'); return; }
    const { flag, pro } = el.dataset;
    const msg = val('offerMsg');
    closeModal();
    pushMsg(flag, pro, { from: 'me', text: msg, offer: { price: amt, state: 'open' } });
    go('thread', { flagId: flag, proId: pro });
    proAnswersOffer(flag, pro, amt);
  },

  acceptOffer: (el) => {
    const { flag: flagId, pro: proId, msg: msgId } = el.dataset;
    const t = getThread(flagId, proId);
    const m = t.msgs.find(x => x.id === msgId);
    const bid = bidsFor(flagId).find(b => b.proId === proId);
    if (!m || !bid) return;
    m.offer.state = 'accepted';
    bid.price = m.offer.price;
    pushMsg(flagId, proId, { from: 'sys', text: `You accepted ${money(m.offer.price)}. Tap Hire to lock it in.` });
    render();
    toast(`Price set to ${money(m.offer.price)}`);
  },

  hire: (el) => {
    const bid = acceptBid(el.dataset.bid);
    if (!bid) return;
    toast(`Hired — ${money(bid.price)}`);
    go('flag', { id: bid.flagId });
  },
});

export { typingIn };
