import { instanceToPlain } from 'class-transformer';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOMEY_TYPE } from '../devices-homey.constants';
import {
	HomeyInventoryAdoptionFilter,
	HomeyInventoryAvailabilityFilter,
	HomeyInventorySupportFilter,
} from '../dto/list-homey-devices.dto';
import { HomeyDeviceEntity } from '../entities/devices-homey.entity';
import { HomeyInventoryDeviceNotFoundError, HomeyInventoryUnavailableError } from '../errors/homey-inventory.error';
import { HomeyMappingLoaderService } from '../mappings/mapping-loader.service';
import { HomeyCapabilityType, createHomeyCapability } from '../models/homey-capability.model';
import { HomeyDevice } from '../models/homey-device.model';
import { HomeyDeviceSupportReason, HomeyDeviceSupportState } from '../models/inventory.model';

import { HomeyDeviceInventoryService } from './homey-device-inventory.service';
import { HomeyService } from './homey.service';

function createCapability(id: string, value: boolean | number) {
	return createHomeyCapability({
		id,
		title: id,
		value,
		type: typeof value === 'boolean' ? HomeyCapabilityType.BOOLEAN : HomeyCapabilityType.NUMBER,
		unit: typeof value === 'number' ? '%' : null,
		minimum: null,
		maximum: null,
		step: null,
		enumValues: [],
		readable: true,
		writable: typeof value === 'boolean',
		available: true,
		lastUpdatedAt: '2026-08-20T10:00:00.000Z',
	});
}

function createDevice(overrides: Partial<HomeyDevice> = {}): HomeyDevice {
	return {
		id: 'homey-light-a',
		name: 'Alpha light',
		class: 'light',
		zoneId: 'zone-living',
		zoneName: 'Living room',
		zonePath: ['Ground floor', 'Living room'],
		available: true,
		availabilityMessage: null,
		driverId: 'homey:app:driver:light',
		manufacturer: 'Example',
		model: 'Light 1',
		energy: null,
		capabilities: [createCapability('onoff', true), createCapability('dim', 0.5)],
		...overrides,
	};
}

function createAdoptedDevice(id: string, identifier: string): HomeyDeviceEntity {
	return Object.assign(new HomeyDeviceEntity(), { id, identifier });
}

