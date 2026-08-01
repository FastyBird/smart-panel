import { DeviceCategory, PermissionType } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualCategoryNotSupportedException, VirtualNestingNotAllowedException } from '../devices-virtual.exceptions';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

import { VirtualDevicesService } from './virtual-devices.service';
import { VirtualPropertyIndexService } from './virtual-property-index.service';

describe('VirtualDevicesService', () => {
	let service: VirtualDevicesService;
	let channelsPropertiesService: { findOne: jest.Mock };
	let channelsService: { findOne: jest.Mock };
	let devicesService: { findOne: jest.Mock };
	let index: { findByVirtualDevice: jest.Mock };

	// -- fixtures --------------------------------------------------------------------------------

	const property = (overrides: Partial<ChannelPropertyEntity> = {}): ChannelPropertyEntity => {
		const entity = new ChannelPropertyEntity();

		Object.assign(entity, { id: 'source-prop', permissions: [PermissionType.READ_ONLY] }, overrides);

		return entity;
	};

	const readOnlySource = property({ id: 'ro-source', permissions: [PermissionType.READ_ONLY] });
	const readWriteSource = property({ id: 'rw-source', permissions: [PermissionType.READ_WRITE] });

	// A linked virtual property carrying a fully-hydrated relation chain, mirroring exactly what
	// VirtualPropertyIndexService indexes (see its own spec's fixture builders).
	const linkedTo = (id: string, deviceId: string): VirtualChannelPropertyEntity => {
		const device = Object.assign(new DeviceEntity(), { id: deviceId });
		const channel = Object.assign(new ChannelEntity(), { id: `${deviceId}-channel`, device });
		const sourceProperty = Object.assign(new ChannelPropertyEntity(), { id: `${id}-source`, channel });
		const virtualProperty = new VirtualChannelPropertyEntity();

		Object.assign(virtualProperty, {
			id,
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: `${id}-source`,
			sourceProperty,
		});

		return virtualProperty;
	};

	beforeEach(() => {
		channelsPropertiesService = { findOne: jest.fn() };
		channelsService = { findOne: jest.fn() };
		devicesService = { findOne: jest.fn() };
		index = { findByVirtualDevice: jest.fn().mockReturnValue([]) };

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

			const propA = linkedTo('prop-a', 'device-a');
			const propB = linkedTo('prop-b', 'device-b');

			// Re-point the fixtures' devices at the exact instances asserted below (linkedTo() builds
			// its own DeviceEntity per call, matching how TypeORM hydrates a fresh instance per
			// relation path rather than reusing one object for the same row).
			(propA.sourceProperty.channel as ChannelEntity).device = deviceA;
			(propB.sourceProperty.channel as ChannelEntity).device = deviceB;

			index.findByVirtualDevice.mockReturnValue([propA, propB]);

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

		it('does not reject when the source property cannot be resolved at all', async () => {
			channelsPropertiesService.findOne.mockResolvedValue(null);

			await expect(service.assertSourceNotVirtual('missing')).resolves.toBeUndefined();
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

			const propA = linkedTo('prop-a', 'shared-device');
			const propB = linkedTo('prop-b', 'shared-device');

			(propA.sourceProperty.channel as ChannelEntity).device = sharedDevice;
			(propB.sourceProperty.channel as ChannelEntity).device = sharedDevice;

			index.findByVirtualDevice.mockReturnValue([propA, propB]);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([sharedDevice]);
		});

		it('returns an empty list for a virtual device with only owned properties', async () => {
			index.findByVirtualDevice.mockReturnValue([]);

			await expect(service.findSourceDevices('virtual-device')).resolves.toEqual([]);
		});
	});
});
