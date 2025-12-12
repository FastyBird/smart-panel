import { Injectable, Logger } from '@nestjs/common';

import { WeatherProviderModel } from '../models/provider.model';
import { IWeatherProvider } from '../platforms/weather-provider.platform';

@Injectable()
export class WeatherProviderRegistryService {
	private readonly logger = new Logger(WeatherProviderRegistryService.name);

	private readonly providers: Record<string, IWeatherProvider> = {};

	/**
	 * Register a weather provider implementation
	 * @param provider The weather provider to register
	 * @returns true if registration succeeded, false if provider type already exists
	 */
	register(provider: IWeatherProvider): boolean {
		const type = provider.getType();

		if (type in this.providers) {
			this.logger.warn(`[REGISTER] Weather provider '${type}' is already registered, skipping`);

			return false;
		}

		this.providers[type] = provider;

		this.logger.log(
			`[REGISTERED] Weather provider '${type}' added. Total providers: ${Object.keys(this.providers).length}`,
		);

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
			this.logger.debug(`[LOOKUP] Weather provider '${type}' not found`);
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
	getAll(): WeatherProviderModel[] {
		return Object.values(this.providers).map((provider) => {
			const model = new WeatherProviderModel();
			model.type = provider.getType();
			model.name = provider.getName();
			model.description = provider.getDescription();
			return model;
		});
	}
}
