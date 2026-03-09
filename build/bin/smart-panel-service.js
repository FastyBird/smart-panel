#!/usr/bin/env node

/**
 * Smart Panel Service CLI - Service management for Linux
 *
 * Commands:
 *   install   - Install Smart Panel as a systemd service
 *   uninstall - Remove the systemd service
 *   start     - Start the service
 *   stop      - Stop the service
 *   restart   - Restart the service
 *   status    - Show service status
 *   logs      - View service logs
 *   update    - Update to latest version
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from compiled dist
const distPath = join(__dirname, '..', 'dist');
const { getInstaller } = await import(join(distPath, 'installers', 'index.js'));
const { logger, isRoot, hasSystemd, getArch, getDistroInfo } = await import(join(distPath, 'utils', 'index.js'));

/**
 * Compare two semver version strings.
 * Returns -1 if a < b, 0 if a === b, 1 if a > b.
 */
function compareSemver(a, b) {
	const parseVersion = (v) => {
		const cleaned = v.replace(/^v/, '');
		const [base, ...prereleaseParts] = cleaned.split('-');
		const parts = base.split('.').map(Number);
		const prerelease = prereleaseParts.length > 0 ? prereleaseParts.join('-') : null;

		return { parts, prerelease };
	};

	const aParsed = parseVersion(a);
	const bParsed = parseVersion(b);

	for (let i = 0; i < 3; i++) {
		const av = aParsed.parts[i] || 0;
		const bv = bParsed.parts[i] || 0;

		if (av < bv) return -1;
		if (av > bv) return 1;
	}

	// Pre-release version has lower precedence than the release version
	if (aParsed.prerelease && !bParsed.prerelease) return -1;
	if (!aParsed.prerelease && bParsed.prerelease) return 1;

	if (aParsed.prerelease && bParsed.prerelease) {
		const aParts = aParsed.prerelease.split('.');
		const bParts = bParsed.prerelease.split('.');
		const maxLen = Math.max(aParts.length, bParts.length);

		for (let i = 0; i < maxLen; i++) {
			if (i >= aParts.length) return -1;
			if (i >= bParts.length) return 1;

			const aNum = Number(aParts[i]);
			const bNum = Number(bParts[i]);
			const aIsNum = !isNaN(aNum);
			const bIsNum = !isNaN(bNum);

			if (aIsNum && !bIsNum) return -1;
			if (!aIsNum && bIsNum) return 1;

			if (aIsNum && bIsNum) {
				if (aNum < bNum) return -1;
				if (aNum > bNum) return 1;
			} else {
				if (aParts[i] < bParts[i]) return -1;
				if (aParts[i] > bParts[i]) return 1;
			}
		}
	}

	return 0;
}

// Get package version
const packageJsonPath = join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

const program = new Command();

program
	.name('smart-panel-service')
	.description('FastyBird Smart Panel service management CLI')
	.version(version);

