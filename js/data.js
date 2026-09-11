// data.js — static catalog: categories, intake forms, the pro directory and seed content.
// No dependencies. Everything here is demo data; a real build replaces it with API calls.

export const DEFAULT_CENTER = [30.2672, -97.7431]; // Austin, TX
export const DEFAULT_ZOOM = 12;

/* ---------------------------------------------------------------- categories */
// kind: 'service' = someone comes and does work | 'item' = someone sells you a thing
export const CATEGORIES = {
  plumber:     { name: 'Plumber',          icon: '🔧', color: '#2e9bff', kind: 'service', unit: 'job' },
  electrician: { name: 'Electrician',      icon: '⚡', color: '#f5a524', kind: 'service', unit: 'job' },
  hvac:        { name: 'HVAC / AC',        icon: '❄️', color: '#17c3d6', kind: 'service', unit: 'job' },
  handyman:    { name: 'Handyman',         icon: '🔨', color: '#f97316', kind: 'service', unit: 'job' },
  roofer:      { name: 'Roofing',          icon: '🏠', color: '#ef4444', kind: 'service', unit: 'job' },
  landscaper:  { name: 'Lawn & Landscape', icon: '🌿', color: '#22c55e', kind: 'service', unit: 'job' },
  cleaner:     { name: 'House Cleaning',   icon: '🧽', color: '#a855f7', kind: 'service', unit: 'visit' },
  mover:       { name: 'Movers',           icon: '📦', color: '#8b5cf6', kind: 'service', unit: 'move' },
  painter:     { name: 'Painter',          icon: '🎨', color: '#ec4899', kind: 'service', unit: 'job' },
  pest:        { name: 'Pest Control',     icon: '🐜', color: '#84cc16', kind: 'service', unit: 'visit' },
  appliance:   { name: 'Appliance Repair', icon: '🧰', color: '#06b6d4', kind: 'service', unit: 'repair' },
  autoshop:    { name: 'Auto Repair',      icon: '🔩', color: '#64748b', kind: 'service', unit: 'job' },

  usedcar:     { name: 'Car / Truck',      icon: '🚙', color: '#0ea5e9', kind: 'item', unit: 'vehicle' },
  furniture:   { name: 'Furniture',        icon: '🛋️', color: '#d97706', kind: 'item', unit: 'item' },
  electronics: { name: 'Electronics',      icon: '💻', color: '#6366f1', kind: 'item', unit: 'item' },
  tools:       { name: 'Tools & Equipment',icon: '🛠️', color: '#78716c', kind: 'item', unit: 'item' },
  other:       { name: 'Something else',   icon: '🏷️', color: '#94a3b8', kind: 'item', unit: 'item' },
};

export const catKeys = (kind) => Object.keys(CATEGORIES).filter(k => CATEGORIES[k].kind === kind);
export const cat = (k) => CATEGORIES[k] || CATEGORIES.other;

/* ---------------------------------------------------------------- intake forms */
// Quick-pick chips shown on the intake sheet, per category.
export const CHIPS = {
  plumber:     ['Leak', 'Clogged drain', 'Water heater', 'Toilet', 'Faucet / sink', 'Burst pipe', 'Repipe', 'Garbage disposal'],
  electrician: ['Outlet not working', 'Breaker tripping', 'Ceiling fan', 'Light fixture', 'Panel upgrade', 'EV charger', 'Rewire', 'Generator'],
  hvac:        ['Not cooling', 'Not heating', 'Tune-up', 'New system quote', 'Ductwork', 'Thermostat', 'Refrigerant leak', 'Mini split'],
  handyman:    ['TV mounting', 'Drywall patch', 'Furniture assembly', 'Door / lock', 'Shelving', 'Caulking', 'Gutter cleaning', 'Odd jobs'],
  roofer:      ['Leak', 'Storm damage', 'Full replacement', 'Missing shingles', 'Inspection', 'Gutters', 'Flashing', 'Insurance claim'],
  landscaper:  ['Mowing', 'Tree trimming', 'Sod / turf', 'Sprinkler repair', 'Cleanup', 'Mulch', 'Fence line', 'Landscape design'],
  cleaner:     ['Deep clean', 'Recurring', 'Move-out', 'Post-construction', 'Windows', 'Carpets', 'Airbnb turnover', 'Garage'],
  mover:       ['Studio', '1 bedroom', '2 bedroom', '3+ bedroom', 'Single item', 'Packing help', 'Storage', 'Long distance'],
  painter:     ['Interior', 'Exterior', 'One room', 'Whole house', 'Cabinets', 'Trim / doors', 'Deck / fence', 'Drywall repair'],
  pest:        ['Roaches', 'Ants', 'Rodents', 'Termites', 'Mosquitoes', 'Bed bugs', 'Wasps', 'Quarterly plan'],
  appliance:   ['Refrigerator', 'Washer', 'Dryer', 'Dishwasher', 'Oven / range', 'Microwave', 'Ice maker', 'Under warranty'],
  autoshop:    ['Brakes', 'Check engine', 'Oil change', 'AC not cold', 'Tires', 'Transmission', 'Pre-purchase inspection', 'Body work'],

  usedcar:     ['Clean title only', 'One owner', 'Under 80k miles', 'No accidents', 'Carfax required', 'Financing needed', 'Trade-in', 'Cash buyer'],
  furniture:   ['Like new', 'Solid wood', 'Delivery needed', 'Sectional', 'Dining set', 'Mattress', 'Office desk', 'Outdoor'],
  electronics: ['Working condition', 'With box', 'Under warranty', 'Unlocked', 'Bundle ok', 'Local pickup', 'Gaming', 'Apple'],
  tools:       ['Cordless set', 'Corded ok', 'Contractor grade', 'With case', 'Trailer', 'Mower', 'Generator', 'Ladder'],
  other:       ['Local pickup', 'Delivery needed', 'Cash ready', 'Flexible', 'Bulk lot', 'Collectible'],
};

