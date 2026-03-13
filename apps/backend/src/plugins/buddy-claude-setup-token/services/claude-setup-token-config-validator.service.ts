import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME } from '../buddy-claude-setup-token.constants';

@Injectable()
export class ClaudeSetupTokenConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const accessToken = (config['accessToken'] ?? config['access_token']) as string | undefined;

		if (!accessToken || accessToken.trim() === '') {
			return { valid: false, errors: [{ message: 'Access token is required', field: 'access_token' }] };
		}

		return { valid: true };
	}
}
