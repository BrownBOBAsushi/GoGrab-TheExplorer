//  GAME LOOP
// ─────────────────────────────────────────────
let lastTime = null;

function gameLoop(ts) {
  requestAnimationFrame(gameLoop);
  lastTime = ts;

  // Update POI positions on screen
  updatePOIPositions();
  updatePlayerVisualPosition();

  // Proximity check for open modal
  if (activePoi && document.getElementById('modal').classList.contains('open')) {
    updateSpinState();
  }

  // Render fog
  renderFog();
}

// ─────────────────────────────────────────────
//  MODE TOGGLE
// ─────────────────────────────────────────────
function toggleMode(isExplore) {
  appMode = isExplore ? 'explore' : 'tourist';
  isMapBrowsing = false;
  document.getElementById('modeLabel').textContent = isExplore ? '🌫️ Explore' : '🗺️ Tourist';

  const chatbot = document.getElementById('chatbot');
  if (chatbot) chatbot.style.display = isExplore ? 'none' : 'flex';

  fogCanvas.style.display = isExplore ? 'block' : 'none';
  updateTouristChrome();

  if (!isExplore) {
    // Tourist mode: reveal all nearby POIs and surface the closest stops
    refreshTouristPOIs();
  } else {
    // Explore mode: hide all non-revealed POIs, reset state
    for (const poi of POIS) {
      poiState[poi.id].revealed = false;
      poiState[poi.id].el.classList.remove('revealed');
    }
    // Clear route if drawn
    try {
      if (map && map.getLayer('route')) {
        map.removeLayer('route');
        map.removeSource('route');
      }
    } catch (e) { /* ignore */ }
  }
}

// ─────────────────────────────────────────────
//  CHATBOT
// ─────────────────────────────────────────────
let chatMinimized = true;

function toggleChat(event) {
  if (event) event.stopPropagation();
  chatMinimized = !chatMinimized;
  document.getElementById('chatbot').classList.toggle('minimized', chatMinimized);
  if (!chatMinimized) {
    trayCollapsed = true;
    syncRecommendationTrayCollapse();
  }
  document.getElementById('chatMinBtn').textContent = chatMinimized ? '+' : '—';
}

function addChatMsg(text, type) {
  const msgs = document.getElementById('chatMessages');
  const el   = document.createElement('div');
  el.className = 'chat-msg ' + type;
  el.textContent = text;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
  return el;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  addChatMsg(text, 'user');
  const loading = addChatMsg('Finding hidden spots…', 'loading');

  try {
    const resp = await fetch(buildApiUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage:   text,
        userLat:       Number.isFinite(liveUserLat) ? liveUserLat : playerLat,
        userLng:       Number.isFinite(liveUserLng) ? liveUserLng : playerLng,
        availablePOIs: POIS.map(p => ({ name: p.name, category: p.cat, description: p.description }))
      })
    });
    const data = await resp.json();
    loading.remove();
    addChatMsg(data.reply, 'bot');
    if (data.pois && data.pois.length > 0) {
      replacePOIs(data.pois);
      showToast('Showing live GrabMaps matches', window.innerWidth / 2, 120);
    }
    if (data.recommendations) {
      const matched = highlightRecommendedPOIs(data.recommendations, POIS);
      applyHighlights(matched, 'ai');
      // Pan to the first recommended POI so it's actually visible on screen
      if (matched.length > 0 && map) {
        map.easeTo({ center: [matched[0].lng, matched[0].lat], zoom: 16, duration: 800 });
      }
    }
  } catch (e) {
    loading.textContent  = "Here are some local favourites near you!";
    loading.className    = 'chat-msg bot';
    applyHighlights(getNearestPois(Math.min(3, POIS.length)), 'nearby');
  }
}

function initChatGreeting() {
  addChatMsg(
    "Hey! First time in Singapore? Tell me what you love — street food, hidden gems, local culture?",
    'bot'
  );
}

// ─────────────────────────────────────────────
//  FUZZY POI MATCHING
// ─────────────────────────────────────────────
function fuzzyMatchPOI(recommendedName, poiArray) {
  const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = normalize(recommendedName);
  let bestMatch = null, bestScore = 0;
  poiArray.forEach(poi => {
    const candidate = normalize(poi.name);
    const shared = [...target].filter(c => candidate.includes(c)).length;
    const score  = shared / Math.max(target.length, candidate.length);
    if (score > bestScore) { bestScore = score; bestMatch = poi; }
  });
  return bestScore > 0.6 ? bestMatch : null;
}

