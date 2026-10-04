const { LLMProvider } = require('./base');
const axios = require('axios');

class GeminiProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'Gemini',
      apiKey: config.apiKey || process.env.GEMINI_API_KEY,
      primaryModel: config.primaryModel || process.env.GEMINI_PRIMARY_MODEL || 'gemini-2.5-flash'
    });
    this.baseURL = `https://generativelanguage.googleapis.com/v1beta/models`;
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured) throw new Error('Gemini provider is not configured.');
    
    const model = options.model || this.primaryModel;
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
      const text = response.data.candidates[0].content.parts[0].text;
      return {
        text,
        provider: this.providerName,
        model: model,
        usage: response.data.usageMetadata
      };
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
  }

  async generateStructured(prompt, schema, options = {}) {
    const model = options.model || this.primaryModel;
    const url = `${this.baseURL}/${model}:generateContent?key=${this.apiKey}`;
    
    // Gemini API natively supports JSON schema validation via response_schema, but for simplicity
    // we can use standard system instructions or JSON mode
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
      const text = response.data.candidates[0].content.parts[0].text;
      return {
        data: JSON.parse(text),
        provider: this.providerName,
        model: model,
        usage: response.data.usageMetadata
      };
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
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
