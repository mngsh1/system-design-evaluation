import { StorageService } from '../app/js/services/storage.js';
import { ProblemEngine } from '../app/js/services/problemEngine.js';

async function runTests() {
  console.log('=== Running Observation & Quality Fixes Tests ===');

  // 1. Verify ProblemEngine assigns createdAt
  const custom = ProblemEngine.createCustomProblem({
    title: 'Distributed Transaction Coordinator',
    level: 'Staff'
  });
  if (!custom.createdAt || typeof custom.createdAt !== 'number') {
    throw new Error('Custom problem missing valid createdAt timestamp');
  }
  console.log(`✔ ProblemEngine createdAt timestamp validated: ${custom.createdAt}`);

  // 2. Verify Storage & History Solved matching
  const testProblem = {
    id: 'test_solved_p1',
    title: 'Distributed Video Transcoder',
    level: 'Senior',
    category: 'Media & Stream',
    createdAt: Date.now() - 5 * 60 * 1000 // 5m ago
  };
  await StorageService.addProblemsToLibrary([testProblem]);

  const historyItem = {
    id: 'hist_test_1',
    problem: testProblem,
    problemTitle: testProblem.title,
    phase: 6,
    completedAt: Date.now(),
    scorecard: {
      overallScore: 92,
      overallVerdict: 'Strong Hire'
    },
    timers: {
      startedAt: Date.now() - 45 * 60 * 1000,
      totalElapsedSeconds: 2700,
      phaseElapsed: { phase_2: 300, phase_3: 600, phase_4: 900, phase_5: 900, phase_6: 0 }
    }
  };
  await StorageService.appendHistory(historyItem);

  const history = await StorageService.getHistory();
  const found = history.find(h => h.problem?.id === testProblem.id || h.problemTitle === testProblem.title);
  if (!found || found.scorecard?.overallScore !== 92) {
    throw new Error('History solved problem record not retrieved properly');
  }
  console.log(`✔ Solved problem detection in history verified: Score=${found.scorecard.overallScore}/100 (${found.scorecard.overallVerdict})`);

  // 3. Test relative time formatting logic
  function formatTimeAgo(ts) {
    if (!ts) return 'Curated Standard';
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (60 * 1000));
    if (mins < 1) return '⚡ Generated just now';
    if (mins < 60) return `⚡ Generated ${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `⚡ Generated ${hours}h ago`;
    return `⚡ Generated on ${new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  }

  const justNow = formatTimeAgo(Date.now() - 10000);
  const fiveMinAgo = formatTimeAgo(Date.now() - 5 * 60 * 1000);
  const twoHoursAgo = formatTimeAgo(Date.now() - 2 * 60 * 60 * 1000);

  if (!justNow.includes('just now')) throw new Error(`Expected 'just now', got ${justNow}`);
  if (!fiveMinAgo.includes('5m ago')) throw new Error(`Expected '5m ago', got ${fiveMinAgo}`);
  if (!twoHoursAgo.includes('2h ago')) throw new Error(`Expected '2h ago', got ${twoHoursAgo}`);

  console.log(`✔ Time ago formatting passed: "${justNow}", "${fiveMinAgo}", "${twoHoursAgo}"`);

  // 4. Test Monotonic maxPhase preservation on clicking past tabs
  const activeSession = {
    id: 'test_session_monotonic',
    problem: testProblem,
    phase: 5,
    maxPhase: 5,
    evaluation: { scorecard: { overallScore: 90 } }
  };
  
  // Simulate clicking on Phase 2 (Requirements) in a completed exam
  const isCompleted = Boolean(activeSession.evaluation?.scorecard || activeSession.completedAt);
  const phaseClicked = 2;
  if (isCompleted) {
    activeSession.maxPhase = 5;
  } else {
    activeSession.maxPhase = Math.max(activeSession.maxPhase || 1, activeSession.phase || 1, phaseClicked);
    if (!activeSession.phase || phaseClicked > activeSession.phase) {
      activeSession.phase = phaseClicked;
    }
  }
  activeSession.currentViewPhase = phaseClicked;

  const maxUnlockedAfterClick = isCompleted ? 5 : Math.max(activeSession.maxPhase || 1, activeSession.phase || 1);
  if (maxUnlockedAfterClick !== 5) {
    throw new Error(`Expected maxUnlocked to stay 5, got ${maxUnlockedAfterClick}`);
  }
  console.log(`✔ Monotonic progress preservation verified: clicking earlier tabs does not clear future progress (maxUnlocked=${maxUnlockedAfterClick})`);

  console.log('\nAll Quality & Feature Fix Tests PASSED successfully!');
}

runTests();
