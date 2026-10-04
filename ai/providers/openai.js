const { LLMProvider } = require('./base');
const axios = require('axios');

class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'OpenAI',
      apiKey: config.apiKey || process.env.OPENAI_API_KEY,
      primaryModel: config.primaryModel || process.env.OPENAI_PRIMARY_MODEL || 'gpt-4o'
    });
    this.baseURL = 'https://api.openai.com/v1/chat/completions';
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured) throw new Error('OpenAI provider is not configured.');
    
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: options.model || this.primaryModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: options.temperature ?? 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || 15000
        }
      );
      
      this._recordSuccess();
      return {
        text: response.data.choices[0].message.content,
        provider: this.providerName,
        model: response.data.model,
        usage: response.data.usage
      };
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
  }

  async generateStructured(prompt, schema, options = {}) {
    const structuredPrompt = `${prompt}\n\nPlease respond ONLY with valid JSON matching this schema: ${JSON.stringify(schema, null, 2)}`;
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: options.model || this.primaryModel,
          messages: [{ role: 'user', content: structuredPrompt }],
          temperature: options.temperature ?? 0.2,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || 15000
        }
      );
      
      this._recordSuccess();
      const content = response.data.choices[0].message.content;
      return {
        data: JSON.parse(content),
        provider: this.providerName,
        model: response.data.model,
        usage: response.data.usage
      };
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
  }

  async _ping() {
    try {
      await this.generateText('Hello', { max_tokens: 5, timeout: 5000 });
      return true;
    } catch (e) {
      return false;
    }
  }
}

module.exports = { OpenAIProvider };
