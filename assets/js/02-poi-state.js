//  STATE
// ─────────────────────────────────────────────
let map           = null;
let mapApp        = null;
let playerLat     = START_LAT;
let playerLng     = START_LNG;
let appMode       = 'tourist';    // 'tourist' | 'explore'
let totalPoints   = 0;
let exploredPct   = 0;
let liveUserLat   = null;
let liveUserLng   = null;
let gpsWatchId    = null;
let mapReady      = false;
let hasCenteredOnInitialGps = false;

let activePoi     = null;         // currently open POI
let spinTriggered = false;
let spinUnlocked  = false;
let isMapBrowsing = false;
let activeRouteOriginLabel = '';
let activeRouteDistance = '';
let activeRouteDuration = '';

let poiState      = {};           // { poiId: { revealed, spun, el, marker } }
let recommendedPois = [];
let selectedPoiId = null;
let recommendationSource = 'nearby';
let trayCollapsed = true;

// Fog-of-war state
let fogCanvas, fogCtx;
let revealedGeo   = [];           // [{lat,lng}] of revealed centres
let lastRevealLat = START_LAT;
let lastRevealLng = START_LNG;
const REVEAL_RADIUS_PX  = 130;    // px around player
const REVEAL_STEP_DEG   = 0.0002; // ~22m

// Joystick state
// WASD
const keys = {};

// Particle colours
const PARTICLE_COLOURS = ['#00B14F','#F59E0B','#ffffff','#00d45f'];

function resetKeyboardInput() {
  Object.keys(keys).forEach(key => { keys[key] = false; });
}

function isTypingInInput() {
  const active = document.activeElement;
  if (!active) return false;
  const tag = active.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || active.isContentEditable;
}

function buildApiUrl(path) {
  return `${API_BASE}${path}`;
}

function distanceBetween(lat1, lng1, lat2, lng2) {
  const toRad = value => value * Math.PI / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return '';
  return distanceMeters < 1000
    ? `${Math.round(distanceMeters)}m`
    : `${(distanceMeters / 1000).toFixed(1)}km`;
}

function iconForCategory(category) {
  const label = (category || '').toLowerCase();
  if (label.includes('bakery') || label.includes('pastry')) return '🥐';
  if (label.includes('bak kwa') || label.includes('bbq')) return '🥩';
  if (label.includes('porridge') || label.includes('congee')) return '🍚';
  if (label.includes('hawker') || label.includes('food')) return '🍜';
  if (label.includes('snack') || label.includes('dessert')) return '🍡';
  if (label.includes('cafe') || label.includes('coffee')) return '☕';
  return '📍';
}

function normalizePoi(rawPoi, index) {
  const lat = Number(rawPoi.lat ?? rawPoi.latitude ?? rawPoi.location?.latitude);
  const lng = Number(rawPoi.lng ?? rawPoi.longitude ?? rawPoi.location?.longitude);
  const category = rawPoi.cat || rawPoi.category || rawPoi.business_type || 'Point of Interest';
  return {
    id: rawPoi.id || rawPoi.poi_id || `poi_live_${index + 1}`,
    name: rawPoi.name || `GrabMaps Stop ${index + 1}`,
    cat: category,
    icon: rawPoi.icon || iconForCategory(category),
    lat,
    lng,
    distance: rawPoi.distance || formatDistance(distanceBetween(playerLat, playerLng, lat, lng)),
    description: rawPoi.description || rawPoi.formatted_address || 'GrabMaps live point of interest.',
    reviews: rawPoi.reviews || [],
    reviewSource: rawPoi.reviewSource || '',
    reviewSummary: rawPoi.reviewSummary || '',
    missions: rawPoi.missions || [
      { i:'📸', d:'Take a photo here', p:50 },
      { i:'⭐', d:'Leave a food review', p:30 },
      { i:'📍', d:'Check in', p:20 }
    ]
  };
}

function replacePOIs(nextPois) {
  const normalized = nextPois
    .map((poi, index) => normalizePoi(poi, index))
    .filter((poi) => Number.isFinite(poi.lat) && Number.isFinite(poi.lng));

  if (normalized.length === 0) return;

  Object.values(poiState).forEach((state) => {
    if (state?.marker) state.marker.remove();
  });

  POIS = normalized;
  poiState = {};
  activePoi = null;

  const layer = document.getElementById('poiLayer');
  layer.innerHTML = '';
  buildPOILayer();

  if (appMode === 'tourist') {
    refreshTouristPOIs();
  }

  updatePOIPositions();
}

