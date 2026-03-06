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
	BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_NAME,
	BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
} from './buddy-claude-setup-token.constants';
import { BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-claude-setup-token.openapi';
import { UpdateBuddyClaudeSetupTokenConfigDto } from './dto/update-config.dto';
import { BuddyClaudeSetupTokenConfigModel } from './models/config.model';
import { ClaudeSetupTokenProvider } from './platforms/claude-setup-token.provider';

@ApiTag({
	tagName: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
	displayName: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_NAME,
	description: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [ClaudeSetupTokenProvider],
	exports: [ClaudeSetupTokenProvider],
})
export class BuddyClaudeSetupTokenPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly providerRegistry: LlmProviderRegistryService,
		private readonly claudeSetupTokenProvider: ClaudeSetupTokenProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyClaudeSetupTokenConfigModel, UpdateBuddyClaudeSetupTokenConfigDto>({
			type: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
			class: BuddyClaudeSetupTokenConfigModel,
			configDto: UpdateBuddyClaudeSetupTokenConfigDto,
		});

		this.providerRegistry.register(this.claudeSetupTokenProvider);

		for (const model of BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
			name: 'Claude Setup Token',
			description: 'LLM provider for Buddy module using Anthropic Claude with setup-token authentication',
			author: 'FastyBird',
			readme: `# Buddy Claude Setup Token Provider

LLM provider plugin for the Buddy module using the Anthropic Claude API with setup-token authentication.

## Features

- **Claude Models** - Access to Claude Sonnet, Opus, and Haiku models
- **Setup Token** - Uses a setup-token from your Claude subscription for API access

## Setup

1. Run \`claude setup-token\` in your terminal (requires Claude Code CLI)
2. Copy the generated token
3. Paste the token in plugin configuration
4. Set the buddy module \`provider\` to \`${BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME}\`

## Configuration

- **Setup Token** - The token obtained from \`claude setup-token\` (required)
- **Model** - Model name to use (default: claude-sonnet-4-20250514)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
