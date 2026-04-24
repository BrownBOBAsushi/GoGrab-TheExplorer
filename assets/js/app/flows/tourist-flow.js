import { DEFAULT_RADIUS_METERS, INITIAL_GREETING, MODAL_VIEWS, START_LOCATION } from '../config.js';
import { matchRecommendedPois } from '../domain/fuzzy-match.js';
import { createMapController } from '../map/map-controller.js';
import { createMarkerLayer } from '../map/marker-layer.js';
import { createRouteLayer } from '../map/route-layer.js';
import { fetchTripPlan } from '../services/chat.js';
import { fetchDirections } from '../services/directions.js';
import { fetchNearbyPois } from '../services/nearby.js';
import { fetchPoiReviews } from '../services/reviews.js';
import { actions, getSelectedPoi, getState, subscribe } from '../store.js';
import { createChatPanel } from '../ui/chat-panel.js';
import { createDebugPanel } from '../ui/debug-panel.js';
import { createHud } from '../ui/hud.js';
import { createOnboarding } from '../ui/onboarding.js';
import { createPoiModal } from '../ui/poi-modal.js';
import { createRecommendationTray } from '../ui/recommendation-tray.js';
import { createToast } from '../ui/toast.js';
import { createSpinFlow } from './spin-flow.js';

function normalizePoiSource(source) {
  return source === 'mock' ? 'mock' : 'live';
}

function showGpsBadge() {
  const badge = document.getElementById('gpsStatus');
  badge.style.display = 'block';
  setTimeout(() => {
    badge.style.display = 'none';
  }, 2500);
}

function disableExploreModeShell() {
  const toggle = document.getElementById('modeCheck');
  const label = document.getElementById('modeLabel');
  const root = document.getElementById('modeToggle');
  if (toggle) {
    toggle.checked = false;
    toggle.disabled = true;
  }
  if (label) {
    label.textContent = '🗺️ Tourist only';
  }
  if (root) {
    root.style.opacity = '0.6';
    root.title = 'Explore Mode is parked during the tourist-first reset.';
  }
  const fogCanvas = document.getElementById('fogCanvas');
  if (fogCanvas) {
    fogCanvas.style.display = 'none';
  }
}

async function trySeedLocation() {
  if (!navigator.geolocation) {
    return START_LOCATION;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          source: 'gps'
        };
        resolve(nextLocation);
      },
      () => resolve(START_LOCATION),
      {
        enableHighAccuracy: true,
        timeout: 4500,
        maximumAge: 15000
      }
    );
  });
}

