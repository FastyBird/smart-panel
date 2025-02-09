import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebsocketModule } from '../websocket/websocket.module';

import { ListUsersCommand } from './commands/list-users.command';
import { UsersController } from './controllers/users.controller';
import { UserEntity } from './entities/users.entity';
import { RolesGuard } from './guards/roles.guard';
import { UsersService } from './services/users.service';

@Module({
	imports: [TypeOrmModule.forFeature([UserEntity]), WebsocketModule],
	providers: [
		UsersService,
		ListUsersCommand,
		{
			provide: APP_GUARD,
			useClass: RolesGuard,
		},
	],
	controllers: [UsersController],
	exports: [UsersService],
})
export class UsersModule {}
