export function createMarkerLayer({ mapController, onSelectPoi }) {
  const markers = new Map();

  function createMarkerElement(poi) {
    const element = document.createElement('div');
    element.className = 'poi revealed';
    element.innerHTML = `
      <div class="poi-ring"></div>
      <div class="poi-face">${poi.icon}</div>
      <div class="poi-needle"></div>
    `;
    element.addEventListener('click', () => onSelectPoi(poi.id));
    return element;
  }

  function render(state) {
    const map = mapController.getMap();
    if (!map) {
      return;
    }

    const activeIds = new Set(state.pois.map((poi) => poi.id));

    for (const [poiId, markerState] of markers.entries()) {
      if (!activeIds.has(poiId)) {
        markerState.marker.remove();
        markers.delete(poiId);
      }
    }

    for (const poi of state.pois) {
      let markerState = markers.get(poi.id);
      if (!markerState) {
        const element = createMarkerElement(poi);
        const marker = new window.maplibregl.Marker({ element, anchor: 'bottom' })
          .setLngLat([poi.lng, poi.lat])
          .addTo(map);
        markerState = { marker, element };
        markers.set(poi.id, markerState);
      }

      markerState.marker.setLngLat([poi.lng, poi.lat]);
      markerState.element.querySelector('.poi-face').textContent = poi.icon;
      markerState.element.classList.toggle('highlighted', state.recommendedPoiIds.includes(poi.id) && !poi.spun);
      markerState.element.classList.toggle('selected', state.selectedPoiId === poi.id);
      markerState.element.classList.toggle('spun', Boolean(poi.spun));
      markerState.element.classList.add('revealed');
    }
  }

  return {
    render
  };
}
