import { plainToInstance } from 'class-transformer';
import WebSocket from 'ws';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import { DevicesHomeAssistantException } from '../devices-home-assistant.exceptions';
import { HomeAssistantStateChangedEventDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantConfigModel } from '../models/config.model';

export interface WsEventService {
	get event(): string;
	handle(event: HomeAssistantStateChangedEventDto): Promise<void>;
}

@Injectable()
export class HomeAssistantWsService {
	private readonly logger = new Logger(HomeAssistantWsService.name);

	private ws: WebSocket | null = null;

	private pluginConfig: HomeAssistantConfigModel | null = null;

	private nextId = 1;

	private retryCount = 0;

	private reconnectTimeout: NodeJS.Timeout | null = null;

	private eventsHandlers: Map<string, WsEventService> = new Map();

	constructor(private readonly configService: ConfigService) {}

	registerEventsHandler(event: string, handler: WsEventService) {
		if (this.eventsHandlers.has(event)) {
			throw new DevicesHomeAssistantException('An event handler is already registered for this event type.');
		}

		this.logger.log(`[HOME ASSISTANT][WS] Registered handler for event: ${event}`);

		this.eventsHandlers.set(event, handler);
	}

	connect() {
		if (this.apiKey === null) {
			this.logger.warn('[HOME ASSISTANT][WS] Missing API key for Home Assistant WS service');

			return;
		}

		this.logger.debug('[HOME ASSISTANT][WS] Connecting to Home Assistant WebSocket API...');

		const url = new URL('/api/websocket', this.baseUrl);

		this.ws = new WebSocket(url);

		this.ws.on('open', () => {
			this.logger.log('[HOME ASSISTANT][WS] WebSocket connection to Home Assistant instance opened');

			this.retryCount = 0;
		});

		this.ws.on('message', (data: string) => {
			void (async () => {
				await this.handleMessage(JSON.parse(data) as object);
			})();
		});

		this.ws.on('close', () => {
			this.logger.warn('[HOME ASSISTANT][WS] WebSocket connection closed. Reconnecting in 5s...');

			this.scheduleReconnect();
		});

		this.ws.on('error', (err) => {
			this.logger.error('[HOME ASSISTANT][WS] WebSocket connection error', err);
		});
	}

	disconnect() {
		this.ws?.close();
		this.ws = null;
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	@OnEvent(ConfigModuleEventType.CONFIG_UPDATED)
	handleConfigurationUpdatedEvent() {
		this.pluginConfig = null;

		this.disconnect();
		this.connect();
	}

	private get config(): HomeAssistantConfigModel {
		if (!this.pluginConfig) {
			this.pluginConfig = this.configService.getPluginConfig<HomeAssistantConfigModel>(
				DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
			);
		}

		return this.pluginConfig;
	}

	private get apiKey(): string {
		return this.config.apiKey;
	}

	private get hostname(): string {
		return this.config.hostname;
	}

	private get baseUrl(): string {
		return `ws://${this.hostname}`;
	}

	private scheduleReconnect() {
		const delay = Math.min(30000, 5000 * ++this.retryCount);

		this.logger.warn(`[HOME ASSISTANT][WS] Reconnecting in ${delay / 1000}s...`);

		if (!this.reconnectTimeout) {
			this.reconnectTimeout = setTimeout(() => {
				this.reconnectTimeout = null;
				this.connect();
			}, delay);
		}
	}

	send(data: Record<string, any>) {
		if (this.isConnected()) {
			this.ws.send(JSON.stringify({ id: this.nextId++, ...data }));
		} else {
			this.logger.warn('[HOME ASSISTANT][WS] Tried to send message while socket is not open.');
		}
	}

	private async handleMessage(msg: object) {
		if (!('type' in msg)) {
			return;
		}

		if (msg.type === 'auth_required') {
			this.logger.debug('[HOME ASSISTANT][WS] Authenticating with Home Assistant instance...');

			this.ws?.send(
				JSON.stringify({
					type: 'auth',
					access_token: this.apiKey,
				}),
			);
		} else if (msg.type === 'auth_ok') {
			this.logger.debug('[HOME ASSISTANT][WS] Authenticated with Home Assistant instance.');

			this.subscribeToStates();
		} else if (msg.type === 'auth_invalid') {
			this.logger.error(
				`[HOME ASSISTANT][WS] Authentication failed: ${'message' in msg && typeof msg.message === 'string' ? msg.message : 'unknown'}`,
			);

			this.disconnect();
		} else if (msg.type === 'event') {
			this.logger.debug(`[HOME ASSISTANT][WS] Received event message: ${JSON.stringify(msg)}`);

			if (
				'event' in msg &&
				typeof msg.event === 'object' &&
				'event_type' in msg.event &&
				msg.event.event_type === 'state_changed'
			) {
				const handler = this.eventsHandlers.get(msg.event.event_type) ?? this.eventsHandlers.get('*');

				if (handler) {
					const event = plainToInstance(HomeAssistantStateChangedEventDto, msg.event as object, {
						enableImplicitConversion: true,
						exposeUnsetFields: false,
					});

					await handler.handle(event);
				}
			}
		} else {
			this.logger.debug(`[HOME ASSISTANT][WS] Received unhandled message: ${JSON.stringify(msg)}`);
		}
	}

	private subscribeToStates() {
		this.logger.debug('[HOME ASSISTANT][WS] Subscribing to events.');

		this.ws?.send(
			JSON.stringify({
				id: this.nextId++,
				type: 'subscribe_events',
				event_type: 'state_changed',
			}),
		);
	}
}
