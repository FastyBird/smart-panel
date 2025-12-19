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
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import from compiled dist
const distPath = join(__dirname, '..', 'dist');
const { getInstaller } = await import(join(distPath, 'installers', 'index.js'));
const { logger, isRoot, hasSystemd, getArch, getDistroInfo } = await import(join(distPath, 'utils', 'index.js'));

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

			// Install
			spinner.start('Installing Smart Panel service...');

			await installer.install({
				user: options.user,
				dataDir: options.dataDir,
				port: parseInt(options.port, 10),
				noStart: !options.start,
			});

			spinner.succeed('Smart Panel service installed');

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

		// Confirmation
		if (!options.force) {
			logger.warning('This will remove the Smart Panel service.');
			if (!options.keepData) {
				logger.warning('All data in /var/lib/smart-panel will be deleted!');
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
				logger.info('Data directory preserved at /var/lib/smart-panel');
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
	.description('Update Smart Panel to the latest version')
	.option('--version <version>', 'Update to a specific version')
	.option('--beta', 'Update to the latest beta version')
	.action(async (options) => {
		console.log();

		if (!isRoot()) {
			logger.error('This command must be run as root. Please use sudo.');
			process.exit(1);
		}

		const installer = getInstaller();
		const spinner = ora();

		try {
			// Check current status
			const status = await installer.status();

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

			logger.info(`Updating Smart Panel${versionArg ? ` to ${versionArg}` : ''}...`);
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
				execSync(`npm update @fastybird/smart-panel${versionArg} -g`, {
					stdio: 'inherit',
				});
				spinner.succeed('Packages updated');
			} catch {
				spinner.fail('Failed to update packages');
				throw new Error('npm update failed');
			}

			// Run migrations
			spinner.start('Running database migrations...');
			await installer.runMigrations('/var/lib/smart-panel');
			spinner.succeed('Migrations complete');

			// Start service
			spinner.start('Starting service...');
			await installer.start();
			spinner.succeed('Service started');

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

			// Try to restart service if it was running
			try {
				await installer.start();
				logger.info('Service restarted');
			} catch {
				logger.warning('Failed to restart service. Please start manually.');
			}

			process.exit(1);
		}
	});

// Parse and run
program.parse();
