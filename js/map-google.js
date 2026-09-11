// map-google.js — the Google Maps JavaScript API implementation of the map surface.
// Exposes the same shape as map-leaflet.js so js/map.js can swap between them.

import { DEFAULT_CENTER, DEFAULT_ZOOM, cat } from './data.js';
import { state } from './store.js';
import { esc } from './ui.js';

/* ---------------------------------------------------------------- loader */
let loadPromise = null;
let authHandler = null;

/**
 * Google validates the key server-side *after* the script has loaded and the map has
 * been constructed, so a bad key surfaces as a late gm_authFailure rather than a load
 * error. Callers register here to react to that.
 */
export function onAuthFailure(fn) { authHandler = fn; }

/** Loads the Maps JS API once. Rejects on a network failure or an early auth refusal. */
export function loadGoogle(key) {
  if (loadPromise) return loadPromise;
  if (window.google && window.google.maps) return (loadPromise = Promise.resolve());

  loadPromise = new Promise((resolve, reject) => {
    let settled = false;

    // Called by Google when the key is invalid, unauthorised, or over quota.
    window.gm_authFailure = () => {
      if (!settled) { settled = true; reject(new Error('GOOGLE_AUTH_FAILED')); }
      else if (authHandler) authHandler();
    };

    window.__flagdMapsReady = () => { settled = true; resolve(); };

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://maps.googleapis.com/maps/api/js'
      + `?key=${encodeURIComponent(key)}`
      + '&libraries=places'
      + '&loading=async'
      + '&callback=__flagdMapsReady';
    s.onerror = () => reject(new Error('GOOGLE_LOAD_FAILED'));
    document.head.appendChild(s);
  });
  return loadPromise;
}

/* ---------------------------------------------------------------- map style */
// The basemap in the brand's forest palette: sage land, white roads, deeper sage
// parks, muted green water. Desaturated on purpose — it has to stay quiet enough
// that the category-coloured flags are still the loudest thing on screen — and
// POIs stay off so the map reads as a surface, not a directory.
export const MONO_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#e9f0ec' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#63796f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f4f8f6' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#4d6459' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#d7e5dc' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8aa096' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#fafcfb' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dbe7e1' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#ccdcd4' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c3d8d1' }] },
  { featureType: 'water', elementType: 'labels.text', stylers: [{ visibility: 'off' }] },
];

