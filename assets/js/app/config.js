export const START_LOCATION = {
  lat: 1.285,
  lng: 103.8268,
  source: 'default'
};

export const DEFAULT_RADIUS_METERS = 1000;
export const MAP_ZOOM = 16;
export const SPIN_DISTANCE_METERS = 35;
export const REWARD_BONUS_POINTS = 100;
export const INITIAL_GREETING = 'Hey! First time in Singapore? Tell me what you love — street food, hidden gems, local culture?';

export const MODAL_VIEWS = {
  INFO: 'info',
  SPIN: 'spin',
  MISSIONS: 'missions',
  REWARD: 'reward'
};

const hasWindow = typeof window !== 'undefined';

export const API_BASE = hasWindow && window.location.origin.startsWith('http') && window.location.port === '3000'
  ? window.location.origin
  : 'http://localhost:3000';
