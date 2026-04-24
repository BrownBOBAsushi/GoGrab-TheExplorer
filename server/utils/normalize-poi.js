const DEFAULT_MISSIONS = [
  { i: '📸', d: 'Take a photo here', p: 50 },
  { i: '⭐', d: 'Leave a food review', p: 30 },
  { i: '📍', d: 'Check in', p: 20 }
];

const MOCK_POIS = [
  {
    id: 'poi_1',
    name: 'Media Link Bakery Stop',
    category: 'Traditional Bakery',
    lat: 1.2847,
    lng: 103.8278,
    description: 'Demo bakery stop near the One-North start point with pastries and quick breakfast bites.',
    reviewSource: 'Curated demo notes',
    reviewSummary: 'Best for old-school pastry fans who want heritage over trendiness.',
    reviews: [
      { author: 'Pastry hunter', rating: 4.8, text: 'Flaky wife cakes and a proper old-school bakery smell. Come early before the popular trays clear out.' },
      { author: 'Local auntie energy', rating: 4.6, text: 'Feels very Singapore. Less polished than newer cafes, but that is exactly the charm.' },
      { author: 'Sweet-vs-savory scout', rating: 4.4, text: 'Choose this if you want something light and nostalgic instead of a full meal stop.' }
    ]
  },
  {
    id: 'poi_2',
    name: 'Portsdown Jerky House',
    category: 'Bak Kwa',
    lat: 1.2856,
    lng: 103.8271,
    description: 'Demo savory snack stop near the player start point with smoky takeaway bites.',
    reviewSource: 'Curated demo notes',
    reviewSummary: 'Best if the user wants a bold, savory gift stop with serious local flavor.',
    reviews: [
      { author: 'Savory snack fan', rating: 4.9, text: 'Smoky, sweet, and intensely flavorful. Great pick when the user wants something iconic and grab-and-go.' },
      { author: 'Queue realist', rating: 4.3, text: 'Worth it if you love bak kwa, but this is more for tasting and buying than for sitting down.' },
      { author: 'Gift buyer', rating: 4.5, text: 'The easiest stop for bringing something local back to friends, especially if the tourist likes food souvenirs.' }
    ]
  },
  {
    id: 'poi_3',
    name: 'Mediapolis Porridge Corner',
    category: 'Local Porridge',
    lat: 1.2832,
    lng: 103.8263,
    description: 'Demo comfort-food stop near One-North for a warm porridge-style meal.',
    reviewSource: 'Curated demo notes',
    reviewSummary: 'Best for comfort-food seekers who care more about flavor depth than visuals.',
    reviews: [
      { author: 'Comfort bowl club', rating: 4.7, text: 'Silky porridge, humble setting, and very local energy. Strong choice for a cozy breakfast-style stop.' },
      { author: 'Texture critic', rating: 4.4, text: 'Go here if the tourist prefers warmth and tradition over snackable novelty.' },
      { author: 'Cash-only warning', rating: 4.2, text: 'Worth mentioning in the app because the experience feels more authentic than touristy.' }
    ]
  },
  {
    id: 'poi_4',
    name: 'Ayer Rajah Hawker Bites',
    category: 'Hawker',
    lat: 1.2862,
    lng: 103.8269,
    description: 'Demo hawker-style stop near the start point for quick local bites.',
    reviewSource: 'Curated demo notes',
    reviewSummary: 'Best for tourists who want a hawker classic and a more iconic local-food moment.',
    reviews: [
      { author: 'Hawker loyalist', rating: 4.8, text: 'Soft rice cakes, punchy preserved radish, and a very recognizable hawker experience.' },
      { author: 'First-timer lens', rating: 4.5, text: 'Easy to explain on stage because it feels distinctly Singaporean and visually memorable.' },
      { author: 'Morning food scout', rating: 4.4, text: 'Excellent stop if the user wants something traditional before the late-morning rush.' }
    ]
  },
  {
    id: 'poi_5',
    name: 'One-North Snack Stop',
    category: 'Local Snacks',
    lat: 1.2874,
    lng: 103.8265,
    description: 'Demo local snacks stop near the player start point for lighter grab-and-go food.',
    reviewSource: 'Curated demo notes',
    reviewSummary: 'Best for quick bites and lighter snacking when the user wants variety over one heavy dish.',
    reviews: [
      { author: 'Snack sampler', rating: 4.3, text: 'A good middle ground when the tourist wants local flavors without committing to a full sit-down meal.' },
      { author: 'Texture fan', rating: 4.2, text: 'Great for chewy, nostalgic snacks and easy sharing.' },
      { author: 'Choice optimizer', rating: 4.1, text: 'Less destination energy than the others, but practical if someone wants convenient variety.' }
    ]
  }
];

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistanceLabel(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) {
    return '';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function formatDurationLabel(durationSeconds) {
  if (!Number.isFinite(durationSeconds)) {
    return '';
  }

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  return `${minutes} min`;
}

function formatOpeningHours(openingHours) {
  if (!openingHours || openingHours === '{}') {
    return '';
  }

  try {
    const parsed = typeof openingHours === 'string' ? JSON.parse(openingHours) : openingHours;
    const firstDay = Object.keys(parsed)[0];
    const slots = parsed[firstDay];
    if (!firstDay || !Array.isArray(slots) || slots.length === 0) {
      return '';
    }

    const formattedDay = firstDay.charAt(0).toUpperCase() + firstDay.slice(1);
    const formattedSlots = slots.map((slot) => slot.join('-')).join(', ');
    return `${formattedDay}: ${formattedSlots}`;
  } catch (_error) {
    return '';
  }
}

function buildPoiDescription(place) {
  const bits = [place.description, place.formatted_address, formatOpeningHours(place.opening_hours)].filter(Boolean);
  return bits.join(' ');
}

function iconForCategory(category) {
  const label = String(category || '').toLowerCase();
  if (label.includes('bakery') || label.includes('pastry')) return '🥐';
  if (label.includes('bak kwa') || label.includes('bbq')) return '🥩';
  if (label.includes('porridge') || label.includes('congee')) return '🍚';
  if (label.includes('hawker') || label.includes('food')) return '🍜';
  if (label.includes('snack') || label.includes('dessert')) return '🍡';
  if (label.includes('cafe') || label.includes('coffee')) return '☕';
  return '📍';
}

function buildDefaultMissions(category) {
  const label = String(category || '').toLowerCase();
  if (label.includes('porridge') || label.includes('congee')) {
    return [
      { i: '📸', d: 'Snap the comfort bowl', p: 40 },
      { i: '⭐', d: 'Rate the porridge', p: 30 },
      { i: '📍', d: 'Check in', p: 20 }
    ];
  }

  if (label.includes('bak kwa') || label.includes('bbq')) {
    return [
      { i: '📸', d: 'Capture the grill glow', p: 40 },
      { i: '🎁', d: 'Pick a takeaway gift', p: 35 },
      { i: '📍', d: 'Check in', p: 20 }
    ];
  }

  return clone(DEFAULT_MISSIONS);
}

function normalizePoi(rawPoi, originLat, originLng, index = 0) {
  const lat = toNumber(rawPoi.lat ?? rawPoi.latitude ?? rawPoi.location?.latitude);
  const lng = toNumber(rawPoi.lng ?? rawPoi.longitude ?? rawPoi.location?.longitude);
  const category = rawPoi.category || rawPoi.cat || rawPoi.business_type || 'Point of Interest';
  const distanceMeters = haversineMeters(originLat, originLng, lat, lng);

  return {
    id: rawPoi.id || rawPoi.poi_id || `poi_${index + 1}`,
    name: rawPoi.name || `GrabMaps Stop ${index + 1}`,
    category,
    icon: rawPoi.icon || iconForCategory(category),
    lat,
    lng,
    distance: rawPoi.distance || formatDistanceLabel(distanceMeters),
    description: rawPoi.description || buildPoiDescription(rawPoi),
    missions: Array.isArray(rawPoi.missions) && rawPoi.missions.length > 0
      ? rawPoi.missions
      : buildDefaultMissions(category),
    reviewSummary: rawPoi.reviewSummary || '',
    reviewSource: rawPoi.reviewSource || '',
    reviews: Array.isArray(rawPoi.reviews) ? rawPoi.reviews : [],
    spun: Boolean(rawPoi.spun)
  };
}

function normalizeLivePois(places, originLat, originLng) {
  return places
    .map((place, index) => normalizePoi(place, originLat, originLng, index))
    .filter((poi) => Number.isFinite(poi.lat) && Number.isFinite(poi.lng));
}

function normalizeClientPois(pois, originLat, originLng) {
  return (Array.isArray(pois) ? pois : [])
    .map((poi, index) => normalizePoi(poi, originLat, originLng, index))
    .filter((poi) => Number.isFinite(poi.lat) && Number.isFinite(poi.lng));
}

function looksFoodRelated(poi) {
  const haystack = `${poi.name || ''} ${poi.category || ''} ${poi.description || ''}`.toLowerCase();
  const foodKeywords = [
    'food', 'eat', 'restaurant', 'cafe', 'coffee', 'bakery', 'pastry', 'dessert',
    'hawker', 'snack', 'porridge', 'congee', 'meal', 'drink', 'tea', 'juice',
    'bak kwa', 'bbq', 'noodle', 'rice', 'chicken', 'seafood', 'bar', 'pub'
  ];
  return foodKeywords.some((keyword) => haystack.includes(keyword));
}

function filterRelevantNearbyPois(pois, originLat, originLng, radiusMeters) {
  const paddedRadius = Math.max(radiusMeters * 1.5, 1200);

  return pois
    .map((poi) => {
      const distanceMeters = haversineMeters(originLat, originLng, poi.lat, poi.lng);
      return {
        ...poi,
        distance: formatDistanceLabel(distanceMeters),
        distanceMeters
      };
    })
    .filter((poi) => poi.distanceMeters <= paddedRadius)
    .filter((poi) => looksFoodRelated(poi))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .map(({ distanceMeters, ...poi }) => poi);
}

function dedupePois(pois) {
  const seen = new Set();
  return pois.filter((poi) => {
    const key = `${poi.id}:${poi.name}:${poi.lat}:${poi.lng}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getMockPois(originLat = MOCK_POIS[0].lat, originLng = MOCK_POIS[0].lng) {
  return MOCK_POIS.map((poi, index) => normalizePoi(poi, originLat, originLng, index));
}

function getMockReviewBundle(poi) {
  if (!poi) {
    return null;
  }

  return {
    source: 'mock',
    sourceLabel: poi.reviewSource || 'Curated demo notes',
    summary: poi.reviewSummary || 'Quick comparison notes for this stop.',
    reviews: Array.isArray(poi.reviews) ? poi.reviews : []
  };
}

function buildFallbackReviewBundle(name, category) {
  const label = String(category || '').toLowerCase();
  const vibe =
    label.includes('bakery') ? 'best for pastries and a nostalgic stop' :
    label.includes('bak kwa') ? 'best for bold savory flavor and takeaway gifts' :
    label.includes('porridge') ? 'best for comfort food and a slower local moment' :
    label.includes('hawker') ? 'best for a classic Singapore hawker-food experience' :
    'best for a quick local snack stop';

  return {
    source: 'fallback',
    sourceLabel: 'Comparison notes',
    summary: `${name} is ${vibe}. Add a review API later to swap these notes for live public reviews.`,
    reviews: [
      { author: 'Taste profile', rating: 4.4, text: `${name} looks like a strong pick if the user wants ${vibe.replace('best for ', '')}.` },
      { author: 'Decision helper', rating: 4.2, text: 'Use this card to compare atmosphere and food style against the other highlighted stops.' }
    ]
  };
}

function fallbackDirections(originLat, originLng, destLat, destLng) {
  const distanceMeters = haversineMeters(originLat, originLng, destLat, destLng);
  const walkSeconds = distanceMeters / 1.35;

  return {
    route: [
      [Number(originLng), Number(originLat)],
      [Number(destLng), Number(destLat)]
    ],
    distance: formatDistanceLabel(distanceMeters),
    duration: formatDurationLabel(walkSeconds)
  };
}

module.exports = {
  MOCK_POIS,
  buildFallbackReviewBundle,
  dedupePois,
  fallbackDirections,
  filterRelevantNearbyPois,
  formatDistanceLabel,
  formatDurationLabel,
  getMockPois,
  getMockReviewBundle,
  haversineMeters,
  iconForCategory,
  normalizeClientPois,
  normalizeLivePois,
  normalizePoi
};
