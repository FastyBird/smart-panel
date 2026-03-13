import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { BUDDY_DISCORD_PLUGIN_NAME } from '../buddy-discord.constants';

@Injectable()
export class DiscordConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = BUDDY_DISCORD_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		// Config is a PluginConfigModel instance — fields are camelCase
		const botToken = (config['botToken'] ?? config['bot_token']) as string | undefined;

		if (!botToken || botToken.trim() === '') {
			return { valid: false, errors: [{ message: 'Bot token is required', field: 'bot_token' }] };
		}

		return { valid: true };
	}
}
