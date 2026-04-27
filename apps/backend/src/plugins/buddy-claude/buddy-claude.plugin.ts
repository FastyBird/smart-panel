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
import { ClaudeConfigValidatorService } from './services/claude-config-validator.service';

@ApiTag({
	tagName: BUDDY_CLAUDE_PLUGIN_NAME,
	displayName: BUDDY_CLAUDE_PLUGIN_API_TAG_NAME,
	description: BUDDY_CLAUDE_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [ClaudeProvider, ClaudeConfigValidatorService],
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
			name: 'Claude',
			description: 'LLM provider for Buddy module using Anthropic Claude API',
			author: 'FastyBird',
			readme: `# Claude

> Plugin · by FastyBird · capability: LLM

Anthropic Claude as an LLM provider for the Buddy module. Powers chat conversations with Claude Sonnet, Opus or Haiku — picking the model is a single config change.

## What you get

- Streaming chat replies grounded on your home's real context (spaces, devices, weather, energy)
- Native tool calling so Claude can run scenes, control devices and adjust lighting modes through the registered Buddy tools
- A predictable, low-noise assistant — Claude tends to refuse confidently rather than make things up
- A simple privacy posture: requests are only sent when the user actually talks to Buddy; no background telemetry from this plugin

## Capabilities

- **Streaming responses** — answers stream token-by-token to the panel and admin chat
- **Tool calls** — uses Claude's native tool API; every device / scene action is a structured call, not parsed from prose
- **Configurable model** — pick any Claude model your account has access to (Sonnet for balance, Opus for hardest tasks, Haiku for fastest / cheapest)
- **Long context** — the full home snapshot fits comfortably in the prompt, so the assistant always has the latest state

## Setup

1. Create an account at [Anthropic Console](https://console.anthropic.com)
2. Generate an API key in your dashboard
3. Enter the API key in this plugin's configuration
4. Set the Buddy module's \`provider\` to \`${BUDDY_CLAUDE_PLUGIN_NAME}\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`api_key\` | Anthropic API key (required) | — |
| \`model\` | Claude model to use | \`claude-sonnet-4-20250514\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
