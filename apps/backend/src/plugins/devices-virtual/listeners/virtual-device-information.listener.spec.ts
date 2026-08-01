import { Logger } from '@nestjs/common';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualPropertyIndexService, VirtualPropertyLink } from '../services/virtual-property-index.service';

import { VirtualDeviceInformationListener } from './virtual-device-information.listener';
import { VirtualStatusListener } from './virtual-status.listener';

describe('VirtualDeviceInformationListener', () => {
	let listener: VirtualDeviceInformationListener;
	let channelsService: { findOneBy: jest.Mock; create: jest.Mock };
	let channelsPropertiesService: { findOneBy: jest.Mock; create: jest.Mock; update: jest.Mock };
	let connectivity: { setConnectionState: jest.Mock };
	let index: { findVirtualDeviceIdsBySourceDevice: jest.Mock; findLinksByVirtualDevice: jest.Mock };
	let connectionState: { readLatest: jest.Mock };

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

	// Arranges the mocked index so the device under synthesis is reported with one link to a source
	// device of the given online-ness. No call at all leaves the index empty, which is what a virtual
	// device created on its own genuinely looks like.
	const withIndexedSource = (options: { online: boolean }): void => {
		const links: VirtualPropertyLink[] = [
			{ propertyId: 'linked-prop', sourcePropertyId: 'source-prop', sourceDeviceId: 'source-device' },
		];

		index.findLinksByVirtualDevice.mockReturnValue(links);
		connectionState.readLatest.mockResolvedValue({
			online: options.online,
			status: options.online ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			lastChanged: null,
		});
	};

	beforeEach(() => {
		channelsService = { findOneBy: jest.fn().mockResolvedValue(infoChannel), create: jest.fn() };
		channelsPropertiesService = {
			findOneBy: jest.fn().mockResolvedValue(null),
			create: jest.fn().mockResolvedValue(undefined),
			update: jest.fn().mockResolvedValue(undefined),
		};
		connectivity = { setConnectionState: jest.fn().mockResolvedValue(undefined) };
		index = {
			findVirtualDeviceIdsBySourceDevice: jest.fn().mockReturnValue([]),
			findLinksByVirtualDevice: jest.fn().mockReturnValue([]),
		};
		connectionState = {
			readLatest: jest.fn().mockResolvedValue({ online: false, status: ConnectionState.UNKNOWN, lastChanged: null }),
		};

		// A real VirtualStatusListener over mocked collaborators, rather than a mock of it: what this
		// class now has to get right is the *aggregated* state, and a mocked recompute() could not tell
		// an assumed CONNECTED from an aggregated one.
		listener = new VirtualDeviceInformationListener(
			channelsService as unknown as ChannelsService,
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			new VirtualStatusListener(
				index as unknown as VirtualPropertyIndexService,
				connectivity as unknown as DeviceConnectivityService,
				connectionState as unknown as DeviceConnectionStateService,
			),
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

	it('records a device with no sources yet as connected, and resolves its device_information channel', async () => {
		// The index reports no links (its default here), which is exactly a virtual device created on
		// its own: vacuously CONNECTED, by the same rule VirtualStatusListener applies everywhere else.
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

	// -- the initial state is aggregated, not assumed (P2) --------------------------------------
	//
	// The API allows a virtual device to be created with its channels and linked properties nested in
	// the same request. CHANNEL_PROPERTY_CREATED then fires for each of those *before* DEVICE_CREATED,
	// so VirtualIndexMaintenanceListener's rebuild can correctly record DISCONNECTED for an offline
	// source before this handler runs at all — and the unconditional CONNECTED this class used to write
	// silently overwrote it, with nothing left to correct it (the next rebuild pass sees no re-wiring,
	// so it schedules no further recompute). Fails against that version, which answered CONNECTED
	// whatever the sources said.

	it('records the state aggregated from its sources, not an assumed CONNECTED', async () => {
		withIndexedSource({ online: false });

		await listener.handleDeviceCreated(virtualDevice);

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
		);
	});

	// The discriminator for the case above: it must not have become "always DISCONNECTED once anything
	// is indexed". A device whose sources are all online is still CONNECTED.
	it('records CONNECTED when every indexed source is online', async () => {
		withIndexedSource({ online: true });

		await listener.handleDeviceCreated(virtualDevice);

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
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

	// -- losing the insert race against the generic connectivity service -----------------------
	//
	// Regression tests for the P1. On a virtual device created with linked channels and properties in
	// one request, CHANNEL_PROPERTY_CREATED fires for each of those *before* DEVICE_CREATED — so
	// VirtualIndexMaintenanceListener's rebuild can drive DeviceConnectivityService.setConnectionState()
	// into the same find-or-create concurrently with this handler. The loser of that insert hits
	// @Unique(['identifier', 'channel']). An earlier version let the violation escape to the handler's
	// outer catch, which logged it and returned: the winner's row — created generically, hence SOURCE
	// with a null source — stayed an orphan, and the device stayed permanently DISCONNECTED and
	// uncommandable, which is the exact outcome creating the property here was supposed to prevent.

	// A losing insert: the first STATUS lookup finds nothing, the create is rejected by the unique
	// constraint, and by then the winner's row is committed and visible to the next read.
	const withLostInsertRace = (winner: VirtualChannelPropertyEntity): void => {
		let statusLookups = 0;

		channelsPropertiesService.findOneBy.mockImplementation((_column: string, category: PropertyCategory) => {
			if (category !== PropertyCategory.STATUS) {
				return Promise.resolve(null);
			}

			statusLookups += 1;

			return Promise.resolve(statusLookups === 1 ? null : winner);
		});

		channelsPropertiesService.create.mockImplementation((_channelId: string, dto: { category: PropertyCategory }) =>
			dto.category === PropertyCategory.STATUS
				? Promise.reject(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: identifier, channel'))
				: Promise.resolve(undefined),
		);
	};

	it('claims the row that won when its own insert loses the race', async () => {
		withLostInsertRace(connectionStateProperty(VirtualValueOrigin.SOURCE));

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			'connection-state-prop',
			expect.objectContaining({ value_origin: VirtualValueOrigin.LOCAL }),
		);
	});

	// The winner's row is what the generic path just created, so it has never round-tripped through a
	// `value_origin` — undefined here, which means the SOURCE column default, which means an orphan.
	it('claims a won row whose origin has not been read back yet', async () => {
		withLostInsertRace(connectionStateProperty(undefined));

		await listener.handleDeviceCreated(virtualDevice);

		expect(channelsPropertiesService.update).toHaveBeenCalledWith(
			'connection-state-prop',
			expect.objectContaining({ value_origin: VirtualValueOrigin.LOCAL }),
		);
	});

	// Losing the race is not a failure of the synthesis — the rest of it still has to happen, or the
	// device ends up with no manufacturer/model/serial and no recorded connectivity.
	it('carries on with the rest of the synthesis after losing the race', async () => {
		withLostInsertRace(connectionStateProperty(VirtualValueOrigin.SOURCE));

		await listener.handleDeviceCreated(virtualDevice);

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
		expect(channelsPropertiesService.create).toHaveBeenCalledTimes(4);
	});

	// The retry is bounded, so a create that fails for a reason other than losing a race — a genuinely
	// broken database, say — still terminates rather than spinning forever against a lookup that keeps
	// returning nothing.
	it('gives up after a bounded number of attempts when the create never succeeds', async () => {
		const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

		channelsPropertiesService.create.mockRejectedValue(new Error('database is closed'));

		await expect(listener.handleDeviceCreated(virtualDevice)).resolves.toBeUndefined();

		expect(channelsPropertiesService.create).toHaveBeenCalledTimes(3);

		loggerWarnSpy.mockRestore();
	});

	// -- claimDeviceInformationProperty: the afterCreate mapping hook ---------------------------
	//
	// Registered by DevicesVirtualPlugin on the virtual channel-property mapping, so it runs inside
	// ChannelsPropertiesService.create() — before that call re-reads the row, before it emits
	// CHANNEL_PROPERTY_CREATED, and before its caller holds a copy. That is what makes the guarantee
	// unconditional rather than a narrower race: whichever path creates a property in a virtual
	// device's device_information channel, nothing ever observes it as an orphan.
	//
	// It is also the fix for follow-up 2.7: the connection-state property is deletable through
	// DELETE /channels/:id/properties/:id, synthesis only runs on DEVICE_CREATED, and the next
	// setConnectionState used to recreate it generically as an orphan with nothing left to re-own it.

	describe('claimDeviceInformationProperty', () => {
		const propertyIn = (
			channelCategory: ChannelCategory,
			valueOrigin: VirtualValueOrigin | undefined,
			sourcePropertyId: string | null = null,
		): VirtualChannelPropertyEntity => {
			const property = new VirtualChannelPropertyEntity();

			Object.assign(property, {
				id: 'recreated-prop',
				category: PropertyCategory.STATUS,
				valueOrigin,
				sourcePropertyId,
				channel: Object.assign(new ChannelEntity(), { id: 'info-channel', category: channelCategory }),
			});

			return property;
		};

		it('claims an orphan recreated in a device_information channel', async () => {
			await listener.claimDeviceInformationProperty(propertyIn(ChannelCategory.DEVICE_INFORMATION, undefined));

			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				'recreated-prop',
				expect.objectContaining({ value_origin: VirtualValueOrigin.LOCAL }),
			);
		});

		// Owned means owned outright. The payload has to say so rather than rely on the row's source
		// already being null: `ensureConnectionStateProperty` claims on `isProjecting` alone, and a
		// `value_origin` sent without a matching `source_property` would merge into `local` + a source —
		// the one pair VirtualDevicesService.assertValueOriginPairSupported refuses to persist.
		it('clears the source when it claims, rather than assuming there is none', async () => {
			await listener.claimDeviceInformationProperty(propertyIn(ChannelCategory.DEVICE_INFORMATION, undefined));

			expect(channelsPropertiesService.update).toHaveBeenCalledWith(
				'recreated-prop',
				expect.objectContaining({ value_origin: VirtualValueOrigin.LOCAL, source_property: null }),
			);
		});

		it('leaves an already owned property alone', async () => {
			await listener.claimDeviceInformationProperty(
				propertyIn(ChannelCategory.DEVICE_INFORMATION, VirtualValueOrigin.LOCAL),
			);

			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		// Deliberately narrow: a property that names a real source was asked for, and silently rewriting
		// it would be worse than the incoherent state the DTO constraints reject up front.
		it('leaves a property that still has a source alone', async () => {
			await listener.claimDeviceInformationProperty(
				propertyIn(ChannelCategory.DEVICE_INFORMATION, VirtualValueOrigin.SOURCE, 'source-prop'),
			);

			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		// Every other channel on a virtual device is pure wiring — an orphan there is a legitimate
		// lifecycle state (its source was deleted) and must degrade the device, not be claimed.
		it('leaves an orphan in any other channel alone', async () => {
			await listener.claimDeviceInformationProperty(propertyIn(ChannelCategory.LIGHT, VirtualValueOrigin.SOURCE));

			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('leaves a non-virtual property alone', async () => {
			const property = Object.assign(new ChannelPropertyEntity(), {
				id: 'plain-prop',
				channel: Object.assign(new ChannelEntity(), {
					id: 'info-channel',
					category: ChannelCategory.DEVICE_INFORMATION,
				}),
			});

			await listener.claimDeviceInformationProperty(property);

			expect(channelsPropertiesService.update).not.toHaveBeenCalled();
		});

		it('returns the property it was given, as the mapping hook contract requires', async () => {
			const property = propertyIn(ChannelCategory.DEVICE_INFORMATION, undefined);

			await expect(listener.claimDeviceInformationProperty(property)).resolves.toBe(property);
		});
	});
});