// ============================================================================
// Install Command
// ============================================================================
program
	.command('install')
	.description('Install Smart Panel as a systemd service')
	.option('-p, --port <port>', 'HTTP port for the backend', '3000')
	.option('-u, --user <user>', 'System user for the service', 'smart-panel')
	.option('-d, --data-dir <path>', 'Data directory path', '/var/lib/smart-panel')
	.option('--admin-username <username>', 'Create admin user with this username')
	.option('--admin-password <password>', 'Admin user password (requires --admin-username)')
	.option('--no-start', 'Do not start the service after installation')
	.action(async (options) => {
		console.log();
		console.log(chalk.bold.cyan('  FastyBird Smart Panel Installer'));
		console.log(chalk.gray('  ─────────────────────────────────'));
		console.log();

		// Check root
		if (!isRoot()) {
			logger.error('This command must be run as root. Please use sudo.');
			process.exit(1);
		}

		// Check systemd
		if (!hasSystemd()) {
			logger.error('systemd is required but not detected on this system.');
			process.exit(1);
		}

		const installer = getInstaller();
		const spinner = ora();

		try {
			// Show system info
			const distro = getDistroInfo();
			const arch = getArch();
			logger.info(`System: ${distro?.name || 'Linux'} ${distro?.version || ''} (${arch})`);
			logger.info(`Node.js: ${process.version}`);
			console.log();

			// Check prerequisites
			spinner.start('Checking prerequisites...');
			const errors = await installer.checkPrerequisites();
			if (errors.length > 0) {
				spinner.fail('Prerequisites check failed');
				errors.forEach((err) => logger.error(err));
				process.exit(1);
			}
			spinner.succeed('Prerequisites check passed');

			// Check for port conflicts
			const targetPort = parseInt(options.port, 10);
			try {
				const ssOutput = execFileSync('ss', ['-tlnp'], { encoding: 'utf-8' });
				const portInUse = ssOutput.split('\n').some((line) => line.includes(`:${targetPort} `));
				if (portInUse) {
					logger.warning(`Port ${targetPort} is already in use by another process`);
					logger.info('Use --port to specify a different port, or stop the conflicting service');
				}
			} catch {
				// Ignore - ss may not be available
			}

			// Validate admin options
			if (options.adminUsername && !options.adminPassword) {
				spinner.fail('--admin-password is required when using --admin-username');
				process.exit(1);
			}
			if (options.adminPassword && !options.adminUsername) {
				spinner.fail('--admin-username is required when using --admin-password');
				process.exit(1);
			}

			// Install
			spinner.start('Installing Smart Panel service...');

			await installer.install({
				user: options.user,
				dataDir: options.dataDir,
				port: parseInt(options.port, 10),
				noStart: !options.start,
				adminUsername: options.adminUsername,
				adminPassword: options.adminPassword,
			});

			spinner.succeed('Smart Panel service installed');

			// Show admin user creation status
			if (options.adminUsername) {
				logger.success(`Admin user '${options.adminUsername}' created`);
			}

			// Show success message
			console.log();
			logger.success('Installation complete!');
			console.log();

			if (options.start) {
				logger.info(`Smart Panel is now running on port ${options.port}`);
				logger.info(`Access the admin UI at: ${chalk.cyan(`http://localhost:${options.port}`)}`);
			} else {
				logger.info('Service installed but not started. Run:');
				logger.info(`  ${chalk.cyan('sudo smart-panel-service start')}`);
			}

			// Show first-time setup hint if admin user wasn't created
			if (!options.adminUsername) {
				console.log();
				logger.info('First-time setup:');
				console.log(chalk.gray('  Open the admin UI in your browser to create an admin account.'));
				console.log(chalk.gray('  Or run: sudo smart-panel auth:onboarding <username> <password>'));
			}

			console.log();
			logger.info('Useful commands:');
			console.log(chalk.gray('  sudo smart-panel-service status   - Check service status'));
			console.log(chalk.gray('  sudo smart-panel-service logs -f  - View live logs'));
			console.log(chalk.gray('  sudo smart-panel-service restart  - Restart the service'));
			console.log();
		} catch (error) {
			spinner.fail('Installation failed');
			logger.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// ============================================================================
// Uninstall Command
// ============================================================================
program
	.command('uninstall')
	.description('Remove the Smart Panel systemd service')
	.option('--keep-data', 'Keep the data directory')
	.option('-f, --force', 'Skip confirmation prompts')
	.action(async (options) => {
		console.log();

		if (!isRoot()) {
			logger.error('This command must be run as root. Please use sudo.');
			process.exit(1);
		}

		const installer = getInstaller();
		const spinner = ora();

		// Get installed config to show correct paths in warning
		const config = installer.getInstalledConfig();
		const dataDir = config.dataDir || '/var/lib/smart-panel';

		// Confirmation
		if (!options.force) {
			logger.warning('This will remove the Smart Panel service.');
			if (!options.keepData) {
				logger.warning(`All data in ${dataDir} will be deleted!`);
			}
			console.log();
			logger.info('Use --force to skip this confirmation, or --keep-data to preserve data.');
			console.log();

			// Simple confirmation via readline
			const readline = await import('node:readline');
			const rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			const answer = await new Promise((resolve) => {
				rl.question(chalk.yellow('Are you sure you want to continue? (yes/no): '), resolve);
			});
			rl.close();

			if (answer !== 'yes' && answer !== 'y') {
				logger.info('Uninstall cancelled.');
				process.exit(0);
			}
		}

		try {
			spinner.start('Uninstalling Smart Panel service...');

			await installer.uninstall({
				keepData: options.keepData || false,
				force: options.force || false,
			});

			spinner.succeed('Smart Panel service uninstalled');
			console.log();

			if (options.keepData) {
				logger.info(`Data directory preserved at ${dataDir}`);
			}

			logger.success('Uninstall complete!');
			console.log();
		} catch (error) {
			spinner.fail('Uninstall failed');
			logger.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// ============================================================================
// Start Command
// ============================================================================
program
	.command('start')
	.description('Start the Smart Panel service')
	.action(async () => {
		if (!isRoot()) {
			logger.error('This command must be run as root. Please use sudo.');
			process.exit(1);
		}

		const installer = getInstaller();
		const spinner = ora('Starting Smart Panel service...').start();

		try {
			await installer.start();
			spinner.succeed('Smart Panel service started');
		} catch (error) {
			spinner.fail('Failed to start service');
			logger.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// ============================================================================
// Stop Command
// ============================================================================
program
	.command('stop')
	.description('Stop the Smart Panel service')
	.action(async () => {
		if (!isRoot()) {
			logger.error('This command must be run as root. Please use sudo.');
			process.exit(1);
		}

		const installer = getInstaller();
		const spinner = ora('Stopping Smart Panel service...').start();

		try {
			await installer.stop();
			spinner.succeed('Smart Panel service stopped');
		} catch (error) {
			spinner.fail('Failed to stop service');
			logger.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// ============================================================================
// Restart Command
// ============================================================================
program
	.command('restart')
	.description('Restart the Smart Panel service')
	.action(async () => {
		if (!isRoot()) {
			logger.error('This command must be run as root. Please use sudo.');
			process.exit(1);
		}

		const installer = getInstaller();
		const spinner = ora('Restarting Smart Panel service...').start();

		try {
			await installer.restart();
			spinner.succeed('Smart Panel service restarted');
		} catch (error) {
			spinner.fail('Failed to restart service');
			logger.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// ============================================================================
// Status Command
// ============================================================================
program
	.command('status')
	.description('Show Smart Panel service status')
	.option('--json', 'Output as JSON')
	.action(async (options) => {
		const installer = getInstaller();

		try {
			const status = await installer.status();

			if (options.json) {
				console.log(JSON.stringify(status, null, 2));
				return;
			}

			console.log();
			console.log(chalk.bold('  Smart Panel Service Status'));
			console.log(chalk.gray('  ──────────────────────────'));
			console.log();

			// Installed
			console.log(
				'  Installed:',
				status.installed ? chalk.green('Yes') : chalk.red('No')
			);

			if (!status.installed) {
				console.log();
				logger.info('Service is not installed. Run: sudo smart-panel-service install');
				console.log();
				return;
			}

			// Running
			console.log(
				'  Running:  ',
				status.running ? chalk.green('Yes') : chalk.red('No')
			);

			// Enabled
			console.log(
				'  Enabled:  ',
				status.enabled ? chalk.green('Yes') : chalk.yellow('No')
			);

			// PID
			if (status.pid) {
				console.log('  PID:      ', chalk.white(status.pid));
			}

			// Uptime
			if (status.uptime !== undefined) {
				const hours = Math.floor(status.uptime / 3600);
				const minutes = Math.floor((status.uptime % 3600) / 60);
				const seconds = status.uptime % 60;
				console.log(
					'  Uptime:   ',
					chalk.white(`${hours}h ${minutes}m ${seconds}s`)
				);
			}

			// Memory
			if (status.memoryMB !== undefined) {
				console.log('  Memory:   ', chalk.white(`${status.memoryMB} MB`));
			}

			console.log();

			if (!status.running) {
				logger.info('Service is not running. Start with: sudo smart-panel-service start');
			}
			console.log();
		} catch (error) {
			logger.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// ============================================================================
// Logs Command
// ============================================================================
program
	.command('logs')
	.description('View Smart Panel service logs')
	.option('-f, --follow', 'Follow log output')
	.option('-n, --lines <n>', 'Number of lines to show', '50')
	.option('--since <time>', 'Show logs since time (e.g., "1h", "2024-01-01")')
	.action(async (options) => {
		const installer = getInstaller();

		try {
			await installer.logs({
				follow: options.follow || false,
				lines: parseInt(options.lines, 10),
				since: options.since,
			});
		} catch (error) {
			logger.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	});

// ============================================================================
// Update Command
// ============================================================================
program
	.command('update')
	.description('Update Smart Panel server to the latest version')
	.option('--version <version>', 'Update to a specific version')
	.option('--beta', 'Update to the latest beta version')
	.option('--check', 'Only check for updates without installing')
	.option('-y, --yes', 'Skip confirmation prompts')
	.action(async (options) => {
		console.log();

		const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@fastybird/smart-panel';

		// --check mode: just display version info
		if (options.check) {
			const spinner = ora('Checking for updates...').start();

			try {
				const currentVersion = packageJson.version;
				const channel = options.beta ? 'beta' : 'latest';

				const response = await fetch(NPM_REGISTRY_URL);
				const data = await response.json();
				const latestVersion = data['dist-tags']?.[channel];

				spinner.stop();

				console.log(chalk.bold('  Smart Panel Update Check'));
				console.log(chalk.gray('  ────────────────────────'));
				console.log();
				console.log('  Current version:', chalk.white(currentVersion));
				console.log('  Latest version: ', latestVersion ? chalk.white(latestVersion) : chalk.yellow('unknown'));

				if (latestVersion && compareSemver(currentVersion, latestVersion) < 0) {
					console.log();
					logger.info(`Update available! Run ${chalk.cyan('sudo smart-panel-service update')} to install.`);
				} else if (latestVersion) {
					console.log();
					logger.success('Server is up to date.');
				}

				console.log();
			} catch (error) {
				spinner.fail('Failed to check for updates');
				logger.error(error instanceof Error ? error.message : String(error));
				process.exit(1);
			}

			return;
		}

		if (!isRoot()) {
			logger.error('This command must be run as root. Please use sudo.');
			process.exit(1);
		}

		const installer = getInstaller();
		const spinner = ora();
		let wasRunning = false;

		try {
			// Check current status
			const status = await installer.status();
			wasRunning = status.running;

			if (!status.installed) {
				logger.error('Smart Panel is not installed. Run: sudo smart-panel-service install');
				process.exit(1);
			}

			// Determine package tag
			let tag = 'latest';
			let versionArg = '';

			if (options.version) {
				versionArg = `@${options.version}`;
			} else if (options.beta) {
				tag = 'beta';
				versionArg = '@beta';
			}

			// Check what version we'd update to
			const currentVersion = packageJson.version;
			let targetVersion = options.version || null;

			if (!targetVersion) {
				try {
					const response = await fetch(NPM_REGISTRY_URL);
					const data = await response.json();
					targetVersion = data['dist-tags']?.[tag];
				} catch {
					// Continue anyway
				}
			}

			if (targetVersion && targetVersion === currentVersion) {
				logger.success('Server is already up to date.');
				console.log();
				return;
			}

			logger.info(`Updating Smart Panel${targetVersion ? ` to ${targetVersion}` : ''}...`);

			// Confirmation
			if (!options.yes) {
				const readline = await import('node:readline');
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout,
				});

				const answer = await new Promise((resolve) => {
					rl.question(chalk.yellow('Do you want to proceed? (yes/no): '), resolve);
				});
				rl.close();

				if (answer !== 'yes' && answer !== 'y') {
					logger.info('Update cancelled.');
					process.exit(0);
				}
			}

			console.log();

			// Stop service if running
			if (status.running) {
				spinner.start('Stopping service...');
				await installer.stop();
				spinner.succeed('Service stopped');
			}

			// Update package
			spinner.start('Updating packages...');
			try {
				const packageSpec = `@fastybird/smart-panel${versionArg}`;
				// Use 'install' when a specific version/tag is requested, 'update' for latest
				const npmCommand = versionArg ? 'install' : 'update';
				execFileSync('npm', [npmCommand, packageSpec, '-g'], {
					stdio: 'inherit',
				});
				spinner.succeed('Packages updated');
			} catch {
				spinner.fail('Failed to update packages');
				throw new Error('npm update failed');
			}

			// Run migrations
			spinner.start('Running database migrations...');
			const config = installer.getInstalledConfig();
			const dataDir = config.dataDir || '/var/lib/smart-panel';
			await installer.runMigrations(dataDir);
			spinner.succeed('Migrations complete');

			// Start service if it was running before update
			if (wasRunning) {
				spinner.start('Starting service...');
				await installer.start();
				spinner.succeed('Service started');
			}

			console.log();
			logger.success('Update complete!');

			// Show new version
			try {
				const newPackageJson = JSON.parse(
					readFileSync(packageJsonPath, 'utf-8')
				);
				logger.info(`Current version: ${newPackageJson.version}`);
			} catch {
				// Ignore
			}

			console.log();
		} catch (error) {
			spinner.fail('Update failed');
			logger.error(error instanceof Error ? error.message : String(error));

			// Try to restart service if it was running before update
			if (wasRunning) {
				try {
					await installer.start();
					logger.info('Service restarted');
				} catch {
					logger.warning('Failed to restart service. Please start manually.');
				}
			}

			process.exit(1);
		}
	});

// ============================================================================
// Update Panel Command
// ============================================================================
program
	.command('update-panel')
	.description('Update the Smart Panel display app')
	.option('--platform <platform>', 'Panel platform: flutter-pi-armv7, flutter-pi-arm64, elinux, linux, android')
	.option('--version <version>', 'Install specific version')
	.option('--beta', 'Install latest beta release')
	.option('-d, --install-dir <dir>', 'Installation directory', '/opt/smart-panel-display')
	.option('-y, --yes', 'Skip confirmation prompts')
	.action(async (options) => {
		console.log();

		const GITHUB_API_URL = 'https://api.github.com/repos/FastyBird/smart-panel/releases';
		const DISPLAY_SERVICE = 'smart-panel-display';
		const installDir = options.installDir || '/opt/smart-panel-display';

		// Detect platform
		let platform = options.platform;

		if (!platform) {
			const arch = getArch();

			if (existsSync('/proc/device-tree/model')) {
				try {
					const model = readFileSync('/proc/device-tree/model', 'utf-8').toLowerCase();
					if (model.includes('raspberry')) {
						platform = arch === 'arm64' ? 'flutter-pi-arm64' : 'flutter-pi-armv7';
					}
				} catch {
					// Ignore
				}
			}

			if (!platform) {
				if (arch === 'arm64') {
					platform = 'flutter-pi-arm64';
				} else if (arch === 'armv7') {
					platform = 'flutter-pi-armv7';
				} else if (arch === 'x64') {
					platform = 'elinux';
				} else {
					logger.error('Could not detect platform. Use --platform to specify.');
					process.exit(1);
				}
			}
		}

		logger.info(`Platform: ${platform}`);

		// Get release info
		const spinner = ora('Checking for panel releases...').start();

		try {
			let releaseUrl = options.beta
				? `${GITHUB_API_URL}?per_page=10`
				: options.version
					? `${GITHUB_API_URL}/tags/v${options.version}`
					: `${GITHUB_API_URL}/latest`;

			const response = await fetch(releaseUrl, {
				headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'FastyBird-SmartPanel' },
			});

			if (!response.ok) {
				throw new Error(`GitHub API returned ${response.status}`);
			}

			let release;

			if (options.beta) {
				const releases = await response.json();
				release = releases.find((r) => r.prerelease);

				if (!release) {
					spinner.fail('No beta release found');
					process.exit(1);
				}
			} else {
				release = await response.json();
			}

			// Asset pattern matching
			const assetPatterns = {
				'flutter-pi-armv7': /smart-panel-display-armv7\.tar\.gz/,
				'flutter-pi-arm64': /smart-panel-display-arm64\.tar\.gz/,
				elinux: /smart-panel-display-elinux-x64\.tar\.gz/,
				linux: /smart-panel-display-linux-x64\.tar\.gz/,
				android: /smart-panel-display\.apk/,
			};

			const pattern = assetPatterns[platform];

			if (!pattern) {
				spinner.fail(`Unsupported platform: ${platform}`);
				process.exit(1);
			}

			const asset = release.assets?.find((a) => pattern.test(a.name));

			if (!asset) {
				spinner.fail(`No build found for platform '${platform}' in release ${release.tag_name}`);
				process.exit(1);
			}

			const sizeMB = (asset.size / (1024 * 1024)).toFixed(1);
			spinner.succeed(`Found: ${release.tag_name} - ${asset.name} (${sizeMB} MB)`);

			// Confirmation
			if (!options.yes) {
				const readline = await import('node:readline');
				const rl = readline.createInterface({
					input: process.stdin,
					output: process.stdout,
				});

				const answer = await new Promise((resolve) => {
					rl.question(chalk.yellow(`Update panel (${platform}) to ${release.tag_name}? (yes/no): `), resolve);
				});
				rl.close();

				if (answer !== 'yes' && answer !== 'y') {
					logger.info('Update cancelled.');
					process.exit(0);
				}
			}

			if (platform === 'android') {
				// Android: download and install via ADB
				try {
					execFileSync('which', ['adb'], { stdio: 'pipe' });
				} catch {
					logger.error('ADB is required. Install with: apt-get install android-tools-adb');
					process.exit(1);
				}

				const tmpFile = '/tmp/smart-panel-display.apk';
				const dlSpinner = ora('Downloading APK...').start();

				const dlResponse = await fetch(asset.browser_download_url, {
					headers: { 'User-Agent': 'FastyBird-SmartPanel' },
					redirect: 'follow',
				});

				if (!dlResponse.ok || !dlResponse.body) {
					dlSpinner.fail('Download failed');
					process.exit(1);
				}

				const { createWriteStream: cws } = await import('node:fs');
				const { Readable } = await import('node:stream');
				const { pipeline } = await import('node:stream/promises');
				const fileStream = cws(tmpFile);
				const nodeStream = Readable.fromWeb(dlResponse.body);
				await pipeline(nodeStream, fileStream);
				dlSpinner.succeed('Downloaded');

				const installSpinner = ora('Installing via ADB...').start();
				execFileSync('adb', ['install', '-r', tmpFile], { stdio: 'inherit' });
				installSpinner.succeed('APK installed');

				try { execFileSync('rm', ['-f', tmpFile], { stdio: 'pipe' }); } catch {}
			} else {
				// Linux platforms: stop service, download, extract, restart
				if (!isRoot()) {
					logger.error('This command must be run as root. Please use sudo.');
					process.exit(1);
				}

				// Stop display service
				const stopSpinner = ora('Stopping display service...').start();
				try {
					execFileSync('systemctl', ['stop', DISPLAY_SERVICE], { stdio: 'pipe' });
					stopSpinner.succeed('Display service stopped');
				} catch {
					stopSpinner.warn('Display service not running');
				}

				// Download
				const dlSpinner = ora(`Downloading ${asset.name}...`).start();
				const tmpFile = `/tmp/${asset.name}`;

				const dlResponse = await fetch(asset.browser_download_url, {
					headers: { 'User-Agent': 'FastyBird-SmartPanel' },
					redirect: 'follow',
				});

				if (!dlResponse.ok || !dlResponse.body) {
					dlSpinner.fail('Download failed');
					// Try to restart
					try { execFileSync('systemctl', ['start', DISPLAY_SERVICE], { stdio: 'pipe' }); } catch {}
					process.exit(1);
				}

				const { createWriteStream: cws } = await import('node:fs');
				const { Readable } = await import('node:stream');
				const { pipeline } = await import('node:stream/promises');
				const fileStream = cws(tmpFile);
				const nodeStream = Readable.fromWeb(dlResponse.body);
				await pipeline(nodeStream, fileStream);
				dlSpinner.succeed('Downloaded');

				// Extract
				const extractSpinner = ora('Extracting...').start();
				execFileSync('mkdir', ['-p', installDir], { stdio: 'pipe' });
				execFileSync('tar', ['-xzf', tmpFile, '-C', installDir], { stdio: 'pipe' });

				// Make binary executable
				try {
					execFileSync('chmod', ['+x', join(installDir, 'fastybird_smart_panel')], { stdio: 'pipe' });
				} catch {}

				extractSpinner.succeed('Extracted');

				// Cleanup
				try { execFileSync('rm', ['-f', tmpFile], { stdio: 'pipe' }); } catch {}

				// Start display service
				const startSpinner = ora('Starting display service...').start();
				try {
					execFileSync('systemctl', ['start', DISPLAY_SERVICE], { stdio: 'pipe' });
					startSpinner.succeed('Display service started');
				} catch {
					startSpinner.warn('Could not start display service. Start manually: sudo systemctl start ' + DISPLAY_SERVICE);
				}
			}

			console.log();
			logger.success(`Panel (${platform}) updated to ${release.tag_name}!`);
			console.log();
		} catch (error) {
			spinner.fail('Update failed');
			logger.error(error instanceof Error ? error.message : String(error));
			// Try to restart display service if it was stopped before the failure
			try { execFileSync('systemctl', ['start', DISPLAY_SERVICE], { stdio: 'pipe' }); } catch {}
			process.exit(1);
		}
	});

// ============================================================================
// Doctor Command
// ============================================================================
program
	.command('doctor')
	.description('Diagnose system health and check for common issues')
	.action(async () => {
		console.log();
		console.log(chalk.bold.cyan('  Smart Panel Doctor'));
		console.log(chalk.gray('  ──────────────────'));
		console.log();

		const installer = getInstaller();
		let issues = 0;
		let warnings = 0;

		const ok = (msg) => console.log(`  ${chalk.green('✓')} ${msg}`);
		const warn = (msg) => { console.log(`  ${chalk.yellow('!')} ${msg}`); warnings++; };
		const fail = (msg) => { console.log(`  ${chalk.red('✗')} ${msg}`); issues++; };
		const info = (msg) => console.log(`    ${chalk.gray(msg)}`);

		// 1. OS & Architecture
		console.log(chalk.bold('  System'));
		const distro = getDistroInfo();
		const arch = getArch();
		ok(`OS: ${distro?.name || 'Linux'} ${distro?.version || ''} (${arch})`);

		if (process.platform !== 'linux') {
			fail('Only Linux is supported');
		} else {
			ok('Platform: Linux');
		}

		// 2. Systemd
		if (hasSystemd()) {
			ok('systemd: available');
		} else {
			fail('systemd: not detected');
			info('Smart Panel requires systemd for service management');
		}

		// 3. Node.js version
		console.log();
		console.log(chalk.bold('  Node.js'));
		const nodeVersion = process.versions.node;
		const nodeMajor = parseInt(nodeVersion.split('.')[0], 10);

		if (nodeMajor >= 20) {
			ok(`Node.js: v${nodeVersion} (>= 20 required)`);
		} else {
			fail(`Node.js: v${nodeVersion} (>= 20 required)`);
			info('Update Node.js: https://nodejs.org/en/download/');
		}

		// 4. Disk space
		console.log();
		console.log(chalk.bold('  Disk Space'));
		try {
			const dfOutput = execFileSync('df', ['-BM', '/var/lib'], { encoding: 'utf-8' });
			const lines = dfOutput.trim().split('\n');
			if (lines.length >= 2) {
				const parts = lines[1].split(/\s+/);
				const availMB = parseInt(parts[3], 10);
				if (availMB >= 500) {
					ok(`Available: ${availMB} MB (>= 500 MB recommended)`);
				} else if (availMB >= 200) {
					warn(`Available: ${availMB} MB (>= 500 MB recommended)`);
					info('Low disk space may cause issues during updates');
				} else {
					fail(`Available: ${availMB} MB (>= 500 MB recommended)`);
					info('Insufficient disk space for reliable operation');
				}
			}
		} catch {
			warn('Could not check disk space');
		}

		// 5. Port check
		console.log();
		console.log(chalk.bold('  Network'));
		const config = installer.getInstalledConfig();
		const port = 3000; // Default port

		try {
			const envFile = '/etc/smart-panel/environment';
			if (existsSync(envFile)) {
				const envContent = readFileSync(envFile, 'utf-8');
				const portMatch = envContent.match(/FB_BACKEND_PORT=(\d+)/);
				if (portMatch) {
					const configuredPort = parseInt(portMatch[1], 10);
					try {
						const ssOutput = execFileSync('ss', ['-tlnp'], { encoding: 'utf-8' });
						const portInUse = ssOutput.split('\n').some((line) =>
							line.includes(`:${configuredPort} `) && !line.includes('smart-panel') && !line.includes('node')
						);
						if (portInUse) {
							warn(`Port ${configuredPort}: in use by another process`);
							info('Another application may conflict with Smart Panel');
						} else {
							ok(`Port ${configuredPort}: available`);
						}
					} catch {
						warn(`Port ${configuredPort}: could not verify`);
					}
				}
			} else {
				// Check default port
				try {
					const ssOutput = execFileSync('ss', ['-tlnp'], { encoding: 'utf-8' });
					const portInUse = ssOutput.split('\n').some((line) => line.includes(`:${port} `));
					if (portInUse) {
						warn(`Port ${port} (default): already in use`);
						info('Use --port flag during install to use a different port');
					} else {
						ok(`Port ${port} (default): available`);
					}
				} catch {
					warn('Could not check port availability');
				}
			}
		} catch {
			warn('Could not check network configuration');
		}

		// 6. Service status
		console.log();
		console.log(chalk.bold('  Service'));
		try {
			const status = await installer.status();

			if (status.installed) {
				ok('Installed: yes');

				if (status.running) {
					ok('Running: yes');
					if (status.uptime !== undefined) {
						const hours = Math.floor(status.uptime / 3600);
						const minutes = Math.floor((status.uptime % 3600) / 60);
						ok(`Uptime: ${hours}h ${minutes}m`);
					}
					if (status.memoryMB !== undefined) {
						if (status.memoryMB > 512) {
							warn(`Memory: ${status.memoryMB} MB (high usage)`);
						} else {
							ok(`Memory: ${status.memoryMB} MB`);
						}
					}
				} else {
					warn('Running: no');
					info('Start with: sudo smart-panel-service start');
				}

				if (status.enabled) {
					ok('Auto-start: enabled');
				} else {
					warn('Auto-start: disabled');
					info('Enable with: sudo systemctl enable smart-panel');
				}
			} else {
				warn('Service not installed');
				info('Install with: sudo smart-panel-service install');
			}
		} catch {
			warn('Could not check service status');
		}

		// 7. Data directory permissions
		console.log();
		console.log(chalk.bold('  Data'));
		const dataDir = config?.dataDir || '/var/lib/smart-panel';
		if (existsSync(dataDir)) {
			ok(`Data directory: ${dataDir}`);

			const dbPath = join(dataDir, 'data');
			if (existsSync(dbPath)) {
				ok('Database directory exists');
			} else {
				warn('Database directory missing');
			}

			const configPath = join(dataDir, 'config');
			if (existsSync(configPath)) {
				ok('Config directory exists');
			} else {
				warn('Config directory missing');
			}
		} else {
			warn(`Data directory not found: ${dataDir}`);
			info('This is normal before first installation');
		}

		// Summary
		console.log();
		console.log(chalk.gray('  ──────────────────'));

		if (issues === 0 && warnings === 0) {
			console.log(`  ${chalk.green.bold('All checks passed!')}`);
		} else if (issues === 0) {
			console.log(`  ${chalk.yellow.bold(`${warnings} warning(s), no critical issues`)}`);
		} else {
			console.log(`  ${chalk.red.bold(`${issues} issue(s)`)}${warnings > 0 ? chalk.yellow(`, ${warnings} warning(s)`) : ''}`);
		}

		console.log();

		process.exit(issues > 0 ? 1 : 0);
	});

// Parse and run
program.parse();
