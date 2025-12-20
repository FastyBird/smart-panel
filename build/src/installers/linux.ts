/**
 * Linux installer using systemd for service management
 */

import { execFileSync } from 'node:child_process';
import { existsSync, unlinkSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BaseInstaller, InstalledConfig, InstallOptions, ServiceStatus, UninstallOptions } from './base.js';
import {
	createDirectory,
	createSystemUser,
	deleteSystemUser,
	exec,
	execLive,
	generateSecret,
	getAdminDistPath,
	getBackendCliPath,
	getBackendMainPath,
	getDataSourcePath,
	getNodePath,
	getTypeOrmCliPath,
	hasSystemd,
	isRoot,
	readFile,
	setOwnership,
	userExists,
	writeFile,
} from '../utils/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVICE_NAME = 'smart-panel';
const SYSTEMD_PATH = `/etc/systemd/system/${SERVICE_NAME}.service`;

export class LinuxInstaller implements BaseInstaller {
	readonly platform = 'linux';

	private packageRoot: string;

	constructor() {
		// Package root is two levels up from dist/installers/
		this.packageRoot = join(__dirname, '..', '..');
	}

	isCompatible(): boolean {
		return process.platform === 'linux' && hasSystemd();
	}

	async checkPrerequisites(): Promise<string[]> {
		const errors: string[] = [];

		if (!isRoot()) {
			errors.push('This command must be run as root (use sudo)');
		}

		if (!hasSystemd()) {
			errors.push('systemd is required but not detected');
		}

		if (!existsSync(getNodePath())) {
			errors.push('Node.js executable not found');
		}

		return errors;
	}

	async install(options: InstallOptions): Promise<void> {
		const { user, dataDir, port, noStart, adminUsername, adminPassword } = options;

		// Create system user
		createSystemUser(user, dataDir);

		// Create directories
		createDirectory(dataDir, user, 0o755);
		createDirectory(join(dataDir, 'data'), user, 0o755);
		createDirectory(join(dataDir, 'config'), user, 0o755);
		createDirectory('/etc/smart-panel', undefined, 0o755);
		createDirectory('/run/smart-panel', user, 0o755);

		// Generate environment file
		this.createEnvironmentFile(dataDir, port, user);

		// Create systemd service file
		this.createServiceFile(user, dataDir);

		// Reload systemd
		exec('systemctl daemon-reload');

		// Enable service
		exec('systemctl enable smart-panel');

		// Run migrations
		await this.runMigrations(dataDir);

		// Create admin user if credentials provided
		if (adminUsername && adminPassword) {
			await this.createAdminUser(dataDir, adminUsername, adminPassword);
		}

		// Set ownership after all file-creating operations complete
		// This ensures database files created by migrations are owned by the service user
		setOwnership(dataDir, user);

		// Start service if not skipped
		if (!noStart) {
			await this.start();
		}
	}

	async uninstall(options: UninstallOptions): Promise<void> {
		const { keepData } = options;

		// Read installed config before removing environment file
		const config = this.getInstalledConfig();
		const serviceUser = config.user || 'smart-panel';
		const dataDir = config.dataDir || '/var/lib/smart-panel';

		// Stop and disable service
		try {
			exec('systemctl stop smart-panel', { silent: true });
		} catch {
			// Service might not be running
		}

		try {
			exec('systemctl disable smart-panel', { silent: true });
		} catch {
			// Service might not be enabled
		}

		// Remove systemd service file
		if (existsSync(SYSTEMD_PATH)) {
			unlinkSync(SYSTEMD_PATH);
		}

		// Reload systemd
		exec('systemctl daemon-reload');

		// Remove environment file
		if (existsSync('/etc/smart-panel/environment')) {
			unlinkSync('/etc/smart-panel/environment');
		}

		// Remove config directory if empty
		try {
			rmSync('/etc/smart-panel', { recursive: false });
		} catch {
			// Directory might not be empty or not exist
		}

		// Remove data directory if not keeping
		if (!keepData && existsSync(dataDir)) {
			rmSync(dataDir, { recursive: true, force: true });
		}

		// Remove run directory
		try {
			rmSync('/run/smart-panel', { recursive: true, force: true });
		} catch {
			// Might not exist
		}

		// Delete system user
		if (userExists(serviceUser)) {
			deleteSystemUser(serviceUser);
		}
	}

