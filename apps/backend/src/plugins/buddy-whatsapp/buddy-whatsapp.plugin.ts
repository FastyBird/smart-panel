import { FastifyInstance, FastifyRequest } from 'fastify';
import { Readable } from 'stream';

import { Module, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';

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
		private readonly httpAdapterHost: HttpAdapterHost,
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

		// Register a preParsing hook to capture the raw body only for the WhatsApp webhook POST route.
		// This avoids enabling rawBody globally which would double per-request memory for all routes.
		// Guard: httpAdapter is null when running in CLI context (e.g., openapi:generate).
		this.registerRawBodyHook();

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

	/**
	 * Register a Fastify preParsing hook to capture raw body only for the webhook POST route.
	 * This avoids enabling rawBody globally which would double per-request memory for all routes.
	 */
	private registerRawBodyHook(): void {
		// httpAdapter is null when running in CLI context (e.g., openapi:generate)
		if (!this.httpAdapterHost.httpAdapter) {
			return;
		}

		const instance = this.httpAdapterHost.httpAdapter.getInstance<FastifyInstance>();

		// Skip when running under a non-Fastify adapter (e.g., Express in e2e tests)
		if (typeof instance.addHook !== 'function') {
			return;
		}

		instance.addHook('preParsing', (request, _reply, payload, done) => {
			if (request.method !== 'POST' || !request.url.includes('/buddy-whatsapp/webhook')) {
				done(null, payload);

				return;
			}

			const chunks: Buffer[] = [];
			const stream = payload as Readable;

			stream.on('data', (chunk: Buffer) => {
				chunks.push(chunk);
			});

			stream.on('end', () => {
				const rawBody = Buffer.concat(chunks);

				(request as FastifyRequest & { whatsappRawBody?: Buffer }).whatsappRawBody = rawBody;

				done(null, Readable.from(rawBody));
			});

			stream.on('error', (err: Error) => {
				done(err, payload);
			});
		});
	}
}
