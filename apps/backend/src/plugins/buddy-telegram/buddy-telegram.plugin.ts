import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyCapability } from '../../modules/buddy/buddy.constants';
import { BuddyModule } from '../../modules/buddy/buddy.module';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { PluginServiceManagerService } from '../../modules/extensions/services/plugin-service-manager.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	BUDDY_TELEGRAM_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_TELEGRAM_PLUGIN_API_TAG_NAME,
	BUDDY_TELEGRAM_PLUGIN_NAME,
} from './buddy-telegram.constants';
import { BUDDY_TELEGRAM_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-telegram.openapi';
import { UpdateBuddyTelegramConfigDto } from './dto/update-config.dto';
import { BuddyTelegramConfigModel } from './models/config.model';
import { TelegramBotProvider } from './platforms/telegram-bot.provider';
import { TelegramConfigValidatorService } from './services/telegram-config-validator.service';

@ApiTag({
	tagName: BUDDY_TELEGRAM_PLUGIN_NAME,
	displayName: BUDDY_TELEGRAM_PLUGIN_API_TAG_NAME,
	description: BUDDY_TELEGRAM_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [TelegramBotProvider, TelegramConfigValidatorService],
	exports: [TelegramBotProvider],
})
export class BuddyTelegramPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly telegramBotProvider: TelegramBotProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyTelegramConfigModel, UpdateBuddyTelegramConfigDto>({
			type: BUDDY_TELEGRAM_PLUGIN_NAME,
			class: BuddyTelegramConfigModel,
			configDto: UpdateBuddyTelegramConfigDto,
		});

		for (const model of BUDDY_TELEGRAM_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_TELEGRAM_PLUGIN_NAME,
			name: 'Telegram',
			description: 'Telegram bot adapter for Buddy module remote conversations and alerts',
			author: 'FastyBird',
			capabilities: [BuddyCapability.MESSAGING],
			readme: `# Telegram

> Plugin · by FastyBird · capability: messaging

Telegram bot adapter for the Buddy module. Forwards alerts (with inline accept / dismiss buttons) and lets you have full Buddy conversations from any Telegram client.

## What you get

- Talk to your home from a Telegram chat — same brain as the panel, available worldwide
- Inline buttons on suggestions / alerts so you can act with one tap (acknowledge a leak alarm, run a scene, dismiss a suggestion)
- Tight access control — limit who can chat with the bot to a list of explicit Telegram user IDs
- Zero infrastructure to host: Telegram's bot API does the heavy lifting, you only need a bot token

## Features

- **Remote chat** — text Buddy from any Telegram device with the same context as the panel
- **Inline alert buttons** — every alert / suggestion ships with quick-action buttons
- **Allow-list** — restrict access to a comma-separated list of user IDs; everyone else is silently ignored
- **Markdown formatting** — replies render cleanly in Telegram with lists and code blocks where useful

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the token
2. Enable the plugin and paste the token into configuration
3. Optionally restrict access by listing allowed user IDs

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`bot_token\` | Telegram Bot API token (required) | — |
| \`allowed_user_ids\` | Comma-separated Telegram user IDs allowed to chat | unrestricted |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.telegramBotProvider);
	}
}
