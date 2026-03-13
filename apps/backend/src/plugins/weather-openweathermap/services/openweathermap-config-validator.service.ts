import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { WEATHER_OPENWEATHERMAP_PLUGIN_NAME } from '../weather-openweathermap.constants';

@Injectable()
export class OpenWeatherMapConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = WEATHER_OPENWEATHERMAP_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const apiKey = (config['apiKey'] ?? config['api_key']) as string | undefined;

		if (!apiKey || apiKey.trim() === '') {
			return { valid: false, errors: [{ message: 'API key is required', field: 'api_key' }] };
		}

		return { valid: true };
	}
}
