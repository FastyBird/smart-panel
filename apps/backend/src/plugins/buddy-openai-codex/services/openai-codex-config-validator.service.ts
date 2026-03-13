import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { BUDDY_OPENAI_CODEX_PLUGIN_NAME } from '../buddy-openai-codex.constants';

@Injectable()
export class OpenAiCodexConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = BUDDY_OPENAI_CODEX_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const accessToken = (config['accessToken'] ?? config['access_token']) as string | undefined;
		const clientId = (config['clientId'] ?? config['client_id']) as string | undefined;
		const clientSecret = (config['clientSecret'] ?? config['client_secret']) as string | undefined;

		const hasAccessToken = accessToken && accessToken.trim() !== '';
		const hasClientCredentials = clientId && clientId.trim() !== '' && clientSecret && clientSecret.trim() !== '';

		if (!hasAccessToken && !hasClientCredentials) {
			return {
				valid: false,
				errors: [{ message: 'Either access token or client ID and client secret are required', field: 'access_token' }],
			};
		}

		return { valid: true };
	}
}
