# Flagd

**Plant a flag. Let the pros come to you.**

A reverse marketplace for the US market. Instead of searching a directory and playing
phone tag, you drop a *flag* on the map for the service you need or the item you want
to buy. Verified local pros and sellers in range get alerted, bid with a real price,
and chat with you in the app. You compare on star rating and price, negotiate, hire,
and rate. **Buyers pay nothing. Pros pay a flat monthly subscription.**

This is a working front-end prototype — no backend, no accounts, no payments.
Everything persists to `localStorage` under the key `flagd.v1`.

---

## Run it

```bash
npx --yes http-server flagd -p 8795 -c-1
```

Then open <http://localhost:8795>. There is also a `flagd` entry in
`CLAUDE/.claude/launch.json` for the Claude Code preview pane.

It must be served over HTTP — the app uses ES modules, which `file://` blocks.

---

## What works

### Buyer side (free)
- **Map of live flags** — Leaflet, colour-coded by category, US-centred (Austin, TX).
- **Plant a flag** — pick a category, drop a pin, fill a category-specific intake form.
  Two verticals:
  - *Services* — plumber, electrician, HVAC, handyman, roofer, landscaper, cleaner,
    mover, painter, pest control, appliance repair, auto repair.
  - *Buying something* — car/truck (with make, year range, max mileage), furniture,
    electronics, tools, other.
- **Address handling** — reverse-geocodes the dropped pin into a US street address,
  autofills the ZIP, and offers type-ahead address search (Nominatim, no API key).
- **Bids arrive** with the pro's price, star rating, review count, licence number,
  years in business and typical reply time.
- **Sort and filter bids** by best value, lowest price, top rated, fastest reply, and
  by minimum star rating (4.0+ / 4.5+).
- **Chat** — every bid opens a thread. Ask questions and the pro answers in context
  (scheduling questions get scheduling answers, licence questions get credentials).
- **Negotiate in chat** — send a counter-offer; the pro accepts, splits the difference,
  or holds firm depending on how far below the bid you are.
- **Hire, complete, rate** — hiring declines the other bids; completing prompts a
  1–5 star rating with a review, which is blended into that pro's public rating.
- **Booking confirmation and "on the way" text** — agreeing a price opens a confirm
  step that captures a mobile number and an explicit SMS opt-in. On confirm the
  customer gets the technician's **photo** as an MMS, then a message naming the
  person, the company, the destination address, a short bio in their own voice, a
  tracking link and a number to call. Modelled on the ServiceTitan text.
- **Live tracking** — the tracking screen shows the pro moving toward the job on the
  map with a counting-down ETA, their photo and story, vehicle and plate, licence,
  agreed price, and the texts exactly as they were sent. An arrival text follows.

### The human profile

The single biggest trust lever in the product. A company name and a licence number
do not tell you who is about to walk into your house, so every pro has:

- a **photo** (uploaded in-app, downscaled to 240px and stored as a data URL),
- an **`owner`** — the person who actually shows up, distinct from the company name,
- an **`about`** paragraph written in their own voice: how they got into the trade,
  who is at home,
- a few **interests**, and how long they have been in the area.

