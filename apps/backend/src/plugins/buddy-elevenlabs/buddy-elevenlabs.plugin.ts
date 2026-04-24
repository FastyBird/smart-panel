import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyCapability } from '../../modules/buddy/buddy.constants';
import { BuddyModule } from '../../modules/buddy/buddy.module';
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
	BUDDY_ELEVENLABS_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_ELEVENLABS_PLUGIN_API_TAG_NAME,
	BUDDY_ELEVENLABS_PLUGIN_NAME,
} from './buddy-elevenlabs.constants';
import { BUDDY_ELEVENLABS_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-elevenlabs.openapi';
import { UpdateBuddyElevenlabsConfigDto } from './dto/update-config.dto';
import { BuddyElevenlabsConfigModel } from './models/config.model';
import { ElevenLabsSttProvider } from './platforms/elevenlabs-stt.provider';
import { ElevenLabsTtsProvider } from './platforms/elevenlabs-tts.provider';
import { ElevenLabsConfigValidatorService } from './services/elevenlabs-config-validator.service';

@ApiTag({
	tagName: BUDDY_ELEVENLABS_PLUGIN_NAME,
	displayName: BUDDY_ELEVENLABS_PLUGIN_API_TAG_NAME,
	description: BUDDY_ELEVENLABS_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [ElevenLabsSttProvider, ElevenLabsTtsProvider, ElevenLabsConfigValidatorService],
	exports: [ElevenLabsSttProvider, ElevenLabsTtsProvider],
})
export class BuddyElevenlabsPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly sttProviderRegistry: SttProviderRegistryService,
		private readonly ttsProviderRegistry: TtsProviderRegistryService,
		private readonly elevenlabsSttProvider: ElevenLabsSttProvider,
		private readonly elevenlabsTtsProvider: ElevenLabsTtsProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddyElevenlabsConfigModel, UpdateBuddyElevenlabsConfigDto>({
			type: BUDDY_ELEVENLABS_PLUGIN_NAME,
			class: BuddyElevenlabsConfigModel,
			configDto: UpdateBuddyElevenlabsConfigDto,
		});

		this.sttProviderRegistry.register(this.elevenlabsSttProvider);
		this.ttsProviderRegistry.register(this.elevenlabsTtsProvider);

		for (const model of BUDDY_ELEVENLABS_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_ELEVENLABS_PLUGIN_NAME,
			name: 'ElevenLabs',
			description: 'STT and TTS provider for Buddy module using ElevenLabs API',
			author: 'FastyBird',
			capabilities: [BuddyCapability.STT, BuddyCapability.TTS],
			readme: `# ElevenLabs

> Plugin · by FastyBird · capabilities: STT, TTS

ElevenLabs as both a speech-to-text and text-to-speech provider for the Buddy module. Uses the Scribe v2 model for transcription across 99 languages and ElevenLabs' high-quality neural voices for synthesis — easily the most realistic voice option in the bundle.

## What you get

- Best-in-class voice quality for the assistant's spoken replies
- Multilingual transcription with Scribe v2 (99 languages) so the panel works for non-English households out of the box
- Configurable voice — pick any ElevenLabs voice (default, premade or cloned) by pasting its voice ID
- Fully cloud-hosted: no on-device GPU required for high-quality voice

## Capabilities

- **TTS** — neural synthesis with the chosen voice; streaming where supported
- **STT** — Scribe v2 transcription with automatic language detection
- **Pair freely** — combine with any LLM provider (Claude, OpenAI, Ollama) for the chat brain

## Setup

1. Create an account at [ElevenLabs](https://elevenlabs.io)
2. Generate an API key from your dashboard
3. Enter the API key in this plugin's configuration
4. Set Buddy's \`stt_plugin\` and/or \`tts_plugin\` to \`${BUDDY_ELEVENLABS_PLUGIN_NAME}\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`api_key\` | ElevenLabs API key (required) | — |
| \`voice_id\` | Voice ID used for TTS | auto-detected |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
