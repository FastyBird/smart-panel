import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

import { WebsocketGateway } from './gateway/websocket.gateway';
import { CommandEventRegistryService } from './services/command-event-registry.service';
import { WsAuthService } from './services/ws-auth.service';

@Module({
	imports: [JwtModule, AuthModule, UsersModule],
	providers: [WebsocketGateway, CommandEventRegistryService, WsAuthService],
	exports: [WebsocketGateway, CommandEventRegistryService],
})
export class WebsocketModule {}
