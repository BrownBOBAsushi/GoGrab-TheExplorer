export function createDebugPanel() {
  let root = document.getElementById('tweaks');
  if (!root) {
    root = document.createElement('div');
    root.id = 'tweaks';
    document.body.appendChild(root);
  }

  root.style.display = 'block';

  function render(state) {
    const coords = `${state.currentLocation.lat.toFixed(5)}, ${state.currentLocation.lng.toFixed(5)}`;
    root.innerHTML = `
      <div><strong>Location:</strong> ${state.currentLocation.source} (${coords})</div>
      <div><strong>POIs:</strong> ${state.diagnostics.poiSource}</div>
      <div><strong>Chat:</strong> ${state.diagnostics.chatSource}</div>
      <div><strong>Route:</strong> ${state.diagnostics.routeSource}</div>
      <div><strong>Reason:</strong> ${state.diagnostics.lastReason || 'none'}</div>
      <div><strong>Loading:</strong> nearby=${state.loading.nearby} chat=${state.loading.chat} directions=${state.loading.directions}</div>
    `;
  }

  return {
    render
  };
}
