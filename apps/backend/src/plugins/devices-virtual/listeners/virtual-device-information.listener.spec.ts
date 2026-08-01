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
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

import { VirtualDeviceInformationListener } from './virtual-device-information.listener';

describe('VirtualDeviceInformationListener', () => {
	let listener: VirtualDeviceInformationListener;
	let channelsService: { findOneBy: jest.Mock };
	let channelsPropertiesService: { findOneBy: jest.Mock; create: jest.Mock; update: jest.Mock };
	let connectivity: { setConnectionState: jest.Mock };

	const virtualDevice = { id: 'virtual-device', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;
	const infoChannel = { id: 'info-channel', type: DEVICES_VIRTUAL_TYPE } as ChannelEntity;

	// A real entity, not a literal: `isProjecting` is a getter derived from `valueOrigin`, and the
	// whole point of these cases is which side of it the synthesized property lands on.
	const connectionStateProperty = (valueOrigin: VirtualValueOrigin | undefined): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(property, {
			id: 'connection-state-prop',
			category: PropertyCategory.STATUS,
			valueOrigin,
			sourcePropertyId: null,
		});

		return property;
	};

	// findOneBy is shared by the STATUS lookup and the three device-information lookups, so route by
	// category: the connection-state property exists (DeviceConnectivityService just made it), the
	// other three do not yet.
	const withConnectionStateProperty = (property: VirtualChannelPropertyEntity | null): void => {
		channelsPropertiesService.findOneBy.mockImplementation((_column: string, category: PropertyCategory) =>
			Promise.resolve(category === PropertyCategory.STATUS ? property : null),
		);
	};

	beforeEach(() => {
		channelsService = { findOneBy: jest.fn().mockResolvedValue(infoChannel) };
		channelsPropertiesService = {
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockResolvedValue(undefined),
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

	// -- the synthesized connection-state property is owned, not projected ----------------------
	//
	// Regression tests for every virtual device being permanently uncommandable. setConnectionState
	// creates the `status` property through generic module code, which has no `value_origin` to give —
	// so on a virtual device it takes the SOURCE column default with a null sourcePropertyId, which is
	// verbatim VirtualPropertyIndexService's definition of an ORPHAN. VirtualStatusListener then
	// returns DISCONNECTED for the device on the next source connection change no matter how healthy
	// the real sources are, and PropertyCommandService rejects every command against an offline
	// device. The property is owned by the virtual device and projected from nowhere, so it must be
	// LOCAL. Latent until the index started recording orphans at all — before that the degradation
	// branch was unreachable, which is why this only became an outage recently.

	it('marks the synthesized connection state property as owned rather than leaving it an orphan', async () => {
		withConnectionStateProperty(connectionStateProperty(VirtualValueOrigin.SOURCE));

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			'connection-state-prop',
			expect.objectContaining({ value_origin: VirtualValueOrigin.LOCAL }),
		);
	});

	// `valueOrigin` carries no class field initializer (see VirtualChannelPropertyEntity), so an
	// entity that has not round-tripped through the database reads it as undefined — which means the
	// SOURCE column default, and therefore still an orphan. isProjecting is written as "not LOCAL"
	// precisely so this case is caught too.
	it('marks the connection state property as owned even when its origin has not been read back yet', async () => {
		withConnectionStateProperty(connectionStateProperty(undefined));

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			'connection-state-prop',
			expect.objectContaining({ value_origin: VirtualValueOrigin.LOCAL }),
		);
	});

	it('leaves an already owned connection state property alone', async () => {
		withConnectionStateProperty(connectionStateProperty(VirtualValueOrigin.LOCAL));

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.update).not.toHaveBeenCalled();
	});

	it('does not touch the three synthesized device information properties', async () => {
		withConnectionStateProperty(connectionStateProperty(VirtualValueOrigin.SOURCE));

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.update).toHaveBeenCalledTimes(1);
		expect(channelsPropertiesService.create).toHaveBeenCalledTimes(3);
	});
});
