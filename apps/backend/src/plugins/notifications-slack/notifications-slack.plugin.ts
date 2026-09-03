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

import { UpdateNotificationsSlackConfigDto } from './dto/update-config.dto';
import { NotificationsSlackConfigModel } from './models/config.model';
import {
	NOTIFICATIONS_SLACK_PLUGIN_API_TAG_DESCRIPTION,
	NOTIFICATIONS_SLACK_PLUGIN_API_TAG_NAME,
	NOTIFICATIONS_SLACK_PLUGIN_NAME,
} from './notifications-slack.constants';
import { NOTIFICATIONS_SLACK_PLUGIN_SWAGGER_EXTRA_MODELS } from './notifications-slack.openapi';
import { SlackChannelPlatform } from './platforms/slack-channel.platform';
import { SlackActionsService } from './services/slack-actions.service';

@ApiTag({
	tagName: NOTIFICATIONS_SLACK_PLUGIN_NAME,
	displayName: NOTIFICATIONS_SLACK_PLUGIN_API_TAG_NAME,
	description: NOTIFICATIONS_SLACK_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [ConfigModule, SwaggerModule, ExtensionsModule, NotificationsModule],
	providers: [SlackChannelPlatform, SlackActionsService],
	exports: [SlackChannelPlatform],
})
export class NotificationsSlackPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly channelRegistry: NotificationChannelRegistryService,
		private readonly slackChannel: SlackChannelPlatform,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<NotificationsSlackConfigModel, UpdateNotificationsSlackConfigDto>({
			type: NOTIFICATIONS_SLACK_PLUGIN_NAME,
			class: NotificationsSlackConfigModel,
			configDto: UpdateNotificationsSlackConfigDto,
			secretFields: [
				{
					path: 'webhook_url',
					configuredPath: 'webhook_url_configured',
					inputPaths: ['webhookUrl'],
				},
			],
		});

		for (const model of NOTIFICATIONS_SLACK_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: NOTIFICATIONS_SLACK_PLUGIN_NAME,
			name: 'Slack',
			description: 'Forwards system notifications to a Slack channel through an incoming webhook.',
			author: 'FastyBird',
			capabilities: [NotificationsCapability.CHANNEL],
			readme: `# Slack

> Plugin · by FastyBird · capability: channel

Forwards system notifications to a Slack channel as a coloured attachment, using a Slack incoming webhook - no bot, no app permissions to manage.

## What you get

- One message per notification, with a colour that matches its severity
- A minimum severity so only the notifications you care about reach the channel
- A "Send test notification" action on the Actions tab, so you can confirm delivery before relying on it

## Setup

1. In Slack, create (or reuse) an app with an Incoming Webhook enabled for the target channel, and copy its webhook URL
2. Enable the plugin and paste the webhook URL
3. Optionally set a minimum severity
4. Use "Send test notification" from the Actions tab to confirm delivery

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`webhook_url\` | Slack incoming webhook URL (must start with \`https://\`) | — |
| \`min_severity\` | Lowest severity forwarded to this channel | \`warning\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.channelRegistry.register(this.slackChannel);
	}
}
