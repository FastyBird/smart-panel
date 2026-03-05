import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyModule } from '../../modules/buddy/buddy.module';
import { BuddyCapability } from '../../modules/buddy/buddy.constants';
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
import { ElevenLabsTtsProvider } from './platforms/elevenlabs-tts.provider';

@ApiTag({
	tagName: BUDDY_ELEVENLABS_PLUGIN_NAME,
	displayName: BUDDY_ELEVENLABS_PLUGIN_API_TAG_NAME,
	description: BUDDY_ELEVENLABS_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [ElevenLabsTtsProvider],
	exports: [ElevenLabsTtsProvider],
})
export class BuddyElevenlabsPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly ttsProviderRegistry: TtsProviderRegistryService,
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

		this.ttsProviderRegistry.register(this.elevenlabsTtsProvider);

		for (const model of BUDDY_ELEVENLABS_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_ELEVENLABS_PLUGIN_NAME,
			name: 'Buddy ElevenLabs',
			description: 'TTS provider for Buddy module using ElevenLabs API',
			author: 'FastyBird',
			capabilities: [BuddyCapability.TTS],
			readme: `# Buddy ElevenLabs Provider

TTS provider plugin for the Buddy module using the ElevenLabs API.

## Features

- **High-Quality Voices** - Natural-sounding text-to-speech
- **Multiple Voices** - Choose from various voice profiles

## Setup

1. Create an account at [ElevenLabs](https://elevenlabs.io)
2. Generate an API key from your account dashboard
3. Enter the API key in plugin configuration
4. Set the buddy module \`tts_plugin\` to \`${BUDDY_ELEVENLABS_PLUGIN_NAME}\`

## Configuration

- **API Key** - Your ElevenLabs API key (required)
- **Voice ID** - ElevenLabs voice ID (default: Rachel)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