	/**
	 * Read installation config from environment file
	 */
	getInstalledConfig(): InstalledConfig {
		const envPath = '/etc/smart-panel/environment';
		const content = readFile(envPath);

		if (!content) {
			return {};
		}

		const config: InstalledConfig = {};

		const userMatch = content.match(/^FB_SERVICE_USER=(.+)$/m);
		if (userMatch?.[1]) {
			config.user = userMatch[1];
		}

		const dataDirMatch = content.match(/^FB_DATA_DIR=(.+)$/m);
		if (dataDirMatch?.[1]) {
			config.dataDir = dataDirMatch[1];
		}

		return config;
	}

	async start(): Promise<void> {
		exec('systemctl start smart-panel');
	}

	async stop(): Promise<void> {
		exec('systemctl stop smart-panel');
	}

	async restart(): Promise<void> {
		exec('systemctl restart smart-panel');
	}

	async status(): Promise<ServiceStatus> {
		const installed = existsSync(SYSTEMD_PATH);

		if (!installed) {
			return {
				installed: false,
				running: false,
				enabled: false,
				message: 'Service is not installed',
			};
		}

		let running = false;
		let enabled = false;
		let pid: number | undefined;
		let uptime: number | undefined;
		let memoryMB: number | undefined;

		// Check if running
		try {
			exec('systemctl is-active smart-panel', { silent: true });
			running = true;
		} catch {
			running = false;
		}

		// Check if enabled
		try {
			exec('systemctl is-enabled smart-panel', { silent: true });
			enabled = true;
		} catch {
			enabled = false;
		}

		// Get PID and resource usage if running
		if (running) {
			try {
				const pidOutput = exec('systemctl show smart-panel --property=MainPID --value', { silent: true });
				pid = parseInt(pidOutput.trim(), 10);

				if (pid && pid > 0) {
					// Get memory usage
					try {
						const memOutput = execFileSync('ps', ['-o', 'rss=', '-p', String(pid)], {
							encoding: 'utf-8',
							stdio: 'pipe',
						});
						const calculatedMemory = Math.round(parseInt(memOutput.trim(), 10) / 1024);
						// Only assign if valid (not NaN and non-negative)
						if (!isNaN(calculatedMemory) && calculatedMemory >= 0) {
							memoryMB = calculatedMemory;
						}
					} catch {
						// Ignore
					}

					// Get uptime
					try {
						const startTimeOutput = exec(
							'systemctl show smart-panel --property=ActiveEnterTimestamp --value',
							{ silent: true }
						);
						const startTime = new Date(startTimeOutput.trim());
						const calculatedUptime = Math.floor((Date.now() - startTime.getTime()) / 1000);
						// Only assign if valid (not NaN and non-negative)
						if (!isNaN(calculatedUptime) && calculatedUptime >= 0) {
							uptime = calculatedUptime;
						}
					} catch {
						// Ignore
					}
				}
			} catch {
				// Ignore
			}
		}

		return {
			installed,
			running,
			enabled,
			pid: pid && pid > 0 ? pid : undefined,
			uptime,
			memoryMB,
		};
	}

	async logs(options: { follow: boolean; lines: number; since?: string }): Promise<void> {
		const args = ['journalctl', '-u', 'smart-panel', '--no-pager', '-n', options.lines.toString()];

		if (options.follow) {
			args.push('-f');
		}

		if (options.since) {
			args.push('--since', options.since);
		}

		await execLive(args[0], args.slice(1));
	}

