import { MODAL_VIEWS, START_LOCATION } from './config.js';
import { haversineMeters } from './domain/distance.js';
import { applyPoiDistances } from './domain/normalize-poi.js';

const listeners = new Set();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createInitialState() {
  return {
    mode: 'tourist',
    currentLocation: { ...START_LOCATION },
    pois: [],
    selectedPoiId: null,
    recommendedPoiIds: [],
    activeRoute: null,
    modal: { open: false, view: MODAL_VIEWS.INFO },
    points: 0,
    reward: { earnedPoints: 0, voucherCode: 'XXXXXX' },
    diagnostics: {
      poiSource: 'mock',
      chatSource: 'fallback',
      routeSource: 'fallback',
      lastReason: null
    },
    loading: {
      nearby: false,
      chat: false,
      directions: false,
      reviews: false
    }
  };
}

let state = createInitialState();

function getPoiIds(pois) {
  return new Set(pois.map((poi) => poi.id));
}

function getNearestPoiIds(pois, currentLocation, limit = 3) {
  return [...pois]
    .filter((poi) => !poi.spun)
    .sort(
      (left, right) =>
        haversineMeters(currentLocation.lat, currentLocation.lng, left.lat, left.lng) -
        haversineMeters(currentLocation.lat, currentLocation.lng, right.lat, right.lng)
    )
    .slice(0, limit)
    .map((poi) => poi.id);
}

function sanitize(nextState) {
  const hydrated = clone(nextState);
  hydrated.pois = applyPoiDistances(hydrated.pois, hydrated.currentLocation);

  const validIds = getPoiIds(hydrated.pois);
  hydrated.recommendedPoiIds = hydrated.recommendedPoiIds.filter((poiId) => validIds.has(poiId));
  if (!hydrated.recommendedPoiIds.length && hydrated.pois.length) {
    hydrated.recommendedPoiIds = getNearestPoiIds(hydrated.pois, hydrated.currentLocation);
  }

  if (hydrated.selectedPoiId && !validIds.has(hydrated.selectedPoiId)) {
    hydrated.selectedPoiId = null;
    hydrated.modal = { open: false, view: MODAL_VIEWS.INFO };
  }

  return hydrated;
}

function commit(nextState) {
  state = sanitize(nextState);
  for (const listener of listeners) {
    listener(getState());
  }
}

function mutate(mutator) {
  const draft = clone(state);
  mutator(draft);
  commit(draft);
}

export function getState() {
  return clone(state);
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

export function getPoiById(poiId, sourceState = state) {
  return sourceState.pois.find((poi) => poi.id === poiId) || null;
}

export function getSelectedPoi(sourceState = state) {
  return getPoiById(sourceState.selectedPoiId, sourceState);
}

export function getRecommendedPois(sourceState = state) {
  return sourceState.recommendedPoiIds
    .map((poiId) => getPoiById(poiId, sourceState))
    .filter(Boolean);
}

export function getNextRecommendedPoi(sourceState = state) {
  return getRecommendedPois(sourceState).find((poi) => !poi.spun && poi.id !== sourceState.selectedPoiId) || null;
}

export const actions = {
  reset() {
    commit(createInitialState());
  },
  setLoading(key, value) {
    mutate((draft) => {
      draft.loading[key] = Boolean(value);
    });
  },
  setDiagnostics(partial) {
    mutate((draft) => {
      draft.diagnostics = {
        ...draft.diagnostics,
        ...partial
      };
    });
  },
  setCurrentLocation(location) {
    mutate((draft) => {
      draft.currentLocation = {
        ...draft.currentLocation,
        ...location
      };
    });
  },
  setPois(pois, options = {}) {
    mutate((draft) => {
      const previousById = new Map(draft.pois.map((poi) => [poi.id, poi]));
      draft.pois = pois.map((poi) => {
        const previous = previousById.get(poi.id);
        return {
          ...poi,
          spun: previous?.spun || poi.spun || false,
          reviewSummary: poi.reviewSummary || previous?.reviewSummary || '',
          reviewSource: poi.reviewSource || previous?.reviewSource || '',
          reviews: poi.reviews?.length ? poi.reviews : previous?.reviews || []
        };
      });

      if (options.poiSource) {
        draft.diagnostics.poiSource = options.poiSource;
      }

      if (Array.isArray(options.recommendedPoiIds)) {
        draft.recommendedPoiIds = options.recommendedPoiIds;
      }
    });
  },
  setRecommendedPoiIds(poiIds) {
    mutate((draft) => {
      draft.recommendedPoiIds = [...new Set(poiIds)];
    });
  },
  refreshRecommendedPoiIds() {
    mutate((draft) => {
      draft.recommendedPoiIds = getNearestPoiIds(draft.pois, draft.currentLocation);
    });
  },
  setSelectedPoiId(poiId) {
    mutate((draft) => {
      draft.selectedPoiId = poiId;
    });
  },
  openModal(view = MODAL_VIEWS.INFO) {
    mutate((draft) => {
      draft.modal = {
        open: true,
        view
      };
    });
  },
  closeModal() {
    mutate((draft) => {
      draft.modal = {
        open: false,
        view: MODAL_VIEWS.INFO
      };
    });
  },
  setModalView(view) {
    mutate((draft) => {
      draft.modal.view = view;
      draft.modal.open = true;
    });
  },
  setActiveRoute(route) {
    mutate((draft) => {
      draft.activeRoute = route;
      draft.diagnostics.routeSource = route?.fallback ? 'fallback' : 'live';
    });
  },
  clearActiveRoute() {
    mutate((draft) => {
      draft.activeRoute = null;
    });
  },
  updatePoiReviews(poiId, bundle) {
    mutate((draft) => {
      draft.pois = draft.pois.map((poi) => poi.id === poiId
        ? {
            ...poi,
            reviewSummary: bundle.summary || poi.reviewSummary,
            reviewSource: bundle.sourceLabel || poi.reviewSource,
            reviews: bundle.reviews || poi.reviews
          }
        : poi);
    });
  },
  markPoiSpun(poiId) {
    mutate((draft) => {
      draft.pois = draft.pois.map((poi) => poi.id === poiId ? { ...poi, spun: true } : poi);
    });
  },
  addPoints(points) {
    mutate((draft) => {
      draft.points += points;
    });
  },
  setReward(payload) {
    mutate((draft) => {
      draft.reward = {
        ...draft.reward,
        ...payload
      };
    });
  }
};
