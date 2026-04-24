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
	BUDDY_DISCORD_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_DISCORD_PLUGIN_API_TAG_NAME,
	BUDDY_DISCORD_PLUGIN_NAME,
} from './buddy-discord.constants';
import { BUDDY_DISCORD_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-discord.openapi';
import { UpdateBuddyDiscordConfigDto } from './dto/update-config.dto';
import { BuddyDiscordConfigModel } from './models/config.model';
import { DiscordBotProvider } from './platforms/discord-bot.provider';
import { DiscordConfigValidatorService } from './services/discord-config-validator.service';

@ApiTag({
	tagName: BUDDY_DISCORD_PLUGIN_NAME,
	displayName: BUDDY_DISCORD_PLUGIN_API_TAG_NAME,
	description: BUDDY_DISCORD_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [DiscordBotProvider, DiscordConfigValidatorService],
	exports: [DiscordBotProvider],
})
export class BuddyDiscordPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly discordBotProvider: DiscordBotProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
		private readonly pluginServiceManager: PluginServiceManagerService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyDiscordConfigModel, UpdateBuddyDiscordConfigDto>({
			type: BUDDY_DISCORD_PLUGIN_NAME,
			class: BuddyDiscordConfigModel,
			configDto: UpdateBuddyDiscordConfigDto,
		});

		for (const model of BUDDY_DISCORD_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_DISCORD_PLUGIN_NAME,
			name: 'Discord',
			description: 'Discord bot adapter for Buddy module with multi-channel space mapping',
			author: 'FastyBird',
			capabilities: [BuddyCapability.MESSAGING],
			readme: `# Discord

> Plugin · by FastyBird · capability: messaging

Discord bot adapter for the Buddy module. Forwards alerts and supports remote conversations from any Discord client, with optional per-space channel mapping so messages in your "kitchen" channel are answered with the kitchen's context.

## What you get

- Talk to your home from anywhere Discord works — desktop, web, mobile
- A dedicated channel per room so conversations stay tidy and context-aware (the assistant scopes the home snapshot to whichever space the channel maps to)
- Alerts and suggestions are routed to the right channel automatically — leak in the bathroom? You'll see it in #bathroom, not #general
- Granular access control: restrict the bot to a specific Discord role so only authorised users can issue commands

## Features

- **Multi-channel mapping** — map Discord channels to smart-home spaces for context-aware conversations
- **Remote chat** — talk to Buddy from anywhere Discord runs
- **Alert routing** — suggestion notifications land in the relevant space's channel
- **Role-based access** — restrict who can interact via a Discord role
- **Markdown-friendly replies** — Buddy's answers render cleanly in Discord (lists, code blocks, links)
- **Thread-aware** — keeps replies in the originating thread when the message starts in one

## Setup

1. Create a bot at the [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable the **Message Content Intent** under Bot settings and copy the bot token
3. Invite the bot to your server with the *Send Messages*, *Read Messages* and *Add Reactions* permissions
4. Enable the plugin and fill in the configuration

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`bot_token\` | Discord bot token (required) | — |
| \`guild_id\` | Discord server ID (required) | — |
| \`general_channel_id\` | Default channel for cross-space queries (required) | — |
| \`space_channel_mappings\` | JSON map of space IDs → Discord channel IDs | \`{}\` |
| \`allowed_role_id\` | Discord role required to interact | unrestricted |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});

		// Register service with the centralized plugin service manager
		// The manager handles startup, shutdown, and config-based enable/disable
		this.pluginServiceManager.register(this.discordBotProvider);
	}
}
