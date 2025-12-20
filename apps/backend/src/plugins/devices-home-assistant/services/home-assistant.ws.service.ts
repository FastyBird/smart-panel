import { validate } from 'class-validator';
import WebSocket from 'ws';

import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';

import { toInstance } from '../../../common/utils/transform.utils';
import { ConfigService } from '../../../modules/config/services/config.service';
import {
	IManagedPluginService,
	ServiceState,
} from '../../../modules/extensions/services/managed-plugin-service.interface';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantException,
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { HomeAssistantStateChangedEventDto } from '../dto/home-assistant-state.dto';
import { HomeAssistantConfigModel } from '../models/config.model';
import {
	HomeAssistantDeviceRegistryModel,
	HomeAssistantDeviceRegistryResultModel,
	HomeAssistantEntityRegistryModel,
	HomeAssistantEntityRegistryResultModel,
} from '../models/home-assistant.model';

import { HomeAssistantHttpService } from './home-assistant.http.service';

export interface WsEventService {
	get event(): string;
	handle(event: HomeAssistantStateChangedEventDto): Promise<void>;
}

/**
 * Home Assistant WebSocket service for real-time communication.
 *
 * This service is managed by PluginServiceManagerService and implements
 * the IManagedPluginService interface for centralized lifecycle management.
 */
@Injectable()
export class HomeAssistantWsService implements IManagedPluginService {
	private readonly logger = new Logger(HomeAssistantWsService.name);

	readonly pluginName = DEVICES_HOME_ASSISTANT_PLUGIN_NAME;
	readonly serviceId = 'websocket';

	private readonly RESPONSE_TIMEOUT_MS = 10000; // 10 seconds

	private ws: WebSocket | null = null;

	private pluginConfig: HomeAssistantConfigModel | null = null;

	private state: ServiceState = 'stopped';

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

	private connectionResolver: {
		resolve: () => void;
		reject: (error: Error) => void;
	} | null = null;

	constructor(
		private readonly configService: ConfigService,
		@Inject(forwardRef(() => HomeAssistantHttpService))
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
	) {}

	registerEventsHandler(event: string, handler: WsEventService) {
		if (this.eventsHandlers.has(event)) {
			throw new DevicesHomeAssistantException('An event handler is already registered for this event type.');
		}

		this.logger.log(`[HOME ASSISTANT][WS SERVICE] Registered handler for event: ${event}`);

		this.eventsHandlers.set(event, handler);
	}

	/**
	 * Start the service.
	 * Called by PluginServiceManagerService when the plugin is enabled.
	 *
	 * The service is considered 'started' only after the WebSocket connection
	 * is established AND authentication succeeds (auth_ok received).
	 */
	async start(): Promise<void> {
		if (this.state === 'started' || this.state === 'starting') {
			return;
		}

		if (this.apiKey === null) {
			this.logger.warn('[HOME ASSISTANT][WS SERVICE] Missing API key for Home Assistant WS service');
			this.state = 'error';

			return;
		}

		this.state = 'starting';

		this.logger.log('[HOME ASSISTANT][WS SERVICE] Starting Home Assistant WebSocket service');

		try {
			await this.connectAndAuthenticate();

			this.state = 'started';

			this.logger.log('[HOME ASSISTANT][WS SERVICE] Home Assistant WebSocket service started successfully');
		} catch (error) {
			this.logger.error('[HOME ASSISTANT][WS SERVICE] Failed to start WebSocket service', {
				message: error instanceof Error ? error.message : String(error),
			});

			this.state = 'error';

			this.disconnect();
		}
	}

	/**
	 * Stop the service gracefully.
	 * Called by PluginServiceManagerService when the plugin is disabled or app shuts down.
	 */
	stop(): Promise<void> {
		if (this.state === 'stopped' || this.state === 'stopping') {
			return Promise.resolve();
		}

		this.state = 'stopping';

		this.logger.log('[HOME ASSISTANT][WS SERVICE] Stopping Home Assistant WebSocket service');

		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		this.disconnect();

		this.state = 'stopped';

		return Promise.resolve();
	}

