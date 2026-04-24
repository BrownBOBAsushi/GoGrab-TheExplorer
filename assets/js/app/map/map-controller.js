import { API_BASE, MAP_ZOOM, START_LOCATION } from '../config.js';

function createRasterStyle() {
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

export function createMapController() {
  let map = null;

  async function init(containerId = 'map', location = START_LOCATION) {
    map = new window.maplibregl.Map({
      container: containerId,
      style: createRasterStyle(),
      center: [location.lng, location.lat],
      zoom: MAP_ZOOM,
      interactive: true,
      dragPan: true,
      scrollZoom: true,
      doubleClickZoom: true,
      keyboard: false
    });

    map.addControl(new window.maplibregl.NavigationControl(), 'top-right');
    map.on('error', (event) => {
      console.warn('MapLibre error:', event?.error?.message || event);
    });

    await new Promise((resolve) => {
      map.on('load', resolve);
    });

    return map;
  }

  function getMap() {
    return map;
  }

  function centerOnLocation(location, { animate = true } = {}) {
    if (!map || !location) {
      return;
    }

    if (animate) {
      map.easeTo({ center: [location.lng, location.lat], zoom: MAP_ZOOM, duration: 650 });
    } else {
      map.jumpTo({ center: [location.lng, location.lat], zoom: MAP_ZOOM });
    }
  }

  function fitRoute(route) {
    if (!map || !route?.coordinates?.length) {
      return;
    }

    const bounds = route.coordinates.reduce(
      (acc, coordinate) => acc.extend(coordinate),
      new window.maplibregl.LngLatBounds(route.coordinates[0], route.coordinates[0])
    );

    map.fitBounds(bounds, {
      padding: {
        top: 120,
        right: window.innerWidth >= 1100 ? 420 : 120,
        bottom: 120,
        left: 120
      },
      duration: 700
    });
  }

  return {
    init,
    getMap,
    centerOnLocation,
    fitRoute
  };
}
