// pro.js — the paying side of the marketplace. Pros subscribe, see flags in range,
// unlock leads against their monthly allowance, and bid. Buyers are never charged.

import { CATEGORIES, cat, PROS, PLANS, proById, DEFAULT_CENTER, PROFILE_PROMPTS } from './data.js';
import {
  state, flagById, bidsFor, myPlan, leadsLeft, hasUnlocked, unlockLead, setPlan,
  myProProfile, setMode, proRating, getThread, pushMsg, commit, proOverrides, saveProProfile, grantUnlock,
} from './store.js';
import {
  esc, money, avatar, ratingLine, badge, backHead, toast, actions, openModal, closeModal,
  val, emptyState, timeAgo, miles, VERIF_SVG, icon,
} from './ui.js';
import { go, render } from './router.js';
import * as gmap from './map.js';
import { distance } from './geo.js';
import { proSendBid, priceHintFor } from './deals.js';
import { techFor } from './dispatch.js';
import { spendCredit, proRewardsSummary, proLedger, PRO_TIERS, nextTier, onResponded } from './rewards.js';

const proBase = () => (state.home ? state.home.ll : DEFAULT_CENTER);

/** Flags this pro is allowed to see: right category-kind, inside the plan radius, still open. */
export function feedFlags() {
  const me = myProProfile();
  const radiusM = myPlan().radius * 1609.34;
  const base = proBase();
  return state.flags
    .filter(f => f.status === 'open' && !f.mine)
    .filter(f => f.cat === me.cat || CATEGORIES[f.cat].kind === CATEGORIES[me.cat].kind)
    .map(f => ({ f, d: distance(base, f.ll) }))
    .filter(x => x.d <= radiusM)
    .sort((a, b) => (a.f.cat === me.cat ? -1 : 1) - (b.f.cat === me.cat ? -1 : 1) || a.d - b.d);
}

/* ================================================================ feed */
export function renderProFeed() {
  const me = myProProfile();
  const plan = myPlan();
  const left = leadsLeft();
  const rows = feedFlags();
  const r = proRating(me.id);
  const sent = state.pro.bidsSent.length;

  const capLine = left === Infinity
    ? 'Unlimited lead unlocks'
    : `${left} of ${plan.leads} lead unlocks left this month`;
  const pct = left === Infinity ? 100 : Math.round((left / plan.leads) * 100);

  return `<div class="view" style="padding-bottom:10px">
    <div class="view-head"><h2>Live flags near you</h2></div>
    <p class="sub">You are signed in as <b style="color:var(--ink)">${esc(me.name)}</b> — ${esc(cat(me.cat).name)}, ${plan.radius}-mile radius.</p>

    <div class="card" style="margin-top:14px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-weight:700;color:var(--ink);font-size:14px">${esc(plan.name)} plan</div>
          <div class="pro-meta">${esc(capLine)}</div>
        </div>
        <button class="btn ghost sm" data-act="goPlans">${plan.id === 'plus' ? 'Manage' : 'Upgrade'}</button>
      </div>
      <div class="meter"><i style="width:${pct}%"></i></div>
    </div>

    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><b>${rows.length}</b><span>in range</span></div>
      <div class="kpi"><b>${sent}</b><span>bids sent</span></div>
      <div class="kpi"><b>${r.rating.toFixed(1)}</b><span>your rating</span></div>
    </div>
  </div>

  ${rows.length
    ? rows.map(({ f, d }) => leadRow(f, d, me)).join('')
    : emptyState('📡', 'No flags in range right now', `Nothing open within ${plan.radius} miles for ${cat(me.cat).name.toLowerCase()}. A wider radius comes with the higher plans.`, 'See plans', 'goPlans')}

  <div class="view" style="padding-top:6px">
    <p class="hint">Flagd charges pros a flat monthly subscription — never a percentage of the job and never a per-lead surcharge. What you quote is what you keep.</p>
  </div>`;
}

