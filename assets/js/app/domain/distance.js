export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceLabel(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return '';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

export function formatDurationLabel(durationSeconds) {
  if (!Number.isFinite(durationSeconds)) {
    return '';
  }

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return `${minutes} min`;
}

export function iconForCategory(category) {
  const label = String(category || '').toLowerCase();
  if (label.includes('bakery') || label.includes('pastry')) return '🥐';
  if (label.includes('bak kwa') || label.includes('bbq')) return '🥩';
  if (label.includes('porridge') || label.includes('congee')) return '🍚';
  if (label.includes('hawker') || label.includes('food')) return '🍜';
  if (label.includes('snack') || label.includes('dessert')) return '🍡';
  if (label.includes('cafe') || label.includes('coffee')) return '☕';
  return '📍';
}
