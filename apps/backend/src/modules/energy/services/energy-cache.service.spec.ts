import { Logger } from '@nestjs/common';

import { ConfigService } from '../../config/services/config.service';
import { DEFAULT_CACHE_TTL_SECONDS } from '../energy.constants';

import { EnergyCacheService } from './energy-cache.service';

describe('EnergyCacheService', () => {
	let service: EnergyCacheService;
	let configService: Partial<ConfigService>;

	beforeEach(() => {
		configService = {
			getModuleConfig: jest.fn().mockReturnValue({ cacheTtlSeconds: DEFAULT_CACHE_TTL_SECONDS }),
		};
		service = new EnergyCacheService(configService as ConfigService);

		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.restoreAllMocks();
	});

	describe('getOrCompute', () => {
		it('should compute and cache the value on first call', async () => {
			const compute = jest.fn().mockResolvedValue(42);

			const result = await service.getOrCompute('test-key', compute);

			expect(result).toBe(42);
			expect(compute).toHaveBeenCalledTimes(1);
		});

		it('should return cached value on second call within TTL', async () => {
			const compute = jest.fn().mockResolvedValue({ value: 'cached' });

			const result1 = await service.getOrCompute('test-key', compute);
			const result2 = await service.getOrCompute('test-key', compute);

			expect(result1).toEqual({ value: 'cached' });
			expect(result2).toEqual({ value: 'cached' });
			expect(compute).toHaveBeenCalledTimes(1);
		});

		it('should recompute after TTL expires', async () => {
			// Use a very short TTL for testing
			(configService.getModuleConfig as jest.Mock).mockReturnValue({ cacheTtlSeconds: 0.05 });

			const compute = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

			const result1 = await service.getOrCompute('test-key', compute);
			expect(result1).toBe('first');
			expect(compute).toHaveBeenCalledTimes(1);

			// Wait for TTL to expire (50ms + buffer)
			await new Promise((resolve) => setTimeout(resolve, 80));

			const result2 = await service.getOrCompute('test-key', compute);
			expect(result2).toBe('second');
			expect(compute).toHaveBeenCalledTimes(2);
		});

		it('should use different cache entries for different keys', async () => {
			const computeA = jest.fn().mockResolvedValue('A');
			const computeB = jest.fn().mockResolvedValue('B');

			const resultA = await service.getOrCompute('key-a', computeA);
			const resultB = await service.getOrCompute('key-b', computeB);

			expect(resultA).toBe('A');
			expect(resultB).toBe('B');
			expect(computeA).toHaveBeenCalledTimes(1);
			expect(computeB).toHaveBeenCalledTimes(1);
		});

		it('should skip caching when TTL is 0', async () => {
			(configService.getModuleConfig as jest.Mock).mockReturnValue({ cacheTtlSeconds: 0 });

			const compute = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

			const result1 = await service.getOrCompute('test-key', compute);
			const result2 = await service.getOrCompute('test-key', compute);

			expect(result1).toBe('first');
			expect(result2).toBe('second');
			expect(compute).toHaveBeenCalledTimes(2);
		});

		it('should use default TTL when config throws', async () => {
			(configService.getModuleConfig as jest.Mock).mockImplementation(() => {
				throw new Error('Config not available');
			});

			const compute = jest.fn().mockResolvedValue('value');

			const result1 = await service.getOrCompute('test-key', compute);
			const result2 = await service.getOrCompute('test-key', compute);

			expect(result1).toBe('value');
			expect(result2).toBe('value');
			expect(compute).toHaveBeenCalledTimes(1);
		});
	});

	describe('invalidateByPrefix', () => {
		it('should invalidate all entries with matching prefix', async () => {
			const compute = jest.fn().mockResolvedValue('value');

			await service.getOrCompute('home:summary:today', compute);
			await service.getOrCompute('home:summary:week', compute);
			await service.getOrCompute('space:abc:summary:today', compute);

			expect(compute).toHaveBeenCalledTimes(3);

			service.invalidateByPrefix('home:');

			// Reset mock
			compute.mockResolvedValue('new-value');

			// Home keys should recompute
			await service.getOrCompute('home:summary:today', compute);
			await service.getOrCompute('home:summary:week', compute);
			// Space key should still be cached
			await service.getOrCompute('space:abc:summary:today', compute);

			// 3 initial + 2 recomputed home keys = 5
			expect(compute).toHaveBeenCalledTimes(5);
		});
	});

	describe('clear', () => {
		it('should clear all cache entries', async () => {
			const compute = jest.fn().mockResolvedValue('value');

			await service.getOrCompute('key-1', compute);
			await service.getOrCompute('key-2', compute);

			expect(compute).toHaveBeenCalledTimes(2);

			service.clear();

			compute.mockResolvedValue('new-value');

			await service.getOrCompute('key-1', compute);
			await service.getOrCompute('key-2', compute);

			expect(compute).toHaveBeenCalledTimes(4);
		});
	});
});
