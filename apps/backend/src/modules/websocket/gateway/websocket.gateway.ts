import { instanceToPlain } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { isArray, isObject } from 'class-validator';
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

import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../dto/client-user.dto';
import { CommandMessageDto } from '../dto/command-message.dto';
import { CommandResultDto } from '../dto/command-result.dto';
import { CommandEventRegistryService } from '../services/command-event-registry.service';
import { WsAuthService } from '../services/ws-auth.service';
import { CLIENT_DEFAULT_ROOM, DISPLAY_INTERNAL_ROOM } from '../websocket.constants';
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

	@SubscribeMessage('command')
	async handleCommand(
		@MessageBody() message: CommandMessageDto,
		@ConnectedSocket() client: Socket,
	): Promise<CommandResultDto> {
		const { event, payload } = message;

		this.logger.log(`[COMMAND HANDLER] Received command '${event}' from client ${client.id}`);

		if (!this.commandEventRegistry.has(event)) {
			this.logger.warn(`[COMMAND HANDLER] No subscribers for event: ${event}`);

			return plainToInstance(CommandResultDto, { status: 'error', message: `Event '${event}' is not supported.` });
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
							console.log(error);
							const err = error as Error;

							this.logger.error(`[COMMAND HANDLER] Error in '${name}'`, { message: err.message, stack: err.stack });

							if (error instanceof WebsocketNotAllowedException) {
								return { handler: name, success: false, reason: error.message };
							}

							return { handler: name, success: false, reason: 'Internal error' };
						}
					}),
				)
			).filter((result) => result !== null);

			return plainToInstance(CommandResultDto, { status: 'ok', message: 'Event handled successfully', results });
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[COMMAND HANDLER] Error handling event: ${event}`, { message: err.message, stack: err.stack });

			return plainToInstance(CommandResultDto, { status: 'error', message: `Failed to handle event: ${event}` });
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
	}

	private transformPayload(payload: Record<string, any>): Record<string, any> {
		// Helper function to check and transform a single item
		const transformItem = (item: unknown) =>
			item?.constructor?.name && typeof item === 'object' && item.constructor.name !== 'Object'
				? instanceToPlain(item, { exposeUnsetFields: false })
				: item;

		// Handle arrays by mapping each item through the transformation logic
		if (isArray(payload)) {
			return payload.map(transformItem) as unknown;
		}

		// Handle single objects
		return isObject(payload) ? transformItem(payload) : payload;
	}
}
