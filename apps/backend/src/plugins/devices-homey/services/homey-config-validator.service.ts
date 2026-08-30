import { Injectable, OnModuleInit } from '@nestjs/common';

import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionMode,
	MAX_HOMEY_CONNECTION_TIMEOUT_MS,
	MAX_HOMEY_RECONCILIATION_INTERVAL_MS,
	MIN_HOMEY_CONNECTION_TIMEOUT_MS,
	MIN_HOMEY_RECONCILIATION_INTERVAL_MS,
} from '../devices-homey.constants';
import { isSafeHomeyCloudRedirectUrl } from '../validators/homey-cloud-redirect-url.validator';
import { isSafeHomeyUrl } from '../validators/homey-url.validator';

import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';

@Injectable()
export class HomeyConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	readonly pluginType = DEVICES_HOMEY_PLUGIN_NAME;

	constructor(
		private readonly pluginConfigValidator: PluginConfigValidatorService,
		private readonly cloudGrantMutations: HomeyCloudGrantMutationService,
	) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const mode = config['mode'] ?? HomeyConnectionMode.LOCAL;

		if (!Object.values(HomeyConnectionMode).includes(mode as HomeyConnectionMode)) {
			return Promise.resolve({
				valid: false,
				errors: [{ message: 'Homey connection mode must be local or cloud', field: 'mode' }],
			});
		}

		if (config['enabled'] !== true) {
			return Promise.resolve({ valid: true });
		}

		if (mode === HomeyConnectionMode.LOCAL) {
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
		} else {
			const clientId = config['cloudClientId'] ?? config['cloud_client_id'];
			const clientSecret = config['cloudClientSecret'] ?? config['cloud_client_secret'];
			const redirectUrl = config['cloudRedirectUrl'] ?? config['cloud_redirect_url'];
			const hasActiveGrant = await this.cloudGrantMutations.hasActiveGrant();

			if (typeof clientId !== 'string' || clientId.trim().length === 0) {
				return Promise.resolve({
					valid: false,
					errors: [{ message: 'Homey Cloud client ID is required', field: 'cloud_client_id' }],
				});
			}

			if (typeof clientSecret !== 'string' || clientSecret.trim().length === 0) {
				return Promise.resolve({
					valid: false,
					errors: [{ message: 'Homey Cloud client secret is required', field: 'cloud_client_secret' }],
				});
			}

			if (!isSafeHomeyCloudRedirectUrl(redirectUrl)) {
				return Promise.resolve({
					valid: false,
					errors: [
						{
							message: 'Homey Cloud redirect URL must match the registered callback URL',
							field: 'cloud_redirect_url',
						},
					],
				});
			}

			if (!hasActiveGrant) {
				return {
					valid: false,
					errors: [{ message: 'Homey Cloud authorization is required', field: 'mode' }],
				};
			}
		}

		const connectionTimeout =
			config['connectionTimeout'] ?? config['connection_timeout'] ?? DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS;

		if (!this.isIntegerInRange(connectionTimeout, MIN_HOMEY_CONNECTION_TIMEOUT_MS, MAX_HOMEY_CONNECTION_TIMEOUT_MS)) {
			return Promise.resolve({
				valid: false,
				errors: [{ message: 'Homey connection timeout is outside the supported range', field: 'connection_timeout' }],
			});
		}

		const reconciliationInterval =
			config['reconciliationInterval'] ?? config['reconciliation_interval'] ?? DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS;

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
