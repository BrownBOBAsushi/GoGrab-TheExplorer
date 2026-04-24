const fetch = require('node-fetch');
const {
  buildFallbackReviewBundle,
  dedupePois,
  fallbackDirections,
  filterRelevantNearbyPois,
  formatDistanceLabel,
  formatDurationLabel,
  getMockPois,
  getMockReviewBundle,
  normalizeLivePois
} = require('../utils/normalize-poi');
const { withResponseMeta } = require('../utils/response-meta');

function cleanEnv(value) {
  if (!value) {
    return '';
  }

  return String(value).trim().replace(/\\+$/, '');
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

function createGrabMapsService({ env = process.env, fetchImpl = fetch } = {}) {
  const config = {
    GRAB_KEY: cleanEnv(env.GRABMAPS_API_KEY),
    GRABMAPS_BASE_URL: cleanEnv(env.GRABMAPS_BASE_URL) || 'https://maps.grab.com',
    GRABMAPS_MCP_TOKEN: cleanEnv(env.GRABMAPS_MCP_TOKEN),
    GRABMAPS_MCP_URL: cleanEnv(env.GRABMAPS_MCP_URL) || 'https://maps.grab.com/api/v1/mcp',
    GRABMAPS_TILE_URL: cleanEnv(env.GRABMAPS_TILE_URL) || '',
    GRABMAPS_NEARBY_URL: cleanEnv(env.GRABMAPS_NEARBY_URL) || 'https://partner-api.grab.com/maps/place/v2/nearby',
    GRABMAPS_DIRECTIONS_URL: cleanEnv(env.GRABMAPS_DIRECTIONS_URL) || 'https://partner-api.grab.com/maps/eta/v1/direction'
  };

  function getMockPoisFor(lat, lng) {
    return getMockPois(lat, lng);
  }

  function getHealthStatus() {
    return {
      hasGrabKey: Boolean(config.GRAB_KEY),
      hasGrabMcpToken: Boolean(config.GRABMAPS_MCP_TOKEN)
    };
  }

  function buildGrabAuthHeaders(extraHeaders = {}) {
    if (!config.GRAB_KEY) {
      throw new Error('Grab Maps API key is not configured');
    }

    return {
      Authorization: `Bearer ${config.GRAB_KEY}`,
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

    if (typeof value === 'string' && value.startsWith(`${config.GRABMAPS_BASE_URL}/`)) {
      return value.replace(`${config.GRABMAPS_BASE_URL}/`, '/api/grabmaps/');
    }

    return value;
  }

  async function fetchJson(url, options = {}) {
    const response = await fetchImpl(url, options);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${text}`);
    }
    return response.json();
  }

  async function initializeMcpSession() {
    if (!config.GRABMAPS_MCP_TOKEN) {
      return null;
    }

    const response = await fetchImpl(config.GRABMAPS_MCP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.GRABMAPS_MCP_TOKEN}`,
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
            name: 'GoGrab local proxy',
            version: '2.0.0'
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

    const response = await fetchImpl(config.GRABMAPS_MCP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.GRABMAPS_MCP_TOKEN}`,
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

  async function searchNearbyFoodPoisViaMcpSearch(lat, lng, radiusMeters) {
    const fallbackKeywords = ['food', 'restaurant', 'hawker', 'bakery', 'cafe'];
    const collected = [];
    let lastError = null;

    for (const keyword of fallbackKeywords) {
      try {
        const searchResult = await callMcpTool('search', {
          keyword,
          country: 'SGP',
          location: {
            latitude: lat,
            longitude: lng
          },
          limit: 8
        });
        collected.push(...normalizeLivePois(searchResult.places || [], lat, lng));
      } catch (error) {
        lastError = error;
      }
    }

    return {
      pois: dedupePois(filterRelevantNearbyPois(collected, lat, lng, radiusMeters)),
      reason: lastError ? lastError.message : null
    };
  }

  async function searchNearbyPoisForQuery(userMessage, userLat, userLng) {
    const query = String(userMessage || '').trim();
    if (!query) {
      return withResponseMeta({ pois: [] }, { source: 'fallback', fallback: true, reason: 'Search query is empty' });
    }

    if (!config.GRABMAPS_MCP_TOKEN) {
      return withResponseMeta({ pois: [] }, { source: 'fallback', fallback: true, reason: 'Grab Maps MCP token is not configured' });
    }

    try {
      const searchResult = await callMcpTool('search', {
        keyword: query,
        country: 'SGP',
        location: {
          latitude: userLat,
          longitude: userLng
        },
        limit: 8
      });

      const pois = dedupePois(
        filterRelevantNearbyPois(
          normalizeLivePois(searchResult.places || [], userLat, userLng),
          userLat,
          userLng,
          3000
        )
      );

      return withResponseMeta({ pois }, { source: 'grab-mcp', fallback: false, reason: null });
    } catch (error) {
      return withResponseMeta({ pois: [] }, { source: 'fallback', fallback: true, reason: error.message });
    }
  }

  async function fetchNearbyFromPartnerApi(lat, lng, radiusKm) {
    if (!config.GRAB_KEY) {
      throw new Error('Grab Maps API key is not configured');
    }

    return fetchJson(
      `${config.GRABMAPS_NEARBY_URL}?location=${lat},${lng}&radius=${radiusKm}&limit=10&rankBy=distance`,
      {
        headers: {
          'x-api-key': config.GRAB_KEY
        }
      }
    );
  }

  async function fetchDirectionsFromPartnerApi(originLat, originLng, destLat, destLng) {
    if (!config.GRAB_KEY) {
      throw new Error('Grab Maps API key is not configured');
    }

    return fetchJson(
      `${config.GRABMAPS_DIRECTIONS_URL}?coordinates=${originLng},${originLat}&coordinates=${destLng},${destLat}&profile=walking&lat_first=false&overview=full&geometries=polyline6&steps=false`,
      {
        headers: {
          'x-api-key': config.GRAB_KEY
        }
      }
    );
  }

  async function getNearby({ lat, lng, radiusMeters }) {
    const radiusKm = Number((radiusMeters / 1000).toFixed(2));

    try {
      if (config.GRABMAPS_MCP_TOKEN) {
        let livePois = [];
        let liveReason = null;

        try {
          const nearby = await callMcpTool('search_nearby_pois', {
            latitude: lat,
            longitude: lng,
            radius_km: radiusKm,
            limit: 10
          });

          livePois = filterRelevantNearbyPois(
            normalizeLivePois(nearby.places || [], lat, lng),
            lat,
            lng,
            radiusMeters
          );
        } catch (error) {
          liveReason = error.message;
        }

        if (livePois.length === 0) {
          const searchFallback = await searchNearbyFoodPoisViaMcpSearch(lat, lng, radiusMeters);
          livePois = searchFallback.pois;
          liveReason = liveReason || searchFallback.reason;
        }

        if (livePois.length > 0) {
          return withResponseMeta({ pois: livePois.slice(0, 5) }, { source: 'grab-mcp', fallback: false, reason: null });
        }

        return withResponseMeta(
          { pois: getMockPoisFor(lat, lng) },
          { source: 'mock', fallback: true, reason: liveReason || 'Grab Maps MCP returned no usable nearby food POIs' }
        );
      }

      if (config.GRAB_KEY) {
        const nearby = await fetchNearbyFromPartnerApi(lat, lng, radiusKm);
        const livePois = filterRelevantNearbyPois(
          normalizeLivePois(nearby.places || [], lat, lng),
          lat,
          lng,
          radiusMeters
        );

        if (livePois.length > 0) {
          return withResponseMeta({ pois: livePois.slice(0, 5) }, { source: 'grab', fallback: false, reason: null });
        }

        return withResponseMeta(
          { pois: getMockPoisFor(lat, lng) },
          { source: 'mock', fallback: true, reason: 'Grab partner nearby returned no usable nearby food POIs' }
        );
      }
    } catch (error) {
      return withResponseMeta(
        { pois: getMockPoisFor(lat, lng) },
        { source: 'mock', fallback: true, reason: error.message }
      );
    }

    return withResponseMeta(
      { pois: getMockPoisFor(lat, lng) },
      { source: 'mock', fallback: true, reason: 'Grab Maps credentials are not configured' }
    );
  }

  async function getDirections({ originLat, originLng, destLat, destLng }) {
    try {
      if (config.GRABMAPS_MCP_TOKEN) {
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
          return withResponseMeta(
            {
              route: decodePolyline(route.geometry, 6),
              distance: formatDistanceLabel(route.distance),
              duration: formatDurationLabel(route.duration)
            },
            { source: 'grab-mcp', fallback: false, reason: null }
          );
        }
      } else if (config.GRAB_KEY) {
        const result = await fetchDirectionsFromPartnerApi(originLat, originLng, destLat, destLng);
        const route = result.routes?.[0];
        if (route?.geometry) {
          return withResponseMeta(
            {
              route: decodePolyline(route.geometry, 6),
              distance: formatDistanceLabel(route.distance),
              duration: formatDurationLabel(route.duration)
            },
            { source: 'grab', fallback: false, reason: null }
          );
        }
      }
    } catch (error) {
      const fallback = fallbackDirections(originLat, originLng, destLat, destLng);
      return withResponseMeta(fallback, { source: 'fallback', fallback: true, reason: error.message });
    }

    return withResponseMeta(
      fallbackDirections(originLat, originLng, destLat, destLng),
      { source: 'fallback', fallback: true, reason: 'Live directions are unavailable' }
    );
  }

  function getReviews({ id, name, category, lat, lng }) {
    const mockPoi = getMockPoisFor(lat, lng).find((poi) =>
      (id && poi.id === id) ||
      (name && poi.name.toLowerCase() === String(name).toLowerCase())
    );

    if (mockPoi) {
      return getMockReviewBundle(mockPoi);
    }

    return buildFallbackReviewBundle(name, category);
  }

  async function getStyle(theme = 'basic') {
    const response = await fetchImpl(
      `${config.GRABMAPS_BASE_URL}/api/style.json?theme=${encodeURIComponent(theme)}`,
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
    const rewrittenStyle = rewriteGrabMapsUrls(style);
    rewrittenStyle.glyphs = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';
    return rewrittenStyle;
  }

  async function getGrabAsset(tail, queryString) {
    const upstreamUrl = `${config.GRABMAPS_BASE_URL}/${tail}${queryString ? `?${queryString}` : ''}`;
    const response = await fetchImpl(upstreamUrl, {
      headers: buildGrabAuthHeaders()
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`grabmaps proxy failed with ${response.status}: ${text}`);
    }

    return {
      buffer: await response.buffer(),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      cacheControl: response.headers.get('cache-control') || 'public, max-age=3600'
    };
  }

  async function getTile(z, x, y) {
    const url = config.GRAB_KEY && config.GRABMAPS_TILE_URL
      ? `${config.GRABMAPS_TILE_URL}/${z}/${x}/${y}?key=${config.GRAB_KEY}`
      : `https://a.basemaps.cartocdn.com/dark_matter/${z}/${x}/${y}@2x.png`;

    const response = await fetchImpl(url);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`tile proxy failed with ${response.status}: ${text}`);
    }

    return {
      buffer: await response.buffer(),
      contentType: response.headers.get('content-type') || 'image/png',
      cacheControl: 'public, max-age=86400'
    };
  }

  return {
    getHealthStatus,
    getMockPois: getMockPoisFor,
    getNearby,
    getDirections,
    getReviews,
    getStyle,
    getGrabAsset,
    getTile,
    searchNearbyPoisForQuery
  };
}

module.exports = {
  createGrabMapsService
};
