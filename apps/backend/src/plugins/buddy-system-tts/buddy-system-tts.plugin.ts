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
	BUDDY_SYSTEM_TTS_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_SYSTEM_TTS_PLUGIN_API_TAG_NAME,
	BUDDY_SYSTEM_TTS_PLUGIN_NAME,
} from './buddy-system-tts.constants';
import { BUDDY_SYSTEM_TTS_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-system-tts.openapi';
import { UpdateBuddySystemTtsConfigDto } from './dto/update-config.dto';
import { BuddySystemTtsConfigModel } from './models/config.model';
import { SystemTtsProvider } from './platforms/system-tts.provider';

@ApiTag({
	tagName: BUDDY_SYSTEM_TTS_PLUGIN_NAME,
	displayName: BUDDY_SYSTEM_TTS_PLUGIN_API_TAG_NAME,
	description: BUDDY_SYSTEM_TTS_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [SystemTtsProvider],
	exports: [SystemTtsProvider],
})
export class BuddySystemTtsPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly ttsProviderRegistry: TtsProviderRegistryService,
		private readonly systemTtsProvider: SystemTtsProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddySystemTtsConfigModel, UpdateBuddySystemTtsConfigDto>({
			type: BUDDY_SYSTEM_TTS_PLUGIN_NAME,
			class: BuddySystemTtsConfigModel,
			configDto: UpdateBuddySystemTtsConfigDto,
		});

		this.ttsProviderRegistry.register(this.systemTtsProvider);

		for (const model of BUDDY_SYSTEM_TTS_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_SYSTEM_TTS_PLUGIN_NAME,
			name: 'Buddy System TTS',
			description: 'Local TTS provider using piper or espeak',
			author: 'FastyBird',
			capabilities: [BuddyCapability.TTS],
			readme: `# Buddy System TTS Provider

Local TTS provider plugin for the Buddy module using system-installed speech synthesizers.

## Features

- **Piper** - High-quality neural TTS (preferred when available)
- **eSpeak** - Lightweight fallback TTS
- **No API Key Required** - Runs entirely locally

## Setup

1. Install piper or espeak on your system
2. Enable this plugin
3. Set the buddy module \`tts_plugin\` to \`${BUDDY_SYSTEM_TTS_PLUGIN_NAME}\`

## Configuration

- **Engine** - Preferred engine: piper or espeak (auto-detected if not set)
- **Voice** - Voice identifier (piper model name or espeak voice code)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
