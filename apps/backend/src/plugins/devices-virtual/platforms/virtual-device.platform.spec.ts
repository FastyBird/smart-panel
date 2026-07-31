/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConnectionState } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { IDevicePlatform } from '../../../modules/devices/platforms/device.platform';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';

import { VirtualDevicePlatform } from './virtual-device.platform';

describe('VirtualDevicePlatform', () => {
	let platform: VirtualDevicePlatform;
	let channelsPropertiesService: { findOne: jest.Mock };
	let platformRegistryService: { get: jest.Mock };

	// Lookup tables the mocked services read from. Populated per test via `linkSource()` so that
	// resolving a `sourcePropertyId` walks property -> channel -> device exactly like the real
	// ChannelsPropertiesService/ChannelsService/DevicesService would for real rows.
	let propertiesById: Record<string, ChannelPropertyEntity>;
	let channelsById: Record<string, ChannelEntity>;
	let devicesById: Record<string, DeviceEntity>;

	// The virtual device/channel/property the command originally targeted. `processBatch` never
	// reads the virtual device/channel back out of an update — only `property` and `value` drive
	// resolution — so a single shared fixture is enough for every test.
	const virtualDevice = new VirtualDeviceEntity();
	virtualDevice.id = 'virtual-device';

	const virtualChannel = new VirtualChannelEntity();
	virtualChannel.id = 'virtual-channel';

	const virtualProperty = (overrides: Partial<VirtualChannelPropertyEntity> = {}): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(
			property,
			{ id: 'virtual-prop', valueOrigin: VirtualValueOrigin.SOURCE, sourcePropertyId: null },
			overrides,
		);

		return property;
	};

	// A plain, non-virtual source device — the ordinary case a linked property forwards to.
	const makeDevice = (id: string, overrides: Partial<DeviceEntity> = {}): DeviceEntity => {
		const device = new DeviceEntity();

		Object.assign(
			device,
			{ id, status: { online: true, status: ConnectionState.CONNECTED, lastChanged: null } },
			overrides,
		);

		return device;
	};

	// A source device that is itself virtual — used only by the nesting-rejection test.
	const makeVirtualDevice = (id: string): VirtualDeviceEntity => {
		const device = new VirtualDeviceEntity();

		Object.assign(device, { id, status: { online: true, status: ConnectionState.CONNECTED, lastChanged: null } });

		return device;
	};

	const linkSource = (
		sourcePropertyId: string,
		device: DeviceEntity,
	): { channel: ChannelEntity; property: ChannelPropertyEntity } => {
		const channelId = `${sourcePropertyId}-channel`;

		const channel = new ChannelEntity();
		Object.assign(channel, { id: channelId, device: device.id });

		const property = new ChannelPropertyEntity();
		Object.assign(property, { id: sourcePropertyId, channel: channelId });

		devicesById[device.id] = device;
		channelsById[channelId] = channel;
		propertiesById[sourcePropertyId] = property;

		return { channel, property };
	};

	const createMockPlatform = (): jest.Mocked<IDevicePlatform> => ({
		getType: jest.fn(),
		process: jest.fn(),
		processBatch: jest.fn().mockResolvedValue(true),
	});

	beforeEach(async () => {
		propertiesById = {};
		channelsById = {};
		devicesById = {};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VirtualDevicePlatform,
				{
					provide: DevicesService,
					useValue: { findOne: jest.fn((id: string) => Promise.resolve(devicesById[id] ?? null)) },
				},
				{
					provide: ChannelsService,
					useValue: { findOne: jest.fn((id: string) => Promise.resolve(channelsById[id] ?? null)) },
				},
				{
					provide: ChannelsPropertiesService,
					useValue: { findOne: jest.fn((id: string) => Promise.resolve(propertiesById[id] ?? null)) },
				},
				{
					provide: PlatformRegistryService,
					useValue: { get: jest.fn() },
				},
			],
		}).compile();

		platform = module.get(VirtualDevicePlatform);
		channelsPropertiesService = module.get(ChannelsPropertiesService);
		platformRegistryService = module.get(PlatformRegistryService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation();
		jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		jest.spyOn(Logger.prototype, 'log').mockImplementation();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('forwards a linked property write to the source device platform', async () => {
		const sourceDevice = makeDevice('source-device');
		const { property: sourceProperty } = linkSource('source-prop', sourceDevice);
		const linkedProperty = virtualProperty({ id: 'linked-prop', sourcePropertyId: 'source-prop' });

		const sourcePlatform = createMockPlatform();

		platformRegistryService.get.mockImplementation((device: DeviceEntity) =>
			device.id === sourceDevice.id ? sourcePlatform : null,
		);

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedProperty, value: true },
		]);

		expect(result).toBe(true);
		expect(sourcePlatform.processBatch).toHaveBeenCalledTimes(1);
		expect(sourcePlatform.processBatch).toHaveBeenCalledWith([
			expect.objectContaining({ device: sourceDevice, property: sourceProperty, value: true }),
		]);
	});

	it('groups updates by source device instead of issuing one call per property', async () => {
		const deviceA = makeDevice('source-device-a');
		const deviceB = makeDevice('source-device-b');

		// Two properties resolve to the SAME source device — a naive "call per property"
		// implementation would still call platformA.processBatch twice here.
		const { property: sourcePropertyA1 } = linkSource('source-prop-a1', deviceA);
		const { property: sourcePropertyA2 } = linkSource('source-prop-a2', deviceA);
		const { property: sourcePropertyB } = linkSource('source-prop-b', deviceB);

		const linkedToA1 = virtualProperty({ id: 'linked-a1', sourcePropertyId: 'source-prop-a1' });
		const linkedToA2 = virtualProperty({ id: 'linked-a2', sourcePropertyId: 'source-prop-a2' });
		const linkedToB = virtualProperty({ id: 'linked-b', sourcePropertyId: 'source-prop-b' });

		const platformA = createMockPlatform();
		const platformB = createMockPlatform();

		platformRegistryService.get.mockImplementation((device: DeviceEntity) => {
			if (device.id === deviceA.id) return platformA;
			if (device.id === deviceB.id) return platformB;

			return null;
		});

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedToA1, value: true },
			{ device: virtualDevice, channel: virtualChannel, property: linkedToA2, value: false },
			{ device: virtualDevice, channel: virtualChannel, property: linkedToB, value: 42 },
		]);

		expect(result).toBe(true);

		// Same source device -> exactly one batch call carrying both updates, not two separate calls.
		expect(platformA.processBatch).toHaveBeenCalledTimes(1);
		expect(platformA.processBatch).toHaveBeenCalledWith([
			expect.objectContaining({ property: sourcePropertyA1, value: true }),
			expect.objectContaining({ property: sourcePropertyA2, value: false }),
		]);

		expect(platformB.processBatch).toHaveBeenCalledTimes(1);
		expect(platformB.processBatch).toHaveBeenCalledWith([
			expect.objectContaining({ property: sourcePropertyB, value: 42 }),
		]);
	});

	it('rejects a write to an orphaned property', async () => {
		const orphanedProperty = virtualProperty({ id: 'orphaned-prop', sourcePropertyId: null });

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: orphanedProperty, value: true },
		]);

		expect(result).toBe(false);
		// The rejection must happen before any resolution is attempted — nothing gets looked up.
		expect(channelsPropertiesService.findOne).not.toHaveBeenCalled();
		expect(platformRegistryService.get).not.toHaveBeenCalled();
	});

	it('rejects a write to an owned property, since none are writable yet', async () => {
		// Point sourcePropertyId at a fully resolvable source so the ONLY thing rejecting this
		// write is the LOCAL check. If that check were removed, resolution would succeed and the
		// write would be forwarded, which the assertions below would catch.
		const sourceDevice = makeDevice('owned-source-device');
		linkSource('owned-source-prop', sourceDevice);

		const ownedProperty = virtualProperty({
			id: 'owned-prop',
			valueOrigin: VirtualValueOrigin.LOCAL,
			sourcePropertyId: 'owned-source-prop',
		});

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: ownedProperty, value: 'x' },
		]);

		expect(result).toBe(false);
		expect(channelsPropertiesService.findOne).not.toHaveBeenCalled();
	});

	it('refuses to forward to another virtual device', async () => {
		const nestedVirtualDevice = makeVirtualDevice('nested-virtual-device');

		linkSource('nested-source-prop', nestedVirtualDevice);

		const linkedProperty = virtualProperty({ id: 'linked-prop', sourcePropertyId: 'nested-source-prop' });

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedProperty, value: true },
		]);

		expect(result).toBe(false);
		// Nesting is refused before ever asking the registry for a platform to forward to.
		expect(platformRegistryService.get).not.toHaveBeenCalled();
	});

	it('rejects the batch when a source device is offline', async () => {
		// Matches PropertyCommandService's convention: ConnectionState.UNKNOWN is permissible,
		// only a definitively offline (online: false, status !== UNKNOWN) device is rejected.
		const sourceDevice = makeDevice('offline-source-device', {
			status: { online: false, status: ConnectionState.DISCONNECTED, lastChanged: null },
		});

		linkSource('offline-source-prop', sourceDevice);

		const linkedProperty = virtualProperty({ id: 'linked-prop', sourcePropertyId: 'offline-source-prop' });

		const result = await platform.processBatch([
			{ device: virtualDevice, channel: virtualChannel, property: linkedProperty, value: true },
		]);

		expect(result).toBe(false);
		expect(platformRegistryService.get).not.toHaveBeenCalled();
	});
});
