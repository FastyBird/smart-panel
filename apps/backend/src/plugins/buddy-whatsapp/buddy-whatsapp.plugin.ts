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
			capabilities: [BuddyCapability.MESSAGING],
			readme: `# WhatsApp

> Plugin · by FastyBird · capability: messaging

WhatsApp adapter for the Buddy module that connects through the WhatsApp Web protocol — no Meta Business account, no cloud middleman, just a phone running WhatsApp paired as a "linked device".

## What you get

- Talk to Buddy from any WhatsApp client — desktop, web, Android, iOS — the same way you'd message a friend
- Use a number you already own; no business verification, no new SIM, no Meta API onboarding
- Persistent session: pair once, the plugin remembers the auth state across restarts and reconnects automatically when the phone goes online again
- Granular access control via a phone-number allow-list, so the bot only answers people you trust

## Features

- **QR-code pairing** — link a phone via *Settings → Linked Devices*
- **Remote chat** — interact with Buddy from anywhere
- **Alert forwarding** — receive suggestion notifications as regular WhatsApp messages
- **Phone whitelist** — restrict access to a comma-separated list of E.164 numbers
- **Persistent session** — authentication survives restarts; you don't re-scan the QR every time
- **Auto reconnect** — the plugin handles WhatsApp Web disconnects and re-establishes the session in the background

## Setup

1. Enable the plugin
2. Read the QR code from the status endpoint or backend logs
3. Scan it with WhatsApp on your phone (*Settings → Linked Devices*)
4. Start chatting with Buddy

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`allowed_phone_numbers\` | Comma-separated E.164 numbers permitted to chat | unrestricted |`,
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