// Extra typed fields, appended to the intake sheet for item categories.
export const EXTRA_FIELDS = {
  usedcar: [
    { id: 'make',  label: 'Make & model',   ph: 'e.g. Toyota Tacoma SR5' },
    { id: 'years', label: 'Year range',     ph: 'e.g. 2019–2023' },
    { id: 'miles', label: 'Max mileage',    ph: 'e.g. 80,000' },
  ],
  furniture:   [{ id: 'what', label: 'What are you looking for?', ph: 'e.g. 3-seat sectional, gray fabric' }],
  electronics: [{ id: 'what', label: 'What are you looking for?', ph: 'e.g. MacBook Pro 14" M3, 16GB' }],
  tools:       [{ id: 'what', label: 'What are you looking for?', ph: 'e.g. DeWalt 20V combo kit' }],
  other:       [{ id: 'what', label: 'What are you looking for?', ph: 'Describe the item' }],
};

export const TIMING = [
  'Emergency — today if possible',
  'Within a few days',
  'This week is fine',
  'Next couple of weeks',
  'Just gathering quotes',
];

/* ---------------------------------------------------------------- pro directory */
// avatar color is derived from the category; `resp` is a typical first-response time in minutes.
const P = (id, name, catKey, rating, reviews, jobs, years, verified, license, resp, blurb) =>
  ({ id, name, cat: catKey, rating, reviews, jobs, years, verified, license, resp, blurb });