export async function startTouristFlow() {
  disableExploreModeShell();

  const toast = createToast();
  const mapController = createMapController();
  await mapController.init('map', START_LOCATION);

  const hud = createHud();
  const debugPanel = createDebugPanel();
  const spinFlow = createSpinFlow({ mapController, toast });

  async function loadReviewsForSelectedPoi() {
    const selectedPoi = getSelectedPoi();
    if (!selectedPoi) {
      return;
    }

    actions.setLoading('reviews', true);
    try {
      const bundle = await fetchPoiReviews(selectedPoi);
      actions.updatePoiReviews(selectedPoi.id, bundle);
    } catch (error) {
      actions.setDiagnostics({ lastReason: error.message });
    } finally {
      actions.setLoading('reviews', false);
    }
  }

  function closeModal() {
    spinFlow.clearTimers();
    actions.closeModal();
  }

  async function selectPoiById(poiId) {
    actions.clearActiveRoute();
    actions.setSelectedPoiId(poiId);
    actions.openModal(MODAL_VIEWS.INFO);
    await loadReviewsForSelectedPoi();
  }

  const markerLayer = createMarkerLayer({
    mapController,
    onSelectPoi: selectPoiById
  });
  const routeLayer = createRouteLayer({ mapController });

  const tray = createRecommendationTray({
    onSelectPoi: selectPoiById,
    onRecenter: () => {
      const currentState = getState();
      mapController.centerOnLocation(currentState.currentLocation);
      toast.show('Recentered on your location');
    }
  });

  const modal = createPoiModal({
    onClose: closeModal,
    onDirections: async () => {
      const state = getState();
      const selectedPoi = getSelectedPoi(state);
      if (!selectedPoi) {
        return;
      }

      actions.setLoading('directions', true);
      try {
        const route = await fetchDirections({
          origin: state.currentLocation,
          destination: selectedPoi
        });
        actions.setActiveRoute({
          coordinates: route.route,
          distance: route.distance,
          duration: route.duration,
          fallback: route.fallback,
          source: route.source
        });
        actions.setDiagnostics({
          routeSource: route.fallback ? 'fallback' : 'live',
          lastReason: route.reason
        });
        toast.show(route.fallback ? 'Fallback route drawn' : 'Live route drawn');
      } catch (error) {
        actions.setDiagnostics({
          routeSource: 'fallback',
          lastReason: error.message
        });
        toast.show('Route request failed');
      } finally {
        actions.setLoading('directions', false);
      }
    },
    onBookGrab: () => {
      const selectedPoi = getSelectedPoi();
      if (!selectedPoi) {
        return;
      }

      const deepLink = `grab://open?destination=${selectedPoi.lat},${selectedPoi.lng}&destinationName=${encodeURIComponent(selectedPoi.name)}`;
      window.location.href = deepLink;
      setTimeout(() => window.open('https://grab.com', '_blank'), 500);
    },
    onOpenSpin: spinFlow.openSpinView,
    onBackToInfo: spinFlow.backToInfoView,
    onDemoJump: spinFlow.demoJumpToSelectedPoi,
    onQuickSpin: spinFlow.triggerSpin,
    onContinue: () => spinFlow.continueAfterReward(selectPoiById, closeModal),
    getSpinStatus: spinFlow.getSpinStatus
  });

  const chatPanel = createChatPanel({
    onSubmit: async (message, helpers) => {
      const loadingEl = chatPanel.showLoading();
      helpers.setSubmitting(true);

      try {
        actions.setLoading('chat', true);
        const currentState = getState();
        const result = await fetchTripPlan({
          message,
          location: currentState.currentLocation,
          pois: currentState.pois
        });

        loadingEl.remove();
        chatPanel.addMessage(result.reply, 'bot');

        if (result.pois?.length) {
          actions.setPois(result.pois, {
            poiSource: result.poiSource ? normalizePoiSource(result.poiSource) : currentState.diagnostics.poiSource
          });
        }

        const postPoiState = getState();
        const matchedPois = matchRecommendedPois(result.recommendations, postPoiState.pois);
        actions.setRecommendedPoiIds(matchedPois.map((poi) => poi.id));
        actions.setDiagnostics({
          chatSource: result.fallback ? 'fallback' : 'ai',
          lastReason: result.reason
        });
        toast.show(result.fallback ? 'AI fallback recommendations ready' : 'AI matched 3 stops');
      } catch (error) {
        loadingEl.textContent = 'Here are some nearby stops to start with.';
        loadingEl.className = 'chat-msg bot';
        actions.refreshRecommendedPoiIds();
        actions.setDiagnostics({
          chatSource: 'fallback',
          lastReason: error.message
        });
      } finally {
        helpers.setSubmitting(false);
        actions.setLoading('chat', false);
      }
    }
  });

  subscribe((state) => {
    hud.render(state);
    debugPanel.render(state);
    tray.render(state);
    modal.render(state);
    markerLayer.render(state);
    routeLayer.render(state);
  });

  async function loadNearby(location) {
    actions.setLoading('nearby', true);
    try {
      const result = await fetchNearbyPois(location, DEFAULT_RADIUS_METERS);
      actions.setPois(result.pois, {
        poiSource: normalizePoiSource(result.source)
      });
      actions.refreshRecommendedPoiIds();
      actions.setDiagnostics({
        poiSource: normalizePoiSource(result.source),
        lastReason: result.reason
      });
      if (result.source === 'mock') {
        toast.show('Using demo fallback POIs');
      }
    } catch (error) {
      actions.setDiagnostics({
        poiSource: 'mock',
        lastReason: error.message
      });
      toast.show('Nearby POIs failed to load');
    } finally {
      actions.setLoading('nearby', false);
    }
  }

  createOnboarding({
    onStart: async () => {
      const seededLocation = await trySeedLocation();
      actions.setCurrentLocation(seededLocation);
      mapController.centerOnLocation(seededLocation, { animate: false });

      if (seededLocation.source === 'gps') {
        showGpsBadge();
      }

      chatPanel.expand();
      chatPanel.addMessage(INITIAL_GREETING, 'bot');
      await loadNearby(seededLocation);
    }
  });
}
