const metricsService = require('../services/metricsService');

function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  
  const originalEnd = res.end;
  const originalSend = res.send;
  
  res.end = function(...args) {
    recordMetrics();
    originalEnd.apply(res, args);
  };
  
  res.send = function(...args) {
    recordMetrics();
    originalSend.apply(res, args);
  };

  function recordMetrics() {
    const duration = (Date.now() - startTime) / 1000;
    const route = getRoutePattern(req);
    const method = req.method;
    const statusCode = res.statusCode.toString();
    
    metricsService.recordHttpRequest(method, route, statusCode, duration);
    
    if (res.statusCode >= 400) {
      const endpoint = `${method} ${route}`;
      const errorType = res.statusCode >= 500 ? 'server_error' : 'client_error';
      metricsService.recordApiError(endpoint, errorType, statusCode);
    }
  }

  next();
}

//fucking hell
const ROUTE_PATTERNS = [
  { regex: /^\/api\/auth\/[^\/]+$/, pattern: '/api/auth/:action' },
  { regex: /^\/api\/auth\/.*/, pattern: '/api/auth/other' },
  { regex: /^\/api\/chats\/[^\/]+$/, pattern: '/api/chats/:id' },
  { regex: /^\/api\/chats\/[^\/]+\/messages$/, pattern: '/api/chats/:id/messages' },
  { regex: /^\/api\/chats\/[^\/]+\/.*/, pattern: '/api/chats/:id/other' },
  { regex: /^\/api\/pages\/[^\/]+$/, pattern: '/api/pages/:id' },
  { regex: /^\/api\/pages\/[^\/]+\/.*/, pattern: '/api/pages/:id/other' },
  { regex: /^\/api\/page-summaries\/[^\/]+$/, pattern: '/api/page-summaries/:id' },
  { regex: /^\/api\/notes\/[^\/]+$/, pattern: '/api/notes/:id' },
  { regex: /^\/api\/feedback\/[^\/]+$/, pattern: '/api/feedback/:id' },
  { regex: /^\/api\/query$/, pattern: '/api/query' },
  { regex: /^\/api\/anon\/.*/, pattern: '/api/anon/other' },
  { regex: /^\/api\/test\/.*/, pattern: '/api/test/other' },
  { regex: /^\/status\/.*/, pattern: '/status/other' },
  { regex: /^\/api\/health$/, pattern: '/api/health' },
  { regex: /^\/metrics$/, pattern: '/metrics' },
  { regex: /^\/api-docs\/.*/, pattern: '/api-docs/other' },
];

const MAX_ROUTE_PATTERNS = 100;
const routePatternCache = new Map();

function getRoutePattern(req) {
  try {
    if (req.route && req.route.path) {
      const baseUrl = req.baseUrl || '';
      return normalizeRoute(baseUrl + req.route.path);
    }
    
    const path = req.path || req.url || '/';
    const cacheKey = path;
    
    if (routePatternCache.has(cacheKey)) {
      return routePatternCache.get(cacheKey);
    }
    
    let matchedPattern = null;
    
    for (const { regex, pattern } of ROUTE_PATTERNS) {
      if (regex.test(path)) {
        matchedPattern = pattern;
        break;
      }
    }
    
    if (!matchedPattern) {
      matchedPattern = categorizeUnknownRoute(path);
    }
    
    if (routePatternCache.size < MAX_ROUTE_PATTERNS) {
      routePatternCache.set(cacheKey, matchedPattern);
    }
    
    return matchedPattern;
  } catch (error) {
    console.error('Error in getRoutePattern:', error);
    return '/unknown';
  }
}

function normalizeRoute(route) {
  return route
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function categorizeUnknownRoute(path) {
  if (path.startsWith('/api/')) {
    return '/api/other';
  }
  if (path.startsWith('/static/') || path.startsWith('/assets/')) {
    return '/static/other';
  }
  if (path.includes('.')) {
    return '/file/other';
  }
  return '/other';
}

module.exports = { metricsMiddleware };