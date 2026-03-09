import { Command, CommandRunner, Option } from 'nest-commander';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SYSTEM_MODULE_NAME } from '../system.constants';

import { UpdateService } from '../services/update.service';

interface UpdateCheckOptions {
	channel?: string;
	panel?: boolean;
}

@Command({
	name: 'system:update:check',
	description: 'Check for available updates for server and panel apps',
})
@Injectable()
export class UpdateCheckCommand extends CommandRunner {
	private readonly logger = createExtensionLogger(SYSTEM_MODULE_NAME, 'UpdateCheckCommand');

	constructor(private readonly updateService: UpdateService) {
		super();
	}

	async run(_passedParams: string[], options?: UpdateCheckOptions): Promise<void> {
		const channel = (options?.channel as 'latest' | 'beta' | 'alpha') || 'latest';
		const checkPanel = options?.panel ?? true;

		console.log('\n\x1b[36m  FastyBird Smart Panel - Update Check\x1b[0m');
		console.log('\x1b[90m  ─────────────────────────────────────\x1b[0m\n');

		// Check server updates
		console.log('\x1b[1m  Server (Backend + Admin)\x1b[0m\n');

		const serverInfo = await this.updateService.checkServerUpdate(channel);

		console.log(`  Current version:  \x1b[37m${serverInfo.current}\x1b[0m`);

		if (serverInfo.latest) {
			console.log(`  Latest version:   \x1b[37m${serverInfo.latest}\x1b[0m`);

			if (serverInfo.updateAvailable) {
				const typeColor =
					serverInfo.updateType === 'major' ? '\x1b[31m' : serverInfo.updateType === 'minor' ? '\x1b[33m' : '\x1b[32m';
				console.log(`  Update type:      ${typeColor}${serverInfo.updateType}\x1b[0m`);
				console.log(`\n  \x1b[32m✓\x1b[0m Update available! Run \x1b[36msystem:update:server\x1b[0m to install.`);
			} else {
				console.log('\n  \x1b[32m✓\x1b[0m Server is up to date.');
			}
		} else {
			console.log('  Latest version:   \x1b[33munable to check\x1b[0m');
		}

		// Check panel updates
		if (checkPanel) {
			console.log('\n\x1b[1m  Panel (Display App)\x1b[0m\n');

			const panelInfo = await this.updateService.checkPanelUpdate(channel !== 'latest');

			if (panelInfo.latest) {
				console.log(`  Latest release:   \x1b[37m${panelInfo.latest}\x1b[0m`);

				if (panelInfo.assets.length > 0) {
					console.log('  Available builds:');

					for (const asset of panelInfo.assets) {
						const sizeMB = (asset.size / (1024 * 1024)).toFixed(1);

						console.log(`    \x1b[90m•\x1b[0m ${asset.name} \x1b[90m(${sizeMB} MB)\x1b[0m`);
					}

					console.log(`\n  Run \x1b[36msystem:update:panel\x1b[0m to update the display app.`);
				} else {
					console.log('  \x1b[33m!\x1b[0m No panel builds found in this release.');
				}
			} else {
				console.log('  Latest release:   \x1b[33munable to check\x1b[0m');
			}
		}

		console.log();

		this.logger.log('Update check completed');
	}

	@Option({
		flags: '-c, --channel <channel>',
		description: 'Release channel to check (latest, beta, alpha)',
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
		flags: '--no-panel',
		description: 'Skip checking panel updates',
		defaultValue: true,
	})
	parsePanel(val: boolean): boolean {
		return val;
	}
}
