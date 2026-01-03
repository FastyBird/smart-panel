import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { EXTENSIONS_MODULE_NAME } from '../extensions.constants';

import { ExtensionsBundledService } from './extensions-bundled.service';
import { clearDiscoveryCache } from './extensions-discovery-cache';

@Injectable()
export class ModuleResetService {
	private readonly logger = createExtensionLogger(EXTENSIONS_MODULE_NAME, 'ModuleResetService');

	constructor(private readonly bundledService: ExtensionsBundledService) {}

	reset(): Promise<{ success: boolean; reason?: string }> {
		try {
			// Clear the discovery cache to force re-discovery of extensions
			clearDiscoveryCache();

			// Clear the bundled manifest cache
			this.bundledService.clearCache();

			this.logger.log('Extensions module caches were successfully reset');

			return Promise.resolve({ success: true });
		} catch (error) {
			const err = error as Error;

			this.logger.error('Failed to reset extensions module', { message: err.message, stack: err.stack });

			return Promise.resolve({ success: false, reason: error instanceof Error ? error.message : 'Unknown error' });
		}
	}
}
