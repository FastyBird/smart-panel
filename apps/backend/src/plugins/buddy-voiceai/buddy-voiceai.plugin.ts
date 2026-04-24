import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyCapability } from '../../modules/buddy/buddy.constants';
import { BuddyModule } from '../../modules/buddy/buddy.module';
import { TtsProviderRegistryService } from '../../modules/buddy/services/tts-provider-registry.service';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	BUDDY_VOICEAI_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_VOICEAI_PLUGIN_API_TAG_NAME,
	BUDDY_VOICEAI_PLUGIN_NAME,
} from './buddy-voiceai.constants';
import { BUDDY_VOICEAI_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-voiceai.openapi';
import { UpdateBuddyVoiceaiConfigDto } from './dto/update-config.dto';
import { BuddyVoiceaiConfigModel } from './models/config.model';
import { VoiceaiTtsProvider } from './platforms/voiceai-tts.provider';
import { VoiceaiConfigValidatorService } from './services/voiceai-config-validator.service';

@ApiTag({
	tagName: BUDDY_VOICEAI_PLUGIN_NAME,
	displayName: BUDDY_VOICEAI_PLUGIN_API_TAG_NAME,
	description: BUDDY_VOICEAI_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [VoiceaiTtsProvider, VoiceaiConfigValidatorService],
	exports: [VoiceaiTtsProvider],
})
export class BuddyVoiceaiPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly ttsProviderRegistry: TtsProviderRegistryService,
		private readonly voiceaiTtsProvider: VoiceaiTtsProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyVoiceaiConfigModel, UpdateBuddyVoiceaiConfigDto>({
			type: BUDDY_VOICEAI_PLUGIN_NAME,
			class: BuddyVoiceaiConfigModel,
			configDto: UpdateBuddyVoiceaiConfigDto,
		});

		this.ttsProviderRegistry.register(this.voiceaiTtsProvider);

		for (const model of BUDDY_VOICEAI_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_VOICEAI_PLUGIN_NAME,
			name: 'Voice.ai',
			description: 'TTS provider for Buddy module using Voice.ai API',
			author: 'FastyBird',
			capabilities: [BuddyCapability.TTS],
			readme: `# Voice.ai

> Plugin · by FastyBird · capability: TTS

Voice.ai as a text-to-speech provider for the Buddy module. Synthesises Buddy's spoken replies with a natural-sounding voice — including custom cloned voices if you have set them up in your Voice.ai account.

## What you get

- Studio-grade synthesis that turns Buddy from text-only into a real voice on the panel speaker
- Voice cloning support — train a voice on Voice.ai once, then point this plugin at the resulting voice ID
- Multiple audio formats so the plugin can hand the panel exactly what it can play without a server-side re-encode
- A clean handoff with Buddy's chat / tool layer: the assistant generates the reply, this plugin turns it into audio

## Capabilities

- **TTS only** — pair with any LLM provider (Claude, OpenAI, Ollama, …) and any STT provider
- **Per-deployment voice** — pick the voice ID once; every panel using this backend uses the same voice
- **Streaming** where supported by the chosen voice / format, so playback can start before synthesis completes

## Setup

1. Create an account at [Voice.ai](https://voice.ai)
2. Generate an API key in your dashboard
3. Enter the API key and a voice ID in this plugin's configuration (use the Voice.ai API to list available voices)
4. Set Buddy's \`tts_plugin\` to \`${BUDDY_VOICEAI_PLUGIN_NAME}\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`api_key\` | Voice.ai API key (required) | — |
| \`voice_id\` | Voice.ai voice ID (required) | — |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
