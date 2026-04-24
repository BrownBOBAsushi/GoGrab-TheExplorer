import { formatDistanceLabel, haversineMeters, iconForCategory } from './distance.js';

const DEFAULT_MISSIONS = [
  { i: '📸', d: 'Take a photo here', p: 50 },
  { i: '⭐', d: 'Leave a food review', p: 30 },
  { i: '📍', d: 'Check in', p: 20 }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultMissionsFor(category) {
  const label = String(category || '').toLowerCase();
  if (label.includes('porridge') || label.includes('congee')) {
    return [
      { i: '📸', d: 'Snap the comfort bowl', p: 40 },
      { i: '⭐', d: 'Rate the porridge', p: 30 },
      { i: '📍', d: 'Check in', p: 20 }
    ];
  }

  return clone(DEFAULT_MISSIONS);
}

export function normalizePoi(rawPoi, currentLocation, index = 0) {
  const lat = Number(rawPoi.lat ?? rawPoi.latitude ?? rawPoi.location?.latitude);
  const lng = Number(rawPoi.lng ?? rawPoi.longitude ?? rawPoi.location?.longitude);
  const category = rawPoi.category || rawPoi.cat || rawPoi.business_type || 'Point of Interest';
  const distanceMeters = currentLocation
    ? haversineMeters(currentLocation.lat, currentLocation.lng, lat, lng)
    : NaN;

  return {
    id: rawPoi.id || rawPoi.poi_id || `poi_${index + 1}`,
    name: rawPoi.name || `GrabMaps Stop ${index + 1}`,
    category,
    icon: rawPoi.icon || iconForCategory(category),
    lat,
    lng,
    distance: rawPoi.distance || formatDistanceLabel(distanceMeters),
    description: rawPoi.description || rawPoi.formatted_address || 'GrabMaps point of interest.',
    missions: Array.isArray(rawPoi.missions) && rawPoi.missions.length > 0
      ? rawPoi.missions
      : defaultMissionsFor(category),
    reviewSummary: rawPoi.reviewSummary || '',
    reviewSource: rawPoi.reviewSource || '',
    reviews: Array.isArray(rawPoi.reviews) ? rawPoi.reviews : [],
    spun: Boolean(rawPoi.spun)
  };
}

export function normalizePois(rawPois, currentLocation) {
  return (Array.isArray(rawPois) ? rawPois : [])
    .map((rawPoi, index) => normalizePoi(rawPoi, currentLocation, index))
    .filter((poi) => Number.isFinite(poi.lat) && Number.isFinite(poi.lng));
}

export function applyPoiDistances(pois, currentLocation) {
  if (!currentLocation) {
    return pois;
  }

  return pois.map((poi) => ({
    ...poi,
    distance: formatDistanceLabel(
      haversineMeters(currentLocation.lat, currentLocation.lng, poi.lat, poi.lng)
    ) || poi.distance || ''
  }));
}
