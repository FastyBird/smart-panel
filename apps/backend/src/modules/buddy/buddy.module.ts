import { Inject, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { EnergyModule } from '../energy/energy.module';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ScenesModule } from '../scenes/scenes.module';
import { SpacesModule } from '../spaces/spaces.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { WeatherModule } from '../weather/weather.module';

import { BUDDY_MODULE_API_TAG_DESCRIPTION, BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME } from './buddy.constants';
import { BUDDY_SWAGGER_EXTRA_MODELS } from './buddy.openapi';
import { BuddyConversationsController } from './controllers/buddy-conversations.controller';
import { BuddySuggestionsController } from './controllers/buddy-suggestions.controller';
import { UpdateBuddyConfigDto } from './dto/update-config.dto';
import { BuddyConversationEntity } from './entities/buddy-conversation.entity';
import { BuddyMessageEntity } from './entities/buddy-message.entity';
import { IntentEventListener } from './listeners/intent-event.listener';
import { BuddyConfigModel } from './models/config.model';
import { ActionObserverService } from './services/action-observer.service';
import { AnomalyDetectorEvaluator } from './services/anomaly-detector.service';
import { BuddyContextService } from './services/buddy-context.service';
import { BuddyConversationService } from './services/buddy-conversation.service';
import { ConflictDetectorEvaluator } from './services/conflict-detector-evaluator.service';
import { EnergyEvaluator } from './services/energy-evaluator.service';
import { HeartbeatService } from './services/heartbeat.service';
import { LlmProviderRegistryService } from './services/llm-provider-registry.service';
import { LlmProviderService } from './services/llm-provider.service';
import { PatternDetectorService } from './services/pattern-detector.service';
import { SceneSuggestionEvaluator } from './services/scene-suggestion-evaluator.service';
import { SttProviderService } from './services/stt-provider.service';
import { SuggestionEngineService } from './services/suggestion-engine.service';

@ApiTag({
	tagName: BUDDY_MODULE_NAME,
	displayName: BUDDY_MODULE_API_TAG_NAME,
	description: BUDDY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([BuddyConversationEntity, BuddyMessageEntity]),
		ConfigModule,
		SwaggerModule,
		ExtensionsModule,
		forwardRef(() => SpacesModule),
		forwardRef(() => DevicesModule),
		forwardRef(() => ScenesModule),
		WeatherModule,
		EnergyModule,
	],
	controllers: [BuddyConversationsController, BuddySuggestionsController],
	providers: [
		ActionObserverService,
		BuddyContextService,
		IntentEventListener,
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
	],
	exports: [
		ActionObserverService,
		BuddyContextService,
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
	],
})
export class BuddyModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
		@Inject(HeartbeatService) private readonly heartbeatService: HeartbeatService,
		@Inject(PatternDetectorService) private readonly patternDetector: PatternDetectorService,
		@Inject(AnomalyDetectorEvaluator) private readonly anomalyDetector: AnomalyDetectorEvaluator,
		@Inject(EnergyEvaluator) private readonly energyEvaluator: EnergyEvaluator,
		@Inject(ConflictDetectorEvaluator) private readonly conflictDetector: ConflictDetectorEvaluator,
		@Inject(SceneSuggestionEvaluator) private readonly sceneSuggestion: SceneSuggestionEvaluator,
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
- **Suggestions** - Context-aware suggestions based on detected patterns and rules
- **Voice Input** - Speech-to-text via Whisper API or local Whisper for voice messages
- **Offline-First** - Rule-based suggestions work without any AI provider configured

## LLM Provider Plugins

Chat functionality is powered by separate provider plugins:

- **buddy-openai-plugin** - OpenAI API (GPT models)
- **buddy-claude-plugin** - Anthropic Claude API
- **buddy-ollama-plugin** - Local LLM inference via Ollama

Install and enable the desired provider plugin, then set the buddy module \`provider\` config to the plugin type.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