The pro-side editor asks for these as questions a person would answer ("Who are you,
how did you get into this work, who is at home?") rather than as form labels, because
that is what gets warm copy back instead of marketing copy. The same `about` text is
what goes out in the arrival SMS.

### Pro side (paid)
- **Lead feed** of open flags within the plan's radius, nearest first, own trade first.
- **Locked leads** — category, neighbourhood and bid count are free; the full request,
  exact address and chat require a lead unlock against the monthly allowance.
- **Bidding** with a market price hint derived from the buyer's stated budget.
- **Plans** — Starter (free trial, 5 unlocks, 10 mi), Pro ($79/mo, 40 unlocks, 25 mi),
  Pro+ ($179/mo, unlimited, 60 mi). No commission and no per-lead surcharge.
- **Profile** with rating, job count and a demo control to sign in as a different trade.

---

## Design language

High-contrast and monochrome, in the vein of Uber's current apps.

- **Black is the only primary.** Chrome, CTAs, active nav, selected chips, stars and
  the verified check are all `#000`. There is exactly one accent — the flag orange
  `#ff4b26` — and it is rationed: the logo mark, unread dots, "live" pulses and the
  glyph inside the FAB. Green appears only as a status (`Taking bids`).
- **The map is nearly greyscale** (`saturate(.18)` on the tile pane) so the
  category-coloured flags are the only chroma on screen. Flag poles are black.
- **Flat surfaces, hairline borders.** Cards are 1px `#e2e2e2` with no shadow;
  elevation is reserved for things that genuinely float — modal, toast, FAB.
  Selection is a 2px black border, never a colour wash.
- **Filled, borderless inputs** on `#f6f6f6` that go white with a black ring on focus.
- **Type**: Inter Tight for display at tight negative tracking (−0.03 to −0.05em),
  Inter for body. Headings are large and heavy; meta text is grey and small.
- **Lists over grids.** The category picker, bid list and lead feed are all single
  column rows — icon tile, bold title, meta, value right-aligned.

### Motion

Lives in `assets/motion.css`, loaded after `styles.css`. The rules:

- **One easing curve** (`--ease`, a decelerating cubic-bezier) for essentially
  everything. `--ease-spring` overshoots slightly and is reserved for things that
  should read as *popping* — a chip toggling on, an offer card arriving.
- **130–340ms.** Fast enough to feel responsive, slow enough to be seen.
- **Every interactive surface answers the pointer**, and separately answers the
  press: hover lifts, `:active` compresses. A control that only responds on hover
  feels unfinished on the way down.
- **Entrance animation fires on view change only** — never on a state repaint.
  `app.js` compares the router key and adds `.entering` for one beat; without that
  guard an arriving bid would re-animate the whole panel under the reader.
- **Lists cascade** at ~30ms per row, capped so a long list still settles quickly.
- **Nothing loops** except the flag wave on the FAB and the "waiting for bids" pulse,
  both of which signal ongoing state.
- **`prefers-reduced-motion` collapses the whole layer** to ~0ms and drops the hover
  transforms. This is a correctness requirement, not a nicety.

Two constraints worth remembering: Google renders map markers as absolutely
positioned `<img>` elements, so their hover affordance is a `filter` change only —
transforming them fights the library. And animations with `fill-mode: both` win over
`:hover` transforms in the cascade, which is why `.entering` is removed after 700ms
rather than left on.

## Payments

**Escrow.** The card is authorised when the buyer hires and released when the buyer
confirms the work is done. That is the whole point — it turns "hired" from a status
label into a commitment. **Flagd takes no commission**: `PLATFORM_FEE_BPS = 0`, the
pro receives the full quoted amount, and the platform absorbs Stripe's ~2.9% + 30¢.
Changing that one constant also means rewriting the promise on the plans page.

Money is integer **cents** throughout. Float arithmetic in a payments ledger is a bug
you find in an angry support ticket.

Details that matter in practice:
- A card authorisation expires after about a week, so a job scheduled beyond
  `AUTH_HOLD_DAYS` is captured immediately and held by the platform instead.
- Release is gated on the pro completing Connect onboarding. If they haven't, the
  money is captured and **held safely** rather than failing into a void.
- Deleting a flag or cancelling a booking while funds are held is refused with a
  reason; cancelling releases the hold first.

**Peer settlement for sell flags.** On a *sell* flag the money runs the other way — a
business pays a private individual — and nobody will complete Stripe KYC to sell one
sofa. So the seller may nominate Zelle / Cash App / Venmo / cash. These are the
dangerous rails: instant, irreversible, no protection, and "just Zelle me" is the most
common marketplace scam there is. Hence the handle is **never shown on the flag or to
bidders** — `revealSettlement()` discloses it to exactly one accepted counterparty,
and the seller is told plainly that Flagd cannot reverse it. Escrow stays the default.

### Why none of this can run here

Stripe needs a server. Creating a PaymentIntent requires the **secret** key, which —
unlike the Maps key — cannot be restricted by referrer, so shipping it would let any
visitor charge and refund at will. Webhooks are the only trustworthy signal that money
moved, and a browser cannot receive them. Connect payouts are server-only.

`gateway` in `js/payments.js` is a simulator with the exact shape of the real adapter,
and `SERVER_CONTRACT` at the bottom of that file lists every endpoint, every webhook
to treat as authoritative, and the obligations that come with holding other people's
money. **There is deliberately no card-number input anywhere in this app** — Stripe
Elements holds the card and Flagd only ever sees a token and the last four digits.

## Managing a flag

A flag is not just a post: pros spent real money to open it. So closing one asks
**why**, and that answer is the difference between "worked" and "wasted everyone's
time" in the funnel. Closing or deleting a flag that has bids notifies those pros and
costs the buyer standing points. Editing notifies anyone who already quoted, with a
list of what changed. Reporting routes into the same case queue as support, one report
per reporter, and anything safety-flavoured hides the flag immediately pending review.

## Support

Three principles, in the order that settles conflicts between them.

1. **Safety is never triaged.** Threats, injury, theft, harassment, discrimination and
   fraud go straight to a person. Nobody in that situation should have to argue with
   an assistant first. Safety signals also beat every competing signal in the
   classifier, so "he was late and then threatened me" routes as safety.
2. **Automate only the reversible.** Refunding a lead unlock, reopening a flag,
   nudging the other party, cancelling a booking — cheap, undoable, safe to get
   wrong. Money disputes, quality disputes and anything where the parties disagree
   about facts are never auto-resolved. Each issue carries an allow-list, and
   `runAction()` refuses anything outside it.
3. **Two-sided cases need two sides.** `decide()` hard-fails on a dispute until both
   accounts are on record. "Fair to both" is a procedure, not a sentiment.

### On "in everyone's best interest"

In a genuine dispute the two parties' interests are opposed — one of them is going to
be disappointed. What the system can honestly promise is a consistent rule, both
accounts heard, and the reasoning shown to both sides.

There is also a structural bias to manage: **pros pay, buyers do not.** That creates
steady quiet pressure to decide for the pro. Every auto-action declares
`favoursPayingSide`, every admin decision records who it favoured, and `biasReport()`
surfaces the split. The number is on the admin screen precisely because it is the one
nobody would otherwise look at.

### The model seam

`askAssistant()` in `js/support.js` is the single function a real build replaces. It
must call **your own server**, never a model API directly from the page: unlike the
Maps key, an LLM key cannot be restricted by referrer, so shipping one here would let
any visitor drain the account. The server is also where the policy prompt, the tool
allow-list and the escalation rules belong — otherwise a user can simply talk the
assistant out of them.

Today it runs a deterministic intent classifier over the real issue catalog. When
confidence is low it asks rather than guesses.

## Rewards

Two-sided and deliberately asymmetric, because the sides want different things and
only one of them costs money.

**Buyers earn standing.** Points and tiers (New → Trusted → Verified → Gold), a badge
pros can see, and priority placement in pro feeds. Costs nothing, and it buys the
thing the marketplace most lacks: confirmed outcomes. It is also genuinely useful to
pros, who would rather spend a paid unlock on someone with a record of closing.

**Pros earn credits.** One credit = one lead unlock, spent *before* the monthly
allowance so good performance is felt immediately rather than at renewal. Self-funding
(an unlock has no marginal cost) and aimed squarely at churn.

Two rules hold it up, and both are load-bearing:

1. **Nothing is earned for creating a flag.** Pros pay per unlock — paying people to
   post would flood the feed with junk and burn the paying side's money. Every award
   requires a verified outcome. Abandoning a flag that pros bid on costs points.
2. **An accepted offer is not a completed job.** Awards vest when the customer
   confirms completion, never on hire. This matches the analytics rule that
   `acceptedResponses` and `confirmedCompleted` are separate numbers.

**Anti-gaming.** Two accounts can always agree to fake a job, so positive awards are
capped per counterparty per calendar month (`PAIR_CAP_PER_MONTH`), which makes a
collusion loop stop paying almost immediately. A real build layers payment evidence
and identity signals on top; the cap alone is not sufficient at scale.

## Architecture

Static ES modules, no build step, no framework.

| File | Responsibility |
|---|---|
| `index.html` | Shell: top bar, map container, side panel, FAB, modal, toast |
| `assets/styles.css` | Design tokens and every component; responsive down to a mobile bottom sheet |
| `assets/theme.css` | Colour layer: the forest-green palette and tinted surfaces |
| `assets/motion.css` | Interaction layer: hover/press states, entrance animations, reduced-motion |
| `js/dispatch.js` | Booking confirmation, the "on the way" SMS, and live technician tracking |
| `js/taxonomy.js` | Flag types, the service and item catalogs, field sets, activation, search |
| `js/matching.js` | Business capabilities, the eligibility gate, feeds, funnel analytics |
| `js/rewards.js` | Buyer standing and pro credits |
| `js/support.js` | Issue catalog, triage, auto-resolutions, escalation, bias report |
| `js/support-view.js` | Help desk screens and the admin queue |
| `js/payments.js` | Escrow, the Stripe adapter, peer settlement, the server contract |
| `js/flag-admin.js` | Flag lifecycle: pause, edit, close, repost, delete, report |
| `js/data.js` | Categories, intake forms, pro directory, plans, seed flags, chat scripts |
| `js/store.js` | State, `localStorage` persistence, pub/sub, all mutations |
| `js/router.js` | Minimal view router (`go` / `back` / `render`) |
| `js/ui.js` | Formatting, stars, badges, toast, modal, delegated `data-act` dispatcher |
| `js/config.js` | Google Maps key storage and the active-provider flag |
| `js/geo.js` | Places autocomplete, geocoding, reverse geocoding, distance (Google or OSM) |
| `js/map.js` | Provider selection; re-exports one map interface |
| `js/map-google.js` | Google Maps implementation + the monochrome map style |
| `js/map-leaflet.js` | Leaflet/OSM fallback implementation |
| `js/deals.js` | Pricing model, simulated bids, accept / complete / rate, pro bidding |
| `js/flags.js` | Buyer views: home, picker, intake, flag detail, pro profile, account |
| `js/chat.js` | Inbox, message thread, reply simulator, counter-offer logic |
| `js/pro.js` | Pro views: lead feed, locked lead, bid form, plans, pro profile |
| `js/app.js` | Bootstrap, render loop, tab bar, top bar, mobile sheet |

Module dependencies are acyclic: `data` → `store` → `deals` → `chat` → `flags`/`pro` → `app`,
with `ui`, `geo` and `router` as leaf utilities. Views never call each other directly;
they navigate through `router.go` and mutate through `store`.

Events use a delegated `data-act="name"` attribute rather than inline handlers, so
re-rendering a whole view never leaves dangling listeners.

---

## What is faked

Everything that needs a server:

- **Bids** are generated locally on a timer from the static pro directory in `data.js`.
- **Chat replies** come from a small stage machine over canned lines, chosen by
  keyword (scheduling / trust / price) and how far into the conversation you are.
- **Ratings** you leave are blended into the directory baseline in the browser only.
- **Subscriptions** change local state; no card is collected and no payment runs.
- **Notifications** are in-app toasts. No email, SMS or push.
- **SMS is simulated.** A static front end cannot send text messages, and it must not
  try — a carrier token in client-side JavaScript is a token you have given away.
  `sendSms()` in `js/dispatch.js` is the single function a real build replaces; it
  should POST to your own server, which calls Twilio/Telnyx/MessageBird. The message
  content, the opt-in and the two-part photo-then-text send are all already correct.
- **Technician photos** come from a free placeholder service in the demo. Real photos
  are uploaded by the pro during verification and served from your own storage.
- **The trip runs 20× real time** so a 13-minute ETA plays out in about 40 seconds.
  The tracking screen says so on the page.

## Known limits

- **No auth, no server, no payments, no background jobs.** A pro cannot actually be
  notified when they are not looking at the page.
- **Places autocomplete uses the legacy `AutocompleteService`/`PlacesService` pair.**
  It is well supported and session-token billed, but Google is steering new projects
  at `AutocompleteSuggestion`. Migrating is contained to `gSuggest`/`gResolve` in
  `js/geo.js`.
- **Markers use `google.maps.Marker`**, which Google has marked deprecated in favour
  of `AdvancedMarkerElement`. Advanced markers need a cloud-configured Map ID, and
  a Map ID overrides the in-code `styles` array — so moving would mean recreating the
  monochrome style in Cloud Console. Contained to `createGoogleMap` in `js/map-google.js`.

---

## Google Maps setup

Flagd runs on the Google Maps Platform. Without a key it falls back to
Leaflet + OpenStreetMap so the prototype still runs, and says so in a toast and in
**Account → Map provider**.

**To connect it:**

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and
   enable billing (Maps Platform has a monthly free allowance but requires a card).
2. Enable three APIs: **Maps JavaScript API**, **Places API**, **Geocoding API**.
3. Create an API key, then **restrict it**:
   - *Application restrictions* → HTTP referrers → add `http://localhost:8795/*` and
     whatever domain you deploy to.
   - *API restrictions* → limit it to the three APIs above.
4. In the running app: **Account → Map provider → Add a Google Maps key**, paste, save.

The key is stored in that browser's `localStorage` only. For a deployment, set
`window.FLAGD_GOOGLE_MAPS_KEY` from a small untracked script tag in `index.html`
instead — there is a comment marking the spot.

> A Maps JavaScript key is *always* visible in client-side source. That is expected and
> is how Google's browser keys work; the HTTP referrer restriction is what protects it,
> not secrecy. Do not reuse a server-side key here.

**What Google gives you over OSM:** real US house-number coverage (the gap that
made addresses unreliable), Places autocomplete that completes partial street
addresses as you type, and a styled basemap that holds the monochrome design.

**Provider files**: `js/map.js` picks a provider and re-exports one interface;
`js/map-google.js` and `js/map-leaflet.js` implement it; `js/geo.js` does the same
for search / autocomplete / reverse geocoding. Deleting the OSM fallback later means
removing `map-leaflet.js`, its branch in `map.js`, and the `osm*` functions in `geo.js`.

---

## If this becomes real

Roughly in order:

1. **Backend + auth** — Next.js + Postgres/PostGIS (Supabase is the fast path).
   PostGIS gives you "flags within N miles of this pro" as a single indexed query.
2. **Real-time** — websockets for bid arrival and chat, so the pro feed is live.
3. **Notifications** — SMS and push are what actually make a lead marketplace work;
   a pro who answers in 6 minutes wins the job.
4. **Pro verification** — licence and insurance checks per trade and per state. This
   is the trust asset the whole rating system rests on.
5. **Billing** — Stripe subscriptions for the pro plans, with the lead allowance
   metered server-side.
6. **Abuse controls** — flag spam, fake ratings, and pros trying to take the deal
   off-platform are the three failure modes that kill marketplaces like this.
