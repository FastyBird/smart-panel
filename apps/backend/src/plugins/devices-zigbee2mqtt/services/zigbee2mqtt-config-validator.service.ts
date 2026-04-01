import { connect } from 'mqtt';
import WebSocket from 'ws';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';

@Injectable()
export class Zigbee2mqttConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	private readonly logger = createExtensionLogger(DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, 'ConfigValidator');

	readonly pluginType = DEVICES_ZIGBEE2MQTT_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const connectionType = ((config['connectionType'] ?? config['connection_type']) as string) || 'mqtt';

		if (connectionType === 'ws') {
			return this.validateWs(config);
		}

		return this.validateMqtt(config);
	}

	private async validateMqtt(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const mqtt = config['mqtt'] as Record<string, unknown> | undefined;

		if (!mqtt) {
			return { valid: false, errors: [{ message: 'MQTT configuration is required' }] };
		}

		const host = mqtt['host'] as string | undefined;
		const port = (mqtt['port'] as number) || 1883;
		const username = mqtt['username'] as string | undefined;
		const password = mqtt['password'] as string | undefined;
		const tls = config['tls'] as Record<string, unknown> | undefined;
		const tlsEnabled = tls?.['enabled'] === true;

		if (!host) {
			return { valid: false, errors: [{ message: 'MQTT host is required', field: 'mqtt.host' }] };
		}

		const protocol = tlsEnabled ? 'mqtts' : 'mqtt';
		const brokerUrl = `${protocol}://${host}:${port}`;

		return new Promise<IConfigValidationResult>((resolve) => {
			const timeoutMs = 10000;
			let settled = false;

			const settle = (result: IConfigValidationResult): void => {
				if (settled) return;
				settled = true;

				try {
					client.end(true);
				} catch {
					// Ignore cleanup errors
				}

				resolve(result);
			};

			const timer = setTimeout(() => {
				settle({
					valid: false,
					errors: [{ message: 'Connection timed out — check broker host and port', field: 'mqtt.host' }],
				});
			}, timeoutMs);

			const client = connect(brokerUrl, {
				connectTimeout: timeoutMs,
				reconnectPeriod: 0,
				username: username || undefined,
				password: password || undefined,
				rejectUnauthorized: tlsEnabled ? ((tls?.['rejectUnauthorized'] as boolean) ?? true) : undefined,
				ca: tlsEnabled ? (tls?.['ca'] as string) || undefined : undefined,
				cert: tlsEnabled ? (tls?.['cert'] as string) || undefined : undefined,
				key: tlsEnabled ? (tls?.['key'] as string) || undefined : undefined,
			});

			client.on('connect', () => {
				clearTimeout(timer);
				settle({ valid: true });
			});

			client.on('error', (err: Error) => {
				clearTimeout(timer);

				this.logger.error(`MQTT connection test failed: ${err.message}`);

				const message = err.message;

				if (message.includes('Not authorized') || message.includes('Bad username or password')) {
					settle({
						valid: false,
						errors: [{ message: 'Invalid MQTT credentials', field: 'mqtt.username' }],
					});
				} else {
					settle({
						valid: false,
						errors: [{ message: `Cannot connect to MQTT broker: ${message}`, field: 'mqtt.host' }],
					});
				}
			});
		});
	}

	private async validateWs(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const wsConfig = config['ws'] as Record<string, unknown> | undefined;

		if (!wsConfig) {
			return { valid: false, errors: [{ message: 'WebSocket configuration is required' }] };
		}

		const host = wsConfig['host'] as string | undefined;
		const port = (wsConfig['port'] as number) || 8080;
		const secure = wsConfig['secure'] === true;

		if (!host) {
			return { valid: false, errors: [{ message: 'WebSocket host is required', field: 'ws.host' }] };
		}

		const protocol = secure ? 'wss' : 'ws';
		const wsUrl = `${protocol}://${host}:${port}/api`;

		return new Promise<IConfigValidationResult>((resolve) => {
			const timeoutMs = 10000;
			let settled = false;

			const settle = (result: IConfigValidationResult): void => {
				if (settled) return;
				settled = true;

				try {
					ws.terminate();
				} catch {
					// Ignore cleanup errors
				}

				resolve(result);
			};

			const timer = setTimeout(() => {
				settle({
					valid: false,
					errors: [
						{
							message: 'Connection timed out — check Zigbee2MQTT host and port',
							field: 'ws.host',
						},
					],
				});
			}, timeoutMs);

			const ws = new WebSocket(wsUrl);

			ws.on('open', () => {
				clearTimeout(timer);
				settle({ valid: true });
			});

			ws.on('error', (err: Error) => {
				clearTimeout(timer);

				this.logger.error(`WebSocket connection test failed: ${err.message}`);

				settle({
					valid: false,
					errors: [
						{
							message: `Cannot connect to Zigbee2MQTT WebSocket: ${err.message}`,
							field: 'ws.host',
						},
					],
				});
			});
		});
	}
}
