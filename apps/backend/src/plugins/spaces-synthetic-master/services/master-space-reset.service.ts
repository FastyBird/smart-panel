import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SPACES_SYNTHETIC_MASTER_PLUGIN_NAME } from '../spaces-synthetic-master.constants';

import { MasterSpaceSeederService } from './master-space-seeder.service';

/**
 * Factory-reset handler for the master synthetic space.
 *
 * The core spaces module's reset handler (priority 280) clears every row
 * from `spaces_module_spaces` including the singleton master row. This
 * service re-registers with a higher priority so it runs after the clear
 * and re-seeds the master space, preserving the invariant that exactly
 * one master space always exists while this plugin is installed.
 */
@Injectable()
export class MasterSpaceResetService {
	private readonly logger = createExtensionLogger(SPACES_SYNTHETIC_MASTER_PLUGIN_NAME, 'MasterSpaceResetService');

	constructor(private readonly seeder: MasterSpaceSeederService) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.seeder.seed();

			this.logger.log('[RESET] Master space re-seeded after factory reset');

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Failed to re-seed master space: ${err.message}`, err.stack);

			return { success: false, reason: err.message };
		}
	}
}
