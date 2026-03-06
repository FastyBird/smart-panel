import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyModule } from '../../modules/buddy/buddy.module';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	BUDDY_WHATSAPP_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_WHATSAPP_PLUGIN_API_TAG_NAME,
	BUDDY_WHATSAPP_PLUGIN_NAME,
} from './buddy-whatsapp.constants';
import { BUDDY_WHATSAPP_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-whatsapp.openapi';
import { WhatsAppWebhookController } from './controllers/whatsapp-webhook.controller';
import { UpdateBuddyWhatsappConfigDto } from './dto/update-config.dto';
import { BuddyWhatsappConfigModel } from './models/config.model';
import { WhatsAppBotProvider } from './platforms/whatsapp-bot.provider';

@ApiTag({
	tagName: BUDDY_WHATSAPP_PLUGIN_NAME,
	displayName: BUDDY_WHATSAPP_PLUGIN_API_TAG_NAME,
	description: BUDDY_WHATSAPP_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	controllers: [WhatsAppWebhookController],
	providers: [WhatsAppBotProvider],
	exports: [WhatsAppBotProvider],
})
export class BuddyWhatsappPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyWhatsappConfigModel, UpdateBuddyWhatsappConfigDto>({
			type: BUDDY_WHATSAPP_PLUGIN_NAME,
			class: BuddyWhatsappConfigModel,
			configDto: UpdateBuddyWhatsappConfigDto,
		});

		for (const model of BUDDY_WHATSAPP_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_WHATSAPP_PLUGIN_NAME,
			name: 'Buddy WhatsApp',
			description: 'WhatsApp adapter plugin for Buddy module remote conversations and alerts',
			author: 'FastyBird',
			capabilities: [],
			readme: `# Buddy WhatsApp Plugin

WhatsApp adapter plugin for the Buddy module. Enables remote conversations and alert forwarding via WhatsApp.

## Features

- **Remote Chat** - Interact with your smart home buddy from anywhere via WhatsApp
- **Alert Forwarding** - Receive suggestion notifications with interactive buttons
- **Phone Whitelist** - Restrict access to specific phone numbers

## Setup

1. Create a Meta Business account and set up a WhatsApp Business API app
2. Get your Phone Number ID and Access Token from the Meta Developer Portal
3. Enable the plugin and enter the credentials in configuration
4. Set the webhook URL to \`https://your-server/api/v1/plugins/buddy-whatsapp/webhook\`
5. Set the webhook verify token to match the one configured in the plugin

## Configuration

- **Phone Number ID** - WhatsApp Business Phone Number ID (required)
- **Access Token** - Meta Cloud API access token (required)
- **Webhook Verify Token** - Token for webhook verification (required)
- **Allowed Phone Numbers** - Comma-separated E.164 phone numbers (empty = allow all)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
