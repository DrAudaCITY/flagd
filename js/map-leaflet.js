// map-leaflet.js — fallback map surface, used only until a Google Maps key is set.
// Same shape as map-google.js. Delete this file (and its branch in map.js) once
// Google Maps is configured everywhere Flagd runs.

import { DEFAULT_CENTER, DEFAULT_ZOOM, cat } from './data.js';
import { state } from './store.js';
import { esc } from './ui.js';

const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

let loadPromise = null;

/** Pulls Leaflet from the CDN on demand, so a Google-configured build never pays for it. */
export function loadLeaflet() {
  if (loadPromise) return loadPromise;
  if (window.L) return (loadPromise = Promise.resolve());

  loadPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    link.crossOrigin = '';
    document.head.appendChild(link);

    const s = document.createElement('script');
    s.src = LEAFLET_JS;
    s.crossOrigin = '';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('LEAFLET_LOAD_FAILED'));
    document.head.appendChild(s);
  });
  return loadPromise;
}

function flagSvg(color, mine) {
  const pole = mine ? '#000000' : '#3a3a3a';
  return `<svg width="30" height="36" viewBox="0 0 30 36">
    ${mine ? `<circle cx="5.5" cy="33" r="5" fill="#ff4b26" opacity=".22"/>` : ''}
    <rect x="4" y="4" width="3" height="30" rx="1.5" fill="${pole}"/>
    <path d="M8 5.5h17l-4.4 6.2L25 18H8z" fill="${color}"/>
    ${mine ? `<circle cx="5.5" cy="33" r="2.4" fill="#ff4b26"/>` : ''}
  </svg>`;
}

