const express = require('express');

function createMapAssetsRoute({ grabMapsService }) {
  const router = express.Router();

  router.get('/style.json', async (req, res) => {
    const theme = String(req.query.theme || 'basic').trim() || 'basic';

    try {
      const style = await grabMapsService.getStyle(theme);
      res.json(style);
    } catch (error) {
      res.status(502).json({ error: 'style proxy failed', reason: error.message });
    }
  });

  router.get('/grabmaps/*', async (req, res) => {
    try {
      const tail = req.params[0];
      const query = req.originalUrl.split('?')[1];
      const payload = await grabMapsService.getGrabAsset(tail, query);
      res.set('Content-Type', payload.contentType);
      res.set('Cache-Control', payload.cacheControl);
      res.send(payload.buffer);
    } catch (error) {
      res.status(502).json({ error: 'grabmaps asset proxy failed', reason: error.message });
    }
  });

  router.get('/tiles/:z/:x/:y', async (req, res) => {
    try {
      const payload = await grabMapsService.getTile(req.params.z, req.params.x, req.params.y);
      res.set('Content-Type', payload.contentType);
      res.set('Cache-Control', payload.cacheControl);
      res.send(payload.buffer);
    } catch (error) {
      res.status(502).json({ error: 'tile proxy failed', reason: error.message });
    }
  });

  return router;
}

module.exports = {
  createMapAssetsRoute
};
