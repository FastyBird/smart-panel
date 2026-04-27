import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { EnergyModule } from '../energy/energy.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { IntentsModule } from '../intents/intents.module';
import { ScenesModule } from '../scenes/scenes.module';
import { SpacesModule } from '../spaces/spaces.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { BackupContributionRegistry } from '../system/services/backup-contribution-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { ToolsModule } from '../tools/tools.module';
import { WeatherModule } from '../weather/weather.module';

import { BUDDY_MODULE_API_TAG_DESCRIPTION, BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME } from './buddy.constants';
import { BUDDY_SWAGGER_EXTRA_MODELS } from './buddy.openapi';
import { BuddyConversationsController } from './controllers/buddy-conversations.controller';
import { BuddyPersonalityController } from './controllers/buddy-personality.controller';
import { BuddyProvidersController } from './controllers/buddy-providers.controller';
import { BuddySuggestionsController } from './controllers/buddy-suggestions.controller';
import { UpdateBuddyConfigDto } from './dto/update-config.dto';
import { BuddyConversationEntity } from './entities/buddy-conversation.entity';
import { BuddyMessageEntity } from './entities/buddy-message.entity';
import { BuddySuggestionEntity } from './entities/buddy-suggestion.entity';
import { BuddyContextCacheListener } from './listeners/buddy-context-cache.listener';
import { IntentEventListener } from './listeners/intent-event.listener';
import { MediaActivityEventListener } from './listeners/media-activity-event.listener';
import { BuddyConfigModel } from './models/config.model';
import { ActionObserverService } from './services/action-observer.service';
import { AnomalyDetectorEvaluator } from './services/anomaly-detector.service';
import { BuddyContextService } from './services/buddy-context.service';
import { BuddyConversationService } from './services/buddy-conversation.service';
import { BuddyPersonalityService } from './services/buddy-personality.service';
import { BuddyProviderStatusService } from './services/buddy-provider-status.service';
import { ConflictDetectorEvaluator } from './services/conflict-detector-evaluator.service';
import { EnergyEvaluator } from './services/energy-evaluator.service';
import { HeartbeatService } from './services/heartbeat.service';
import { LlmProviderRegistryService } from './services/llm-provider-registry.service';
import { LlmProviderService } from './services/llm-provider.service';
import { MessagingProviderStatusService } from './services/messaging-provider-status.service';
import { BuddyModuleResetService } from './services/module-reset.service';
import { OAuthCallbackService } from './services/oauth-callback.service';
import { OAuthFlowService } from './services/oauth-flow.service';
import { PatternDetectorService } from './services/pattern-detector.service';
import { SceneSuggestionEvaluator } from './services/scene-suggestion-evaluator.service';
import { SttProviderRegistryService } from './services/stt-provider-registry.service';
import { SttProviderStatusService } from './services/stt-provider-status.service';
import { SttProviderService } from './services/stt-provider.service';
import { SuggestionEngineService } from './services/suggestion-engine.service';
import { TtsProviderRegistryService } from './services/tts-provider-registry.service';
import { TtsProviderStatusService } from './services/tts-provider-status.service';
import { TtsProviderService } from './services/tts-provider.service';
import { EvaluatorRulesLoaderService } from './spec/evaluator-rules-loader.service';

