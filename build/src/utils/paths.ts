/**
 * Default paths for Smart Panel installation on Linux
 */

import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Package root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const PACKAGE_ROOT = resolve(__dirname, '../..');

// Default installation paths
export const DEFAULT_PATHS = {
	// Data directory (database, config, etc.)
	dataDir: '/var/lib/smart-panel',

	// Database directory
	dbDir: '/var/lib/smart-panel/data',

	// Configuration directory
	configDir: '/etc/smart-panel',

	// Environment file
	envFile: '/etc/smart-panel/environment',

	// Systemd service file
	systemdService: '/etc/systemd/system/smart-panel.service',

	// Log directory (when not using journald)
	logDir: '/var/log/smart-panel',

	// PID file
	pidFile: '/run/smart-panel/smart-panel.pid',

	// User home directory for user-level installation
	userDataDir: join(homedir(), '.smart-panel'),
} as const;

// Template paths within the package
export const TEMPLATE_PATHS = {
	systemdService: join(PACKAGE_ROOT, 'templates', 'systemd', 'smart-panel.service'),
	environment: join(PACKAGE_ROOT, 'templates', 'environment.template'),
} as const;

// Paths to backend and admin within node_modules
export function getBackendPath(baseDir: string): string {
	return join(baseDir, 'node_modules', '@fastybird', 'smart-panel-backend');
}

export function getAdminPath(baseDir: string): string {
	return join(baseDir, 'node_modules', '@fastybird', 'smart-panel-admin');
}

export function getBackendMainPath(baseDir: string): string {
	return join(getBackendPath(baseDir), 'dist', 'main.js');
}

export function getBackendCliPath(baseDir: string): string {
	return join(getBackendPath(baseDir), 'dist', 'cli.js');
}

export function getAdminDistPath(baseDir: string): string {
	return join(getAdminPath(baseDir), 'dist');
}

export function getTypeOrmCliPath(baseDir: string): string {
	return join(baseDir, 'node_modules', 'typeorm', 'cli.js');
}

export function getDataSourcePath(baseDir: string): string {
	return join(getBackendPath(baseDir), 'dist', 'dataSource.js');
}
