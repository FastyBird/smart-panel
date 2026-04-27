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
	BUDDY_OLLAMA_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OLLAMA_PLUGIN_API_TAG_NAME,
	BUDDY_OLLAMA_PLUGIN_NAME,
} from './buddy-ollama.constants';
import { BUDDY_OLLAMA_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-ollama.openapi';
import { UpdateBuddyOllamaConfigDto } from './dto/update-config.dto';
import { BuddyOllamaConfigModel } from './models/config.model';
import { OllamaProvider } from './platforms/ollama.provider';
import { OllamaConfigValidatorService } from './services/ollama-config-validator.service';

@ApiTag({
	tagName: BUDDY_OLLAMA_PLUGIN_NAME,
	displayName: BUDDY_OLLAMA_PLUGIN_API_TAG_NAME,
	description: BUDDY_OLLAMA_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [OllamaProvider, OllamaConfigValidatorService],
	exports: [OllamaProvider],
})
export class BuddyOllamaPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly providerRegistry: LlmProviderRegistryService,
		private readonly ollamaProvider: OllamaProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyOllamaConfigModel, UpdateBuddyOllamaConfigDto>({
			type: BUDDY_OLLAMA_PLUGIN_NAME,
			class: BuddyOllamaConfigModel,
			configDto: UpdateBuddyOllamaConfigDto,
		});

		this.providerRegistry.register(this.ollamaProvider);

		for (const model of BUDDY_OLLAMA_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_OLLAMA_PLUGIN_NAME,
			name: 'Ollama',
			description: 'LLM provider for Buddy module using local Ollama inference',
			author: 'FastyBird',
			readme: `# Ollama

> Plugin · by FastyBird · capability: LLM

Run an LLM provider locally via [Ollama](https://ollama.ai). Supports Llama, Mistral, CodeLlama and any other model Ollama can serve. No API key, no per-request fee, and — most importantly — no data leaves your network.

## What you get

- A 100% local assistant: prompts, your home snapshot and replies all stay on the host running Ollama
- Zero recurring cost — the only resource is your CPU / GPU
- Free choice of model: pull whichever Ollama-compatible model fits your hardware (\`llama3\`, \`llama3.1\`, \`mistral\`, \`qwen\`, \`phi\`, …) and switch by changing one config value
- Works with a remote Ollama server too — point \`base_url\` at any reachable host and Buddy talks to it transparently

## Capabilities

- **LLM (chat)** — streaming completions backed by Ollama
- **Tool calling** — uses Ollama's tool-call protocol where the chosen model supports it; falls back gracefully when it doesn't
- **No outbound traffic** — when Ollama runs on the same host, Buddy never reaches the public internet

## Tradeoffs

- Quality and speed depend entirely on the model and the host's hardware; small machines should pick small models
- Tool-calling fidelity varies between models; if scenes / device control aren't dispatched cleanly, try a larger / instruction-tuned model

## Setup

1. Install Ollama on the host running the backend (or any reachable machine)
2. Pull at least one model — for example \`ollama pull llama3\`
3. Enable this plugin
4. Set Buddy's \`provider\` to \`${BUDDY_OLLAMA_PLUGIN_NAME}\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`model\` | Ollama model name | \`llama3\` |
| \`base_url\` | Ollama HTTP endpoint | \`http://localhost:11434\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
