const { LLMProvider } = require('./base');
const axios = require('axios');

class GroqProvider extends LLMProvider {
  constructor(config = {}) {
    super({
      name: 'Groq',
      apiKey: config.apiKey || process.env.GROQ_API_KEY,
      primaryModel: config.primaryModel || process.env.GROQ_PRIMARY_MODEL || 'llama3-70b-8192'
    });
    this.baseURL = 'https://api.groq.com/openai/v1/chat/completions';
  }

  async generateText(prompt, options = {}) {
    if (!this.isConfigured) throw new Error('Groq provider is not configured.');
    
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
          timeout: options.timeout || 10000 // default 10s timeout
        }
      );
      
      this._recordSuccess();
      return {
        text: response.data.choices[0].message.content,
        provider: this.providerName,
        model: response.data.model,
        usage: response.data.usage // { prompt_tokens, completion_tokens, total_tokens }
      };
    } catch (error) {
      this._recordFailure(error);
      throw error;
    }
  }

  async generateStructured(prompt, schema, options = {}) {
    // Groq supports JSON mode for some models, but we'll instruct it to output JSON in the prompt
    // and rely on Zod validation in the Gateway/Task later.
    const structuredPrompt = `${prompt}\n\nPlease respond ONLY with valid JSON matching this structure. Do not include markdown code blocks.\nSchema: ${JSON.stringify(schema, null, 2)}`;
    
    try {
      const response = await this.generateText(structuredPrompt, { ...options, response_format: { type: "json_object" } });
      let parsed;
      try {
        let cleanText = response.text.trim();
        if (cleanText.startsWith('\`\`\`json')) {
          cleanText = cleanText.substring(7, cleanText.length - 3).trim();
        } else if (cleanText.startsWith('\`\`\`')) {
          cleanText = cleanText.substring(3, cleanText.length - 3).trim();
        }
        parsed = JSON.parse(cleanText);
      } catch (e) {
        throw new Error('Failed to parse JSON from Groq response');
      }
      return {
        data: parsed,
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

module.exports = { GroqProvider };
