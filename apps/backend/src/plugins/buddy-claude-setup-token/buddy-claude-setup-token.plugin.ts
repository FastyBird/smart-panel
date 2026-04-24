import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyCapability } from '../../modules/buddy/buddy.constants';
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
import { ClaudeSetupTokenConfigValidatorService } from './services/claude-setup-token-config-validator.service';

@ApiTag({
	tagName: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME,
	displayName: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_NAME,
	description: BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [ClaudeSetupTokenProvider, ClaudeSetupTokenConfigValidatorService],
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
			capabilities: [BuddyCapability.LLM],
			name: 'Claude Setup Token',
			description: 'LLM provider for Buddy module using Anthropic Claude with setup-token authentication',
			author: 'FastyBird',
			readme: `# Claude (Setup Token)

> Plugin · by FastyBird · capability: LLM

Alternative Claude provider that authenticates with a setup token issued by your Claude subscription instead of an API key — useful when you have access to Claude through Claude Code rather than the API console, and don't want to pay for a separate Anthropic API key.

## What you get

- Use a Claude *subscription* you already have for Buddy chat, no Anthropic API key required
- Same streaming and tool-calling behaviour as the regular Claude plugin — switching between the two is config-only
- Automatic credential refresh — the plugin keeps the setup token valid in the background

## Capabilities

- **LLM (chat)** — streaming completions; native tool calling for device / scene control
- **Drop-in alternative** — interchangeable with the regular \`buddy-claude\` plugin from Buddy's point of view

## Setup

1. Install the [Claude Code CLI](https://docs.claude.com/claude-code) and sign in
2. Run \`claude setup-token\` and copy the generated token
3. Paste the token into this plugin's configuration
4. Set the Buddy module's \`provider\` to \`${BUDDY_CLAUDE_SETUP_TOKEN_PLUGIN_NAME}\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`setup_token\` | Token from \`claude setup-token\` (required) | — |
| \`model\` | Claude model to use | \`claude-sonnet-4-20250514\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
