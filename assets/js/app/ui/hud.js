export function createHud() {
  const pointsEl = document.getElementById('hudPts');
  const metaEl = document.getElementById('hudExp');

  function render(state) {
    const remainingStops = state.recommendedPoiIds
      .map((poiId) => state.pois.find((poi) => poi.id === poiId))
      .filter((poi) => poi && !poi.spun)
      .length;

    pointsEl.textContent = `⭐ ${state.points} pts`;
    metaEl.textContent = `🗺️ ${remainingStops} stop${remainingStops === 1 ? '' : 's'} • ${state.diagnostics.poiSource}`;
  }

  return {
    render
  };
}
