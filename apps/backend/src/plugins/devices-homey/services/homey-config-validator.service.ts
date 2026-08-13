import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import {
	DEVICES_HOMEY_PLUGIN_NAME,
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';
import { isSafeHomeyUrl } from '../validators/homey-url.validator';

@Injectable()
export class HomeyConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = DEVICES_HOMEY_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		if (config['enabled'] !== true) {
			return Promise.resolve({ valid: true });
		}

		const url = config['url'];
		const apiKey = config['apiKey'] ?? config['api_key'];

		if (typeof url !== 'string' || url.trim().length === 0) {
			return Promise.resolve({ valid: false, errors: [{ message: 'Homey URL is required', field: 'url' }] });
		}

		if (!isSafeHomeyUrl(url)) {
			return Promise.resolve({
				valid: false,
				errors: [{ message: 'Homey URL must use HTTP or HTTPS without embedded credentials', field: 'url' }],
			});
		}

		if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
			return Promise.resolve({
				valid: false,
				errors: [{ message: 'Homey API key is required', field: 'api_key' }],
			});
		}

		const connectionTimeout = config['connectionTimeout'] ?? config['connection_timeout'];

		if (!this.isIntegerInRange(connectionTimeout, MIN_HOMEY_CONNECTION_TIMEOUT_MS, MAX_HOMEY_CONNECTION_TIMEOUT_MS)) {
			return Promise.resolve({
				valid: false,
				errors: [{ message: 'Homey connection timeout is outside the supported range', field: 'connection_timeout' }],
			});
		}

		const reconciliationInterval = config['reconciliationInterval'] ?? config['reconciliation_interval'];

		if (
			!this.isIntegerInRange(
				reconciliationInterval,
				MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
				MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
			)
		) {
			return Promise.resolve({
				valid: false,
				errors: [
					{
						message: 'Homey reconciliation interval is outside the supported range',
						field: 'reconciliation_interval',
					},
				],
			});
		}

		return Promise.resolve({ valid: true });
	}

	private isIntegerInRange(value: unknown, minimum: number, maximum: number): boolean {
		return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
	}
}
