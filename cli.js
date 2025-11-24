#!/usr/bin/env node
const { Command } = require('commander');
const program = new Command();
const path = require('path');
const vault = require('./vault');
const { v4: uuidv4 } = require('uuid');
const replace = require('./replace');

program
  .name('uu-secret-manager')
  .description('CLI to manage secrets in files and folders')
  .version('1.0.0');

program
  .command('list')
  .description('List all secrets in the store')
  .option('-s, --secrets <path>', 'Path to secrets.json (encrypted)', 'secrets.json')
  .action(async (options) => {
    try {
      const secretsPath = path.resolve(options.secrets || 'secrets.json');
      const password = await vault.promptPassword('Vault password: ');
      const decrypted = await vault.decryptVaultFile(secretsPath, password);
      const secrets = JSON.parse(decrypted);
      console.log('Secrets:');
      Object.entries(secrets).forEach(([uuid, value]) => {
        console.log(`${uuid}: ${value}`);
      });
    } catch (err) {
      console.error('Error listing secrets:', err.message);
    }
  });

program
  .command('add <secret>')
  .description('Add a secret to the store')
  .option('-s, --secrets <path>', 'Path to secrets.json (encrypted)', 'secrets.json')
  .action(async (secret, options) => {
    try {
      const secretsPath = path.resolve(options.secrets || 'secrets.json');
      const password = await vault.promptPassword('Vault password: ');
      let secrets = {};
      let decrypted = '';
      try {
        decrypted = await vault.decryptVaultFile(secretsPath, password);
        secrets = JSON.parse(decrypted);
      } catch (err) {
        // If file doesn't exist or is empty, start fresh
        secrets = {};
      }
      const uuid = uuidv4();
      secrets[uuid] = secret;
      await vault.encryptVaultFile(secretsPath, password, JSON.stringify(secrets, null, 2));
      console.log(`Secret added with placeholder: <!secret_${uuid}!>`);
    } catch (err) {
      console.error('Error adding secret:', err.message);
    }
  });

program
  .command('replace <directory>')
  .option('-s, --secrets <path>', 'Path to secrets.json (encrypted)', 'secrets.json')
  .description('Replace secrets in files with placeholders')
  .action(async (directory, options) => {
    try {
      const secretsPath = path.resolve(options.secrets || 'secrets.json');
      const password = await vault.promptPassword('Vault password: ');
      const decrypted = await vault.decryptVaultFile(secretsPath, password);
      const secrets = JSON.parse(decrypted);
      let replacedFiles = 0;
      replace.walkDir(directory, (filePath) => {
        if (replace.replaceSecretsInFile(filePath, secrets)) {
          console.log(`Replaced secrets in: ${filePath}`);
          replacedFiles++;
        }
      });
      if (replacedFiles === 0) {
        console.log('No secrets replaced.');
      }
    } catch (err) {
      console.error('Error replacing secrets:', err.message);
    }
  });

program
  .command('reverse <directory>')
  .option('-s, --secrets <path>', 'Path to secrets.json (encrypted)', 'secrets.json')
  .description('Reverse placeholders back to secrets in files')
  .action(async (directory, options) => {
    try {
      const secretsPath = path.resolve(options.secrets || 'secrets.json');
      const password = await vault.promptPassword('Vault password: ');
      const decrypted = await vault.decryptVaultFile(secretsPath, password);
      const secrets = JSON.parse(decrypted);
      let reversedFiles = 0;
      replace.walkDir(directory, (filePath) => {
        if (replace.reverseSecretsInFile(filePath, secrets)) {
          console.log(`Reversed placeholders in: ${filePath}`);
          reversedFiles++;
        }
      });
      if (reversedFiles === 0) {
        console.log('No placeholders reversed.');
      }
    } catch (err) {
      console.error('Error reversing placeholders:', err.message);
    }
  });

program.parse(process.argv);
