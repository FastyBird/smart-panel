import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
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
import { WeatherModule } from '../weather/weather.module';

import { BUDDY_MODULE_API_TAG_DESCRIPTION, BUDDY_MODULE_API_TAG_NAME, BUDDY_MODULE_NAME } from './buddy.constants';
import { BUDDY_SWAGGER_EXTRA_MODELS } from './buddy.openapi';
import { BuddyConversationsController } from './controllers/buddy-conversations.controller';
import { UpdateBuddyConfigDto } from './dto/update-config.dto';
import { BuddyConversationEntity } from './entities/buddy-conversation.entity';
import { BuddyMessageEntity } from './entities/buddy-message.entity';
import { IntentEventListener } from './listeners/intent-event.listener';
import { BuddyConfigModel } from './models/config.model';
import { ActionObserverService } from './services/action-observer.service';
import { BuddyContextService } from './services/buddy-context.service';
import { BuddyConversationService } from './services/buddy-conversation.service';
import { LlmProviderService } from './services/llm-provider.service';

@ApiTag({
	tagName: BUDDY_MODULE_NAME,
	displayName: BUDDY_MODULE_API_TAG_NAME,
	description: BUDDY_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([BuddyConversationEntity, BuddyMessageEntity]),
		forwardRef(() => ConfigModule),
		forwardRef(() => SpacesModule),
		forwardRef(() => DevicesModule),
		forwardRef(() => ScenesModule),
		forwardRef(() => WeatherModule),
		forwardRef(() => EnergyModule),
		ExtensionsModule,
	],
	controllers: [BuddyConversationsController],
	providers: [
		ActionObserverService,
		BuddyContextService,
		BuddyConversationService,
		LlmProviderService,
		IntentEventListener,
	],
	exports: [ActionObserverService, BuddyContextService, BuddyConversationService, LlmProviderService],
})
export class BuddyModule implements OnModuleInit {
	constructor(
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		this.modulesMapperService.registerMapping<BuddyConfigModel, UpdateBuddyConfigDto>({
			type: BUDDY_MODULE_NAME,
			class: BuddyConfigModel,
			configDto: UpdateBuddyConfigDto,
		});

		for (const model of BUDDY_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: BUDDY_MODULE_NAME,
			name: 'Buddy',
			description: 'AI buddy assistant for smart home context-aware conversations and suggestions',
			author: 'FastyBird',
			readme: `# Buddy Module

The Buddy module provides an AI assistant for the Smart Panel that observes actions, learns patterns, and offers context-aware suggestions.

## Features

- **Text Chat** - Conversational AI that understands your smart home context
- **Action Observation** - Tracks completed intents to build action history
- **Context Aggregation** - Aggregates state from spaces, devices, scenes, weather, and energy
- **Pattern Detection** - Identifies repeated action sequences (rule-based)
- **Suggestions** - Generates context-aware suggestions with cooldown management
- **Swappable LLM** - Supports Claude, OpenAI, Ollama, or rule-based only mode

## Architecture

The module observes completed intents via EventEmitter2, builds structured context from all home modules, and uses an LLM provider (or rule-based engine) to generate conversations and suggestions.`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
