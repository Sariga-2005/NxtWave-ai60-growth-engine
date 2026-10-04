const DEFAULT_ROUTING = {
  'workshop_chat': ['Groq', 'OpenAI', 'Gemini'],
  'faq': ['Groq', 'Gemini', 'OpenAI'],
  'summarization': ['Gemini', 'OpenAI', 'Anthropic', 'Groq'],
  'project_ideas': ['OpenAI', 'Gemini', 'Groq', 'Anthropic'],
  'project_evaluation': ['Anthropic', 'OpenAI', 'Gemini', 'Groq'],
  'growth_analysis': ['OpenAI', 'Anthropic', 'Gemini', 'Groq'],
  'message_generation': ['Groq', 'Gemini', 'OpenAI']
};

class ModelRouter {
  constructor(config = {}) {
    this.routingTable = config.routingTable || DEFAULT_ROUTING;
  }

  getRoute(task) {
    const chain = this.routingTable[task];
    if (!chain || chain.length === 0) {
      // Default generic fallback
      return ['OpenAI', 'Gemini', 'Anthropic', 'Groq'];
    }
    return chain;
  }
}

module.exports = { ModelRouter };
