import { PluginConfigValidatorService } from '../../../modules/config/services/plugin-config-validator.service';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionMode,
} from '../devices-homey.constants';

import { HomeyCloudGrantMutationService } from './homey-cloud-grant-mutation.service';
import { HomeyConfigValidatorService } from './homey-config-validator.service';

describe('HomeyConfigValidatorService', () => {
	let registry: jest.Mocked<Pick<PluginConfigValidatorService, 'register'>>;
	let cloudGrantMutations: jest.Mocked<Pick<HomeyCloudGrantMutationService, 'hasActiveGrant'>>;
	let service: HomeyConfigValidatorService;

	beforeEach(() => {
		registry = { register: jest.fn() };
		cloudGrantMutations = { hasActiveGrant: jest.fn().mockResolvedValue(true) };
		service = new HomeyConfigValidatorService(
			registry as unknown as PluginConfigValidatorService,
			cloudGrantMutations as unknown as HomeyCloudGrantMutationService,
		);
	});

	it('registers itself for the Homey plugin', () => {
		service.onModuleInit();

		expect(service.pluginType).toBe(DEVICES_HOMEY_PLUGIN_NAME);
		expect(registry.register).toHaveBeenCalledWith(service);
	});

	it('accepts an incomplete disabled configuration without a network request', async () => {
		await expect(service.validate({ enabled: false })).resolves.toEqual({ valid: true });
	});

	it('accepts complete admin-managed cloud configuration without local credentials', async () => {
		await expect(
			service.validate({
				enabled: true,
				mode: HomeyConnectionMode.CLOUD,
				cloud_client_id: 'client-id',
				cloud_client_secret: 'client-secret',
				cloud_redirect_url: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
			}),
		).resolves.toEqual({ valid: true });
	});

	it('accepts incomplete cloud configuration while the connector is disabled', async () => {
		await expect(service.validate({ enabled: false, mode: HomeyConnectionMode.CLOUD })).resolves.toEqual({
			valid: true,
		});
		expect(cloudGrantMutations.hasActiveGrant).toHaveBeenCalledTimes(1);
	});

	it.each([
		['client ID', { cloud_client_id: undefined }],
		['client secret', { cloud_client_secret: undefined }],
		['redirect URL', { cloud_redirect_url: undefined }],
	])('reconciles an existing grant before reporting a missing Cloud %s', async (_label, missingField) => {
		const result = await service.validate({
			enabled: true,
			mode: HomeyConnectionMode.CLOUD,
			cloud_client_id: 'client-id',
			cloud_client_secret: 'client-secret',
			cloud_redirect_url: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
			...missingField,
		});

		expect(result.valid).toBe(false);
		expect(cloudGrantMutations.hasActiveGrant).toHaveBeenCalledTimes(1);
	});

	it('keeps an enabled cloud connector stopped until Homey authorization is complete', async () => {
		cloudGrantMutations.hasActiveGrant.mockResolvedValue(false);

		await expect(
			service.validate({
				enabled: true,
				mode: HomeyConnectionMode.CLOUD,
				cloud_client_id: 'client-id',
				cloud_client_secret: 'client-secret',
				cloud_redirect_url: 'https://panel.example.com/api/v1/plugins/devices-homey/oauth/callback',
			}),
		).resolves.toEqual({
			valid: false,
			errors: [{ message: 'Homey Cloud authorization is required', field: 'mode' }],
		});
	});

	it('rejects an unknown connection mode even while disabled', async () => {
		await expect(service.validate({ enabled: false, mode: 'other' })).resolves.toEqual({
			valid: false,
			errors: [{ message: 'Homey connection mode must be local or cloud', field: 'mode' }],
		});
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
		const result = await service.validate({ enabled: true, url: 'http://homey.local:4859' });

		expect(result).toEqual({
			valid: false,
			errors: [{ message: 'Homey API key is required', field: 'api_key' }],
		});
	});

	it('applies interval defaults to a minimal enabled candidate', async () => {
		await expect(
			service.validate({
				enabled: true,
				url: 'http://homey.local:4859',
				apiKey: 'configured-secret',
			}),
		).resolves.toEqual({ valid: true });
	});

	it('accepts a complete local configuration without connecting', async () => {
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
		await expect(service.validate({ ...base, reconciliationInterval: 1000 })).resolves.toMatchObject({
			valid: false,
		});
	});
});
