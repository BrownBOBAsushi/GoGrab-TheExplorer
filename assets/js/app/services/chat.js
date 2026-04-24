import { normalizePois } from '../domain/normalize-poi.js';
import { requestJson } from './api.js';

export async function fetchTripPlan({ message, location, pois }) {
  const data = await requestJson('/api/chat', {
    method: 'POST',
    body: {
      userMessage: message,
      userLat: location.lat,
      userLng: location.lng,
      availablePOIs: pois
    }
  });

  return {
    ...data,
    pois: normalizePois(data.pois, location)
  };
}
