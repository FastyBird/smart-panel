import { Injectable, Logger } from '@nestjs/common';

import { ExtensionsBundledService } from './extensions-bundled.service';
import { clearDiscoveryCache } from './extensions-discovery-cache';

@Injectable()
export class ModuleResetService {
	private readonly logger = new Logger(ModuleResetService.name);

	constructor(private readonly bundledService: ExtensionsBundledService) {}

	reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			this.logger.debug(`[RESET] Resetting extensions module caches`);

			// Clear the discovery cache to force re-discovery of extensions
			clearDiscoveryCache();

			// Clear the bundled manifest cache
			this.bundledService.clearCache();

			this.logger.log('[RESET] Extensions module caches were successfully reset');

			return Promise.resolve({ success: true });
		} catch (error) {
			const err = error as Error;

			this.logger.error('[RESET] Failed to reset extensions module', { message: err.message, stack: err.stack });

			return Promise.resolve({ success: false, reason: error instanceof Error ? error.message : 'Unknown error' });
		}
	}
}
