const DEFAULT_ROUTING = {
  'workshop_chat': ['Groq', 'Gemini', 'OpenAI'],
  'faq': ['Groq', 'Gemini', 'OpenAI'],
  'summarization': ['Gemini', 'OpenAI', 'Anthropic', 'Groq'],
  'project_ideas': ['OpenAI', 'Gemini', 'Groq', 'Anthropic'],
  'project_evaluation': ['Anthropic', 'OpenAI', 'Gemini', 'Groq'],
  'growth_analysis': ['OpenAI', 'Gemini', 'Anthropic', 'Groq'],
  'growth_copilot': ['OpenAI', 'Gemini', 'Anthropic', 'Groq'],
  'message_generation': ['Groq', 'Gemini', 'OpenAI']
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
    let chain = this.routingTable[task] || ['OpenAI', 'Gemini', 'Anthropic', 'Groq'];
    
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

