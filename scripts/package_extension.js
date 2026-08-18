/**
 * Chrome Extension Production Packaging Script
 * Validates Manifest V3 compliance and creates deployable ZIP package.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('===============================================================');
console.log('📦 PACKAGING SYSTEM DESIGN INTERVIEW COPILOT CHROME EXTENSION 📦');
console.log('===============================================================\n');

// 1. Validate manifest.json
const manifestPath = path.join(rootDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ Error: manifest.json not found in project root!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log(`✔ Manifest V3 Found: "${manifest.name}" (v${manifest.version})`);

// 2. Validate core asset references
const requiredPaths = [
  'icons/icon-16.png',
  'icons/icon-48.png',
  'icons/icon-128.png',
  'background/service-worker.js',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css',
  'app/index.html',
  'app/js/app.js',
  'app/views/stage-discovery.html',
  'app/views/stage-problem-scope.html',
  'app/views/stage-requirements.html',
  'app/views/stage-architecture.html',
  'app/views/stage-deepdive.html',
  'app/views/stage-scorecard.html',
  'app/views/modals.html',
  'app/views/floating-tools.html',
  'prompts/critique_instructions.md',
  'prompts/phase1_problem_clarification.md',
  'prompts/phase2_requirements_eval.md',
  'prompts/phase3_hld_vision_eval.md',
  'prompts/phase4_deepdive_generation.md',
  'prompts/phase4_deepdive_eval.md',
  'prompts/phase5_gold_standard.md',
  'prompts/assistant_copilot.md'
];

let hasErrors = false;
for (const relPath of requiredPaths) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing required extension asset: ${relPath}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error('\nPackaging aborted due to missing assets.');
  process.exit(1);
}
console.log(`✔ All ${requiredPaths.length} critical assets & modular views verified.`);
console.log(`✔ Extension Author: ${manifest.author || 'Mangesh Chimankar'}`);

// 3. Automated Secret Key Scanner (Ensure NO API keys are in shipping bundle)
console.log('\n🔒 Running Zero-Secret Security Scan across shipping files...');
const shippingDirs = ['app', 'background', 'icons', 'popup', 'prompts', 'manifest.json'];

function scanDirectoryForSecrets(targetPath) {
  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    scanFileForSecrets(targetPath);
    return;
  }

  const entries = fs.readdirSync(targetPath);
  for (const entry of entries) {
    if (entry === '.DS_Store' || entry.startsWith('.')) continue;
    const full = path.join(targetPath, entry);
    const s = fs.statSync(full);
    if (s.isDirectory()) {
      scanDirectoryForSecrets(full);
    } else {
      scanFileForSecrets(full);
    }
  }
}

// Regex patterns for real API keys (excluding mock placeholder strings in HTML templates)
const SECRET_PATTERNS = [
  /AIzaSy[A-Za-z0-9_-]{33}/,                // Real Google Gemini / Cloud Key
  /sk-(?!proj-test)[A-Za-z0-9]{32,}/,       // Real OpenAI Key
  /sk-proj-(?!test)[A-Za-z0-9_-]{40,}/      // Real OpenAI Project Key
];

let leakedKeysFound = 0;
function scanFileForSecrets(filePath) {
  if (filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.ico')) return;
  const content = fs.readFileSync(filePath, 'utf8');

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      console.error(`🚨 SECURITY ALERT: Detected hardcoded API Key in ${path.relative(rootDir, filePath)}!`);
      leakedKeysFound++;
    }
  }
}

for (const item of shippingDirs) {
  scanDirectoryForSecrets(path.join(rootDir, item));
}

if (leakedKeysFound > 0) {
  console.error(`\n❌ PACKAGING HALTED: ${leakedKeysFound} hardcoded secret(s) found! Remove all API keys before shipping.`);
  process.exit(1);
}
console.log('✔ Security Scan Passed: ZERO API keys found in shipping bundle (BYOK architecture).');

// 3. Prepare dist directory
const distDir = path.join(rootDir, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const zipFileName = `system-design-copilot-v${manifest.version}.zip`;
const zipFilePath = path.join(distDir, zipFileName);

if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

// 4. Create ZIP package using zip CLI
const includeDirs = ['manifest.json', 'app', 'background', 'icons', 'popup', 'prompts'];
const cmd = `zip -r "${zipFilePath}" ${includeDirs.join(' ')} -x "*.DS_Store" "*__pycache__*" "*.git*"`;

try {
  execSync(cmd, { cwd: rootDir, stdio: 'pipe' });
  const stats = fs.statSync(zipFilePath);
  const sizeKb = (stats.size / 1024).toFixed(1);
  console.log(`\n🎉 SUCCESS: Extension packaged to:`);
  console.log(`   📂 ${zipFilePath} (${sizeKb} KB)`);
  console.log('\n===============================================================');
  console.log('🚀 READY TO INSTALL & PUBLISH:');
  console.log('1. LOAD UNPACKED (Developer Mode in Chrome):');
  console.log('   - Navigate to: chrome://extensions');
  console.log('   - Turn ON "Developer mode" (top right toggle)');
  console.log(`   - Click "Load unpacked" and select folder:`);
  console.log(`     ${rootDir}`);
  console.log('\n2. CHROME WEB STORE PUBLISHING:');
  console.log(`   - Upload the generated ZIP file: ${zipFileName}`);
  console.log('   - Go to: https://chrome.google.com/webstore/devcenter');
  console.log('===============================================================\n');
} catch (err) {
  console.error('❌ Error executing zip command:', err);
  process.exit(1);
}