export const PROS = [
  P('p_ridgeline', 'Ridgeline Plumbing',      'plumber',     4.9, 218, 1240, 12, true,  'TX M-41288', 6,  'Family-run since 2013. Flat-rate pricing, no trip charge on Flagd leads.'),
  P('p_bluewater', 'Bluewater Plumbing Co.',  'plumber',     4.6, 97,  540,  6,  true,  'TX M-39104', 14, 'Same-day drain and water-heater work across Central Austin.'),
  P('p_hydrapro',  'HydraPro Services',       'plumber',     4.3, 41,  190,  3,  false, null,         27, 'Two-truck shop, competitive on repipes and slab leaks.'),
  P('p_cobalt',    'Cobalt Electric',         'electrician', 4.8, 164, 870,  9,  true,  'TX 28104-E', 9,  'Master electrician on every truck. Panel upgrades and EV chargers.'),
  P('p_lonestar',  'Lone Star Electric',      'electrician', 4.5, 76,  410,  5,  true,  'TX 31877-E', 18, 'Residential rewires, fans, recessed lighting. Free estimates.'),
  P('p_hillco',    'Hill Country HVAC',       'hvac',        4.9, 302, 1610, 15, true,  'TACLA-2891C',7,  'NATE-certified. 24/7 emergency AC in the Austin metro.'),
  P('p_arctic',    'Arctic Air Solutions',    'hvac',        4.4, 88,  455,  4,  true,  'TACLB-9917C',21, 'New systems and mini splits. Financing available.'),
  P('p_capital',   'Capital Handyman',        'handyman',    4.7, 143, 980,  8,  true,  null,         11, 'One guy, one truck, 20 years of everything.'),
  P('p_fixit',     'Fix-It Forty',            'handyman',    4.2, 55,  300,  3,  false, null,         33, 'Small jobs and honey-do lists. Weekends available.'),
  P('p_summit',    'Summit Roofing',          'roofer',      4.8, 191, 620,  11, true,  'TX RCAT-4402',13, 'Storm and hail specialists. We handle the insurance paperwork.'),
  P('p_ironclad',  'Ironclad Roof & Gutter',  'roofer',      4.5, 64,  280,  6,  true,  'TX RCAT-6610',24, 'Metal and composite. 10-year workmanship warranty.'),
  P('p_greenline', 'Greenline Lawn Care',     'landscaper',  4.7, 209, 3100, 7,  true,  null,         8,  'Weekly mowing routes plus full landscape installs.'),
  P('p_oakleaf',   'Oakleaf Tree & Turf',     'landscaper',  4.4, 71,  510,  5,  false, null,         26, 'Certified arborist on staff. Trimming and removals.'),
  P('p_sparkle',   'Sparkle & Co. Cleaning',  'cleaner',     4.9, 276, 4200, 9,  true,  null,         5,  'Bonded and insured. Same crew every visit.'),
  P('p_freshnest', 'Fresh Nest Cleaning',     'cleaner',     4.3, 62,  890,  3,  true,  null,         19, 'Move-outs and Airbnb turnovers, 7 days a week.'),
  P('p_atlas',     'Atlas Moving',            'mover',       4.6, 158, 720,  10, true,  'USDOT 2277411', 12, 'Licensed and insured. Blankets and shrink wrap included.'),
  P('p_twomen',    'Bandera Movers',          'mover',       4.4, 93,  410,  6,  true,  'USDOT 3140228', 22, 'Hourly crews of 2 or 3. No hidden fuel fees.'),
  P('p_truecoat',  'TrueCoat Painting',       'painter',     4.8, 126, 540,  8,  true,  null,         10, 'Sherwin-Williams pro. Cabinets and interiors.'),
  P('p_brushline', 'Brushline Painters',      'painter',     4.2, 48,  230,  4,  false, null,         31, 'Exterior specialists. Free color consultation.'),
  P('p_shield',    'Shield Pest Solutions',   'pest',        4.7, 187, 2600, 12, true,  'TDA 0688412',  9,  'Pet-safe treatments. Quarterly plans from $89.'),
  P('p_apexfix',   'Apex Appliance Repair',   'appliance',   4.6, 112, 1450, 7,  true,  null,         15, 'Factory-authorized for LG, Samsung and Whirlpool.'),
  P('p_gearhead',  'Gearhead Auto',           'autoshop',    4.7, 231, 5400, 14, true,  'ASE Master',   11, 'Independent shop. Free pre-purchase inspections.'),

  P('d_texauto',   'TexAuto Group',           'usedcar',     4.5, 412, 2100, 18, true,  'TX Dealer P-8871', 16, 'Six-lot dealer group. We will source a specific trim for you.'),
  P('d_riverside', 'Riverside Motors',        'usedcar',     4.7, 189, 940,  9,  true,  'TX Dealer P-5540', 12, 'No-haggle pricing, every car Carfax-clean.'),
  P('d_privateJM', 'Jordan M.',               'usedcar',     4.9, 23,  0,    0,  false, null,          40, 'Private seller. Selling my truck, maintenance records since new.'),
  P('s_loopfurn',  'Loop Furniture Outlet',   'furniture',   4.4, 138, 2400, 11, true,  null,          20, 'Overstock and floor models. Delivery in the metro.'),
  P('s_secondact', 'Second Act Home',         'furniture',   4.8, 76,  610,  5,  true,  null,          14, 'Curated used and consignment furniture.'),
  P('s_voltcycle', 'VoltCycle Electronics',   'electronics', 4.6, 254, 3300, 8,  true,  null,          9,  'Refurbished Apple and gaming, 90-day warranty.'),
  P('s_gridgear',  'GridGear Resale',         'electronics', 4.1, 47,  380,  3,  false, null,          35, 'Phones, laptops, consoles. Local pickup only.'),
  P('s_toolvault', 'Tool Vault',              'tools',       4.7, 91,  720,  6,  true,  null,          17, 'Contractor-grade tools, new and reconditioned.'),
  P('s_market',    'Flagd Marketplace Seller','other',       4.3, 34,  120,  2,  false, null,          38, 'General resale, will consider most requests.'),
];

export const prosFor = (catKey) => PROS.filter(p => p.cat === catKey);
export const proById = (id) => PROS.find(p => p.id === id);

