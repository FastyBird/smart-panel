#!/usr/bin/env node

/**
 * Smart Panel CLI - Main entry point
 *
 * This CLI provides access to the backend CLI commands.
 * For service management, use smart-panel-service instead.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the backend CLI
const packageRoot = join(__dirname, '..');
const backendCliPath = join(packageRoot, 'node_modules', '@fastybird', 'smart-panel-backend', 'dist', 'cli.js');

if (!existsSync(backendCliPath)) {
	console.error('Error: Backend CLI not found at', backendCliPath);
	console.error('Make sure @fastybird/smart-panel-backend is installed.');
	process.exit(1);
}

// Forward all arguments to the backend CLI
const args = process.argv.slice(2);

const child = spawn(process.execPath, [backendCliPath, ...args], {
	stdio: 'inherit',
	env: process.env,
});

child.on('close', (code) => {
	process.exit(code ?? 0);
});

child.on('error', (err) => {
	console.error('Failed to start backend CLI:', err.message);
	process.exit(1);
});
