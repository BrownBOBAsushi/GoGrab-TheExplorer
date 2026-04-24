function getPlayerScreenPosition() {
  const currentCoords = getCurrentPlayerCoords();
  if (!map || !Number.isFinite(currentCoords.lat) || !Number.isFinite(currentCoords.lng)) {
    return getMapViewportCenter();
  }
  return projectToViewport(currentCoords.lng, currentCoords.lat);
}

function getCurrentMapCenter() {
  if (!map) {
    return { lat: playerLat, lng: playerLng };
  }
  const center = map.getCenter();
  return { lat: center.lat, lng: center.lng };
}

function ensurePlayerMarker() {
  if (!map || playerMarker || typeof maplibregl === 'undefined' || !maplibregl.Marker) {
    return;
  }

  const el = document.createElement('div');
  el.className = 'player-marker';
  playerMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
    .setLngLat([START_LNG, START_LAT])
    .addTo(map);
}

function updatePlayerVisualPosition() {
  const pos = getPlayerScreenPosition();
  const currentCoords = getCurrentPlayerCoords();

  ensurePlayerMarker();
  if (playerMarker && Number.isFinite(currentCoords.lat) && Number.isFinite(currentCoords.lng)) {
    playerMarker.setLngLat([currentCoords.lng, currentCoords.lat]);
  }

  const player = document.getElementById('player');
  if (player) {
    player.style.left = `${pos.x}px`;
    player.style.top = `${pos.y}px`;
    player.style.transform = 'translate(-50%,-50%)';
  }
}

function syncPlayerToMap(options = {}) {
  const { animate = false, force = false, seedReveal = false } = options;
  const currentCoords = getCurrentPlayerCoords();

  if (!force && isMapBrowsing) return;

  isMapBrowsing = false;

  if (map && Number.isFinite(currentCoords.lat) && Number.isFinite(currentCoords.lng)) {
    if (animate && mapReady) {
      map.easeTo({ center: [currentCoords.lng, currentCoords.lat], duration: 500 });
    } else {
      map.jumpTo({ center: [currentCoords.lng, currentCoords.lat] });
    }
  }

  if (seedReveal) {
    lastRevealLat = currentCoords.lat;
    lastRevealLng = currentCoords.lng;
    if (revealedGeo.length === 0) {
      revealedGeo.push({ lat: currentCoords.lat, lng: currentCoords.lng });
    } else {
      revealedGeo[0] = { lat: currentCoords.lat, lng: currentCoords.lng };
    }
  }

  updatePOIPositions();
  updatePlayerVisualPosition();
  if (activePoi) updateSpinState();
}

function updateLiveLocation(latitude, longitude, options = {}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (!(latitude > 1.1 && latitude < 1.5 && longitude > 103.5 && longitude < 104.1)) return false;

  liveUserLat = latitude;
  liveUserLng = longitude;

  if (!options.keepPlayerSynced) {
    return true;
  }

  playerLat = latitude;
  playerLng = longitude;
  syncPlayerToMap({
    animate: options.animate !== false,
    force: options.forceRecenter === true,
    seedReveal: options.seedReveal === true
  });
  refreshTouristPOIs();
  return true;
}

function getBestRouteOrigin() {
  if (Number.isFinite(liveUserLat) && Number.isFinite(liveUserLng)) {
    return {
      lat: liveUserLat,
      lng: liveUserLng,
      label: 'Route from live GPS'
    };
  }

  return {
    lat: playerLat,
    lng: playerLng,
    label: isMapBrowsing ? 'Route from player position' : 'Route from current in-app position'
  };
}

function getFreshGeolocation() {
  if (!navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const ok = updateLiveLocation(latitude, longitude, { keepPlayerSynced: false });
        resolve(ok ? { lat: latitude, lng: longitude, label: 'Route from live GPS' } : null);
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 15000 }
    );
  });
}

