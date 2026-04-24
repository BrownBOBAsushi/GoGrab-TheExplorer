import { requestJson } from './api.js';

export async function fetchPoiReviews(poi) {
  return requestJson(
    `/api/reviews?id=${encodeURIComponent(poi.id)}&name=${encodeURIComponent(poi.name)}&lat=${poi.lat}&lng=${poi.lng}&category=${encodeURIComponent(poi.category || '')}`
  );
}
