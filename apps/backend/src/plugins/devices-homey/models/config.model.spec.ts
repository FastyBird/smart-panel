import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';

import { HomeyConfigModel } from './config.model';

describe('Homey configuration', () => {
	it('keeps the disabled defaults structurally valid', () => {
		expect(validateSync(new HomeyConfigModel())).toEqual([]);
	});

	it('projects the API key as a configured indicator', () => {
		const secrets = new ConfigSecretsService();
		const config = Object.assign(new HomeyConfigModel(), {
			url: 'http://homey.local:4859',
			apiKey: 'configured-secret',
		});

		const projected = secrets.toPublic(config, [
			{ path: 'api_key', configuredPath: 'api_key_configured', inputPaths: ['apiKey'] },
		]) as unknown as Record<string, unknown>;

		expect(projected).not.toHaveProperty('api_key');
		expect(projected).not.toHaveProperty('apiKey');
		expect(projected).toHaveProperty('api_key_configured', true);
		expect(JSON.stringify(projected)).not.toContain('configured-secret');
	});

	it('accepts snake-case update fields while keeping the API key optional', () => {
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			api_key: 'replacement-secret',
			connection_timeout: 5000,
			reconciliation_interval: 60000,
		});

		expect(update.apiKey).toBe('replacement-secret');
		expect(update.connectionTimeout).toBe(5000);
		expect(update.reconciliationInterval).toBe(60000);
		expect(validateSync(update)).toEqual([]);
	});
});
