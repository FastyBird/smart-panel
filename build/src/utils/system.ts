/**
 * System utilities for user management and permissions
 */

import { execSync, spawn, type SpawnOptions } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Check if running as root
 */
export function isRoot(): boolean {
	return process.getuid?.() === 0;
}

/**
 * Check if a system user exists
 */
export function userExists(username: string): boolean {
	try {
		execSync(`id ${username}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Create a system user for the service
 */
export function createSystemUser(username: string, homeDir: string): void {
	if (userExists(username)) {
		return;
	}

	// Create system user with no login shell
	execSync(`useradd --system --user-group --home-dir ${homeDir} --shell /usr/sbin/nologin ${username}`, {
		stdio: 'inherit',
	});
}

/**
 * Delete a system user
 */
export function deleteSystemUser(username: string): void {
	if (!userExists(username)) {
		return;
	}

	execSync(`userdel ${username}`, { stdio: 'inherit' });
}

/**
 * Create a directory with proper ownership
 */
export function createDirectory(path: string, owner?: string, mode = 0o755): void {
	if (!existsSync(path)) {
		mkdirSync(path, { recursive: true, mode });
	}

	if (owner) {
		execSync(`chown -R ${owner}:${owner} ${path}`, { stdio: 'ignore' });
	}
}

/**
 * Check if a file is readable
 */
export function isReadable(path: string): boolean {
	try {
		accessSync(path, constants.R_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if a file is writable
 */
export function isWritable(path: string): boolean {
	try {
		accessSync(path, constants.W_OK);
		return true;
	} catch {
		return false;
	}
}

/**
 * Write a file with proper permissions
 */
export function writeFile(path: string, content: string, mode = 0o644): void {
	const dir = dirname(path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	writeFileSync(path, content, { mode });
}

/**
 * Read a file safely
 */
export function readFile(path: string): string | null {
	try {
		return readFileSync(path, 'utf-8');
	} catch {
		return null;
	}
}

/**
 * Set file ownership
 */
export function setOwnership(path: string, owner: string): void {
	execSync(`chown -R ${owner}:${owner} ${path}`, { stdio: 'ignore' });
}

/**
 * Check if a command exists
 */
export function commandExists(command: string): boolean {
	try {
		execSync(`command -v ${command}`, { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

/**
 * Execute a command and return output
 */
export function exec(command: string, options?: { cwd?: string; silent?: boolean }): string {
	return execSync(command, {
		cwd: options?.cwd,
		stdio: options?.silent ? 'pipe' : 'inherit',
		encoding: 'utf-8',
	});
}

/**
 * Execute a command with live output
 */
export function execLive(command: string, args: string[], options?: SpawnOptions): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: 'inherit',
			...options,
		});

		child.on('close', (code) => {
			resolve(code ?? 0);
		});

		child.on('error', (err) => {
			reject(err);
		});
	});
}

/**
 * Get the Node.js executable path
 */
export function getNodePath(): string {
	return process.execPath;
}

/**
 * Check if systemd is available
 */
export function hasSystemd(): boolean {
	return existsSync('/run/systemd/system');
}

/**
 * Get system architecture
 */
export function getArch(): string {
	const arch = process.arch;
	switch (arch) {
		case 'arm':
			return 'armv7';
		case 'arm64':
			return 'arm64';
		case 'x64':
			return 'x64';
		default:
			return arch;
	}
}

/**
 * Get Linux distribution info
 */
export function getDistroInfo(): { name: string; version: string } | null {
	try {
		const osRelease = readFileSync('/etc/os-release', 'utf-8');
		const lines = osRelease.split('\n');
		const info: Record<string, string> = {};

		for (const line of lines) {
			const [key, ...valueParts] = line.split('=');
			if (key && valueParts.length > 0) {
				info[key] = valueParts.join('=').replace(/"/g, '');
			}
		}

		return {
			name: info['ID'] || 'unknown',
			version: info['VERSION_ID'] || 'unknown',
		};
	} catch {
		return null;
	}
}

/**
 * Make a file executable
 */
export function makeExecutable(path: string): void {
	chmodSync(path, 0o755);
}

/**
 * Generate a cryptographically secure random string
 */
export function generateSecret(length = 64): string {
	return randomBytes(length).toString('base64url').slice(0, length);
}
