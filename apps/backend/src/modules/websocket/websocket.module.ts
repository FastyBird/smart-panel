import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { defaultTokenExpiration, defaultTokenSecret } from '../../app.constants';
import { getEnvValue } from '../../common/utils/config.utils';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

import { WebsocketGateway } from './gateway/websocket.gateway';
import { CommandEventRegistryService } from './services/command-event-registry.service';
import { WsAuthService } from './services/ws-auth.service';

@Module({
	imports: [
		JwtModule.registerAsync({
			imports: [NestConfigModule],
			inject: [NestConfigService],
			useFactory: (configService: NestConfigService) => {
				return {
					secret: getEnvValue<string | undefined>(configService, 'TOKEN_SECRET', defaultTokenSecret),
					signOptions: { expiresIn: defaultTokenExpiration },
				};
			},
		}),
		AuthModule,
		UsersModule,
	],
	providers: [WebsocketGateway, CommandEventRegistryService, WsAuthService],
	exports: [WebsocketGateway, CommandEventRegistryService],
})
export class WebsocketModule {}