/* ---------------------------------------------------------------- markers */
function flagSvg(color, mine) {
  const pole = mine ? '#000000' : '#3a3a3a';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">
    ${mine ? `<circle cx="5.5" cy="33" r="5" fill="#ff4b26" opacity=".22"/>` : ''}
    <rect x="4" y="4" width="3" height="30" rx="1.5" fill="${pole}"/>
    <path d="M8 5.5h17l-4.4 6.2L25 18H8z" fill="${color}"/>
    ${mine ? `<circle cx="5.5" cy="33" r="2.4" fill="#ff4b26"/>` : ''}
  </svg>`;
}

const svgUrl = (svg) => 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);

/* ---------------------------------------------------------------- factory */
export function createGoogleMap({ el, onFlagOpen }) {
  const g = window.google.maps;

  const map = new g.Map(el, {
    center: { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] },
    zoom: DEFAULT_ZOOM,
    styles: MONO_STYLE,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: g.ControlPosition.LEFT_BOTTOM },
    clickableIcons: false,
    gestureHandling: 'greedy',
    maxZoom: 20,
  });

  const info = new g.InfoWindow({ disableAutoPan: true });
  const markers = new Map();      // flagId -> google.maps.Marker
  let homeMarker = null;
  let ghost = null;
  let placeHandler = null;
  let lastSig = null;
  let courier = null;
  let courierLine = null;

  const icon = (catKey, mine) => ({
    url: svgUrl(flagSvg(cat(catKey).color, mine)),
    scaledSize: new g.Size(30, 36),
    anchor: new g.Point(5, 34),
  });

  const finiteLL = (ll) => Array.isArray(ll) && Number.isFinite(ll[0]) && Number.isFinite(ll[1]);
  const toLL = (ll) => ({ lat: ll[0], lng: ll[1] });

  map.addListener('click', (e) => {
    if (!placeHandler) return;
    const fn = placeHandler;
    api.stopPlacing();
    fn([e.latLng.lat(), e.latLng.lng()]);
  });

  map.addListener('mousemove', (e) => {
    if (placeHandler && ghost) ghost.setPosition(e.latLng);
  });

  const api = {
    raw: map,

    resize() {
      // Google recomputes on container resize, but nudge it after panel transitions.
      setTimeout(() => g.event.trigger(map, 'resize'), 60);
    },

    renderFlags(filterFn, force) {
      const list = state.flags.filter(f => finiteLL(f.ll) && (filterFn ? filterFn(f) : true));
      const sig = list.map(f => `${f.id}:${f.cat}:${f.status}:${f.bidCount || 0}`).join('|');
      if (!force && sig === lastSig) return;
      lastSig = sig;

      markers.forEach(m => m.setMap(null));
      markers.clear();

      list.forEach(f => {
        const c = cat(f.cat);
        const m = new g.Marker({
          position: toLL(f.ll),
          map,
          icon: icon(f.cat, f.mine),
          title: f.title,
          optimized: false,
        });
        const statusLine = f.status === 'hired' ? 'Pro hired'
          : f.status === 'done' ? 'Job completed'
          : `${f.bidCount || 0} bid${(f.bidCount || 0) === 1 ? '' : 's'}`;

        m.addListener('click', () => {
          info.setContent(
            `<div class="pop-t">${esc(f.title)}</div>
             <div class="pop-s">${esc(c.icon + ' ' + c.name)} · ${esc(statusLine)}</div>
             <div class="pop-s">${esc(f.address || '')}</div>
             <button class="pop-b" data-act="openFlag" data-id="${esc(f.id)}">
               ${f.mine ? 'Open my flag' : 'View this flag'}
             </button>`
          );
          info.open({ anchor: m, map });
        });
        markers.set(f.id, m);
      });
    },

    focusFlag(id, zoom = 15, withPopup = false) {
      const f = state.flags.find(x => x.id === id);
      if (!f || !finiteLL(f.ll)) return;
      map.panTo(toLL(f.ll));
      if (map.getZoom() < zoom) map.setZoom(zoom);
      if (withPopup) {
        const m = markers.get(id);
        if (m) g.event.trigger(m, 'click');
      }
    },

    flyTo(ll, zoom = 14) {
      if (!finiteLL(ll)) return;
      map.panTo(toLL(ll));
      map.setZoom(zoom);
    },

    center() {
      const c = map.getCenter();
      return c ? [c.lat(), c.lng()] : DEFAULT_CENTER;
    },

    setHome(ll, label) {
      if (!finiteLL(ll)) return;
      state.home = { ll, label: label || '' };
      if (homeMarker) homeMarker.setMap(null);
      homeMarker = new g.Marker({
        position: toLL(ll),
        map,
        clickable: false,
        zIndex: 1,
        icon: {
          path: g.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#000000',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
      });
      map.panTo(toLL(ll));
      if (map.getZoom() < 14) map.setZoom(14);
    },

    startPlacing(catKey, cb) {
      placeHandler = cb;
      map.setOptions({ draggableCursor: 'crosshair' });
      if (ghost) ghost.setMap(null);
      ghost = new g.Marker({
        position: map.getCenter(),
        map,
        clickable: false,
        zIndex: 999,
        opacity: 0.55,
        icon: icon(catKey, true),
      });
    },

    stopPlacing() {
      placeHandler = null;
      map.setOptions({ draggableCursor: null });
      if (ghost) { ghost.setMap(null); ghost = null; }
    },

    isPlacing: () => !!placeHandler,

    /** The hired pro moving toward the job, plus the line they are travelling. */
    setCourier(ll, destLL, arrived) {
      if (!finiteLL(ll)) return;
      if (!courier) {
        courier = new g.Marker({
          map, zIndex: 900, clickable: false,
          icon: {
            url: svgUrl(courierSvg()),
            scaledSize: new g.Size(34, 34),
            anchor: new g.Point(17, 17),
          },
        });
        courierLine = new g.Polyline({
          map, path: [], strokeColor: '#0d3b2f', strokeOpacity: .35, strokeWeight: 3,
        });
      }
      courier.setPosition(toLL(ll));
      courierLine.setPath(arrived ? [] : [toLL(ll), toLL(destLL)]);
      map.panTo(toLL(ll));
    },

    clearCourier() {
      if (courier) { courier.setMap(null); courier = null; }
      if (courierLine) { courierLine.setMap(null); courierLine = null; }
    },
  };

  return api;
}

function courierSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
    <circle cx="17" cy="17" r="15" fill="#0d3b2f" stroke="#fff" stroke-width="3"/>
    <path d="M9 19v-4l2-4h8l2 4h2v4h-1a2 2 0 0 1-4 0h-5a2 2 0 0 1-4 0z" fill="#fff"/>
  </svg>`;
}
