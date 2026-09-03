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

import { UpdateNotificationsDiscordConfigDto } from './dto/update-config.dto';
import { NotificationsDiscordConfigModel } from './models/config.model';
import {
	NOTIFICATIONS_DISCORD_PLUGIN_API_TAG_DESCRIPTION,
	NOTIFICATIONS_DISCORD_PLUGIN_API_TAG_NAME,
	NOTIFICATIONS_DISCORD_PLUGIN_NAME,
} from './notifications-discord.constants';
import { NOTIFICATIONS_DISCORD_PLUGIN_SWAGGER_EXTRA_MODELS } from './notifications-discord.openapi';
import { DiscordChannelPlatform } from './platforms/discord-channel.platform';
import { DiscordActionsService } from './services/discord-actions.service';

@ApiTag({
	tagName: NOTIFICATIONS_DISCORD_PLUGIN_NAME,
	displayName: NOTIFICATIONS_DISCORD_PLUGIN_API_TAG_NAME,
	description: NOTIFICATIONS_DISCORD_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [ConfigModule, SwaggerModule, ExtensionsModule, NotificationsModule],
	providers: [DiscordChannelPlatform, DiscordActionsService],
	exports: [DiscordChannelPlatform],
})
export class NotificationsDiscordPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly channelRegistry: NotificationChannelRegistryService,
		private readonly discordChannel: DiscordChannelPlatform,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<NotificationsDiscordConfigModel, UpdateNotificationsDiscordConfigDto>({
			type: NOTIFICATIONS_DISCORD_PLUGIN_NAME,
			class: NotificationsDiscordConfigModel,
			configDto: UpdateNotificationsDiscordConfigDto,
			secretFields: [
				{
					path: 'webhook_url',
					configuredPath: 'webhook_url_configured',
					inputPaths: ['webhookUrl'],
				},
			],
		});

		for (const model of NOTIFICATIONS_DISCORD_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: NOTIFICATIONS_DISCORD_PLUGIN_NAME,
			name: 'Discord',
			description: 'Forwards system notifications to a Discord channel through an incoming webhook.',
			author: 'FastyBird',
			capabilities: [NotificationsCapability.CHANNEL],
			readme: `# Discord

> Plugin · by FastyBird · capability: channel

Forwards system notifications to a Discord channel as a rich embed, using a Discord incoming webhook - no bot, no server permissions to manage.

## What you get

- One embed per notification, with a colour that matches its severity
- A minimum severity so only the notifications you care about reach the channel
- An optional username override, so the message can stand out from other webhooks in the same channel
- A "Send test notification" action on the Actions tab, so you can confirm delivery before relying on it

## Setup

1. In Discord, open the target channel's **Integrations → Webhooks** settings and create (or copy) a webhook URL
2. Enable the plugin and paste the webhook URL
3. Optionally set a minimum severity and a username override
4. Use "Send test notification" from the Actions tab to confirm delivery

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`webhook_url\` | Discord incoming webhook URL (must start with \`https://\`) | — |
| \`username\` | Overrides the default username the webhook posts as | webhook default |
| \`min_severity\` | Lowest severity forwarded to this channel | \`warning\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.channelRegistry.register(this.discordChannel);
	}
}
