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

@ApiTag({
	tagName: BUDDY_TELEGRAM_PLUGIN_NAME,
	displayName: BUDDY_TELEGRAM_PLUGIN_API_TAG_NAME,
	description: BUDDY_TELEGRAM_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [TelegramBotProvider],
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
			readme: `# Buddy Telegram Plugin

Telegram bot adapter plugin for the Buddy module. Enables remote conversations and alert forwarding via Telegram.

## Features

- **Remote Chat** - Interact with your smart home buddy from anywhere via Telegram
- **Alert Forwarding** - Receive suggestion notifications with accept/dismiss buttons
- **User Whitelist** - Restrict access to specific Telegram user IDs

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Copy the bot token
3. Enable the plugin and enter the bot token in configuration
4. Optionally set allowed user IDs to restrict access

## Configuration

- **Bot Token** - Telegram Bot API token from @BotFather (required)
- **Allowed User IDs** - Comma-separated Telegram user IDs (empty = allow all)`,
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
