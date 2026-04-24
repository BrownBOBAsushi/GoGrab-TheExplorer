//  MAP INIT
// ─────────────────────────────────────────────
async function initMap() {
  if (PREFER_GRABMAPS_LIBRARY) {
    try {
      map = await buildGrabMapsLibraryMap();
      console.log('Map initialized with GrabMapsLib');
    } catch (error) {
      console.warn('GrabMapsLib init failed, falling back to raw MapLibre bootstrap', error);
    }
  }

  if (!map) {
    map = new maplibregl.Map({
      container: 'map',
      style: getFallbackMapStyle(),
      center: [START_LNG, START_LAT],
      zoom: 16,
      interactive: true,
      dragPan: true,
      scrollZoom: true,
      doubleClickZoom: true,
      keyboard: false
    });

    map.touchZoomRotate.enable();
    map.touchPitch.disable();
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('error', (e) => {
      console.warn('MapLibre error:', e?.error?.message || e);
    });
  }

  const handleMapReady = () => {
    mapReady = true;
    console.log('Map loaded');
    if (Number.isFinite(playerLat) && Number.isFinite(playerLng)) {
      syncPlayerToMap({ animate: false, force: true, seedReveal: hasCenteredOnInitialGps });
    } else {
      updatePlayerVisualPosition();
    }
  };

  if (typeof map.loaded === 'function' && map.loaded()) {
    handleMapReady();
  } else {
    map.on('load', handleMapReady);
  }

  map.on('move', () => {
    updatePOIPositions();
    updatePlayerVisualPosition();
  });

  map.on('dragstart', () => {
    isMapBrowsing = true;
    updatePlayerVisualPosition();
  });

  map.on('dragend', () => {
    updatePOIPositions();
    updatePlayerVisualPosition();
    if (activePoi) updateSpinState();
  });

  map.on('zoomstart', () => {
    isMapBrowsing = true;
    updatePlayerVisualPosition();
  });

  map.on('zoomend', () => {
    updatePOIPositions();
    updatePlayerVisualPosition();
    if (activePoi) updateSpinState();
  });
}

// ─────────────────────────────────────────────
//  POI LAYER
// ─────────────────────────────────────────────
function buildPOILayer() {
  for (const poi of POIS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'poi';
    wrapper.id = 'poi-' + poi.id;
    wrapper.innerHTML = `
      <div class="poi-ring"></div>
      <div class="poi-face">${poi.icon}</div>
      <div class="poi-needle"></div>
    `;
    wrapper.addEventListener('click', () => openPOI(poi));

    const marker = new maplibregl.Marker({ element: wrapper, anchor: 'bottom' })
      .setLngLat([poi.lng, poi.lat])
      .addTo(map);

    poiState[poi.id] = { revealed: false, spun: false, el: wrapper, marker };
  }
}

function updatePOIPositions() {
  if (!map) return;
  for (const poi of POIS) {
    const state = poiState[poi.id];
    if (!state) continue;
    const isVisible = state.revealed || appMode !== 'explore';
    state.el.style.display = isVisible ? 'block' : 'none';
    // setLngLat omitted — POI coordinates are fixed at creation time.
    // maplibre repositions markers automatically on every map move.
  }
}

function revealAllPOIs() {
  for (const poi of POIS) {
    const state = poiState[poi.id];
    if (!state.revealed) {
      state.revealed = true;
      state.el.classList.add('revealed');
    }
  }
}

// ─────────────────────────────────────────────
//  MODAL LOGIC
// ─────────────────────────────────────────────
function openPOI(poi) {
  activePoi = poi;
  spinTriggered = false;
  resetRouteMeta();
  setSelectedPoi(poi);

  // Populate info view
  document.getElementById('mIcon').textContent    = poi.icon || '📍';
  document.getElementById('mName').textContent    = poi.name;
  document.getElementById('mCat').textContent     = poi.cat;
  document.getElementById('mDist').textContent    = '📍 ' + poi.distance;
  document.getElementById('mCatTag').textContent  = poi.cat;
  document.getElementById('mDescInfo').textContent = poi.description || '';

  showView('viewInfo');
  document.getElementById('modal').classList.add('open');
  updateSpinState();
  loadPoiReviews(poi);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  activePoi = null;
  spinTriggered = false;
  updateRewardContinuation();
}

