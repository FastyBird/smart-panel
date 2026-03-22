import { execFileSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync, unlinkSync } from 'fs';
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { UpdateService } from '../services/update.service';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { printError, printStep, printSuccess, printWarning } from './command.utils';

interface UpdateServerOptions {
	version?: string;
	channel?: string;
	yes?: boolean;
	allowMajor?: boolean;
	skipRestart?: boolean;
}

@Command({
	name: 'system:update:server',
	description: 'Update the server application (backend + admin) to the latest version',
})
@Injectable()
export class UpdateServerCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateServerCommand');

	constructor(private readonly updateService: UpdateService) {
		super();
	}

	async run(_passedParams: string[], options?: UpdateServerOptions): Promise<void> {
		const channel = (options?.channel as 'latest' | 'beta' | 'alpha') || 'latest';
		const skipConfirm = options?.yes ?? false;
		const allowMajor = options?.allowMajor ?? false;
		const skipRestart = options?.skipRestart ?? false;
		let majorConfirmed = false;

		const installType = this.updateService.getInstallType();

		console.log('\n\x1b[36m  FastyBird Smart Panel - Server Update\x1b[0m');
		console.log('\x1b[90m  ──────────────────────────────────────\x1b[0m\n');
		console.log(`  Install type:     \x1b[37m${installType}\x1b[0m`);

		// Check for updates
		let targetVersion = options?.version;

		if (!targetVersion) {
			console.log('  Checking for updates...\n');

			const info = await this.updateService.checkServerUpdate(channel);

			console.log(`  Current version:  \x1b[37m${info.current}\x1b[0m`);

			if (!info.updateAvailable || !info.latest) {
				console.log('\n  \x1b[32m✓\x1b[0m Server is already up to date.\n');

				return;
			}

			targetVersion = info.latest;

			const typeColor =
				info.updateType === 'major' ? '\x1b[31m' : info.updateType === 'minor' ? '\x1b[33m' : '\x1b[32m';

			console.log(`  Available version: ${typeColor}${targetVersion}\x1b[0m (${info.updateType})`);

			// Warn about major updates
			if (info.updateType === 'major' && !allowMajor) {
				console.log('\n  \x1b[31m⚠\x1b[0m  This is a \x1b[1mmajor version update\x1b[0m.');
				console.log('     Major updates may contain breaking changes.');
				console.log('     Use \x1b[36m--allow-major\x1b[0m to proceed.\n');

				if (!skipConfirm && !majorConfirmed) {
					const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
						{
							type: 'confirm',
							name: 'proceed',
							message: 'Do you want to proceed with the major version update?',
							default: false,
						},
					]);

					if (!proceed) {
						console.log('\n  Update cancelled.\n');

						return;
					}

					majorConfirmed = true;
				} else {
					console.log('  Update cancelled. Use --allow-major to allow major updates.\n');

					return;
				}
			}
		} else {
			console.log(`  Target version:   \x1b[37m${targetVersion}\x1b[0m`);
		}

		// Confirmation (skip if user already confirmed the major update prompt)
		if (!skipConfirm && !majorConfirmed) {
			console.log();

			const { proceed } = await inquirer.prompt<{ proceed: boolean }>([
				{
					type: 'confirm',
					name: 'proceed',
					message: `Update server to version ${targetVersion}?`,
					default: true,
				},
			]);

			if (!proceed) {
				console.log('\n  Update cancelled.\n');

				return;
			}
		}

		console.log();

		if (installType === 'image') {
			await this.updateImage(targetVersion, skipRestart);
		} else {
			this.updateNpm(targetVersion, skipRestart);
		}

		console.log(`\n  \x1b[32m✓\x1b[0m Server updated to version \x1b[1m${targetVersion}\x1b[0m\n`);

		this.logger.log(`Server updated to version ${targetVersion} (${installType})`);
	}

	private updateNpm(targetVersion: string, skipRestart: boolean): void {
		// Stop the service
		if (!skipRestart) {
			printStep('Stopping service...');

			try {
				execFileSync('systemctl', ['stop', 'smart-panel'], { stdio: 'pipe' });
				printSuccess('Service stopped');
			} catch {
				printWarning('Could not stop service (may not be running as systemd service)');
			}
		}

		// Install the update via npm
		printStep('Installing update...');

		try {
			const packageSpec = `@fastybird/smart-panel@${targetVersion}`;

			execFileSync('npm', ['install', '-g', packageSpec], { stdio: 'inherit' });

			printSuccess('Package updated');
		} catch (error) {
			const err = error as Error;

			printError(`Failed to install update: ${err.message}`);
			this.logger.error(`Server update failed during npm install: ${err.message}`);

			// Try to restart if we stopped it
			if (!skipRestart) {
				this.restartService();
			}

			process.exit(1);
		}

		// Run database migrations
		this.runNpmMigrations();

		// Restart the service
		if (!skipRestart) {
			this.restartService();
		}
	}

	private async updateImage(targetVersion: string, skipRestart: boolean): Promise<void> {
		const baseDir = this.updateService.getImageBaseDir();
		const newVersionDir = `${baseDir}/v${targetVersion}`;
		const currentLink = `${baseDir}/current`;

		// Guard: refuse to overwrite the currently running version
		try {
			const currentTarget = execFileSync('readlink', ['-f', currentLink], { encoding: 'utf-8' }).trim();
			const resolvedNew = execFileSync('readlink', ['-f', newVersionDir], { encoding: 'utf-8' }).trim();

			if (currentTarget === resolvedNew) {
				printError(`Target version v${targetVersion} is already the active version`);
				process.exit(1);
			}
		} catch {
			// newVersionDir doesn't exist yet — safe to proceed
		}

		// Fetch the release asset download URL
		printStep('Fetching release information...');

		const asset = await this.updateService.fetchServerReleaseAsset(targetVersion);

		if (!asset) {
			printError(`No backend release artifact found for version ${targetVersion}`);
			process.exit(1);
		}

		const sizeMB = (asset.size / (1024 * 1024)).toFixed(1);

		printSuccess(`Found ${asset.name} (${sizeMB} MB)`);

		// Download the tarball
		printStep(`Downloading ${asset.name}...`);

		const tmpFile = `/tmp/${asset.name}`;

		try {
			const response = await fetch(asset.downloadUrl, {
				headers: { 'User-Agent': 'FastyBird-SmartPanel' },
				redirect: 'follow',
			});

			if (!response.ok || !response.body) {
				throw new Error(`Download failed: HTTP ${response.status}`);
			}

			const fileStream = createWriteStream(tmpFile);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			const nodeStream = Readable.fromWeb(response.body as any);

			await pipeline(nodeStream, fileStream);

			printSuccess('Download complete');
		} catch (error) {
			const err = error as Error;

			printError(`Download failed: ${err.message}`);

			try {
				unlinkSync(tmpFile);
			} catch {
				// Ignore
			}

			process.exit(1);
		}

		// Extract the archive
		printStep('Extracting update...');

		try {
			mkdirSync(newVersionDir, { recursive: true });
			execFileSync('tar', ['-xzf', tmpFile, '-C', newVersionDir], { stdio: 'pipe' });

			// Create image-install marker
			execFileSync('touch', [`${newVersionDir}/.image-install`], { stdio: 'pipe' });

			printSuccess('Extraction complete');
		} catch (error) {
			const err = error as Error;

			printError(`Extraction failed: ${err.message}`);
			rmSync(newVersionDir, { recursive: true, force: true });

			try {
				unlinkSync(tmpFile);
			} catch {
				// Ignore
			}

			process.exit(1);
		}

		try {
			unlinkSync(tmpFile);
		} catch {
			// Ignore
		}

		// Install production dependencies
		printStep('Installing dependencies...');

		try {
			execFileSync('pnpm', ['install', '--prod', '--ignore-scripts'], {
				cwd: newVersionDir,
				stdio: 'inherit',
			});

			printSuccess('Dependencies installed');
		} catch (error) {
			const err = error as Error;

			printError(`Dependency install failed: ${err.message}`);
			rmSync(newVersionDir, { recursive: true, force: true });
			process.exit(1);
		}

		// Rebuild native modules
		printStep('Rebuilding native modules...');

		try {
			if (existsSync(`${baseDir}/rebuild-native.sh`)) {
				execFileSync('bash', [`${baseDir}/rebuild-native.sh`, newVersionDir], { stdio: 'inherit' });
				printSuccess('Native modules rebuilt');
			} else {
				printWarning('rebuild-native.sh not found, skipping native module rebuild');
			}
		} catch (error) {
			const err = error as Error;

			printError(`Native module rebuild failed: ${err.message}`);
			rmSync(newVersionDir, { recursive: true, force: true });
			process.exit(1);
		}

		// Set ownership
		try {
			execFileSync('chown', ['-R', 'smart-panel:smart-panel', newVersionDir], { stdio: 'pipe' });
		} catch {
			printWarning('Could not set ownership (may need root)');
		}

		// Stop service
		if (!skipRestart) {
			printStep('Stopping service...');

			try {
				execFileSync('systemctl', ['stop', 'smart-panel'], { stdio: 'pipe' });
				printSuccess('Service stopped');
			} catch {
				printWarning('Could not stop service (may not be running)');
			}
		}

		// Switch symlink
		printStep('Switching to new version...');

		// Save previous target for rollback
		let previousTarget: string | null = null;

		try {
			previousTarget = execFileSync('readlink', [currentLink], { encoding: 'utf-8' }).trim();
		} catch {
			// No previous symlink
		}

		try {
			execFileSync('ln', ['-sfn', newVersionDir, currentLink], { stdio: 'pipe' });
			printSuccess(`Symlink updated: current -> v${targetVersion}`);
		} catch (error) {
			const err = error as Error;

			printError(`Failed to switch symlink: ${err.message}`);

			if (previousTarget) {
				try {
					execFileSync('ln', ['-sfn', previousTarget, currentLink], { stdio: 'pipe' });
				} catch {
					// Ignore
				}
			}

			if (!skipRestart) {
				this.restartService();
			}

			process.exit(1);
		}

		// Run database migrations
		printStep('Running database migrations...');

		try {
			const envFile = '/etc/smart-panel/environment';

			execFileSync(
				'bash',
				[
					'-c',
					`set -a; [ -f ${envFile} ] && . ${envFile}; set +a && cd ${newVersionDir} && node node_modules/typeorm/cli.js migration:run -d dist/dataSource.js`,
				],
				{ stdio: 'inherit' },
			);

			printSuccess('Migrations complete');
		} catch (error) {
			const err = error as Error;

			printWarning(`Migration warning: ${err.message}`);
			this.logger.warn(`Migration had issues during image update: ${err.message}`);

			// Revert on migration failure
			printStep('Reverting to previous version...');

			if (previousTarget) {
				try {
					execFileSync('ln', ['-sfn', previousTarget, currentLink], { stdio: 'pipe' });
					printWarning('Reverted to previous version due to migration failure');
				} catch {
					printError('Failed to revert symlink!');
				}

				rmSync(newVersionDir, { recursive: true, force: true });
			} else {
				// No previous version to revert to — keep the new version in place
				// so the system remains bootable, even with a failed migration
				printWarning('No previous version to revert to — keeping current version');
			}

			if (!skipRestart) {
				this.restartService();
			}

			process.exit(1);
		}

		// Restart the service
		if (!skipRestart) {
			this.restartService();
		}

		// Clean up old versions (keep max 2 previous)
		this.cleanupOldVersions(baseDir, `v${targetVersion}`);
	}

	private cleanupOldVersions(baseDir: string, currentVersion: string): void {
		try {
			const versions = this.updateService.getInstalledVersions();

			if (versions.length <= 3) {
				return;
			}

			// Remove all but the 3 newest (current + 2 previous)
			const toRemove = versions.slice(0, versions.length - 3);

			for (const version of toRemove) {
				const dir = `${baseDir}/v${version}`;

				if (`v${version}` !== currentVersion) {
					printStep(`Removing old version v${version}...`);
					rmSync(dir, { recursive: true, force: true });
					printSuccess(`Removed v${version}`);
				}
			}
		} catch (error) {
			const err = error as Error;

			printWarning(`Could not clean up old versions: ${err.message}`);
		}
	}

	private runNpmMigrations(): void {
		printStep('Running database migrations...');

		try {
			const dataDir = process.env.FB_DB_PATH || process.env.FB_DATA_DIR || '/var/lib/smart-panel';

			execFileSync(
				'node',
				[require.resolve('typeorm/cli'), 'migration:run', '-d', require.resolve('../../../../dataSource')],
				{
					env: {
						...process.env,
						FB_DB_PATH: dataDir.endsWith('/data') ? dataDir : `${dataDir}/data`,
						NODE_ENV: 'production',
					},
					stdio: 'inherit',
				},
			);

			printSuccess('Migrations complete');
		} catch (error) {
			const err = error as Error;

			printWarning(`Migration warning: ${err.message}`);
			this.logger.warn(`Migration had issues: ${err.message}`);
		}
	}

	@Option({
		flags: '-v, --version <version>',
		description: 'Update to a specific version',
	})
	parseVersion(val: string): string {
		return val;
	}

	@Option({
		flags: '-c, --channel <channel>',
		description: 'Release channel (latest, beta, alpha)',
		defaultValue: 'latest',
	})
	parseChannel(val: string): string {
		const allowed = ['latest', 'beta', 'alpha'];

		if (!allowed.includes(val)) {
			console.error(`\x1b[31m❌ Invalid channel: ${val}. Allowed: ${allowed.join(', ')}\x1b[0m`);
			process.exit(1);
		}

		return val;
	}

	@Option({
		flags: '-y, --yes',
		description: 'Skip confirmation prompts',
		defaultValue: false,
	})
	parseYes(): boolean {
		return true;
	}

	@Option({
		flags: '--allow-major',
		description: 'Allow major version updates',
		defaultValue: false,
	})
	parseAllowMajor(): boolean {
		return true;
	}

	@Option({
		flags: '--skip-restart',
		description: 'Do not restart the service after update',
		defaultValue: false,
	})
	parseSkipRestart(): boolean {
		return true;
	}

	private restartService(): void {
		printStep('Starting service...');

		try {
			execFileSync('systemctl', ['start', 'smart-panel'], { stdio: 'pipe' });
			printSuccess('Service started');
		} catch {
			printWarning('Could not start service. Start manually: sudo systemctl start smart-panel');
		}
	}
}
