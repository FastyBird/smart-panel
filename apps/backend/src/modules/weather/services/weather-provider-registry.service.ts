import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { IWeatherProvider } from '../platforms/weather-provider.platform';
import { WEATHER_MODULE_NAME } from '../weather.constants';

export interface IWeatherProviderInfo {
	type: string;
	name: string;
	description: string;
}

@Injectable()
export class WeatherProviderRegistryService {
	private readonly logger = createExtensionLogger(WEATHER_MODULE_NAME, 'WeatherProviderRegistryService');

	private readonly providers: Record<string, IWeatherProvider> = {};

	/**
	 * Register a weather provider implementation
	 * @param provider The weather provider to register
	 * @returns true if registration succeeded, false if provider type already exists
	 */
	register(provider: IWeatherProvider): boolean {
		const type = provider.getType();

		if (type in this.providers) {
			this.logger.warn(`Weather provider '${type}' is already registered, skipping`);

			return false;
		}

		this.providers[type] = provider;

		this.logger.log(`Weather provider '${type}' added. Total providers: ${Object.keys(this.providers).length}`);

		return true;
	}

	/**
	 * Get a weather provider by type
	 * @param type The provider type identifier
	 * @returns The weather provider or null if not found
	 */
	get(type: string): IWeatherProvider | null {
		const provider = this.providers[type] ?? null;

		if (!provider) {
			// Intentionally empty - provider not found
		}

		return provider;
	}

	/**
	 * List all registered provider types
	 * @returns Array of provider type identifiers
	 */
	list(): string[] {
		return Object.keys(this.providers);
	}

	/**
	 * Check if a provider type is registered
	 * @param type The provider type identifier
	 * @returns true if provider is registered
	 */
	has(type: string): boolean {
		return type in this.providers;
	}

	/**
	 * Get all registered providers with their metadata
	 * @returns Array of provider info objects
	 */
	getAll(): IWeatherProviderInfo[] {
		return Object.values(this.providers).map((provider) => ({
			type: provider.getType(),
			name: provider.getName(),
			description: provider.getDescription(),
		}));
	}
}
