#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
/**
 * Installs the pre-commit hook for checking secrets before commits
 */
function installHook() {
    // Check if we're in a git repository
    if (!fs.existsSync('.git')) {
        console.error(`${RED}Error: Not a git repository${RESET}`);
        console.error(`Run this command from the root of your git repository.`);
        process.exit(1);
    }
    // Create .git/hooks directory if it doesn't exist
    const hooksDir = '.git/hooks';
    if (!fs.existsSync(hooksDir)) {
        fs.mkdirSync(hooksDir, { recursive: true });
    }
    // Find the pre-commit hook source
    const hookSource = path.join(__dirname, '..', '.githooks', 'pre-commit');
    const hookDest = path.join(hooksDir, 'pre-commit');
    if (!fs.existsSync(hookSource)) {
        console.error(`${RED}Error: Hook source not found at ${hookSource}${RESET}`);
        process.exit(1);
    }
    // Check if hook already exists
    if (fs.existsSync(hookDest)) {
        const existingContent = fs.readFileSync(hookDest, 'utf8');
        if (existingContent.includes('uu-secret-manager')) {
            console.log(`${YELLOW}ℹ️  Pre-commit hook already installed${RESET}`);
            process.exit(0);
        }
        // Backup existing hook
        const backupPath = hookDest + '.backup';
        fs.copyFileSync(hookDest, backupPath);
        console.log(`${YELLOW}⚠️  Existing pre-commit hook backed up to: ${backupPath}${RESET}`);
    }
    // Copy and make executable
    fs.copyFileSync(hookSource, hookDest);
    fs.chmodSync(hookDest, 0o755);
    console.log(`${GREEN}✅ Git pre-commit hook installed successfully!${RESET}`);
    console.log(`\n${GREEN}The hook will now check for potential secrets before each commit.${RESET}`);
    console.log(`${YELLOW}To bypass the hook (not recommended), use: git commit --no-verify${RESET}\n`);
}
installHook();
//# sourceMappingURL=install-hook.js.map