	async runMigrations(dataDir: string): Promise<void> {
		const nodeModulesPath = join(dataDir, 'node_modules');

		// Check if node_modules exists (for global install, use package's node_modules)
		const actualModulesPath = existsSync(nodeModulesPath) ? dataDir : this.packageRoot;

		const typeormCli = getTypeOrmCliPath(actualModulesPath);
		const dataSource = getDataSourcePath(actualModulesPath);

		if (!existsSync(typeormCli) || !existsSync(dataSource)) {
			throw new Error('TypeORM CLI or data source not found. Make sure dependencies are installed.');
		}

		// Set environment variables for migration
		const env = {
			...process.env,
			FB_DB_PATH: join(dataDir, 'data'),
			FB_CONFIG_PATH: join(dataDir, 'config'),
			NODE_ENV: 'production',
		};

		execFileSync('node', [typeormCli, 'migration:run', '-d', dataSource], {
			cwd: actualModulesPath,
			env,
			stdio: 'inherit',
		});
	}

	async createAdminUser(dataDir: string, username: string, password: string): Promise<void> {
		const nodeModulesPath = join(dataDir, 'node_modules');

		// Check if node_modules exists (for global install, use package's node_modules)
		const actualModulesPath = existsSync(nodeModulesPath) ? dataDir : this.packageRoot;

		const backendCli = getBackendCliPath(actualModulesPath);

		if (!existsSync(backendCli)) {
			throw new Error('Backend CLI not found. Make sure dependencies are installed.');
		}

		// Set environment variables for CLI
		const env = {
			...process.env,
			FB_DB_PATH: join(dataDir, 'data'),
			FB_CONFIG_PATH: join(dataDir, 'config'),
			NODE_ENV: 'production',
		};

		execFileSync('node', [backendCli, 'auth:onboarding', username, password], {
			cwd: actualModulesPath,
			env,
			stdio: 'inherit',
		});
	}

	private createEnvironmentFile(dataDir: string, port: number, user: string): void {
		const envPath = '/etc/smart-panel/environment';
		const adminDistPath = getAdminDistPath(this.packageRoot);

		// Preserve existing JWT secret if environment file exists
		let jwtSecret: string | undefined;
		const existingContent = readFile(envPath);

		if (existingContent) {
			const match = existingContent.match(/^FB_JWT_SECRET=(.+)$/m);
			if (match?.[1]) {
				jwtSecret = match[1];
			}
		}

		// Generate new secret only if not found
		if (!jwtSecret) {
			jwtSecret = generateSecret(64);
		}

		const content = `# Smart Panel Environment Configuration
# Generated by smart-panel-service install

NODE_ENV=production
FB_BACKEND_PORT=${port}
FB_ADMIN_UI_PATH=${adminDistPath}
FB_DB_PATH=${dataDir}/data
FB_CONFIG_PATH=${dataDir}/config

# JWT secret for authentication (auto-generated)
FB_JWT_SECRET=${jwtSecret}

# Installation settings (used by uninstall/update)
FB_SERVICE_USER=${user}
FB_DATA_DIR=${dataDir}

# Uncomment and configure as needed:
# FB_INFLUXDB_URL=http://localhost:8086
# FB_INFLUXDB_DATABASE=smart_panel
# FB_MDNS_ENABLED=true
# FB_MDNS_SERVICE_NAME=FastyBird Smart Panel
`;

		// Use restrictive permissions for file containing secrets
		writeFile(envPath, content, 0o600);
	}

	private createServiceFile(user: string, dataDir: string): void {
		const nodePath = getNodePath();
		const mainPath = getBackendMainPath(this.packageRoot);

		const content = `[Unit]
Description=FastyBird Smart Panel
Documentation=https://smart-panel.fastybird.com
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${user}
Group=${user}
WorkingDirectory=${dataDir}
EnvironmentFile=-/etc/smart-panel/environment
ExecStart=${nodePath} ${mainPath}
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=smart-panel

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${dataDir}
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
`;

		writeFile(SYSTEMD_PATH, content, 0o644);
	}
}
