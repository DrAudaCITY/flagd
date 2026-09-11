// flags.js — the buyer experience: plant a flag, watch bids arrive, compare pros
// by rating and price, hire one, then rate them.

import { CATEGORIES, cat, catKeys, CHIPS, EXTRA_FIELDS, TIMING, proById, reviewsFor } from './data.js';
import {
  state, myFlags, flagById, bidsFor, addFlag, removeFlag, proRating, myRatingFor,
  setUI, commit,
} from './store.js';
import {
  esc, money, avatar, stars, ratingLine, icon, timeAgo, toast, actions, openModal, closeModal,
  val, chipsOn, chipRow, backHead, emptyState, badge, starPicker, VERIF_SVG, miles,
} from './ui.js';
import { go, back, render } from './router.js';
import * as gmap from './map.js';
import { reverse, distance, attachAutocomplete } from './geo.js';
import { usingGoogle, setGoogleKey } from './config.js';
import { techFor, tripState, paymentBlock } from './dispatch.js';
import { onJobCompleted, onRated, rewardsSummary, buyerLedger } from './rewards.js';
import { savedCard, releaseOnCompletion } from './payments.js';
import {
  FLAG_STATES, CLOSE_REASONS, REPORT_REASONS, canDelete, canEdit,
  pauseFlag, editFlag, closeFlag, repostFlag, deleteFlag, cancelBooking, reportFlag,
} from './flag-admin.js';
import { simulateBids, sortBids, filterBids, acceptBid, completeJob, submitRating, reopenFlag } from './deals.js';

let pending = null;   // { catKey, ll, address } while a flag is being planted

/* ================================================================ home view */
export function renderHome() {
  const mine = myFlags();
  const active = mine.filter(f => f.status !== 'done');
  const others = state.flags.filter(f => !f.mine).slice(0, 6);

  const myCards = active.length
    ? active.map(flagCard).join('')
    : `<div class="card" style="border-style:dashed;text-align:center;padding:22px">
         <div style="font-size:26px;margin-bottom:6px">🚩</div>
         <div style="font-weight:700;color:var(--ink);font-size:14.5px;margin-bottom:4px">No flags planted yet</div>
         <p class="sub" style="margin:0 0 14px">Drop one on the map and local pros come to you — with prices, not phone tag.</p>
         <button class="btn brand sm" data-act="startFlag">Plant your first flag</button>
       </div>`;

  return `<div class="view">
    <div class="view-head"><h2>Plant a flag.<br>Let the pros come to you.</h2></div>
    <p class="sub">Say what you need or what you want to buy, drop it on the map, and licensed local pros and sellers bid for the work. Free for you — always.</p>

    <button class="btn brand" style="margin-top:16px" data-act="startFlag">🚩 Plant a flag</button>

    <div class="sec">
      <div class="sec-t">Your flags</div>
      ${myCards}
    </div>

    <div class="sec">
      <div class="sec-t">Live near you</div>
      ${others.map(f => nearbyRow(f)).join('')}
      <p class="hint">Flags from other people in the area. Pros see these the moment they are planted.</p>
    </div>

    <div class="sec">
      <div class="sec-t">How it works</div>
      ${step(1, 'Plant a flag', 'Pick a category, drop the pin, add a few details. Takes about 40 seconds.')}
      ${step(2, 'Pros bid on it', 'Verified local pros within range get an alert and send you a real price.')}
      ${step(3, 'Chat and negotiate', 'Ask questions, counter the price, and compare star ratings side by side.')}
      ${step(4, 'Close it in the app', 'Hire the one you want, then rate them so the next person knows.')}
    </div>
  </div>`;
}

const step = (n, t, b) => `<div class="card" style="display:flex;gap:12px;align-items:flex-start">
    <div class="av step-n" style="border-radius:10px">${n}</div>
    <div style="flex:1"><div style="font-weight:700;color:var(--ink);font-size:14px">${esc(t)}</div>
    <p class="sub" style="margin-top:3px">${esc(b)}</p></div></div>`;

function nearbyRow(f) {
  const c = cat(f.cat);
  const d = state.home ? distance(state.home.ll, f.ll) : null;
  return `<div class="card tap" data-act="openFlag" data-id="${esc(f.id)}" style="display:flex;gap:11px;align-items:center;padding:11px 13px">
    <div class="cat-ico">${c.icon}</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;color:var(--ink);font-size:13.5px;line-height:1.3">${esc(f.title)}</div>
      <div class="pro-meta">${esc(f.who || 'Someone')} · ${esc(f.ago || timeAgo(f.createdAt))}${d != null ? ' · ' + esc(miles(d)) : ''}</div>
    </div>
    <div style="text-align:right;flex:0 0 auto">
      <div class="count" style="font-family:var(--display);font-weight:700;font-size:16px;letter-spacing:-.03em">${f.bidCount || 0}</div>
      <div style="font-size:10px;color:var(--ink-3);font-weight:600;text-transform:uppercase">bids</div>
    </div>
  </div>`;
}

function flagCard(f) {
  const c = cat(f.cat);
  const bids = bidsFor(f.id).filter(b => b.status !== 'declined');
  const best = bids.length ? Math.min(...bids.map(b => b.price)) : null;
  const st = f.status === 'hired' ? badge('hired', 'Hired')
    : f.status === 'done' ? badge('done', 'Completed')
    : badge('open', 'Taking bids');

  return `<div class="card tap ${f.status === 'hired' ? 'live' : ''}" data-act="openFlag" data-id="${esc(f.id)}">
    <div style="display:flex;gap:11px;align-items:flex-start">
      <div class="cat-ico">${c.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--ink);font-size:14.5px;line-height:1.3">${esc(f.title)}</div>
        <div class="pro-meta">${esc(c.name)} · ${esc(timeAgo(f.createdAt))}</div>
      </div>
      ${st}
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:11px;padding-top:11px;border-top:1px solid var(--mist-2)">
      <div style="flex:1;font-size:12.5px;color:var(--ink-3)">
        ${bids.length ? `<b style="color:var(--ink)">${bids.length}</b> bid${bids.length === 1 ? '' : 's'}` : 'Waiting for the first bid…'}
      </div>
      ${best != null ? `<div class="price" style="font-size:16px">${money(best)}<small>best offer</small></div>` : ''}
    </div>
  </div>`;
}

