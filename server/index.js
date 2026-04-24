require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve(__dirname, '..')));

const GRAB_KEY = cleanEnv(process.env.GRABMAPS_API_KEY);
const GRABMAPS_BASE_URL = cleanEnv(process.env.GRABMAPS_BASE_URL) || 'https://maps.grab.com';
const GRABMAPS_MCP_TOKEN = cleanEnv(process.env.GRABMAPS_MCP_TOKEN);
const GRABMAPS_MCP_URL = cleanEnv(process.env.GRABMAPS_MCP_URL) || 'https://maps.grab.com/api/v1/mcp';
const GRABMAPS_TILE_URL = cleanEnv(process.env.GRABMAPS_TILE_URL) || null;
const GRABMAPS_NEARBY_URL = cleanEnv(process.env.GRABMAPS_NEARBY_URL) || 'https://partner-api.grab.com/maps/place/v2/nearby';
const GRABMAPS_DIRECTIONS_URL = cleanEnv(process.env.GRABMAPS_DIRECTIONS_URL) || 'https://partner-api.grab.com/maps/eta/v1/direction';
const GROQ_API_KEY = cleanEnv(process.env.GROQ_API_KEY);
const GROQ_MODEL = cleanEnv(process.env.GROQ_MODEL) || 'llama-3.3-70b-versatile';

const MOCK_POIS = [
  {
    id: 'poi_1',
    name: 'Media Link Bakery Stop',
    category: 'Traditional Bakery',
    lat: 1.2847,
    lng: 103.8278,
    distance: '420m',
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
    distance: '510m',
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
    distance: '680m',
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
    distance: '390m',
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
    distance: '820m',
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

function cleanEnv(value) {
  if (!value) {
    return '';
  }
  return String(value).trim().replace(/\\+$/, '');
}

function isChain(poi) {
  const chains = ['starbucks', 'mcdonald', 'kfc', 'subway', 'burger king', 'pizza hut', '7-eleven', 'domino'];
  const haystack = `${poi.name || ''} ${poi.category || ''}`.toLowerCase();
  return chains.some((chain) => haystack.includes(chain));
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
  const bits = [place.formatted_address, formatOpeningHours(place.opening_hours)]
    .filter(Boolean);
  return bits.join(' ');
}

function getMockReviewBundle(poi) {
  if (!poi) {
    return null;
  }

  return {
    source: 'curated',
    sourceLabel: poi.reviewSource || 'Curated demo notes',
    summary: poi.reviewSummary || 'Quick comparison notes for this stop.',
    reviews: Array.isArray(poi.reviews) ? poi.reviews : []
  };
}

function buildFallbackReviewBundle(name, category) {
  const label = (category || '').toLowerCase();
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

function normalizeGrabPlace(place, originLat, originLng, index) {
  const latitude = Number(place.lat ?? place.latitude ?? place.location?.latitude);
  const longitude = Number(place.lng ?? place.longitude ?? place.location?.longitude);
  const category = place.category || place.business_type || 'Point of Interest';
  const distanceMeters = haversineMeters(originLat, originLng, latitude, longitude);

  return {
    id: place.id || place.poi_id || `grab_poi_${index + 1}`,
    name: place.name || `GrabMaps Stop ${index + 1}`,
    category,
    lat: latitude,
    lng: longitude,
    distance: place.distance || formatDistanceLabel(distanceMeters),
    description: place.description || buildPoiDescription(place),
    reviews: Array.isArray(place.reviews) ? place.reviews : [],
    reviewSource: place.reviewSource || '',
    reviewSummary: place.reviewSummary || ''
  };
}

function normalizeLivePois(places, originLat, originLng) {
  return places
    .map((place, index) => normalizeGrabPlace(place, originLat, originLng, index))
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

function fallbackDirections(originLat, originLng, destLat, destLng) {
  return {
    fallback: true,
    route: [
      [Number(originLng), Number(originLat)],
      [Number(destLng), Number(destLat)]
    ],
    distance: 'Walking distance',
    duration: 'A few minutes'
  };
}

function buildGrabAuthHeaders(extraHeaders = {}) {
  if (!GRAB_KEY) {
    throw new Error('Grab Maps API key is not configured');
  }

  return {
    Authorization: `Bearer ${GRAB_KEY}`,
    ...extraHeaders
  };
}

function rewriteGrabMapsUrls(value) {
  if (Array.isArray(value)) {
    return value.map(rewriteGrabMapsUrls);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, rewriteGrabMapsUrls(nestedValue)])
    );
  }

  if (typeof value === 'string' && value.startsWith(`${GRABMAPS_BASE_URL}/`)) {
    return value.replace(`${GRABMAPS_BASE_URL}/`, '/api/grabmaps/');
  }

  return value;
}

function parseSseJson(content) {
  const dataLines = String(content)
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6));

  if (dataLines.length === 0) {
    return null;
  }

  return JSON.parse(dataLines.join('\n'));
}

