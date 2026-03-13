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
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_CODEX_PLUGIN_NAME,
} from './buddy-openai-codex.constants';
import { BUDDY_OPENAI_CODEX_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-openai-codex.openapi';
import { BuddyOpenaiCodexOauthController } from './controllers/oauth.controller';
import { UpdateBuddyOpenaiCodexConfigDto } from './dto/update-config.dto';
import { BuddyOpenaiCodexConfigModel } from './models/config.model';
import { OpenAiCodexProvider } from './platforms/openai-codex.provider';
import { OpenAiCodexConfigValidatorService } from './services/openai-codex-config-validator.service';

@ApiTag({
	tagName: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
	displayName: BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_NAME,
	description: BUDDY_OPENAI_CODEX_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	controllers: [BuddyOpenaiCodexOauthController],
	providers: [OpenAiCodexProvider, OpenAiCodexConfigValidatorService],
	exports: [OpenAiCodexProvider],
})
export class BuddyOpenaiCodexPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly providerRegistry: LlmProviderRegistryService,
		private readonly openAiCodexProvider: OpenAiCodexProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyOpenaiCodexConfigModel, UpdateBuddyOpenaiCodexConfigDto>({
			type: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
			class: BuddyOpenaiCodexConfigModel,
			configDto: UpdateBuddyOpenaiCodexConfigDto,
		});

		this.providerRegistry.register(this.openAiCodexProvider);

		for (const model of BUDDY_OPENAI_CODEX_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_OPENAI_CODEX_PLUGIN_NAME,
			name: 'OpenAI Codex',
			description: 'LLM provider for Buddy module using OpenAI Codex with OAuth authentication',
			author: 'FastyBird',
			readme: `# Buddy OpenAI Codex Provider

LLM provider plugin for the Buddy module using the OpenAI Codex API with OAuth authentication.

## Features

- **Codex Models** - Access to codex-mini and other OpenAI Codex models
- **OAuth Authentication** - Uses OAuth2 client credentials for secure API access
- **Token Refresh** - Automatic access token refresh using refresh tokens

## Setup

1. Register an OAuth application at [OpenAI](https://platform.openai.com)
2. Obtain client ID and client secret
3. Complete the OAuth flow to get access and refresh tokens
4. Enter the credentials in plugin configuration
5. Set the buddy module \`provider\` to \`${BUDDY_OPENAI_CODEX_PLUGIN_NAME}\`

## Configuration

- **Client ID** - OAuth client ID (required)
- **Client Secret** - OAuth client secret (optional)
- **Access Token** - OAuth access token
- **Refresh Token** - OAuth refresh token for automatic renewal
- **Model** - Model name to use (default: codex-mini)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