/* ================================================================ my flags */
export function renderMyFlags() {
  const mine = myFlags();
  if (!mine.length) {
    return `<div class="view"><div class="view-head"><h2>Your flags</h2></div></div>` +
      emptyState('🚩', 'Nothing planted yet', 'Your flags, bids and hired pros all live here.', 'Plant a flag', 'startFlag');
  }
  return `<div class="view">
    <div class="view-head"><h2>Your flags</h2></div>
    <p class="sub">${mine.length} total · ${mine.filter(f => f.status === 'open').length} taking bids</p>
    <div class="sec">${mine.map(flagCard).join('')}</div>
    <button class="btn ghost" data-act="startFlag">Plant another flag</button>
  </div>`;
}

/* ================================================================ category picker */
export function renderPicker() {
  const tab = state.ui.catTab || 'service';
  const keys = catKeys(tab);
  return `<div class="view">
    ${backHead('What do you need?', 'goHome', 'Pick a category. You will drop the pin next.')}
    <div class="cat-tabs">
      <button class="${tab === 'service' ? 'on' : ''}" data-act="catTab" data-tab="service">Services</button>
      <button class="${tab === 'item' ? 'on' : ''}" data-act="catTab" data-tab="item">Buying something</button>
    </div>
    <div class="cats">
      ${keys.map(k => {
        const c = CATEGORIES[k];
        return `<button class="cat" data-act="pickCat" data-cat="${esc(k)}">
          <span class="cat-ico">${c.icon}</span>
          <span class="cat-nm">${esc(c.name)}</span>
          <span class="cat-go">${icon('go')}</span>
        </button>`;
      }).join('')}
    </div>
    <p class="hint" style="margin-top:14px">${tab === 'service'
      ? 'Licensed pros in range get an instant alert and bid with a real number.'
      : 'Dealers, shops and private sellers see what you want and come to you with what they have.'}</p>
  </div>`;
}

