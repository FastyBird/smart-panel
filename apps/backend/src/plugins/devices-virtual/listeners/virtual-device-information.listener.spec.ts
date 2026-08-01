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
	let channelsService: { findOneBy: jest.Mock; create: jest.Mock };
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
	// category: an already-present connection-state property (a device from before this listener owned
	// it, or a redelivered event), while the other three are still missing.
	const withConnectionStateProperty = (property: VirtualChannelPropertyEntity | null): void => {
		channelsPropertiesService.findOneBy.mockImplementation((_column: string, category: PropertyCategory) =>
			Promise.resolve(category === PropertyCategory.STATUS ? property : null),
		);
	};

	beforeEach(() => {
		channelsService = { findOneBy: jest.fn().mockResolvedValue(infoChannel), create: jest.fn() };
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

	it('records the device as connected, and resolves its device_information channel', async () => {
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

	it('creates the device_information channel itself when it does not exist yet', async () => {
		channelsService.findOneBy.mockResolvedValueOnce(null);
		channelsService.create.mockResolvedValue(infoChannel);

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsService.create).toHaveBeenCalledWith(
			expect.objectContaining({
				device: 'virtual-device',
				category: ChannelCategory.DEVICE_INFORMATION,
				identifier: 'device_information',
			}),
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

	it('creates exactly the three owned properties plus the connection state one, no more', async () => {
		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).toHaveBeenCalledTimes(4);
	});

	it('does not recreate a property that already exists', async () => {
		channelsPropertiesService.findOneBy.mockResolvedValue({ id: 'existing' });

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).not.toHaveBeenCalled();
	});

	it('skips synthesis when the device information channel can be neither found nor created', async () => {
		channelsService.findOneBy.mockResolvedValue(null);
		channelsService.create.mockRejectedValue(new Error('constraint violation'));

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).not.toHaveBeenCalled();
	});

	it('logs and swallows unexpected errors rather than rejecting', async () => {
		connectivity.setConnectionState.mockRejectedValue(new Error('boom'));

		await expect(listener.handleDeviceCreated(virtualDevice)).resolves.toBeUndefined();
	});

	// -- the connection-state property is owned, not projected ---------------------------------
	//
	// Regression tests for every virtual device being permanently uncommandable. Left to
	// DeviceConnectivityService, the `status` property is created by generic module code with no
	// `value_origin` to give — so on a virtual device it takes the SOURCE column default with a null
	// sourcePropertyId, which is verbatim VirtualPropertyIndexService's definition of an ORPHAN.
	// VirtualStatusListener then returns DISCONNECTED for the device however healthy its real sources
	// are, and PropertyCommandService rejects every command against an offline device. The property is
	// owned by the virtual device and projected from nowhere, so it must be LOCAL. Latent until the
	// index started recording orphans at all — before that the degradation branch was unreachable,
	// which is why this only became an outage recently.

	it('creates the connection state property itself, as owned', async () => {
		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.create).toHaveBeenCalledWith(
			'info-channel',
			expect.objectContaining({
				category: PropertyCategory.STATUS,
				value_origin: VirtualValueOrigin.LOCAL,
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.ENUM,
			}),
		);
	});

	// The whole point of creating it here rather than repairing it afterwards. A property that exists
	// and is already LOCAL before setConnectionState runs is never an orphan for even an instant, so the
	// index rebuild that CHANNEL_PROPERTY_CREATED triggers sees no link change and no spurious
	// DISCONNECTED recompute races the fix.
	it('creates the connection state property before recording connectivity', async () => {
		const order: string[] = [];

		channelsPropertiesService.create.mockImplementation((_channelId: string, dto: { category: PropertyCategory }) => {
			order.push(`create:${dto.category}`);

			return Promise.resolve(undefined);
		});
		connectivity.setConnectionState.mockImplementation(() => {
			order.push('setConnectionState');

			return Promise.resolve(undefined);
		});

		await listener.handleDeviceCreated(virtualDevice);

		expect(order.indexOf(`create:${PropertyCategory.STATUS}`)).toBeLessThan(order.indexOf('setConnectionState'));
	});

	// The format has to accept every state DeviceConnectivityService can write, or its own value writes
	// would fail validation against a property this listener created.
	it('accepts every connection state the connectivity service can write', async () => {
		await listener.handleDeviceCreated(virtualDevice);

		const calls = channelsPropertiesService.create.mock.calls as [
			string,
			{ category: PropertyCategory; format: string[] },
		][];
		const statusCreate = calls.find(([, dto]) => dto.category === PropertyCategory.STATUS);

		expect(statusCreate?.[1].format).toEqual(Object.values(ConnectionState));
	});

	// A device from before this listener owned the property, or one whose earlier synthesis failed
	// partway: it already exists, still projecting, and has to be repaired rather than duplicated.
	it('repairs an existing connection state property that is still an orphan', async () => {
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
	it('repairs an existing connection state property whose origin has not been read back yet', async () => {
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
