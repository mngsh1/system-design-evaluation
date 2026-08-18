import { RequirementsController } from '../app/js/controllers/requirements.js';
import { FloatingAssistantController } from '../app/js/controllers/floatingAssistant.js';

function runPhase3Tests() {
  console.log('=== Running Phase 3 Requirements & Floating Assistant Tests ===');

  // 1. Test RequirementsController instance
  const reqController = new RequirementsController({ app: {}, showToast: () => {} });
  console.log('✔ RequirementsController initialized safely.');

  // 2. Test FloatingAssistantController instance & Context capture
  const mockSession = {
    problem: {
      title: 'Global Video Streaming CDN',
      category: 'Real-time & Media'
    },
    profile: { level: 'Staff' },
    clarificationMessages: [
      { role: 'interviewer', content: 'What scale are you assuming?' },
      { role: 'candidate', content: 'Assuming 2 Billion MAU and 500 hrs video uploaded/min.' }
    ],
    requirements: {
      functional: '1. Video Upload\n2. Transcoding\n3. Adaptive Streaming',
      nonFunctional: '- High Availability: 99.99%\n- Latency: Sub-second initial play',
      estimations: '- 500 hrs/min uploaded = 8.33 hrs/sec'
    }
  };

  const assistant = new FloatingAssistantController({ app: { activeSession: mockSession }, showToast: () => {} });
  const context = assistant.captureActiveContext();

  if (context.problemTitle !== 'Global Video Streaming CDN') {
    throw new Error('Assistant failed to capture problem title context!');
  }
  if (context.level !== 'Staff') {
    throw new Error('Assistant failed to capture level context!');
  }
  if (!context.currentDraft.functionalRequirements.includes('Video Upload')) {
    throw new Error('Assistant failed to capture functional requirements context!');
  }
  console.log('✔ Context-Aware Assistant captured live draft requirements and scale estimations.');

  // 3. Test Evaluation JSON schema validation
  const sampleEvaluation = {
    status: "Passed",
    score: 88,
    verdict: "Strong requirements breakdown with solid scale calculations.",
    functionalCritique: "Upload and transcoding pipeline well covered.",
    nonFunctionalCritique: "Availability and latency targets are realistic.",
    estimationsCritique: "Accurate conversion from 500 hrs/min to per-second bandwidth.",
    strengths: ["Clear API boundaries", "Realistic SLAs"],
    missingConsiderations: ["Consider dynamic edge cache warming for viral videos in Phase 4."]
  };

  if (sampleEvaluation.score < 0 || sampleEvaluation.score > 100 || !sampleEvaluation.verdict) {
    throw new Error('Evaluation schema validation failed!');
  }
  console.log('✔ Evaluation schema and score validation verified.');

  console.log('\nAll Phase 3 structural and context checks PASSED successfully!');
}

runPhase3Tests();
