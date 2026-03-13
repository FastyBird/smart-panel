import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { BUDDY_ELEVENLABS_PLUGIN_NAME } from '../buddy-elevenlabs.constants';

@Injectable()
export class ElevenLabsConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = BUDDY_ELEVENLABS_PLUGIN_NAME;

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
