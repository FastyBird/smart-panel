import { instanceToPlain } from 'class-transformer';
import { isArray } from 'class-validator';
import { Server, Socket } from 'socket.io';

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

import { createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { ClientUserDto } from '../dto/client-user.dto';
import { CommandMessageDto } from '../dto/command-message.dto';
import { CommandResultDto } from '../dto/command-result.dto';
import { WsClientDto, WsClientEventType } from '../dto/ws-client.dto';
import { CommandEventRegistryService } from '../services/command-event-registry.service';
import { WsAuthService } from '../services/ws-auth.service';
import { extractClientIpFromSocket } from '../utils/ip.utils';
import {
	CLIENT_DEFAULT_ROOM,
	DISPLAY_INTERNAL_ROOM,
	EXCHANGE_ROOM,
	WEBSOCKET_MODULE_NAME,
	WsEventType,
} from '../websocket.constants';
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
	private readonly logger = createExtensionLogger(WEBSOCKET_MODULE_NAME, 'WebsocketGateway');

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

	get clientsCount(): number {
		return this.server?.of('/')?.sockets?.size ?? this.server?.engine?.clientsCount ?? 0;
	}

	getRoomClientsCount(room: string): number {
		return this.server?.of('/')?.adapter?.rooms?.get(room)?.size ?? 0;
	}

	afterInit(): void {
		this.logger.debug('Websockets gateway started');
	}

	async handleConnection(client: Socket): Promise<void> {
		try {
			const isAllowed = await this.wsAuthService.validateClient(client);

			if (!isAllowed) {
				this.logger.warn(`Unauthorized client is trying to connect: ${client.handshake?.headers.host}`);

				client.disconnect();
			}

			this.logger.log(`Client connected: ${client.id}`);

			await client.join(CLIENT_DEFAULT_ROOM);

			const clientData = client.data as ClientData;
			const clientIp = extractClientIpFromSocket(client);

			if (clientData.user && clientData.user.type === 'token' && clientData.user.ownerType === TokenOwnerType.DISPLAY) {
				await client.join(DISPLAY_INTERNAL_ROOM);
			}

			// Emit client connected event to exchange bus
			const wsClientDto = toInstance(WsClientDto, {
				socket_id: client.id,
				ip_address: clientIp !== 'unknown' ? clientIp : null,
				user: clientData.user || null,
				event_type: WsClientEventType.CONNECTED,
				timestamp: new Date().toISOString(),
			});

			this.eventEmitter.emit(WsEventType.CLIENT_CONNECTED, wsClientDto);
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`Unauthorized client is trying to connect: ${client.handshake?.headers.host}, ${err.message}`);

			client.disconnect();
		}
	}

	handleDisconnect(client: Socket): void {
		this.logger.log(`Client disconnected: ${client.id}`);

		const clientData = client.data as ClientData;
		const clientIp = extractClientIpFromSocket(client);

		// Emit client disconnected event to exchange bus
		const wsClientDto = toInstance(WsClientDto, {
			socket_id: client.id,
			ip_address: clientIp !== 'unknown' ? clientIp : null,
			user: clientData.user || null,
			event_type: WsClientEventType.DISCONNECTED,
			timestamp: new Date().toISOString(),
		});

		this.eventEmitter.emit(WsEventType.CLIENT_DISCONNECTED, wsClientDto);
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

			this.logger.error('Joining exchange room failed', { message: err.message, stack: err.stack });

			return false;
		}
	}

	@SubscribeMessage('command')
	async handleCommand(
		@MessageBody() message: CommandMessageDto,
		@ConnectedSocket() client: Socket,
	): Promise<CommandResultDto> {
		const { event, payload } = message;

		this.logger.log(`Received command '${event}' from client ${client.id}`);

		if (!this.commandEventRegistry.has(event)) {
			this.logger.warn(`No subscribers for event: ${event}`);

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

							this.logger.error(`Error in '${name}'`, { message: err.message, stack: err.stack });

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

			this.logger.error(`Error handling event: ${event}`, { message: err.message, stack: err.stack });

			return toInstance(CommandResultDto, { status: 'error', message: `Failed to handle event: ${event}` });
		}
	}

	public sendMessage(event: string, payload: Record<string, any>): void {
		if (!this.enabled) {
			return;
		}

		if (!this.server) {
			this.logger.warn('WebSocket server is not initialized.');

			return;
		}

		const message = {
			event,
			payload: this.transformPayload(payload),
			metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		this.logger.debug(`Emitting message: ${JSON.stringify(message)}`);

		this.server.emit('event', message);
	}

	// Internal event prefixes that should NOT be forwarded to WebSocket clients
	// These are used for internal communication between adapter services
	private static readonly INTERNAL_EVENT_PREFIXES = [
		'z2m.', // Zigbee2MQTT adapter
		'WledAdapter.', // WLED adapter
		'WledMdns.', // WLED mDNS discovery
		'shelly-v1:', // Shelly V1 adapter
		'shelly-ng:', // Shelly NG adapter
		'HaMdns.', // Home Assistant mDNS discovery
		'ha.adapter.', // Home Assistant adapter
	];

	private handleBusEvent(event: string, payload: Record<string, any>): void {
		if (!this.enabled) {
			return;
		}

		if (!this.server) {
			this.logger.warn('WebSocket server is not initialized.');

			return;
		}

		// Filter out internal adapter events that should not be sent to clients
		if (WebsocketGateway.INTERNAL_EVENT_PREFIXES.some((prefix) => event.startsWith(prefix))) {
			return;
		}

		const message = {
			event,
			payload: this.transformPayload(payload),
			metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		this.logger.debug(`Emitting event bus message: ${JSON.stringify(message)}`);

		this.server.to(DISPLAY_INTERNAL_ROOM).emit('event', message);
		this.server.to(EXCHANGE_ROOM).emit('event', message);
	}

	private transformPayload(payload: Record<string, any>): Record<string, any> {
		// Helper function to check and transform a single item
		const transformItem = (item: unknown): unknown => {
			// Handle null/undefined
			if (item === null || item === undefined) {
				return item;
			}

			// Handle arrays by mapping each item recursively
			if (isArray(item)) {
				return item.map(transformItem);
			}

			// Handle objects
			if (typeof item === 'object') {
				// Check if it's a class instance (not a plain Object)
				if (item.constructor?.name && item.constructor.name !== 'Object') {
					return instanceToPlain(item, {
						excludeExtraneousValues: true,
						exposeUnsetFields: false,
						ignoreDecorators: false,
						groups: ['api'],
						enableCircularCheck: true,
					});
				}

				// For plain objects, recursively transform each property
				const result: Record<string, unknown> = {};

				for (const [key, value] of Object.entries(item)) {
					result[key] = transformItem(value);
				}

				return result;
			}

			// Return primitives as-is
			return item;
		};

		return transformItem(payload) as Record<string, any>;
	}
}
