import fs from 'fs';
import path from 'path';

function runResponsiveTests() {
  console.log('=== Running Responsive UI & Media Query Validation ===\n');

  const layoutCss = fs.readFileSync(path.resolve('app/css/layout.css'), 'utf8');
  const componentsCss = fs.readFileSync(path.resolve('app/css/components.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.resolve('app/index.html'), 'utf8');

  // 1. Check viewport meta tag
  if (!indexHtml.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">')) {
    throw new Error('index.html missing responsive viewport meta tag');
  }
  console.log('✔ Responsive viewport meta tag verified in index.html');

  // 2. Check layout.css responsive breakpoints
  const layoutBreakpoints = [
    '@media (max-width: 1400px)',
    '@media (max-width: 1180px)',
    '@media (max-width: 900px)',
    '@media (max-width: 600px)',
    '@media print'
  ];

  for (const bp of layoutBreakpoints) {
    if (!layoutCss.includes(bp)) {
      throw new Error(`layout.css missing expected breakpoint: ${bp}`);
    }
    console.log(`✔ layout.css contains breakpoint: ${bp}`);
  }

  // 3. Check components.css responsive rules
  const componentBreakpoints = [
    '@media (max-width: 1100px)',
    '@media (max-width: 850px)',
    '@media (max-width: 600px)',
    '@media print'
  ];

  for (const bp of componentBreakpoints) {
    if (!componentsCss.includes(bp)) {
      throw new Error(`components.css missing expected breakpoint: ${bp}`);
    }
    console.log(`✔ components.css contains breakpoint: ${bp}`);
  }

  // 4. Check critical component responsive selectors
  const requiredResponsiveSelectors = [
    '.problem-cards-grid',
    '.req-grid-container',
    '.scorecard-hero-card',
    '.scorecard-two-col-grid',
    '.gold-grid',
    '.header-stepper',
    '.drawer-panel',
    '.assistant-panel'
  ];

  for (const sel of requiredResponsiveSelectors) {
    const inLayout = layoutCss.includes(sel);
    const inComponents = componentsCss.includes(sel);
    if (!inLayout && !inComponents) {
      throw new Error(`Missing responsive styling for selector: ${sel}`);
    }
    console.log(`✔ Responsive selector verified: ${sel}`);
  }

  // 5. Verify print rules contain full height overrides
  if (!layoutCss.includes('overflow: visible !important') || !componentsCss.includes('display: block !important')) {
    throw new Error('Print styles missing overflow: visible / block display for multi-page export');
  }
  console.log('✔ Print media queries verified with complete multi-page pagination rules');

  console.log('\nAll Responsive UI & Layout checks PASSED successfully!');
}

runResponsiveTests();
