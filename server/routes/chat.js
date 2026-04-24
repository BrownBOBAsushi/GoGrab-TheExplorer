const express = require('express');
const { normalizeClientPois } = require('../utils/normalize-poi');
const { withResponseMeta } = require('../utils/response-meta');

function createChatRoute({ grabMapsService, tripPlannerService }) {
  const router = express.Router();

  router.post('/chat', async (req, res) => {
    const { userMessage, userLat, userLng, availablePOIs } = req.body || {};
    const numericLat = Number(userLat) || 1.285;
    const numericLng = Number(userLng) || 103.8268;

    if (!userMessage) {
      return res.status(400).json({ error: 'userMessage required' });
    }

    const safeAvailablePois = normalizeClientPois(availablePOIs, numericLat, numericLng);
    const fallbackPois = safeAvailablePois.length > 0
      ? safeAvailablePois
      : grabMapsService.getMockPois(numericLat, numericLng);

    const queryResult = await grabMapsService.searchNearbyPoisForQuery(userMessage, numericLat, numericLng);
    const candidatePois = queryResult.pois.length > 0 ? queryResult.pois : fallbackPois;
    const plan = await tripPlannerService.planTrip({
      userMessage,
      userLat: numericLat,
      userLng: numericLng,
      availablePois: candidatePois
    });

    const response = withResponseMeta(
      {
        reply: plan.reply,
        recommendations: plan.recommendations,
        pois: candidatePois.slice(0, 5),
        poiSource: queryResult.pois.length > 0 ? queryResult.source : null
      },
      {
        source: plan.source,
        fallback: plan.fallback,
        reason: plan.reason || queryResult.reason
      }
    );

    return res.json(response);
  });

  return router;
}

module.exports = {
  createChatRoute
};
