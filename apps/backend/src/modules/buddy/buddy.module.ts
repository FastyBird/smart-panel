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
import { LlmProviderService } from './services/llm-provider.service';
import { PatternDetectorService } from './services/pattern-detector.service';
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
		LlmProviderService,
		BuddyConversationService,
		PatternDetectorService,
		SuggestionEngineService,
		HeartbeatService,
		AnomalyDetectorEvaluator,
		EnergyEvaluator,
		ConflictDetectorEvaluator,
	],
	exports: [
		ActionObserverService,
		BuddyContextService,
		LlmProviderService,
		BuddyConversationService,
		PatternDetectorService,
		SuggestionEngineService,
		HeartbeatService,
		AnomalyDetectorEvaluator,
		EnergyEvaluator,
		ConflictDetectorEvaluator,
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
	) {}

	onModuleInit() {
		this.heartbeatService.registerEvaluator(this.patternDetector);
		this.heartbeatService.registerEvaluator(this.anomalyDetector);
		this.heartbeatService.registerEvaluator(this.energyEvaluator);
		this.heartbeatService.registerEvaluator(this.conflictDetector);
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
- **Text Chat** - Conversational interface with swappable LLM providers (Claude, OpenAI, Ollama)
- **Suggestions** - Context-aware suggestions based on detected patterns and rules
- **Offline-First** - Rule-based suggestions work without any AI provider configured

## LLM Providers

Chat functionality supports multiple providers:

- **Claude** - Anthropic's Claude API
- **OpenAI** - OpenAI API (GPT models)
- **Ollama** - Local LLM inference
- **None** - Disabled (rule-based suggestions only)`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