export function createLeafletMap({ el }) {
  const L = window.L;

  const map = L.map(el, {
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,
  });

  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  // Leaflet can keep the previous zoom level's tiles painted on top after a
  // programmatic move; pruning once movement settles clears them.
  const prune = () => {
    if (typeof tiles._pruneTiles === 'function') {
      try { tiles._pruneTiles(); } catch (e) { /* worst case is a blurry tile */ }
    }
  };
  map.on('moveend zoomend', prune);

  const flagLayer = L.layerGroup().addTo(map);
  const markers = new Map();
  let homeMarker = null;
  let ghost = null;
  let courier = null;
  let courierLine = null;
  let placeHandler = null;
  let lastSig = null;
  let pendingRender = null;

  const finiteLL = (ll) => Array.isArray(ll) && Number.isFinite(ll[0]) && Number.isFinite(ll[1]);

  const flagIcon = (catKey, mine) => L.divIcon({
    className: 'flagpin' + (mine ? ' mine' : ''),
    html: flagSvg(cat(catKey).color, mine),
    iconSize: [30, 36],
    iconAnchor: [5, 34],
    popupAnchor: [10, -28],
  });

  map.on('click', (e) => {
    if (!placeHandler) return;
    const fn = placeHandler;
    api.stopPlacing();
    fn([e.latlng.lat, e.latlng.lng]);
  });
  map.on('mousemove', (e) => { if (placeHandler && ghost) ghost.setLatLng(e.latlng); });

  const api = {
    raw: map,

    resize() { setTimeout(() => map.invalidateSize(), 60); },

    renderFlags(filterFn, force) {
      const list = state.flags.filter(f => finiteLL(f.ll) && (filterFn ? filterFn(f) : true));
      const sig = list.map(f => `${f.id}:${f.cat}:${f.status}:${f.bidCount || 0}`).join('|');
      if (!force && sig === lastSig) return;
      if (map._animatingZoom) {
        if (!pendingRender) {
          pendingRender = () => { pendingRender = null; api.renderFlags(filterFn, true); };
          map.once('zoomend moveend', () => pendingRender && pendingRender());
        }
        return;
      }
      lastSig = sig;

      flagLayer.clearLayers();
      markers.clear();

      list.forEach(f => {
        const c = cat(f.cat);
        const m = L.marker(f.ll, { icon: flagIcon(f.cat, f.mine), riseOnHover: true, title: f.title });
        const statusLine = f.status === 'hired' ? 'Pro hired'
          : f.status === 'done' ? 'Job completed'
          : `${f.bidCount || 0} bid${(f.bidCount || 0) === 1 ? '' : 's'}`;

        m.bindPopup(
          `<div class="pop-t">${esc(f.title)}</div>
           <div class="pop-s">${esc(c.icon + ' ' + c.name)} · ${esc(statusLine)}</div>
           <div class="pop-s">${esc(f.address || '')}</div>
           <button class="pop-b" data-act="openFlag" data-id="${esc(f.id)}">
             ${f.mine ? 'Open my flag' : 'View this flag'}
           </button>`,
          { closeButton: false, offset: [0, -4], autoPan: false }
        );
        m.addTo(flagLayer);
        markers.set(f.id, m);
      });
    },

    focusFlag(id, zoom = 15, withPopup = false) {
      const f = state.flags.find(x => x.id === id);
      if (!f || !finiteLL(f.ll)) return;
      map.stop();
      const z = Number.isFinite(map.getZoom()) ? Math.max(map.getZoom(), zoom) : zoom;
      map.flyTo(f.ll, z, { duration: 0.6 });
      if (!withPopup) return;
      const m = markers.get(id);
      if (m) map.once('moveend', () => m.openPopup());
    },

    flyTo(ll, zoom = 14) {
      if (!finiteLL(ll)) return;
      map.stop();
      map.flyTo(ll, zoom, { duration: 0.7 });
    },

    center() {
      const c = map.getCenter();
      return [c.lat, c.lng];
    },

    setHome(ll, label) {
      if (!finiteLL(ll)) return;
      map.stop();
      state.home = { ll, label: label || '' };
      if (homeMarker) map.removeLayer(homeMarker);
      homeMarker = L.marker(ll, {
        icon: L.divIcon({ className: 'homepin', html: '<i></i>', iconSize: [16, 16], iconAnchor: [8, 8] }),
        zIndexOffset: -100,
        interactive: false,
      }).addTo(map);
      map.flyTo(ll, Math.max(map.getZoom(), 14), { duration: 0.7 });
    },

    startPlacing(catKey, cb) {
      placeHandler = cb;
      map.getContainer().style.cursor = 'crosshair';
      if (ghost) map.removeLayer(ghost);
      ghost = L.marker(map.getCenter(), {
        icon: L.divIcon({ className: 'flagpin ghost', html: flagSvg(cat(catKey).color, true), iconSize: [30, 36], iconAnchor: [5, 34] }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(map);
    },

    stopPlacing() {
      placeHandler = null;
      map.getContainer().style.cursor = '';
      if (ghost) { map.removeLayer(ghost); ghost = null; }
    },

    isPlacing: () => !!placeHandler,

    setCourier(ll, destLL, arrived) {
      if (!finiteLL(ll)) return;
      const html = `<svg width="34" height="34" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="15" fill="#0d3b2f" stroke="#fff" stroke-width="3"/>
        <path d="M9 19v-4l2-4h8l2 4h2v4h-1a2 2 0 0 1-4 0h-5a2 2 0 0 1-4 0z" fill="#fff"/></svg>`;
      if (!courier) {
        courier = L.marker(ll, {
          icon: L.divIcon({ className: 'flagpin', html, iconSize: [34, 34], iconAnchor: [17, 17] }),
          interactive: false, zIndexOffset: 900,
        }).addTo(map);
        courierLine = L.polyline([], { color: '#0d3b2f', opacity: .35, weight: 3 }).addTo(map);
      }
      courier.setLatLng(ll);
      courierLine.setLatLngs(arrived ? [] : [ll, destLL]);
      map.panTo(ll, { animate: true });
    },

    clearCourier() {
      if (courier) { map.removeLayer(courier); courier = null; }
      if (courierLine) { map.removeLayer(courierLine); courierLine = null; }
    },
  };

  return api;
}
