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
	BUDDY_STT_WHISPER_API_PLUGIN_API_TAG_DESCRIPTION,
	BUDDY_STT_WHISPER_API_PLUGIN_API_TAG_NAME,
	BUDDY_STT_WHISPER_API_PLUGIN_NAME,
} from './buddy-stt-whisper-api.constants';
import { BUDDY_STT_WHISPER_API_PLUGIN_SWAGGER_EXTRA_MODELS } from './buddy-stt-whisper-api.openapi';
import { UpdateBuddySttWhisperApiConfigDto } from './dto/update-config.dto';
import { BuddySttWhisperApiConfigModel } from './models/config.model';
import { WhisperApiSttProvider } from './platforms/whisper-api-stt.provider';

@ApiTag({
	tagName: BUDDY_STT_WHISPER_API_PLUGIN_NAME,
	displayName: BUDDY_STT_WHISPER_API_PLUGIN_API_TAG_NAME,
	description: BUDDY_STT_WHISPER_API_PLUGIN_API_TAG_DESCRIPTION,
})
@Module({
	imports: [BuddyModule, ConfigModule, SwaggerModule, ExtensionsModule],
	providers: [WhisperApiSttProvider],
	exports: [WhisperApiSttProvider],
})
export class BuddySttWhisperApiPlugin implements OnModuleInit {
	constructor(
		private readonly configMapper: PluginsTypeMapperService,
		private readonly sttProviderRegistry: SttProviderRegistryService,
		private readonly whisperApiSttProvider: WhisperApiSttProvider,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.configMapper.registerMapping<BuddySttWhisperApiConfigModel, UpdateBuddySttWhisperApiConfigDto>({
			type: BUDDY_STT_WHISPER_API_PLUGIN_NAME,
			class: BuddySttWhisperApiConfigModel,
			configDto: UpdateBuddySttWhisperApiConfigDto,
		});

		this.sttProviderRegistry.register(this.whisperApiSttProvider);

		for (const model of BUDDY_STT_WHISPER_API_PLUGIN_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerPluginMetadata({
			type: BUDDY_STT_WHISPER_API_PLUGIN_NAME,
			name: 'Buddy Whisper API',
			description: 'STT provider for Buddy module using OpenAI Whisper API',
			author: 'FastyBird',
			capabilities: [BuddyCapability.STT],
			readme: `# Buddy Whisper API STT Provider

Speech-to-text provider plugin for the Buddy module using the OpenAI Whisper API.

## Setup

1. Get an API key from [OpenAI](https://platform.openai.com)
2. Enter the API key in plugin configuration
3. Set the buddy module \`stt_plugin\` to \`${BUDDY_STT_WHISPER_API_PLUGIN_NAME}\`

## Configuration

- **API Key** - Your OpenAI API key (required)
- **Model** - Whisper model name (default: whisper-1)
- **Language** - ISO 639-1 language hint (optional, e.g. en, cs)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
