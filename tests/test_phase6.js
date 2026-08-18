import { ScorecardController } from '../app/js/controllers/scorecard.js';
import { StorageService } from '../app/js/services/storage.js';

async function runPhase6Tests() {
  console.log('=== Running Phase 6 Scorecard & Lifecycle Tests ===');

  // 1. Instantiate ScorecardController
  const controller = new ScorecardController({ 
    app: { pauseTimer: () => {}, navigateToPhase: () => {} }, 
    showToast: () => {} 
  });
  console.log('✔ ScorecardController instantiated safely.');

  // 2. Mock Full Session for Evaluation
  const mockCompletedSession = {
    id: 'session_test_456',
    problem: {
      title: 'Global Ride-Hailing Match & Real-Time Dispatch System',
      category: 'Distributed Systems'
    },
    profile: { level: 'Senior' },
    phase: 6,
    timers: {
      startedAt: Date.now() - 2100000,
      isRunning: false,
      totalElapsedSeconds: 2100, // 35 mins
      phaseElapsed: {
        phase_2: 240, // 4m
        phase_3: 420, // 7m
        phase_4: 780, // 13m
        phase_5: 660  // 11m
      }
    },
    requirements: {
      evaluation: { score: 86, status: 'Passed', strengths: ['Clear API contracts', 'Sound QPS math'] }
    },
    hld: {
      evaluation: { score: 88, status: 'Passed', strengths: ['Clean gateway separation', 'Redis H3 geospatial cache'], spofAndBottlenecks: ['Single write DB master'] }
    },
    deepDives: {
      evaluation: { overallScore: 90, status: 'Passed', strengths: ['Atomic Redis Lua script for locking'], areasForImprovement: ['Active-active multi-region failover'] }
    }
  };

  controller.app.activeSession = mockCompletedSession;
  await controller.loadSession(mockCompletedSession);

  // 3. Verify Scorecard Aggregation
  const scorecard = mockCompletedSession.evaluation.scorecard;
  if (!scorecard) {
    throw new Error('Scorecard data was not generated on session!');
  }

  // Check weighted formula: 86 * 0.25 + 88 * 0.40 + 90 * 0.35 = 21.5 + 35.2 + 31.5 = 88.2 -> 88
  if (scorecard.overallScore !== 88) {
    throw new Error(`Expected overall score 88, got ${scorecard.overallScore}`);
  }
  if (scorecard.overallVerdict !== 'Strong Hire') {
    throw new Error(`Expected 'Strong Hire', got ${scorecard.overallVerdict}`);
  }
  if (scorecard.timeAnalysis.totalDurationSeconds !== 2100) {
    throw new Error('Timing aggregation mismatch!');
  }
  console.log(`✔ Scorecard calculated: Score = ${scorecard.overallScore}/100 -> ${scorecard.overallVerdict}`);
  console.log(`✔ Time Analysis: ${Math.floor(scorecard.timeAnalysis.totalDurationSeconds / 60)} minutes active interview time.`);

  // 4. Verify History Storage Archival
  const history = await StorageService.getHistory();
  if (history.length === 0 || history[0].id !== 'session_test_456') {
    throw new Error('Completed session was not archived into history storage!');
  }
  console.log('✔ Completed scorecard successfully archived into StorageService history.');

  console.log('\nAll Phase 6 Scorecard and Storage checks PASSED successfully!');
}

runPhase6Tests();
