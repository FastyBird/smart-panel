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
import { BuddyContextCacheListener } from './listeners/buddy-context-cache.listener';
import { IntentEventListener } from './listeners/intent-event.listener';
import { MediaActivityEventListener } from './listeners/media-activity-event.listener';
import { BuddyConfigModel } from './models/config.model';
import { ActionObserverService } from './services/action-observer.service';
import { AnomalyDetectorEvaluator } from './services/anomaly-detector.service';
import { BuddyContextService } from './services/buddy-context.service';
import { BuddyConversationService } from './services/buddy-conversation.service';
import { BuddyProviderStatusService } from './services/buddy-provider-status.service';
import { ConflictDetectorEvaluator } from './services/conflict-detector-evaluator.service';
import { EnergyEvaluator } from './services/energy-evaluator.service';
import { HeartbeatService } from './services/heartbeat.service';
import { LlmProviderRegistryService } from './services/llm-provider-registry.service';
import { LlmProviderService } from './services/llm-provider.service';
import { OAuthCallbackService } from './services/oauth-callback.service';
import { OAuthFlowService } from './services/oauth-flow.service';
import { BuddyPersonalityService } from './services/buddy-personality.service';
import { PatternDetectorService } from './services/pattern-detector.service';
import { SceneSuggestionEvaluator } from './services/scene-suggestion-evaluator.service';
import { SttProviderService } from './services/stt-provider.service';
import { SuggestionEngineService } from './services/suggestion-engine.service';
import { TtsProviderRegistryService } from './services/tts-provider-registry.service';
import { TtsProviderService } from './services/tts-provider.service';
import { EvaluatorRulesLoaderService } from './spec/evaluator-rules-loader.service';

@ApiTag({
	tagName: BUDDY_MODULE_NAME,
	displayName: BUDDY_MODULE_API_TAG_NAME,
	description: BUDDY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([BuddyConversationEntity, BuddyMessageEntity]),
		SwaggerModule,
		SpacesModule,
		DevicesModule,
		ScenesModule,
		IntentsModule,
		ToolsModule,
		WeatherModule,
		EnergyModule,
	],
	controllers: [BuddyConversationsController, BuddyPersonalityController, BuddyProvidersController, BuddySuggestionsController],
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
		SttProviderService,
		TtsProviderRegistryService,
		TtsProviderService,
		OAuthCallbackService,
		OAuthFlowService,
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
		private readonly heartbeatService: HeartbeatService,
		private readonly patternDetector: PatternDetectorService,
		private readonly anomalyDetector: AnomalyDetectorEvaluator,
		private readonly energyEvaluator: EnergyEvaluator,
		private readonly conflictDetector: ConflictDetectorEvaluator,
		private readonly sceneSuggestion: SceneSuggestionEvaluator,
	) {}

	onModuleInit() {
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
			readme: `# Buddy Module

The Buddy module provides an AI assistant for the Smart Panel that observes user actions, learns patterns, and suggests automations.

## Features

- **Action Observer** - Tracks completed intents to build a history of user actions
- **Context Aggregation** - Builds structured snapshots of home state (spaces, devices, scenes, weather, energy)
- **Text Chat** - Conversational interface powered by pluggable LLM providers
- **Voice Interface** - Optional STT/TTS for hands-free interaction via pluggable providers
- **Tool Execution** - LLM can control devices, run scenes, and set lighting modes via extensible tool providers
- **Suggestions** - Context-aware suggestions based on detected patterns and rules
- **Offline-First** - Rule-based suggestions work without any AI provider configured

## LLM Provider Plugins

Chat functionality is powered by separate provider plugins:

- **buddy-openai-plugin** - OpenAI API (GPT models + TTS)
- **buddy-claude-plugin** - Anthropic Claude API
- **buddy-ollama-plugin** - Local LLM inference via Ollama

## TTS Provider Plugins

Voice output is powered by separate TTS plugins:

- **buddy-openai-plugin** - OpenAI TTS API
- **buddy-elevenlabs-plugin** - ElevenLabs API
- **buddy-system-tts-plugin** - Local piper/espeak

Install and enable the desired plugins, then set the buddy module \`provider\` and \`tts_plugin\` configs.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
