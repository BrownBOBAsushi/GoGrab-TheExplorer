const express = require('express');

function createNearbyRoute({ grabMapsService }) {
  const router = express.Router();

  router.get('/nearby', async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusMeters = Math.max(100, Number(req.query.radius) || 1000);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    const result = await grabMapsService.getNearby({ lat, lng, radiusMeters });
    return res.json(result);
  });

  return router;
}

module.exports = {
  createNearbyRoute
};
