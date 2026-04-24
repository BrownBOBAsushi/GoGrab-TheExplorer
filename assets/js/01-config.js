//  CONSTANTS & CONFIGURATION
// ─────────────────────────────────────────────
const START_LNG = 103.8268;
const START_LAT = 1.285;
const GRAB_STYLE_THEME = 'basic';
// Use raw MapLibre with the proxied Grab style by default. This avoids the
// hosted widget mounting a second draggable visual layer above the map.
const PREFER_GRABMAPS_LIBRARY = false;
const GRABMAPS_LIBRARY_URL = 'https://maps.grab.com/developer/assets/js/grabmaps.es.js';
const API_BASE = window.location.origin.startsWith('http') && window.location.port === '3000'
  ? window.location.origin
  : 'http://localhost:3000';

// Degrees per pixel at zoom level ~15, latitude ~1.285
// Used for joystick movement math
const EARTH_CIRC = 40075016.686; // metres
const BASE_ZOOM  = 15;
const TILE_SIZE  = 512;

function getDegreesPerPixel(lat, zoom) {
  const metersPerPixel = (EARTH_CIRC * Math.cos(lat * Math.PI / 180)) / (TILE_SIZE * Math.pow(2, zoom));
  return metersPerPixel / 111320;
}

function getFallbackMapStyle() {
  return {
    version: 8,
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [`${API_BASE}/api/tiles/{z}/{x}/{y}`],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors © CARTO'
      }
    },
    layers: [{
      id: 'carto-dark',
      type: 'raster',
      source: 'carto-dark'
    }]
  };
}

function getMapViewportRect() {
  const container = map && typeof map.getContainer === 'function'
    ? map.getContainer()
    : null;

  if (container && typeof container.getBoundingClientRect === 'function') {
    return container.getBoundingClientRect();
  }

  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function projectToViewport(lng, lat) {
  if (!map) {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
  }

  const projected = map.project([lng, lat]);
  const rect = getMapViewportRect();
  return {
    x: rect.left + projected.x,
    y: rect.top + projected.y
  };
}

function getMapViewportCenter() {
  const rect = getMapViewportRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function getCurrentPlayerCoords() {
  // Keep gameplay tied to the simulated avatar position so Demo Jump and
  // proximity checks still work after GPS has been granted.
  if (Number.isFinite(playerLat) && Number.isFinite(playerLng)) {
    return {
      lat: playerLat,
      lng: playerLng,
      source: 'player'
    };
  }

  if (Number.isFinite(liveUserLat) && Number.isFinite(liveUserLng)) {
    return {
      lat: liveUserLat,
      lng: liveUserLng,
      source: 'gps'
    };
  }

  return {
    lat: START_LAT,
    lng: START_LNG,
    source: 'default'
  };
}

function resolveRawMap(candidate) {
  if (!candidate) return null;
  if (
    typeof candidate.on === 'function' &&
    typeof candidate.project === 'function' &&
    typeof candidate.addLayer === 'function'
  ) {
    return candidate;
  }

  const accessors = ['map', 'mapInstance', 'rawMap', 'maplibreMap', 'instance', '_map'];
  for (const key of accessors) {
    if (!candidate[key]) continue;
    const resolved = resolveRawMap(candidate[key]);
    if (resolved) return resolved;
  }

  if (typeof candidate.getMap === 'function') {
    try {
      const resolved = resolveRawMap(candidate.getMap());
      if (resolved) return resolved;
    } catch (_error) {
      // Ignore and continue.
    }
  }

  return null;
}

async function loadGrabMapsConstructor() {
  if (typeof window.GrabMapsLib === 'function') {
    return window.GrabMapsLib;
  }

  const mod = await import(GRABMAPS_LIBRARY_URL);
  const loadedCtor = mod?.GrabMapsLib || mod?.default || window.GrabMapsLib;
  if (typeof loadedCtor !== 'function') {
    throw new Error('GrabMapsLib constructor was not found after loading the hosted bundle');
  }

  return loadedCtor;
}

async function buildGrabMapsLibraryMap() {
  const GrabMapsLib = await loadGrabMapsConstructor();
  mapApp = new GrabMapsLib({
    container: 'map',
    apiKey: 'proxy',
    baseUrl: API_BASE,
    lat: START_LAT,
    lng: START_LNG,
    zoom: 16,
    interactive: true,
    navigation: true,
    attribution: true,
    buildings: true,
    labels: true,
    showSearchBar: false,
    showWaypointsModal: false,
    showContextMenu: false,
    showLayersMenu: false
  });

  const rawMap = resolveRawMap(mapApp);
  if (!rawMap) {
    throw new Error('GrabMapsLib initialized, but the underlying map instance could not be resolved');
  }

  return rawMap;
}

// ─────────────────────────────────────────────
//  POI DATA
// ─────────────────────────────────────────────
let POIS = [
  { id:'poi_1', name:'Media Link Bakery Stop', cat:'Traditional Bakery', icon:'🥐',
    lat:1.2847, lng:103.8278, distance:'420m',
    description:'Demo bakery stop near the One-North start point with pastries and quick breakfast bites.',
    missions:[{i:'📸',d:'Take a photo here',p:50},{i:'⭐',d:'Leave a food review',p:30},{i:'📍',d:'Check in',p:20}] },
  { id:'poi_2', name:'Portsdown Jerky House', cat:'Bak Kwa', icon:'🥩',
    lat:1.2856, lng:103.8271, distance:'510m',
    description:'Demo savory snack stop near the player start point with smoky takeaway bites.',
    missions:[{i:'📸',d:'Take a photo here',p:50},{i:'⭐',d:'Leave a food review',p:30},{i:'📍',d:'Check in',p:20}] },
  { id:'poi_3', name:'Mediapolis Porridge Corner', cat:'Local Porridge', icon:'🍚',
    lat:1.2832, lng:103.8263, distance:'680m',
    description:'Demo comfort-food stop near One-North for a warm porridge-style meal.',
    missions:[{i:'📸',d:'Snap the congee',p:40},{i:'⭐',d:'Rate the congee',p:25},{i:'📍',d:'Check in',p:20}] },
  { id:'poi_4', name:'Ayer Rajah Hawker Bites', cat:'Hawker', icon:'🍡',
    lat:1.2862, lng:103.8269, distance:'390m',
    description:'Demo hawker-style stop near the start point for quick local bites.',
    missions:[{i:'📸',d:'Take a photo here',p:50},{i:'⭐',d:'Leave a food review',p:30},{i:'📍',d:'Check in',p:20}] },
  { id:'poi_5', name:'One-North Snack Stop', cat:'Local Snacks', icon:'🍢',
    lat:1.2874, lng:103.8265, distance:'820m',
    description:'Demo local snacks stop near the player start point for lighter grab-and-go food.',
    missions:[{i:'📸',d:'Take a photo here',p:50},{i:'⭐',d:'Leave a food review',p:30},{i:'📍',d:'Check in',p:20}] },
];

// ─────────────────────────────────────────────
