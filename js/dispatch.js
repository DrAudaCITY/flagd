// dispatch.js — what happens the moment a price is agreed: confirm the booking,
// text the customer the technician's photo and story, and put a live tracking link
// in their hand.
//
// Modelled on the ServiceTitan "on the way" text: a photo MMS first, then a message
// naming the technician, the company, the destination address, a short human bio,
// a tracking link and an office number.
//
// IMPORTANT: a static front end cannot send SMS — that needs a server and a carrier
// (Twilio, MessageBird, Telnyx). Everything below simulates the send and renders
// exactly what would go out, so wiring the real thing is replacing one function.
// See sendSms() for the contract the backend has to satisfy.

import {
  cat, proById, proPhoto, proVehicle, proPhone, personalFor,
} from './data.js';
import {
  state, flagById, bidsFor, proOverrides, proRating, setPhone,
  startTracking, updateTracking, logSms, commit,
} from './store.js';
import {
  esc, money, avatar, ratingLine, icon, stars, toast, actions, openModal, closeModal,
  val, backHead, badge, VERIF_SVG, miles,
} from './ui.js';
import { go, render } from './router.js';
import * as gmap from './map.js';
import { distance } from './geo.js';
import { acceptBid } from './deals.js';
import {
  savedCard, saveCardToken, removeCard, authorizeForHire,
  startOnboarding, completeOnboarding, PAYMENT_STATES,
} from './payments.js';

/* ---------------------------------------------------------------- helpers */
const AVG_MPH = 28;              // city average, good enough for an honest ETA
const DEMO_SPEEDUP = 20;         // the trip plays out 20x faster than real time

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Short, link-safe tracking code, stable per booking. */
export const trackCode = (flagId, proId) => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let h = hash(flagId + proId), out = '';
  for (let i = 0; i < 6; i++) { out += A[h % A.length]; h = Math.floor(h / A.length) + 7; }
  return out;
};
export const trackUrl = (flagId, proId) => `flagd.app/t/${trackCode(flagId, proId)}`;

/** Everything the customer should know about the person arriving. */
export function techFor(proId) {
  const pro = proById(proId);
  if (!pro) return null;
  const person = personalFor(pro, proOverrides(proId));
  const ov = proOverrides(proId) || {};
  return {
    pro,
    name: person.owner || pro.name,
    company: pro.name,
    photo: ov.photo || proPhoto(pro),
    about: person.about,
    interests: person.interests || [],
    local: person.local,
    vehicle: proVehicle(pro),
    phone: proPhone(pro),
    rating: proRating(proId),
  };
}

export const fmtPhone = (raw) => {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};
const phoneValid = (raw) => String(raw || '').replace(/\D/g, '').length === 10;

/* ---------------------------------------------------------------- the message */
/**
 * Builds the two-part send: a photo MMS, then the text.
 * Kept as data rather than a string blob so the backend can send them separately.
 */
export function composeArrivalSms(flag, tech) {
  const bio = tech.about ? ' ' + tech.about : '';
  const text =
    `Hi, your ${cat(flag.cat).kind === 'item' ? 'seller' : 'technician'} ${tech.name} from ` +
    `${tech.company} is on the way to ${flag.address || 'your address'}.` +
    `${bio} Track now: https://${trackUrl(flag.id, tech.pro.id)}. ` +
    `Call for any questions: ${tech.phone}.`;
  return { photo: tech.photo, photoAlt: `${tech.name}, ${tech.company}`, text };
}

export function composeArrivedSms(flag, tech) {
  return {
    text: `${tech.name} has arrived at ${flag.address || 'your address'}. ` +
          `Reply STOP to opt out of updates.`,
  };
}

/**
 * The only function a real build replaces. Today it records the message so the UI
 * can show it; tomorrow it POSTs to your server, which calls the carrier.
 *
 *   await fetch('/api/sms', { method:'POST', body: JSON.stringify({ to, text, mediaUrl }) })
 *
 * Never call a carrier API directly from the browser — the auth token would ship
 * with the page.
 */
