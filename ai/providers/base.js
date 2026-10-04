class LLMProvider {
  constructor(config = {}) {
    this.providerName = config.name || 'unknown';
    this.isConfigured = !!config.apiKey;
    this.primaryModel = config.primaryModel;
    this.apiKey = config.apiKey;
    
    // Health tracking
    this.status = this.isConfigured ? 'HEALTHY' : 'NOT_CONFIGURED';
    this.lastSuccessfulRequest = null;
    this.lastFailure = null;
    this.failureCount = 0;
  }

  async generateText(prompt, options = {}) {
    throw new Error('generateText() must be implemented by the provider adapter.');
  }

  async generateStructured(prompt, schema, options = {}) {
    throw new Error('generateStructured() must be implemented by the provider adapter.');
  }

  async healthCheck() {
    if (!this.isConfigured) return { status: 'NOT_CONFIGURED', provider: this.providerName };
    try {
      const isHealthy = await this._ping();
      if (isHealthy) {
        this.status = 'HEALTHY';
        this.failureCount = 0;
        return { status: 'HEALTHY', provider: this.providerName };
      }
    } catch (error) {
      this.status = 'UNAVAILABLE';
      this.lastFailure = new Date();
      this.failureCount++;
      return { status: 'UNAVAILABLE', provider: this.providerName, error: error.message };
    }
  }

  async _ping() {
    throw new Error('_ping() must be implemented by the provider adapter.');
  }

  getUsage() {
    return { /* usage tracking implementation */ };
  }

  getModelInfo() {
    return {
      provider: this.providerName,
      model: this.primaryModel,
      isConfigured: this.isConfigured,
      status: this.status
    };
  }

  _recordSuccess() {
    this.lastSuccessfulRequest = new Date();
    this.status = 'HEALTHY';
    this.failureCount = 0;
  }

  _recordFailure(error) {
    this.lastFailure = new Date();
    this.failureCount++;
    if (this.failureCount > 3) {
      this.status = 'DEGRADED';
    }
  }
}

module.exports = { LLMProvider };
