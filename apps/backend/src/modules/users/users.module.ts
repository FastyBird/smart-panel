import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ListUsersCommand } from './commands/list-users.command';
import { UsersController } from './controllers/users.controller';
import { DisplayEntity, UserEntity } from './entities/users.entity';
import { RolesGuard } from './guards/roles.guard';
import { DisplaysService } from './services/displays.service';
import { UsersService } from './services/users.service';
import { UserExistsConstraintValidator } from './validators/user-exists-constraint.validator';

@Module({
	imports: [TypeOrmModule.forFeature([UserEntity, DisplayEntity])],
	providers: [
		UsersService,
		DisplaysService,
		UserExistsConstraintValidator,
		ListUsersCommand,
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
	],
	controllers: [UsersController],
	exports: [UsersService, DisplaysService, UserExistsConstraintValidator],
})
export class UsersModule {}
