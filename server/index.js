require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createGrabMapsService } = require('./services/grabmaps-service');
const { createTripPlannerService } = require('./services/trip-planner-service');
const { createMapAssetsRoute } = require('./routes/map-assets');
const { createNearbyRoute } = require('./routes/nearby');
const { createDirectionsRoute } = require('./routes/directions');
const { createChatRoute } = require('./routes/chat');
const { createReviewsRoute } = require('./routes/reviews');
const { createHealthRoute } = require('./routes/health');

function createApp({ env = process.env, fetchImpl } = {}) {
  const app = express();
  const grabMapsService = createGrabMapsService({ env, fetchImpl });
  const tripPlannerService = createTripPlannerService({ env, fetchImpl });

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, '..')));

  app.use('/api', createMapAssetsRoute({ grabMapsService }));
  app.use('/api', createNearbyRoute({ grabMapsService }));
  app.use('/api', createDirectionsRoute({ grabMapsService }));
  app.use('/api', createChatRoute({ grabMapsService, tripPlannerService }));
  app.use('/api', createReviewsRoute({ grabMapsService }));
  app.use('/api', createHealthRoute({ grabMapsService, tripPlannerService }));

  app.get('/', (_req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'GoGrab.html'));
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(3000, () => {
    console.log('GoGrab proxy running on http://localhost:3000');
  });
}

module.exports = {
  createApp
};