function sendSms(flagId, to, msg) {
  logSms(flagId, { to, text: msg.text, photo: msg.photo || null, status: 'sent' });
}

/* ---------------------------------------------------------------- the trip */
/** A plausible starting point for the pro: a few miles out, stable per booking. */
function originFor(flag, proId) {
  const h = hash(flag.id + proId);
  const bearing = (h % 360) * Math.PI / 180;
  const milesOut = 3 + (h % 6);                       // 3–8 miles
  const dLat = (milesOut / 69) * Math.cos(bearing);
  const dLng = (milesOut / (69 * Math.cos(flag.ll[0] * Math.PI / 180))) * Math.sin(bearing);
  return [flag.ll[0] + dLat, flag.ll[1] + dLng];
}

export function beginTrip(flagId, proId) {
  const flag = flagById(flagId);
  if (!flag) return null;
  const from = originFor(flag, proId);
  const meters = distance(from, flag.ll);
  const etaMin = Math.max(4, Math.round((meters / 1609.34) / AVG_MPH * 60));
  return startTracking(flagId, {
    proId,
    from,
    to: flag.ll,
    etaMin,
    durationMs: (etaMin * 60000) / DEMO_SPEEDUP,
  });
}

/** Where the pro is right now, and how long is left. */
export function tripState(flag) {
  const t = flag && flag.tracking;
  if (!t) return null;
  const elapsed = Date.now() - t.startedAt;
  const pct = Math.min(1, elapsed / t.durationMs);
  const pos = [
    t.from[0] + (t.to[0] - t.from[0]) * pct,
    t.from[1] + (t.to[1] - t.from[1]) * pct,
  ];
  const minsLeft = Math.max(0, Math.ceil(t.etaMin * (1 - pct)));
  return { pct, pos, minsLeft, arrived: pct >= 1, proId: t.proId };
}

