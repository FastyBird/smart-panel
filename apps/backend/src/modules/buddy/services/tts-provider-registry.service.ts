import { Injectable, Logger } from '@nestjs/common';

import { ITtsProvider } from '../platforms/tts-provider.platform';

@Injectable()
export class TtsProviderRegistryService {
	private readonly logger = new Logger(TtsProviderRegistryService.name);

	private readonly providers = new Map<string, ITtsProvider>();

	/**
	 * Register a TTS provider implementation
	 * @param provider The TTS provider to register
	 * @returns true if registration succeeded, false if provider type already exists
	 */
	register(provider: ITtsProvider): boolean {
		const type = provider.getType();

		if (this.providers.has(type)) {
			this.logger.warn(`TTS provider '${type}' is already registered, skipping`);

			return false;
		}

		this.providers.set(type, provider);

		this.logger.log(`TTS provider '${type}' added. Total providers: ${this.providers.size}`);

		return true;
	}

	/**
	 * Get a TTS provider by type
	 * @param type The provider type identifier
	 * @returns The TTS provider or null if not found
	 */
	get(type: string): ITtsProvider | null {
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
