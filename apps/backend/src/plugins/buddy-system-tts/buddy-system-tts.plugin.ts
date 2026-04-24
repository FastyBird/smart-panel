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
			name: 'System TTS',
			description: 'Local TTS provider using piper or espeak',
			author: 'FastyBird',
			capabilities: [BuddyCapability.TTS],
			readme: `# System TTS

> Plugin · by FastyBird · capability: TTS

Local text-to-speech provider that delegates synthesis to a system-installed engine — Piper for natural neural voices, eSpeak as a lightweight fallback. No API key, no network calls, no per-request fee.

## What you get

- 100% offline voice for the assistant — useful when you want full local control or on networks without outbound internet
- Free choice of voice quality vs. resource cost: Piper sounds great but needs more CPU; eSpeak is tiny and works on the most modest hardware
- Multilingual support — both engines ship voices for many languages; pick one once and the assistant uses it everywhere
- Auto-detection of which engine is actually installed, so the same configuration works across hosts that have only one of the two

## Capabilities

- **TTS only** — pair with any LLM and any STT provider
- **Multiple engines** — Piper (preferred for quality) and eSpeak (fallback for low-power hosts)
- **Streaming output** — audio is piped to the panel as soon as the engine emits it

## Setup

1. Install \`piper\` and/or \`espeak\` on the host
2. Enable this plugin
3. Set Buddy's \`tts_plugin\` to \`${BUDDY_SYSTEM_TTS_PLUGIN_NAME}\`

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`engine\` | Preferred engine (\`piper\` or \`espeak\`) | auto-detected |
| \`voice\` | Voice identifier (Piper model or eSpeak voice code) | engine default |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