/* ---------------------------------------------------------------- confirm & hire */
actions({
  // Intercepts the plain "Hire" so a price agreement becomes a real booking.
  confirmHire: (el) => {
    const bid = bidsFor(el.dataset.flag).find(b => b.id === el.dataset.bid);
    if (!bid) return;
    const flag = flagById(bid.flagId);
    const tech = techFor(bid.proId);
    if (!flag || !tech) return;

    openModal(`
      <h3 style="margin-bottom:6px">Confirm booking</h3>
      <p class="sub" style="margin-bottom:18px">You are hiring ${esc(tech.company)} for ${money(bid.price)}.</p>

      <div class="tech-row">
        <img class="tech-photo" src="${esc(tech.photo)}" alt="${esc(tech.name)}"
             onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tech-photo tech-photo-fb',textContent:'${esc(tech.name.slice(0, 1))}'}))">
        <div style="flex:1;min-width:0">
          <div class="pro-nm">${esc(tech.name)}${tech.pro.verified ? VERIF_SVG : ''}</div>
          <div class="pro-meta">${esc(tech.company)}</div>
          <div class="pro-meta">${ratingLine(tech.rating.rating, tech.rating.reviews)}</div>
        </div>
      </div>

      <label class="fl" for="smsPhone">Mobile number for arrival updates</label>
      <input class="inp" id="smsPhone" inputmode="tel" placeholder="(512) 555-0134"
             value="${esc(state.me.phone || '')}" oninput="this.value=window.__flagdPhone(this.value)" />

      <label class="optin" for="smsOptIn">
        <input type="checkbox" id="smsOptIn" ${state.me.smsOptIn !== false ? 'checked' : ''} />
        <span>Text me when ${esc(tech.name.split(' ')[0])} is on the way — including a photo, and a live tracking link. Message and data rates may apply. Reply STOP to cancel.</span>
      </label>

      <div class="btn-row" style="margin-top:20px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn" data-act="doHire" data-bid="${esc(bid.id)}">Hire · ${money(bid.price)}</button>
      </div>
      <p class="hint" style="text-align:center">Skip the number and you are still hired — you just will not get the texts.</p>
    `);
    setTimeout(() => { const f = document.getElementById('smsPhone'); if (f) f.focus(); }, 60);
  },

  doHire: (el) => {
    const bidId = el.dataset.bid;
    const phone = val('smsPhone');
    const box = document.getElementById('smsOptIn');
    const optIn = !!(box && box.checked);

    if (optIn && phone && !phoneValid(phone)) {
      toast('That number needs 10 digits');
      return;
    }

    // Money is reserved before anything else — that is what makes "hired" a
    // commitment rather than a status label. No card, nothing to hire against.
    if (!savedCard()) {
      openCardModal(bidId);
      return;
    }

    const bid = acceptBid(bidId);
    if (!bid) return;
    closeModal();

    const flag = flagById(bid.flagId);
    const tech = techFor(bid.proId);
    setPhone(phone, optIn && phoneValid(phone));

    authorizeForHire(flag.id, bid.id).then(res => {
      if (!res.ok) {
        toast(res.why === 'DECLINED' ? 'That card was declined' : 'Could not reserve the payment');
      } else {
        toast(`${money(bid.price)} reserved — released when you confirm the job is done`);
      }
      render();
    });

    if (optIn && phoneValid(phone)) {
      beginTrip(flag.id, bid.proId);
      sendSms(flag.id, phone, composeArrivalSms(flag, tech));
      toast(`Text sent to ${fmtPhone(phone)}`);
      go('tracking', { id: flag.id });
    } else {
      toast(`Hired — ${money(bid.price)}`);
      go('flag', { id: flag.id });
    }
  },

  openTracking: (el) => { go('tracking', { id: el.dataset.id }); },

  /**
   * In a real build this modal mounts Stripe Elements against a SetupIntent, and
   * the card details go from the browser straight to Stripe. Flagd never receives
   * the number — which is why there is deliberately no card-number input here.
   */
  addCard: (el) => openCardModal(el.dataset.bid || null),

  attachTestCard: (el) => {
    saveCardToken({ brand: 'Visa', last4: '4242' });
    closeModal();
    toast('Card saved');
    const bidId = el.dataset.bid;
    if (bidId) {
      const bid = bidsFor(flagById(el.dataset.flag) ? el.dataset.flag : '').find(b => b.id === bidId);
      setTimeout(() => {
        const btn = document.querySelector(`[data-act="confirmHire"][data-bid="${bidId}"]`);
        if (btn) btn.click();
        else render();
      }, 250);
    } else render();
  },

  removeCard: () => { removeCard(); render(); toast('Card removed'); },

  startPayouts: () => {
    startOnboarding(state.pro.profileId);
    render();
    toast('Onboarding started — Stripe would take it from here');
  },

  finishPayouts: () => {
    completeOnboarding(state.pro.profileId);
    render();
    toast('Payouts active');
  },

  resendSms: (el) => {
    const flag = flagById(el.dataset.id);
    const tech = techFor(flag.tracking.proId);
    sendSms(flag.id, state.me.phone, composeArrivalSms(flag, tech));
    render();
    toast('Text resent');
  },

  markArrived: (el) => {
    const flag = flagById(el.dataset.id);
    if (!flag || !flag.tracking) return;
    updateTracking(flag.id, { startedAt: Date.now() - flag.tracking.durationMs });
    render();
  },
});

// Phone masking needs to run from an inline handler inside the modal markup.
window.__flagdPhone = fmtPhone;

/**
 * The card sheet. Note what is NOT here: any field that accepts a card number.
 * Collecting a PAN would drag Flagd into PCI-DSS scope for no benefit at all.
 * Stripe Elements mounts in this slot and the number goes browser -> Stripe.
 */