@ApiTag({
	tagName: BUDDY_MODULE_NAME,
	displayName: BUDDY_MODULE_API_TAG_NAME,
	description: BUDDY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([BuddyConversationEntity, BuddyMessageEntity, BuddySuggestionEntity]),
		SwaggerModule,
		SpacesModule,
		DevicesModule,
		ScenesModule,
		IntentsModule,
		ToolsModule,
		WeatherModule,
		EnergyModule,
	],
	controllers: [
		BuddyConversationsController,
		BuddyPersonalityController,
		BuddyProvidersController,
		BuddySuggestionsController,
	],
	providers: [
		EvaluatorRulesLoaderService,
		ActionObserverService,
		BuddyContextService,
		BuddyProviderStatusService,
		BuddyPersonalityService,
		BuddyContextCacheListener,
		IntentEventListener,
		MediaActivityEventListener,
		LlmProviderRegistryService,
		LlmProviderService,
		BuddyConversationService,
		PatternDetectorService,
		SuggestionEngineService,
		HeartbeatService,
		AnomalyDetectorEvaluator,
		EnergyEvaluator,
		ConflictDetectorEvaluator,
		SceneSuggestionEvaluator,
		SttProviderRegistryService,
		SttProviderStatusService,
		SttProviderService,
		TtsProviderRegistryService,
		TtsProviderStatusService,
		TtsProviderService,
		MessagingProviderStatusService,
		OAuthCallbackService,
		OAuthFlowService,
		BuddyModuleResetService,
	],
	exports: [
		ActionObserverService,
		BuddyContextService,
		BuddyPersonalityService,
		LlmProviderRegistryService,
		LlmProviderService,
		BuddyConversationService,
		PatternDetectorService,
		SuggestionEngineService,
		HeartbeatService,
		AnomalyDetectorEvaluator,
		EnergyEvaluator,
		ConflictDetectorEvaluator,
		SceneSuggestionEvaluator,
		SttProviderRegistryService,
		TtsProviderRegistryService,
		OAuthCallbackService,
		OAuthFlowService,
	],
})
export class BuddyModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
		private readonly moduleReset: BuddyModuleResetService,
		private readonly personalityService: BuddyPersonalityService,
		private readonly backupRegistry: BackupContributionRegistry,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly heartbeatService: HeartbeatService,
		private readonly patternDetector: PatternDetectorService,
		private readonly anomalyDetector: AnomalyDetectorEvaluator,
		private readonly energyEvaluator: EnergyEvaluator,
		private readonly conflictDetector: ConflictDetectorEvaluator,
		private readonly sceneSuggestion: SceneSuggestionEvaluator,
	) {}

	onModuleInit() {
		// Register factory reset handler
		this.factoryResetRegistry.register(
			BUDDY_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			310,
		);

		// Register backup contribution for AI personality file. Resolve lazily so the
		// user-configurable personalityPath from BuddyConfig is read at backup/restore
		// time — a literal path captured here would diverge from the live location and
		// silently skip/overwrite the wrong file if the config points elsewhere.
		this.backupRegistry.register({
			source: BUDDY_MODULE_NAME,
			label: 'AI Personality',
			type: 'file',
			path: () => this.personalityService.resolvePersonalityPath(),
			optional: true,
		});

		this.heartbeatService.registerEvaluator(this.patternDetector);
		this.heartbeatService.registerEvaluator(this.anomalyDetector);
		this.heartbeatService.registerEvaluator(this.energyEvaluator);
		this.heartbeatService.registerEvaluator(this.conflictDetector);
		this.heartbeatService.registerEvaluator(this.sceneSuggestion);
		this.modulesMapperService.registerMapping<BuddyConfigModel, UpdateBuddyConfigDto>({
			type: BUDDY_MODULE_NAME,
			class: BuddyConfigModel,
			configDto: UpdateBuddyConfigDto,
		});

		for (const model of BUDDY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		this.extensionsService.registerModuleMetadata({
			type: BUDDY_MODULE_NAME,
			name: 'Buddy',
			description: 'AI assistant for proactive suggestions and text chat',
			author: 'FastyBird',
			readme: `# Buddy

> Module · by FastyBird

AI assistant for the Smart Panel. Observes user actions, builds a structured snapshot of the home, surfaces context-aware suggestions and powers a text / voice chat backed by pluggable LLM, TTS, STT and messaging providers. Buddy is the orchestration layer; the actual brains live in companion plugins so you can pick the model and provider that fit your privacy / cost / latency constraints.

## What it gives you

- A grounded assistant: every reply is prepared with a fresh, privacy-respecting snapshot of *your* home (spaces, devices, scenes, weather, energy) — not generic web knowledge
- A unified tool layer: the LLM can run scenes, control devices and set lighting modes through structured tool calls, without you wiring a new endpoint per intent
- A pluggable spine: swap LLM provider (Claude / OpenAI / Ollama / VoiceAI), voice (system / ElevenLabs / Whisper) or messaging channel (Discord / Telegram / WhatsApp) without touching this module
- A safety net: when no AI provider is configured, rule-based suggestions and the action observer keep delivering value offline

## Features

- **Action observer** — listens to completed intents and builds a rolling, anonymised history of "what happened in the home"; feeds suggestions and chat context
- **Context aggregator** — produces a structured snapshot of spaces, devices and their roles, recent scenes, current weather, energy stats and security state; the LLM sees this instead of raw rows
- **Text chat** — conversational REST endpoint backed by an LLM plugin; supports streaming responses, conversation history and per-conversation context overrides
- **Voice interface** — optional STT (microphone → text) and TTS (text → speaker) so the panel can be operated hands-free; both pluggable
- **Tool execution** — the LLM can call structured tools (e.g. \`device.control\`, \`scene.run\`, \`lighting.setMode\`); tools come from a registry other modules contribute to
- **Suggestions engine** — pattern detection, anomaly detection, energy advice and conflict detection running on the action history; results surfaced in the panel "for you" area
- **Personality file** — a writable markdown file describes how the assistant should behave; users can edit it without touching code
- **Messaging adapters** — companion plugins can route Buddy chat through Discord, Telegram or WhatsApp so you can talk to your home from anywhere
- **Offline-first defaults** — without any AI provider configured, the action observer + rule-based suggestions still work

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| \`provider\` | LLM plugin type to use for chat | — |
| \`tts_plugin\` | TTS plugin for spoken responses | — |
| \`stt_plugin\` | STT plugin for voice input | — |
| \`personality_path\` | Path to the personality markdown file (included in backups) | data dir |`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