function updatePoiDistances(referenceLat, referenceLng) {
  const fallbackCoords = getCurrentPlayerCoords();
  const baseLat = Number.isFinite(referenceLat) ? referenceLat : fallbackCoords.lat;
  const baseLng = Number.isFinite(referenceLng) ? referenceLng : fallbackCoords.lng;
  for (const poi of POIS) {
    const nextDistance = formatDistance(
      distanceBetween(baseLat, baseLng, poi.lat, poi.lng)
    );
    if (nextDistance) {
      poi.distance = nextDistance;
    }
  }
}

function getPoiById(poiId) {
  return POIS.find((poi) => poi.id === poiId) || null;
}

function isPoiSpun(poi) {
  return Boolean(poi && poiState[poi.id]?.spun);
}

function getNearestPois(limit = 3, referenceLat, referenceLng) {
  const fallbackCoords = getCurrentPlayerCoords();
  const baseLat = Number.isFinite(referenceLat) ? referenceLat : fallbackCoords.lat;
  const baseLng = Number.isFinite(referenceLng) ? referenceLng : fallbackCoords.lng;
  return [...POIS]
    .sort((a, b) =>
      distanceBetween(baseLat, baseLng, a.lat, a.lng) -
      distanceBetween(baseLat, baseLng, b.lat, b.lng)
    )
    .slice(0, limit);
}

function getReasonTagsForPoi(poi) {
  const tags = [];
  const currentCoords = getCurrentPlayerCoords();
  const walkMinutes = Math.max(2, Math.round(distanceBetween(currentCoords.lat, currentCoords.lng, poi.lat, poi.lng) / 80));
  tags.push(`${walkMinutes} min away`);

  const label = `${poi.cat || ''} ${poi.reviewSummary || ''}`.toLowerCase();
  if (label.includes('bakery') || label.includes('pastry')) {
    tags.push('Best for pastries');
  } else if (label.includes('bak kwa') || label.includes('savory')) {
    tags.push('Savory souvenir stop');
  } else if (label.includes('porridge') || label.includes('comfort')) {
    tags.push('Comfort breakfast');
  } else if (label.includes('hawker')) {
    tags.push('Hawker classic');
  } else if (label.includes('snack') || label.includes('dessert')) {
    tags.push('Quick local bite');
  } else if (label.includes('coffee') || label.includes('cafe')) {
    tags.push('Coffee break');
  } else {
    tags.push('Local discovery');
  }

  return tags.slice(0, 2);
}

function getRecommendedPoiObjects() {
  return recommendedPois
    .map((poi) => getPoiById(poi.id) || poi)
    .filter(Boolean);
}

function getNextRecommendedPoi(excludedPoiId = selectedPoiId) {
  const remaining = getRecommendedPoiObjects().filter(
    (poi) => !isPoiSpun(poi) && poi.id !== excludedPoiId
  );
  return remaining[0] || null;
}

function updateRewardContinuation() {
  const rewardBtn = document.getElementById('rewardContinueBtn');
  if (!rewardBtn) return;
  rewardBtn.textContent = getNextRecommendedPoi(activePoi?.id)
    ? 'See next nearby stop'
    : 'Back to nearby stops';
}

function updateTouristChrome() {
  const tray = document.getElementById('recommendationTray');
  const recenterBtn = document.getElementById('recenterBtn');
  const isTourist = appMode === 'tourist';

  if (tray) tray.classList.toggle('is-hidden', !isTourist);
  if (recenterBtn) recenterBtn.classList.toggle('is-hidden', !isTourist);
  syncRecommendationTrayCollapse();
  updateRouteSummary();
}

function syncRecommendationTrayCollapse() {
  const tray = document.getElementById('recommendationTray');
  const btn = document.getElementById('toggleTrayBtn');
  const label = document.getElementById('recommendationCollapsedLabel');
  if (!tray) return;

  tray.classList.toggle('is-collapsed', trayCollapsed);

  const visibleCount = getRecommendedPoiObjects().filter((poi) => !isPoiSpun(poi)).slice(0, 3).length;
  if (label) {
    label.textContent = visibleCount > 0 ? `${visibleCount} stop${visibleCount === 1 ? '' : 's'}` : 'Stops';
  }

  if (btn) {
    btn.textContent = trayCollapsed ? 'Open' : 'Hide';
    btn.setAttribute('aria-label', trayCollapsed ? 'Expand nearby stops' : 'Collapse nearby stops');
  }
}

function toggleRecommendationTray() {
  trayCollapsed = !trayCollapsed;
  syncRecommendationTrayCollapse();
}

function updatePOIVisualStates() {
  const recommendedIds = new Set(getRecommendedPoiObjects().map((poi) => poi.id));

  for (const poi of POIS) {
    const state = poiState[poi.id];
    if (!state) continue;
    state.el.classList.toggle('highlighted', recommendedIds.has(poi.id) && !state.spun);
    state.el.classList.toggle('selected', selectedPoiId === poi.id);
  }
}

