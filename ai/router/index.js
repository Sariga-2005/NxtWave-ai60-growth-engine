const DEFAULT_ROUTING = {
  'workshop_chat': ['Gemini', 'Groq', 'OpenAI'],
  'faq': ['Gemini', 'Groq', 'OpenAI'],
  'summarization': ['Gemini', 'OpenAI', 'Anthropic', 'Groq'],
  'project_ideas': ['Gemini', 'OpenAI', 'Groq', 'Anthropic'],
  'project_evaluation': ['Gemini', 'Anthropic', 'OpenAI', 'Groq'],
  'growth_analysis': ['Gemini', 'OpenAI', 'Anthropic', 'Groq'],
  'growth_copilot': ['Gemini', 'OpenAI', 'Anthropic', 'Groq'],
  'message_generation': ['Gemini', 'Groq', 'OpenAI']
};

const PROVIDER_NAME_MAP = {
  'gemini': 'Gemini',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'groq': 'Groq'
};

class ModelRouter {
  constructor(config = {}) {
    this.routingTable = config.routingTable || DEFAULT_ROUTING;
  }

  getRoute(task) {
    let chain = this.routingTable[task] || ['Gemini', 'OpenAI', 'Anthropic', 'Groq'];
    
    // Check if user set a primary provider via LLM_PRIMARY_PROVIDER
    const primaryKey = (process.env.LLM_PRIMARY_PROVIDER || '').trim().toLowerCase();
    const primaryName = PROVIDER_NAME_MAP[primaryKey];
    
    if (primaryName) {
      // Prioritize primary provider at the start of the chain, maintaining the rest as fallback
      const filtered = chain.filter(p => p.toLowerCase() !== primaryName.toLowerCase());
      return [primaryName, ...filtered];
    }
    
    return chain;
  }
}

module.exports = { ModelRouter };
