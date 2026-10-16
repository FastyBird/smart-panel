/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { DevicesShellyNgPlugin } from '../../../plugins/devices-shelly-ng/devices-shelly-ng.plugin';
import { DEVICES_SHELLY_NG_TYPE } from '../../../plugins/devices-shelly-ng/devices-shelly-ng.constants';
import { ShellyNgDevicePlatform } from '../../../plugins/devices-shelly-ng/platforms/shelly-ng.device.platform';

import { INTENT_CLEANUP_INTERVAL } from '../../intents/intents.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { IDevicePlatform } from '../platforms/device.platform';

import { PlatformRegistryService } from './platform.registry.service';

describe('PlatformRegistryService', () => {
	let service: PlatformRegistryService;
	let mockLogger: jest.SpiedFunction<any>;

	beforeEach(() => {
		service = new PlatformRegistryService();
		mockLogger = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
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
		expect(mockLogger).toHaveBeenCalledWith(
			'[PlatformRegistryService] Registered new platform type=mock-platform',
			expect.objectContaining({ tag: 'devices-module' }),
		);
	});

	it('should not register a duplicate platform', () => {
		service.register(mockPlatform);
		const result = service.register(mockPlatform);

		expect(result).toBe(false);
		expect(service.list()).toContain('mock-platform');
		expect(Logger.prototype.warn).toHaveBeenCalledWith(
			'[PlatformRegistryService] Platform already registered type=mock-platform',
			expect.objectContaining({ tag: 'devices-module' }),
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
			'[PlatformRegistryService] No platform found for device type=unknown-platform',
			expect.objectContaining({ tag: 'devices-module' }),
		);
	});

	it('should return a list of registered platforms', () => {
		service.register(mockPlatform);

		const platforms = service.list();

		expect(platforms).toEqual(['mock-platform']);
	});

	it('should require platforms to opt into authoritative property readback', () => {
		service.register(mockPlatform);
		const device = { type: 'mock-platform' } as DeviceEntity;
		const property = {} as ChannelPropertyEntity;

		expect(service.usesAuthoritativePropertyReadback(device, property)).toBe(false);

		service = new PlatformRegistryService();
		service.register({ ...mockPlatform, usesAuthoritativePropertyReadback: () => true });

		expect(service.usesAuthoritativePropertyReadback(device, property)).toBe(true);
	});

	it('should extend an intent TTL by registered platform completion windows', () => {
		const timedPlatform = { ...mockPlatform, getCommandTimeoutMs: jest.fn((count: number) => count * 10000) };
		service.register(timedPlatform);
		const device = { type: 'mock-platform' } as DeviceEntity;

		expect(service.getCommandTtlMs([{ device, commandCount: 2 }], 5000)).toBe(20000 + 5000 + INTENT_CLEANUP_INTERVAL);
	});
	describe('captured registration continuity', () => {
		const owned = (registry: PlatformRegistryService, platform: IDevicePlatform) => {
			const registration = registry.registerOwned(platform);
			if (!registration) throw new Error('Expected successful owned registration');
			return registration;
		};
		const capture = (registry: PlatformRegistryService, type = 'mock-platform') => {
			const lease = registry.captureRegistration({ type });
			if (!lease) throw new Error('Expected captured registration');
			return lease;
		};

		it('keeps ordinary registration compatible and lookup/capture pure without granting disposal', () => {
			expect(service.captureRegistration({ type: 'mock-platform' })).toBeNull();
			expect(service.register(mockPlatform)).toBe(true);
			const original = capture(service);
			for (let index = 0; index < 3; index++) {
				expect(service.get({ type: 'mock-platform' })).toBe(mockPlatform);
				expect(service.list()).toEqual(['mock-platform']);
				expect(capture(service).isCurrent()).toBe(true);
				expect(original.isCurrent()).toBe(true);
			}
			expect(original.platform).toBe(mockPlatform);
			expect(Object.isFrozen(original)).toBe(true);
			expect('dispose' in original).toBe(false);
			expect(service.captureRegistration({ type: 'missing' })).toBeNull();
		});

		it('does not rotate registration or give an owner to either kind of duplicate', () => {
			const owner = owned(service, mockPlatform);
			const original = capture(service);
			const foreign = { ...mockPlatform };
			expect(service.registerOwned(foreign)).toBeNull();
			expect(service.register(foreign)).toBe(false);
			expect(service.registerOwned(mockPlatform)).toBeNull();
			expect(original.isCurrent()).toBe(true);
			expect(capture(service).platform).toBe(mockPlatform);
			expect(Object.isFrozen(owner)).toBe(true);
			owner.dispose();
			expect(original.isCurrent()).toBe(false);
			expect(service.get({ type: 'mock-platform' })).toBeNull();
			expect(service.list()).toEqual([]);
			owner.dispose();
			expect(original.isCurrent()).toBe(false);
		});

		it.each(['same-object', 'new-provider'] as const)('does not let the old owner remove a %s replacement or revive its captures', (replacement) => {
			const firstOwner = owned(service, mockPlatform);
			const original = capture(service);
			firstOwner.dispose();
			const nextPlatform = replacement === 'same-object' ? mockPlatform : { ...mockPlatform };
			const nextOwner = owned(service, nextPlatform);
			const next = capture(service);
			for (let index = 0; index < 3; index++) {
				firstOwner.dispose();
				expect(original.isCurrent()).toBe(false);
				expect(next.isCurrent()).toBe(true);
				expect(service.get({ type: 'mock-platform' })).toBe(nextPlatform);
			}
			nextOwner.dispose();
			expect(next.isCurrent()).toBe(false);
			expect(original.isCurrent()).toBe(false);
		});

		it('binds continuity and disposal to the original registry instance', () => {
			const other = new PlatformRegistryService();
			const firstOwner = owned(service, mockPlatform);
			const secondOwner = owned(other, mockPlatform);
			const first = capture(service), second = capture(other);
			firstOwner.dispose();
			expect(first.isCurrent()).toBe(false);
			expect(second.isCurrent()).toBe(true);
			expect(other.get({ type: 'mock-platform' })).toBe(mockPlatform);
			service.onModuleDestroy();
			expect(second.isCurrent()).toBe(true);
			secondOwner.dispose();
			expect(second.isCurrent()).toBe(false);
		});

		it('synchronously and permanently invalidates all registrations on destroy', () => {
			const owner = owned(service, mockPlatform);
			const ordinary = { ...mockPlatform, getType: () => 'ordinary' };
			expect(service.register(ordinary)).toBe(true);
			const first = capture(service), second = capture(service, 'ordinary');
			expect(service.onModuleDestroy()).toBeUndefined();
			expect(first.isCurrent()).toBe(false);
			expect(second.isCurrent()).toBe(false);
			owner.dispose(); service.onModuleDestroy(); owner.dispose();
			expect(service.list()).toEqual([]);
			expect(service.get({ type: 'mock-platform' })).toBeNull();
			expect(service.captureRegistration({ type: 'mock-platform' })).toBeNull();
			expect(service.register(mockPlatform)).toBe(false);
			expect(service.registerOwned(mockPlatform)).toBeNull();
			expect(first.isCurrent()).toBe(false);
			expect(second.isCurrent()).toBe(false);
		});

		it('preserves owned platform TTL and authoritative readback behavior', () => {
			const platform: IDevicePlatform = { ...mockPlatform, getCommandTimeoutMs: (count) => count * 10000, usesAuthoritativePropertyReadback: () => true };
			owned(service, platform);
			const device = new DeviceEntity(), property = new ChannelPropertyEntity();
			device.type = 'mock-platform';
			expect(service.getCommandTtlMs([{ device, commandCount: 2 }], 5000)).toBe(20000 + 5000 + INTENT_CLEANUP_INTERVAL);
			expect(service.usesAuthoritativePropertyReadback(device, property)).toBe(true);
		});

		it.each(['owned', 'duplicate'] as const)('actual Shelly plugin init/destroy disposes only its %s registration', async (scenario) => {
			const registry = new PlatformRegistryService();
			const incumbent: IDevicePlatform = { ...mockPlatform, getType: () => DEVICES_SHELLY_NG_TYPE };
			if (scenario === 'duplicate') expect(registry.register(incumbent)).toBe(true);
			const shellyPlatform: IDevicePlatform = { ...mockPlatform, getType: () => DEVICES_SHELLY_NG_TYPE };
			// Only registration/mapping dependencies are mocked: real plugin lifecycle and registry execute.
			// No device service, network client, module imports or physical platform methods are started.
			const module = await Test.createTestingModule({
				providers: [DevicesShellyNgPlugin,
					{ provide: PlatformRegistryService, useValue: registry },
					{ provide: ShellyNgDevicePlatform, useValue: shellyPlatform },
				],
			}).useMocker(() => ({ registerMapping: jest.fn(), register: jest.fn(), registerPluginMetadata: jest.fn() })).compile();
			try {
				await module.init();
				const plugin = module.get(DevicesShellyNgPlugin);
				const original = capture(registry, DEVICES_SHELLY_NG_TYPE);
				expect(original.platform).toBe(scenario === 'owned' ? shellyPlatform : incumbent);
				plugin.onModuleInit(); // Repeated init must not lose our original successful disposer.
				expect(original.isCurrent()).toBe(true);
				expect(plugin.onModuleDestroy()).toBeUndefined();
				expect(original.isCurrent()).toBe(scenario === 'duplicate');
				if (scenario === 'owned') {
					const replacementOwner = owned(registry, shellyPlatform);
					const replacement = capture(registry, DEVICES_SHELLY_NG_TYPE);
					plugin.onModuleDestroy();
					expect(original.isCurrent()).toBe(false);
					expect(replacement.isCurrent()).toBe(true);
					expect(registry.get({ type: DEVICES_SHELLY_NG_TYPE })).toBe(shellyPlatform);
					replacementOwner.dispose();
				} else {
					plugin.onModuleDestroy();
					expect(original.isCurrent()).toBe(true);
					expect(registry.get({ type: DEVICES_SHELLY_NG_TYPE })).toBe(incumbent);
				}
			} finally { await module.close(); }
		});
	});
});