function resetRouteMeta() {
  activeRouteOriginLabel = '';
  activeRouteDistance = '';
  activeRouteDuration = '';
  ['routeOriginPill', 'routeStatsPill'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.classList.remove('is-visible');
  });
  updateRouteSummary();
}

function updateRouteSummary() {
  const summaryEl = document.getElementById('routeSummaryHud');
  const labelEl = document.getElementById('routeSummaryLabel');
  const valueEl = document.getElementById('routeSummaryValue');
  const metaEl = document.getElementById('routeSummaryMeta');

  if (!summaryEl || !labelEl || !valueEl || !metaEl) return;

  const hasRouteMeta = Boolean(activeRouteDuration || activeRouteDistance || activeRouteOriginLabel);
  summaryEl.classList.toggle('is-visible', hasRouteMeta && appMode === 'tourist');

  if (!hasRouteMeta) return;

  labelEl.textContent = 'Walk ETA';
  valueEl.textContent = activeRouteDuration || 'ETA soon';
  metaEl.textContent = [activeRouteDistance, activeRouteOriginLabel].filter(Boolean).join(' • ');
}

function updateRouteMeta(distance, duration) {
  const originEl = document.getElementById('routeOriginPill');
  const statsEl = document.getElementById('routeStatsPill');
  activeRouteDistance = distance || '';
  activeRouteDuration = duration || '';

  if (originEl) {
    originEl.textContent = activeRouteOriginLabel || 'Route ready';
    originEl.classList.toggle('is-visible', Boolean(activeRouteOriginLabel));
  }

  if (statsEl) {
    const bits = [activeRouteDuration ? `ETA ${activeRouteDuration}` : '', activeRouteDistance].filter(Boolean);
    statsEl.textContent = bits.join(' • ');
    statsEl.classList.toggle('is-visible', bits.length > 0);
  }
  updateRouteSummary();
}

function renderReviewSection(payload = {}) {
  const list = document.getElementById('reviewsList');
  const source = document.getElementById('reviewsSource');
  const summary = document.getElementById('reviewsSummary');
  if (!list || !source || !summary) return;

  const reviews = Array.isArray(payload.reviews) ? payload.reviews.slice(0, 3) : [];
  source.textContent = payload.sourceLabel || 'Local notes';
  summary.textContent = payload.summary || 'Quick comparison notes to help choose your next stop.';

  if (reviews.length === 0) {
    list.innerHTML = '<div class="review-empty">No comparison notes yet for this stop.</div>';
    return;
  }

  list.innerHTML = reviews.map((review) => {
    const rating = Number.isFinite(Number(review.rating)) ? `${Number(review.rating).toFixed(1)}★` : '';
    return `
      <div class="review-card">
        <div class="review-topline">
          <div class="review-author">${review.author || 'Traveler note'}</div>
          <div class="review-rating">${rating}</div>
        </div>
        <div class="review-text">${review.text || ''}</div>
      </div>
    `;
  }).join('');
}

async function loadPoiReviews(poi) {
  const poiId = poi.id;
  renderReviewSection({
    sourceLabel: 'Loading',
    summary: 'Pulling comparison notes for this stop...',
    reviews: []
  });

  try {
    const resp = await fetch(
      `${buildApiUrl('/api/reviews')}?id=${encodeURIComponent(poi.id)}&name=${encodeURIComponent(poi.name)}&lat=${poi.lat}&lng=${poi.lng}&category=${encodeURIComponent(poi.cat || '')}`
    );
    const data = await resp.json();
    if (!activePoi || activePoi.id !== poiId) return;
    renderReviewSection({
      sourceLabel: data.sourceLabel || data.source || 'Local notes',
      summary: data.summary,
      reviews: data.reviews
    });
  } catch (_error) {
    if (!activePoi || activePoi.id !== poiId) return;
    renderReviewSection({
      sourceLabel: poi.reviewSource || 'Local notes',
      summary: poi.reviewSummary || 'Using built-in comparison notes for the demo.',
      reviews: poi.reviews || []
    });
  }
}

// ─────────────────────────────────────────────
