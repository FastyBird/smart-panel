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
			name: 'Whisper Local',
			description: 'STT provider for Buddy module using locally installed Whisper',
			author: 'FastyBird',
			capabilities: [BuddyCapability.STT],
			readme: `# Whisper Local

> Plugin · by FastyBird · capability: STT

Speech-to-text provider that runs OpenAI's Whisper locally via the \`whisper\` CLI. No API key, no network calls — the audio captured on the panel never leaves your network.

## What you get

- A privacy-respecting STT path: voice queries are transcribed on the host running the backend
- Free choice of model size — \`tiny\` for low-spec hardware, \`large\` for top accuracy
- Auto language detection or a fixed language hint when you know everyone in the household speaks the same one
- Drop-in replacement for cloud STT providers — pair with any LLM / TTS combination

## Capabilities

- **STT only** — pair with any LLM and any TTS provider
- **Configurable accuracy / speed** — pick the Whisper model that fits your CPU
- **Language hint** — optional, otherwise Whisper detects automatically
- **No outbound traffic** — every transcription stays on the host

## Setup

1. Install Whisper so that the \`whisper\` command is available on \`PATH\`
2. Enable this plugin
3. Set Buddy's \`stt_plugin\` to \`${BUDDY_STT_WHISPER_LOCAL_PLUGIN_NAME}\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`model\` | Whisper model size — \`tiny\`, \`base\`, \`small\`, \`medium\`, \`large\` | \`base\` |
| \`language\` | ISO 639-1 language hint (e.g. \`en\`, \`cs\`) | auto-detect |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
