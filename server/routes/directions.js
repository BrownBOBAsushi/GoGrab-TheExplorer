const express = require('express');

function createDirectionsRoute({ grabMapsService }) {
  const router = express.Router();

  router.get('/directions', async (req, res) => {
    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    const destLat = Number(req.query.destLat);
    const destLng = Number(req.query.destLng);

    if (![originLat, originLng, destLat, destLng].every(Number.isFinite)) {
      return res.status(400).json({ error: 'originLat, originLng, destLat and destLng are required' });
    }

    const result = await grabMapsService.getDirections({ originLat, originLng, destLat, destLng });
    return res.json(result);
  });

  return router;
}

module.exports = {
  createDirectionsRoute
};
