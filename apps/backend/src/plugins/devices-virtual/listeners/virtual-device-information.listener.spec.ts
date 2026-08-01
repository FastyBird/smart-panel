import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualValueOrigin } from '../entities/devices-virtual.entity';

import { VirtualDeviceInformationListener } from './virtual-device-information.listener';

describe('VirtualDeviceInformationListener', () => {
	let listener: VirtualDeviceInformationListener;
	let channelsService: { findOneBy: jest.Mock };
	let channelsPropertiesService: { findOneBy: jest.Mock; create: jest.Mock };
	let connectivity: { setConnectionState: jest.Mock };

	const virtualDevice = { id: 'virtual-device', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
	const infoChannel = { id: 'info-channel', type: DEVICES_VIRTUAL_TYPE } as ChannelEntity;

	beforeEach(() => {
		channelsService = { findOneBy: jest.fn().mockResolvedValue(infoChannel) };
		channelsPropertiesService = {
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockResolvedValue(undefined),
		};
		connectivity = { setConnectionState: jest.fn().mockResolvedValue(undefined) };

		listener = new VirtualDeviceInformationListener(
			channelsService as unknown as ChannelsService,
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			connectivity as unknown as DeviceConnectivityService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('ignores devices that are not virtual', async () => {
		await listener.handleDeviceCreated({ id: 'other-device', type: 'generic' } as DeviceEntity);

		expect(connectivity.setConnectionState).not.toHaveBeenCalled();
		expect(channelsService.findOneBy).not.toHaveBeenCalled();
	});

	it('ensures the device_information channel via setConnectionState before looking it up', async () => {
		await listener.handleDeviceCreated(virtualDevice);

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
		expect(channelsService.findOneBy).toHaveBeenCalledWith(
			'category',
			ChannelCategory.DEVICE_INFORMATION,
			'virtual-device',
		);
	});

	it('creates manufacturer as an owned, read-only string property', async () => {
		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).toHaveBeenCalledWith(
			'info-channel',
			expect.objectContaining({
				category: PropertyCategory.MANUFACTURER,
				value: 'FastyBird',
				value_origin: VirtualValueOrigin.LOCAL,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.STRING,
			}),
		);
	});

	it('creates model as an owned, read-only string property', async () => {
		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).toHaveBeenCalledWith(
			'info-channel',
			expect.objectContaining({
				category: PropertyCategory.MODEL,
				value: 'Virtual Device',
				value_origin: VirtualValueOrigin.LOCAL,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.STRING,
			}),
		);
	});

	it("creates serial_number as an owned, read-only string property set to the device's own id", async () => {
		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).toHaveBeenCalledWith(
			'info-channel',
			expect.objectContaining({
				category: PropertyCategory.SERIAL_NUMBER,
				value: 'virtual-device',
				value_origin: VirtualValueOrigin.LOCAL,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.STRING,
			}),
		);
	});

	it('creates exactly the three owned properties, no more', async () => {
		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).toHaveBeenCalledTimes(3);
	});

	it('does not recreate a property that already exists', async () => {
		channelsPropertiesService.findOneBy.mockResolvedValue({ id: 'existing' });

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).not.toHaveBeenCalled();
	});

	it('skips synthesis when the device information channel cannot be resolved', async () => {
		channelsService.findOneBy.mockResolvedValue(null);

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).not.toHaveBeenCalled();
	});

	it('logs and swallows unexpected errors rather than rejecting', async () => {
		connectivity.setConnectionState.mockRejectedValue(new Error('boom'));

		await expect(listener.handleDeviceCreated(virtualDevice)).resolves.toBeUndefined();
	});
});
