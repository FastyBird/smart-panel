import { Module, OnModuleInit } from '@nestjs/common';

import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { NotificationsCapability } from '../../modules/notifications/notifications.constants';
import { NotificationsModule } from '../../modules/notifications/notifications.module';
import { NotificationChannelRegistryService } from '../../modules/notifications/services/notification-channel-registry.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import { UpdateNotificationsTelegramConfigDto } from './dto/update-config.dto';
import { NotificationsTelegramConfigModel } from './models/config.model';
import {
	NOTIFICATIONS_TELEGRAM_PLUGIN_API_TAG_DESCRIPTION,
	NOTIFICATIONS_TELEGRAM_PLUGIN_API_TAG_NAME,
	NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
} from './notifications-telegram.constants';
import { NOTIFICATIONS_TELEGRAM_PLUGIN_SWAGGER_EXTRA_MODELS } from './notifications-telegram.openapi';
import { TelegramChannelPlatform } from './platforms/telegram-channel.platform';
import { TelegramActionsService } from './services/telegram-actions.service';

@ApiTag({
	tagName: NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
	displayName: NOTIFICATIONS_TELEGRAM_PLUGIN_API_TAG_NAME,
	description: NOTIFICATIONS_TELEGRAM_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [ConfigModule, SwaggerModule, ExtensionsModule, NotificationsModule],
	providers: [TelegramChannelPlatform, TelegramActionsService],
	exports: [TelegramChannelPlatform],
})
export class NotificationsTelegramPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly channelRegistry: NotificationChannelRegistryService,
		private readonly telegramChannel: TelegramChannelPlatform,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<NotificationsTelegramConfigModel, UpdateNotificationsTelegramConfigDto>({
			type: NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
			class: NotificationsTelegramConfigModel,
			configDto: UpdateNotificationsTelegramConfigDto,
			secretFields: [
				{
					path: 'bot_token',
					configuredPath: 'bot_token_configured',
					inputPaths: ['botToken'],
				},
			],
		});

		for (const model of NOTIFICATIONS_TELEGRAM_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: NOTIFICATIONS_TELEGRAM_PLUGIN_NAME,
			name: 'Telegram',
			description: 'Forwards system notifications to a Telegram chat through a bot.',
			author: 'FastyBird',
			capabilities: [NotificationsCapability.CHANNEL],
			readme: `# Telegram

> Plugin · by FastyBird · capability: channel

Forwards system notifications to a Telegram chat, using a bot created through @BotFather - no webhook server, no Slack/Discord app to manage.

## What you get

- One message per notification, sent to a chat, group or channel your bot can post to
- A minimum severity so only the notifications you care about reach the chat
- A "Send test notification" action on the Actions tab, so you can confirm delivery before relying on it

## Setup

1. In Telegram, message [@BotFather](https://t.me/BotFather), create a bot, and copy the bot token it gives you
2. Start a chat with the bot (or add it to a group/channel) and find the numeric chat id, e.g. via the bot API's \`getUpdates\` method or a helper bot such as [@userinfobot](https://t.me/userinfobot)
3. Enable the plugin, paste the bot token, and set the chat id
4. Optionally set a minimum severity
5. Use "Send test notification" from the Actions tab to confirm delivery

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`bot_token\` | Telegram Bot API token, from @BotFather | — |
| \`chat_id\` | Telegram chat id (or \`@channel\` username) the bot sends messages to | — |
| \`min_severity\` | Lowest severity forwarded to this channel | \`warning\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.channelRegistry.register(this.telegramChannel);
	}
}
