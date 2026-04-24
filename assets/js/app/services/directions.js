import { requestJson } from './api.js';

export async function fetchDirections({ origin, destination }) {
  return requestJson(
    `/api/directions?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${destination.lat}&destLng=${destination.lng}`
  );
}
