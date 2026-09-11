// map.js — the map surface the rest of the app talks to.
//
// Google Maps is the real provider. Leaflet/OSM is a stopgap that runs only when no
// Google key is configured or the key is refused, so the prototype is never dead in
// the water; every export below behaves identically either way.

import { googleKey, hasGoogleKey, provider } from './config.js';
import { loadGoogle, createGoogleMap, onAuthFailure } from './map-google.js';
import { loadLeaflet, createLeafletMap } from './map-leaflet.js';
import { state } from './store.js';

let impl = null;
let onFlagOpen = () => {};
let onFallback = () => {};
let lastFilter = null;
let swapping = false;

/** Resolves to { provider: 'google' | 'osm', reason? }. */
export async function initMap(opts = {}) {
  onFlagOpen = opts.onFlagOpen || onFlagOpen;
  onFallback = opts.onFallback || onFallback;
  const el = document.getElementById('map');

  let reason = 'no-key';

  if (hasGoogleKey()) {
    try {
      await loadGoogle(googleKey());
      impl = createGoogleMap({ el, onFlagOpen });
      provider.name = 'google';
      impl.renderFlags(null, true);
      // A refused key arrives late, once Google has validated it server-side.
      onAuthFailure(() => swapToFallback('key-rejected'));
      return { provider: 'google' };
    } catch (e) {
      console.warn('[flagd] Google Maps did not load, falling back to OSM', e);
      reason = e && e.message === 'GOOGLE_AUTH_FAILED' ? 'key-rejected' : 'load-failed';
    }
  }

  await useLeaflet(el);
  return { provider: 'osm', reason };
}

async function useLeaflet(el) {
  el.innerHTML = '';                 // clears Google's own error overlay, if any
  await loadLeaflet();
  impl = createLeafletMap({ el });
  provider.name = 'osm';
  impl.renderFlags(lastFilter, true);
  if (state.home) impl.setHome(state.home.ll, state.home.label);
}

/** Tear down a dead Google map and bring the fallback up in its place. */
async function swapToFallback(reason) {
  if (swapping || provider.name === 'osm') return;
  swapping = true;
  try {
    await useLeaflet(document.getElementById('map'));
    onFallback(reason);
  } finally {
    swapping = false;
  }
}

const call = (fn, ...args) => (impl && impl[fn] ? impl[fn](...args) : undefined);

export const resize      = () => call('resize');
export const focusFlag   = (id, zoom, withPopup) => call('focusFlag', id, zoom, withPopup);
export const flyTo       = (ll, zoom) => call('flyTo', ll, zoom);
export const center      = () => call('center');
export const setHome     = (ll, label) => call('setHome', ll, label);
export const startPlacing = (catKey, cb) => call('startPlacing', catKey, cb);
export const stopPlacing = () => call('stopPlacing');
export const isPlacing   = () => !!call('isPlacing');
export const setCourier  = (ll, dest, arrived) => call('setCourier', ll, dest, arrived);
export const clearCourier = () => call('clearCourier');

// Remembered so a mid-session provider swap can redraw the same set of pins.
export function renderFlags(filterFn, force) {
  lastFilter = filterFn || null;
  return call('renderFlags', filterFn, force);
}

/** The underlying provider map object, for anything provider-specific. */
export const raw = () => (impl ? impl.raw : null);