/* ================================================================ intake form */
export function renderIntake() {
  if (!pending) return renderPicker();
  const c = cat(pending.catKey);
  const extras = EXTRA_FIELDS[pending.catKey] || [];

  return `<div class="view">
    ${backHead(c.icon + '  ' + c.name, 'cancelFlag', 'The more you say, the tighter the bids come back.')}

    <label class="fl" for="fTitle">One-line summary</label>
    <input class="inp" id="fTitle" placeholder="${esc(placeholderFor(pending.catKey))}" />

    <label class="fl">Quick details <span class="opt">— tap all that apply</span></label>
    ${chipRow(CHIPS[pending.catKey] || CHIPS.other, 'fChips')}

    ${extras.map(f => `<label class="fl" for="x_${esc(f.id)}">${esc(f.label)}</label>
      <input class="inp" id="x_${esc(f.id)}" placeholder="${esc(f.ph)}" />`).join('')}

    <label class="fl" for="fDesc">Describe it <span class="opt">(optional)</span></label>
    <textarea class="inp" id="fDesc" placeholder="${esc(descPlaceholder(pending.catKey))}"></textarea>

    <label class="fl" for="fAddr">Address</label>
    <input class="inp" id="fAddr" value="${esc(pending.address || '')}" placeholder="Start typing your address…"
           autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
    <div class="row" style="margin-top:9px">
      <input class="inp" id="fUnit" placeholder="Apt / unit (optional)" />
      <input class="inp" id="fZip" placeholder="ZIP" inputmode="numeric" maxlength="10" style="max-width:110px" />
    </div>
    <p class="hint" id="addrHint">Pin dropped at ${esc(pending.ll[0].toFixed(4))}, ${esc(pending.ll[1].toFixed(4))}. Pros only see your neighborhood until you hire one.</p>

    <label class="fl" for="fBudget">Budget <span class="opt">(optional, but it speeds things up)</span></label>
    <div class="row">
      <input class="inp" id="fMin" type="number" inputmode="numeric" placeholder="Min $" />
      <input class="inp" id="fMax" type="number" inputmode="numeric" placeholder="Max $" />
    </div>

    <label class="fl" for="fTiming">When do you need this?</label>
    <select class="inp" id="fTiming">${TIMING.map((t, i) => `<option ${i === 1 ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>

    <div class="btn-row" style="margin-top:22px">
      <button class="btn ghost" data-act="cancelFlag">Cancel</button>
      <button class="btn brand" data-act="submitFlag">🚩 Plant it</button>
    </div>
    <p class="hint" style="text-align:center;margin-top:10px">Free for you. Pros pay to bid.</p>
  </div>`;
}

const placeholderFor = (k) => ({
  plumber: 'e.g. Water heater leaking into the garage',
  electrician: 'e.g. Need a 240V outlet for an EV charger',
  hvac: 'e.g. AC blowing warm upstairs',
  usedcar: 'e.g. Wanted: Toyota Tacoma SR5, under 80k miles',
  furniture: 'e.g. Wanted: gray fabric sectional, delivered',
  electronics: 'e.g. Wanted: MacBook Pro 14" M3, 16GB',
}[k] || 'One line a pro can read in two seconds');

const descPlaceholder = (k) =>
  cat(k).kind === 'item'
    ? 'Condition, must-haves, deal breakers, whether you need delivery…'
    : 'What is happening, when it started, anything you already tried…';

/* ================================================================ flag detail */
export function renderFlagView(id) {
  const f = flagById(id);
  if (!f) return emptyState('🤷', 'Flag not found', 'It may have been removed.', 'Back', 'goHome');
  if (!f.mine) return renderOtherFlag(f);

  const c = cat(f.cat);
  const all = bidsFor(f.id);
  const minR = state.ui.minRating || 0;
  const sort = state.ui.bidSort || 'best';
  const shown = sortBids(filterBids(all.filter(b => b.status !== 'declined'), minR), sort, state.home && state.home.ll);
  const hired = f.hiredBidId ? all.find(b => b.id === f.hiredBidId) : null;

  return `<div class="view">
    ${backHead(f.title, 'goHome')}
    <div class="pro-meta" style="margin-top:8px">
      ${badge('cat', c.icon + ' ' + c.name)}
      ${f.status === 'open' ? badge('open', 'Taking bids') : f.status === 'hired' ? badge('hired', 'Hired') : badge('done', 'Completed')}
      <span>${esc(timeAgo(f.createdAt))}</span>
    </div>
    ${f.address ? `<p class="sub">${esc(f.address)}</p>` : ''}
    ${f.chips && f.chips.length ? `<div class="chips" style="margin-top:12px">${f.chips.map(x => `<span class="chip on" style="cursor:default">${esc(x)}</span>`).join('')}</div>` : ''}
    ${f.desc ? `<div class="quote">${esc(f.desc)}</div>` : ''}
    ${f.budget ? `<p class="hint">Budget: ${esc(f.budget)} · ${esc(f.timing || '')}</p>` : ''}

    ${hired ? hiredBlock(f, hired) : ''}

    ${f.status === 'open' ? `
      <div class="sec">
        <div class="sec-t">${all.length ? `${all.length} bid${all.length === 1 ? '' : 's'}` : 'Bids'}</div>
        ${all.length ? `
          <div class="filters">
            <button class="chip ${sort === 'best' ? 'on' : ''}" data-act="sortBids" data-s="best">Best value</button>
            <button class="chip ${sort === 'price' ? 'on' : ''}" data-act="sortBids" data-s="price">Lowest price</button>
            <button class="chip ${sort === 'rating' ? 'on' : ''}" data-act="sortBids" data-s="rating">Top rated</button>
            <button class="chip ${sort === 'fast' ? 'on' : ''}" data-act="sortBids" data-s="fast">Fastest reply</button>
          </div>
          <div class="filters">
            <button class="chip ${minR === 0 ? 'on' : ''}" data-act="minRating" data-r="0">All ratings</button>
            <button class="chip ${minR === 4 ? 'on' : ''}" data-act="minRating" data-r="4">4.0★ and up</button>
            <button class="chip ${minR === 4.5 ? 'on' : ''}" data-act="minRating" data-r="4.5">4.5★ and up</button>
          </div>
          ${shown.length ? shown.map(b => bidCard(b, f)).join('')
            : `<div class="waiting">No bids match that filter. Loosen it to see the rest.</div>`}
        ` : `<div class="waiting"><span class="pulse"></span> Alerting pros in range — first bids usually land within minutes.</div>
             <div class="skel"></div><div class="skel"></div>`}
      </div>` : ''}

    ${f.status === 'done' ? doneBlock(f, hired) : ''}

    ${paymentBlock(f)}
    ${manageBlock(f)}
  </div>`;
}

/* -------- managing your own flag */
function manageBlock(f) {
  const bids = bidsFor(f.id).length;
  const del = canDelete(f);
  const edit = canEdit(f);
  const paused = f.status === 'paused';

  return `<div class="sec">
    <div class="sec-t">Manage</div>
    <div class="card">
      <div class="kv"><span>Status</span><b>${esc((FLAG_STATES[f.status] || {}).label || f.status)}</b></div>
      <div class="kv"><span>Responses</span><b>${bids}</b></div>
      ${f.edits ? `<div class="kv"><span>Edited</span><b>${f.edits} time${f.edits === 1 ? '' : 's'}</b></div>` : ''}
    </div>

    <button class="btn ghost" data-act="focusFlag" data-id="${esc(f.id)}">Show on map</button>

    ${f.status === 'open' || paused ? `
      <button class="btn ghost" style="margin-top:8px" data-act="togglePause" data-id="${esc(f.id)}">
        ${paused ? 'Resume — start taking bids again' : 'Pause — stop new bids for now'}
      </button>` : ''}

    ${edit.ok ? `
      <button class="btn ghost" style="margin-top:8px" data-act="editFlagModal" data-id="${esc(f.id)}">Edit the details</button>
      ${edit.warnBidders ? `<p class="hint">${bids} pro${bids === 1 ? ' has' : 's have'} already quoted. They will be told what changed.</p>` : ''}
    ` : ''}

    ${f.status === 'hired' ? `
      <button class="btn ghost" style="margin-top:8px" data-act="cancelBookingModal" data-id="${esc(f.id)}">Cancel the booking</button>
      <p class="hint">Releases the hold on your card and tells the pro.</p>` : ''}

    ${f.status === 'done' || f.status === 'closed' ? `
      <button class="btn ghost" style="margin-top:8px" data-act="repostFlag" data-id="${esc(f.id)}">Post this again</button>` : ''}

    ${f.status !== 'done' && f.status !== 'closed' ? `
      <button class="btn ghost" style="margin-top:8px" data-act="closeFlagModal" data-id="${esc(f.id)}">Close this flag</button>` : ''}

    <button class="btn danger" style="margin-top:8px" data-act="deleteFlag" data-id="${esc(f.id)}"
      ${del.ok ? '' : 'disabled'}>Delete permanently</button>
    ${!del.ok ? `<p class="hint">${esc(del.why)}</p>` : ''}
  </div>`;
}

function bidCard(b, f) {
  const pro = proById(b.proId);
  if (!pro) return '';
  const r = proRating(b.proId);
  const c = cat(f.cat);
  return `<div class="card">
    <div class="pro">
      ${avatar(pro.name)}
      <div class="pro-main">
        <div class="pro-nm">${esc(pro.name)}${pro.verified ? VERIF_SVG : ''}</div>
        <div class="pro-meta">${ratingLine(r.rating, r.reviews)}</div>
        <div class="pro-meta">
          ${pro.years ? `<span>${pro.years} yrs</span>` : '<span>Private seller</span>'}
          ${pro.license ? `<span>${esc(pro.license)}</span>` : ''}
          <span>replies in ~${pro.resp} min</span>
        </div>
      </div>
      <div class="price">${money(b.price)}<small>${esc(b.unit)}</small></div>
    </div>
    ${b.note ? `<div class="quote">${esc(b.note)}</div>` : ''}
    <div class="btn-row" style="margin-top:11px">
      <button class="btn ghost sm" style="flex:1" data-act="openPro" data-pro="${esc(pro.id)}">Profile</button>
      <button class="btn ghost sm" style="flex:1" data-act="openThread" data-flag="${esc(f.id)}" data-pro="${esc(pro.id)}">Chat</button>
      <button class="btn brand sm" style="flex:1.2" data-act="confirmHire" data-bid="${esc(b.id)}" data-flag="${esc(f.id)}">Hire</button>
    </div>
  </div>`;
}

function hiredBlock(f, bid) {
  const tech = techFor(bid.proId);
  if (!tech) return '';
  const trip = tripState(f);

  return `<div class="sec">
    <div class="sec-t">${trip ? (trip.arrived ? 'Arrived' : 'On the way') : 'Hired'}</div>
    <div class="card hi">
      <div class="tech-row">
        <img class="tech-photo" src="${esc(tech.photo)}" alt="${esc(tech.name)}"
             onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tech-photo tech-photo-fb',textContent:'${esc(tech.name.slice(0, 1))}'}))">
        <div style="flex:1;min-width:0">
          <div class="pro-nm">${esc(tech.name)}${tech.pro.verified ? VERIF_SVG : ''}</div>
          <div class="pro-meta">${esc(tech.company)}</div>
          <div class="pro-meta">${ratingLine(tech.rating.rating, tech.rating.reviews)}</div>
        </div>
        <div class="price">${money(bid.price)}<small>agreed</small></div>
      </div>

      ${trip ? `
        <div class="trk-bar" style="margin-top:14px"><i style="width:${Math.round(trip.pct * 100)}%"></i></div>
        <p class="hint" style="margin-top:7px">${trip.arrived
          ? `${esc(tech.name.split(' ')[0])} is at your address.`
          : `${trip.minsLeft} min away · ${esc(tech.vehicle.model)}`}</p>
        <button class="btn" style="margin-top:12px" data-act="openTracking" data-id="${esc(f.id)}">
          ${trip.arrived ? 'View arrival details' : 'Track live'}
        </button>` : ''}

      <div class="btn-row" style="margin-top:10px">
        <button class="btn ghost sm" style="flex:1" data-act="openThread" data-flag="${esc(f.id)}" data-pro="${esc(tech.pro.id)}">Message</button>
        ${f.status === 'hired' ? `<button class="btn ghost sm" style="flex:1.3" data-act="completeJob" data-id="${esc(f.id)}">Mark complete</button>` : ''}
      </div>
      ${f.status === 'hired' ? `<p class="hint" style="text-align:center;margin-top:9px">Money never moves through Flagd in this demo — you settle directly with the pro.</p>` : ''}
    </div>
  </div>`;
}

function doneBlock(f, bid) {
  if (!bid) return '';
  const mine = myRatingFor(bid.proId);
  if (f.rated && mine) {
    return `<div class="sec">
      <div class="sec-t">Your review</div>
      <div class="card">
        ${stars(mine.stars, 'lg')}
        ${mine.text ? `<p class="sub" style="margin-top:8px;color:var(--ink-2)">${esc(mine.text)}</p>` : ''}
        <p class="hint">Thanks — this is what the next person sorts by.</p>
      </div>
    </div>`;
  }
  return `<div class="sec">
    <div class="sec-t">How did it go?</div>
    <div class="card hi">
      <p class="sub" style="margin:0 0 10px">Rate ${esc(proById(bid.proId).name)} so the next neighbor knows what to expect.</p>
      <button class="btn brand" data-act="rateModal" data-flag="${esc(f.id)}" data-pro="${esc(bid.proId)}">Leave a rating</button>
    </div>
  </div>`;
}

/* -------- someone else's flag (read-only, plus the pro-mode entry point) */
function renderOtherFlag(f) {
  const c = cat(f.cat);
  return `<div class="view">
    ${backHead(f.title, 'goHome')}
    <div class="pro-meta" style="margin-top:8px">
      ${badge('cat', c.icon + ' ' + c.name)} ${badge('open', (f.bidCount || 0) + ' bids')}
      <span>${esc(f.ago || timeAgo(f.createdAt))}</span>
    </div>
    <p class="sub">${esc(f.address || '')}</p>
    <div class="card" style="margin-top:16px">
      <div style="font-weight:700;color:var(--ink);font-size:14px">Posted by ${esc(f.who || 'a neighbor')}</div>
      <p class="sub" style="margin-top:5px">Budget ${esc(f.budget || 'not stated')} · ${esc(f.timing || '')}</p>
    </div>
    <div class="sec">
      <div class="card" style="background:var(--mist);border:0">
        <div style="font-weight:700;color:var(--ink);font-size:14px;margin-bottom:5px">Want to bid on flags like this?</div>
        <p class="sub" style="margin:0 0 12px">Pros pay a flat monthly fee to see and bid on flags in their area. Buyers never pay anything.</p>
        <button class="btn brand sm" data-act="switchPro">Switch to pro mode</button>
      </div>
    </div>

    <div class="sec">
      <button class="btn ghost" data-act="reportFlagModal" data-id="${esc(f.id)}">Report this flag</button>
      ${f.underReview ? `<p class="hint">This flag is hidden while our team reviews a report.</p>` : ''}
    </div>
  </div>`;
}

/* ================================================================ pro profile */
export function renderProProfile(proId) {
  const pro = proById(proId);
  if (!pro) return emptyState('🤷', 'Pro not found', '', 'Back', 'goHome');
  const r = proRating(proId);
  const c = cat(pro.cat);
  const revs = reviewsFor(pro, 5);
  const mine = (state.ratings[proId] || []).map(x => ({ by: 'You', stars: x.stars, when: timeAgo(x.at), text: x.text }));

  const tech = techFor(proId);

  return `<div class="view">
    ${backHead(pro.name, 'goBack')}
    <div class="tech-row" style="margin-top:16px">
      <img class="tech-photo lg" src="${esc(tech.photo)}" alt="${esc(tech.name)}"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tech-photo lg tech-photo-fb',textContent:'${esc(tech.name.slice(0, 1))}'}))">
      <div style="flex:1;min-width:0">
        <div class="pro-nm" style="font-size:18px">${esc(tech.name)}${pro.verified ? VERIF_SVG : ''}</div>
        <div class="pro-meta">${esc(pro.name)}</div>
        <div class="pro-meta">${ratingLine(r.rating, r.reviews)}</div>
        <div class="pro-meta">${esc(c.icon + ' ' + c.name)}</div>
      </div>
    </div>

    ${tech.about ? `<div class="wash" style="margin-top:18px">
      <div class="sec-t" style="margin-bottom:8px">In ${esc(tech.name.split(' ')[0])}'s words</div>
      <p style="margin:0;font-size:14.5px;line-height:1.6;color:var(--ink-2)">${esc(tech.about)}</p>
      ${tech.interests.length ? `<div class="chips" style="margin-top:12px">${
        tech.interests.map(i => `<span class="chip" style="cursor:default">${esc(i)}</span>`).join('')}</div>` : ''}
      ${tech.local ? `<p class="hint" style="margin-top:10px">📍 ${esc(tech.local)}</p>` : ''}
    </div>` : ''}

    <p class="sub" style="margin-top:14px">${esc(pro.blurb)}</p>

    <div class="kpis" style="margin-top:18px">
      <div class="kpi"><b>${pro.jobs ? pro.jobs.toLocaleString('en-US') : '—'}</b><span>jobs</span></div>
      <div class="kpi"><b>${pro.years || '—'}</b><span>years</span></div>
      <div class="kpi"><b>${pro.resp}m</b><span>replies in</span></div>
    </div>

    <div class="card" style="margin-top:12px">
      <div style="display:flex;gap:8px;align-items:center;font-size:13px">
        ${pro.verified ? `${VERIF_SVG}<span><b style="color:var(--ink)">Identity verified</b> by Flagd</span>` : `<span style="color:var(--ink-3)">Not identity-verified yet</span>`}
      </div>
      ${pro.license ? `<div class="pro-meta" style="margin-top:7px">License / DOT: <b style="color:var(--ink)">${esc(pro.license)}</b></div>` : ''}
    </div>

    <div class="sec">
      <div class="sec-t">Reviews</div>
      ${mine.concat(revs).map(rv => `<div class="rev">
        <div class="rev-h">${stars(rv.stars)}<span class="rev-n">${esc(rv.by)}</span><span class="rev-d">${esc(rv.when)}</span></div>
        ${rv.text ? `<p>${esc(rv.text)}</p>` : ''}
      </div>`).join('')}
    </div>
  </div>`;
}

/* ================================================================ account */
export function renderAccount() {
  const mine = myFlags();
  const done = mine.filter(f => f.status === 'done').length;
  const rated = Object.keys(state.ratings).length;
  return `<div class="view">
    <div class="view-head"><h2>Your account</h2></div>
    <div class="pro" style="margin-top:14px">
      ${avatar(state.me.name)}
      <div class="pro-main">
        <div class="pro-nm">${esc(state.me.name)}</div>
        <div class="pro-meta">Buyer account · free forever</div>
      </div>
    </div>
    <div class="kpis" style="margin-top:18px">
      <div class="kpi"><b>${mine.length}</b><span>flags</span></div>
      <div class="kpi"><b>${done}</b><span>closed</span></div>
      <div class="kpi"><b>${rated}</b><span>rated</span></div>
    </div>
    ${state.home ? `<div class="card" style="margin-top:12px"><div class="sec-t" style="margin-bottom:4px">Home location</div><div style="font-size:13.5px;color:var(--ink)">${esc(state.home.label)}</div></div>` : ''}

    <div class="sec">
      <div class="sec-t">Help</div>
      <button class="card tap" style="width:100%;text-align:left;display:block" data-act="goSupport">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="cat-ico">🛟</div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--ink);font-size:14.5px">Help and support</div>
            <div class="pro-meta">Something wrong with a job, a pro, or your account</div>
          </div>
          <span class="cat-go">${icon('go')}</span>
        </div>
      </button>
    </div>

    <div class="sec">
      <div class="sec-t">Why Flagd is free for you</div>
      <div class="card" style="background:var(--mist);border:0">
        <p class="sub" style="margin:0">Professionals and sellers pay a flat monthly subscription to see flags and bid on them. You are never charged a lead fee, a commission, or a booking fee — so the price a pro quotes you is the price.</p>
      </div>
      <button class="btn ghost" style="margin-top:10px" data-act="switchPro">I'm a pro — show me plans</button>
    </div>

    ${paymentMethodSection()}

    ${buyerRewardsSection()}

    ${mapProviderSection()}

    <div class="sec">
      <div class="sec-t">Demo controls</div>
      <p class="hint" style="margin-bottom:10px">This prototype stores everything in your browser. Nothing is sent anywhere.</p>
      <button class="btn danger" data-act="resetDemo">Reset the demo</button>
    </div>
  </div>`;
}

/* -------- payment method */
function paymentMethodSection() {
  const card = savedCard();
  return `<div class="sec">
    <div class="sec-t">Payment method</div>
    <div class="card">
      ${card ? `
        <div style="display:flex;align-items:center;gap:12px">
          <div class="cat-ico">💳</div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--ink);font-size:15px">${esc(card.brand)} ···· ${esc(card.last4)}</div>
            <div class="pro-meta">Expires ${esc(String(card.expMonth).padStart(2, '0'))}/${esc(String(card.expYear).slice(-2))}</div>
          </div>
        </div>
        <button class="btn ghost sm" style="margin-top:12px" data-act="removeCard">Remove</button>
      ` : `
        <p class="sub" style="margin:0 0 12px">No card on file. You will be asked for one when you hire someone.</p>
        <button class="btn" data-act="addCard">Add a payment method</button>
      `}
      <p class="hint" style="margin-top:12px">Your card is reserved when you hire and charged only once you confirm the work is done. Flagd takes no commission — the pro receives the full quoted amount.</p>
    </div>
  </div>`;
}

/* -------- buyer standing
 * Buyers never pay, so the reward is reputation, not money. It is worth something
 * real: pros can see it, and a higher tier lifts your flag in their feed — because
 * a pro would rather spend a paid unlock on someone with a record of closing.
 */
function buyerRewardsSection() {
  const r = rewardsSummary();
  const pct = r.next
    ? Math.round(((r.points - r.tier.min) / (r.next.tier.min - r.tier.min)) * 100)
    : 100;
  const led = buyerLedger().slice(0, 5);

  return `<div class="sec">
    <div class="sec-t">Your standing</div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="tier-dot t-${esc(r.tier.id)}"></span>
            <span style="font-family:var(--display);font-weight:700;font-size:19px;color:var(--ink);letter-spacing:-.03em">${esc(r.tier.label)}</span>
          </div>
          <div class="pro-meta">${r.points} points</div>
        </div>
        <div class="price">${r.completed}<small>job${r.completed === 1 ? '' : 's'} closed</small></div>
      </div>

      <div class="meter" style="margin-top:14px"><i style="width:${pct}%"></i></div>
      <p class="hint">${r.next
        ? `${r.next.need} more points to reach ${esc(r.next.tier.label)}`
        : 'Top tier reached.'}</p>

      <div class="chips" style="margin-top:12px">
        ${r.tier.perks.map(p => `<span class="chip" style="cursor:default">${esc(p)}</span>`).join('')}
      </div>
    </div>

    <div class="card flat">
      <div class="sec-t" style="margin-bottom:8px">How you earn</div>
      <div class="kv"><span>Confirm a job done</span><b>+50</b></div>
      <div class="kv"><span>Rate the pro</span><b>+20</b></div>
      <div class="kv"><span>Write a review</span><b>+10</b></div>
      <div class="kv"><span>Abandon a flag pros bid on</span><b>−15</b></div>
      <p class="hint" style="margin-top:10px">Nothing is earned for posting a flag. Pros pay for every lead they open, so points follow real outcomes — not activity.</p>
    </div>

    ${led.length ? `<div class="card">
      <div class="sec-t" style="margin-bottom:6px">Recent</div>
      ${led.map(e => `<div class="kv"><span>${esc(e.label)}</span><b style="color:${e.points < 0 ? '#c62828' : 'var(--forest)'}">${e.points > 0 ? '+' : ''}${e.points}</b></div>`).join('')}
    </div>` : ''}
  </div>`;
}

/* -------- map provider / Google Maps key */
function mapProviderSection() {
  const google = usingGoogle();
  return `<div class="sec">
    <div class="sec-t">Map provider</div>
    <div class="card">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:700;color:var(--ink);font-size:15px">
            ${google ? 'Google Maps' : 'OpenStreetMap (fallback)'}
          </div>
          <div class="pro-meta">${google
            ? 'Maps, Places autocomplete and geocoding are live.'
            : 'No Google Maps key set. Addresses and coverage are weaker than Google.'}</div>
        </div>
        ${google ? badge('open', 'Active') : badge('done', 'Fallback')}
      </div>
      <div style="margin-top:14px">
        <button class="btn ${google ? 'ghost' : ''}" data-act="mapKeyModal">
          ${google ? 'Change or remove the key' : 'Add a Google Maps key'}
        </button>
      </div>
    </div>
    <p class="hint">Flagd is built for Google Maps — US house-number coverage and Places autocomplete are much stronger than OpenStreetMap's. The key stays in this browser; it is never sent anywhere but Google.</p>
  </div>`;
}

/* ================================================================ actions */
function setPlacingBar(on, text) {
  const bar = document.getElementById('placingBar');
  if (!bar) return;
  bar.hidden = !on;
  if (on && text) document.getElementById('placingText').textContent = text;
}

function beginPlacing(catKey) {
  pending = { catKey, ll: null, address: '' };
  const c = cat(catKey);
  setPlacingBar(true, `Tap the map to drop your ${c.name.toLowerCase()} flag`);
  gmap.startPlacing(catKey, async (ll) => {
    setPlacingBar(false);
    pending.ll = ll;
    go('intake');
    const a = await reverse(ll[0], ll[1]);
    if (pending && pending.ll === ll) {
      pending.address = a.label;
      const el = document.getElementById('fAddr');
      if (el && !el.value) el.value = a.label;
      const zip = document.getElementById('fZip');
      if (zip && !zip.value && a.zip) zip.value = a.zip;
      const hint = document.getElementById('addrHint');
      if (hint && a.short) hint.textContent = `Pin dropped in ${a.short}. Pros only see your neighborhood until you hire one.`;
    }
  });
}

actions({
  goHome: () => go('home'),
  goBack: () => back('home'),
  goMyFlags: () => go('myflags'),

  startFlag: () => go('picker'),

  catTab: (el) => { setUI({ catTab: el.dataset.tab }); render(); },

  pickCat: (el) => beginPlacing(el.dataset.cat),

  cancelFlag: () => {
    pending = null;
    gmap.stopPlacing();
    setPlacingBar(false);
    go('home');
  },

  cancelPlacing: () => {
    pending = null;
    gmap.stopPlacing();
    setPlacingBar(false);
    go('picker');
  },

  submitFlag: () => {
    if (!pending || !pending.ll) { toast('Drop the pin on the map first'); return; }
    const title = val('fTitle') || `${cat(pending.catKey).name} needed`;
    const chips = chipsOn('fChips');
    const extra = {};
    (EXTRA_FIELDS[pending.catKey] || []).forEach(f => { extra[f.id] = val('x_' + f.id); });
    const min = val('fMin'), max = val('fMax');
    const budget = min && max ? `${money(min)}–${money(max)}` : min ? `${money(min)}+` : max ? `up to ${money(max)}` : '';
    const unit = val('fUnit');
    const addr = [val('fAddr'), unit].filter(Boolean).join(', ');

    const flag = addFlag({
      cat: pending.catKey,
      ll: pending.ll,
      title,
      desc: val('fDesc'),
      chips,
      extra,
      budget,
      timing: val('fTiming'),
      address: addr || pending.address,
    });

    pending = null;
    go('flag', { id: flag.id });
    toast('Flag planted — alerting pros in range');
    // Start the bids first: a hiccup in the map must never cost the user their leads.
    simulateBids(flag, () => { if (document.getElementById('panelBody')) render(); });
    try {
      gmap.renderFlags(null, true);
      gmap.focusFlag(flag.id);
    } catch (e) {
      console.warn('[flagd] could not centre the map on the new flag', e);
    }
  },

  openFlag: (el) => {
    const id = el.dataset.id;
    go(state.mode === 'pro' && !flagById(id).mine ? 'proFlag' : 'flag', { id });
    gmap.focusFlag(id);
  },

  focusFlag: (el) => gmap.focusFlag(el.dataset.id, 16),

  openPro: (el) => go('pro', { id: el.dataset.pro }),

  sortBids: (el) => { setUI({ bidSort: el.dataset.s }); render(); },
  minRating: (el) => { setUI({ minRating: Number(el.dataset.r) }); render(); },

  completeJob: (el) => {
    const id = el.dataset.id;
    completeJob(id);
    const f = flagById(id);
    const bid = bidsFor(id).find(b => b.id === f.hiredBidId);
    // Rewards vest here — on the customer confirming the work happened — and
    // deliberately not at the moment the offer was accepted.
    const award = onJobCompleted(id, bid ? bid.proId : null);

    // Confirming completion is what releases the escrow. Nothing else does.
    releaseOnCompletion(id).then(res => {
      render();
      if (res.ok) toast('Payment released to the pro');
      else if (res.why === 'PRO_NOT_ONBOARDED') {
        toast('Held — the pro still needs to finish payout setup');
      }
    });

    render();
    if (award.buyer) toast(`+${award.buyer.points} points for confirming the job`);
    if (bid) setTimeout(() => openRateModal(id, bid.proId), 350);
  },

  rateModal: (el) => openRateModal(el.dataset.flag, el.dataset.pro),

  submitRating: (el) => {
    const stars5 = Number(val('rateStars'));
    if (!stars5) { toast('Pick a star rating first'); return; }
    const text = val('rateText');
    submitRating(el.dataset.flag, el.dataset.pro, stars5, text);
    const res = onRated(el.dataset.flag, el.dataset.pro, stars5, !!text.trim());
    closeModal();
    render();
    toast(text.trim() ? `Thanks — +30 points for a written review` : 'Thanks — +20 points');
  },

  deleteFlag: (el) => {
    const id = el.dataset.id;
    openModal(`<h3 style="font-size:18px;margin-bottom:6px">Take this flag down?</h3>
      <p class="sub">Bids and messages on it will be removed. This cannot be undone.</p>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Keep it</button>
        <button class="btn" style="background:#c0392b" data-act="confirmDelete" data-id="${esc(id)}">Take it down</button>
      </div>`);
  },

  confirmDelete: (el) => {
    deleteFlag(el.dataset.id).then(res => {
      closeModal();
      if (!res.ok) { toast(res.why); return; }
      gmap.renderFlags(null, true);
      go('home');
      toast('Flag deleted');
    });
  },

  togglePause: (el) => {
    const f = flagById(el.dataset.id);
    pauseFlag(f.id, f.status !== 'paused');
    gmap.renderFlags(null, true);
    render();
    toast(f.status === 'paused' ? 'Paused — pros can no longer see it' : 'Live again');
  },

  editFlagModal: (el) => {
    const f = flagById(el.dataset.id);
    if (!f) return;
    openModal(`
      <h3 style="margin-bottom:6px">Edit your flag</h3>
      <p class="sub" style="margin-bottom:2px">${bidsFor(f.id).length
        ? 'Pros who already quoted will be told what changed, so they can revise.'
        : 'No one has quoted yet, so this is a clean edit.'}</p>
      <label class="fl" for="edTitle">Summary</label>
      <input class="inp" id="edTitle" value="${esc(f.title)}" />
      <label class="fl" for="edDesc">Description</label>
      <textarea class="inp" id="edDesc">${esc(f.desc || '')}</textarea>
      <label class="fl" for="edBudget">Budget</label>
      <input class="inp" id="edBudget" value="${esc(f.budget || '')}" placeholder="e.g. $400–900" />
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn" data-act="saveFlagEdit" data-id="${esc(f.id)}">Save changes</button>
      </div>`);
  },

  saveFlagEdit: (el) => {
    const res = editFlag(el.dataset.id, {
      title: val('edTitle'),
      desc: val('edDesc'),
      budget: val('edBudget'),
    });
    closeModal();
    render();
    toast(res.notified ? `Updated — ${res.notified} pro${res.notified === 1 ? '' : 's'} notified` : 'Updated');
  },

  closeFlagModal: (el) => {
    openModal(`
      <h3 style="margin-bottom:6px">Close this flag</h3>
      <p class="sub" style="margin-bottom:2px">Why are you closing it? This is the only way we learn whether Flagd actually worked for you.</p>
      <label class="fl" for="clReason">Reason</label>
      <select class="inp" id="clReason">
        ${Object.values(CLOSE_REASONS).map(r => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join('')}
      </select>
      <label class="fl" for="clNote">Anything to add <span class="opt">(optional)</span></label>
      <textarea class="inp" id="clNote" placeholder="Helps us fix what went wrong."></textarea>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn" data-act="confirmCloseFlag" data-id="${esc(el.dataset.id)}">Close it</button>
      </div>`);
  },

  confirmCloseFlag: (el) => {
    const res = closeFlag(el.dataset.id, val('clReason'), val('clNote'));
    closeModal();
    gmap.renderFlags(null, true);
    render();
    toast(res && res.notified ? `Closed — ${res.notified} pro${res.notified === 1 ? '' : 's'} told` : 'Closed');
  },

  repostFlag: (el) => {
    const copy = repostFlag(el.dataset.id);
    gmap.renderFlags(null, true);
    go('flag', { id: copy.id });
    toast('Posted again — pros in range are being alerted');
    simulateBids(copy, () => { if (document.getElementById('panelBody')) render(); });
  },

  cancelBookingModal: (el) => {
    openModal(`
      <h3 style="margin-bottom:6px">Cancel this booking?</h3>
      <p class="sub">The hold on your card is released and the pro is told. Your flag goes back to taking bids.</p>
      <label class="fl" for="cbWhy">Reason <span class="opt">(shared with the pro)</span></label>
      <input class="inp" id="cbWhy" placeholder="e.g. Plans changed" />
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Keep it</button>
        <button class="btn" style="background:#c0392b" data-act="confirmCancelBooking" data-id="${esc(el.dataset.id)}">Cancel booking</button>
      </div>`);
  },

  confirmCancelBooking: (el) => {
    const why = val('cbWhy');
    cancelBooking(el.dataset.id, why).then(res => {
      closeModal();
      render();
      toast(res.ok ? (res.refunded ? 'Cancelled — hold released' : 'Cancelled') : res.why);
    });
  },

  reportFlagModal: (el) => {
    openModal(`
      <h3 style="margin-bottom:6px">Report this flag</h3>
      <p class="sub" style="margin-bottom:2px">Tell us what is wrong with it. Safety reports hide the flag immediately while a person reviews it.</p>
      <label class="fl" for="rpReason">What is wrong?</label>
      <select class="inp" id="rpReason">
        ${Object.values(REPORT_REASONS).map(r => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join('')}
      </select>
      <label class="fl" for="rpNote">Details <span class="opt">(optional)</span></label>
      <textarea class="inp" id="rpNote"></textarea>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn" data-act="confirmReport" data-id="${esc(el.dataset.id)}">Send report</button>
      </div>`);
  },

  confirmReport: (el) => {
    const res = reportFlag(el.dataset.id, val('rpReason'), val('rpNote'));
    closeModal();
    gmap.renderFlags(null, true);
    render();
    toast(res && res.hidden
      ? 'Reported and hidden pending review'
      : 'Reported — thank you, we will look at it');
  },

  mapKeyModal: () => {
    const on = usingGoogle();
    openModal(`
      <h3 style="margin-bottom:8px">${on ? 'Google Maps key' : 'Connect Google Maps'}</h3>
      <p class="sub" style="margin-bottom:2px">Paste a Maps JavaScript API key. It is stored in this browser only and used directly against Google — Flagd never sends it anywhere else.</p>
      <label class="fl" for="gmapsKey">API key</label>
      <input class="inp" id="gmapsKey" placeholder="AIza…" autocomplete="off" spellcheck="false" />
      <p class="hint">In Google Cloud Console: enable <b>Maps JavaScript API</b>, <b>Places API</b> and <b>Geocoding API</b>, then restrict the key by HTTP referrer to the domains you serve Flagd from. A browser key is always visible in page source — the referrer restriction is what protects it, not secrecy.</p>
      <div class="btn-row" style="margin-top:20px">
        ${on ? `<button class="btn ghost" data-act="clearMapKey">Remove key</button>`
             : `<button class="btn ghost" data-act="closeModal">Cancel</button>`}
        <button class="btn" data-act="saveMapKey">Save and reload</button>
      </div>`);
    setTimeout(() => { const f = document.getElementById('gmapsKey'); if (f) f.focus(); }, 60);
  },

  saveMapKey: () => {
    const key = val('gmapsKey');
    if (key.length < 20) { toast('That does not look like a Maps API key'); return; }
    setGoogleKey(key);
    toast('Key saved — reloading on Google Maps');
    setTimeout(() => location.reload(), 700);
  },

  clearMapKey: () => {
    setGoogleKey('');
    toast('Key removed — reloading on the fallback map');
    setTimeout(() => location.reload(), 700);
  },

  resetDemo: () => {
    openModal(`<h3 style="font-size:18px;margin-bottom:6px">Reset the demo?</h3>
      <p class="sub">Clears your flags, bids, chats and ratings from this browser and reloads.</p>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn" style="background:#c0392b" data-act="confirmReset">Reset</button>
      </div>`);
  },
});

function openRateModal(flagId, proId) {
  const pro = proById(proId);
  openModal(`
    <h3 style="font-size:19px;margin-bottom:4px">Rate ${esc(pro.name)}</h3>
    <p class="sub" style="text-align:center;margin-bottom:2px">Ratings are the whole filter. Be honest.</p>
    ${starPicker('rateStars', 0)}
    <label class="fl" for="rateText">Add a review <span class="opt">(optional)</span></label>
    <textarea class="inp" id="rateText" placeholder="Showed up on time, price matched the quote…"></textarea>
    <div class="btn-row" style="margin-top:18px">
      <button class="btn ghost" data-act="closeModal">Later</button>
      <button class="btn brand" data-act="submitRating" data-flag="${esc(flagId)}" data-pro="${esc(proId)}">Post rating</button>
    </div>`);
}

export { pending, setPlacingBar };
