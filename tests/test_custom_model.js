import { StorageService } from '../app/js/services/storage.js';
import { LLMService } from '../app/js/services/llm.js';

async function runCustomModelTests() {
  console.log('=== Running Custom Model Sanitization & Configuration Tests ===');

  // 1. Test model name sanitization helper
  const testCases = [
    { input: 'Gemini 3.5 Flash Lite', expected: 'gemini-3.5-flash-lite' },
    { input: 'models/gemini-2.5-flash-lite', expected: 'gemini-2.5-flash-lite' },
    { input: 'models:gemini-3.1-flash-lite', expected: 'gemini-3.1-flash-lite' },
    { input: '  Gemini 2.5 Flash  ', expected: 'gemini-2.5-flash' },
    { input: 'gemini-3.1-pro-preview', expected: 'gemini-3.1-pro-preview' },
    { input: 'gemini-2.5-pro', expected: 'gemini-3.1-pro-preview' }
  ];

  for (const tc of testCases) {
    const result = LLMService._sanitizeGeminiModel(tc.input);
    if (result !== tc.expected) {
      throw new Error(`Sanitization failed for "${tc.input}": expected "${tc.expected}", got "${result}"`);
    }
    console.log(`✔ Sanitized: "${tc.input}" -> "${result}"`);
  }

  // 2. Test saving custom Gemini model
  const customSettings = {
    provider: 'gemini',
    geminiKey: 'AIzaSy_test_custom',
    geminiModel: LLMService._sanitizeGeminiModel('Gemini 2.5 Flash Lite'),
    profile: { level: 'Senior' }
  };
  await StorageService.saveSettings(customSettings);

  const saved = await StorageService.getSettings();
  if (saved.geminiModel !== 'gemini-2.5-flash-lite') {
    throw new Error(`Expected 'gemini-2.5-flash-lite', got ${saved.geminiModel}`);
  }
  console.log(`✔ Custom Gemini Model saved & loaded: ${saved.geminiModel}`);

  // 3. Test saving custom OpenAI model
  const customOpenAISettings = {
    provider: 'openai',
    openaiKey: 'sk-proj-test_custom',
    openaiModel: 'gpt-4.5-preview',
    profile: { level: 'Staff' }
  };
  await StorageService.saveSettings(customOpenAISettings);

  const savedOpenAI = await StorageService.getSettings();
  if (savedOpenAI.openaiModel !== 'gpt-4.5-preview') {
    throw new Error(`Expected 'gpt-4.5-preview', got ${savedOpenAI.openaiModel}`);
  }
  console.log(`✔ Custom OpenAI Model saved & loaded: ${savedOpenAI.openaiModel}`);

  console.log('\nAll Custom Model sanitization & configuration checks PASSED successfully!');
}

runCustomModelTests();
