import assert from 'node:assert';
import { TemplateLoader } from '../app/js/services/templateLoader.js';

console.log('=== Running Modular Views & TemplateLoader Tests ===\n');

const views = [
  'stage-discovery.html',
  'stage-problem-scope.html',
  'stage-requirements.html',
  'stage-architecture.html',
  'stage-deepdive.html',
  'stage-scorecard.html',
  'modals.html',
  'floating-tools.html'
];

for (const view of views) {
  const content = await TemplateLoader.loadView(view);
  assert(content && content.length > 50, `View ${view} failed to load or is too small`);
  console.log(`✔ Modular view loaded successfully: app/views/${view} (${content.length} bytes)`);
}

// Check critical element IDs across views
const discovery = await TemplateLoader.loadView('stage-discovery.html');
assert(discovery.includes('id="problem-cards-grid"'), 'Discovery missing problem-cards-grid');

const problemScope = await TemplateLoader.loadView('stage-problem-scope.html');
assert(problemScope.includes('id="clarify-chat-messages"'), 'Problem scope missing clarify-chat-messages');

const requirements = await TemplateLoader.loadView('stage-requirements.html');
assert(requirements.includes('id="req-functional-input"'), 'Requirements missing req-functional-input');

const architecture = await TemplateLoader.loadView('stage-architecture.html');
assert(architecture.includes('id="hld-drawing-canvas"'), 'Architecture missing canvas');

const deepdive = await TemplateLoader.loadView('stage-deepdive.html');
assert(deepdive.includes('id="deepdive-questions-container"'), 'Deepdive missing questions container');

const scorecard = await TemplateLoader.loadView('stage-scorecard.html');
assert(scorecard.includes('id="scorecard-content"'), 'Scorecard missing scorecard-content');

const modals = await TemplateLoader.loadView('modals.html');
assert(modals.includes('id="settings-modal"') && modals.includes('id="custom-problem-modal"'), 'Modals missing critical dialogs');

const tools = await TemplateLoader.loadView('floating-tools.html');
assert(tools.includes('id="floating-assistant-widget"') && tools.includes('id="btn-toggle-clarify-drawer"'), 'Tools missing assistant/drawer');

console.log('\nAll Modular Views & TemplateLoader tests PASSED successfully!');
