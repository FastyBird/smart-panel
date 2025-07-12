import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService as NestConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { DEFAULT_TOKEN_EXPIRATION, DEFAULT_TOKEN_SECRET } from '../../app.constants';
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
					secret: getEnvValue<string | undefined>(configService, 'FB_TOKEN_SECRET', DEFAULT_TOKEN_SECRET),
					signOptions: { expiresIn: DEFAULT_TOKEN_EXPIRATION },
				};
			},
		}),
		forwardRef(() => AuthModule),
		forwardRef(() => UsersModule),
	],
	providers: [WebsocketGateway, CommandEventRegistryService, WsAuthService],
	exports: [WebsocketGateway, CommandEventRegistryService],
})
export class WebsocketModule {}