function openCardModal(bidId) {
  openModal(`
    <h3 style="margin-bottom:6px">Add a payment method</h3>
    <p class="sub" style="margin-bottom:16px">Your card is reserved when you hire and only charged once you confirm the work is done.</p>

    <div class="card-slot">
      <div class="card-slot-label">Stripe Elements mounts here</div>
      <p class="hint" style="margin:0">The card is entered directly into Stripe's iframe. Flagd only ever stores a token and the last four digits — the number never reaches this app.</p>
    </div>

    <button class="btn" style="margin-top:16px" data-act="attachTestCard" ${bidId ? `data-bid="${esc(bidId)}"` : ''}>
      Attach test card ···· 4242
    </button>
    <p class="hint" style="text-align:center;margin-top:10px">Demo only. No real card is stored and no money moves.</p>
    <div class="btn-row" style="margin-top:14px">
      <button class="btn ghost" data-act="closeModal">Cancel</button>
    </div>`);
}

/* ---------------------------------------------------------------- payment card */
/** Shown on the flag once a pro is hired. */
export function paymentBlock(flag) {
  const p = flag.payment;
  if (!p) return '';
  const meta = PAYMENT_STATES[p.status] || PAYMENT_STATES.none;

  return `<div class="sec">
    <div class="sec-t">Payment</div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:700;color:var(--ink);font-size:15px">${esc(meta.label)}</div>
          ${meta.blurb ? `<div class="pro-meta">${esc(meta.blurb)}</div>` : ''}
        </div>
        <div class="price">${money(p.amountCents / 100)}</div>
      </div>

      <div class="kv" style="margin-top:12px"><span>Card</span><b>···· ${esc(p.cardLast4 || '')}</b></div>
      <div class="kv"><span>Pro receives</span><b>${money(p.proReceivesCents / 100)}</b></div>
      <div class="kv"><span>Flagd commission</span><b>${p.platformFeeCents === 0 ? 'None' : money(p.platformFeeCents / 100)}</b></div>
      ${p.refundedCents ? `<div class="kv"><span>Refunded</span><b>${money(p.refundedCents / 100)}</b></div>` : ''}

      ${p.events.length ? `<div style="margin-top:12px">
        ${p.events.slice(-3).map(e => `<div class="pro-meta">${esc(e.text)}</div>`).join('')}
      </div>` : ''}

      ${p.status === 'authorized' || p.status === 'held' ? `
        <p class="hint" style="margin-top:10px">Nothing is released until you mark the job complete. If it goes wrong, open a support case and the money stays put.</p>` : ''}
    </div>
  </div>`;
}

/* ---------------------------------------------------------------- tracking view */
let tick = null;

export function stopTicking() { clearInterval(tick); tick = null; }