function continueAfterReward() {
  const nextPoi = getNextRecommendedPoi(activePoi?.id);
  closeModal();
  if (nextPoi) {
    focusPoi(nextPoi, { openModal: false, recenterToPoi: false });
    showToast('Next nearby stop is ready', window.innerWidth / 2, window.innerHeight - 170);
  }
}

function showView(id) {
  document.querySelectorAll('.modal-view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'viewSpin') updateSpinState();
}

function goToSpin() {
  showView('viewSpin');
  // Populate spin view meta
  if (activePoi) {
    document.getElementById('vsTitle').textContent    = activePoi.name;
    document.getElementById('mDistSpin').textContent  = '📍 ' + activePoi.distance;
    document.getElementById('mCatSpin').textContent   = activePoi.cat;
    document.getElementById('mDesc').textContent      = activePoi.description || '';
    document.getElementById('msDisc').textContent     = activePoi.icon || '🎰';
  }
  updateSpinState();
  setupSpinDisc();
}

// ─────────────────────────────────────────────
//  PROXIMITY SPIN LOCK
// ─────────────────────────────────────────────
function updateSpinState() {
  if (!activePoi || !map) return;
  const sp = projectToViewport(activePoi.lng, activePoi.lat);
  const playerPos = getPlayerScreenPosition();
  const dist = Math.hypot(sp.x - playerPos.x, sp.y - playerPos.y);
  const nearby = dist <= 80;
  spinUnlocked = nearby;

  const wrap   = document.getElementById('msDiscWrap');
  const hint   = document.getElementById('msHint');
  const status = document.getElementById('proximityStatus');

  if (wrap) {
    wrap.style.opacity       = nearby ? '1' : '0.35';
    wrap.style.pointerEvents = nearby ? 'auto' : 'none';
  }
  if (hint && !spinTriggered) {
    hint.textContent = nearby ? 'Drag to spin' : 'Get closer first';
  }
  if (status) {
    status.textContent = nearby
      ? "✓ You're here — spin to unlock!"
      : `Get closer to unlock the spin (${Math.round(dist)}px away)`;
    status.style.color = nearby ? 'var(--grab-green)' : 'rgba(255,255,255,.45)';
  }

  // Update info view spin button label
  const goBtn = document.getElementById('goSpinBtn');
  if (goBtn) {
    goBtn.textContent = nearby ? '🎰 SPIN THIS STOP' : '🎰 SPIN THIS STOP (get closer)';
    goBtn.style.opacity = nearby ? '1' : '0.7';
  }
}

// ─────────────────────────────────────────────
//  SPIN DISC DRAG
// ─────────────────────────────────────────────
let discStartAngle = 0;
let discCurAngle   = 0;
let discTotalDrag  = 0;
const SPIN_THRESHOLD = 400; // total drag degrees to trigger reward

function setupSpinDisc() {
  const disc = document.getElementById('msDisc');
  const wrap = document.getElementById('msDiscWrap');
  if (!disc || !wrap) return;

  disc.style.transform = 'rotate(0deg)';
  discTotalDrag = 0;

  function getAngle(e) {
    const rect = wrap.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top  + rect.height / 2;
    const px = (e.touches ? e.touches[0].clientX : e.clientX) - cx;
    const py = (e.touches ? e.touches[0].clientY : e.clientY) - cy;
    return Math.atan2(py, px) * 180 / Math.PI;
  }

  let dragging = false;
  let lastAngle = 0;

  function onStart(e) {
    if (spinTriggered) return;
    dragging = true;
    lastAngle = getAngle(e);
    e.preventDefault();
  }
  function onMove(e) {
    if (!dragging || spinTriggered) return;
    e.preventDefault();
    const angle = getAngle(e);
    let delta = angle - lastAngle;
    if (delta >  180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngle = angle;
    discCurAngle += delta;
    discTotalDrag += Math.abs(delta);
    disc.style.transform = `rotate(${discCurAngle}deg)`;
    if (discTotalDrag >= SPIN_THRESHOLD) {
      dragging = false;
      triggerSpin();
    }
  }
  function onEnd() { dragging = false; }

  disc.removeEventListener('mousedown', onStart);
  disc.removeEventListener('touchstart', onStart);
  disc.addEventListener('mousedown', onStart);
  disc.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
}

function triggerSpin() {
  if (spinTriggered) return;
  spinTriggered = true;

  const disc = document.getElementById('msDisc');
  if (disc) {
    disc.style.transition = 'transform .8s cubic-bezier(.25,.46,.45,.94)';
    disc.style.transform  = `rotate(${discCurAngle + 1080}deg)`;
  }

  if (activePoi && !poiState[activePoi.id].spun) {
    poiState[activePoi.id].spun = true;
    poiState[activePoi.id].el.classList.add('spun');
    poiState[activePoi.id].el.classList.remove('highlighted');
  }

  updatePOIVisualStates();
  renderRecommendationTray();
  updateRewardContinuation();

  // Spawn particles at centre
  spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 20);

  setTimeout(() => { showMissionsThenReward(); }, 900);
}

function showMissionsThenReward() {
  if (!activePoi) return;

  const missions = (activePoi.missions && activePoi.missions.length)
    ? activePoi.missions
    : [
        { i: '📸', d: 'Take a photo here',         p: 50 },
        { i: '⭐', d: 'Leave a food review',        p: 30 },
        { i: '🍽️', d: 'Try the signature dish',    p: 20 }
      ];

  // Populate mission list (all pending at start)
  const list = document.getElementById('missionList');
  list.innerHTML = '';
  const items = [];
  missions.forEach(m => {
    const item = document.createElement('div');
    item.className = 'mission-item';
    item.innerHTML = `
      <div class="mission-icon">${m.i}</div>
      <div class="mission-desc">${m.d}</div>
      <div class="mission-pts">+${m.p} pts</div>
    `;
    list.appendChild(item);
    items.push({ el: item, pts: m.p });
  });

  document.getElementById('missionsTitle').textContent   = '🎯 Missions Unlocked!';
  document.getElementById('missionsSubtitle').textContent = 'Completing missions…';
  document.getElementById('missionsStatus').textContent  = '';
  showView('viewMissions');

  let earnedSoFar = 0;
  const delays = [1500, 2200, 2900];

  items.forEach(({ el, pts }, i) => {
    setTimeout(() => {
      el.querySelector('.mission-icon').textContent = '✅';
      el.classList.add('mission-completed');
      earnedSoFar += pts;
      totalPoints += pts;
      updateHUD();
      spawnParticles(window.innerWidth / 2, window.innerHeight - 200, 8);
      document.getElementById('missionsStatus').textContent = `+${earnedSoFar} pts earned`;
    }, delays[i]);
  });

  // Transition to reward after all missions complete
  setTimeout(() => {
    const bonusPts = 100;
    totalPoints += bonusPts;
    updateHUD();
    document.getElementById('rewardPts').textContent = '+' + (earnedSoFar + bonusPts) + ' pts';
    document.getElementById('rewardSub').textContent = 'You discovered ' + activePoi.name + '!';
    document.getElementById('voucherCode').textContent = Math.random().toString(36).substr(2, 6).toUpperCase();
    showView('viewReward');
    spawnParticles(window.innerWidth / 2, window.innerHeight / 2, 30);
  }, 3800);
}

// ─────────────────────────────────────────────
