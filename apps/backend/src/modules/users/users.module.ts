import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { ListUsersCommand } from './commands/list-users.command';
import { UsersController } from './controllers/users.controller';
import { UserEntity } from './entities/users.entity';
import { RolesGuard } from './guards/roles.guard';
import { ModuleResetService } from './services/module-reset.service';
import { UsersService } from './services/users.service';
import { USERS_MODULE_API_TAG_DESCRIPTION, USERS_MODULE_API_TAG_NAME, USERS_MODULE_NAME } from './users.constants';
import { USERS_SWAGGER_EXTRA_MODELS } from './users.openapi';
import { UserExistsConstraintValidator } from './validators/user-exists-constraint.validator';

@ApiTag({
	tagName: USERS_MODULE_NAME,
	displayName: USERS_MODULE_API_TAG_NAME,
	description: USERS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
	imports: [TypeOrmModule.forFeature([UserEntity]), SystemModule],
	providers: [
		UsersService,
		UserExistsConstraintValidator,
		ListUsersCommand,
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
		ModuleResetService,
	],
	controllers: [UsersController],
	exports: [UsersService, UserExistsConstraintValidator],
})
export class UsersModule {
	constructor(
		private readonly moduleReset: ModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
	) {}

	onModuleInit() {
		this.factoryResetRegistry.register(
			USERS_MODULE_NAME,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
			300,
		);

		for (const model of USERS_SWAGGER_EXTRA_MODELS) {
			this.swaggerRegistry.register(model);
		}
	}
}
