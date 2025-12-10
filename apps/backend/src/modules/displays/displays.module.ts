import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
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
} from './displays.constants';
import { DISPLAYS_SWAGGER_EXTRA_MODELS } from './displays.openapi';
import { UpdateDisplaysConfigDto } from './dto/update-config.dto';
import { DisplayEntity } from './entities/displays.entity';
import { RegistrationGuard } from './guards/registration.guard';
import { DisplaysConfigModel } from './models/config.model';
import { DisplaysService } from './services/displays.service';
import { DisplaysModuleResetService } from './services/module-reset.service';
import { PermitJoinService } from './services/permit-join.service';
import { RegistrationService } from './services/registration.service';
import { DisplayExistsConstraint } from './validators/display-exists-constraint.validator';

@ApiTag({
	tagName: DISPLAYS_MODULE_NAME,
	displayName: DISPLAYS_MODULE_API_TAG_NAME,
	description: DISPLAYS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [NestConfigModule, TypeOrmModule.forFeature([DisplayEntity]), AuthModule, ConfigModule, SystemModule],
	controllers: [DisplaysController, RegistrationController],
	providers: [
		DisplaysService,
		RegistrationService,
		DisplaysModuleResetService,
		DisplayExistsConstraint,
		PermitJoinService,
		RegistrationGuard,
	],
	exports: [DisplaysService, DisplaysModuleResetService, DisplayExistsConstraint, PermitJoinService],
})
export class DisplaysModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: DisplaysModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
	) {}

	onModuleInit() {
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
