import { ConfigService } from '../../../modules/config/services/config.service';
import {
	DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
	DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
	DEVICES_HOMEY_CONNECTOR_SERVICE_ID,
	DEVICES_HOMEY_PLUGIN_NAME,
	HomeyConnectionState,
} from '../devices-homey.constants';
import { HomeyConfigModel } from '../models/config.model';

import { HomeyService } from './homey.service';

describe('HomeyService', () => {
	let config: HomeyConfigModel;
	let configService: jest.Mocked<Pick<ConfigService, 'getPluginConfig'>>;
	let service: HomeyService;

	beforeEach(() => {
		config = Object.assign(new HomeyConfigModel(), {
			enabled: true,
			url: 'http://homey.local:4859',
			apiKey: 'configured-secret',
			connectionTimeout: DEFAULT_HOMEY_CONNECTION_TIMEOUT_MS,
			reconciliationInterval: DEFAULT_HOMEY_RECONCILIATION_INTERVAL_MS,
		});
		configService = { getPluginConfig: jest.fn().mockReturnValue(config) };
		service = new HomeyService(configService as unknown as ConfigService);
	});

	it('exposes the managed connector identity and starts stopped', () => {
		expect(service.pluginName).toBe(DEVICES_HOMEY_PLUGIN_NAME);
		expect(service.serviceId).toBe(DEVICES_HOMEY_CONNECTOR_SERVICE_ID);
		expect(service.getState()).toBe('stopped');
	});

	it('starts and stops idempotently without opening a transport', async () => {
		await service.start();
		await service.start();

		expect(service.getState()).toBe('started');
		expect(configService.getPluginConfig).toHaveBeenCalledTimes(1);
		expect(await service.isHealthy()).toBe(false);

		await service.stop();
		await service.stop();

		expect(service.getState()).toBe('stopped');
	});

	it('enters error state with a sanitized status if configuration loading fails', async () => {
		configService.getPluginConfig.mockImplementation(() => {
			throw new Error('raw configuration detail');
		});

		await expect(service.start()).rejects.toThrow('raw configuration detail');
		expect(service.getState()).toBe('error');
		expect(service.getStatus().lastError).toBe('Homey service failed to start');
	});

	it('reports configuration without exposing its URL or API key', () => {
		const status = service.getStatus();

		expect(status).toMatchObject({
			serviceState: 'stopped',
			connectionState: HomeyConnectionState.STOPPED,
			enabled: true,
			configured: true,
			healthy: false,
			lastError: null,
		});
		expect(status).not.toHaveProperty('apiKey');
		expect(status).not.toHaveProperty('url');
	});

	it('requests a restart only when connector configuration changes', async () => {
		await service.start();

		expect(await service.onConfigChanged()).toEqual({ restartRequired: false });

		configService.getPluginConfig.mockReturnValue(
			Object.assign(new HomeyConfigModel(), config, { apiKey: 'next-key' }),
		);

		expect(await service.onConfigChanged()).toEqual({ restartRequired: true });
	});
});
