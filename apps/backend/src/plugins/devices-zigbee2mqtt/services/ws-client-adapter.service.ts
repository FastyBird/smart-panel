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

		if (this.ws) {
			this.logger.log('Disconnecting from Zigbee2MQTT WebSocket');

			this.connected = false;
			this.bridgeOnline = false;
			this.config = null;

			return new Promise((resolve) => {
				if (!this.ws) {
					this.resetState();
					resolve();
					return;
				}

				// Force close after 2 seconds if graceful close doesn't complete
				const forceCloseTimer = setTimeout(() => {
					if (this.ws) {
						this.ws.terminate();
						this.ws = null;
						this.resetState();
						resolve();
					}
				}, 2000);

				const onClose = (): void => {
					clearTimeout(forceCloseTimer);
					this.ws?.removeListener('close', onClose);
					this.ws = null;
					this.resetState();
					resolve();
				};

				this.ws.on('close', onClose);
				this.ws.close();
			});
		}
	}

	/**
	 * Publish a command to a device via WebSocket
	 */
	async publishCommand(friendlyName: string, payload: Z2mSetPayload): Promise<boolean> {
		if (!this.ws || !this.connected) {
			this.logger.warn('Cannot publish: not connected to Zigbee2MQTT WebSocket');
			return false;
		}

		const topic = `${this.baseTopic}/${friendlyName}/set`;
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
	 */
	async requestState(friendlyName: string, properties: string[] = []): Promise<boolean> {
		if (!this.ws || !this.connected) {
			return false;
		}

		const topic = `${this.baseTopic}/${friendlyName}/get`;
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

			// The topic from WS is the full MQTT topic (e.g. "zigbee2mqtt/bridge/state")
			this.handleMessage(wsMessage.topic, payloadStr);
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