/* ---------------------------------------------------------------- pro identity
 * Photo, vehicle and a relay phone number. Derived from the pro id so a given pro
 * looks the same on every render without bloating the table above.
 *
 * Photos come from a free placeholder service for the demo only. In a real build
 * these are uploaded by the pro during verification and served from your own
 * storage — the whole point is that the customer sees the actual person arriving.
 */
function idHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export const proPhoto = (pro) =>
  `https://i.pravatar.cc/160?img=${(idHash(pro.id) % 70) + 1}`;

const SERVICE_VEHICLES = [
  'White Ford Transit van', 'Blue Chevy Express van', 'White Ram ProMaster van',
  'Grey Ford F-150', 'White Toyota Tacoma', 'Black Ford Transit Connect',
];
const DEALER_VEHICLES = ['Dealer plate', 'Silver Toyota Camry', 'Black Ford Explorer'];

export function proVehicle(pro) {
  const kind = CATEGORIES[pro.cat] ? CATEGORIES[pro.cat].kind : 'service';
  const list = kind === 'item' ? DEALER_VEHICLES : SERVICE_VEHICLES;
  const h = idHash(pro.id + 'v');
  const letters = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  const plate = letters[h % 23] + letters[(h >> 3) % 23] + letters[(h >> 6) % 23] +
                '-' + String(1000 + (h % 9000));
  return { model: list[h % list.length], plate: 'TX ' + plate };
}

/** A masked relay number — the customer never sees the pro's personal line. */
export const proPhone = (pro) => {
  const n = idHash(pro.id + 'p') % 10000;
  return '(512) 555-' + String(n).padStart(4, '0');
};

/* ---------------------------------------------------------------- the human side
 * Most listings are company names, but a person shows up at the door. `owner` is
 * who that is; `about` is written in their own voice. This is what turns a row in
 * a directory into someone you are willing to let into your house, and it is the
 * single biggest trust lever the product has.
 */
