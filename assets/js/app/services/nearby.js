import { DEFAULT_RADIUS_METERS } from '../config.js';
import { normalizePois } from '../domain/normalize-poi.js';
import { requestJson } from './api.js';

export async function fetchNearbyPois(location, radiusMeters = DEFAULT_RADIUS_METERS) {
  const data = await requestJson(`/api/nearby?lat=${location.lat}&lng=${location.lng}&radius=${radiusMeters}`);
  return {
    ...data,
    pois: normalizePois(data.pois, location)
  };
}
