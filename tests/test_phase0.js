import fs from 'fs';
import path from 'path';

function runTests() {
  console.log('=== Verifying Phase 0 Chrome Extension Foundation ===');
  
  // 1. Check Manifest
  const manifestPath = path.resolve('manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('manifest.json does not exist!');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log('✔ manifest.json is valid JSON (version: ' + manifest.version + ')');
  
  if (manifest.manifest_version !== 3) {
    throw new Error('Manifest version must be 3!');
  }
  console.log('✔ manifest_version is 3');

  // 2. Check Icons
  for (const [size, iconRelPath] of Object.entries(manifest.icons)) {
    const iconAbsPath = path.resolve(iconRelPath);
    if (!fs.existsSync(iconAbsPath)) {
      throw new Error(`Icon file ${iconRelPath} does not exist!`);
    }
    const stat = fs.statSync(iconAbsPath);
    console.log(`✔ Icon ${iconRelPath} exists (${stat.size} bytes)`);
  }

  // 3. Check core files
  const requiredFiles = [
    'background/service-worker.js',
    'popup/popup.html',
    'popup/popup.css',
    'popup/popup.js',
    'app/index.html',
    'app/css/variables.css',
    'app/css/layout.css',
    'app/css/components.css',
    'app/js/services/storage.js',
    'app/js/services/llm.js',
    'app/js/controllers/settings.js',
    'app/js/app.js'
  ];

  for (const file of requiredFiles) {
    const p = path.resolve(file);
    if (!fs.existsSync(p)) {
      throw new Error(`Required file ${file} is missing!`);
    }
    console.log(`✔ File ${file} verified`);
  }

  console.log('\nAll Phase 0 structural checks PASSED successfully!');
}

runTests();
