import { MODAL_VIEWS, REWARD_BONUS_POINTS, SPIN_DISTANCE_METERS } from '../config.js';
import { haversineMeters } from '../domain/distance.js';
import { actions, getNextRecommendedPoi, getSelectedPoi, getState } from '../store.js';

export function createSpinFlow({ mapController, toast }) {
  let rewardTimers = [];
  let busy = false;

  function clearTimers() {
    rewardTimers.forEach((timer) => clearTimeout(timer));
    rewardTimers = [];
    busy = false;
  }

  function generateVoucherCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function getSpinStatus(selectedPoi, currentLocation) {
    if (!selectedPoi || !currentLocation) {
      return { unlocked: false, distanceMeters: Infinity, label: 'not ready' };
    }

    const distanceMeters = haversineMeters(currentLocation.lat, currentLocation.lng, selectedPoi.lat, selectedPoi.lng);
    return {
      unlocked: distanceMeters <= SPIN_DISTANCE_METERS,
      distanceMeters,
      label: `${Math.round(distanceMeters)}m away`
    };
  }

  function openSpinView() {
    actions.setModalView(MODAL_VIEWS.SPIN);
  }

  function backToInfoView() {
    actions.setModalView(MODAL_VIEWS.INFO);
  }

  function demoJumpToSelectedPoi() {
    const selectedPoi = getSelectedPoi();
    if (!selectedPoi) {
      return;
    }

    actions.setCurrentLocation({
      lat: selectedPoi.lat,
      lng: selectedPoi.lng,
      source: 'demo'
    });
    actions.clearActiveRoute();
    actions.setDiagnostics({
      lastReason: `Demo Jump moved to ${selectedPoi.name}`
    });
    mapController.centerOnLocation({
      lat: selectedPoi.lat,
      lng: selectedPoi.lng
    });
    toast.show('⚡ Demo Jump complete');
  }

  function triggerSpin() {
    const state = getState();
    const selectedPoi = getSelectedPoi(state);
    const spinStatus = getSpinStatus(selectedPoi, state.currentLocation);
    if (!selectedPoi || !spinStatus.unlocked || busy || selectedPoi.spun) {
      return;
    }

    clearTimers();
    busy = true;

    const missionPoints = selectedPoi.missions.reduce((total, mission) => total + mission.p, 0);
    const totalEarned = missionPoints + REWARD_BONUS_POINTS;

    actions.markPoiSpun(selectedPoi.id);
    actions.setReward({
      earnedPoints: totalEarned,
      voucherCode: generateVoucherCode()
    });
    actions.setModalView(MODAL_VIEWS.MISSIONS);

    rewardTimers.push(setTimeout(() => {
      actions.addPoints(missionPoints);
    }, 900));

    rewardTimers.push(setTimeout(() => {
      actions.addPoints(REWARD_BONUS_POINTS);
      actions.setModalView(MODAL_VIEWS.REWARD);
      toast.show('🎉 Stop unlocked!', window.innerWidth / 2, window.innerHeight / 2 - 60);
      busy = false;
    }, 1800));
  }

  function continueAfterReward(selectPoiById, closeModal) {
    clearTimers();
    const nextPoi = getNextRecommendedPoi();
    if (nextPoi) {
      selectPoiById(nextPoi.id);
      return;
    }

    closeModal();
  }

  return {
    backToInfoView,
    clearTimers,
    continueAfterReward,
    demoJumpToSelectedPoi,
    getSpinStatus,
    openSpinView,
    triggerSpin
  };
}