export function renderTracking(flagId) {
  const flag = flagById(flagId);
  if (!flag || !flag.tracking) {
    return `<div class="view">${backHead('Tracking', 'goHome')}<p class="sub">No active trip for this flag.</p></div>`;
  }
  const tech = techFor(flag.tracking.proId);
  const trip = tripState(flag);
  const bid = bidsFor(flag.id).find(b => b.id === flag.hiredBidId);

  // Drive the map and keep the panel ticking while this screen is open.
  gmap.setCourier(trip.pos, flag.ll, trip.arrived);
  stopTicking();
  if (!trip.arrived) tick = setInterval(() => { if (document.querySelector('.trk')) render(); }, 1000);
  else if (!flag.tracking.arrivedLogged) {
    flag.tracking.arrivedLogged = true;
    flag.tracking.status = 'arrived';
    sendSms(flag.id, state.me.phone, composeArrivedSms(flag, tech));
    commit();
  }

  const pctW = Math.round(trip.pct * 100);

  return `<div class="view trk">
    ${backHead(trip.arrived ? 'Arrived' : 'On the way', 'goBack')}

    <div class="trk-hero">
      <img class="tech-photo lg" src="${esc(tech.photo)}" alt="${esc(tech.name)}"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tech-photo lg tech-photo-fb',textContent:'${esc(tech.name.slice(0, 1))}'}))">
      <div style="flex:1;min-width:0">
        <div class="trk-eta">${trip.arrived ? 'Here now' : `${trip.minsLeft} min away`}</div>
        <div class="pro-nm" style="font-size:17px">${esc(tech.name)}${tech.pro.verified ? VERIF_SVG : ''}</div>
        <div class="pro-meta">${esc(tech.company)}</div>
        <div class="pro-meta">${ratingLine(tech.rating.rating, tech.rating.reviews)}</div>
      </div>
    </div>

    <div class="trk-bar"><i style="width:${pctW}%"></i></div>
    <p class="hint" style="margin-top:6px">${trip.arrived
      ? `${esc(tech.name.split(' ')[0])} is at ${esc(flag.address || 'your address')}.`
      : `Heading to ${esc(flag.address || 'your address')}`}</p>

    ${tech.about ? `<div class="card flat" style="margin-top:18px">
      <div class="sec-t" style="margin-bottom:8px">About ${esc(tech.name.split(' ')[0])}</div>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:var(--ink-2)">${esc(tech.about)}</p>
      ${tech.interests.length ? `<div class="chips" style="margin-top:12px">${
        tech.interests.map(i => `<span class="chip" style="cursor:default">${esc(i)}</span>`).join('')}</div>` : ''}
      ${tech.local ? `<p class="hint" style="margin-top:10px">${esc(tech.local)}</p>` : ''}
    </div>` : ''}

    <div class="sec">
      <div class="sec-t">Details</div>
      <div class="card">
        ${row('Vehicle', tech.vehicle.model)}
        ${row('Plate', tech.vehicle.plate)}
        ${tech.pro.license ? row('License', tech.pro.license) : ''}
        ${bid ? row('Agreed price', money(bid.price)) : ''}
      </div>
      <div class="btn-row" style="margin-top:10px">
        <a class="btn ghost" href="tel:${esc(tech.phone.replace(/\D/g, ''))}">Call ${esc(tech.phone)}</a>
        <button class="btn ghost" data-act="openThread" data-flag="${esc(flag.id)}" data-pro="${esc(tech.pro.id)}">Message</button>
      </div>
    </div>

    ${smsBlock(flag, tech)}

    <div class="sec">
      ${!trip.arrived ? `<button class="btn ghost" data-act="markArrived" data-id="${esc(flag.id)}">Skip ahead — mark arrived</button>` : ''}
      <p class="hint" style="text-align:center;margin-top:10px">
        Demo: the trip runs ${DEMO_SPEEDUP}× real time, and texts are simulated — nothing is sent to a carrier.
      </p>
    </div>
  </div>`;
}

const row = (k, v) => `<div class="kv"><span>${esc(k)}</span><b>${esc(v)}</b></div>`;

/** The texts as the customer would see them, photo bubble first. */
function smsBlock(flag, tech) {
  const msgs = flag.sms || [];
  if (!msgs.length) return '';
  return `<div class="sec">
    <div class="sec-t">Texted to ${esc(fmtPhone(state.me.phone) || 'your phone')}</div>
    <div class="sms">
      <div class="sms-from">${esc(tech.company)}</div>
      ${msgs.map(m => `
        ${m.photo ? `<div class="sms-photo"><img src="${esc(m.photo)}" alt="${esc(tech.name)}" onerror="this.closest('.sms-photo').remove()"></div>` : ''}
        <div class="sms-bubble">${linkify(m.text)}</div>
      `).join('')}
    </div>
    <button class="btn ghost sm" style="margin-top:12px" data-act="resendSms" data-id="${esc(flag.id)}">Resend</button>
  </div>`;
}

// Mirrors how a phone renders links in an SMS, without making them clickable.
function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s]+)/g, '<span class="sms-link">$1</span>');
}