async function initializeMcpSession() {
  if (!GRABMAPS_MCP_TOKEN) {
    return null;
  }

  const response = await fetch(GRABMAPS_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GRABMAPS_MCP_TOKEN}`,
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-03-26',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: {
          name: 'GrabExplore local proxy',
          version: '1.0.0'
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`MCP initialize failed with ${response.status}`);
  }

  const sessionId = response.headers.get('mcp-session-id');
  if (!sessionId) {
    throw new Error('MCP initialize did not return a session id');
  }

  return sessionId;
}

async function callMcpTool(name, args) {
  const sessionId = await initializeMcpSession();
  if (!sessionId) {
    throw new Error('Grab Maps MCP token is not configured');
  }

  const response = await fetch(GRABMAPS_MCP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GRABMAPS_MCP_TOKEN}`,
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-03-26',
      'Mcp-Session-Id': sessionId,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name,
        arguments: args
      }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MCP ${name} failed with ${response.status}: ${text}`);
  }

  const payload = parseSseJson(await response.text());
  const result = payload?.result;
  if (!result) {
    throw new Error(`MCP ${name} returned no result payload`);
  }

  return result.structuredContent || JSON.parse(result.content?.[0]?.text || '{}');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${text}`);
  }
  return response.json();
}

async function createTripPlanWithGroq(userMessage, userLat, userLng, availablePOIs) {
  if (!GROQ_API_KEY) {
    return null;
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are GrabExplore\'s trip planning assistant for tourists in Singapore. Always reply with valid JSON only.'
        },
        {
          role: 'user',
          content: `The user is at coordinates: ${userLat}, ${userLng}.
Available nearby spots: ${JSON.stringify(availablePOIs)}.
Reply warmly in 2 sentences max. Then return EXACTLY 3 POI names from the list above that best match what the user wants as JSON only.
Format: {"reply":"...","recommendations":["POI Name 1","POI Name 2","POI Name 3"]}

User said: ${userMessage}`
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Groq chat failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Groq chat returned no message content');
  }

  return JSON.parse(content);
}

async function searchNearbyPoisForQuery(userMessage, userLat, userLng) {
  const query = String(userMessage || '').trim();
  if (!query) {
    return [];
  }

  if (GRABMAPS_MCP_TOKEN) {
    const searchResult = await callMcpTool('search', {
      keyword: query,
      country: 'SGP',
      location: {
        latitude: userLat,
        longitude: userLng
      },
      limit: 8
    });
    return dedupePois(normalizeLivePois(searchResult.places || [], userLat, userLng));
  }

  return [];
}

