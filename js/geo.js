// geo.js — address search, autocomplete and reverse geocoding.
//
// Google is the real provider: US house-number and business coverage is far better
// than OSM's, which is the main reason Flagd uses Google Maps at all. The OSM /
// Nominatim path only runs when no Google key is configured.
//
// Public API is provider-agnostic: search, reverse, distance, attachAutocomplete.

import { usingGoogle } from './config.js';

/* ================================================================ shared */

/** Great-circle distance in meters between two [lat,lng] pairs. */
export function distance(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const US_STATE = {
  Alabama:'AL',Alaska:'AK',Arizona:'AZ',Arkansas:'AR',California:'CA',Colorado:'CO',Connecticut:'CT',
  Delaware:'DE',Florida:'FL',Georgia:'GA',Hawaii:'HI',Idaho:'ID',Illinois:'IL',Indiana:'IN',Iowa:'IA',
  Kansas:'KS',Kentucky:'KY',Louisiana:'LA',Maine:'ME',Maryland:'MD',Massachusetts:'MA',Michigan:'MI',
  Minnesota:'MN',Mississippi:'MS',Missouri:'MO',Montana:'MT',Nebraska:'NE',Nevada:'NV',
  'New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC',
  'North Dakota':'ND',Ohio:'OH',Oklahoma:'OK',Oregon:'OR',Pennsylvania:'PA','Rhode Island':'RI',
  'South Carolina':'SC','South Dakota':'SD',Tennessee:'TN',Texas:'TX',Utah:'UT',Vermont:'VT',
  Virginia:'VA',Washington:'WA','West Virginia':'WV',Wisconsin:'WI',Wyoming:'WY',
  'District of Columbia':'DC',
};

/* ================================================================ Google */

const G = () => window.google.maps;
let geocoder = null;
let acService = null;
let placesService = null;
let sessionToken = null;

const geocoderOf = () => (geocoder = geocoder || new (G().Geocoder)());

function autocompleteOf() {
  if (!acService) acService = new (G().places.AutocompleteService)();
  return acService;
}

function placesOf() {
  // PlacesService needs an element to attribute results to; a detached div is fine.
  if (!placesService) placesService = new (G().places.PlacesService)(document.createElement('div'));
  return placesService;
}

// One token per typing session keeps autocomplete + details billed as a single session.
const newSession = () => (sessionToken = new (G().places.AutocompleteSessionToken)());

/** Google address_components -> "103 E 5th St, Austin, TX 78701". */
function googleAddress(components, fallback) {
  const pick = (type, short) => {
    const c = (components || []).find(x => x.types.includes(type));
    return c ? (short ? c.short_name : c.long_name) : '';
  };
  const street = [pick('street_number'), pick('route', true)].filter(Boolean).join(' ');
  const city = pick('locality') || pick('sublocality') || pick('postal_town') ||
               pick('administrative_area_level_3') || pick('administrative_area_level_2');
  const st = pick('administrative_area_level_1', true);
  const zip = pick('postal_code');
  const line = [street, city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return line || fallback || '';
}

function googleShort(components, fallback) {
  const pick = (type, short) => {
    const c = (components || []).find(x => x.types.includes(type));
    return c ? (short ? c.short_name : c.long_name) : '';
  };
  const hood = pick('neighborhood') || pick('sublocality');
  const city = pick('locality') || pick('postal_town') || pick('administrative_area_level_2');
  const st = pick('administrative_area_level_1', true);
  return [hood, city, st].filter(Boolean).join(', ') || fallback || '';
}

const googleZip = (components) => {
  const c = (components || []).find(x => x.types.includes('postal_code'));
  return c ? c.long_name : '';
};

function gGeocode(request) {
  return new Promise((resolve, reject) => {
    geocoderOf().geocode(request, (results, status) => {
      if (status === 'OK' && results && results.length) resolve(results);
      else if (status === 'ZERO_RESULTS') resolve([]);
      else reject(new Error('geocoder: ' + status));
    });
  });
}

function gResultToItem(r) {
  return {
    label: googleAddress(r.address_components, r.formatted_address),
    short: googleShort(r.address_components, r.formatted_address),
    zip: googleZip(r.address_components),
    ll: [r.geometry.location.lat(), r.geometry.location.lng()],
    raw: r,
  };
}

/** Typed-ahead predictions. Cheap; no location is resolved until one is picked. */
function gSuggest(q) {
  return new Promise((resolve) => {
    const svc = autocompleteOf();
    if (!sessionToken) newSession();
    svc.getPlacePredictions(
      {
        input: q,
        sessionToken,
        componentRestrictions: { country: 'us' },
        types: ['geocode'],
      },
      (preds, status) => {
        if (status !== 'OK' || !preds) return resolve([]);
        resolve(preds.map(p => ({
          id: p.place_id,
          primary: p.structured_formatting ? p.structured_formatting.main_text : p.description,
          label: p.description,
          ll: null,
        })));
      }
    );
  });
}

/** Turn a picked prediction into a full address + location. */
function gResolve(item) {
  if (item.ll) return Promise.resolve(item);
  return new Promise((resolve) => {
    placesOf().getDetails(
      { placeId: item.id, fields: ['geometry', 'formatted_address', 'address_components'], sessionToken },
      (place, status) => {
        sessionToken = null;              // the session ends with the details call
        if (status !== 'OK' || !place || !place.geometry) return resolve(null);
        resolve({
          label: googleAddress(place.address_components, place.formatted_address),
          short: googleShort(place.address_components, place.formatted_address),
          zip: googleZip(place.address_components),
          ll: [place.geometry.location.lat(), place.geometry.location.lng()],
          raw: place,
        });
      }
    );
  });
}

async function gSearch(q, limit) {
  const rows = await gGeocode({ address: q, componentRestrictions: { country: 'US' } });
  return rows.slice(0, limit).map(gResultToItem);
}

async function gReverse(lat, lng) {
  const rows = await gGeocode({ location: { lat, lng } });
  if (!rows.length) return { label: '', short: '', zip: '', raw: null };
  return gResultToItem(rows[0]);
}

/* ================================================================ OSM / Nominatim */

const NOMINATIM = 'https://nominatim.openstreetmap.org';
const osmCache = new Map();

export function formatUS(a, fallback) {
  if (!a) return fallback || '';
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city || a.town || a.village || a.hamlet || a.suburb || a.neighbourhood || a.county || '';
  const st = US_STATE[a.state] || a.state || '';
  const zip = a.postcode || '';
  const line = [street, city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return line || fallback || '';
}

export function shortUS(a, fallback) {
  if (!a) return fallback || '';
  const hood = a.neighbourhood || a.suburb || '';
  const city = a.city || a.town || a.village || a.county || '';
  const st = US_STATE[a.state] || a.state || '';
  return [hood, city, st].filter(Boolean).join(', ') || fallback || '';
}

async function nom(path) {
  if (osmCache.has(path)) return osmCache.get(path);
  const res = await fetch(NOMINATIM + path, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('geocoder ' + res.status);
  const json = await res.json();
  osmCache.set(path, json);
  return json;
}

async function osmSearch(q, limit) {
  const zip = /^\d{5}(-\d{4})?$/.test(q);
  const path = `/search?format=jsonv2&addressdetails=1&countrycodes=us&limit=${limit}` +
               `&q=${encodeURIComponent(zip ? q + ', USA' : q)}`;
  const rows = await nom(path);
  return rows.map(r => ({
    label: formatUS(r.address, r.display_name),
    short: shortUS(r.address, r.display_name),
    zip: (r.address && r.address.postcode) || '',
    primary: [r.address && r.address.house_number, r.address && r.address.road].filter(Boolean).join(' ')
             || (r.address && (r.address.city || r.address.town)) || r.display_name.split(',')[0],
    ll: [parseFloat(r.lat), parseFloat(r.lon)],
    raw: r,
  })).filter(x => x.label);
}

async function osmReverse(lat, lng) {
  const r = await nom(`/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`);
  return {
    label: formatUS(r.address, r.display_name),
    short: shortUS(r.address, r.display_name),
    zip: (r.address && r.address.postcode) || '',
    raw: r,
  };
}

/* ================================================================ public API */

/** Free-text search: address, city or ZIP. Returns fully resolved items. */
export async function search(q, limit = 6) {
  const query = String(q || '').trim();
  if (query.length < 3) return [];
  try {
    return usingGoogle() ? await gSearch(query, limit) : await osmSearch(query, limit);
  } catch (e) {
    console.warn('[flagd] geocode failed', e);
    return [];
  }
}

/** Point -> address. */
export async function reverse(lat, lng) {
  try {
    return usingGoogle() ? await gReverse(lat, lng) : await osmReverse(lat, lng);
  } catch (e) {
    console.warn('[flagd] reverse geocode failed', e);
    return { label: '', short: '', zip: '', raw: null };
  }
}

/** Suggestions for a dropdown. May return items without a location yet. */
async function suggest(q) {
  try {
    return usingGoogle() ? await gSuggest(q) : await osmSearch(q, 6);
  } catch (e) {
    console.warn('[flagd] autocomplete failed', e);
    return [];
  }
}

/** Fill in the location for a picked suggestion. */
async function resolveItem(item) {
  if (!item) return null;
  if (item.ll) return item;
  try {
    return usingGoogle() ? await gResolve(item) : null;
  } catch (e) {
    console.warn('[flagd] place details failed', e);
    return null;
  }
}

/* ---------------------------------------------------------------- autocomplete UI */
// Provider-agnostic: our own dropdown so it matches the design system, rather than
// Google's .pac-container widget.
export function attachAutocomplete(input, onPick, opts = {}) {
  let box = null, items = [], active = -1, timer = null, lastQuery = '';

  const close = () => { if (box) { box.remove(); box = null; } items = []; active = -1; };

  const place = () => {
    if (!box) return;
    const r = input.getBoundingClientRect();
    box.style.left = r.left + 'px';
    box.style.top = (r.bottom + 6) + 'px';
    box.style.width = Math.max(r.width, opts.minWidth || 260) + 'px';
  };

  const draw = () => {
    if (!box) {
      box = document.createElement('div');
      box.className = 'ac';
      document.body.appendChild(box);
    }
    box.innerHTML = items.length
      ? items.map((it, i) =>
          `<div class="ac-item ${i === active ? 'on' : ''}" data-i="${i}">` +
          `<b>${escape2(it.primary || it.label.split(',')[0])}</b>${escape2(it.label)}</div>`
        ).join('')
      : `<div class="ac-empty">No matches. Try a street address or ZIP.</div>`;
    place();
    box.querySelectorAll('.ac-item').forEach(el => {
      el.addEventListener('mousedown', (e) => { e.preventDefault(); pick(items[Number(el.dataset.i)]); });
    });
  };

  const pick = async (it) => {
    if (!it) return;
    input.value = it.label;
    lastQuery = it.label;
    close();
    const full = await resolveItem(it);
    if (full) onPick && onPick(full);
    else if (opts.onMiss) opts.onMiss(it.label);
  };

  const run = async () => {
    const q = input.value.trim();
    if (q === lastQuery) return;
    lastQuery = q;
    if (q.length < 3) { close(); return; }
    items = await suggest(q);
    active = -1;
    if (document.activeElement === input) draw();
  };

  // Handles pasted / browser-autofilled values that never fired a keystroke.
  const commitTyped = async () => {
    const q = input.value.trim();
    if (q.length < 3) return;
    const res = await search(q, 1);
    if (res[0]) pick(res[0]);
    else if (opts.onMiss) opts.onMiss(q);
  };

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 300); });
  input.addEventListener('focus', () => { if (items.length) draw(); });
  input.addEventListener('blur', () => setTimeout(close, 140));
  input.addEventListener('change', commitTyped);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!items.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      draw();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0) pick(items[active]);
      else commitTyped();
    } else if (e.key === 'Escape') close();
  });

  return { close, commit: commitTyped };
}

function escape2(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
