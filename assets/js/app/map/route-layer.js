const SOURCE_ID = 'tourist-route';
const LAYER_ID = 'tourist-route-line';

export function createRouteLayer({ mapController }) {
  let previousSignature = '';

  function clearRoute(map) {
    if (map.getLayer(LAYER_ID)) {
      map.removeLayer(LAYER_ID);
    }

    if (map.getSource(SOURCE_ID)) {
      map.removeSource(SOURCE_ID);
    }
  }

  function render(state) {
    const map = mapController.getMap();
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    if (!state.activeRoute?.coordinates?.length) {
      clearRoute(map);
      previousSignature = '';
      return;
    }

    const signature = JSON.stringify(state.activeRoute.coordinates);
    const data = {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: state.activeRoute.coordinates
      }
    };

    if (map.getSource(SOURCE_ID)) {
      map.getSource(SOURCE_ID).setData(data);
    } else {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data
      });
      map.addLayer({
        id: LAYER_ID,
        type: 'line',
        source: SOURCE_ID,
        paint: {
          'line-color': '#00B14F',
          'line-width': 4,
          'line-dasharray': state.activeRoute.fallback ? [3, 3] : [1, 0],
          'line-opacity': 0.9
        }
      });
    }

    if (signature !== previousSignature) {
      mapController.fitRoute(state.activeRoute);
      previousSignature = signature;
    }
  }

  return {
    render
  };
}
