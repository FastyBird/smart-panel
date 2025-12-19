import { Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigModule } from '../config/config.module';
import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsModule } from '../extensions/extensions.module';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';
import { SystemModule } from '../system/system.module';

import { ListUsersCommand } from './commands/list-users.command';
import { UsersController } from './controllers/users.controller';
import { UpdateUsersConfigDto } from './dto/update-config.dto';
import { UserEntity } from './entities/users.entity';
import { RolesGuard } from './guards/roles.guard';
import { UsersConfigModel } from './models/config.model';
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
	imports: [
		TypeOrmModule.forFeature([UserEntity]),
		forwardRef(() => ConfigModule),
		forwardRef(() => ExtensionsModule),
		forwardRef(() => SystemModule),
		SwaggerModule,
	],
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
export class UsersModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: ModuleResetService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
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

		// Register module config mapping
		this.modulesMapperService.registerMapping<UsersConfigModel, UpdateUsersConfigDto>({
			type: USERS_MODULE_NAME,
			class: UsersConfigModel,
			configDto: UpdateUsersConfigDto,
		});

		// Register extension metadata
		this.extensionsService.registerModuleMetadata({
			type: USERS_MODULE_NAME,
			name: 'Users',
			description: 'User accounts and roles management',
			author: 'FastyBird',
			readme: `# Users Module

The Users module handles user account management and access control for the Smart Panel.

## Features

- **User Management** - Create, update, and delete user accounts
- **Role-Based Access** - Support for admin and regular user roles
- **Profile Management** - Users can update their profile information
- **Factory Reset** - User data can be cleared during factory reset

## User Roles

- **Owner** - Full system access, can manage all users and settings
- **Admin** - Can manage devices, displays, and dashboard configuration
- **User** - Basic access to view and control devices

## Security

- Passwords are securely hashed using bcrypt
- User sessions are managed through JWT tokens
- Role-based guards protect sensitive endpoints`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
