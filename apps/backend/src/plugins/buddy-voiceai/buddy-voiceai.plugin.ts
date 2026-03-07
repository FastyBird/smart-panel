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

@ApiTag({
	tagName: BUDDY_VOICEAI_PLUGIN_NAME,
	displayName: BUDDY_VOICEAI_PLUGIN_API_TAG_NAME,
	description: BUDDY_VOICEAI_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [VoiceaiTtsProvider],
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
			readme: `# Buddy Voice.ai Provider

TTS provider plugin for the Buddy module using the Voice.ai API.

## Features

- **AI Voice Cloning** - Create custom voices from audio samples
- **High-Quality TTS** - Natural-sounding text-to-speech synthesis
- **Multiple Output Formats** - MP3, WAV, and PCM audio support

## Setup

1. Create an account at [Voice.ai](https://voice.ai)
2. Generate an API key from your dashboard
3. Enter the API key in plugin configuration
4. Set a voice ID (use the Voice.ai API to list available voices)
5. Set the buddy module \`tts_plugin\` to \`${BUDDY_VOICEAI_PLUGIN_NAME}\`

## Configuration

- **API Key** - Your Voice.ai API key (required)
- **Voice ID** - Voice.ai voice ID (required)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
