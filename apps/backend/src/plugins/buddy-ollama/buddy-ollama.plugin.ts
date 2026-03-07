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

@ApiTag({
	tagName: BUDDY_OLLAMA_PLUGIN_NAME,
	displayName: BUDDY_OLLAMA_PLUGIN_API_TAG_NAME,
	description: BUDDY_OLLAMA_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [OllamaProvider],
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
			readme: `# Buddy Ollama Provider

LLM provider plugin for the Buddy module using local Ollama inference.

## Features

- **Local LLM** - Run AI models locally without cloud APIs
- **Multiple Models** - Support for Llama, Mistral, CodeLlama, and more
- **No API Key Required** - Completely offline operation

## Setup

1. Install [Ollama](https://ollama.ai) on your system
2. Pull a model: \`ollama pull llama3\`
3. Enable this plugin in configuration
4. Set the buddy module \`provider\` to \`${BUDDY_OLLAMA_PLUGIN_NAME}\`

## Configuration

- **Model** - Model name to use (default: llama3)
- **Base URL** - Ollama API endpoint (default: http://localhost:11434)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