	/**
	 * Get the current service state.
	 */
	getState(): ServiceState {
		return this.state;
	}

	/**
	 * Handle configuration changes by reconnecting.
	 * Called by PluginServiceManagerService when config updates occur.
	 *
	 * For WebSocket service, config changes (URL, API key) require reconnection.
	 */
	onConfigChanged(): Promise<void> {
		// Clear cached config so next access gets fresh values
		this.pluginConfig = null;

		// Reconnect to apply new settings (URL, API key, etc.)
		if (this.state === 'started') {
			this.logger.log('[HOME ASSISTANT][WS SERVICE] Config changed, reconnecting...');

			this.disconnect();
			this.connect();
		}

		return Promise.resolve();
	}

	/**
	 * Connect to Home Assistant and wait for successful authentication.
	 * Returns a Promise that resolves on auth_ok and rejects on error or auth_invalid.
	 */
	private connectAndAuthenticate(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.connectionResolver = { resolve, reject };

			this.connect();

			// Timeout for initial connection + authentication
			const timeout = setTimeout(() => {
				if (this.connectionResolver) {
					this.connectionResolver.reject(new Error('Connection timeout - failed to authenticate within 30 seconds'));
					this.connectionResolver = null;
				}
			}, 30000);

			// Store timeout reference to clear it on success/failure
			const originalResolver = this.connectionResolver;

			this.connectionResolver = {
				resolve: () => {
					clearTimeout(timeout);
					originalResolver.resolve();
					this.connectionResolver = null;
				},
				reject: (error: Error) => {
					clearTimeout(timeout);
					originalResolver.reject(error);
					this.connectionResolver = null;
				},
			};
		});
	}

	private connect() {
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
			// Reject pending connection promise if still waiting
			if (this.connectionResolver) {
				this.connectionResolver.reject(new Error('WebSocket connection closed before authentication completed'));
			}

			if (this.state === 'started') {
				this.logger.warn('[HOME ASSISTANT][WS SERVICE] WebSocket connection closed. Reconnecting...');
				this.scheduleReconnect();
			}
		});

		this.ws.on('error', (err) => {
			this.logger.error('[HOME ASSISTANT][WS SERVICE] WebSocket connection error', err);

			// Reject pending connection promise on error
			if (this.connectionResolver) {
				this.connectionResolver.reject(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}

	private disconnect() {
		this.connectionResolver = null;
		this.ws?.close();
		this.ws = null;
	}

	isConnected(): boolean {
		return this.ws?.readyState === WebSocket.OPEN;
	}

	async getDevicesRegistry(): Promise<HomeAssistantDeviceRegistryResultModel[]> {
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

			const devicesRegistry = toInstance(HomeAssistantDeviceRegistryModel, msg, {
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

	async getEntitiesRegistry(): Promise<HomeAssistantEntityRegistryResultModel[]> {
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

			const entitiesRegistry = toInstance(HomeAssistantEntityRegistryModel, msg, {
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

			// Resolve the connection promise - service is now fully started
			if (this.connectionResolver) {
				this.connectionResolver.resolve();
			}

			this.subscribeToStates();

			// Load initial states immediately after authentication
			// This ensures devices have state values without waiting for cron job
			this.homeAssistantHttpService.loadStates().catch((err: Error) => {
				this.logger.warn(
					`[HOME ASSISTANT][WS SERVICE] Failed to load initial states: ${err?.message ?? 'unknown error'}`,
				);
			});
		} else if (msg.type === 'auth_invalid') {
			const errorMessage = 'message' in msg && typeof msg.message === 'string' ? msg.message : 'Authentication failed';

			this.logger.error(`[HOME ASSISTANT][WS SERVICE] Authentication failed: ${errorMessage}`);

			// Reject the connection promise - authentication failed
			if (this.connectionResolver) {
				this.connectionResolver.reject(new Error(errorMessage));
			}

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
