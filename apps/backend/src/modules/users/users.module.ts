import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { ListUsersCommand } from './commands/list-users.command';
import { UsersController } from './controllers/users.controller';
import { DisplayEntity, UserEntity } from './entities/users.entity';
import { RolesGuard } from './guards/roles.guard';
import { DisplaysService } from './services/displays.service';
import { ModuleResetService } from './services/module-reset.service';
import { UsersService } from './services/users.service';
import { USERS_MODULE_NAME } from './users.constants';
import { UserExistsConstraintValidator } from './validators/user-exists-constraint.validator';

@Module({
	imports: [TypeOrmModule.forFeature([UserEntity, DisplayEntity]), SystemModule],
	providers: [
		UsersService,
		DisplaysService,
		UserExistsConstraintValidator,
		ListUsersCommand,
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
		ModuleResetService,
	],
	controllers: [UsersController],
	exports: [UsersService, DisplaysService, UserExistsConstraintValidator],
})
export class UsersModule {
	constructor(
		private readonly moduleReset: ModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
	) {}

	onModuleInit() {
		this.factoryResetRegistry.register(
			USERS_MODULE_NAME,
			300,
			async (): Promise<{ success: boolean; reason?: string }> => {
				return this.moduleReset.reset();
			},
		);
	}
}
