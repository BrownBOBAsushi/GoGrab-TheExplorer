import { getPoiById, getRecommendedPois } from '../store.js';

function buildTags(poi) {
  const tags = [];
  const label = `${poi.category || ''} ${poi.reviewSummary || ''}`.toLowerCase();
  tags.push(poi.distance || 'Nearby');

  if (label.includes('bakery') || label.includes('pastry')) {
    tags.push('Best for pastries');
  } else if (label.includes('bak kwa') || label.includes('savory')) {
    tags.push('Savory souvenir stop');
  } else if (label.includes('porridge') || label.includes('comfort')) {
    tags.push('Comfort breakfast');
  } else if (label.includes('hawker')) {
    tags.push('Hawker classic');
  } else {
    tags.push('Local discovery');
  }

  return tags.slice(0, 2);
}

export function createRecommendationTray({ onSelectPoi, onRecenter }) {
  const tray = document.getElementById('recommendationTray');
  const cards = document.getElementById('recommendationCards');
  const eyebrow = document.getElementById('recommendationEyebrow');
  const title = document.getElementById('recommendationTitle');
  const subtitle = document.getElementById('recommendationSubtitle');
  const routeSummaryHud = document.getElementById('routeSummaryHud');
  const routeSummaryValue = document.getElementById('routeSummaryValue');
  const routeSummaryMeta = document.getElementById('routeSummaryMeta');
  const toggleButton = document.getElementById('toggleTrayBtn');
  const collapsedLabel = document.getElementById('recommendationCollapsedLabel');
  let collapsed = false;

  toggleButton.addEventListener('click', () => {
    collapsed = !collapsed;
    tray.classList.toggle('is-collapsed', collapsed);
  });

  document.getElementById('recenterBtn').addEventListener('click', onRecenter);

  function renderRouteSummary(state) {
    const route = state.activeRoute;
    if (!route) {
      routeSummaryHud.classList.remove('is-visible');
      routeSummaryValue.textContent = 'ETA soon';
      routeSummaryMeta.textContent = 'Route details will show here';
      return;
    }

    routeSummaryHud.classList.add('is-visible');
    routeSummaryValue.textContent = route.duration || 'ETA soon';
    routeSummaryMeta.textContent = `${route.distance || ''}${route.fallback ? ' • fallback route' : ' • live route'}`;
  }

  function render(state) {
    const recommendedPois = getRecommendedPois(state).filter((poi) => !poi.spun).slice(0, 3);
    eyebrow.textContent = state.diagnostics.chatSource === 'ai' ? 'Picked for your vibe' : 'Nearby for you';
    title.textContent = recommendedPois.length > 0
      ? `${recommendedPois.length} good stop${recommendedPois.length === 1 ? '' : 's'} around you`
      : 'No nearby stops yet';
    subtitle.textContent = state.diagnostics.poiSource === 'mock'
      ? 'Using demo-safe fallback POIs'
      : 'Tap a card to inspect the stop';
    collapsedLabel.textContent = `${recommendedPois.length || 0} stop${recommendedPois.length === 1 ? '' : 's'}`;
    toggleButton.textContent = collapsed ? 'Open' : 'Hide';

    if (!recommendedPois.length) {
      cards.innerHTML = '<div class="recommendation-empty">Try the AI or reload nearby stops to populate your tourist loop.</div>';
      renderRouteSummary(state);
      return;
    }

    cards.innerHTML = recommendedPois.map((poi) => `
      <button class="recommendation-card${state.selectedPoiId === poi.id ? ' is-active' : ''}${poi.spun ? ' is-spun' : ''}" data-poi-id="${poi.id}" type="button">
        <div class="recommendation-card-top">
          <div class="recommendation-icon">${poi.icon}</div>
          <div class="recommendation-distance">${poi.distance}</div>
        </div>
        <div class="recommendation-name">${poi.name}</div>
        <div class="recommendation-cat">${poi.category}</div>
        <div class="recommendation-tags">
          ${buildTags(poi).map((tag) => `<span class="recommendation-tag">${tag}</span>`).join('')}
        </div>
      </button>
    `).join('');

    cards.querySelectorAll('[data-poi-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const poi = getPoiById(button.getAttribute('data-poi-id'), state);
        if (poi) {
          onSelectPoi(poi.id);
        }
      });
    });

    renderRouteSummary(state);
  }

  return {
    render
  };
}
