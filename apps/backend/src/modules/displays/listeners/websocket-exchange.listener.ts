import { Injectable, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger';
import { TokenOwnerType } from '../../auth/auth.constants';
import { WsClientDto } from '../../websocket/dto/ws-client.dto';
import { WsEventType } from '../../websocket/websocket.constants';
import { ConnectionState, DISPLAYS_MODULE_NAME } from '../displays.constants';
import { DisplayConnectionStateService } from '../services/display-connection-state.service';
import { DisplaysService } from '../services/displays.service';

@Injectable()
export class WebsocketExchangeListener implements OnModuleInit {
	private readonly logger = createExtensionLogger(DISPLAYS_MODULE_NAME, 'WebsocketExchangeListener');

	constructor(
		private readonly displaysService: DisplaysService,
		private readonly displayConnectionStateService: DisplayConnectionStateService,
	) {}

	onModuleInit() {
		this.logger.debug('Websocket exchange listener initialized');
	}

	@OnEvent(WsEventType.CLIENT_CONNECTED)
	async handleClientConnected(payload: WsClientDto): Promise<void> {
		try {
			// Only process display connections
			if (
				payload.user &&
				payload.user.type === 'token' &&
				payload.user.ownerType === TokenOwnerType.DISPLAY &&
				payload.user.id
			) {
				const display = await this.displaysService.findOne(payload.user.id);
				if (!display) {
					this.logger.warn(`Display not found: ${payload.user.id}`);
					return;
				}

				// Update current IP address if provided
				if (payload.ipAddress && payload.ipAddress !== 'unknown') {
					await this.displaysService.update(payload.user.id, { currentIpAddress: payload.ipAddress });
					this.logger.debug(`Updated current IP address for display=${payload.user.id} to ${payload.ipAddress}`);
				}

				// Write connection state to InfluxDB
				await this.displayConnectionStateService.write(display, ConnectionState.CONNECTED);
				this.logger.debug(`Updated connection state for display=${payload.user.id} to CONNECTED`);
			}
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to handle client connected event: ${err.message}`, err.stack);
		}
	}

	@OnEvent(WsEventType.CLIENT_DISCONNECTED)
	async handleClientDisconnected(payload: WsClientDto): Promise<void> {
		try {
			// Only process display disconnections
			if (
				payload.user &&
				payload.user.type === 'token' &&
				payload.user.ownerType === TokenOwnerType.DISPLAY &&
				payload.user.id
			) {
				const display = await this.displaysService.findOne(payload.user.id);
				if (!display) {
					this.logger.warn(`Display not found: ${payload.user.id}`);
					return;
				}

				// Write disconnection state to InfluxDB
				await this.displayConnectionStateService.write(display, ConnectionState.DISCONNECTED);
				this.logger.debug(`Updated connection state for display=${payload.user.id} to DISCONNECTED`);
			}
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to handle display disconnect: ${err.message}`, err.stack);
		}
	}

	@OnEvent(WsEventType.CLIENT_LOST)
	async handleClientLost(payload: WsClientDto): Promise<void> {
		try {
			// Only process display connections
			if (
				payload.user &&
				payload.user.type === 'token' &&
				payload.user.ownerType === TokenOwnerType.DISPLAY &&
				payload.user.id
			) {
				const display = await this.displaysService.findOne(payload.user.id);
				if (!display) {
					this.logger.warn(`Display not found: ${payload.user.id}`);
					return;
				}

				// Write lost connection state to InfluxDB
				await this.displayConnectionStateService.write(display, ConnectionState.LOST);
				this.logger.debug(`Updated connection state for display=${payload.user.id} to LOST`);
			}
		} catch (error) {
			const err = error as Error;
			this.logger.warn(`Failed to handle display connection lost: ${err.message}`, err.stack);
		}
	}
}
