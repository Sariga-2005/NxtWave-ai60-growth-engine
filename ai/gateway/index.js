const { OpenAIProvider, GeminiProvider, AnthropicProvider, GroqProvider } = require('../providers');
const { ModelRouter } = require('../router');
const fs = require('fs');
const path = require('path');

class AIGateway {
  constructor() {
    this.providers = new Map();
    this.router = new ModelRouter();
    this.isDemoMode = process.env.LLM_DEMO_MODE === 'true';
    
    // Instantiate providers
    const openai = new OpenAIProvider();
    const gemini = new GeminiProvider();
    const anthropic = new AnthropicProvider();
    const groq = new GroqProvider();

    this.providers.set('OpenAI', openai);
    this.providers.set('Gemini', gemini);
    this.providers.set('Anthropic', anthropic);
    this.providers.set('Groq', groq);

    // Ensure logs dir exists
    const logsDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    this.logFile = path.join(logsDir, 'ai_usage.log');
  }

  logUsage(entry) {
    try {
      const logEntry = {
        ...entry,
        created_at: new Date().toISOString()
      };
      fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    } catch (e) {
      console.error('Failed to log AI usage', e);
    }
  }

  async executeTask(task, prompt, options = {}) {
    if (this.isDemoMode) {
      return this._executeDemo(task, prompt, options);
    }

    const route = this.router.getRoute(task);
    const isStructured = !!options.schema;
    let lastError = null;

    for (const providerName of route) {
      const provider = this.providers.get(providerName);
      if (!provider || !provider.isConfigured || provider.status === 'UNAVAILABLE') {
        continue;
      }

      const startTime = Date.now();
      try {
        let result;
        if (isStructured) {
          result = await provider.generateStructured(prompt, options.schema, options);
        } else {
          result = await provider.generateText(prompt, options);
        }

        const latency = Date.now() - startTime;
        this.logUsage({
          task,
          provider: providerName,
          model: result.model,
          latency_ms: latency,
          status: 'SUCCESS',
          fallback_used: providerName !== route[0],
          usage: result.usage
        });

        return result;
      } catch (error) {
        console.error(`[AI Gateway Debug] ${providerName} failed:`, error.message);
        lastError = error;
        const latency = Date.now() - startTime;
        this.logUsage({
          task,
          provider: providerName,
          latency_ms: latency,
          status: 'FAILURE',
          error: error.message
        });
        // Continue to the next provider in the fallback chain
      }
    }

    // All providers failed, fallback to safe mode/demo mode if allowed
    return this._executeDemo(task, prompt, options, lastError);
  }

  _executeDemo(task, prompt, options, lastError = null) {
    // No real AI provider is available. Return placeholders that callers must treat as
    // "not available" (provider === 'DEMO'); no fabricated scores or ideas are produced.
    let text = 'AI is not configured right now.';
    let data = null;

    const response = {
      text,
      data: options.schema ? data : undefined,
      provider: 'DEMO',
      model: 'demo-local',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
    };

    if (lastError) {
      console.warn(`[AI Gateway] All providers failed for task ${task}. Using safe fallback. Last error: ${lastError.message}`);
      response.lastError = lastError.message;
    }

    return response;
  }

  getHealth() {
    const health = {};
    for (const [name, provider] of this.providers.entries()) {
      health[name] = provider.getModelInfo();
    }
    return health;
  }

  async getUsage() {
    try {
      if (!fs.existsSync(this.logFile)) return [];
      const lines = fs.readFileSync(this.logFile, 'utf8').trim().split('\n');
      return lines.map(l => JSON.parse(l)).reverse().slice(0, 100);
    } catch (e) {
      console.error('Failed to read AI usage log', e);
      return [];
    }
  }

  async simulateFailure(providerName) {
    const provider = this.providers.get(providerName || 'Groq');
    if (provider) {
      provider.status = 'UNAVAILABLE';
      setTimeout(() => { provider.status = 'HEALTHY'; }, 60000); // restore after 60s
    }
  }
}

// Singleton instance
const aiGateway = new AIGateway();

module.exports = { aiGateway, AIGateway };
