import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyModule } from '../../modules/buddy/buddy.module';
import { LlmProviderRegistryService } from '../../modules/buddy/services/llm-provider-registry.service';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_PLUGIN_API_TAG_NAME,
	BUDDY_CLAUDE_PLUGIN_NAME,
} from './buddy-claude.constants';
import { BUDDY_CLAUDE_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-claude.openapi';
import { UpdateBuddyClaudeConfigDto } from './dto/update-config.dto';
import { BuddyClaudeConfigModel } from './models/config.model';
import { ClaudeProvider } from './platforms/claude.provider';

@ApiTag({
	tagName: BUDDY_CLAUDE_PLUGIN_NAME,
	displayName: BUDDY_CLAUDE_PLUGIN_API_TAG_NAME,
	description: BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [ClaudeProvider],
	exports: [ClaudeProvider],
})
export class BuddyClaudePlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly providerRegistry: LlmProviderRegistryService,
		private readonly claudeProvider: ClaudeProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyClaudeConfigModel, UpdateBuddyClaudeConfigDto>({
			type: BUDDY_CLAUDE_PLUGIN_NAME,
			class: BuddyClaudeConfigModel,
			configDto: UpdateBuddyClaudeConfigDto,
		});

		this.providerRegistry.register(this.claudeProvider);

		for (const model of BUDDY_CLAUDE_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_CLAUDE_PLUGIN_NAME,
			name: 'Buddy Claude',
			description: 'LLM provider for Buddy module using Anthropic Claude API',
			author: 'FastyBird',
			readme: `# Buddy Claude Provider

LLM provider plugin for the Buddy module using the Anthropic Claude API.

## Features

- **Claude Models** - Access to Claude Sonnet, Opus, and Haiku models
- **Chat Conversations** - Powers Buddy text chat with Claude intelligence

## Setup

1. Create an account at [Anthropic](https://console.anthropic.com)
2. Generate an API key from your account dashboard
3. Enter the API key in plugin configuration
4. Set the buddy module \`provider\` to \`${BUDDY_CLAUDE_PLUGIN_NAME}\`

## Configuration

- **API Key** - Your Anthropic API key (required)
- **Model** - Model name to use (default: claude-sonnet-4-20250514)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
