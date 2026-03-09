import { execFileSync } from 'child_process';
import inquirer from 'inquirer';
import { Command, CommandRunner, Option } from 'nest-commander';

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

		console.log('\n\x1b[36m  FastyBird Smart Panel - Server Update\x1b[0m');
		console.log('\x1b[90m  ──────────────────────────────────────\x1b[0m\n');

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

				if (!skipConfirm) {
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
				} else {
					console.log('  Update cancelled. Use --allow-major to allow major updates.\n');

					return;
				}
			}
		} else {
			console.log(`  Target version:   \x1b[37m${targetVersion}\x1b[0m`);
		}

		// Confirmation
		if (!skipConfirm) {
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

		// Restart the service
		if (!skipRestart) {
			this.restartService();
		}

		console.log(`\n  \x1b[32m✓\x1b[0m Server updated to version \x1b[1m${targetVersion}\x1b[0m\n`);

		this.logger.log(`Server updated to version ${targetVersion}`);
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