export const PERSONAL = {
  p_ridgeline: { owner: 'Ray Delgado', about: 'Third-generation plumber — my grandfather started this with one truck in 1974. Two daughters, both in school here. If I am not under a sink I am usually at their softball games.', interests: ['Softball coach', 'Smoker BBQ', 'Longhorns'], local: 'Born and raised in Austin' },
  p_bluewater: { owner: 'Marisol Vega', about: 'I took over the business from my old boss when he retired. I run a small crew and we all live within 15 minutes of Central Austin, so we actually care what people say about us.', interests: ['Trail running', 'Two rescue dogs'], local: '11 years in Austin' },
  p_hydrapro:  { owner: 'Danny Boyle', about: 'Two trucks, me and my brother-in-law. We are newer but we work weekends and we do not pad the bill.', interests: ['Fishing', 'Dad of one'], local: '6 years in Austin' },
  p_cobalt:    { owner: 'Andre Whitfield', about: 'Master electrician. I got into this because my dad rewired half our block for free and I wanted to do it properly. I teach the apprentice program at ACC on Thursdays.', interests: ['Teaching', 'Vinyl records', 'EVs'], local: '20 years in Central Texas' },
  p_lonestar:  { owner: 'Cody Ramirez', about: 'Family shop — my wife runs the scheduling and I run the truck. We do a lot of ceiling fans in July, which tells you everything about Austin.', interests: ['Fishing Lake Travis', 'Three kids'], local: 'Grew up in Pflugerville' },
  p_hillco:    { owner: 'Tomas Iglesias', about: 'NATE-certified and slightly obsessive about duct design. I answer the 2am calls myself because I remember what it is like to have a newborn and no AC in August.', interests: ['Cycling', 'Grandkids', 'Chess'], local: '22 years in the metro' },
  p_arctic:    { owner: 'Kelly Nowak', about: 'I left a big HVAC company to start this because I got tired of being told to upsell. Mini splits are my favorite job.', interests: ['Woodworking', 'Rescue cats'], local: '9 years in Austin' },
  p_capital:   { owner: 'Bill Hargrove', about: 'One guy, one truck, twenty years. I am the person who shows up, so you always know who you are getting. Retired Navy.', interests: ['Veteran', 'Gardening', 'Crosswords'], local: 'Austin since 2004' },
  p_fixit:     { owner: 'Marco Silva', about: 'I do the small stuff nobody else wants to drive out for. Weekends work fine for me — my daughter has Saturday soccer so I am up anyway.', interests: ['Soccer dad', 'Home brewing'], local: '5 years in South Austin' },
  p_summit:    { owner: 'Wade Colby', about: 'Storm and hail work. I have walked more Austin roofs than I can count and I will tell you honestly when you do not need a new one.', interests: ['Hunting', 'High school football', 'Four kids'], local: 'Central Texas his whole life' },
  p_ironclad:  { owner: 'Priscilla Amaro', about: 'Metal and composite roofing. I am a licensed inspector too, so I am the one who catches the thing the last guy missed.', interests: ['Hiking', 'Photography'], local: '14 years in Austin' },
  p_greenline: { owner: 'Jesse Okafor', about: 'Started mowing lawns at 15 and never really stopped. Now there are six trucks. I still do the design work myself because that is the fun part.', interests: ['Native plants', 'Vinyl', 'New dad'], local: 'Austin native' },
  p_oakleaf:   { owner: 'Hank Mueller', about: 'Certified arborist. I will argue with you about cutting down a healthy oak, and I will usually win.', interests: ['Beekeeping', 'Birding'], local: '17 years in the Hill Country' },
  p_sparkle:   { owner: 'Rosa Delacruz', about: 'Same crew every visit — I think that matters when someone is in your home. Most of my team has been with me over five years.', interests: ['Church choir', 'Baking', 'Five grandkids'], local: 'Austin since 1998' },
  p_freshnest: { owner: 'Tiff Brennan', about: 'Move-outs and Airbnb turnovers. I am fast because I used to manage twelve short-term rentals myself.', interests: ['Travel', 'Yoga'], local: '7 years in Austin' },
  p_atlas:     { owner: 'Big Mike Osei', about: 'Licensed and insured, and we bring the blankets and shrink wrap without charging you extra for them. I have moved enough pianos to have opinions about stairs.', interests: ['Weightlifting', 'Twin boys'], local: '12 years in Austin' },
  p_twomen:    { owner: 'Luis Barrera', about: 'Hourly crews, no hidden fuel fees. My brother and I started with one box truck and a lot of optimism.', interests: ['Soccer', 'Cooking'], local: 'Austin since 2016' },
  p_truecoat:  { owner: 'Nora Whitfield', about: 'Cabinets and interiors are my specialty. I trained as a furniture finisher, which is why my cabinet doors do not look like they were rolled.', interests: ['Painting', 'Antiques', 'Two teenagers'], local: '13 years in Austin' },
  p_brushline: { owner: 'Sam Ruiz', about: 'Exteriors mostly. Free color consultation because I would rather you love it than repaint in a year.', interests: ['Motorcycles', 'Chess'], local: '8 years in Austin' },
  p_shield:    { owner: 'Aaron Kessler', about: 'Pet-safe treatments only — I have two dogs and a very opinionated cat, so I use what I would use at home.', interests: ['Dog rescue', 'Fly fishing'], local: '15 years in Austin' },
  p_apexfix:   { owner: 'Denise Park', about: 'Factory-authorized for LG, Samsung and Whirlpool. I like the diagnostic puzzle more than the repair, honestly.', interests: ['Puzzles', 'Korean cooking', 'Mom of three'], local: '10 years in Austin' },
  p_gearhead:  { owner: 'Tony Marchetti', about: 'Independent shop. Free pre-purchase inspections because I have seen too many people buy someone else’s problem.', interests: ['Classic cars', 'Racing', 'Grandpa of four'], local: 'Austin since 1991' },

  d_texauto:   { owner: 'Sheila Monroe', about: 'I run the sourcing desk. Tell me the exact trim you want and I will find it across our six lots rather than talk you into what is on the floor.', interests: ['Road trips', 'Book club'], local: '18 years in the business' },
  d_riverside: { owner: 'Owen Blackwell', about: 'No-haggle pricing because I hated haggling when I was the customer. Every car gets a clean Carfax or we do not list it.', interests: ['Golf', 'Two daughters'], local: 'Austin since 2009' },
  d_privateJM: { owner: 'Jordan M.', about: 'Private seller, not a dealer. This is my truck — I bought it new, kept every receipt, and I am only selling because we had a second kid and need the third row.', interests: ['Camping', 'New dad'], local: 'East Austin' },
  s_loopfurn:  { owner: 'Gail Thompson', about: 'Overstock and floor models. I have been in furniture retail long enough to tell you which brands actually last.', interests: ['Interior design', 'Gardening'], local: '20 years in Austin' },
  s_secondact: { owner: 'Elena Castro', about: 'Curated used and consignment. I only take pieces I would put in my own house, which is why the inventory is small.', interests: ['Estate sales', 'Ceramics'], local: '6 years in Austin' },
  s_voltcycle: { owner: 'Deshawn Price', about: 'Refurbished Apple and gaming gear with a 90-day warranty. I do every repair myself in the back of the shop.', interests: ['Retro gaming', 'Basketball'], local: '9 years in Austin' },
  s_gridgear:  { owner: 'Nico Ferreira', about: 'Phones, laptops, consoles. Local pickup only — I like meeting the person I am selling to.', interests: ['Skating', 'Music production'], local: '4 years in Austin' },
  s_toolvault: { owner: 'Karl Brennan', about: 'Contractor-grade tools, new and reconditioned. I was a framer for 18 years, so I know what survives a job site.', interests: ['Woodworking', 'Fishing'], local: 'Austin since 2005' },
  s_market:    { owner: 'Pat Nguyen', about: 'General resale. Tell me what you are hunting for and I will let you know if it crosses my path.', interests: ['Thrifting', 'Cycling'], local: 'North Austin' },
};

