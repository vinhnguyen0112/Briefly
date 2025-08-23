const express = require('express');
const metricsService = require('../services/metricsService');
const metricsConfig = require('../config/metrics');

const router = express.Router();

function authenticateMetrics(req, res, next) {
  if (!metricsConfig.endpoint.protected) {
    return next();
  }
  
  const authToken = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
  if (authToken !== metricsConfig.endpoint.authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

router.get('/metrics', authenticateMetrics, async (req, res) => {
  try {
    if (!metricsConfig.enabled) {
      return res.status(503).json({ error: 'Metrics collection disabled' });
    }
    
    res.set('Content-Type', metricsService.getRegister().contentType);
    const metrics = await metricsService.getMetrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

module.exports = router;