function highlightRecommendedPOIs(recommendations, poiArray) {
  const matched = recommendations
    .map(name => fuzzyMatchPOI(name, poiArray))
    .filter(Boolean);
  if (matched.length === 0) {
    console.warn('Fuzzy match found nothing — using first 3 POIs as fallback');
    return poiArray.slice(0, 3);
  }
  return matched;
}

function applyHighlights(matchedPois, source = recommendationSource) {
  setRecommendedPois(matchedPois, source);
}

// ─────────────────────────────────────────────
//  FETCH NEARBY POIs (optional live data)
// ─────────────────────────────────────────────
async function fetchNearbyPOIs() {
  try {
    // Prefer real GPS for POI queries — getFreshGeolocation() does a live
    // getCurrentPosition so we never query from the hardcoded start coords.
    const freshGps = await getFreshGeolocation();
    const coords = freshGps
      || (Number.isFinite(liveUserLat) ? { lat: liveUserLat, lng: liveUserLng } : null)
      || getCurrentPlayerCoords();
    const resp = await fetch(buildApiUrl(`/api/nearby?lat=${coords.lat}&lng=${coords.lng}&radius=1000`));
    const data = await resp.json();
    if (data.pois && data.pois.length > 0) {
      replacePOIs(data.pois);
      if (data.source && data.source !== 'mock' && data.source !== 'empty') {
        showToast('GrabMaps live POIs loaded!', window.innerWidth / 2, 120);
      }
    } else if (data.source === 'empty') {
      recommendedPois = [];
      renderRecommendationTray();
      console.warn('Nearby endpoint returned no live nearby stops');
    }
  } catch (e) {
    console.warn('Nearby POI fetch failed, keeping mock POIs', e);
  }
}

// ─────────────────────────────────────────────
//  ONBOARD DISMISS
// ─────────────────────────────────────────────
function dismiss() {
  const ob = document.getElementById('onboard');
  ob.style.opacity = '0';
  ob.style.transition = 'opacity .5s';
  setTimeout(() => ob.remove(), 500);

  // Start game loop
  requestAnimationFrame(gameLoop);

  // Initial fog reveal at start position
  revealedGeo.push({ lat: playerLat, lng: playerLng });

  // Tourist mode default: reveal all POIs + greet
  if (appMode === 'tourist') {
    fogCanvas.style.display = 'none';
    refreshTouristPOIs();
    initChatGreeting();
  }

  // Fetch live POIs (best-effort)
  fetchNearbyPOIs();
}

// ─────────────────────────────────────────────
//  GPS (optional real location)
// ─────────────────────────────────────────────
function tryGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => {
    const { latitude, longitude } = pos.coords;
    if (updateLiveLocation(latitude, longitude, {
      keepPlayerSynced: true,
      animate: false,
      forceRecenter: true,
      seedReveal: true
    })) {
      hasCenteredOnInitialGps = true;
      document.getElementById('gpsStatus').style.display = 'block';
      setTimeout(() => {
        document.getElementById('gpsStatus').style.display = 'none';
      }, 3000);
      fetchNearbyPOIs();
    }
  }, () => { /* GPS denied — use defaults */ }, {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 15000
  });

  if (navigator.geolocation.watchPosition) {
    gpsWatchId = navigator.geolocation.watchPosition((pos) => {
      updateLiveLocation(pos.coords.latitude, pos.coords.longitude, {
        keepPlayerSynced: !hasCenteredOnInitialGps,
        animate: false,
        forceRecenter: !hasCenteredOnInitialGps,
        seedReveal: !hasCenteredOnInitialGps
      });
      if (!hasCenteredOnInitialGps) {
        hasCenteredOnInitialGps = true;
      }
    }, () => { /* ignore watch errors */ }, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 20000
    });
  }
}

// ─────────────────────────────────────────────
//  BOOTSTRAP
// ─────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initFog();
  await initMap();
  buildPOILayer();
  refreshTouristPOIs();
  initKeyboard();
  updateHUD();
  tryGPS();

  // Hide chatbot initially (shown after onboard in tourist mode)
  // It's already flex in CSS; keep it visible but behind onboard
});
