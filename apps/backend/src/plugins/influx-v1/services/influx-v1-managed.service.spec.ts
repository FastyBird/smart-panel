/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { StorageService } from '../../../modules/storage/services/storage.service';
import { INFLUX_V1_PLUGIN_NAME } from '../influx-v1.constants';

import { InfluxV1ManagedService } from './influx-v1-managed.service';
import { InfluxV1Storage } from './influx-v1.storage';

jest.mock('./influx-v1.storage');

type Cfg = {
	enabled: boolean;
	type: string;
	host: string;
	database: string;
	username?: string;
	password?: string;
};

describe('InfluxV1ManagedService', () => {
	let svc: InfluxV1ManagedService;
	let cfgRef: Cfg;
	let configService: { getPluginConfig: jest.Mock };
	let storageService: { registerPlugin: jest.Mock; unregisterPlugin: jest.Mock };

	const MockInfluxV1Storage = InfluxV1Storage as jest.MockedClass<typeof InfluxV1Storage>;

	beforeEach(async () => {
		cfgRef = {
			enabled: true,
			type: INFLUX_V1_PLUGIN_NAME,
			host: '127.0.0.1',
			database: 'fastybird',
			username: undefined,
			password: undefined,
		};

		configService = {
			getPluginConfig: jest.fn().mockImplementation(() => cfgRef),
		};

		storageService = {
			registerPlugin: jest.fn(),
			unregisterPlugin: jest.fn(),
		};

		MockInfluxV1Storage.mockClear();
		MockInfluxV1Storage.prototype.initialize = jest.fn().mockResolvedValue(undefined);
		MockInfluxV1Storage.prototype.destroy = jest.fn().mockResolvedValue(undefined);
		MockInfluxV1Storage.prototype.isAvailable = jest.fn().mockReturnValue(true);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				InfluxV1ManagedService,
				{ provide: ConfigService, useValue: configService },
				{ provide: StorageService, useValue: storageService },
			],
		}).compile();

		svc = module.get(InfluxV1ManagedService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('interface properties', () => {
		it('has correct pluginName and serviceId', () => {
			expect(svc.pluginName).toBe(INFLUX_V1_PLUGIN_NAME);
			expect(svc.serviceId).toBe('storage');
		});

		it('has priority 10 (before default device plugins)', () => {
			expect(svc.getPriority()).toBe(10);
		});
	});

	describe('start', () => {
		it('registers with StorageService before initialize so schemas are flushed first', async () => {
			expect(svc.getState()).toBe('stopped');

			const callOrder: string[] = [];

			storageService.registerPlugin.mockImplementation(() => {
				callOrder.push('registerPlugin');
			});

			(MockInfluxV1Storage.prototype.initialize as jest.Mock).mockImplementation(() => {
				callOrder.push('initialize');

				return Promise.resolve();
			});

			await svc.start();

			expect(MockInfluxV1Storage).toHaveBeenCalledWith({
				host: '127.0.0.1',
				database: 'fastybird',
				username: undefined,
				password: undefined,
			});
			expect(storageService.registerPlugin).toHaveBeenCalledWith(
				INFLUX_V1_PLUGIN_NAME,
				expect.any(MockInfluxV1Storage),
			);
			expect(MockInfluxV1Storage.prototype.initialize).toHaveBeenCalledTimes(1);
			expect(callOrder).toEqual(['registerPlugin', 'initialize']);
			expect(svc.getState()).toBe('started');
		});

		it('transitions through starting state', async () => {
			const states: string[] = [];
			const origStart = MockInfluxV1Storage.prototype.initialize as jest.Mock;

			origStart.mockImplementation(() => {
				states.push(svc.getState());
			});

			await svc.start();

			expect(states).toContain('starting');
			expect(svc.getState()).toBe('started');
		});

		it('sets error state and unregisters plugin when initialization fails', async () => {
			(MockInfluxV1Storage.prototype.initialize as jest.Mock).mockRejectedValue(new Error('Connection refused'));

			await expect(svc.start()).rejects.toThrow('Connection refused');

			expect(svc.getState()).toBe('error');
			// Plugin was registered before initialize, so it must be unregistered on failure
			expect(storageService.registerPlugin).toHaveBeenCalledTimes(1);
			expect(storageService.unregisterPlugin).toHaveBeenCalledWith(INFLUX_V1_PLUGIN_NAME);
		});

		it('is idempotent when already started', async () => {
			await svc.start();

			MockInfluxV1Storage.mockClear();

			await svc.start();

			expect(MockInfluxV1Storage).not.toHaveBeenCalled();
			expect(svc.getState()).toBe('started');
		});

		it('can restart from error state', async () => {
			(MockInfluxV1Storage.prototype.initialize as jest.Mock).mockRejectedValueOnce(new Error('fail'));

			await expect(svc.start()).rejects.toThrow('fail');
			expect(svc.getState()).toBe('error');

			// Restore normal behavior
			(MockInfluxV1Storage.prototype.initialize as jest.Mock).mockResolvedValue(undefined);

			await svc.start();

			expect(svc.getState()).toBe('started');
		});
	});

	describe('stop', () => {
		it('unregisters plugin and destroys storage', async () => {
			await svc.start();
			await svc.stop();

			expect(storageService.unregisterPlugin).toHaveBeenCalledWith(INFLUX_V1_PLUGIN_NAME);
			expect(MockInfluxV1Storage.prototype.destroy).toHaveBeenCalledTimes(1);
			expect(svc.getState()).toBe('stopped');
		});

		it('is idempotent when already stopped', async () => {
			await svc.stop();

			expect(storageService.unregisterPlugin).not.toHaveBeenCalled();
			expect(svc.getState()).toBe('stopped');
		});

		it('can stop from error state', async () => {
			(MockInfluxV1Storage.prototype.initialize as jest.Mock).mockRejectedValueOnce(new Error('fail'));

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

			(MockInfluxV1Storage.prototype.isAvailable as jest.Mock).mockReturnValue(false);

			expect(await svc.isHealthy()).toBe(false);
		});

		it('returns false when not started', async () => {
			expect(await svc.isHealthy()).toBe(false);
		});
	});

	describe('onConfigChanged', () => {
		it('signals restart when host changes', async () => {
			await svc.start();

			const newCfg = { ...cfgRef, host: '192.168.1.100' };

			configService.getPluginConfig.mockReturnValue(newCfg);

			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('signals restart when database changes', async () => {
			await svc.start();

			const newCfg = { ...cfgRef, database: 'new_db' };

			configService.getPluginConfig.mockReturnValue(newCfg);

			const result = await svc.onConfigChanged();

			expect(result).toEqual({ restartRequired: true });
		});

		it('signals restart when credentials change', async () => {
			await svc.start();

			const newCfg = { ...cfgRef, username: 'admin', password: 'secret' };

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

	describe('full lifecycle', () => {
		it('supports start → stop → start cycle', async () => {
			await svc.start();
			expect(svc.getState()).toBe('started');

			await svc.stop();
			expect(svc.getState()).toBe('stopped');

			await svc.start();
			expect(svc.getState()).toBe('started');

			expect(MockInfluxV1Storage.prototype.initialize).toHaveBeenCalledTimes(2);
			expect(storageService.registerPlugin).toHaveBeenCalledTimes(2);
		});
	});
});
