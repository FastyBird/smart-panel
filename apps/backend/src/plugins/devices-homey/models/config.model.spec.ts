import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ConfigSecretsService } from '../../../modules/config/services/config-secrets.service';
import { HomeyUpdatePluginConfigDto } from '../dto/update-config.dto';

import { HomeyConfigModel } from './config.model';

describe('Homey configuration', () => {
	it('keeps the disabled defaults structurally valid', () => {
		expect(validateSync(new HomeyConfigModel())).toEqual([]);
	});

	it('rejects an enabled stored configuration without a URL and API key', () => {
		const errors = validateSync(Object.assign(new HomeyConfigModel(), { enabled: true }));

		expect(errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ property: 'url' }),
				expect.objectContaining({ property: 'apiKey' }),
			]),
		);
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

	it('rejects embedded URL credentials in stored and update configuration', () => {
		const url = 'http://owner:credential@homey.local:4859';
		const config = Object.assign(new HomeyConfigModel(), { url });
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			url,
		});

		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'url' })]));
	});

	it('rejects whitespace-only API keys in stored and update configuration', () => {
		const config = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			url: 'http://homey.local:4859',
			apiKey: '   ',
		});
		const update = plainToInstance(HomeyUpdatePluginConfigDto, {
			type: 'devices-homey-plugin',
			api_key: '   ',
		});

		expect(validateSync(config)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'apiKey' })]));
		expect(validateSync(update)).toEqual(expect.arrayContaining([expect.objectContaining({ property: 'apiKey' })]));
	});
});
