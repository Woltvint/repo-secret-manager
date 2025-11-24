const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

const TEST_DIR = './test';
const SECRETS_FILE = './test/test-secrets.json';
const TEST_PASSWORD = 'testpassword';

// Test secrets
const secrets = [
  'super_secret_password_123',
  'sk-1234567890abcdefghijklmnop',
  'my_api_secret_key_xyz',
  'jwt_token_secret_12345',
  'sk_test_stripe_key_abc123'
];

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function execCommand(command) {
  try {
    return execSync(command, {
      encoding: 'utf8',
      input: TEST_PASSWORD + '\n',
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    throw new Error(`Command failed: ${command}\n${err.message}`);
  }
}

function copyDir(src, dest) {
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true });
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    // Skip backup directory to avoid copying to itself
    if (entry.name === 'backup' || entry.name === 'test-secrets.json') {
      continue;
    }
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function cleanup() {
  log('\nCleaning up...');
  if (fs.existsSync(SECRETS_FILE)) {
    fs.unlinkSync(SECRETS_FILE);
  }
  const backupDir = `${TEST_DIR}/backup`;
  if (fs.existsSync(backupDir)) {
    fs.rmSync(backupDir, { recursive: true });
  }
  // Restore original test files if git is available
  try {
    execSync(`git checkout -- ${TEST_DIR}`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore if git is not available
  }
}

async function runTests() {
  try {
    log('=== uu-secret-manager Test Suite ===\n');

    // Step 1: Add secrets
    log('Step 1: Add secrets to the store');
    log('--------------------------------');
    for (const secret of secrets) {
      execCommand(`node cli.js add "${secret}" -s "${SECRETS_FILE}"`);
    }
    success('Secrets added\n');

    // Step 2: List secrets
    log('Step 2: List secrets');
    log('--------------------');
    const listOutput = execCommand(`node cli.js list -s "${SECRETS_FILE}"`);
    if (secrets.every(s => listOutput.includes(s))) {
      success('All secrets listed correctly\n');
    } else {
      error('Not all secrets found in list');
      throw new Error('List command failed');
    }

    // Step 3: Backup and replace
    log('Step 3: Replace secrets in test files');
    log('--------------------------------------');
    copyDir(TEST_DIR, `${TEST_DIR}/backup`);
    execCommand(`node cli.js replace "${TEST_DIR}" -s "${SECRETS_FILE}"`);
    success('Secrets replaced with placeholders\n');

    // Step 4: Verify placeholders
    log('Step 4: Verify placeholders exist');
    log('----------------------------------');
    let foundPlaceholders = false;
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          walkDir(fullPath);
        } else if (file.isFile() && !file.name.includes('README')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (content.includes('<!secret_')) {
            foundPlaceholders = true;
          }
        }
      }
    };
    walkDir(TEST_DIR);
    if (foundPlaceholders) {
      success('Placeholders found in test files\n');
    } else {
      error('No placeholders found - test failed');
      throw new Error('Placeholder verification failed');
    }

    // Step 5: Verify secrets are gone
    log('Step 5: Verify original secrets are gone');
    log('-----------------------------------------');
    let foundSecrets = false;
    const checkSecrets = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          checkSecrets(fullPath);
        } else if (file.isFile() && !file.name.includes('README')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          if (secrets.some(s => content.includes(s))) {
            foundSecrets = true;
          }
        }
      }
    };
    checkSecrets(TEST_DIR);
    if (!foundSecrets) {
      success('Original secrets replaced\n');
    } else {
      error('Original secrets still found - replacement failed');
      throw new Error('Secret replacement failed');
    }

    // Step 6: Reverse
    log('Step 6: Reverse placeholders back to secrets');
    log('---------------------------------------------');
    execCommand(`node cli.js reverse "${TEST_DIR}" -s "${SECRETS_FILE}"`);
    success('Placeholders reversed\n');

    // Step 7: Verify restoration
    log('Step 7: Verify secrets are restored');
    log('------------------------------------');
    let secretsRestored = true;
    const verifyRestore = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          verifyRestore(fullPath);
        } else if (file.isFile() && !file.name.includes('README')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const backupPath = fullPath.replace(TEST_DIR, `${TEST_DIR}/backup`);
          const backupContent = fs.readFileSync(backupPath, 'utf8');
          if (content !== backupContent) {
            secretsRestored = false;
          }
        }
      }
    };
    verifyRestore(TEST_DIR);
    if (secretsRestored) {
      success('Secrets restored successfully\n');
    } else {
      error('Secrets not restored - test failed');
      throw new Error('Secret restoration failed');
    }

    // Step 8: Compare with backup
    log('Step 8: Compare with backup');
    log('---------------------------');
    let allMatch = true;
    const compareFiles = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
          compareFiles(fullPath);
        } else if (file.isFile() && !file.name.includes('README')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const backupPath = fullPath.replace(TEST_DIR, `${TEST_DIR}/backup`);
          const backupContent = fs.readFileSync(backupPath, 'utf8');
          if (content !== backupContent) {
            allMatch = false;
            log(`  Files differ: ${fullPath}`);
          }
        }
      }
    };
    compareFiles(TEST_DIR);
    if (allMatch) {
      success('Files match original - full cycle successful\n');
    } else {
      error('Files differ from original');
      throw new Error('File comparison failed');
    }

    log('===================================');
    success('All tests passed! ✓');
    log('===================================\n');

    cleanup();
    process.exit(0);
  } catch (err) {
    error(`\nTest failed: ${err.message}`);
    cleanup();
    process.exit(1);
  }
}

runTests();
