import { Module } from '@nestjs/common';

import { PlatformModule } from '../platform/platform.module';
import { WebsocketModule } from '../websocket/websocket.module';

import { SystemController } from './controllers/system.controller';
import { SystemService } from './services/system.service';

@Module({
	imports: [WebsocketModule, PlatformModule],
	providers: [SystemService],
	controllers: [SystemController],
	exports: [SystemService],
})
export class SystemModule {}
