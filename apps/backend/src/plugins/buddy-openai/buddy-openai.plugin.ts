import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyCapability } from '../../modules/buddy/buddy.constants';
import { BuddyModule } from '../../modules/buddy/buddy.module';
import { LlmProviderRegistryService } from '../../modules/buddy/services/llm-provider-registry.service';
import { SttProviderRegistryService } from '../../modules/buddy/services/stt-provider-registry.service';
import { TtsProviderRegistryService } from '../../modules/buddy/services/tts-provider-registry.service';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	BUDDY_OPENAI_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_OPENAI_PLUGIN_API_TAG_NAME,
	BUDDY_OPENAI_PLUGIN_NAME,
} from './buddy-openai.constants';
import { BUDDY_OPENAI_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-openai.openapi';
import { UpdateBuddyOpenaiConfigDto } from './dto/update-config.dto';
import { BuddyOpenaiConfigModel } from './models/config.model';
import { OpenAiSttProvider } from './platforms/openai-stt.provider';
import { OpenAiTtsProvider } from './platforms/openai-tts.provider';
import { OpenAiProvider } from './platforms/openai.provider';
import { OpenAiConfigValidatorService } from './services/openai-config-validator.service';

@ApiTag({
	tagName: BUDDY_OPENAI_PLUGIN_NAME,
	displayName: BUDDY_OPENAI_PLUGIN_API_TAG_NAME,
	description: BUDDY_OPENAI_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [OpenAiProvider, OpenAiSttProvider, OpenAiTtsProvider, OpenAiConfigValidatorService],
	exports: [OpenAiProvider, OpenAiSttProvider, OpenAiTtsProvider],
})
export class BuddyOpenaiPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly llmProviderRegistry: LlmProviderRegistryService,
		private readonly sttProviderRegistry: SttProviderRegistryService,
		private readonly ttsProviderRegistry: TtsProviderRegistryService,
		private readonly openAiProvider: OpenAiProvider,
		private readonly openAiSttProvider: OpenAiSttProvider,
		private readonly openAiTtsProvider: OpenAiTtsProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyOpenaiConfigModel, UpdateBuddyOpenaiConfigDto>({
			type: BUDDY_OPENAI_PLUGIN_NAME,
			class: BuddyOpenaiConfigModel,
			configDto: UpdateBuddyOpenaiConfigDto,
		});

		this.llmProviderRegistry.register(this.openAiProvider);
		this.sttProviderRegistry.register(this.openAiSttProvider);
		this.ttsProviderRegistry.register(this.openAiTtsProvider);

		for (const model of BUDDY_OPENAI_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_OPENAI_PLUGIN_NAME,
			name: 'OpenAI',
			description: 'LLM, STT, and TTS provider for Buddy module using OpenAI API',
			author: 'FastyBird',
			capabilities: [BuddyCapability.LLM, BuddyCapability.STT, BuddyCapability.TTS],
			readme: `# Buddy OpenAI Provider

LLM and TTS provider plugin for the Buddy module using the OpenAI API.

## Features

- **GPT Models** - Access to GPT-4o, GPT-4o-mini, and other OpenAI models
- **Chat Completions** - Powers Buddy text chat conversations
- **Speech-to-Text** - OpenAI Whisper API for voice input transcription
- **Text-to-Speech** - OpenAI TTS API for voice output (alloy, echo, fable, onyx, nova, shimmer voices)

## Setup

1. Create an account at [OpenAI](https://platform.openai.com)
2. Generate an API key from your account dashboard
3. Enter the API key in plugin configuration
4. Set the buddy module \`provider\` to \`${BUDDY_OPENAI_PLUGIN_NAME}\` for chat
5. Set the buddy module \`stt_plugin\` to \`${BUDDY_OPENAI_PLUGIN_NAME}\` for STT
6. Set the buddy module \`tts_plugin\` to \`${BUDDY_OPENAI_PLUGIN_NAME}\` for TTS

## Configuration

- **API Key** - Your OpenAI API key (required)
- **Model** - Model name to use (default: gpt-4o)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
