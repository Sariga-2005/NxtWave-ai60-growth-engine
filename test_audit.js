require('dotenv').config();
const { aiGateway } = require('./ai');

console.log('--- AUDIT CHECK ---');
console.log('1. PORT:', process.env.PORT || 'not set');
console.log('2. NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('3. LLM_DEMO_MODE:', process.env.LLM_DEMO_MODE);
console.log('4. LLM_PRIMARY_PROVIDER:', process.env.LLM_PRIMARY_PROVIDER);

console.log('\n--- AI PROVIDER CONFIGURED STATUS (BOOLEAN ONLY) ---');
for (const [name, provider] of aiGateway.providers.entries()) {
  console.log(`- ${name}: isConfigured = ${provider.isConfigured}, model = ${provider.primaryModel}, status = ${provider.status}`);
}

const chatRoute = aiGateway.router.getRoute('workshop_chat');
console.log('\n- Router workshop_chat chain:', chatRoute);

const copilotRoute = aiGateway.router.getRoute('growth_copilot');
console.log('- Router growth_copilot chain:', copilotRoute);
