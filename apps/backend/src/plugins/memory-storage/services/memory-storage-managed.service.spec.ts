/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { StorageService } from '../../../modules/storage/services/storage.service';
import { MEMORY_PLUGIN_NAME } from '../memory-storage.constants';

import { MemoryStorageManagedService } from './memory-storage-managed.service';
import { MemoryStorage } from './memory-storage.storage';

jest.mock('./memory-storage.storage');

describe('MemoryStorageManagedService', () => {
	let svc: MemoryStorageManagedService;
	let storageService: { registerPlugin: jest.Mock; unregisterPlugin: jest.Mock };

	const MockMemoryStorage = MemoryStorage as jest.MockedClass<typeof MemoryStorage>;

	beforeEach(async () => {
		storageService = {
			registerPlugin: jest.fn(),
			unregisterPlugin: jest.fn(),
		};

		MockMemoryStorage.mockClear();
		MockMemoryStorage.prototype.initialize = jest.fn().mockResolvedValue(undefined);
		MockMemoryStorage.prototype.destroy = jest.fn().mockResolvedValue(undefined);
		MockMemoryStorage.prototype.isAvailable = jest.fn().mockReturnValue(true);

		const module: TestingModule = await Test.createTestingModule({
			providers: [MemoryStorageManagedService, { provide: StorageService, useValue: storageService }],
		}).compile();

		svc = module.get(MemoryStorageManagedService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('interface properties', () => {
		it('has correct pluginName and serviceId', () => {
			expect(svc.pluginName).toBe(MEMORY_PLUGIN_NAME);
			expect(svc.serviceId).toBe('storage');
		});

		it('has priority 10 (before default device plugins)', () => {
			expect(svc.getPriority()).toBe(10);
		});
	});

	describe('start', () => {
		it('creates MemoryStorage, initializes, and registers with StorageService', async () => {
			expect(svc.getState()).toBe('stopped');

			await svc.start();

			expect(MockMemoryStorage).toHaveBeenCalledTimes(1);
			expect(MockMemoryStorage.prototype.initialize).toHaveBeenCalledTimes(1);
			expect(storageService.registerPlugin).toHaveBeenCalledWith(MEMORY_PLUGIN_NAME, expect.any(MockMemoryStorage));
			expect(svc.getState()).toBe('started');
		});

		it('transitions through starting state', async () => {
			const states: string[] = [];
			const origStart = MockMemoryStorage.prototype.initialize as jest.Mock;

			origStart.mockImplementation(() => {
				states.push(svc.getState());
			});

			await svc.start();

			expect(states).toContain('starting');
			expect(svc.getState()).toBe('started');
		});

		it('sets error state when initialization fails', async () => {
			(MockMemoryStorage.prototype.initialize as jest.Mock).mockRejectedValue(new Error('Init failed'));

			await expect(svc.start()).rejects.toThrow('Init failed');

			expect(svc.getState()).toBe('error');
			expect(storageService.registerPlugin).not.toHaveBeenCalled();
		});

		it('is idempotent when already started', async () => {
			await svc.start();

			MockMemoryStorage.mockClear();

			await svc.start();

			expect(MockMemoryStorage).not.toHaveBeenCalled();
			expect(svc.getState()).toBe('started');
		});

		it('can restart from error state and destroys old storage first', async () => {
			(MockMemoryStorage.prototype.initialize as jest.Mock).mockRejectedValueOnce(new Error('fail'));

			await expect(svc.start()).rejects.toThrow('fail');
			expect(svc.getState()).toBe('error');

			(MockMemoryStorage.prototype.initialize as jest.Mock).mockResolvedValue(undefined);
			(MockMemoryStorage.prototype.destroy as jest.Mock).mockClear();

			await svc.start();

			// Old storage should have been destroyed before creating new one
			expect(MockMemoryStorage.prototype.destroy).toHaveBeenCalledTimes(1);
			expect(svc.getState()).toBe('started');
		});
	});

	describe('stop', () => {
		it('unregisters plugin and destroys storage', async () => {
			await svc.start();
			await svc.stop();

			expect(storageService.unregisterPlugin).toHaveBeenCalledWith(MEMORY_PLUGIN_NAME);
			expect(MockMemoryStorage.prototype.destroy).toHaveBeenCalledTimes(1);
			expect(svc.getState()).toBe('stopped');
		});

		it('is idempotent when already stopped', async () => {
			await svc.stop();

			expect(storageService.unregisterPlugin).not.toHaveBeenCalled();
			expect(svc.getState()).toBe('stopped');
		});

		it('can stop from error state', async () => {
			(MockMemoryStorage.prototype.initialize as jest.Mock).mockRejectedValueOnce(new Error('fail'));

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

			(MockMemoryStorage.prototype.isAvailable as jest.Mock).mockReturnValue(false);

			expect(await svc.isHealthy()).toBe(false);
		});

		it('returns false when not started', async () => {
			expect(await svc.isHealthy()).toBe(false);
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

			expect(MockMemoryStorage.prototype.initialize).toHaveBeenCalledTimes(2);
			expect(storageService.registerPlugin).toHaveBeenCalledTimes(2);
		});
	});
});
