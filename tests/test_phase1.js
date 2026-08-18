import { CURATED_PROBLEMS, ProblemEngine } from '../app/js/services/problemEngine.js';

function runPhase1Tests() {
  console.log('=== Running Phase 1 Problem Engine Tests ===');

  // 1. Validate Curated Problems Catalog
  if (!Array.isArray(CURATED_PROBLEMS) || CURATED_PROBLEMS.length < 5) {
    throw new Error(`Curated problems catalog is invalid or too small: ${CURATED_PROBLEMS.length}`);
  }
  console.log(`✔ Found ${CURATED_PROBLEMS.length} pre-seeded curated problems.`);

  for (const prob of CURATED_PROBLEMS) {
    if (!prob.id || !prob.title || !prob.vaguePrompt || !prob.level || !prob.scaleMetrics) {
      throw new Error(`Curated problem missing required fields: ${JSON.stringify(prob)}`);
    }
  }
  console.log('✔ All curated problems have valid IDs, titles, vaguePrompts, and scaleMetrics.');

  // 2. Validate Custom Problem Creation
  const custom = ProblemEngine.createCustomProblem({
    title: 'Distributed Consensus Storage Engine',
    shortDescription: 'Build Raft consensus backed storage',
    vaguePrompt: 'Design a Raft consensus storage cluster. Walk me through your design.',
    level: 'Staff',
    category: 'Distributed Systems',
    scaleMetrics: { dau: 'Enterprise', qps: '100K writes/sec' }
  });

  if (!custom.id.startsWith('custom_')) {
    throw new Error('Custom problem ID must start with "custom_"');
  }
  if (custom.level !== 'Staff' || custom.isCustom !== true) {
    throw new Error('Custom problem metadata invalid');
  }
  console.log('✔ Custom problem creation logic verified.');

  console.log('\nAll Phase 1 unit and data checks PASSED successfully!');
}

runPhase1Tests();
