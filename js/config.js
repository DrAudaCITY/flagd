// config.js — runtime configuration.
//
// The Google Maps key is NOT stored in this repo. A Maps JavaScript API key is
// necessarily visible in client-side code, so the way you secure it is an HTTP
// referrer restriction in Google Cloud Console — not secrecy. Keeping it out of
// the repo just stops it leaking into git history and forks.
//
// Set it either by:
//   1. pasting it into Account -> Map provider in the running app (stored in this
//      browser's localStorage only), or
//   2. for a deployment, defining window.FLAGD_GOOGLE_MAPS_KEY in a small
//      untracked script tag before js/app.js loads.

const LS_KEY = 'flagd.gmapsKey';

/** The key currently in effect, or '' if Google Maps is not configured. */
export function googleKey() {
  const injected = (typeof window !== 'undefined' && window.FLAGD_GOOGLE_MAPS_KEY) || '';
  let stored = '';
  try { stored = localStorage.getItem(LS_KEY) || ''; } catch (e) { /* private mode */ }
  return String(stored || injected).trim();
}

export function setGoogleKey(key) {
  try {
    const v = String(key || '').trim();
    if (v) localStorage.setItem(LS_KEY, v);
    else localStorage.removeItem(LS_KEY);
  } catch (e) {
    console.warn('[flagd] could not store the map key', e);
  }
}

export const hasGoogleKey = () => googleKey().length > 20;

/** Which map/geocoding provider this session is running on. Set once at boot. */
export const provider = { name: 'none' };   // 'google' | 'osm'
export const usingGoogle = () => provider.name === 'google';
