const { Vault } = require('ansible-vault');
const readline = require('readline');
const fs = require('fs');

function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
    rl.question(question, (password) => {
      rl.close();
      resolve(password);
    });
  });
}

async function decryptVaultFile(vaultPath, password) {
  try {
    const vault = new Vault({ password });
    const encryptedContent = fs.readFileSync(vaultPath, 'utf8');
    const decrypted = await vault.decrypt(encryptedContent);
    return decrypted;
  } catch (err) {
    throw new Error('Failed to decrypt vault file: ' + err.message);
  }
}

async function encryptVaultFile(vaultPath, password, data) {
  try {
    const vault = new Vault({ password });
    const encrypted = await vault.encrypt(data);
    fs.writeFileSync(vaultPath, encrypted, 'utf8');
  } catch (err) {
    throw new Error('Failed to encrypt vault file: ' + err.message);
  }
}

module.exports = {
  promptPassword,
  decryptVaultFile,
  encryptVaultFile
};
