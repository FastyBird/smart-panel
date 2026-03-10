import { Module, OnModuleInit } from '@nestjs/common';

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
		private readonly whatsAppBotProvider: WhatsAppBotProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
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
			name: 'WhatsApp',
			description: 'WhatsApp adapter plugin for Buddy module remote conversations and alerts',
			author: 'FastyBird',
			capabilities: [],
			readme: `# Buddy WhatsApp Plugin

WhatsApp adapter plugin for the Buddy module. Connects via WhatsApp Web protocol (QR code scan).

## Features

- **QR Code Pairing** - Scan a QR code with your phone to connect (no Meta Business account needed)
- **Remote Chat** - Interact with your smart home buddy from anywhere via WhatsApp
- **Alert Forwarding** - Receive suggestion notifications
- **Phone Whitelist** - Restrict access to specific phone numbers
- **Persistent Session** - Authentication persists across restarts

## Setup

1. Enable the plugin in configuration
2. Open the status endpoint or check the terminal for the QR code
3. Scan the QR code with WhatsApp on your phone (Linked Devices)
4. Start chatting with the bot

## Configuration

- **Allowed Phone Numbers** - Comma-separated E.164 phone numbers (empty = allow all)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.whatsAppBotProvider);
	}
}
