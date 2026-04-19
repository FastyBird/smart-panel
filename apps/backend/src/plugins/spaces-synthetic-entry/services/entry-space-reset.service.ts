import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME } from '../spaces-synthetic-entry.constants';

import { EntrySpaceSeederService } from './entry-space-seeder.service';

/**
 * Factory-reset handler for the entry synthetic space.
 *
 * The core spaces module's reset handler (priority 280) clears every row
 * from `spaces_module_spaces` including the singleton entry row. This
 * service re-registers with a higher priority so it runs after the clear
 * and re-seeds the entry space, preserving the invariant that exactly
 * one entry space always exists while this plugin is installed.
 */
@Injectable()
export class EntrySpaceResetService {
	private readonly logger = createExtensionLogger(SPACES_SYNTHETIC_ENTRY_PLUGIN_NAME, 'EntrySpaceResetService');

	constructor(private readonly seeder: EntrySpaceSeederService) {}

	async reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			await this.seeder.seed();

			this.logger.log('[RESET] Entry space re-seeded after factory reset');

			return { success: true };
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[RESET] Failed to re-seed entry space: ${err.message}`, err.stack);

			return { success: false, reason: err.message };
		}
	}
}
