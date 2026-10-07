const { LLMProvider } = require('./base');
const axios = require('axios');

class GeminiProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'Gemini',
      apiKey: config.apiKey || process.env.GEMINI_API_KEY,
      primaryModel: config.primaryModel || process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.5-flash-lite'
    });
    this.baseURL = `https://generativelanguage.googleapis.com/v1beta/models`;
    this.fallbackModels = ['gemini-2.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured) throw new Error('Gemini provider is not configured.');
    
    const candidateModels = options.model 
      ? [options.model] 
      : [this.primaryModel, ...this.fallbackModels.filter(m => m !== this.primaryModel)];
    
    let lastErr = null;
    for (const model of candidateModels) {
      const url = `${this.baseURL}/${model}:generateContent?key=${this.apiKey}`;
      try {
        const response = await axios.post(
          url,
          {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: options.temperature ?? 0.7,
            }
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: options.timeout || 15000
          }
        );
        
        this._recordSuccess();
        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          text,
          provider: this.providerName,
          model: model,
          usage: response.data.usageMetadata
        };
      } catch (error) {
        lastErr = error;
        continue;
      }
    }
    this._recordFailure(lastErr);
    throw lastErr;
  }

  async generateStructured(prompt, schema, options = {}) {
    if (!this.isConfigured) throw new Error('Gemini provider is not configured.');
    
    const candidateModels = options.model 
      ? [options.model] 
      : [this.primaryModel, ...this.fallbackModels.filter(m => m !== this.primaryModel)];
    
    let lastErr = null;
    for (const model of candidateModels) {
      const url = `${this.baseURL}/${model}:generateContent?key=${this.apiKey}`;
      try {
        const response = await axios.post(
          url,
          {
            contents: [{ parts: [{ text: `${prompt}\n\nReturn JSON conforming to this schema: ${JSON.stringify(schema, null, 2)}` }] }],
            generationConfig: {
              temperature: options.temperature ?? 0.2,
              responseMimeType: "application/json"
            }
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: options.timeout || 15000
          }
        );
        
        this._recordSuccess();
        const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) {
          cleanText = cleanText.substring(7, cleanText.length - 3).trim();
        } else if (cleanText.startsWith('```')) {
          cleanText = cleanText.substring(3, cleanText.length - 3).trim();
        }
        return {
          data: JSON.parse(cleanText),
          provider: this.providerName,
          model: model,
          usage: response.data.usageMetadata
        };
      } catch (error) {
        lastErr = error;
        continue;
      }
    }
    this._recordFailure(lastErr);
    throw lastErr;
  }

  async _ping() {
    try {
      await this.generateText('Hello', { timeout: 5000 });
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = { GeminiProvider };
