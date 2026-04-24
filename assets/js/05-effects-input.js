//  DEMO JUMP
// ─────────────────────────────────────────────
function demoJump() {
  if (!activePoi) return;
  playerLng = activePoi.lng;
  playerLat = activePoi.lat;
  isMapBrowsing = false;
  lastRevealLng = playerLng;
  lastRevealLat = playerLat;
  revealedGeo.push({ lng: playerLng, lat: playerLat });
  if (map) map.jumpTo({ center: [playerLng, playerLat] });
  updatePlayerVisualPosition();
  updateSpinState();
  showToast('⚡ Jumped to location!', window.innerWidth / 2, window.innerHeight / 2 - 60);
}

// ─────────────────────────────────────────────
//  DIRECTIONS & ROUTE
// ─────────────────────────────────────────────
async function getDirections() {
  if (!activePoi || !map) return;
  const freshOrigin = await getFreshGeolocation();
  const origin = freshOrigin || getBestRouteOrigin();
  activeRouteOriginLabel = origin.label;
  try {
    const resp = await fetch(
      `${buildApiUrl('/api/directions')}?originLat=${origin.lat}&originLng=${origin.lng}` +
      `&destLat=${activePoi.lat}&destLng=${activePoi.lng}`
    );
    const data = await resp.json();
    drawRoute(data);
  } catch (e) {
    drawRoute({
      fallback: true,
      distance: formatDistance(distanceBetween(origin.lat, origin.lng, activePoi.lat, activePoi.lng)),
      duration: 'Live ETA unavailable',
      route: [[origin.lng, origin.lat], [activePoi.lng, activePoi.lat]]
    });
  }
}

function drawRoute(data) {
  if (!map) return;
  const coords = data.route;
  if (!coords || coords.length < 2) return;
  const geojson = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords }
  };
  try {
    if (map.getSource('route')) {
      map.getSource('route').setData(geojson);
    } else {
      map.addSource('route', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'route', type: 'line', source: 'route',
        paint: {
          'line-color': '#00B14F',
          'line-width': 4,
          'line-dasharray': data.fallback ? [3, 3] : [1, 0],
          'line-opacity': 0.9
        }
      });
    }
    const bounds = coords.reduce(
      (acc, coord) => acc.extend(coord),
      new maplibregl.LngLatBounds(coords[0], coords[0])
    );
    const hasRightDock = appMode === 'tourist' && window.innerWidth >= 1100 && !trayCollapsed;
    map.fitBounds(bounds, {
      padding: {
        top: 120,
        right: hasRightDock ? 420 : 120,
        bottom: 120,
        left: 120
      },
      duration: 700
    });
    updateRouteMeta(data.distance, data.duration);
    showToast('Route drawn!', window.innerWidth / 2, window.innerHeight - 180);
  } catch (e) {
    console.warn('drawRoute error', e);
  }
}

// ─────────────────────────────────────────────
//  GRAB DEEP LINK
// ─────────────────────────────────────────────
function bookGrab() {
  if (!activePoi) return;
  const deepLink = `grab://open?destination=${activePoi.lat},${activePoi.lng}&destinationName=${encodeURIComponent(activePoi.name)}`;
  window.location.href = deepLink;
  setTimeout(() => window.open('https://grab.com', '_blank'), 500);
}

// ─────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────
function updateHUD() {
  document.getElementById('hudPts').textContent = '⭐ ' + totalPoints + ' pts';
  document.getElementById('hudExp').textContent = '🗺️ ' + Math.round(exploredPct) + '% explored';
}

// ─────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────
function showToast(msg, x, y) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  t.style.left = x + 'px';
  t.style.top  = y + 'px';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2100);
}

