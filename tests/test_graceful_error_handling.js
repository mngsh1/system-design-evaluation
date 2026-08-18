import assert from 'node:assert';
import { RequirementsController } from '../app/js/controllers/requirements.js';
import { HLDController } from '../app/js/controllers/hld.js';
import { DeepDiveController } from '../app/js/controllers/deepDive.js';
import { ScorecardController } from '../app/js/controllers/scorecard.js';

console.log('=== Running Graceful Error Handling & Outage Resilience Tests ===\n');

// 1. Requirements Controller Graceful Error Test
const mockReqApp = {
  activeSession: {
    problem: { title: 'High-Throughput Distributed Cache' },
    requirements: {}
  },
  settings: { provider: 'gemini', geminiKey: '' }, // Missing key triggers error
  pauseTimer: () => {},
  showToast: () => {}
};

const reqCtrl = new RequirementsController({ app: mockReqApp, showToast: () => {} });
// Mock DOM elements
let evalContentHtml = '';
reqCtrl.evalContent = {
  set innerHTML(val) { evalContentHtml = val; },
  get innerHTML() { return evalContentHtml; }
};
reqCtrl.evalReviewCard = { classList: { remove: () => {}, add: () => {} }, scrollIntoView: () => {} };
reqCtrl.inputFunctional = { value: 'Get/Set/Delete operations in memory', readOnly: true };
reqCtrl.inputNonFunctional = { value: '99.99% availability, p99 < 2ms', readOnly: true };
reqCtrl.inputEstimations = { value: '10M QPS, 50TB dataset', readOnly: true };

await reqCtrl.handleEvaluate();

assert(evalContentHtml.includes('eval-error-state'), 'Requirements evaluation error did not render eval-error-state');
assert(evalContentHtml.includes('Retry Evaluation'), 'Requirements error missing Retry button');
assert(evalContentHtml.includes('Check API Key / Model in Settings'), 'Requirements error missing Settings button');
assert.strictEqual(reqCtrl.inputFunctional.readOnly, false, 'Inputs were not unlocked for candidate editing upon error');
assert.strictEqual(mockReqApp.activeSession.requirements.evaluation, undefined, 'Fabricated evaluation was incorrectly saved on failure');
console.log('✔ RequirementsController handles LLM outages gracefully without fabricating fake passed scores.');

// 2. HLD Controller Graceful Error Test
const mockHldApp = {
  activeSession: {
    problem: { title: 'High-Throughput Distributed Cache' },
    hld: { apiAndSchema: 'Schema text...', canvasData: {} }
  },
  settings: { provider: 'openai', openaiKey: '' }, // Missing key triggers error
  pauseTimer: () => {},
  showToast: () => {}
};

const hldCtrl = new HLDController({ app: mockHldApp, showToast: () => {} });
let hldEvalHtml = '';
hldCtrl.evalContent = {
  set innerHTML(val) { hldEvalHtml = val; },
  get innerHTML() { return hldEvalHtml; }
};
hldCtrl.evalCard = { classList: { remove: () => {}, add: () => {} }, scrollIntoView: () => {} };
hldCtrl.btnSubmit = { disabled: true, innerHTML: '' };
hldCtrl.inputApiSchema = { value: 'POST /v1/cache/keys (idempotent)', readOnly: false };
hldCtrl.canvasEngine = { shapes: [{ type: 'service', text: 'Gateway' }], exportImageBase64: () => null, exportJSON: () => ({ shapes: [] }), setReadOnly: () => {} };

await hldCtrl.handleEvaluate();

assert(hldEvalHtml.includes('eval-error-state'), 'HLD evaluation error did not render eval-error-state');
assert(hldEvalHtml.includes('Retry Evaluation'), 'HLD error missing Retry button');
assert.strictEqual(hldCtrl.btnSubmit.disabled, false, 'HLD submit button was not re-enabled on failure');
assert.strictEqual(mockHldApp.activeSession.hld.evaluation, undefined, 'Fabricated HLD evaluation was incorrectly saved on failure');
console.log('✔ HLDController handles LLM outages gracefully without fabricating fake passed scores.');

// 3. Deep Dive Controller Question Gen Error Test
const mockDdApp = {
  activeSession: {
    problem: { title: 'High-Throughput Distributed Cache' },
    deepDives: { generatedQuestions: [] }
  },
  settings: { provider: 'gemini', geminiKey: '' },
  showToast: () => {}
};

const ddCtrl = new DeepDiveController({ app: mockDdApp, showToast: () => {} });
let ddQuestionsHtml = '';
ddCtrl.questionsContainer = {
  classList: { remove: () => {}, add: () => {} },
  set innerHTML(val) { ddQuestionsHtml = val; },
  get innerHTML() { return ddQuestionsHtml; }
};
ddCtrl.loadingState = { classList: { remove: () => {}, add: () => {} } };

await ddCtrl.generateQuestions();

assert(ddQuestionsHtml.includes('Failed to Generate Tailored Deep Dives'), 'Deep dive missing question gen error card');
assert(ddQuestionsHtml.includes('Retry Generating Questions'), 'Deep dive missing Retry Q Gen button');
assert(ddQuestionsHtml.includes('Use Standard Topic Challenges'), 'Deep dive missing fallback option');
console.log('✔ DeepDiveController handles question generation failure gracefully.');

// 4. Scorecard Controller Custom Gold Standard Error Test
const mockScApp = {
  activeSession: {
    problem: { title: 'High-Throughput Distributed Cache' },
    evaluation: {}
  },
  settings: { provider: 'openai', openaiKey: '' },
  showToast: () => {}
};

const scCtrl = new ScorecardController({ app: mockScApp, showToast: () => {} });
let goldContentHtml = '';
global.document = {
  getElementById: (id) => {
    if (id === 'gold-standard-content') {
      return {
        set innerHTML(val) { goldContentHtml = val; },
        get innerHTML() { return goldContentHtml; }
      };
    }
    return null;
  }
};

await scCtrl.generateGoldStandardSolution(); // called without arguments like the Retry button click

assert(goldContentHtml.includes('Custom Blueprint Generation Unavailable'), 'Scorecard missing gold standard error state');
assert(goldContentHtml.includes('Retry Custom Generation'), 'Scorecard missing retry custom button');
assert(goldContentHtml.includes('Show Curated Architecture Reference'), 'Scorecard missing curated reference button');

// Re-attempt retry without parameters to ensure no "Cannot read properties of undefined (reading 'problem')" error occurs
await scCtrl.generateGoldStandardSolution();
assert(goldContentHtml.includes('Custom Blueprint Generation Unavailable'), 'Retry should succeed without TypeError');
console.log('✔ ScorecardController handles parameterless Retry button clicks without TypeError.');

console.log('\nAll Graceful Error Handling & Outage Resilience tests PASSED successfully!');