const DEFAULT_PERSONAL = {
  owner: '', about: '', interests: [], local: '',
};

/** Personal details, with any edits the pro made in-app taking precedence. */
export const personalFor = (pro, overrides) =>
  Object.assign({}, DEFAULT_PERSONAL, PERSONAL[pro.id] || {}, overrides || {});

/* Prompts used by the pro profile editor. Phrased as questions a person would
   actually answer, not form labels — that is what gets warm copy back. */
export const PROFILE_PROMPTS = {
  about: {
    label: 'Tell people about yourself',
    hint: 'Who are you, how did you get into this work, who is at home? Two or three sentences in your own voice. This is the part customers read before they let you in the door.',
    ph: 'e.g. Third-generation plumber. Two daughters, both in school here. If I am not under a sink I am at their softball games.',
  },
  interests: {
    label: 'A few things you are into',
    hint: 'Separate with commas. Small human details help more than you would think.',
    ph: 'e.g. Softball coach, BBQ, Longhorns',
  },
  local: {
    label: 'How long have you been around here?',
    ph: 'e.g. Born and raised in Austin',
  },
};

/* ---------------------------------------------------------------- reviews */
const REVIEW_TEXT = [
  'Showed up on time, explained the problem, fixed it same visit. No upsell.',
  'Quoted through Flagd and the final price matched exactly. Refreshing.',
  'Great communication over chat before they even arrived.',
  'Work was solid but they ran about an hour late. Still would hire again.',
  'Fair price, clean work, hauled off the debris. Easy five stars.',
  'Second time using them. Consistent quality both times.',
  'Answered my flag within ten minutes on a Sunday.',
  'Professional crew, protected the floors, left it spotless.',
  'Price was a bit above the others but the workmanship shows.',
  'Straightforward, no drama, did what they said they would do.',
];
const REVIEWER = ['Marcus T.', 'Dana R.', 'Priya S.', 'Kevin O.', 'Alexis W.', 'Tom H.', 'Renee B.', 'Chris L.', 'Sam D.', 'Nicole F.'];

// Deterministic pseudo-reviews so a pro's profile looks the same on every render.
export function reviewsFor(pro, n = 4) {
  const out = [];
  let seed = 0;
  for (let i = 0; i < pro.id.length; i++) seed += pro.id.charCodeAt(i);
  for (let i = 0; i < n; i++) {
    const k = (seed + i * 37) % REVIEW_TEXT.length;
    const stars = i === 0 ? 5 : (pro.rating >= 4.6 ? (i % 4 === 3 ? 4 : 5) : (i % 3 === 2 ? 3 : (i % 2 ? 4 : 5)));
    out.push({
      by: REVIEWER[(seed + i * 17) % REVIEWER.length],
      stars,
      when: ['2 weeks ago', 'last month', '2 months ago', '4 months ago', '6 months ago'][i % 5],
      text: REVIEW_TEXT[k],
    });
  }
  return out;
}

/* ---------------------------------------------------------------- pricing */
// Pros pay; buyers never do. Prices are the demo's assumption, not a committed model.
export const PLANS = [
  {
    id: 'starter', name: 'Starter', price: 0, tag: 'Free trial',
    leads: 5, radius: 10,
    perks: ['5 lead unlocks per month', '10-mile flag radius', 'Standard placement in bid lists', 'Basic profile'],
  },
  {
    id: 'pro', name: 'Pro', price: 79, tag: 'Most popular',
    leads: 40, radius: 25,
    perks: ['40 lead unlocks per month', '25-mile flag radius', 'Instant flag alerts', 'Verified badge + license display', 'Reply templates in chat'],
  },
  {
    id: 'plus', name: 'Pro+', price: 179, tag: null,
    leads: Infinity, radius: 60,
    perks: ['Unlimited lead unlocks', '60-mile flag radius', 'Top placement in bid lists', 'Featured on the map', 'Team seats + shared inbox', 'Priority support'],
  },
];
export const planById = (id) => PLANS.find(p => p.id === id) || PLANS[0];

