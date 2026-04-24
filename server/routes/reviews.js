const express = require('express');

function createReviewsRoute({ grabMapsService }) {
  const router = express.Router();

  router.get('/reviews', (req, res) => {
    const id = String(req.query.id || '').trim();
    const name = String(req.query.name || '').trim();
    const category = String(req.query.category || '').trim();
    const lat = Number(req.query.lat) || 1.285;
    const lng = Number(req.query.lng) || 103.8268;

    if (!name && !id) {
      return res.status(400).json({ error: 'name or id is required' });
    }

    return res.json(grabMapsService.getReviews({ id, name, category, lat, lng }));
  });

  return router;
}

module.exports = {
  createReviewsRoute
};
