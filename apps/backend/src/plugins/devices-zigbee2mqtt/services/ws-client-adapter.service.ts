import WebSocket from 'ws';

import { Injectable } from '@nestjs/common';

import { Z2mSetPayload, Z2mWsConfig } from '../interfaces/zigbee2mqtt.interface';

import { Z2mBaseClientAdapter } from './base-client-adapter';

/**
 * Zigbee2MQTT WebSocket message format.
 *
 * The zigbee2mqtt frontend API uses JSON messages over WebSocket
 * that mirror the MQTT topic/payload structure.
 */
interface Z2mWsMessage {
	topic: string;
	payload: unknown;
}

/**
 * Zigbee2MQTT WebSocket Client Adapter Service
 *
 * Connects directly to the Zigbee2MQTT frontend WebSocket API,
 * bypassing the MQTT broker. The message format is the same as MQTT
 * (topic + payload), so all shared message routing logic applies.
 */
@Injectable()
export class Z2mWsClientAdapterService extends Z2mBaseClientAdapter {
	private ws: WebSocket | null = null;
	private config: Z2mWsConfig | null = null;

	constructor() {
		super('WsClientAdapter');
	}

	/**
	 * Connect to the Zigbee2MQTT WebSocket API
	 */
	async connect(config: Z2mWsConfig): Promise<void> {
		this.configBaseTopic = config.baseTopic;

		// Clear any existing reconnect timer
		this.clearReconnectTimer();

		// Disconnect existing client if any (disconnect() nulls this.config,
		// so we assign it after disconnect to preserve it for reconnection)
		await this.disconnect();

		this.config = config;

		const wsUrl = this.buildWsUrl(config);

		this.logger.log(`Connecting to Zigbee2MQTT WebSocket: ${wsUrl}`);

		return new Promise((resolve, reject) => {
			try {
				const timeoutId = setTimeout(() => {
					if (!this.connected) {
						this.logger.error('WebSocket connection timed out');
						this.ws?.terminate();
						this.ws = null;
						reject(new Error('WebSocket connection timed out'));
					}
				}, config.connectTimeout);

				this.ws = new WebSocket(wsUrl);

				this.ws.on('open', () => {
					clearTimeout(timeoutId);

					this.logger.log('Connected to Zigbee2MQTT WebSocket');
					this.connected = true;

					resolve();
				});

				this.ws.on('error', (error) => {
					clearTimeout(timeoutId);

					this.logger.error('WebSocket client error', {
						message: error.message,
					});

					if (!this.connected) {
						reject(error);
					}
				});

				this.ws.on('close', () => {
					clearTimeout(timeoutId);

					const wasConnected = this.connected;
					this.connected = false;
					this.bridgeOnline = false;

					// Null out the reference to the now-closed socket so that
					// disconnect() called during reconnect skips the close path
					// instead of calling close() on an already-closed socket
					// (which is a no-op and would stall for the 2s force-close timer).
					this.ws = null;

					this.logger.log('Disconnected from Zigbee2MQTT WebSocket');

					if (wasConnected) {
						this.scheduleReconnect();
					}
				});

				this.ws.on('message', (data: WebSocket.Data) => {
					this.handleWsMessage(data);
				});
			} catch (error) {
				this.logger.error('Failed to create WebSocket client', {
					message: error instanceof Error ? error.message : String(error),
				});
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	/**
	 * Disconnect from the WebSocket
	 */
	async disconnect(): Promise<void> {
		this.clearReconnectTimer();

		// Set flags before closing the socket to prevent the close-event handler
		// (registered during connect) from scheduling a reconnect.
		this.connected = false;
		this.bridgeOnline = false;
		this.config = null;

		if (this.ws) {
			this.logger.log('Disconnecting from Zigbee2MQTT WebSocket');

			await new Promise<void>((resolve) => {
				if (!this.ws) {
					resolve();
					return;
				}

				// Capture the socket being closed so callbacks reference it, not a future this.ws
				const closingWs = this.ws;

				// Remove all listeners from the old socket to prevent stale callbacks
				// (e.g., the connect()-registered 'close' listener) from firing after
				// a new WebSocket is assigned to this.ws
				closingWs.removeAllListeners();

				// Force close after 2 seconds if graceful close doesn't complete
				const forceCloseTimer = setTimeout(() => {
					closingWs.terminate();

					if (this.ws === closingWs) {
						this.ws = null;
					}

					resolve();
				}, 2000);

				closingWs.on('close', () => {
					clearTimeout(forceCloseTimer);

					if (this.ws === closingWs) {
						this.ws = null;
					}

					resolve();
				});

				closingWs.close();
			});
		}

		// Always clear device registry and state cache, even if ws was already null
		// (e.g., close event fired before disconnect was called)
		this.resetState();
	}

	/**
	 * Publish a command to a device via WebSocket
	 *
	 * Note: The z2m WebSocket API expects topics WITHOUT the baseTopic prefix.
	 * The z2m frontend extension automatically prepends the baseTopic when
	 * forwarding the message to MQTT internally.
	 */
	async publishCommand(friendlyName: string, payload: Z2mSetPayload): Promise<boolean> {
		if (!this.ws || !this.connected) {
			this.logger.warn('Cannot publish: not connected to Zigbee2MQTT WebSocket');
			return false;
		}

		const topic = `${friendlyName}/set`;
		const message: Z2mWsMessage = { topic, payload };

		this.logger.debug(`Sending WS command to ${topic}: ${JSON.stringify(payload)}`);

		return new Promise((resolve) => {
			this.ws?.send(JSON.stringify(message), (error) => {
				if (error) {
					this.logger.error(`Failed to send WS command to ${topic}`, {
						message: error.message,
					});
					resolve(false);
				} else {
					resolve(true);
				}
			});
		});
	}

	/**
	 * Request current state from a device via WebSocket
	 *
	 * Note: Topics are sent without the baseTopic prefix (see publishCommand).
	 */
	async requestState(friendlyName: string, properties: string[] = []): Promise<boolean> {
		if (!this.ws || !this.connected) {
			return false;
		}

		const topic = `${friendlyName}/get`;
		const payload = properties.length > 0 ? Object.fromEntries(properties.map((p) => [p, ''])) : { state: '' };
		const message: Z2mWsMessage = { topic, payload };

		return new Promise((resolve) => {
			this.ws?.send(JSON.stringify(message), (error) => {
				resolve(!error);
			});
		});
	}

	/**
	 * Build the WebSocket URL
	 */
	private buildWsUrl(config: Z2mWsConfig): string {
		const protocol = config.secure ? 'wss' : 'ws';
		return `${protocol}://${config.host}:${config.port}/api`;
	}

	/**
	 * Handle incoming WebSocket message from zigbee2mqtt
	 *
	 * Zigbee2MQTT sends JSON messages with { topic, payload } structure.
	 * The topic field mirrors the MQTT topic structure.
	 */
	private handleWsMessage(data: WebSocket.Data): void {
		try {
			const raw = typeof data === 'string' ? data : Buffer.from(data as Buffer).toString('utf-8');
			const wsMessage = JSON.parse(raw) as Z2mWsMessage;

			if (!wsMessage.topic) {
				this.logger.debug('Received WS message without topic, ignoring');
				return;
			}

			// Convert payload to string for the shared message handler
			const payloadStr = typeof wsMessage.payload === 'string' ? wsMessage.payload : JSON.stringify(wsMessage.payload);

			// The z2m WebSocket API sends topics WITHOUT the baseTopic prefix
			// (e.g. "bridge/state", not "zigbee2mqtt/bridge/state"), so pass isRelative=true
			this.handleMessage(wsMessage.topic, payloadStr, true);
		} catch (error) {
			this.logger.warn('Failed to parse WebSocket message', {
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	/**
	 * Schedule reconnection to WebSocket
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer || !this.config) {
			return;
		}

		const interval = this.config.reconnectInterval;
		this.logger.log(`Scheduling WebSocket reconnection in ${interval}ms`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;

			if (!this.connected && this.config) {
				this.connect(this.config).catch((error: unknown) => {
					const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
					this.logger.error('WebSocket reconnection failed', {
						message: errorMessage,
					});
					this.scheduleReconnect();
				});
			}
		}, interval);
	}
}
