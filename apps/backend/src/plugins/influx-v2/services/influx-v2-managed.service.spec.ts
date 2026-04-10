/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { INFLUX_V2_PLUGIN_NAME } from '../influx-v2.constants';

import { InfluxV2ManagedService } from './influx-v2-managed.service';
import { InfluxV2Storage } from './influx-v2.storage';

jest.mock('./influx-v2.storage');

type Cfg = {
	enabled: boolean;
	type: string;
	url: string;
	token?: string;
	org: string;
	bucket: string;
};

describe('InfluxV2ManagedService', () => {
	let svc: InfluxV2ManagedService;
	let cfgRef: Cfg;
	let configService: { getPluginConfig: jest.Mock };
	let storageService: { registerPlugin: jest.Mock; unregisterPlugin: jest.Mock };

	const MockInfluxV2Storage = InfluxV2Storage as jest.MockedClass<typeof InfluxV2Storage>;

	beforeEach(async () => {
		cfgRef = {
			enabled: true,
			type: INFLUX_V2_PLUGIN_NAME,
			url: 'http://localhost:8086',
			token: 'my-token',
			org: 'fastybird',
			bucket: 'smart-panel',
		};

		configService = {
			getPluginConfig: jest.fn().mockImplementation(() => cfgRef),
		};

		storageService = {
			registerPlugin: jest.fn(),
			unregisterPlugin: jest.fn(),
		};

		MockInfluxV2Storage.mockClear();
		MockInfluxV2Storage.prototype.initialize = jest.fn().mockResolvedValue(undefined);
		MockInfluxV2Storage.prototype.destroy = jest.fn().mockResolvedValue(undefined);
		MockInfluxV2Storage.prototype.isAvailable = jest.fn().mockReturnValue(true);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				InfluxV2ManagedService,
				{ provide: ConfigService, useValue: configService },
				{ provide: StorageService, useValue: storageService },
			],
		}).compile();

		svc = module.get(InfluxV2ManagedService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('interface properties', () => {
		it('has correct pluginName and serviceId', () => {
			expect(svc.pluginName).toBe(INFLUX_V2_PLUGIN_NAME);
			expect(svc.serviceId).toBe('storage');
		});

		it('has priority 10 (before default device plugins)', () => {
			expect(svc.getPriority()).toBe(10);
		});
	});

	describe('start', () => {
		it('calls initialize BEFORE registerPlugin (V2 order)', async () => {
			expect(svc.getState()).toBe('stopped');

			const callOrder: string[] = [];

			(MockInfluxV2Storage.prototype.initialize as jest.Mock).mockImplementation(() => {
				callOrder.push('initialize');

				return Promise.resolve();
			});

			storageService.registerPlugin.mockImplementation(() => {
				callOrder.push('registerPlugin');
			});

			await svc.start();

			expect(MockInfluxV2Storage).toHaveBeenCalledWith({
				url: 'http://localhost:8086',
				token: 'my-token',
				org: 'fastybird',
				bucket: 'smart-panel',
			});
			expect(MockInfluxV2Storage.prototype.initialize).toHaveBeenCalledTimes(1);
			expect(storageService.registerPlugin).toHaveBeenCalledWith(
				INFLUX_V2_PLUGIN_NAME,
				expect.any(MockInfluxV2Storage),
			);
			expect(callOrder).toEqual(['initialize', 'registerPlugin']);
			expect(svc.getState()).toBe('started');
		});

		it('transitions through starting state', async () => {
			const states: string[] = [];
			const origStart = MockInfluxV2Storage.prototype.initialize as jest.Mock;

			origStart.mockImplementation(() => {
				states.push(svc.getState());
			});

			await svc.start();

			expect(states).toContain('starting');
			expect(svc.getState()).toBe('started');
		});

		it('sets error state when initialization fails', async () => {
			(MockInfluxV2Storage.prototype.initialize as jest.Mock).mockRejectedValue(new Error('Connection refused'));

			await expect(svc.start()).rejects.toThrow('Connection refused');

			expect(svc.getState()).toBe('error');
			// initialize is called before registerPlugin in V2, so registerPlugin should not be called on failure
			expect(storageService.registerPlugin).not.toHaveBeenCalled();
			expect(storageService.unregisterPlugin).toHaveBeenCalledWith(INFLUX_V2_PLUGIN_NAME);
		});

		it('is idempotent when already started', async () => {
			await svc.start();

			MockInfluxV2Storage.mockClear();

			await svc.start();

			expect(MockInfluxV2Storage).not.toHaveBeenCalled();
			expect(svc.getState()).toBe('started');
		});

		it('can restart from error state and destroys old storage first', async () => {
			(MockInfluxV2Storage.prototype.initialize as jest.Mock).mockRejectedValueOnce(new Error('fail'));

			await expect(svc.start()).rejects.toThrow('fail');
			expect(svc.getState()).toBe('error');

			// Restore normal behavior
			(MockInfluxV2Storage.prototype.initialize as jest.Mock).mockResolvedValue(undefined);
			(MockInfluxV2Storage.prototype.destroy as jest.Mock).mockClear();

			await svc.start();

			// Old storage should have been destroyed before creating new one
			expect(MockInfluxV2Storage.prototype.destroy).toHaveBeenCalledTimes(1);
			expect(svc.getState()).toBe('started');
		});
	});

	describe('stop', () => {
		it('unregisters plugin and destroys storage', async () => {
			await svc.start();
			await svc.stop();

			expect(storageService.unregisterPlugin).toHaveBeenCalledWith(INFLUX_V2_PLUGIN_NAME);
			expect(MockInfluxV2Storage.prototype.destroy).toHaveBeenCalledTimes(1);
			expect(svc.getState()).toBe('stopped');
		});

		it('is idempotent when already stopped', async () => {
			await svc.stop();

			expect(storageService.unregisterPlugin).not.toHaveBeenCalled();
			expect(svc.getState()).toBe('stopped');
		});

		it('can stop from error state', async () => {
			(MockInfluxV2Storage.prototype.initialize as jest.Mock).mockRejectedValueOnce(new Error('fail'));

			await expect(svc.start()).rejects.toThrow('fail');

			await svc.stop();

			expect(svc.getState()).toBe('stopped');
		});
	});

	describe('isHealthy', () => {
		it('returns true when storage is available', async () => {
			await svc.start();

			expect(await svc.isHealthy()).toBe(true);
		});

		it('returns false when storage is not available', async () => {
			await svc.start();

			(MockInfluxV2Storage.prototype.isAvailable as jest.Mock).mockReturnValue(false);

			expect(await svc.isHealthy()).toBe(false);
		});

		it('returns false when not started', async () => {
			expect(await svc.isHealthy()).toBe(false);
		});
	});

	describe('onConfigChanged', () => {
		it('signals restart when url changes', async () => {
			await svc.start();

			const newCfg = { ...cfgRef, url: 'http://192.168.1.100:8086' };

			configService.getPluginConfig.mockReturnValue(newCfg);

			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('signals restart when token changes', async () => {
			await svc.start();

			const newCfg = { ...cfgRef, token: 'new-secret-token' };

			configService.getPluginConfig.mockReturnValue(newCfg);

			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('signals restart when org changes', async () => {
			await svc.start();

			const newCfg = { ...cfgRef, org: 'new-org' };

			configService.getPluginConfig.mockReturnValue(newCfg);

			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('signals restart when bucket changes', async () => {
			await svc.start();

			const newCfg = { ...cfgRef, bucket: 'new-bucket' };

			configService.getPluginConfig.mockReturnValue(newCfg);

			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('does not require restart when config has not changed', async () => {
			await svc.start();

			configService.getPluginConfig.mockReturnValue(cfgRef);

			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});

		it('clears cached config when not started', async () => {
			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: false });
		});
	});

	describe('silent initialization failure', () => {
		it('throws and transitions to error when initialize succeeds but isAvailable returns false', async () => {
			(MockInfluxV2Storage.prototype.isAvailable as jest.Mock).mockReturnValue(false);

			await expect(svc.start()).rejects.toThrow('InfluxDB v2 not available after initialization');

			expect(svc.getState()).toBe('error');
			// registerPlugin should NOT have been called because isAvailable check happens before it
			expect(storageService.registerPlugin).not.toHaveBeenCalled();
			expect(storageService.unregisterPlugin).toHaveBeenCalledWith(INFLUX_V2_PLUGIN_NAME);
		});

		it('checks isAvailable after initialize and before registerPlugin', async () => {
			const callOrder: string[] = [];

			(MockInfluxV2Storage.prototype.initialize as jest.Mock).mockImplementation(() => {
				callOrder.push('initialize');

				return Promise.resolve();
			});

			(MockInfluxV2Storage.prototype.isAvailable as jest.Mock).mockImplementation(() => {
				callOrder.push('isAvailable');

				return true;
			});

			storageService.registerPlugin.mockImplementation(() => {
				callOrder.push('registerPlugin');
			});

			await svc.start();

			expect(callOrder).toEqual(['initialize', 'isAvailable', 'registerPlugin']);
		});
	});

	describe('full lifecycle', () => {
		it('supports start -> stop -> start cycle', async () => {
			await svc.start();
			expect(svc.getState()).toBe('started');

			await svc.stop();
			expect(svc.getState()).toBe('stopped');

			await svc.start();
			expect(svc.getState()).toBe('started');

			expect(MockInfluxV2Storage.prototype.initialize).toHaveBeenCalledTimes(2);
			expect(storageService.registerPlugin).toHaveBeenCalledTimes(2);
		});
	});
});
