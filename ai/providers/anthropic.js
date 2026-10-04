const { LLMProvider } = require('./base');
const axios = require('axios');

class AnthropicProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'Anthropic',
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
      primaryModel: config.primaryModel || process.env.ANTHROPIC_PRIMARY_MODEL || 'claude-3-5-sonnet-20240620'
    });
    this.baseURL = 'https://api.anthropic.com/v1/messages';
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured) throw new Error('Anthropic provider is not configured.');
    
    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: options.model || this.primaryModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options.max_tokens || 4096,
          temperature: options.temperature ?? 0.7,
        },
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || 15000
        }
      );
      
      this._recordSuccess();
      return {
        text: response.data.content[0].text,
        provider: this.providerName,
        model: response.data.model,
        usage: response.data.usage // { input_tokens, output_tokens }
      };
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
  }

  async generateStructured(prompt, schema, options = {}) {
    const structuredPrompt = `${prompt}\n\nPlease respond ONLY with valid JSON matching this structure. Do not wrap it in markdown block. Schema: ${JSON.stringify(schema, null, 2)}`;
    
    try {
      const response = await this.generateText(structuredPrompt, { ...options, temperature: 0.2 });
      let text = response.text.trim();
      if (text.startsWith('\`\`\`json')) {
        text = text.substring(7, text.length - 3).trim();
      } else if (text.startsWith('\`\`\`')) {
        text = text.substring(3, text.length - 3).trim();
      }
      
      return {
        data: JSON.parse(text),
        provider: this.providerName,
        model: response.model,
        usage: response.usage
      };
    } catch (error) {
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

module.exports = { AnthropicProvider };
