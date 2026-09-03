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

import { UpdateNotificationsWebhookConfigDto } from './dto/update-config.dto';
import { NotificationsWebhookConfigModel } from './models/config.model';
import {
	NOTIFICATIONS_WEBHOOK_PLUGIN_API_TAG_DESCRIPTION,
	NOTIFICATIONS_WEBHOOK_PLUGIN_API_TAG_NAME,
	NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
} from './notifications-webhook.constants';
import { NOTIFICATIONS_WEBHOOK_PLUGIN_SWAGGER_EXTRA_MODELS } from './notifications-webhook.openapi';
import { WebhookChannelPlatform } from './platforms/webhook-channel.platform';
import { WebhookActionsService } from './services/webhook-actions.service';

@ApiTag({
	tagName: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
	displayName: NOTIFICATIONS_WEBHOOK_PLUGIN_API_TAG_NAME,
	description: NOTIFICATIONS_WEBHOOK_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [ConfigModule, SwaggerModule, ExtensionsModule, NotificationsModule],
	providers: [WebhookChannelPlatform, WebhookActionsService],
	exports: [WebhookChannelPlatform],
})
export class NotificationsWebhookPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly channelRegistry: NotificationChannelRegistryService,
		private readonly webhookChannel: WebhookChannelPlatform,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<NotificationsWebhookConfigModel, UpdateNotificationsWebhookConfigDto>({
			type: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
			class: NotificationsWebhookConfigModel,
			configDto: UpdateNotificationsWebhookConfigDto,
			secretFields: [
				{
					path: 'url',
					configuredPath: 'url_configured',
					inputPaths: ['url'],
				},
				{
					path: 'headers',
					configuredPath: 'headers_configured',
					inputPaths: ['headers'],
				},
			],
		});

		for (const model of NOTIFICATIONS_WEBHOOK_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: NOTIFICATIONS_WEBHOOK_PLUGIN_NAME,
			name: 'Generic webhook',
			description: 'Forwards system notifications as a JSON POST request to any URL you configure.',
			author: 'FastyBird',
			capabilities: [NotificationsCapability.CHANNEL],
			readme: `# Generic webhook

> Plugin · by FastyBird · capability: channel

Forwards system notifications to any endpoint that can accept a JSON \`POST\` request - your own automation server, a chat platform's incoming webhook, or a self-hosted tool such as n8n, Node-RED or Home Assistant.

## What you get

- A drop-in way to wire notifications into whatever already accepts webhooks
- A minimum severity so only the notifications you care about are forwarded
- Optional custom headers, for an \`Authorization\` bearer token or any other auth scheme your endpoint expects
- A "Send test notification" action on the Actions tab, so you can confirm delivery before relying on it

## Setup

1. Enable the plugin
2. Set the target URL - HTTPS is recommended; HTTP is accepted only for trusted-network targets (e.g. Home Assistant, n8n or Node-RED on your own LAN) and cannot be combined with custom headers
3. Optionally set a minimum severity and extra headers
4. Use "Send test notification" from the Actions tab to confirm delivery

## Payload

\`\`\`json
{
  "id": "...",
  "source": "...",
  "kind": "issue",
  "severity": "warning",
  "title": "...",
  "message": "...",
  "occurrences": 1,
  "created_at": "2026-09-02T12:00:00.000Z",
  "actions": []
}
\`\`\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`url\` | Target URL notifications are POSTed to | — |
| \`headers\` | Extra HTTP headers sent with every request (requires HTTPS) | none |
| \`min_severity\` | Lowest severity forwarded to this channel | \`warning\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		this.channelRegistry.register(this.webhookChannel);
	}
}
