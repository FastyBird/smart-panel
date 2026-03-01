import { Injectable, Logger } from '@nestjs/common';

import { ILlmProvider } from '../platforms/llm-provider.platform';

@Injectable()
export class LlmProviderRegistryService {
	private readonly logger = new Logger(LlmProviderRegistryService.name);

	private readonly providers: Record<string, ILlmProvider> = {};

	/**
	 * Register an LLM provider implementation
	 * @param provider The LLM provider to register
	 * @returns true if registration succeeded, false if provider type already exists
	 */
	register(provider: ILlmProvider): boolean {
		const type = provider.getType();

		if (type in this.providers) {
			this.logger.warn(`LLM provider '${type}' is already registered, skipping`);

			return false;
		}

		this.providers[type] = provider;

		this.logger.log(`LLM provider '${type}' added. Total providers: ${Object.keys(this.providers).length}`);

		return true;
	}

	/**
	 * Get an LLM provider by type
	 * @param type The provider type identifier
	 * @returns The LLM provider or null if not found
	 */
	get(type: string): ILlmProvider | null {
		return this.providers[type] ?? null;
	}

	/**
	 * List all registered provider types
	 * @returns Array of provider type identifiers
	 */
	list(): string[] {
		return Object.keys(this.providers);
	}
}
