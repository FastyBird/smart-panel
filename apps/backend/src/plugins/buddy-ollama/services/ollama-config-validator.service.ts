import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { BUDDY_OLLAMA_PLUGIN_NAME } from '../buddy-ollama.constants';

@Injectable()
export class OllamaConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = BUDDY_OLLAMA_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const baseUrl = (config['baseUrl'] ?? config['base_url']) as string | undefined;

		if (!baseUrl || baseUrl.trim() === '') {
			return { valid: false, errors: [{ message: 'Base URL is required', field: 'base_url' }] };
		}

		return { valid: true };
	}
}