function renderRecommendationTray() {
  const tray = document.getElementById('recommendationTray');
  const cards = document.getElementById('recommendationCards');
  const eyebrow = document.getElementById('recommendationEyebrow');
  const title = document.getElementById('recommendationTitle');
  const subtitle = document.getElementById('recommendationSubtitle');

  if (!tray || !cards || !eyebrow || !title || !subtitle) return;

  updateTouristChrome();
  if (appMode !== 'tourist') return;

  const trayPois = getRecommendedPoiObjects().filter((poi) => !isPoiSpun(poi)).slice(0, 3);
  eyebrow.textContent = recommendationSource === 'ai' ? 'Picked for your vibe' : 'Nearby for you';
  title.textContent = trayPois.length > 0
    ? `${trayPois.length} good stop${trayPois.length === 1 ? '' : 's'} around you`
    : 'No nearby stops yet';
  subtitle.textContent = recommendationSource === 'ai'
    ? 'AI matched these stops to what you asked for'
    : 'Tap a card to inspect the stop';

  if (trayPois.length === 0) {
    cards.innerHTML = '<div class="recommendation-empty">Try asking the AI for another vibe, or move around to refresh nearby stops.</div>';
    return;
  }

  cards.innerHTML = trayPois.map((poi) => `
    <button class="recommendation-card${selectedPoiId === poi.id ? ' is-active' : ''}${isPoiSpun(poi) ? ' is-spun' : ''}" data-poi-id="${poi.id}" type="button">
      <div class="recommendation-card-top">
        <div class="recommendation-icon">${poi.icon || '📍'}</div>
        <div class="recommendation-distance">${poi.distance}</div>
      </div>
      <div class="recommendation-name">${poi.name}</div>
      <div class="recommendation-cat">${poi.cat}</div>
      <div class="recommendation-tags">
        ${getReasonTagsForPoi(poi).map((tag) => `<span class="recommendation-tag">${tag}</span>`).join('')}
      </div>
    </button>
  `).join('');

  cards.querySelectorAll('[data-poi-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const poi = getPoiById(card.getAttribute('data-poi-id'));
      if (poi) {
        focusPoi(poi, { openModal: true, recenterToPoi: true });
      }
    });
  });

  syncRecommendationTrayCollapse();
}

function setSelectedPoi(poiOrId) {
  const poi = typeof poiOrId === 'string' ? getPoiById(poiOrId) : poiOrId;
  selectedPoiId = poi?.id || null;
  updatePOIVisualStates();
  renderRecommendationTray();
}

function setRecommendedPois(nextPois, source = 'nearby') {
  recommendedPois = nextPois
    .map((poi) => getPoiById(poi.id) || poi)
    .filter(Boolean)
    .filter((poi, index, list) => list.findIndex((candidate) => candidate.id === poi.id) === index)
    .slice(0, 3);
  recommendationSource = source;

  const selectedPoi = getPoiById(selectedPoiId);
  const selectedStillRelevant = selectedPoi && recommendedPois.some((poi) => poi.id === selectedPoi.id) && !isPoiSpun(selectedPoi);
  if (!selectedStillRelevant) {
    const nextSelected = recommendedPois.find((poi) => !isPoiSpun(poi)) || recommendedPois[0] || null;
    selectedPoiId = nextSelected?.id || null;
  }

  updatePOIVisualStates();
  renderRecommendationTray();
  updateRewardContinuation();
}

function refreshTouristPOIs() {
  if (appMode !== 'tourist') return;
  updatePoiDistances();
  revealAllPOIs();
  updatePOIPositions();
  const preservedAiPois = recommendationSource === 'ai' && recommendedPois.length > 0
    ? getRecommendedPoiObjects()
    : [];
  const nextRecommended = preservedAiPois.length > 0
    ? preservedAiPois
    : getNearestPois(Math.min(3, POIS.length));
  setRecommendedPois(nextRecommended, preservedAiPois.length > 0 ? 'ai' : 'nearby');
}

function focusPoi(poi, options = {}) {
  const { openModal = false, recenterToPoi = false } = options;
  if (!poi) return;

  setSelectedPoi(poi);

  if (recenterToPoi && map) {
    isMapBrowsing = true;
    map.easeTo({ center: [poi.lng, poi.lat], duration: 650 });
  }

  if (openModal) {
    openPOI(poi);
  }
}

function recenterToPlayer() {
  if (appMode !== 'tourist') return;
  resumePlayerFollow();
  updatePOIVisualStates();
  showToast('Recentered on your location', window.innerWidth - 110, window.innerHeight - 230);
}

function resumePlayerFollow() {
  syncPlayerToMap({ animate: true, force: true });
}

