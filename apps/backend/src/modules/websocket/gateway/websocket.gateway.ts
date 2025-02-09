import { instanceToPlain } from 'class-transformer';
import { isArray, isObject } from 'class-validator';
import { Server, Socket } from 'socket.io';

import { Logger } from '@nestjs/common';
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

import { CommandMessageDto } from '../dto/command-message.dto';
import { CommandEventRegistryService } from '../services/command-event-registry.service';

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

	constructor(private readonly commandEventRegistry: CommandEventRegistryService) {}

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
		this.logger.log(`[WS GATEWAY] Client connected: ${client.id}`);

		await client.join('default-room');
	}

	handleDisconnect(client: Socket): void {
		this.logger.log(`[WS GATEWAY] Client disconnected: ${client.id}`);
	}

	@SubscribeMessage('command')
	async handleCommand(@MessageBody() message: CommandMessageDto, @ConnectedSocket() client: Socket): Promise<void> {
		const { event, payload } = message;

		this.logger.log(`[COMMAND HANDLER] Received command '${event}' from client ${client.id}`);

		if (!this.commandEventRegistry.has(event)) {
			this.logger.warn(`[COMMAND HANDLER] No subscribers for event: ${event}`);

			client.emit('response', { status: 'error', message: `Event '${event}' is not supported.` });

			return;
		}

		try {
			const handlers = this.commandEventRegistry.get(event);

			const results = await Promise.all(
				handlers.map(async ({ name, handler }) => {
					try {
						const response = await handler(payload);

						return { handler: name, ...response };
					} catch (error) {
						const err = error as Error;

						this.logger.error(`[COMMAND HANDLER] Error in '${name}'`, { message: err.message, stack: err.stack });

						return { handler: name, success: false, reason: 'Internal error' };
					}
				}),
			);

			client.emit('response', { status: 'ok', message: 'Event handled successfully', results });
		} catch (error) {
			const err = error as Error;

			this.logger.error(`[COMMAND HANDLER] Error handling event: ${event}`, { message: err.message, stack: err.stack });

			client.emit('response', { status: 'error', message: `Failed to handle event: ${event}` });
		}
	}

	sendMessage(event: string, payload: Record<string, any>): void {
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
