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
	BUDDY_DISCORD_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_DISCORD_PLUGIN_API_TAG_NAME,
	BUDDY_DISCORD_PLUGIN_NAME,
} from './buddy-discord.constants';
import { BUDDY_DISCORD_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-discord.openapi';
import { UpdateBuddyDiscordConfigDto } from './dto/update-config.dto';
import { BuddyDiscordConfigModel } from './models/config.model';
import { DiscordBotProvider } from './platforms/discord-bot.provider';

@ApiTag({
	tagName: BUDDY_DISCORD_PLUGIN_NAME,
	displayName: BUDDY_DISCORD_PLUGIN_API_TAG_NAME,
	description: BUDDY_DISCORD_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [DiscordBotProvider],
	exports: [DiscordBotProvider],
})
export class BuddyDiscordPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
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
			capabilities: [],
			readme: `# Buddy Discord Plugin

Discord bot adapter plugin for the Buddy module. Enables remote conversations and alert forwarding via Discord with multi-channel space mapping.

## Features

- **Multi-Channel Support** - Map Discord channels to smart home spaces for context-aware conversations
- **Remote Chat** - Interact with your smart home buddy from anywhere via Discord
- **Alert Routing** - Receive suggestion notifications in the relevant space channel
- **Role-Based Access** - Restrict bot interaction to users with a specific Discord role

## Setup

1. Create a bot application at the [Discord Developer Portal](https://discord.com/developers/applications)
2. Enable the "Message Content Intent" under Bot settings
3. Copy the bot token
4. Add the bot to your server with required permissions (Send Messages, Read Messages, Add Reactions)
5. Enable the plugin and configure the bot token, guild ID, and channel mappings

## Configuration

- **Bot Token** - Discord bot token from the Developer Portal (required)
- **Guild ID** - Discord server ID (required)
- **General Channel ID** - Default channel for cross-space queries (required)
- **Space-Channel Mappings** - JSON mapping of space IDs to Discord channel IDs
- **Allowed Role ID** - Discord role required to interact (empty = allow all server members)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