/* ---------------------------------------------------------------- seed flags */
// Other people's flags, so the map and the pro feed are not empty on first run.
export const SEED_FLAGS = [
  { cat:'plumber',     ll:[30.2849,-97.7341], title:'Water heater leaking into the garage', who:'Marcus T.',  ago:'12 min ago',  where:'Hyde Park, Austin, TX',       budget:'$400–900',   timing:'Emergency — today if possible', bids:3 },
  { cat:'electrician', ll:[30.2515,-97.7539], title:'Adding a 240V outlet for an EV charger', who:'Priya S.',  ago:'44 min ago',  where:'Zilker, Austin, TX',           budget:'$600–1,200', timing:'Within a few days',            bids:5 },
  { cat:'hvac',        ll:[30.3128,-97.7387], title:'AC blowing warm, upstairs only',        who:'Dana R.',    ago:'1 hr ago',    where:'North Loop, Austin, TX',       budget:'$150–600',   timing:'Emergency — today if possible', bids:4 },
  { cat:'roofer',      ll:[30.2411,-97.7195], title:'Hail damage inspection for insurance',  who:'Kevin O.',   ago:'2 hr ago',    where:'St. Edwards, Austin, TX',      budget:'Insurance',  timing:'This week is fine',            bids:2 },
  { cat:'landscaper',  ll:[30.2960,-97.7080], title:'Biweekly mowing, ~6,000 sq ft lot',     who:'Alexis W.',  ago:'3 hr ago',    where:'Mueller, Austin, TX',          budget:'$45–80/visit', timing:'Next couple of weeks',       bids:6 },
  { cat:'cleaner',     ll:[30.2662,-97.7690], title:'Move-out deep clean, 2 bed / 2 bath',   who:'Tom H.',     ago:'4 hr ago',    where:'Clarksville, Austin, TX',      budget:'$250–400',   timing:'Within a few days',            bids:5 },
  { cat:'handyman',    ll:[30.2280,-97.7690], title:'Mount 3 TVs and patch old anchor holes',who:'Renee B.',   ago:'5 hr ago',    where:'South Lamar, Austin, TX',      budget:'$150–300',   timing:'This week is fine',            bids:4 },
  { cat:'mover',       ll:[30.3305,-97.7060], title:'2 bedroom apartment, 4 miles, 3rd floor',who:'Chris L.',  ago:'6 hr ago',    where:'Windsor Park, Austin, TX',     budget:'$500–900',   timing:'Next couple of weeks',         bids:3 },
  { cat:'painter',     ll:[30.2540,-97.7940], title:'Repaint kitchen cabinets, 22 doors',    who:'Nicole F.',  ago:'8 hr ago',    where:'Tarrytown, Austin, TX',        budget:'$2,000–4,000', timing:'Just gathering quotes',      bids:7 },
  { cat:'pest',        ll:[30.2205,-97.7460], title:'Roaches in the kitchen, pet-safe only', who:'Sam D.',     ago:'9 hr ago',    where:'Dawson, Austin, TX',           budget:'$100–250',   timing:'Within a few days',            bids:2 },
  { cat:'usedcar',     ll:[30.2735,-97.7010], title:'Wanted: Toyota Tacoma SR5, under 80k',  who:'Jordan P.',  ago:'1 day ago',   where:'East Austin, TX',              budget:'$28,000–34,000', timing:'Just gathering quotes',    bids:8 },
  { cat:'usedcar',     ll:[30.3560,-97.7290], title:'Wanted: 3-row SUV, 2020+, clean title', who:'Bethany K.', ago:'1 day ago',   where:'Crestview, Austin, TX',        budget:'$30,000–40,000', timing:'Next couple of weeks',     bids:6 },
  { cat:'furniture',   ll:[30.2455,-97.7325], title:'Wanted: gray fabric sectional, delivery',who:'Omar F.',   ago:'1 day ago',   where:'Travis Heights, Austin, TX',   budget:'$600–1,200', timing:'This week is fine',            bids:4 },
  { cat:'electronics', ll:[30.3010,-97.7550], title:'Wanted: MacBook Pro 14" M3, 16GB',      who:'Lena V.',    ago:'2 days ago',  where:'Rosedale, Austin, TX',         budget:'$1,100–1,500', timing:'Just gathering quotes',      bids:5 },
  { cat:'appliance',   ll:[30.2860,-97.6890], title:'Samsung fridge not cooling, 3 yrs old', who:'Derek A.',   ago:'2 days ago',  where:'Govalle, Austin, TX',          budget:'$150–450',   timing:'Within a few days',            bids:3 },
  { cat:'autoshop',    ll:[30.2120,-97.7860], title:'Pre-purchase inspection, 2018 4Runner', who:'Maya R.',    ago:'2 days ago',  where:'Sunset Valley, TX',            budget:'$100–200',   timing:'This week is fine',            bids:2 },
  { cat:'tools',       ll:[30.3390,-97.6980], title:'Wanted: DeWalt 20V combo kit w/ case',  who:'Victor S.',  ago:'3 days ago',  where:'St. Johns, Austin, TX',        budget:'$250–450',   timing:'Just gathering quotes',        bids:3 },
];

