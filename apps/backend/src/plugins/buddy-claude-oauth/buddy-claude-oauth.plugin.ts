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
	BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_NAME,
	BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
} from './buddy-claude-oauth.constants';
import { BUDDY_CLAUDE_OAUTH_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-claude-oauth.openapi';
import { BuddyClaudeOauthController } from './controllers/oauth.controller';
import { UpdateBuddyClaudeOauthConfigDto } from './dto/update-config.dto';
import { BuddyClaudeOauthConfigModel } from './models/config.model';
import { ClaudeOauthProvider } from './platforms/claude-oauth.provider';

@ApiTag({
	tagName: BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
	displayName: BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_NAME,
	description: BUDDY_CLAUDE_OAUTH_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	controllers: [BuddyClaudeOauthController],
	providers: [ClaudeOauthProvider],
	exports: [ClaudeOauthProvider],
})
export class BuddyClaudeOauthPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly providerRegistry: LlmProviderRegistryService,
		private readonly claudeOauthProvider: ClaudeOauthProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyClaudeOauthConfigModel, UpdateBuddyClaudeOauthConfigDto>({
			type: BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
			class: BuddyClaudeOauthConfigModel,
			configDto: UpdateBuddyClaudeOauthConfigDto,
		});

		this.providerRegistry.register(this.claudeOauthProvider);

		for (const model of BUDDY_CLAUDE_OAUTH_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_CLAUDE_OAUTH_PLUGIN_NAME,
			name: 'Buddy Claude OAuth',
			description: 'LLM provider for Buddy module using Anthropic Claude with OAuth authentication',
			author: 'FastyBird',
			readme: `# Buddy Claude OAuth Provider

LLM provider plugin for the Buddy module using the Anthropic Claude API with OAuth authentication.

## Features

- **Claude Models** - Access to Claude Sonnet, Opus, and Haiku models
- **OAuth Authentication** - Uses OAuth2 client credentials for secure API access
- **Token Refresh** - Automatic access token refresh using refresh tokens

## Setup

1. Register an OAuth application at [Anthropic](https://console.anthropic.com)
2. Obtain client ID and client secret
3. Complete the OAuth flow to get access and refresh tokens
4. Enter the credentials in plugin configuration
5. Set the buddy module \`provider\` to \`${BUDDY_CLAUDE_OAUTH_PLUGIN_NAME}\`

## Configuration

- **Client ID** - OAuth client ID (required)
- **Client Secret** - OAuth client secret (optional)
- **Access Token** - OAuth access token
- **Refresh Token** - OAuth refresh token for automatic renewal
- **Model** - Model name to use (default: claude-sonnet-4-20250514)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