function leadRow(f, d, me) {
  const c = cat(f.cat);
  const open = hasUnlocked(f.id);
  const alreadyBid = state.pro.bidsSent.includes(f.id);
  const match = f.cat === me.cat;

  return `<div class="card tap" style="margin:0 18px 10px" data-act="openProFlag" data-id="${esc(f.id)}">
    <div style="display:flex;gap:11px;align-items:flex-start">
      <div class="cat-ico">${c.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--ink);font-size:14px;line-height:1.3">${esc(f.title)}</div>
        <div class="pro-meta">
          ${match ? badge('new', 'Your trade') : badge('cat', c.name)}
          <span>${esc(miles(d))}</span>
          <span>${esc(f.ago || timeAgo(f.createdAt))}</span>
        </div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-top:11px;padding-top:11px;border-top:1px solid var(--mist-2)">
      <div style="flex:1;font-size:12.5px;color:var(--ink-3)">
        ${open ? esc(f.address || 'Address unlocked') : 'Address hidden until unlocked'}
        · <b style="color:var(--ink)">${f.bidCount || 0}</b> bids
      </div>
      ${alreadyBid ? badge('hired', 'Bid sent') : open ? badge('open', 'Unlocked') : `<span class="badge b-cat">🔒 Locked</span>`}
    </div>
  </div>`;
}

/* ================================================================ one lead */
export function renderProFlag(id) {
  const f = flagById(id);
  if (!f) return emptyState('🤷', 'Flag not found', '', 'Back to feed', 'goFeed');
  const me = myProProfile();
  const c = cat(f.cat);
  const open = hasUnlocked(f.id);
  const alreadyBid = state.pro.bidsSent.includes(f.id);
  const d = distance(proBase(), f.ll);
  const [lo, hi] = priceHintFor(f);

  if (!open) {
    const left = leadsLeft();
    return `<div class="view">
      ${backHead(f.title, 'goFeed')}
      <div class="pro-meta" style="margin-top:8px">${badge('cat', c.icon + ' ' + c.name)}<span>${esc(miles(d))} away</span><span>${esc(f.ago || timeAgo(f.createdAt))}</span></div>

      <div class="card" style="margin-top:16px;text-align:center;padding:24px">
        <div style="font-size:30px;margin-bottom:8px">🔒</div>
        <h3 style="font-size:16px;margin-bottom:6px">Unlock this lead</h3>
        <p class="sub" style="margin:0 0 4px">You will see the full description, the exact address, the budget and the buyer's chat.</p>
        <p class="hint" style="margin-bottom:16px">${left === Infinity ? 'Unlimited unlocks on your plan.' : `${left} unlock${left === 1 ? '' : 's'} left this month.`}</p>
        ${left > 0
          ? `<button class="btn brand" data-act="unlockLead" data-id="${esc(f.id)}">Unlock lead</button>`
          : `<button class="btn brand" data-act="goPlans">Out of unlocks — upgrade</button>`}
      </div>

      <div class="sec">
        <div class="sec-t">What you can see for free</div>
        <div class="card">
          <div class="pro-meta"><span>Category</span></div><div style="color:var(--ink);font-weight:600">${esc(c.name)}</div>
          <div class="pro-meta" style="margin-top:9px"><span>Neighborhood</span></div><div style="color:var(--ink);font-weight:600">${esc((f.address || '').split(',').slice(-3).join(',').trim() || 'In range')}</div>
          <div class="pro-meta" style="margin-top:9px"><span>Competition</span></div><div style="color:var(--ink);font-weight:600">${f.bidCount || 0} bids so far</div>
        </div>
      </div>
    </div>`;
  }

  return `<div class="view">
    ${backHead(f.title, 'goFeed')}
    <div class="pro-meta" style="margin-top:8px">${badge('cat', c.icon + ' ' + c.name)}<span>${esc(miles(d))} away</span><span>${esc(f.ago || timeAgo(f.createdAt))}</span></div>
    <p class="sub">${esc(f.address || '')}</p>
    ${f.chips && f.chips.length ? `<div class="chips" style="margin-top:12px">${f.chips.map(x => `<span class="chip on" style="cursor:default">${esc(x)}</span>`).join('')}</div>` : ''}
    ${f.desc ? `<div class="quote">${esc(f.desc)}</div>` : ''}

    <div class="card" style="margin-top:14px">
      <div class="pro-meta"><span>Posted by</span></div>
      <div style="color:var(--ink);font-weight:600">${esc(f.who || 'Buyer')}</div>
      <div class="pro-meta" style="margin-top:9px"><span>Budget</span></div>
      <div style="color:var(--ink);font-weight:600">${esc(f.budget || 'Not stated')}</div>
      <div class="pro-meta" style="margin-top:9px"><span>Timing</span></div>
      <div style="color:var(--ink);font-weight:600">${esc(f.timing || 'Flexible')}</div>
    </div>

    ${alreadyBid
      ? `<div class="sec"><div class="waiting" style="background:#e9efff;color:#2d4fd6"><b>Bid sent.</b> You will get a notification if they reply.</div>
         <button class="btn ghost" style="margin-top:10px" data-act="openThread" data-flag="${esc(f.id)}" data-pro="${esc(me.id)}">Open the chat</button></div>`
      : `<div class="sec">
      <div class="sec-t">Your bid</div>
      <p class="hint" style="margin-bottom:8px">Similar jobs in this area close between <b>${money(lo)}</b> and <b>${money(hi)}</b>.</p>
      <input class="inp" id="pbPrice" type="number" inputmode="numeric" placeholder="Your price in USD" />
      <label class="fl" for="pbNote">What it covers</label>
      <textarea class="inp" id="pbNote" placeholder="Parts, labor, warranty, how soon you can be there…"></textarea>
      <button class="btn brand" style="margin-top:14px" data-act="sendProBid" data-id="${esc(f.id)}">Send bid</button>
      <p class="hint" style="text-align:center;margin-top:8px">No commission. Flagd takes nothing from this job.</p>
    </div>`}
  </div>`;
}

