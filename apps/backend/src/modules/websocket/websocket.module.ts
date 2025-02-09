import { Module } from '@nestjs/common';

import { WebsocketGateway } from './gateway/websocket.gateway';
import { CommandEventRegistryService } from './services/command-event-registry.service';

@Module({
	providers: [WebsocketGateway, CommandEventRegistryService],
	exports: [WebsocketGateway, CommandEventRegistryService],
})
export class WebsocketModule {}
