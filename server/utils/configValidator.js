class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validateMetricsConfig() {
    this._reset();
    
    this._validateEnvironmentVariables();
    this._validateNumericConfig();
    this._validateAuthConfig();
    this._validateMemoryConfig();
    
    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  _reset() {
    this.errors = [];
    this.warnings = [];
  }

  _validateEnvironmentVariables() {
    const requiredEnvVars = [];
    const optionalEnvVars = [
      'METRICS_ENABLED',
      'METRICS_PROTECTED',
      'METRICS_AUTH_TOKEN',
      'METRICS_MAX_CACHE_SIZE',
      'METRICS_CLEANUP_INTERVAL_MS',
      'METRICS_MAX_MEMORY_MB'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        this.errors.push(`Required environment variable ${envVar} is not set`);
      }
    }

    if (process.env.METRICS_ENABLED && !['true', 'false'].includes(process.env.METRICS_ENABLED)) {
      this.warnings.push('METRICS_ENABLED should be "true" or "false"');
    }

    if (process.env.METRICS_PROTECTED && !['true', 'false'].includes(process.env.METRICS_PROTECTED)) {
      this.warnings.push('METRICS_PROTECTED should be "true" or "false"');
    }
  }

  _validateNumericConfig() {
    const numericVars = [
      { name: 'METRICS_MAX_CACHE_SIZE', min: 10, max: 10000 },
      { name: 'METRICS_CLEANUP_INTERVAL_MS', min: 1000, max: 3600000 }, // 1s to 1h
      { name: 'METRICS_MAX_MEMORY_MB', min: 1, max: 1000 }
    ];

    for (const { name, min, max } of numericVars) {
      const value = process.env[name];
      if (value !== undefined) {
        const numValue = parseInt(value);
        if (isNaN(numValue)) {
          this.errors.push(`${name} must be a valid number`);
        } else if (numValue < min || numValue > max) {
          this.warnings.push(`${name} should be between ${min} and ${max}`);
        }
      }
    }
  }

  _validateAuthConfig() {
    const isProtected = process.env.METRICS_PROTECTED === 'true';
    const hasToken = process.env.METRICS_AUTH_TOKEN && process.env.METRICS_AUTH_TOKEN.length > 0;

    if (isProtected && !hasToken) {
      this.errors.push('METRICS_AUTH_TOKEN is required when METRICS_PROTECTED is true');
    }

    if (hasToken && process.env.METRICS_AUTH_TOKEN.length < 16) {
      this.warnings.push('METRICS_AUTH_TOKEN should be at least 16 characters long for security');
    }
  }

  _validateMemoryConfig() {
    const maxMemory = parseInt(process.env.METRICS_MAX_MEMORY_MB) || 50;
    const cleanupInterval = parseInt(process.env.METRICS_CLEANUP_INTERVAL_MS) || 300000;

    if (maxMemory > 100) {
      this.warnings.push('METRICS_MAX_MEMORY_MB is quite high, consider monitoring memory usage carefully');
    }

    if (cleanupInterval < 60000) {
      this.warnings.push('METRICS_CLEANUP_INTERVAL_MS is very low, this may impact performance');
    }
  }

  static validate() {
    const validator = new ConfigValidator();
    return validator.validateMetricsConfig();
  }
}

module.exports = ConfigValidator;