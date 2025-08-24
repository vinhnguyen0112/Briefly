module.exports = {
  enabled: process.env.METRICS_ENABLED !== 'false',
  
  httpMetrics: {
    enabled: true,
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  },
  
  dbMetrics: {
    enabled: true,
    buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
  },
  
  redisMetrics: {
    enabled: true,
    buckets: [0.001, 0.01, 0.1, 0.5, 1],
  },
  
  openaiMetrics: {
    enabled: true,
    buckets: [0.5, 1, 2, 5, 10, 20, 30],
  },
  
  ragMetrics: {
    enabled: true,
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  },
  
  businessMetrics: {
    enabled: true,
  },
  
  collectDefaultMetrics: {
    enabled: true,
    timeout: 5000,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  },
  
  endpoint: {
    path: '/metrics',
    protected: process.env.METRICS_PROTECTED === 'true',
    authToken: process.env.METRICS_AUTH_TOKEN,
  },
  
  memoryManagement: {
    enabled: true,
    maxCacheSize: parseInt(process.env.METRICS_MAX_CACHE_SIZE) || 1000,
    cleanupIntervalMs: parseInt(process.env.METRICS_CLEANUP_INTERVAL_MS) || 300000, // 5 minutes
    maxMetricsMemoryMB: parseInt(process.env.METRICS_MAX_MEMORY_MB) || 50,
  }
};