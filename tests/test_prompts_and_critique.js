import assert from 'node:assert';
import { PromptRegistry } from '../app/js/services/prompts.js';
import { StorageService } from '../app/js/services/storage.js';

console.log('=== Running PromptRegistry & Critique Rigor Tests ===\n');

// 1. Verify Critique Strictness Instructions
const constructiveInst = await PromptRegistry.getCritiqueInstruction('constructive');
const standardInst = await PromptRegistry.getCritiqueInstruction('standard');
const hardcoreInst = await PromptRegistry.getCritiqueInstruction('hardcore');

assert(constructiveInst.includes('CONSTRUCTIVE & ENCOURAGING'), 'Constructive rigor missing');
assert(standardInst.includes('STANDARD FAANG CALIBRATION'), 'Standard rigor missing');
assert(hardcoreInst.includes('MAXIMUM / HARDCORE PRINCIPAL BAR'), 'Hardcore rigor missing');
console.log('✔ All 3 critique instruction levels loaded and parsed from critique_instructions.md.');

// 2. Test Requirements Evaluation Prompt with Critique Variations
const sampleProblem = {
  title: 'Global Ride-Hailing Match & Real-Time Dispatch System',
  scaleMetrics: { dau: '50M', qps: '1.2M updates/sec' }
};

const reqPromptHardcore = await PromptRegistry.getRequirementsEvaluationPrompt({
  problem: sampleProblem,
  level: 'Principal',
  critiqueLevel: 'hardcore'
});

assert(reqPromptHardcore.includes('HARDCORE PRINCIPAL BAR'), 'Hardcore prompt missing critique modifier');
assert(reqPromptHardcore.includes('Global Ride-Hailing Match'), 'Problem title missing from requirements prompt');
console.log('✔ Requirements prompt dynamically loaded from phase2_requirements_eval.md.');

// 3. Test HLD Evaluation Prompt
const hldPrompt = await PromptRegistry.getHLDEvaluationPrompt({
  problem: sampleProblem,
  level: 'Staff',
  critiqueLevel: 'standard'
});
assert(hldPrompt.includes('STANDARD FAANG CALIBRATION'), 'Standard modifier missing');
assert(hldPrompt.includes('spofAndBottlenecks'), 'HLD prompt schema missing spofAndBottlenecks');
console.log('✔ HLD evaluation prompt loaded from phase3_hld_vision_eval.md.');

// 4. Test Deep Dive Question Generation & Evaluation Prompts
const ddQPrompt = await PromptRegistry.getDeepDiveQuestionGenPrompt({
  problem: sampleProblem,
  level: 'Senior',
  canvasShapes: 'API Gateway, Redis, Postgres',
  bottlenecks: ['DB write saturation']
});
assert(ddQPrompt.includes('generate EXACTLY 3 challenging'), 'Deep dive Q gen missing constraint');

const ddEvalPrompt = await PromptRegistry.getDeepDiveEvaluationPrompt({
  problem: sampleProblem,
  level: 'Senior',
  critiqueLevel: 'constructive'
});
assert(ddEvalPrompt.includes('CONSTRUCTIVE & ENCOURAGING'), 'Deep dive eval missing constructive modifier');
console.log('✔ Deep Dive prompts loaded from phase4_deepdive_generation.md & phase4_deepdive_eval.md.');

// 5. Test Gold Standard & Assistant Prompts
const goldPrompt = await PromptRegistry.getGoldStandardPrompt({ problem: sampleProblem, level: 'Staff' });
assert(goldPrompt.includes('idealArchitectureKeyPoints'), 'Gold standard prompt missing schema keys');

const assistantPrompt = await PromptRegistry.getAssistantPrompt({ problem: sampleProblem, level: 'Senior', phase: 3 });
assert(assistantPrompt.includes('Socratic mentor'), 'Assistant prompt missing role instruction');
console.log('✔ Gold Standard & Assistant prompts loaded from phase5_gold_standard.md & assistant_copilot.md.');

// 6. Test Settings Critique Level Storage
await StorageService.saveSettings({
  provider: 'gemini',
  geminiModel: 'gemini-3.1-pro-preview',
  critiqueLevel: 'hardcore',
  profile: { level: 'Staff' }
});

const loadedSettings = await StorageService.getSettings();
assert.strictEqual(loadedSettings.critiqueLevel, 'hardcore', 'Saved critique level mismatch');
console.log('✔ StorageService successfully saves & loads critiqueLevel.');

console.log('\nAll Prompt Registry & Critique Strictness tests PASSED successfully!');
