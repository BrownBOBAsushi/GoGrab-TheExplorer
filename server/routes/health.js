const express = require('express');

function createHealthRoute({ grabMapsService, tripPlannerService }) {
  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      ...grabMapsService.getHealthStatus(),
      ...tripPlannerService.getHealthStatus()
    });
  });

  return router;
}

module.exports = {
  createHealthRoute
};
