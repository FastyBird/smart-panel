import { Module, OnModuleInit } from '@nestjs/common';

import { BuddyCapability } from '../../modules/buddy/buddy.constants';
import { BuddyModule } from '../../modules/buddy/buddy.module';
import { SttProviderRegistryService } from '../../modules/buddy/services/stt-provider-registry.service';
import { ConfigModule } from '../../modules/config/config.module';
import { PluginsTypeMapperService } from '../../modules/config/services/plugins-type-mapper.service';
import { ExtensionsModule } from '../../modules/extensions/extensions.module';
import { ExtensionsService } from '../../modules/extensions/services/extensions.service';
import { ApiTag } from '../../modules/swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../../modules/swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../../modules/swagger/swagger.module';

import {
	BUDDY_STT_WHISPER_LOCAL_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_STT_WHISPER_LOCAL_PLUGIN_API_TAG_NAME,
	BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
} from './buddy-stt-whisper-local.constants';
import { BUDDY_STT_WHISPER_LOCAL_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-stt-whisper-local.openapi';
import { UpdateBuddySttWhisperLocalConfigDto } from './dto/update-config.dto';
import { BuddySttWhisperLocalConfigModel } from './models/config.model';
import { WhisperLocalSttProvider } from './platforms/whisper-local-stt.provider';

@ApiTag({
	tagName: BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
	displayName: BUDDY_STT_WHISPER_LOCAL_PLUGIN_API_TAG_NAME,
	description: BUDDY_STT_WHISPER_LOCAL_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [WhisperLocalSttProvider],
	exports: [WhisperLocalSttProvider],
})
export class BuddySttWhisperLocalPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly sttProviderRegistry: SttProviderRegistryService,
		private readonly whisperLocalSttProvider: WhisperLocalSttProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddySttWhisperLocalConfigModel, UpdateBuddySttWhisperLocalConfigDto>({
			type: BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
			class: BuddySttWhisperLocalConfigModel,
			configDto: UpdateBuddySttWhisperLocalConfigDto,
		});

		this.sttProviderRegistry.register(this.whisperLocalSttProvider);

		for (const model of BUDDY_STT_WHISPER_LOCAL_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME,
			name: 'Buddy Whisper Local',
			description: 'STT provider for Buddy module using locally installed Whisper',
			author: 'FastyBird',
			capabilities: [BuddyCapability.STT],
			readme: `# Buddy Local Whisper STT Provider

Speech-to-text provider plugin for the Buddy module using a locally installed Whisper CLI.

## Prerequisites

Install whisper on your system. The \`whisper\` command must be available in PATH.

## Setup

1. Install whisper on the system
2. Enable the plugin
3. Set the buddy module \`stt_plugin\` to \`${BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME}\`

## Configuration

- **Model** - Whisper model size (default: base). Options: tiny, base, small, medium, large
- **Language** - ISO 639-1 language hint (optional, e.g. en, cs)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
