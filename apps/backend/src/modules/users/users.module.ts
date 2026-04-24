import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ModulesTypeMapperService } from '../config/services/modules-type-mapper.service';
import { ExtensionsService } from '../extensions/services/extensions.service';
import { SeedModule } from '../seed/seeding.module';
import { SeedRegistryService } from '../seed/services/seed-registry.service';
import { ApiTag } from '../swagger/decorators/api-tag.decorator';
import { SwaggerModelsRegistryService } from '../swagger/services/swagger-models-registry.service';
import { SwaggerModule } from '../swagger/swagger.module';
import { FactoryResetRegistryService } from '../system/services/factory-reset-registry.service';

import { ListUsersCommand } from './commands/list-users.command';
import { UsersController } from './controllers/users.controller';
import { UpdateUsersConfigDto } from './dto/update-config.dto';
import { UserEntity } from './entities/users.entity';
import { RolesGuard } from './guards/roles.guard';
import { UsersConfigModel } from './models/config.model';
import { ModuleResetService } from './services/module-reset.service';
import { UsersSeederService } from './services/users-seeder.service';
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
	imports: [TypeOrmModule.forFeature([UserEntity]), SwaggerModule, SeedModule],
	providers: [
		UsersService,
		UserExistsConstraintValidator,
		ListUsersCommand,
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
		ModuleResetService,
		UsersSeederService,
	],
	controllers: [UsersController],
	exports: [UsersService, UserExistsConstraintValidator],
})
export class UsersModule implements OnModuleInit {
	constructor(
		private readonly moduleReset: ModuleResetService,
		private readonly moduleSeeder: UsersSeederService,
		private readonly factoryResetRegistry: FactoryResetRegistryService,
		private readonly seedRegistry: SeedRegistryService,
		private readonly swaggerRegistry: SwaggerModelsRegistryService,
		private readonly modulesMapperService: ModulesTypeMapperService,
		private readonly extensionsService: ExtensionsService,
	) {}

	onModuleInit() {
		// Register seeder (priority 50 - users should be seeded first)
		this.seedRegistry.register(
			USERS_MODULE_NAME,
			async (): Promise<void> => {
				await this.moduleSeeder.seed();
			},
			50,
		);

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
			readme: `# Users

> Module · by FastyBird

Manages user accounts and role-based access control for the Smart Panel. The auth module verifies who you are; this module decides what you're allowed to do and stores the human-facing details (display name, email, language, avatar).

## What it gives you

- A clear role hierarchy — \`owner\` ➜ \`admin\` ➜ \`user\` — that every module can rely on through standard guards / decorators
- A bootstrapping safeguard: there is always exactly one owner; deleting or demoting it is refused
- Per-user preferences (language, theme, time-zone, dashboard layout overrides) so the same backend can serve mixed households

## Features

- **Account management** — create, update and delete user accounts; password changes are routed through the auth module's hashing logic
- **Role-based access** — \`@Roles()\` decorator and a registered guard enforce role checks across every other module without each module reinventing it
- **Profile management** — users can edit their own display name, email, password and preferences; admins can edit anyone except the owner
- **Bootstrapping** — first run promotes a single account to \`owner\` via the auth CLI; this module guarantees that role always exists
- **Factory reset** — user data (except the owner) is cleared on factory reset; the owner's password is preserved unless explicitly reset
- **Validation** — \`UserExists\` constraint exported for any module that wants to bind data to a user (favourites, preferences, audit trails)

## User Roles

| Role | Description |
|------|-------------|
| \`owner\` | Full system access; can manage every setting and other users; the only role that can perform factory reset / power actions |
| \`admin\` | Can manage devices, displays, dashboards and most configuration; cannot remove or demote the owner |
| \`user\` | Can view dashboards and operate devices they have access to; cannot change configuration |

## API Endpoints

- \`GET|POST|PATCH|DELETE /api/v1/modules/users/users\` — manage users
- \`GET /api/v1/modules/users/users/me\` — the current user's profile
- \`PATCH /api/v1/modules/users/users/me\` — update your own profile

## CLI Commands

- \`pnpm run cli users:list\` — print the configured users to the console`,
			links: {
				documentation: 'https://smart-panel.fastybird.com/docs',
				repository: 'https://github.com/FastyBird/smart-panel',
			},
		});
	}
}
