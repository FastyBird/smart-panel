import { validate } from 'class-validator';
import WebSocket from 'ws';

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType as ConfigModuleEventType } from '../../../modules/config/config.constants';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantStateChangedEventDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantConfigModel } from '../models/config.model';
import {
	HomeAssistantDeviceRegistryResponseModel,
	HomeAssistantDeviceRegistryResponseResultModel,
	HomeAssistantEntityRegistryResponseModel,
	HomeAssistantEntityRegistryResponseResultModel,
} from '../models/home-assistant.model';

export interface WsEventService {
	get event(): string;
	handle(event: HomeAssistantStateChangedEventDto): Promise<void>;
}

@Injectable()
export class HomeAssistantWsService {
	private readonly logger = new Logger(HomeAssistantWsService.name);

	private readonly RESPONSE_TIMEOUT_MS = 10000; // 10 seconds

	private ws: WebSocket | null = null;

	private pluginConfig: HomeAssistantConfigModel | null = null;

	private nextId = 1;

	private retryCount = 0;

	private reconnectTimeout: NodeJS.Timeout | null = null;

	private eventsHandlers: Map<string, WsEventService> = new Map();

	private responses = new Map<
		number,
		{
			resolve: (value: string) => void;
			reject: (reason?: Error) => void;
			timeout: NodeJS.Timeout;
		}
	>();

	constructor(private readonly configService: ConfigService) {}

	registerEventsHandler(event: string, handler: WsEventService) {
		if (this.eventsHandlers.has(event)) {
			throw new DevicesHomeAssistantException('An event handler is already registered for this event type.');
		}

		this.logger.log(`[HOME ASSISTANT][WS SERVICE] Registered handler for event: ${event}`);

		this.eventsHandlers.set(event, handler);
	}

	connect() {
		if (
			this.configService.getPluginConfig<HomeAssistantConfigModel>(DEVICES_HOME_ASSISTANT_PLUGIN_NAME).enabled === false
		) {
			this.logger.debug('[HOME ASSISTANT][WS SERVICE] Home Assistant plugin is disabled.');

			return;
		}

		if (this.apiKey === null) {
			this.logger.warn('[HOME ASSISTANT][WS SERVICE] Missing API key for Home Assistant WS service');

			return;
		}

		this.logger.debug('[HOME ASSISTANT][WS SERVICE] Connecting to Home Assistant WebSocket API...');

		const url = new URL('/api/websocket', this.baseUrl);

		this.ws = new WebSocket(url);

		this.ws.on('open', () => {
			this.logger.log('[HOME ASSISTANT][WS SERVICE] WebSocket connection to Home Assistant instance opened');

			this.retryCount = 0;
		});

		this.ws.on('message', (data: string) => {
			void (async () => {
				await this.handleMessage(data);
			})();
		});

		this.ws.on('close', () => {
			this.logger.warn('[HOME ASSISTANT][WS SERVICE] WebSocket connection closed. Reconnecting in 5s...');

			this.scheduleReconnect();
		});

		this.ws.on('error', (err) => {
			this.logger.error('[HOME ASSISTANT][WS SERVICE] WebSocket connection error', err);
		});
	}

