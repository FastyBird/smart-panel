import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { InfluxDbModule } from '../influxdb/influxdb.module';
import { InfluxDbService } from '../influxdb/services/influxdb.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { DisplaysController } from './controllers/displays.controller';
import { RegistrationController } from './controllers/registration.controller';
import {
	DISPLAYS_MODULE_API_TAG_DESCRIPTION,
	DISPLAYS_MODULE_API_TAG_NAME,
	DISPLAYS_MODULE_NAME,
	DisplayStatusInfluxDbSchema,
} from './displays.constants';
import { DISPLAYS_SWAGGER_EXTRA_MODELS } from './displays.openapi';
import { UpdateDisplaysConfigDto } from './dto/update-config.dto';
import { DisplayEntity } from './entities/displays.entity';
import { RegistrationGuard } from './guards/registration.guard';
import { WebsocketExchangeListener } from './listeners/websocket-exchange.listener';
import { DisplaysConfigModel } from './models/config.model';
import { DisplayConnectionStateService } from './services/display-connection-state.service';
import { DisplaysService } from './services/displays.service';
import { DisplaysModuleResetService } from './services/module-reset.service';
import { PermitJoinService } from './services/permit-join.service';
import { RegistrationService } from './services/registration.service';
import { DisplayEntitySubscriber } from './subscribers/display-entity.subscriber';
import { DisplayExistsConstraint } from './validators/display-exists-constraint.validator';

@ApiTag({
	tagName: DISPLAYS_MODULE_NAME,
	displayName: DISPLAYS_MODULE_API_TAG_NAME,
	description: DISPLAYS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [
		TypeOrmModule.forFeature([DisplayEntity]),
		AuthModule,
		ConfigModule,
		forwardRef(() => SystemModule),
		InfluxDbModule,
	],
	controllers: [DisplaysController, RegistrationController],
	providers: [
		DisplaysService,
		RegistrationService,
		DisplaysModuleResetService,
		DisplayExistsConstraint,
		PermitJoinService,
		RegistrationGuard,
		DisplayConnectionStateService,
		DisplayEntitySubscriber,
		WebsocketExchangeListener,
	],
	exports: [DisplaysService, DisplaysModuleResetService, DisplayExistsConstraint, PermitJoinService],
})
export class DisplaysModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: DisplaysModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly influxDbService: InfluxDbService,
	) {}

	onModuleInit() {
		this.influxDbService.registerSchema(DisplayStatusInfluxDbSchema);

		this.modulesMapperService.registerMapping<DisplaysConfigModel, UpdateDisplaysConfigDto>({
			type: DISPLAYS_MODULE_NAME,
			class: DisplaysConfigModel,
			configDto: UpdateDisplaysConfigDto,
		});

		this.factoryResetRegistry.register(
			DISPLAYS_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				await this.moduleReset.reset();
				return { success: true };
			},
			250, // Priority - display tokens should be revoked before users but after pages
		);

		for (const model of DISPLAYS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
