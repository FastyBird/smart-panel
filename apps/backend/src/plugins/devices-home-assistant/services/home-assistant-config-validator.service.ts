import { Injectable, OnModuleInit } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import type {
	IConfigValidationResult,
	IPluginConfigValidator,
} from '../../../modules/config/services/plugin-config-validator.service';
import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

@Injectable()
export class HomeAssistantConfigValidatorService implements IPluginConfigValidator, OnModuleInit {
	private readonly logger = createExtensionLogger(DEVICES_HOME_ASSISTANT_PLUGIN_NAME, 'ConfigValidator');

	readonly pluginType = DEVICES_HOME_ASSISTANT_PLUGIN_NAME;

	constructor(private readonly pluginConfigValidator: PluginConfigValidatorService) {}

	onModuleInit(): void {
		this.pluginConfigValidator.register(this);
	}

	async validate(config: Record<string, unknown>): Promise<IConfigValidationResult> {
		const hostname = config['hostname'] as string | undefined;
		const apiKey = (config['apiKey'] ?? config['api_key']) as string | undefined;

		if (!hostname) {
			return { valid: false, errors: [{ message: 'Hostname is required', field: 'hostname' }] };
		}

		if (!apiKey) {
			return { valid: false, errors: [{ message: 'API key is required', field: 'api_key' }] };
		}

		// Try HTTP first, fall back to HTTPS if connection fails
		const hasProtocol = hostname.startsWith('http://') || hostname.startsWith('https://');
		const protocols = hasProtocol ? [''] : ['http://', 'https://'];

		let lastError: Error | null = null;

		for (const protocol of protocols) {
			const url = `${protocol}${hostname}/api/`;

			try {
				const result = await this.tryConnect(url, apiKey);

				if (result) {
					return result;
				}

				return { valid: true };
			} catch (error) {
				lastError = error as Error;

				// Only retry with next protocol on network errors, not on HTTP errors
				if (lastError.name === 'AbortError' && protocols.length > 1) {
					continue;
				}

				break;
			}
		}

		this.logger.error(`Connection test failed: ${lastError?.message}`);

		if (lastError?.name === 'AbortError') {
			return {
				valid: false,
				errors: [{ message: 'Connection timed out — check hostname and network', field: 'hostname' }],
			};
		}

		return {
			valid: false,
			errors: [{ message: `Cannot connect to Home Assistant: ${lastError?.message}`, field: 'hostname' }],
		};
	}

	private async tryConnect(url: string, apiKey: string): Promise<IConfigValidationResult | null> {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10000);

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (response.ok) {
				return null; // Success — caller returns { valid: true }
			}

			if (response.status === 401) {
				return { valid: false, errors: [{ message: 'Invalid API key', field: 'api_key' }] };
			}

			return {
				valid: false,
				errors: [{ message: `Home Assistant returned status ${response.status}`, field: 'hostname' }],
			};
		} catch (error) {
			clearTimeout(timeout);

			throw error;
		}
	}
}