	disconnect() {
		this.ws?.close();
		this.ws = null;
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	async getDevicesRegistry(): Promise<HomeAssistantDeviceRegistryResponseResultModel[]> {
		if (!this.isConnected()) {
			this.logger.warn('[HOME ASSISTANT][WS SERVICE] Tried to get devices registry while socket is not open.');

			throw new DevicesHomeAssistantValidationException('Home Assistant socket connection is not open.');
		}

		try {
			this.logger.debug('[HOME ASSISTANT][WS SERVICE] Fetching devices registry from Home Assistant');

			const response = await this.send({
				type: 'config/device_registry/list',
			});

			const msg: object = JSON.parse(response) as object;

			const devicesRegistry = toInstance(HomeAssistantDeviceRegistryResponseModel, msg, {
				excludeExtraneousValues: false,
			});

			const errors = await validate(devicesRegistry);

			if (errors.length) {
				this.logger.error(
					`[HOME ASSISTANT][WS SERVICE] Home Assistant devices registry response validation failed error=${JSON.stringify(errors)}`,
				);
			} else {
				return devicesRegistry.result;
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][WS SERVICE] Failed to fetch Home Assistant devices registry', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant devices registry could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException(
			'An unhandled error occur. Home Assistant devices registry could not be loaded',
		);
	}

	async getEntitiesRegistry(): Promise<HomeAssistantEntityRegistryResponseResultModel[]> {
		if (!this.isConnected()) {
			this.logger.warn('[HOME ASSISTANT][WS SERVICE] Tried to get entities registry while socket is not open.');

			throw new DevicesHomeAssistantValidationException('Home Assistant socket connection is not open.');
		}

		try {
			this.logger.debug('[HOME ASSISTANT][WS SERVICE] Fetching entities registry from Home Assistant');

			const response = await this.send({
				type: 'config/entity_registry/list',
			});

			const msg: object = JSON.parse(response) as object;

			const entitiesRegistry = toInstance(HomeAssistantEntityRegistryResponseModel, msg, {
				excludeExtraneousValues: false,
			});

			const errors = await validate(entitiesRegistry);

			if (errors.length) {
				this.logger.error(
					`[HOME ASSISTANT][WS SERVICE] Home Assistant entities registry response validation failed error=${JSON.stringify(errors)}`,
				);
			} else {
				return entitiesRegistry.result;
			}
		} catch (error) {
			const err = error as Error;

			this.logger.error('[HOME ASSISTANT][WS SERVICE] Failed to fetch Home Assistant entities registry', {
				message: err.message,
				stack: err.stack,
			});

			throw new DevicesHomeAssistantException(
				'An unhandled error occur. Home Assistant entities registry could not be loaded',
			);
		}

		throw new DevicesHomeAssistantNotFoundException(
			'An unhandled error occur. Home Assistant entities registry could not be loaded',
		);
	}

	send(data: Record<string, any>): Promise<string> {
		if (!this.isConnected()) {
			this.logger.warn('[HOME ASSISTANT][WS SERVICE] Tried to send message while socket is not open.');

			return Promise.reject(new DevicesHomeAssistantException('Home Assistant socket connection is not open.'));
		}

		const messageId = this.nextId++;

		return new Promise<string>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.responses.delete(messageId);

				reject(new DevicesHomeAssistantException(`Home Assistant WS response timed out (id=${messageId})`));
			}, this.RESPONSE_TIMEOUT_MS);

			this.responses.set(messageId, { resolve, reject, timeout });

			this.ws.send(JSON.stringify({ id: messageId, ...data }));
		});
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

		this.logger.warn(`[HOME ASSISTANT][WS SERVICE] Reconnecting in ${delay / 1000}s...`);

		if (!this.reconnectTimeout) {
			this.reconnectTimeout = setTimeout(() => {
				this.reconnectTimeout = null;
				this.connect();
			}, delay);
		}
	}

	private async handleMessage(data: string) {
		const msg: object = JSON.parse(data) as object;

		if ('id' in msg && msg.id && typeof msg.id === 'number' && this.responses.has(msg.id)) {
			const { resolve } = this.responses.get(msg.id);

			this.responses.delete(msg.id);

			resolve(data);
		}

		if (!('type' in msg)) {
			return;
		}

		if (msg.type === 'auth_required') {
			this.logger.debug('[HOME ASSISTANT][WS SERVICE] Authenticating with Home Assistant instance...');

			this.ws?.send(
				JSON.stringify({
					type: 'auth',
					access_token: this.apiKey,
				}),
			);
		} else if (msg.type === 'auth_ok') {
			this.logger.debug('[HOME ASSISTANT][WS SERVICE] Authenticated with Home Assistant instance.');

			this.subscribeToStates();
		} else if (msg.type === 'auth_invalid') {
			this.logger.error(
				`[HOME ASSISTANT][WS SERVICE] Authentication failed: ${'message' in msg && typeof msg.message === 'string' ? msg.message : 'unknown'}`,
			);

			this.disconnect();
		} else if (msg.type === 'event') {
			if (
				'event' in msg &&
				typeof msg.event === 'object' &&
				'event_type' in msg.event &&
				msg.event.event_type === 'state_changed'
			) {
				const handler = this.eventsHandlers.get(msg.event.event_type) ?? this.eventsHandlers.get('*');

				if (handler) {
					const event = toInstance(HomeAssistantStateChangedEventDto, msg.event as object);

					await handler.handle(event);
				}
			}
		}
	}

	private subscribeToStates() {
		this.logger.debug('[HOME ASSISTANT][WS SERVICE] Subscribing to events.');

		this.ws?.send(
			JSON.stringify({
				id: this.nextId++,
				type: 'subscribe_events',
				event_type: 'state_changed',
			}),
		);
	}
}