/* ================================================================ plans */
export function renderPlans() {
  const current = myPlan();
  return `<div class="view">
    ${backHead('Plans for pros', 'goFeed', 'Buyers use Flagd free. Pros pay a flat monthly fee — no commission, no per-lead charges, cancel anytime.')}

    <div class="sec">
      ${PLANS.map(p => `<button class="plan ${p.id === current.id ? 'pick' : ''}" data-act="choosePlan" data-plan="${esc(p.id)}">
        ${p.tag ? `<span class="plan-tag">${esc(p.tag)}</span>` : ''}
        <div class="plan-nm">${esc(p.name)}</div>
        <div class="plan-p">${p.price === 0 ? 'Free' : '$' + p.price}<span>${p.price === 0 ? ' for 30 days' : '/month'}</span></div>
        <ul>${p.perks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        ${p.id === current.id ? `<div class="pro-meta" style="margin-top:10px"><b style="color:var(--ink)">Current plan</b></div>` : ''}
      </button>`).join('')}
    </div>

    <div class="sec">
      <div class="sec-t">What a lead unlock buys</div>
      <div class="card" style="background:var(--mist);border:0">
        <p class="sub" style="margin:0">One unlock reveals a buyer's full request, exact address and direct chat. If you win the job, you keep 100% of it — Flagd never touches the money.</p>
      </div>
    </div>

    <p class="hint" style="text-align:center">Demo only — no payment is collected and no card is stored.</p>
  </div>`;
}

/* ================================================================ pro account */
export function renderProAccount() {
  const me = myProProfile();
  const r = proRating(me.id);
  const plan = myPlan();
  const c = cat(me.cat);
  const tech = techFor(me.id);

  return `<div class="view">
    <div class="view-head"><h2>Your pro profile</h2></div>
    <div class="tech-row" style="margin-top:16px">
      <img class="tech-photo lg" src="${esc(tech.photo)}" alt="${esc(tech.name)}"
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tech-photo lg tech-photo-fb',textContent:'${esc(tech.name.slice(0, 1))}'}))">
      <div style="flex:1;min-width:0">
        <div class="pro-nm" style="font-size:18px">${esc(tech.name)}${me.verified ? VERIF_SVG : ''}</div>
        <div class="pro-meta">${esc(me.name)}</div>
        <div class="pro-meta">${ratingLine(r.rating, r.reviews)}</div>
        <div class="pro-meta">${esc(c.icon + ' ' + c.name)}${me.license ? ' · ' + esc(me.license) : ''}</div>
      </div>
    </div>

    <div class="kpis" style="margin-top:18px">
      <div class="kpi"><b>${me.jobs.toLocaleString('en-US')}</b><span>jobs</span></div>
      <div class="kpi"><b>${state.pro.bidsSent.length}</b><span>bids sent</span></div>
      <div class="kpi"><b>${state.pro.leadsUsed}</b><span>leads used</span></div>
    </div>

    ${profileEditor(me, tech)}

    <div class="sec">
      <div class="sec-t">Earned credits</div>
      ${proRewardsCard(me)}
    </div>

    <div class="sec">
      <div class="sec-t">Subscription</div>
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="flex:1">
            <div style="font-weight:700;color:var(--ink);font-size:15px">${esc(plan.name)}</div>
            <div class="pro-meta">${plan.price === 0 ? 'Free trial' : '$' + plan.price + '/month'} · ${plan.radius}-mile radius</div>
          </div>
          <button class="btn ghost sm" data-act="goPlans">Change</button>
        </div>
      </div>
    </div>

    <div class="sec">
      <div class="sec-t">Try a different trade</div>
      <p class="hint" style="margin-bottom:9px">Demo control — swap which pro account you are signed in as to see the feed from another trade.</p>
      <select class="inp" data-chg="switchProfile">
        ${PROS.map(p => `<option value="${esc(p.id)}" ${p.id === me.id ? 'selected' : ''}>${esc(p.name)} — ${esc(cat(p.cat).name)}</option>`).join('')}
      </select>
    </div>

    <div class="sec">
      <div class="sec-t">Help</div>
      <button class="card tap" style="width:100%;text-align:left;display:block" data-act="goSupport">
        <div style="display:flex;align-items:center;gap:12px">
          <div class="cat-ico">🛟</div>
          <div style="flex:1">
            <div style="font-weight:700;color:var(--ink);font-size:14.5px">Help and support</div>
            <div class="pro-meta">Junk leads, no-shows, reviews, billing</div>
          </div>
          <span class="cat-go">${icon('go')}</span>
        </div>
      </button>
    </div>

    <button class="btn ghost" style="margin-top:20px" data-act="switchBuyer">Switch back to buyer mode</button>
  </div>`;
}

/* -------- earned credits
 * The pro side of the reward system is economic, because that is what a paying
 * subscriber responds to. One credit = one lead unlock, spent before the monthly
 * allowance. It costs the platform nothing marginal and it rewards exactly the
 * behaviour buyers care about: answer fast, finish the job, earn the rating.
 */
function proRewardsCard(me) {
  const r = proRewardsSummary(me.id);
  const pct = r.next
    ? Math.round(((r.score - r.tier.min) / (r.next.tier.min - r.tier.min)) * 100)
    : 100;
  const led = proLedger(me.id).slice(0, 5);

  return `<div class="card">
    <div style="display:flex;align-items:center;gap:12px">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="tier-dot t-${esc(r.tier.id)}"></span>
          <span style="font-family:var(--display);font-weight:700;font-size:19px;color:var(--ink);letter-spacing:-.03em">${esc(r.tier.label)}</span>
        </div>
        <div class="pro-meta">${r.completed} job${r.completed === 1 ? '' : 's'} completed · ${r.fiveStars} five-star rating${r.fiveStars === 1 ? '' : 's'}</div>
      </div>
      <div class="price">${r.credits}<small>credits</small></div>
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
    <div class="sec-t" style="margin-bottom:8px">How you earn credits</div>
    <div class="kv"><span>Job completed</span><b>+2 credits</b></div>
    <div class="kv"><span>First reply under 15 min</span><b>+1 credit</b></div>
    <div class="kv"><span>5-star rating</span><b>+1 credit</b></div>
    <div class="kv"><span>5 jobs in a month</span><b>+5 credits</b></div>
    <div class="kv"><span>Rating of 2 stars or below</span><b>−2 credits</b></div>
    <p class="hint" style="margin-top:10px">Credits are spent before your monthly allowance. Rewards only count once the customer confirms the job was done — accepting a quote is not enough.</p>
  </div>

  ${led.length ? `<div class="card">
    <div class="sec-t" style="margin-bottom:6px">Recent</div>
    ${led.map(e => `<div class="kv"><span>${esc(e.label)}</span><b style="color:${e.credits < 0 ? '#c62828' : 'var(--forest)'}">${e.credits > 0 ? '+' : ''}${e.credits}</b></div>`).join('')}
  </div>` : ''}`;
}

/* -------- the human part of the profile
 * Customers decide from this, not from the licence number. It is also what goes
 * out in the "on the way" text, so it is worth asking for properly. */
function profileEditor(me, tech) {
  const P = PROFILE_PROMPTS;
  return `<div class="sec">
    <div class="sec-t">How customers see you</div>
    <div class="wash">
      <p class="sub" style="margin:0 0 4px">People let you into their home. A photo and a couple of real sentences do more for your booking rate than anything else on this page.</p>
    </div>

    <label class="fl">Your photo</label>
    <div class="tech-row" style="margin-bottom:4px">
      <img class="tech-photo" src="${esc(tech.photo)}" alt=""
           onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'tech-photo tech-photo-fb',textContent:'${esc(tech.name.slice(0, 1))}'}))">
      <div style="flex:1">
        <input type="file" id="proPhotoFile" accept="image/*" data-chg="uploadPhoto" style="display:none">
        <button class="btn ghost sm" data-act="pickPhoto">Upload a photo</button>
        ${proOverrides(me.id) && proOverrides(me.id).photo
          ? `<button class="btn ghost sm" style="margin-left:8px" data-act="clearPhoto">Remove</button>` : ''}
        <p class="hint" style="margin-top:7px">A clear photo of your face, in work clothes. Customers get this by text before you arrive.</p>
      </div>
    </div>

    <label class="fl" for="pfName">Name customers see at the door</label>
    <input class="inp" id="pfName" value="${esc(tech.name)}" placeholder="e.g. Ray Delgado" />

    <label class="fl" for="pfAbout">${esc(P.about.label)}</label>
    <textarea class="inp" id="pfAbout" style="min-height:120px" placeholder="${esc(P.about.ph)}">${esc(tech.about)}</textarea>
    <p class="hint">${esc(P.about.hint)}</p>

    <label class="fl" for="pfInterests">${esc(P.interests.label)}</label>
    <input class="inp" id="pfInterests" value="${esc(tech.interests.join(', '))}" placeholder="${esc(P.interests.ph)}" />
    <p class="hint">${esc(P.interests.hint)}</p>

    <label class="fl" for="pfLocal">${esc(P.local.label)}</label>
    <input class="inp" id="pfLocal" value="${esc(tech.local)}" placeholder="${esc(P.local.ph)}" />

    <button class="btn" style="margin-top:18px" data-act="saveProfile">Save profile</button>
  </div>`;
}

/* ================================================================ actions */
actions({
  pickPhoto: () => { const f = document.getElementById('proPhotoFile'); if (f) f.click(); },

  // Downscaled to 240px and stored as a data URL so it survives in localStorage.
  uploadPhoto: (el) => {
    const file = el.files && el.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('That is not an image'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 240;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        saveProProfile(state.pro.profileId, { photo: canvas.toDataURL('image/jpeg', 0.82) });
        render();
        toast('Photo updated');
      };
      img.onerror = () => toast('Could not read that image');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  },

  clearPhoto: () => {
    saveProProfile(state.pro.profileId, { photo: null });
    render();
    toast('Photo removed');
  },

  saveProfile: () => {
    saveProProfile(state.pro.profileId, {
      owner: val('pfName'),
      about: val('pfAbout'),
      local: val('pfLocal'),
      interests: val('pfInterests').split(',').map(s => s.trim()).filter(Boolean),
    });
    render();
    toast('Profile saved');
  },

  goFeed: () => go('proFeed'),
  goPlans: () => go('proPlans'),
  openProFlag: (el) => { go('proFlag', { id: el.dataset.id }); gmap.focusFlag(el.dataset.id); },

  switchPro: () => { setMode('pro'); go('proFeed'); toast('Pro mode — flags in your area'); },
  switchBuyer: () => { setMode('buyer'); go('home'); toast('Buyer mode'); },

  unlockLead: (el) => {
    const id = el.dataset.id;
    const me = state.pro.profileId;

    // Earned credits are spent before the plan allowance — a pro who performs
    // well should feel the reward immediately, not at renewal.
    if (spendCredit(me, 'Unlocked a lead')) {
      grantUnlock(id);
      render();
      toast('Lead unlocked with an earned credit');
      return;
    }

    if (!unlockLead(id)) {
      toast('No unlocks left on your plan');
      go('proPlans');
      return;
    }
    render();
    toast('Lead unlocked');
  },

  choosePlan: (el) => {
    const id = el.dataset.plan;
    const p = PLANS.find(x => x.id === id);
    if (!p) return;
    openModal(`
      <h3 style="font-size:19px;margin-bottom:6px">Switch to ${esc(p.name)}?</h3>
      <p class="sub">${p.price === 0
        ? 'The free trial gives you 5 lead unlocks and a 10-mile radius for 30 days.'
        : `You would be billed <b>$${p.price}/month</b> for ${p.leads === Infinity ? 'unlimited' : p.leads} lead unlocks and a ${p.radius}-mile radius. Cancel anytime.`}</p>
      <p class="hint" style="margin-top:10px">No card is collected in this demo.</p>
      <div class="btn-row" style="margin-top:18px">
        <button class="btn ghost" data-act="closeModal">Cancel</button>
        <button class="btn brand" data-act="confirmPlan" data-plan="${esc(p.id)}">Switch plan</button>
      </div>`);
  },

  confirmPlan: (el) => {
    setPlan(el.dataset.plan);
    closeModal();
    go('proFeed');
    toast(`You are on the ${myPlan().name} plan`);
  },

  sendProBid: (el) => {
    const id = el.dataset.id;
    const price = Number(val('pbPrice'));
    if (!price || price <= 0) { toast('Enter your price first'); return; }
    const note = val('pbNote');
    const me = myProProfile();
    proSendBid(id, price, note);
    getThread(id, me.id);
    pushMsg(id, me.id, { from: 'sys', text: `You bid ${money(price)} on this flag.` });
    pushMsg(id, me.id, { from: 'me', text: note || `Hi — I can take care of this for ${money(price)}. Happy to answer any questions.` });
    render();
    toast(`Bid sent — ${money(price)}`);
    setTimeout(() => {
      pushMsg(id, me.id, { from: 'them', text: 'Thanks for the quick bid. What is your earliest availability?' });
      render();
    }, 3200);
  },

  switchProfile: (el) => {
    state.pro.profileId = el.value;
    state.pro.unlocked = [];
    state.pro.bidsSent = [];
    state.pro.leadsUsed = 0;
    commit();
    go('proFeed');
    toast('Signed in as ' + proById(el.value).name);
  },
});
