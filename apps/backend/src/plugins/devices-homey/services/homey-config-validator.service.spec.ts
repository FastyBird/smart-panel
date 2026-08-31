import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
} from '../devices-homey.constants';

import { HomeyConfigValidatorService } from './homey-config-validator.service';

describe('HomeyConfigValidatorService', () => {
	let registry: jest.Mocked<Pick<PluginConfigValidatorService, 'register'>>;
	let service: HomeyConfigValidatorService;

	beforeEach(() => {
		registry = { register: jest.fn() };
		service = new HomeyConfigValidatorService(registry as unknown as PluginConfigValidatorService);
	});

	it('registers itself for the Homey plugin', () => {
		service.onModuleInit();

		expect(service.pluginType).toBe(DEVICES_HOMEY_PLUGIN_NAME);
		expect(registry.register).toHaveBeenCalledWith(service);
	});

	it('accepts an incomplete disabled configuration without a network request', async () => {
		await expect(service.validate({ enabled: false })).resolves.toEqual({ valid: true });
	});

	it('requires a URL when enabled', async () => {
		await expect(service.validate({ enabled: true, apiKey: 'configured-secret' })).resolves.toEqual({
			valid: false,
			errors: [{ message: 'Homey URL is required', field: 'url' }],
		});
	});

	it('rejects embedded URL credentials without echoing them', async () => {
		const result = await service.validate({
			enabled: true,
			url: 'http://user:password@homey.local:4859',
			apiKey: 'configured-secret',
		});

		expect(result.valid).toBe(false);
		expect(JSON.stringify(result)).not.toContain('configured-secret');
		expect(JSON.stringify(result)).not.toContain('password');
	});

	it('requires an API key when enabled', async () => {
		await expect(service.validate({ enabled: true, url: 'http://homey.local:4859' })).resolves.toEqual({
			valid: false,
			errors: [{ message: 'Homey API key is required', field: 'api_key' }],
		});
	});

	it('accepts a complete locally stored configuration without connecting', async () => {
		await expect(
			service.validate({
				enabled: true,
				url: 'http://homey.local:4859',
				api_key: 'configured-secret',
				connection_timeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
				reconciliation_interval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
			}),
		).resolves.toEqual({ valid: true });
	});

	it('rejects timeout and reconciliation values outside their supported ranges', async () => {
		const base = {
			enabled: true,
			url: 'https://homey.local:4860',
			apiKey: 'configured-secret',
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
			reconciliationInterval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		};

		await expect(service.validate({ ...base, connectionTimeout: 999 })).resolves.toMatchObject({ valid: false });
		await expect(service.validate({ ...base, reconciliationInterval: 1000 })).resolves.toMatchObject({ valid: false });
	});
});
