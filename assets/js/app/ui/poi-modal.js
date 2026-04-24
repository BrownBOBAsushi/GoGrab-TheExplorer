import { MODAL_VIEWS } from '../config.js';
import { getNextRecommendedPoi, getSelectedPoi } from '../store.js';

export function createPoiModal({
  onClose,
  onDirections,
  onBookGrab,
  onOpenSpin,
  onBackToInfo,
  onDemoJump,
  onQuickSpin,
  onContinue,
  getSpinStatus
}) {
  const root = document.getElementById('modal');
  const infoView = document.getElementById('viewInfo');
  const spinView = document.getElementById('viewSpin');
  const missionView = document.getElementById('viewMissions');
  const rewardView = document.getElementById('viewReward');

  document.getElementById('closeModalBtn').addEventListener('click', onClose);
  document.getElementById('infoDirectionsBtn').addEventListener('click', onDirections);
  document.getElementById('spinDirectionsBtn').addEventListener('click', onDirections);
  document.getElementById('infoGrabBtn').addEventListener('click', onBookGrab);
  document.getElementById('spinGrabBtn').addEventListener('click', onBookGrab);
  document.getElementById('goSpinBtn').addEventListener('click', onOpenSpin);
  document.getElementById('spinBackBtn').addEventListener('click', onBackToInfo);
  document.getElementById('demoJumpBtn').addEventListener('click', onDemoJump);
  document.getElementById('quickSpinBtn').addEventListener('click', onQuickSpin);
  document.getElementById('msDisc').addEventListener('click', onQuickSpin);
  document.getElementById('rewardContinueBtn').addEventListener('click', onContinue);

  root.addEventListener('click', (event) => {
    if (event.target === root) {
      onClose();
    }
  });

  function showView(view) {
    infoView.classList.toggle('active', view === MODAL_VIEWS.INFO);
    spinView.classList.toggle('active', view === MODAL_VIEWS.SPIN);
    missionView.classList.toggle('active', view === MODAL_VIEWS.MISSIONS);
    rewardView.classList.toggle('active', view === MODAL_VIEWS.REWARD);
  }

  function renderReviews(selectedPoi, loading) {
    const sourceEl = document.getElementById('reviewsSource');
    const summaryEl = document.getElementById('reviewsSummary');
    const reviewsList = document.getElementById('reviewsList');

    if (loading) {
      sourceEl.textContent = 'Loading';
      summaryEl.textContent = 'Pulling comparison notes for this stop...';
      reviewsList.innerHTML = '<div class="review-empty">Loading notes…</div>';
      return;
    }

    sourceEl.textContent = selectedPoi.reviewSource || 'Local notes';
    summaryEl.textContent = selectedPoi.reviewSummary || 'Quick comparison notes to help choose your next stop.';

    if (!selectedPoi.reviews?.length) {
      reviewsList.innerHTML = '<div class="review-empty">No comparison notes yet for this stop.</div>';
      return;
    }

    reviewsList.innerHTML = selectedPoi.reviews.slice(0, 3).map((review) => `
      <div class="review-card">
        <div class="review-topline">
          <div class="review-author">${review.author || 'Traveler note'}</div>
          <div class="review-rating">${Number(review.rating || 0).toFixed(1)}★</div>
        </div>
        <div class="review-text">${review.text || ''}</div>
      </div>
    `).join('');
  }

  function renderMissionList(selectedPoi) {
    const missionList = document.getElementById('missionList');
    missionList.innerHTML = selectedPoi.missions.map((mission) => `
      <div class="mission-item">
        <div class="mission-icon">${mission.i}</div>
        <div class="mission-desc">${mission.d}</div>
        <div class="mission-pts">+${mission.p} pts</div>
      </div>
    `).join('');
  }

  function render(state) {
    const selectedPoi = getSelectedPoi(state);
    root.classList.toggle('open', state.modal.open && Boolean(selectedPoi));

    if (!selectedPoi) {
      return;
    }

    showView(state.modal.view);

    document.getElementById('mIcon').textContent = selectedPoi.icon || '📍';
    document.getElementById('mName').textContent = selectedPoi.name;
    document.getElementById('mCat').textContent = selectedPoi.category;
    document.getElementById('mDist').textContent = `📍 ${selectedPoi.distance}`;
    document.getElementById('mCatTag').textContent = selectedPoi.category;
    document.getElementById('mDescInfo').textContent = selectedPoi.description || '';
    document.getElementById('vsTitle').textContent = selectedPoi.name;
    document.getElementById('mDistSpin').textContent = `📍 ${selectedPoi.distance}`;
    document.getElementById('mCatSpin').textContent = selectedPoi.category;
    document.getElementById('mDesc').textContent = selectedPoi.description || '';
    document.getElementById('msDisc').textContent = selectedPoi.icon || '🎰';

    renderReviews(selectedPoi, state.loading.reviews);
    renderMissionList(selectedPoi);

    const nextPoi = getNextRecommendedPoi(state);
    document.getElementById('rewardContinueBtn').textContent = nextPoi ? 'See next nearby stop' : 'Back to nearby stops';
    document.getElementById('rewardPts').textContent = `+${state.reward.earnedPoints} pts`;
    document.getElementById('rewardSub').textContent = `You discovered ${selectedPoi.name}!`;
    document.getElementById('voucherCode').textContent = state.reward.voucherCode;

    const routeOriginPill = document.getElementById('routeOriginPill');
    const routeStatsPill = document.getElementById('routeStatsPill');
    if (state.activeRoute) {
      routeOriginPill.textContent = `Route • ${state.diagnostics.routeSource}`;
      routeOriginPill.classList.add('is-visible');
      routeStatsPill.textContent = `ETA ${state.activeRoute.duration} • ${state.activeRoute.distance}`;
      routeStatsPill.classList.add('is-visible');
    } else {
      routeOriginPill.textContent = '';
      routeOriginPill.classList.remove('is-visible');
      routeStatsPill.textContent = '';
      routeStatsPill.classList.remove('is-visible');
    }

    const spinStatus = getSpinStatus(selectedPoi, state.currentLocation);
    const goSpinBtn = document.getElementById('goSpinBtn');
    const proximityStatus = document.getElementById('proximityStatus');
    const quickSpinBtn = document.getElementById('quickSpinBtn');
    const hint = document.getElementById('msHint');

    goSpinBtn.textContent = spinStatus.unlocked
      ? '🎰 SPIN THIS STOP'
      : `🎰 SPIN THIS STOP (${spinStatus.label})`;
    goSpinBtn.style.opacity = spinStatus.unlocked ? '1' : '0.75';
    proximityStatus.textContent = spinStatus.unlocked
      ? "✓ You're here — spin to unlock!"
      : `Get closer to unlock the spin (${spinStatus.label})`;
    hint.textContent = spinStatus.unlocked ? 'Tap the disc or Quick Spin' : 'Use Demo Jump to arrive instantly';
    quickSpinBtn.disabled = !spinStatus.unlocked;
    quickSpinBtn.style.opacity = spinStatus.unlocked ? '1' : '0.45';
    quickSpinBtn.textContent = spinStatus.unlocked ? '⚡ Quick Spin (Demo)' : '⚡ Quick Spin (Locked)';

    document.getElementById('missionsStatus').textContent = 'Reward sequence in progress...';
    document.getElementById('missionsTitle').textContent = '🎯 Missions Unlocked!';
    document.getElementById('missionsSubtitle').textContent = 'Complete all 3 to unlock your reward';
  }

  return {
    render
  };
}
