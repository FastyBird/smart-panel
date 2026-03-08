import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { BUDDY_MODULE_NAME } from '../buddy.constants';
import { ISttProvider } from '../platforms/stt-provider.platform';

@Injectable()
export class SttProviderRegistryService {
	private readonly logger = createExtensionLogger(BUDDY_MODULE_NAME, 'SttProviderRegistryService');

	private readonly providers = new Map<string, ISttProvider>();

	/**
	 * Register an STT provider implementation
	 * @param provider The STT provider to register
	 * @returns true if registration succeeded, false if provider type already exists
	 */
	register(provider: ISttProvider): boolean {
		const type = provider.getType();

		if (this.providers.has(type)) {
			this.logger.warn(`STT provider '${type}' is already registered, skipping`);

			return false;
		}

		this.providers.set(type, provider);

		this.logger.log(`STT provider '${type}' added. Total providers: ${this.providers.size}`);

		return true;
	}

	/**
	 * Get an STT provider by type
	 * @param type The provider type identifier
	 * @returns The STT provider or null if not found
	 */
	get(type: string): ISttProvider | null {
		return this.providers.get(type) ?? null;
	}

	/**
	 * List all registered provider types
	 * @returns Array of provider type identifiers
	 */
	list(): string[] {
		return [...this.providers.keys()];
	}
}
