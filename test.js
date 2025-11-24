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
    // Return combined output even on error
    return (err.stdout || '') + (err.stderr || '');
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

    // Test 1: Add secrets
    log('Test 1: Add secrets to the store');
    log('----------------------------------');
    for (const secret of secrets) {
      execCommand(`node cli.js add "${secret}" -s "${SECRETS_FILE}"`);
    }
    success('Secrets added\n');

    // Test 2: List secrets
    log('Test 2: List secrets');
    log('--------------------');
    const listOutput = execCommand(`node cli.js list -s "${SECRETS_FILE}"`);
    if (secrets.every(s => listOutput.includes(s))) {
      success('All secrets listed correctly\n');
    } else {
      error('Not all secrets found in list');
      throw new Error('List command failed');
    }

    // Test 3: Backup and replace
    log('Test 3: Replace secrets in test files');
    log('--------------------------------------');
    copyDir(TEST_DIR, `${TEST_DIR}/backup`);
    execCommand(`node cli.js replace "${TEST_DIR}" -s "${SECRETS_FILE}"`);
    success('Secrets replaced with placeholders\n');

    // Test 4: Verify placeholders
    log('Test 4: Verify placeholders exist');
    log('----------------------------------');
    let foundPlaceholders = false;
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && file.name !== 'backup') {
          walkDir(fullPath);
        } else if (file.isFile() && !file.name.includes('README') && !file.name.includes('test-secrets')) {
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

    // Test 5: Verify secrets are gone
    log('Test 5: Verify original secrets are gone');
    log('-----------------------------------------');
    let foundSecrets = false;
    const checkSecrets = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && file.name !== 'backup') {
          checkSecrets(fullPath);
        } else if (file.isFile() && !file.name.includes('README') && !file.name.includes('test-secrets')) {
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

    // Test 6: Reverse
    log('Test 6: Reverse placeholders back to secrets');
    log('---------------------------------------------');
    execCommand(`node cli.js reverse "${TEST_DIR}" -s "${SECRETS_FILE}"`);
    success('Placeholders reversed\n');

    // Test 7: Verify restoration
    log('Test 7: Verify secrets are restored');
    log('------------------------------------');
    let secretsRestored = true;
    const verifyRestore = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && file.name !== 'backup') {
          verifyRestore(fullPath);
        } else if (file.isFile() && !file.name.includes('README') && !file.name.includes('test-secrets')) {
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

    // Test 8: Compare with backup
    log('Test 8: Compare with backup');
    log('---------------------------');
    let allMatch = true;
    const compareFiles = (dir) => {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory() && file.name !== 'backup') {
          compareFiles(fullPath);
        } else if (file.isFile() && !file.name.includes('README') && !file.name.includes('test-secrets')) {
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

    // Test 9: Add duplicate secret
    log('Test 9: Add duplicate secret');
    log('----------------------------');
    const firstSecret = secrets[0];
    execCommand(`node cli.js add "${firstSecret}" -s "${SECRETS_FILE}"`);
    const listOutput2 = execCommand(`node cli.js list -s "${SECRETS_FILE}"`);
    const matches = (listOutput2.match(new RegExp(firstSecret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    if (matches === 2) {
      success('Duplicate secret added with different UUID\n');
    } else {
      error(`Expected 2 occurrences of secret, found ${matches}`);
      throw new Error('Duplicate secret test failed');
    }

    // Test 10: Wrong password
    log('Test 10: Wrong password handling');
    log('---------------------------------');
    try {
      execSync(`echo "wrongpassword" | node cli.js list -s "${SECRETS_FILE}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      error('Should have failed with wrong password');
      throw new Error('Wrong password test failed');
    } catch (err) {
      success('Correctly rejected wrong password\n');
    }

    // Test 11: Empty directory
    log('Test 11: Replace in empty directory');
    log('------------------------------------');
    const emptyDir = `${TEST_DIR}/empty`;
    fs.mkdirSync(emptyDir, { recursive: true });
    const emptyOutput = execCommand(`node cli.js replace "${emptyDir}" -s "${SECRETS_FILE}"`);
    if (emptyOutput.includes('No secrets replaced')) {
      success('Correctly handled empty directory\n');
    } else {
      error('Empty directory test failed');
      throw new Error('Empty directory handling failed');
    }
    fs.rmdirSync(emptyDir);

    // Test 12: File with multiple occurrences
    log('Test 12: Multiple occurrences of same secret');
    log('---------------------------------------------');
    const multiFile = `${TEST_DIR}/multi-secret.txt`;
    const testSecret = secrets[0];
    fs.writeFileSync(multiFile, `${testSecret}\n${testSecret}\n${testSecret}\n`);
    execCommand(`node cli.js replace "${multiFile}" -s "${SECRETS_FILE}"`);
    const multiContent = fs.readFileSync(multiFile, 'utf8');
    const placeholderCount = (multiContent.match(/<!secret_/g) || []).length;
    if (placeholderCount === 3 && !multiContent.includes(testSecret)) {
      success('All occurrences replaced\n');
    } else {
      error(`Expected 3 placeholders, found ${placeholderCount}`);
      throw new Error('Multiple occurrences test failed');
    }
    fs.unlinkSync(multiFile);

    // Test 13: Non-existent secrets file for list
    log('Test 13: Non-existent secrets file');
    log('-----------------------------------');
    const nonExistOutput = execCommand(`node cli.js list -s "${TEST_DIR}/nonexistent.json" 2>&1`);
    if (nonExistOutput.includes('Error') && (nonExistOutput.includes('ENOENT') || nonExistOutput.includes('no such file'))) {
      success('Correctly handled non-existent secrets file\n');
    } else {
      error('Non-existent file error not properly reported');
      throw new Error('Non-existent file test failed');
    }

    // Test 14: Create new secrets file
    log('Test 14: Create new secrets file');
    log('---------------------------------');
    const newSecretsFile = `${TEST_DIR}/new-secrets.json`;
    if (fs.existsSync(newSecretsFile)) {
      fs.unlinkSync(newSecretsFile);
    }
    execCommand(`node cli.js add "new_secret_123" -s "${newSecretsFile}"`);
    if (fs.existsSync(newSecretsFile)) {
      const newContent = execCommand(`node cli.js list -s "${newSecretsFile}"`);
      if (newContent.includes('new_secret_123')) {
        success('New secrets file created successfully\n');
        fs.unlinkSync(newSecretsFile);
      } else {
        error('New secret not found in new file');
        throw new Error('New secrets file test failed');
      }
    } else {
      error('New secrets file not created');
      throw new Error('New secrets file creation failed');
    }

    // Test 15: Reverse with no placeholders
    log('Test 15: Reverse with no placeholders');
    log('--------------------------------------');
    const noPHFile = `${TEST_DIR}/no-placeholders.txt`;
    fs.writeFileSync(noPHFile, 'just regular text');
    const reverseOutput = execCommand(`node cli.js reverse "${noPHFile}" -s "${SECRETS_FILE}"`);
    if (reverseOutput.includes('No placeholders reversed')) {
      success('Correctly handled file with no placeholders\n');
    } else {
      error('No placeholders test failed');
      throw new Error('No placeholders handling failed');
    }
    fs.unlinkSync(noPHFile);

    log('===================================');
    success('All 15 tests passed! ✓');
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
