import { DeviceCategory, PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE, VIRTUAL_BLOCKED_CATEGORIES } from '../devices-virtual.constants';
import {
	VirtualCategoryNotSupportedException,
	VirtualNestingNotAllowedException,
	VirtualSourceNotFoundException,
} from '../devices-virtual.exceptions';

import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualPropertyIndexService, VirtualPropertyLink } from './virtual-property-index.service';

describe('VirtualDevicesService', () => {
	let service: VirtualDevicesService;
	let channelsPropertiesService: { findOne: jest.Mock };
	let channelsService: { findOne: jest.Mock };
	let devicesService: { findOne: jest.Mock };
	let index: { findLinksByVirtualDevice: jest.Mock };

	// -- fixtures --------------------------------------------------------------------------------

	const property = (overrides: Partial<ChannelPropertyEntity> = {}): ChannelPropertyEntity => {
		const entity = new ChannelPropertyEntity();

		Object.assign(entity, { id: 'source-prop', permissions: [PermissionType.READ_ONLY] }, overrides);

		return entity;
	};

	const readOnlySource = property({ id: 'ro-source', permissions: [PermissionType.READ_ONLY] });
	const readWriteSource = property({ id: 'rw-source', permissions: [PermissionType.READ_WRITE] });

	// A link exactly as VirtualPropertyIndexService records one: plain ids, never a hydrated entity.
	const linkedTo = (id: string, deviceId: string): VirtualPropertyLink => ({
		propertyId: id,
		sourcePropertyId: `${id}-source`,
		sourceDeviceId: deviceId,
	});

	beforeEach(() => {
		channelsPropertiesService = { findOne: jest.fn() };
		channelsService = { findOne: jest.fn() };
		devicesService = { findOne: jest.fn() };
		index = { findLinksByVirtualDevice: jest.fn().mockReturnValue([]) };

		service = new VirtualDevicesService(
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			channelsService as unknown as ChannelsService,
			devicesService as unknown as DevicesService,
			index as unknown as VirtualPropertyIndexService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief cases ------------------------------------------------------------------------

	describe('assertCategoryAllowed', () => {
		it('rejects a category that needs closed-loop control', () => {
			expect(() => service.assertCategoryAllowed(DeviceCategory.HEATING_UNIT)).toThrow(
				VirtualCategoryNotSupportedException,
			);
		});

		it('accepts a category that only needs wiring', () => {
			expect(() => service.assertCategoryAllowed(DeviceCategory.LIGHTING)).not.toThrow();
		});

		it('rejects every category in VIRTUAL_BLOCKED_CATEGORIES', () => {
			expect(VIRTUAL_BLOCKED_CATEGORIES.length).toBeGreaterThan(0);

			for (const category of VIRTUAL_BLOCKED_CATEGORIES) {
				expect(() => service.assertCategoryAllowed(category)).toThrow(VirtualCategoryNotSupportedException);
			}
		});
	});

	describe('assertSourceNotVirtual', () => {
		it('rejects a source property that belongs to another virtual device', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'virtual-source', channel: 'chan-1' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-1', device: 'dev-1' }));
			// `type` is a getter-only property on the base entity (each @ChildEntity overrides it), so a
			// fixture that needs a custom value casts a plain object rather than mutating `new DeviceEntity()`.
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity);

			await expect(service.assertSourceNotVirtual('virtual-source')).rejects.toThrow(VirtualNestingNotAllowedException);
		});
	});

	describe('assertPermissionsCompatible', () => {
		it('rejects a read-only source for a writable spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.READ_WRITE], readOnlySource)).toThrow();
		});

		it('accepts a read-write source for a read-only spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.READ_ONLY], readWriteSource)).not.toThrow();
		});
	});

	describe('findSourceDevices', () => {
		it('lists the distinct source devices behind a virtual device', async () => {
			const deviceA = Object.assign(new DeviceEntity(), { id: 'device-a' });
			const deviceB = Object.assign(new DeviceEntity(), { id: 'device-b' });

			index.findLinksByVirtualDevice.mockReturnValue([linkedTo('prop-a', 'device-a'), linkedTo('prop-b', 'device-b')]);

			// Loaded by id rather than read off a relation the index cached, so the devices returned
			// carry a current connection status.
			devicesService.findOne.mockImplementation((id: string) => Promise.resolve(id === 'device-a' ? deviceA : deviceB));

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([deviceA, deviceB]);
		});
	});

	// -- supplementary cases ------------------------------------------------------------------------
	// Not pinned by the brief, but exercised so each guard's branches are individually discriminated
	// (self-review checklist: "would each test fail if only its own branch broke?").

	describe('assertSourceNotVirtual — supplementary', () => {
		it('resolves through channel and device by id, not just off the property itself', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'virtual-source', channel: 'chan-1' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-1', device: 'dev-1' }));
			devicesService.findOne.mockResolvedValue({ id: 'dev-1', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity);

			await service.assertSourceNotVirtual('virtual-source').catch(() => undefined);

			// A shortcut that only inspected the property itself (e.g. property.type) would never
			// need to call these — asserting they were called with the resolved ids proves the guard
			// actually walks property -> channel -> device.
			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith('virtual-source');
			expect(channelsService.findOne).toHaveBeenCalledWith('chan-1');
			expect(devicesService.findOne).toHaveBeenCalledWith('dev-1');
		});

		it('accepts a source property belonging to a non-virtual device', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'phys-source', channel: 'chan-2' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-2', device: 'dev-2' }));
			devicesService.findOne.mockResolvedValue({ id: 'dev-2', type: 'simulator' } as DeviceEntity);

			await expect(service.assertSourceNotVirtual('phys-source')).resolves.toBeUndefined();
		});

		it('rejects nesting even when the relations are already hydrated as full entities', async () => {
			const virtualDevice = { id: 'dev-3', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
			const channel = Object.assign(new ChannelEntity(), { id: 'chan-3', device: virtualDevice });

			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'hydrated-source', channel }));
			channelsService.findOne.mockResolvedValue(channel);
			devicesService.findOne.mockResolvedValue(virtualDevice);

			await expect(service.assertSourceNotVirtual('hydrated-source')).rejects.toThrow(
				VirtualNestingNotAllowedException,
			);
		});

		it('rejects when the source property does not exist', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(null);

			await expect(service.assertSourceNotVirtual('missing')).rejects.toThrow(VirtualSourceNotFoundException);
		});

		it('rejects when the property exists but its channel does not', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'dangling-prop', channel: 'chan-4' }));
			channelsService.findOne.mockResolvedValue(null);

			await expect(service.assertSourceNotVirtual('dangling-prop')).rejects.toThrow(VirtualSourceNotFoundException);
		});

		it('rejects when the channel exists but its device does not', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(property({ id: 'dangling-prop-2', channel: 'chan-5' }));
			channelsService.findOne.mockResolvedValue(Object.assign(new ChannelEntity(), { id: 'chan-5', device: 'dev-6' }));
			devicesService.findOne.mockResolvedValue(null);

			await expect(service.assertSourceNotVirtual('dangling-prop-2')).rejects.toThrow(VirtualSourceNotFoundException);
		});
	});

	describe('assertPermissionsCompatible — supplementary', () => {
		it('rejects a read-only source for a write-only spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.WRITE_ONLY], readOnlySource)).toThrow();
		});

		it('accepts a read-write source for a write-only spec slot', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.WRITE_ONLY], readWriteSource)).not.toThrow();
		});

		it('accepts a direct permission match with no read-write involved', () => {
			expect(() => service.assertPermissionsCompatible([PermissionType.READ_ONLY], readOnlySource)).not.toThrow();
		});

		it('accepts a source satisfying every one of several required permissions', () => {
			expect(() =>
				service.assertPermissionsCompatible([PermissionType.READ_ONLY, PermissionType.WRITE_ONLY], readWriteSource),
			).not.toThrow();
		});
	});

	describe('findSourceDevices — supplementary', () => {
		it('counts a source device once even when two properties project through it', async () => {
			const sharedDevice = Object.assign(new DeviceEntity(), { id: 'shared-device' });

			index.findLinksByVirtualDevice.mockReturnValue([
				linkedTo('prop-a', 'shared-device'),
				linkedTo('prop-b', 'shared-device'),
			]);
			devicesService.findOne.mockResolvedValue(sharedDevice);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([sharedDevice]);
			expect(devicesService.findOne).toHaveBeenCalledTimes(1);
		});

		it('returns an empty list for a virtual device with only owned properties', async () => {
			index.findLinksByVirtualDevice.mockReturnValue([]);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([]);
		});

		it('skips an orphaned projection, which has no source device left to list', async () => {
			index.findLinksByVirtualDevice.mockReturnValue([
				{ propertyId: 'orphaned-prop', sourcePropertyId: null, sourceDeviceId: null },
			]);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([]);
			expect(devicesService.findOne).not.toHaveBeenCalled();
		});
	});
});
