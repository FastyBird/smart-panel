/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform } from '../platforms/device.platform';

import { PlatformRegistryService } from './platform.registry.service';

describe('PlatformRegistryService', () => {
	let service: PlatformRegistryService;
	let mockLogger: jest.SpyInstance;

	beforeEach(() => {
		service = new PlatformRegistryService();
		mockLogger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
		jest.spyOn(Logger.prototype, 'warn').mockImplementation();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	const mockPlatform: IDevicePlatform = {
		getType: () => 'mock-platform',
		process: jest.fn(),
		processBatch: jest.fn(),
	};

	it('should register a new platform successfully', () => {
		const result = service.register(mockPlatform);

		expect(result).toBe(true);
		expect(service.list()).toContain('mock-platform');
		expect(mockLogger).toHaveBeenCalledWith('[PLATFORM REGISTRY] Registered new platform type=mock-platform');
	});

	it('should not register a duplicate platform', () => {
		service.register(mockPlatform);
		const result = service.register(mockPlatform);

		expect(result).toBe(false);
		expect(service.list()).toContain('mock-platform');
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			'[PLATFORM REGISTRY] Platform already registered type=mock-platform',
		);
	});

	it('should retrieve the correct platform for a device type', () => {
		service.register(mockPlatform);

		const device = { type: 'mock-platform' } as DeviceEntity;
		const platform = service.get(device);

		expect(platform).toBe(mockPlatform);
	});

	it('should return null if platform for device type is not found', () => {
		const device = { type: 'unknown-platform' } as DeviceEntity;
		const platform = service.get(device);

		expect(platform).toBeNull();
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			'[PLATFORM REGISTRY] No platform found for device type=unknown-platform',
		);
	});

	it('should return a list of registered platforms', () => {
		service.register(mockPlatform);

		const platforms = service.list();

		expect(platforms).toEqual(['mock-platform']);
	});
});
