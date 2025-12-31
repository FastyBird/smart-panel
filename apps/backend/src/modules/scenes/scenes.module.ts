import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { DevicesModule } from '../devices/devices.module';
import { SpacesModule } from '../spaces/spaces.module';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';
import { WebsocketModule } from '../websocket/websocket.module';

import { SceneActionsController } from './controllers/scene-actions.controller';
import { SceneConditionsController } from './controllers/scene-conditions.controller';
import { SceneTriggersController } from './controllers/scene-triggers.controller';
import { ScenesController } from './controllers/scenes.controller';
import { UpdateScenesConfigDto } from './dto/update-config.dto';
import { SceneActionEntity, SceneConditionEntity, SceneEntity, SceneTriggerEntity } from './entities/scenes.entity';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { ScenesConfigModel } from './models/config.model';
import { SCENES_MODULE_API_TAG_DESCRIPTION, SCENES_MODULE_API_TAG_NAME, SCENES_MODULE_NAME } from './scenes.constants';
import { SCENES_SWAGGER_EXTRA_MODELS } from './scenes.openapi';
import { ScenesModuleResetService } from './services/module-reset.service';
import { SceneActionsTypeMapperService } from './services/scene-actions-type-mapper.service';
import { SceneActionsService } from './services/scene-actions.service';
import { SceneConditionsService } from './services/scene-conditions.service';
import { SceneExecutorService } from './services/scene-executor.service';
import { SceneTriggersService } from './services/scene-triggers.service';
import { ScenesTypeMapperService } from './services/scenes-type-mapper.service';
import { ScenesService } from './services/scenes.service';

@ApiTag({
	tagName: SCENES_MODULE_NAME,
	displayName: SCENES_MODULE_API_TAG_NAME,
	description: SCENES_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([SceneEntity, SceneActionEntity, SceneConditionEntity, SceneTriggerEntity]),
		ConfigModule,
		forwardRef(() => SystemModule),
		forwardRef(() => DevicesModule),
		forwardRef(() => SpacesModule),
		WebsocketModule,
	],
	controllers: [ScenesController, SceneActionsController, SceneConditionsController, SceneTriggersController],
	providers: [
		// Core services
		ScenesService,
		SceneActionsService,
		SceneConditionsService,
		SceneTriggersService,
		// Type mappers for plugin system
		ScenesTypeMapperService,
		SceneActionsTypeMapperService,
		// Execution service
		SceneExecutorService,
		// Reset service
		ScenesModuleResetService,
		// WebSocket listener
		WebsocketExchangeListener,
	],
	exports: [
		ScenesService,
		SceneActionsService,
		SceneConditionsService,
		SceneTriggersService,
		ScenesTypeMapperService,
		SceneActionsTypeMapperService,
		SceneExecutorService,
		ScenesModuleResetService,
	],
})
export class ScenesModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: ScenesModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	onModuleInit(): void {
		// Register module configuration mapping
		this.modulesMapperService.registerMapping<ScenesConfigModel, UpdateScenesConfigDto>({
			type: SCENES_MODULE_NAME,
			class: ScenesConfigModel,
			configDto: UpdateScenesConfigDto,
		});

		// Register factory reset handler
		this.factoryResetRegistry.register(
			SCENES_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			300, // Priority - scenes should be reset after devices but before system data
		);

		// Register Swagger extra models
		for (const model of SCENES_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
