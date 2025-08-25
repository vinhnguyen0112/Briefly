const promClient = require('prom-client');
const metricsConfig = require('../config/metrics');
const ConfigValidator = require('../utils/configValidator');

class MetricsService {
  constructor() {
    this.enabled = metricsConfig.enabled;
    this.isInitialized = false;
    this.initializationError = null;
    this.lastCleanup = Date.now();
    this.memoryStats = { heapUsed: 0, heapTotal: 0 };
    this.configValidation = null;
    
    try {
      this._validateConfiguration();
      
      if (this.enabled) {
        this.register = new promClient.Registry();
        this._initializeMetrics();
        this._setupMemoryManagement();
        this.isInitialized = true;
        console.log('✅ Metrics service initialized successfully');
      } else {
        console.log('⚠️ Metrics service disabled by configuration');
      }
    } catch (error) {
      this.initializationError = error;
      console.error('❌ Failed to initialize metrics service:', error);
      this.enabled = false;
    }
  }

  _validateConfiguration() {
    this.configValidation = ConfigValidator.validate();
    
    if (!this.configValidation.isValid) {
      const errorMessage = 'Metrics configuration validation failed:\n' + 
        this.configValidation.errors.join('\n');
      throw new Error(errorMessage);
    }
    
    if (this.configValidation.warnings.length > 0) {
      console.warn('⚠️ Metrics configuration warnings:');
      this.configValidation.warnings.forEach(warning => {
        console.warn('  -', warning);
      });
    }
  }

  _initializeMetrics() {
    if (metricsConfig.collectDefaultMetrics.enabled) {
      promClient.collectDefaultMetrics({
        register: this.register,
        timeout: metricsConfig.collectDefaultMetrics.timeout,
        gcDurationBuckets: metricsConfig.collectDefaultMetrics.gcDurationBuckets,
      });
    }

    this.httpRequestDuration = new promClient.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });

    this.httpRequestsTotal = new promClient.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.dbQueryDuration = new promClient.Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'status'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    this.dbConnectionsActive = new promClient.Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      registers: [this.register]
    });

    this.redisOperationDuration = new promClient.Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Duration of Redis operations in seconds',
      labelNames: ['operation', 'status'],
      buckets: [0.001, 0.01, 0.1, 0.5, 1],
      registers: [this.register]
    });

    this.apiErrorsTotal = new promClient.Counter({
      name: 'api_errors_total',
      help: 'Total number of API errors',
      labelNames: ['endpoint', 'error_type', 'status_code'],
      registers: [this.register]
    });

    this.businessMetricsTotal = new promClient.Counter({
      name: 'business_operations_total',
      help: 'Total number of business operations',
      labelNames: ['operation', 'status'],
      registers: [this.register]
    });

    this.activeUsersGauge = new promClient.Gauge({
      name: 'active_users_current',
      help: 'Current number of active users',
      registers: [this.register]
    });

    this.openaiRequestDuration = new promClient.Histogram({
      name: 'openai_request_duration_seconds',
      help: 'Duration of OpenAI API requests in seconds',
      labelNames: ['model', 'operation', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 20, 30],
      registers: [this.register]
    });

    this.ragOperationDuration = new promClient.Histogram({
      name: 'rag_operation_duration_seconds',
      help: 'Duration of RAG operations in seconds',
      labelNames: ['operation', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register]
    });
  }

  _safeExecute(operation, fallback = () => {}) {
    if (!this.enabled || !this.isInitialized) {
      return fallback();
    }
    
    try {
      return operation();
    } catch (error) {
      console.error('Metrics operation failed:', error);
      return fallback();
    }
  }

  recordHttpRequest(method, route, statusCode, duration) {
    this._safeExecute(() => {
      this.httpRequestDuration
        .labels(method, route, statusCode)
        .observe(duration);
      
      this.httpRequestsTotal
        .labels(method, route, statusCode)
        .inc();
    });
  }

  recordDbQuery(operation, table, status, duration) {
    this._safeExecute(() => {
      this.dbQueryDuration
        .labels(operation, table, status)
        .observe(duration);
    });
  }

  setActiveDbConnections(count) {
    this._safeExecute(() => {
      this.dbConnectionsActive.set(count);
    });
  }

  recordRedisOperation(operation, status, duration) {
    this._safeExecute(() => {
      this.redisOperationDuration
        .labels(operation, status)
        .observe(duration);
    });
  }

  recordApiError(endpoint, errorType, statusCode) {
    this._safeExecute(() => {
      this.apiErrorsTotal
        .labels(endpoint, errorType, statusCode)
        .inc();
    });
  }

  recordBusinessOperation(operation, status = 'success') {
    this._safeExecute(() => {
      this.businessMetricsTotal
        .labels(operation, status)
        .inc();
    });
  }

  setActiveUsers(count) {
    this._safeExecute(() => {
      this.activeUsersGauge.set(count);
    });
  }

  recordOpenAIRequest(model, operation, status, duration) {
    this._safeExecute(() => {
      this.openaiRequestDuration
        .labels(model, operation, status)
        .observe(duration);
    });
  }

  recordRagOperation(operation, status, duration) {
    this._safeExecute(() => {
      this.ragOperationDuration
        .labels(operation, status)
        .observe(duration);
    });
  }

  getMetrics() {
    return this._safeExecute(
      () => this.register.metrics(),
      () => '# Metrics service unavailable\n'
    );
  }

  getRegister() {
    return this._safeExecute(
      () => this.register,
      () => null
    );
  }

  getHealthStatus() {
    return {
      enabled: this.enabled,
      initialized: this.isInitialized,
      error: this.initializationError?.message || null,
      metricsCount: this._safeExecute(
        () => Object.keys(this.register._metrics).length,
        () => 0
      )
    };
  }

  _setupMemoryManagement() {
    if (!metricsConfig.memoryManagement.enabled) return;
    
    this.cleanupInterval = setInterval(() => {
      this._performCleanup();
    }, metricsConfig.memoryManagement.cleanupIntervalMs);
    
    process.on('exit', () => {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
    });
  }

  _performCleanup() {
    try {
      const memUsage = process.memoryUsage();
      this.memoryStats = {
        heapUsed: memUsage.heapUsed / 1024 / 1024, // MB
        heapTotal: memUsage.heapTotal / 1024 / 1024 // MB
      };
      
      const maxMemoryMB = metricsConfig.memoryManagement.maxMetricsMemoryMB;
      
      if (this.memoryStats.heapUsed > maxMemoryMB) {
        console.warn(`Metrics memory usage (${this.memoryStats.heapUsed.toFixed(2)}MB) exceeds limit (${maxMemoryMB}MB)`);
        
        if (global.gc) {
          global.gc();
        }
      }
      
      this.lastCleanup = Date.now();
      
    } catch (error) {
      console.error('Error during metrics cleanup:', error);
    }
  }

  getMemoryStats() {
    return {
      ...this.memoryStats,
      lastCleanup: this.lastCleanup,
      metricsCount: this._safeExecute(
        () => Object.keys(this.register._metrics).length,
        () => 0
      )
    };
  }

  reset() {
    if (this.enabled && this.isInitialized) {
      this._safeExecute(() => {
        this.register.clear();
        this._initializeMetrics();
      });
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.enabled = false;
    this.isInitialized = false;
  }
}

module.exports = new MetricsService();