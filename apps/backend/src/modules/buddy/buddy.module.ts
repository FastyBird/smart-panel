import { resolve } from 'path';

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

import {
	BUDDY_DEFAULT_PERSONALITY_PATH,
	BUDDY_MODULE_API_TAG_DESCRIPTION,
	BUDDY_MODULE_API_TAG_NAME,
	BUDDY_MODULE_NAME,
} from './buddy.constants';
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

		// Register backup contribution for AI personality file
		this.backupRegistry.register({
			source: BUDDY_MODULE_NAME,
			label: 'AI Personality',
			type: 'file',
			path: resolve(process.cwd(), BUDDY_DEFAULT_PERSONALITY_PATH),
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

## Plugins

All LLM, TTS, and STT functionality is provided by separate plugins that register themselves with the buddy module. Install and enable the desired plugins, then set the buddy module \`provider\`, \`tts_plugin\`, and \`stt_plugin\` configs to the corresponding plugin type.

Each plugin declares its capabilities (LLM, TTS, STT) when registering, and the buddy module discovers them dynamically.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
