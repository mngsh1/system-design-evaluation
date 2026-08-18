import { ClarificationController } from '../app/js/controllers/clarification.js';

function runPhase2Tests() {
  console.log('=== Running Phase 2 Clarification & Timer Tests ===');

  // Test formatting helper
  const controller = new ClarificationController({ app: {}, showToast: () => {} });
  
  const sampleMarkdown = "We need **50M DAU** with `p99 < 50ms` latency:\n- Scale horizontally\n- Use Redis cache";
  const formatted = controller._formatMessageText(sampleMarkdown);

  if (!formatted.includes('<strong>50M DAU</strong>')) {
    throw new Error('Bold markdown formatting failed!');
  }
  if (!formatted.includes('<code>p99 &lt; 50ms</code>')) {
    throw new Error('Code tick formatting failed!');
  }
  if (!formatted.includes('<li>Scale horizontally</li>')) {
    throw new Error('Bullet list formatting failed!');
  }
  console.log('✔ Markdown message formatting and escaping verified.');

  // Test session state format
  const mockSession = {
    id: 'test_session_123',
    problem: {
      title: 'Global Payment Gateway',
      vaguePrompt: 'Design a payment gateway'
    },
    phase: 2,
    timers: {
      startedAt: null,
      isRunning: false,
      totalElapsedSeconds: 0,
      phaseElapsed: { phase_2: 0 }
    },
    clarificationMessages: []
  };

  controller.app.activeSession = mockSession;
  controller.loadSession(mockSession);

  if (mockSession.clarificationMessages.length !== 1 || mockSession.clarificationMessages[0].role !== 'interviewer') {
    throw new Error('Opening interviewer greeting was not initialized!');
  }
  console.log('✔ Interviewer opening greeting generated and attached to active session.');

  console.log('\nAll Phase 2 structural and formatting checks PASSED successfully!');
}

runPhase2Tests();
