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
			readme: `# OpenAI

> Plugin · by FastyBird · capabilities: LLM, STT, TTS

OpenAI as an all-in-one provider for the Buddy module — chat completions via GPT, transcription via Whisper, and synthesis via the TTS API (\`alloy\`, \`echo\`, \`fable\`, \`onyx\`, \`nova\`, \`shimmer\`). One API key unlocks the whole assistant experience.

## What you get

- A single key that powers chat, voice input and voice output, so Buddy is a complete experience without juggling three providers
- High-quality streaming chat with native tool calling — the model can drive your devices and scenes through structured calls
- Server-side speech recognition with Whisper for hands-free interaction on the panel
- A choice of six TTS voices to match the personality you want for your home

## Capabilities

- **LLM (chat)** — streaming completions; native tool calls for device / scene control
- **STT (speech-to-text)** — Whisper transcription of microphone audio captured on the panel
- **TTS (text-to-speech)** — six voices, configurable per deployment
- **Per-capability fan-out** — you can use OpenAI for any subset (just LLM, just TTS, …) and pair it with other providers for the rest

## Setup

1. Create an account at [OpenAI Platform](https://platform.openai.com)
2. Generate an API key in your dashboard
3. Enter the API key in this plugin's configuration
4. Set Buddy's \`provider\`, \`stt_plugin\` and/or \`tts_plugin\` to \`${BUDDY_OPENAI_PLUGIN_NAME}\` for the capabilities you want to use

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`api_key\` | OpenAI API key (required) | — |
| \`model\` | Model used for chat completions | \`gpt-4o\` |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
