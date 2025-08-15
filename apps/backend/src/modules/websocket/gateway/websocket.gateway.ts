import { instanceToPlain } from 'class-transformer';
import { isArray } from 'class-validator';
import { Server, Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
} from '@nestjs/websockets';

import { toInstance } from '../../../common/utils/transform.utils';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../dto/client-user.dto';
import { CommandMessageDto } from '../dto/command-message.dto';
import { CommandResultDto } from '../dto/command-result.dto';
import { CommandEventRegistryService } from '../services/command-event-registry.service';
import { WsAuthService } from '../services/ws-auth.service';
import { CLIENT_DEFAULT_ROOM, DISPLAY_INTERNAL_ROOM, EXCHANGE_ROOM } from '../websocket.constants';
import { WebsocketNotAllowedException } from '../websocket.exceptions';

interface ClientData {
	user?: ClientUserDto;
}

@WebSocketGateway({
	cors: {
		origin: '*',
	},
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
	private gatewayEnabled = false;

	@WebSocketServer()
	private readonly server: Server;
	private readonly logger = new Logger(WebsocketGateway.name);

	constructor(
		private readonly commandEventRegistry: CommandEventRegistryService,
		private readonly eventEmitter: EventEmitter2,
		private readonly wsAuthService: WsAuthService,
	) {
		this.eventEmitter.onAny((event: string, payload: Record<string, any>) => {
			this.handleBusEvent(event, payload);
		});
	}

	enable() {
		this.gatewayEnabled = true;
	}

	get enabled(): boolean {
		return this.gatewayEnabled;
	}

	afterInit(): void {
		this.logger.debug('[WS GATEWAY] Websockets gateway started');
	}

	async handleConnection(client: Socket): Promise<void> {
		try {
			const isAllowed = await this.wsAuthService.validateClient(client);

			if (!isAllowed) {
				this.logger.warn(`[WS GATEWAY] Unauthorized client is trying to connect: ${client.handshake?.headers.host}`);

				client.disconnect();
			}

			this.logger.log(`[WS GATEWAY] Client connected: ${client.id}`);

			await client.join(CLIENT_DEFAULT_ROOM);

			const clientData = client.data as ClientData;

			if (clientData.user && clientData.user.role === UserRole.DISPLAY) {
				await client.join(DISPLAY_INTERNAL_ROOM);
			}
		} catch (error) {
			const err = error as Error;

			this.logger.warn(
				`[WS GATEWAY] Unauthorized client is trying to connect: ${client.handshake?.headers.host}, ${err.message}`,
			);

			client.disconnect();
		}
	}

	handleDisconnect(client: Socket): void {
		this.logger.log(`[WS GATEWAY] Client disconnected: ${client.id}`);
	}

	@SubscribeMessage('subscribe-exchange')
	async handleSubscribeExchange(
		@MessageBody() _message: CommandMessageDto,
		@ConnectedSocket() client: Socket,
	): Promise<boolean> {
		try {
			await client.join(EXCHANGE_ROOM);

			return true;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS GATEWAY] Joining exchange room failed`, { message: err.message, stack: err.stack });

			return false;
		}
	}

	@SubscribeMessage('command')
	async handleCommand(
		@MessageBody() message: CommandMessageDto,
		@ConnectedSocket() client: Socket,
	): Promise<CommandResultDto> {
		const { event, payload } = message;

		this.logger.log(`[WS GATEWAY] Received command '${event}' from client ${client.id}`);

		if (!this.commandEventRegistry.has(event)) {
			this.logger.warn(`[WS GATEWAY] No subscribers for event: ${event}`);

			return toInstance(CommandResultDto, { status: 'error', message: `Event '${event}' is not supported.` });
		}

		try {
			const handlers = this.commandEventRegistry.get(event);

			const results = (
				await Promise.all(
					handlers.map(async ({ name, handler }) => {
						try {
							const clientData = client.data as ClientData;

							const response = await handler(clientData.user, payload);

							return response !== null ? { handler: name, ...response } : null;
						} catch (error) {
							const err = error as Error;

							this.logger.error(`[WS GATEWAY] Error in '${name}'`, { message: err.message, stack: err.stack });

							if (error instanceof WebsocketNotAllowedException) {
								return { handler: name, success: false, reason: error.message };
							}

							return { handler: name, success: false, reason: 'Internal error' };
						}
					}),
				)
			).filter((result) => result !== null);

			return toInstance(
				CommandResultDto,
				{ status: 'ok', message: 'Event handled successfully', results },
				{ excludeExtraneousValues: false },
			);
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[WS GATEWAY] Error handling event: ${event}`, { message: err.message, stack: err.stack });

			return toInstance(CommandResultDto, { status: 'error', message: `Failed to handle event: ${event}` });
		}
	}

	public sendMessage(event: string, payload: Record<string, any>): void {
		if (!this.enabled) {
			return;
		}

		if (!this.server) {
			this.logger.warn('[WS GATEWAY] WebSocket server is not initialized.');

			return;
		}

		const message = {
			event,
			payload: this.transformPayload(payload),
			metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		this.logger.debug(`[WS GATEWAY] Emitting message: ${JSON.stringify(message)}`);

		this.server.emit('event', message);
	}

	private handleBusEvent(event: string, payload: Record<string, any>): void {
		if (!this.enabled) {
			return;
		}

		if (!this.server) {
			this.logger.warn('[WS GATEWAY] WebSocket server is not initialized.');

			return;
		}

		const message = {
			event,
			payload: this.transformPayload(payload),
			metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		this.logger.debug(`[WS GATEWAY] Emitting event bus message: ${JSON.stringify(message)}`);

		this.server.to(DISPLAY_INTERNAL_ROOM).emit('event', message);
		this.server.to(EXCHANGE_ROOM).emit('event', message);
	}

	private transformPayload(payload: Record<string, any>): Record<string, any> {
		// Helper function to check and transform a single item
		const transformItem = (item: unknown) =>
			item?.constructor?.name && typeof item === 'object' && item.constructor.name !== 'Object'
				? instanceToPlain(item, {
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
						ignoreDecorators: false,
						groups: ['api'],
						enableCircularCheck: true,
					})
				: item;

		// Handle arrays by mapping each item through the transformation logic
		if (isArray(payload)) {
			return payload.map(transformItem) as unknown;
		}

		// Handle single objects
		return transformItem(payload);
	}
}