describe('HomeyDeviceInventoryService', () => {
	let snapshot: readonly HomeyDevice[] | null;
	let homeyService: jest.Mocked<Pick<HomeyService, 'getInventorySnapshot'>>;
	let devicesService: jest.Mocked<Pick<DevicesService, 'findAll'>>;
	let mappingLoader: HomeyMappingLoaderService;
	let service: HomeyDeviceInventoryService;

	beforeEach(() => {
		snapshot = [
			createDevice({ id: 'homey-light-b', name: 'alpha light', available: false }),
			createDevice(),
			createDevice({
				id: 'homey-speaker',
				name: 'Unsupported speaker',
				class: 'speaker',
				zoneId: 'zone-office',
				zoneName: 'Office',
				zonePath: ['Ground floor', 'Office'],
				capabilities: [createCapability('volume_set', 0.25)],
			}),
		];
		homeyService = { getInventorySnapshot: jest.fn(() => snapshot) };
		devicesService = {
			findAll: jest
				.fn()
				.mockResolvedValue([createAdoptedDevice('00000000-0000-4000-8000-000000000002', 'homey-light-b')]),
		};
		mappingLoader = new HomeyMappingLoaderService();
		mappingLoader.onModuleInit();
		service = new HomeyDeviceInventoryService(
			homeyService as unknown as HomeyService,
			devicesService as unknown as DevicesService,
			mappingLoader,
		);
	});

	it('returns stable normalized summaries with support and type-scoped adoption state', async () => {
		const result = await service.findAll();

		expect(result.map((device) => device.id)).toEqual(['homey-light-a', 'homey-light-b', 'homey-speaker']);
		expect(devicesService.findAll).toHaveBeenCalledWith(DEVICES_HOMEY_TYPE);
		expect(result[0]).toMatchObject({
			zonePath: ['Ground floor', 'Living room'],
			supportState: HomeyDeviceSupportState.SUPPORTED,
			supportReasons: [],
			suggestedCategory: DeviceCategory.LIGHTING,
			adopted: false,
			adoptedDeviceId: null,
		});
		expect(result[0]?.capabilities.map((capability) => capability.id)).toEqual(['dim', 'onoff']);
		expect(result[1]).toMatchObject({
			adopted: true,
			adoptedDeviceId: '00000000-0000-4000-8000-000000000002',
		});
		expect(result[2]).toMatchObject({
			supportState: HomeyDeviceSupportState.UNSUPPORTED,
			supportReasons: [HomeyDeviceSupportReason.NO_DEVICE_MAPPING],
			suggestedCategory: null,
		});

		const serialized = JSON.stringify(instanceToPlain(result));
		expect(serialized).not.toContain('availabilityMessage');
		expect(serialized).not.toContain('lastUpdatedAt');
		expect(serialized).not.toContain('"value"');
		expect(serialized).not.toContain('"energy"');
	});

	it('applies support, adoption, availability, zone, class, and search filters', async () => {
		await expect(
			service.findAll({
				support: HomeyInventorySupportFilter.SUPPORTED,
				adoption: HomeyInventoryAdoptionFilter.ADOPTED,
				availability: HomeyInventoryAvailabilityFilter.UNAVAILABLE,
				zoneId: 'zone-living',
				deviceClass: 'light',
				search: 'example',
			}),
		).resolves.toMatchObject([{ id: 'homey-light-b' }]);

		await expect(
			service.findAll({
				support: HomeyInventorySupportFilter.UNSUPPORTED,
				adoption: HomeyInventoryAdoptionFilter.NOT_ADOPTED,
				availability: HomeyInventoryAvailabilityFilter.AVAILABLE,
				search: 'office',
			}),
		).resolves.toMatchObject([{ id: 'homey-speaker' }]);
	});

	it('reports blocking mapping conflicts with stable reason codes', async () => {
		const resolution = mappingLoader.resolveDeviceMappings(createDevice());
		jest.spyOn(mappingLoader, 'resolveDeviceMappings').mockReturnValue({
			mappings: resolution.mappings,
			conflicts: [{ kind: 'devices', key: 'device', policy: 'error', mappings: ['light', 'override-light'] }],
		});

		const result = await service.findOne('homey-light-a');

		expect(result.supportState).toBe(HomeyDeviceSupportState.CONFLICTED);
		expect(result.supportReasons).toContain(HomeyDeviceSupportReason.DEVICE_MAPPING_CONFLICT);
	});

	it('rejects property bindings that do not target a resolved channel', async () => {
		const resolution = mappingLoader.resolveChannelMappings(createDevice());
		jest.spyOn(mappingLoader, 'resolveChannelMappings').mockReturnValue({
			mappings: resolution.mappings.map((mapping) => ({
				...mapping,
				channel: { ...mapping.channel, identifier: 'unrelated-channel' },
			})),
			conflicts: resolution.conflicts,
		});

		const result = await service.findOne('homey-light-a');

		expect(result.supportState).toBe(HomeyDeviceSupportState.UNSUPPORTED);
		expect(result.supportReasons).toContain(HomeyDeviceSupportReason.NO_COMPATIBLE_PROPERTY_MAPPING);
	});

	it('returns one exact device and rejects unavailable or unknown inventory', async () => {
		await expect(service.findOne('homey-light-a')).resolves.toMatchObject({ id: 'homey-light-a' });
		await expect(service.findOne('missing')).rejects.toBeInstanceOf(HomeyInventoryDeviceNotFoundError);

		snapshot = null;
		await expect(service.findAll()).rejects.toBeInstanceOf(HomeyInventoryUnavailableError);
		await expect(service.findOne('homey-light-a')).rejects.toBeInstanceOf(HomeyInventoryUnavailableError);
	});
});
