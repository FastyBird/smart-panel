import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';

import { PlatformModule } from '../platform/platform.module';
import { WebsocketModule } from '../websocket/websocket.module';

import { ConfigController } from './controllers/config.controller';
import { ConfigService } from './services/config.service';

@Module({
	imports: [NestConfigModule, WebsocketModule, PlatformModule],
	providers: [ConfigService],
	controllers: [ConfigController],
	exports: [ConfigService],
})
export class ConfigModule {}
