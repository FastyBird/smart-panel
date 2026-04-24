import * as mqtt from 'mqtt';

import { Injectable } from '@nestjs/common';

import { Z2mMqttConfig, Z2mSetPayload } from '../interfaces/zigbee2mqtt.interface';

import { Z2mBaseClientAdapter } from './base-client-adapter';

/**
 * Zigbee2MQTT MQTT Client Adapter Service
 *
 * Handles MQTT connection to Zigbee2MQTT broker, topic subscriptions,
 * message parsing, and command publishing.
 */
@Injectable()
export class Z2mMqttClientAdapterService extends Z2mBaseClientAdapter {
	private client: mqtt.MqttClient | null = null;
	private config: Z2mMqttConfig | null = null;

	constructor() {
		super('MqttClientAdapter');
	}

	/**
	 * Connect to the MQTT broker
	 */
	async connect(config: Z2mMqttConfig): Promise<void> {
		this.configBaseTopic = config.baseTopic;

		// Clear any existing reconnect timer
		this.clearReconnectTimer();

		// Disconnect existing client if any (disconnect() nulls this.config,
		// so we assign it after disconnect to preserve it for reconnection)
		await this.disconnect();

		this.config = config;

		const brokerUrl = this.buildBrokerUrl(config);

		this.logger.log(`Connecting to MQTT broker: ${brokerUrl}`);

		return new Promise((resolve, reject) => {
			try {
				const options: mqtt.IClientOptions = {
					clientId: config.clientId ?? `smart-panel-z2m-${Date.now()}`,
					clean: config.cleanSession,
					keepalive: config.keepalive,
					connectTimeout: config.connectTimeout,
					reconnectPeriod: 0, // We handle reconnection manually
					username: config.username ?? undefined,
					password: config.password ?? undefined,
				};

				// Add TLS options if configured
				if (config.tls?.enabled) {
					options.rejectUnauthorized = config.tls.rejectUnauthorized;
					if (config.tls.ca) {
						options.ca = config.tls.ca;
					}
					if (config.tls.cert) {
						options.cert = config.tls.cert;
					}
					if (config.tls.key) {
						options.key = config.tls.key;
					}
				}

				this.client = mqtt.connect(brokerUrl, options);

				this.client.on('connect', () => {
					this.logger.log('Connected to MQTT broker');
					this.connected = true;

					// Subscribe to all necessary topics
					this.subscribeToTopics();

					resolve();
				});

				this.client.on('error', (error) => {
					this.logger.error('MQTT client error', {
						message: error.message,
					});

					if (!this.connected) {
						reject(error);
					}
				});

				this.client.on('close', () => {
					const wasConnected = this.connected;
					this.connected = false;
					this.bridgeOnline = false;

					this.logger.log('Disconnected from MQTT broker');

					if (wasConnected) {
						// Schedule reconnection
						this.scheduleReconnect();
					}
				});

				this.client.on('offline', () => {
					this.logger.warn('MQTT client is offline');
				});

				this.client.on('message', (topic, payload) => {
					this.handleMessage(topic, payload.toString());
				});
			} catch (error) {
				this.logger.error('Failed to create MQTT client', {
					message: error instanceof Error ? error.message : String(error),
				});
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	/**
	 * Disconnect from the MQTT broker
	 */
	async disconnect(): Promise<void> {
		this.clearReconnectTimer();

		// Set flags before closing to prevent the close-event handler from scheduling a reconnect.
		this.connected = false;
		this.bridgeOnline = false;
		this.config = null;

		if (this.client) {
			this.logger.log('Disconnecting from MQTT broker');

			await new Promise<void>((resolve) => {
				this.client?.end(true, {}, () => {
					this.client = null;
					resolve();
				});
			});
		}

		this.resetState();
	}

	/**
	 * Publish a command to a device
	 */
	async publishCommand(friendlyName: string, payload: Z2mSetPayload): Promise<boolean> {
		if (!this.client || !this.connected) {
			this.logger.warn('Cannot publish: not connected to MQTT broker');
			return false;
		}

		const topic = `${this.baseTopic}/${friendlyName}/set`;
		const message = JSON.stringify(payload);

		this.logger.debug(`Publishing to ${topic}: ${message}`);

		return new Promise((resolve) => {
			this.client?.publish(topic, message, { qos: 1 }, (error) => {
				if (error) {
					this.logger.error(`Failed to publish to ${topic}`, {
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
	 * Toggle the bridge's permit_join state for a bounded number of seconds.
	 * Returns true on successful publish, false otherwise.
	 * Pass 0 to disable pairing immediately.
	 */
	async setPermitJoin(seconds: number): Promise<boolean> {
		if (!this.client?.connected) {
			this.logger.warn('Cannot toggle permit_join: not connected to MQTT broker');
			return false;
		}

		const topic = `${this.baseTopic}/bridge/request/permit_join`;
		const value = seconds > 0;
		const message = JSON.stringify({ value, time: seconds });

		this.logger.debug(`Publishing permit_join to ${topic}: ${message}`);

		return new Promise<boolean>((resolve) => {
			this.client?.publish(topic, message, { qos: 1 }, (error) => {
				if (error) {
					this.logger.error(`Failed to publish permit_join to ${topic}`, {
						message: error.message,
					});
					resolve(false);
					return;
				}
				resolve(true);
			});
		});
	}

	/**
	 * Request current state from a device
	 */
	async requestState(friendlyName: string, properties: string[] = []): Promise<boolean> {
		if (!this.client || !this.connected) {
			return false;
		}

		const topic = `${this.baseTopic}/${friendlyName}/get`;
		const payload = properties.length > 0 ? Object.fromEntries(properties.map((p) => [p, ''])) : { state: '' };
		const message = JSON.stringify(payload);

		return new Promise((resolve) => {
			this.client?.publish(topic, message, { qos: 1 }, (error) => {
				resolve(!error);
			});
		});
	}

	/**
	 * Build the MQTT broker URL
	 */
	private buildBrokerUrl(config: Z2mMqttConfig): string {
		const protocol = config.tls?.enabled ? 'mqtts' : 'mqtt';
		return `${protocol}://${config.host}:${config.port}`;
	}

	/**
	 * Subscribe to all necessary Zigbee2MQTT topics
	 */
	private subscribeToTopics(): void {
		if (!this.client) {
			return;
		}

		const topics = [
			`${this.baseTopic}/bridge/state`,
			`${this.baseTopic}/bridge/devices`,
			`${this.baseTopic}/bridge/event`,
			`${this.baseTopic}/bridge/groups`,
			`${this.baseTopic}/#`, // All device topics (state, availability, etc.) - supports friendly names with slashes
		];

		for (const topic of topics) {
			this.client.subscribe(topic, { qos: 1 }, (error) => {
				if (error) {
					this.logger.error(`Failed to subscribe to ${topic}`, {
						message: error.message,
					});
				} else {
					this.logger.debug(`Subscribed to ${topic}`);
				}
			});
		}
	}

	/**
	 * Schedule reconnection to MQTT broker
	 */
	private scheduleReconnect(): void {
		if (this.reconnectTimer || !this.config) {
			return;
		}

		const interval = this.config.reconnectInterval;
		this.logger.log(`Scheduling reconnection in ${interval}ms`);

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;

			if (!this.connected && this.config) {
				this.connect(this.config).catch((error: unknown) => {
					const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
					this.logger.error('Reconnection failed', {
						message: errorMessage,
					});
					// Schedule another reconnection
					this.scheduleReconnect();
				});
			}
		}, interval);
	}
}