/* ---------------------------------------------------------------- chat scripts */
// Canned pro replies. The simulator picks by stage, so a thread reads like a real one.
export const PRO_LINES = {
  open: [
    'Hi! Saw your flag come through. I can take a look at this — a couple of quick questions first.',
    'Thanks for the flag. I work that area daily, so I can get to you fast.',
    'Hey there, appreciate the flag. My bid is in — happy to walk through what it covers.',
  ],
  qualify: [
    'Roughly how old is the unit, and has anyone worked on it before?',
    'Is there anything blocking access, or can my tech get right to it?',
    'What days and times generally work for you this week?',
    'Do you have photos? That usually lets me tighten the quote quite a bit.',
  ],
  reassure: [
    'That is very doable. My bid already covers parts, labor and haul-off — no surprise line items.',
    'We are licensed and insured, and I will send the certificate before we start if you want it.',
    'If it turns out to be simpler than described, I refund the difference. That is standard for us.',
    'No trip charge and no diagnostic fee on Flagd jobs.',
  ],
  scheduling: [
    'I can do tomorrow morning between 8 and 10, or Thursday afternoon. Either work?',
    'I have an opening today if that helps — I could be there within about two hours.',
    'Let me know a window that works and I will hold it for you.',
  ],
  haggleAccept: [
    'That works for me. Locking it in at that price.',
    'Deal. I would rather do the job than argue over the last few dollars.',
    'You got it — I can make that number work.',
  ],
  haggleCounter: [
    'I can come down a bit, but not that far. How about this instead?',
    'Materials alone eat most of that. Here is the lowest I can honestly do:',
    'Let me meet you partway — this is a fair number for both of us.',
  ],
  haggleHold: [
    'I have to hold at my bid on this one. It is already tight, and I do not cut corners to hit a number.',
    'Respectfully, I will stay where I am. The quote reflects what the job actually takes.',
  ],
  hired: [
    'Fantastic — thank you for the business. You will get a confirmation and I will text before I head over.',
    'Booked. I will bring everything needed on the first trip.',
  ],
};

// Item sellers speak differently from service pros.
export const SELLER_LINES = {
  open: [
    'Hi! I have something close to what you flagged. Sending details and my price now.',
    'Saw your flag — I have one in stock that should fit. Want photos?',
    'Thanks for the flag. I can put this on hold for you for 48 hours.',
  ],
  qualify: [
    'Are you paying cash or would you want financing?',
    'Do you need delivery, or would you pick it up?',
    'Any color or trim preference, or is it flexible?',
    'Would you consider one model year older if the price is better?',
  ],
  reassure: [
    'Clean title in hand and I have the full service history.',
    'You are welcome to have your own mechanic inspect it before anything is signed.',
    'Price includes delivery inside the metro.',
    'It comes with a 90-day warranty through us.',
  ],
  scheduling: [
    'Want to come see it? I am around most afternoons this week.',
    'I can drop it by for you to look at, no obligation.',
    'Happy to send a walkaround video if that is easier.',
  ],
  haggleAccept: ['That number works — it is yours at that price.', 'Done. I will write it up at that.'],
  haggleCounter: ['I have a little room, but not that much. Here is where I can land:', 'Can we split the difference?'],
  haggleHold: ['That is below what I have in it, unfortunately. I will have to stay at my price.'],
  hired: ['Great — I will get the paperwork started and hold it for you.', 'Perfect. I will reach out with next steps today.'],
};