function decodePolyline(str, precision = 6) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];
  const factor = 10 ** precision;

  while (index < str.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

async function fetchNearbyFromPartnerApi(lat, lng, radiusKm) {
  if (!GRAB_KEY) {
    throw new Error('Grab Maps API key is not configured');
  }

  return fetchJson(
    `${GRABMAPS_NEARBY_URL}?location=${lat},${lng}&radius=${radiusKm}&limit=10&rankBy=distance`,
    {
      headers: {
        'x-api-key': GRAB_KEY
      }
    }
  );
}

async function fetchDirectionsFromPartnerApi(originLat, originLng, destLat, destLng) {
  if (!GRAB_KEY) {
    throw new Error('Grab Maps API key is not configured');
  }

  return fetchJson(
    `${GRABMAPS_DIRECTIONS_URL}?coordinates=${originLng},${originLat}&coordinates=${destLng},${destLat}&profile=walking&lat_first=false&overview=full&geometries=polyline6&steps=false`,
    {
      headers: {
        'x-api-key': GRAB_KEY
      }
    }
  );
}

app.get('/api/style.json', async (req, res) => {
  const theme = String(req.query.theme || 'basic').trim() || 'basic';

  try {
    const response = await fetch(
      `${GRABMAPS_BASE_URL}/api/style.json?theme=${encodeURIComponent(theme)}`,
      {
        headers: buildGrabAuthHeaders({
          Accept: 'application/json'
        })
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`style proxy failed with ${response.status}: ${text}`);
    }

    const style = await response.json();
    res.json(rewriteGrabMapsUrls(style));
  } catch (error) {
    console.error('Style proxy failed:', error.message);
    res.status(502).json({ error: 'style proxy failed' });
  }
});

app.get('/api/grabmaps/*', async (req, res) => {
  const tail = req.params[0];
  const query = req.originalUrl.split('?')[1];
  const upstreamUrl = `${GRABMAPS_BASE_URL}/${tail}${query ? `?${query}` : ''}`;

  try {
    const response = await fetch(upstreamUrl, {
      headers: buildGrabAuthHeaders()
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`grabmaps proxy failed with ${response.status}: ${text}`);
    }

    const buffer = await response.buffer();
    res.set('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.set('Cache-Control', response.headers.get('cache-control') || 'public, max-age=3600');
    res.send(buffer);
  } catch (error) {
    console.error('GrabMaps asset proxy failed:', error.message);
    res.status(502).json({ error: 'grabmaps asset proxy failed' });
  }
});

app.get('/api/tiles/:z/:x/:y', async (req, res) => {
  const { z, x, y } = req.params;
  const url = GRAB_KEY && GRABMAPS_TILE_URL
    ? `${GRABMAPS_TILE_URL}/${z}/${x}/${y}?key=${GRAB_KEY}`
    : `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}@2x.png`;

  try {
    const response = await fetch(url);
    const buffer = await response.buffer();
    res.set('Content-Type', response.headers.get('content-type') || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (error) {
    console.error('Tile proxy failed:', error.message);
    res.status(502).json({ error: 'tile proxy failed' });
  }
});

app.get('/api/nearby', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusMeters = Math.max(100, Number(req.query.radius) || 1000);
  const radiusKm = Number((radiusMeters / 1000).toFixed(2));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  try {
    if (GRABMAPS_MCP_TOKEN) {
      const nearby = await callMcpTool('search_nearby_pois', {
        latitude: lat,
        longitude: lng,
        radius_km: radiusKm,
        limit: 10
      });
      const livePois = filterRelevantNearbyPois(
        normalizeLivePois(nearby.places || [], lat, lng),
        lat,
        lng,
        radiusMeters
      );
      if (livePois.length > 0) {
        return res.json({ pois: livePois.slice(0, 5), source: 'grab-mcp' });
      }
      console.warn('Grab Maps MCP nearby returned no usable nearby food POIs, using mock POIs');
    } else if (GRAB_KEY) {
      const nearby = await fetchNearbyFromPartnerApi(lat, lng, radiusKm);
      const livePois = filterRelevantNearbyPois(
        normalizeLivePois(nearby.places || [], lat, lng),
        lat,
        lng,
        radiusMeters
      );
      if (livePois.length > 0) {
        return res.json({ pois: livePois.slice(0, 5), source: 'grab' });
      }
      console.warn('Grab partner nearby returned no usable nearby food POIs, using mock POIs');
    }
  } catch (error) {
    console.error('Nearby API failed:', error.message);
  }

  return res.json({ pois: MOCK_POIS, source: 'mock' });
});

app.get('/api/reviews', (req, res) => {
  const id = String(req.query.id || '').trim();
  const name = String(req.query.name || '').trim();
  const category = String(req.query.category || '').trim();

  const mockPoi = MOCK_POIS.find((poi) =>
    (id && poi.id === id) ||
    (name && poi.name.toLowerCase() === name.toLowerCase())
  );

  if (mockPoi) {
    return res.json(getMockReviewBundle(mockPoi));
  }

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  return res.json(buildFallbackReviewBundle(name, category));
});

app.get('/api/directions', async (req, res) => {
  const originLat = Number(req.query.originLat);
  const originLng = Number(req.query.originLng);
  const destLat = Number(req.query.destLat);
  const destLng = Number(req.query.destLng);

  if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
    return res.status(400).json({ error: 'originLat, originLng, destLat and destLng are required' });
  }

  try {
    if (GRABMAPS_MCP_TOKEN) {
      const result = await callMcpTool('navigation', {
        profile: 'walking',
        coordinates: [
          { latitude: originLat, longitude: originLng },
          { latitude: destLat, longitude: destLng }
        ],
        overview: 'full',
        steps: false
      });
      const route = result.routes?.[0];
      if (route?.geometry) {
        return res.json({
          route: decodePolyline(route.geometry, 6),
          distance: formatDistanceLabel(route.distance),
          duration: formatDurationLabel(route.duration),
          source: 'grab-mcp'
        });
      }
    } else if (GRAB_KEY) {
      const result = await fetchDirectionsFromPartnerApi(originLat, originLng, destLat, destLng);
      const route = result.routes?.[0];
      if (route?.geometry) {
        return res.json({
          route: decodePolyline(route.geometry, 6),
          distance: formatDistanceLabel(route.distance),
          duration: formatDurationLabel(route.duration),
          source: 'grab'
        });
      }
    }
  } catch (error) {
    console.error('Directions API failed:', error.message);
  }

  return res.json(fallbackDirections(originLat, originLng, destLat, destLng));
});

app.post('/api/chat', async (req, res) => {
  const { userMessage, userLat, userLng, availablePOIs } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'userMessage required' });
  }

  if (!GROQ_API_KEY) {
    return res.json({
      reply: 'Here are some great hidden spots near you that locals love!',
      recommendations: (availablePOIs || MOCK_POIS).slice(0, 3).map((poi) => poi.name)
    });
  }

  try {
    const queryPois = await searchNearbyPoisForQuery(userMessage, Number(userLat), Number(userLng));
    const candidatePois = queryPois.length > 0
      ? queryPois
      : (availablePOIs || MOCK_POIS);
    const parsed = await createTripPlanWithGroq(userMessage, userLat, userLng, candidatePois);
    if (queryPois.length > 0) {
      parsed.pois = queryPois.slice(0, 5);
    }
    return res.json(parsed);
  } catch (error) {
    console.error('Trip planner AI error:', error.message);
    return res.json({
      reply: 'Here are some great hidden spots near you that locals love!',
      recommendations: (availablePOIs || MOCK_POIS).slice(0, 3).map((poi) => poi.name)
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasGrabKey: Boolean(GRAB_KEY),
    hasGrabMcpToken: Boolean(GRABMAPS_MCP_TOKEN),
    hasGroqKey: Boolean(GROQ_API_KEY),
    groqModel: GROQ_MODEL
  });
});

app.get('/', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '..', 'GrabExplore.html'));
});

app.listen(3000, () => {
  console.log('GrabExplore proxy running on http://localhost:3000');
});