// ─────────────────────────────────────────────
//  PARTICLES
// ─────────────────────────────────────────────
function spawnParticles(x, y, count) {
  for (let i = 0; i < count; i++) {
    const p  = document.createElement('div');
    p.className = 'particle';
    const sz = 4 + Math.random() * 8;
    const angle  = Math.random() * 2 * Math.PI;
    const dist   = 60 + Math.random() * 120;
    const ex = Math.cos(angle) * dist;
    const ey = Math.sin(angle) * dist;
    p.style.cssText = `
      left:${x - sz/2}px; top:${y - sz/2}px;
      width:${sz}px; height:${sz}px;
      background:${PARTICLE_COLOURS[Math.floor(Math.random() * PARTICLE_COLOURS.length)]};
      --ptEnd: translate(${ex}px, ${ey}px);
      animation-duration: ${0.8 + Math.random() * 0.6}s;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1500);
  }
}

// ─────────────────────────────────────────────
//  FOG OF WAR
// ─────────────────────────────────────────────
function initFog() {
  fogCanvas = document.getElementById('fogCanvas');
  fogCtx    = fogCanvas.getContext('2d');
  resizeFog();
  window.addEventListener('resize', resizeFog);
}

function resizeFog() {
  fogCanvas.width  = window.innerWidth;
  fogCanvas.height = window.innerHeight;
}

function renderFog() {
  if (appMode !== 'explore') return;
  const w = fogCanvas.width;
  const h = fogCanvas.height;
  fogCtx.clearRect(0, 0, w, h);

  // Dark fog base
  fogCtx.fillStyle = 'rgba(15,25,20,0.88)';
  fogCtx.fillRect(0, 0, w, h);

  // Reveal circles (destination-over composite)
  fogCtx.globalCompositeOperation = 'destination-out';

  for (const pt of revealedGeo) {
    if (!map) continue;
    const sp = projectToViewport(pt.lng, pt.lat);
    const grad = fogCtx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, REVEAL_RADIUS_PX);
    grad.addColorStop(0,   'rgba(0,0,0,1)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    fogCtx.fillStyle = grad;
    fogCtx.beginPath();
    fogCtx.arc(sp.x, sp.y, REVEAL_RADIUS_PX, 0, Math.PI * 2);
    fogCtx.fill();
  }

  fogCtx.globalCompositeOperation = 'source-over';

  // Player reveal (current position)
  if (map) {
    const sp = projectToViewport(playerLng, playerLat);
    const grad = fogCtx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, REVEAL_RADIUS_PX * 1.1);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    fogCtx.globalCompositeOperation = 'destination-out';
    fogCtx.fillStyle = grad;
    fogCtx.beginPath();
    fogCtx.arc(sp.x, sp.y, REVEAL_RADIUS_PX * 1.1, 0, Math.PI * 2);
    fogCtx.fill();
    fogCtx.globalCompositeOperation = 'source-over';
  }

  // Check POI reveal in explore mode
  if (map) {
    const center = getMapViewportCenter();
    for (const poi of POIS) {
      const state = poiState[poi.id];
      if (state.revealed) continue;
      const sp = projectToViewport(poi.lng, poi.lat);
      const dx = sp.x - center.x;
      const dy = sp.y - center.y;
      const screenDist = Math.hypot(dx, dy);
      if (screenDist < REVEAL_RADIUS_PX * 0.8) {
        state.revealed = true;
        state.el.classList.add('revealed');
        showToast('📍 New place discovered!', center.x, center.y - 80);
        spawnParticles(sp.x, sp.y, 10);
      }
    }
  }
}

// ─────────────────────────────────────────────
//  KEYBOARD
// ─────────────────────────────────────────────
function initKeyboard() {
  window.addEventListener('keydown', e => {
    if (isTypingInInput()) return;
    keys[e.key.toLowerCase()] = true;
    // Debug panel toggle
    if (e.key === '`') document.getElementById('tweaks').style.display =
      document.getElementById('tweaks').style.display === 'none' ? 'block' : 'none';
  });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('focus', resetKeyboardInput);
    chatInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        sendChat();
      }
    });
    chatInput.addEventListener('keyup', e => {
      e.stopPropagation();
      keys[e.key.toLowerCase()] = false;
    });
  }
}

function getKeyboardInput() {
  return { dx: 0, dy: 0 };
}

// ─────────────────────────────────────────────
