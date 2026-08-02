import { ConnectionState, OnlineDeviceState } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualPropertyIndexService, VirtualPropertyLink } from '../services/virtual-property-index.service';

import { VirtualStatusListener } from './virtual-status.listener';

describe('VirtualStatusListener', () => {
	let listener: VirtualStatusListener;
	let index: { findVirtualDeviceIdsBySourceDevice: jest.Mock; findLinksByVirtualDevice: jest.Mock };
	let connectivity: { setConnectionState: jest.Mock };
	let connectionState: { readLatest: jest.Mock };

	// The device whose connectivity change drives most tests below. Never the virtual type, so it
	// never trips the recursion guard on its own; its identity does not need to match any of the
	// fabricated sources below since `findVirtualDeviceIdsBySourceDevice` is mocked independently.
	const sourceDevice = { id: 'source-device', type: 'generic' } as DeviceEntity;

	// A link to a source that still exists, as VirtualPropertyIndexService records one: plain ids.
	const link = (propertyId: string, sourceDeviceId: string): VirtualPropertyLink => ({
		propertyId,
		sourcePropertyId: `${propertyId}-source`,
		sourceDeviceId,
	});

	// An orphaned projection: its source property was deleted, so both source ids are null. See
	// VirtualChannelPropertyEntity.isOrphaned.
	const orphanedLink = (propertyId: string): VirtualPropertyLink => ({
		propertyId,
		sourcePropertyId: null,
		sourceDeviceId: null,
	});

	// The exact shape DeviceConnectionStateService.readLatest() returns, derived from the state rather
	// than stated alongside it. `online` is never independent of `status` in the real service — it is
	// `OnlineDeviceState.includes(status)` — so a mock that lets a test pass `{online: true, status:
	// UNKNOWN}` is describing a reading the system cannot produce, and any rule that reads `status`
	// would then be tested against fiction. This is what makes the UNKNOWN cases below meaningful.
	const readingOf = (status: ConnectionState): { online: boolean; status: ConnectionState; lastChanged: null } => ({
		online: OnlineDeviceState.includes(status),
		status,
		lastChanged: null,
	});

	// Arranges the mocked index so `findLinksByVirtualDevice(virtualDeviceId)` returns one link per
	// entry in `sources` (each pointing at its own distinct source device), plus one orphaned link
	// when `orphaned` is set, and teaches the connection-state service each source's reported state.
	const sourcesFor = (
		virtualDeviceId: string,
		sources: { status: ConnectionState }[],
		options: { orphaned?: boolean } = {},
	): void => {
		const states = new Map<string, ConnectionState>();

		const links = sources.map((source, i) => {
			const sourceDeviceId = `${virtualDeviceId}-device-${i}`;

			states.set(sourceDeviceId, source.status);

			return link(`${virtualDeviceId}-prop-${i}`, sourceDeviceId);
		});

		if (options.orphaned) {
			links.push(orphanedLink(`${virtualDeviceId}-orphan`));
		}

		index.findLinksByVirtualDevice.mockReturnValue(links);
		connectionState.readLatest.mockImplementation((device: { id: string }) =>
			Promise.resolve(readingOf(states.get(device.id) ?? ConnectionState.UNKNOWN)),
		);
	};

	beforeEach(() => {
		index = {
			findVirtualDeviceIdsBySourceDevice: jest.fn(),
			findLinksByVirtualDevice: jest.fn().mockReturnValue([]),
		};
		connectivity = { setConnectionState: jest.fn().mockResolvedValue(undefined) };
		connectionState = {
			readLatest: jest.fn().mockResolvedValue({ online: false, status: ConnectionState.UNKNOWN, lastChanged: null }),
		};

		listener = new VirtualStatusListener(
			index as unknown as VirtualPropertyIndexService,
			connectivity as unknown as DeviceConnectivityService,
			connectionState as unknown as DeviceConnectionStateService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief cases ---------------------------------------------------------------------

	it('marks the virtual device online when every source is online', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ status: ConnectionState.CONNECTED }, { status: ConnectionState.READY }]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
	});

	it('marks the virtual device offline when any source is offline', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ status: ConnectionState.CONNECTED }, { status: ConnectionState.DISCONNECTED }]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.DISCONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
		);
	});

	it('marks the virtual device offline when any property is orphaned', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ status: ConnectionState.CONNECTED }], { orphaned: true });

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
		);
	});

	// -- UNKNOWN propagates rather than collapsing into DISCONNECTED --------------------------------
	//
	// readLatest() answers `{online: false, status: UNKNOWN}` both for a device that has never reported
	// a connection state and whenever storage is unavailable — so before this rule, a source whose
	// integration simply does not publish connectivity, and *every* source on a fresh install or right
	// after a restart, dragged its virtual device to DISCONNECTED. PropertyCommandService then refuses
	// every command against it, while VirtualDevicePlatform (which applies the same
	// UNKNOWN-is-commandable rule to the source) would have forwarded happily had it ever been asked.

	it('reports unknown, not disconnected, when a source has never reported a connection state', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ status: ConnectionState.UNKNOWN }]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.UNKNOWN }),
		);
	});

	it('reports unknown when some sources are online and the rest have never reported', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ status: ConnectionState.CONNECTED }, { status: ConnectionState.UNKNOWN }]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.UNKNOWN }),
		);
	});

	// The precedence that keeps the loosening honest: a source known to be offline still wins over one
	// that is merely unknown, in either encounter order, because "known broken" outranks "not known".
	it.each([
		['offline first', [ConnectionState.DISCONNECTED, ConnectionState.UNKNOWN]],
		['unknown first', [ConnectionState.UNKNOWN, ConnectionState.DISCONNECTED]],
	])(
		'still reports disconnected when a definitively offline source is mixed with an unknown one (%s)',
		async (_order, states) => {
			index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
			sourcesFor(
				'virtual-device',
				states.map((status) => ({ status })),
			);

			await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.DISCONNECTED });

			expect(connectivity.setConnectionState).toHaveBeenCalledWith(
				'virtual-device',
				expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
			);
		},
	);

	// An orphan is a *known* fact about the device — broken wiring — so it outranks an unknown source
	// exactly as a definitively offline one does, and the device must not be reported commandable on
	// the strength of the source it can still reach.
	it('still reports disconnected when an orphaned property accompanies an unknown source', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ status: ConnectionState.UNKNOWN }], { orphaned: true });

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
		);
	});

	// The other four states outside OnlineDeviceState are genuine reports, not absences of one, so they
	// degrade the virtual device just as DISCONNECTED does — only UNKNOWN is treated as "no answer".
	it.each([ConnectionState.STOPPED, ConnectionState.LOST, ConnectionState.ALERT])(
		'treats a source reporting %s as definitively offline',
		async (status) => {
			index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
			sourcesFor('virtual-device', [{ status }]);

			await listener.handleConnectionChanged({ device: sourceDevice, state: status });

			expect(connectivity.setConnectionState).toHaveBeenCalledWith(
				'virtual-device',
				expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
			);
		},
	);

	it('ignores devices that no virtual device projects', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue([]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).not.toHaveBeenCalled();
	});

	it('ignores its own emissions so status does not recurse', async () => {
		const virtualDevice = { id: 'virtual-device', type: DEVICES_VIRTUAL_TYPE } as DeviceEntity;

		await listener.handleConnectionChanged({ device: virtualDevice, state: ConnectionState.CONNECTED });

		expect(index.findVirtualDeviceIdsBySourceDevice).not.toHaveBeenCalled();
	});

	// -- supplementary cases --------------------------------------------------------------------
	// Not pinned by the brief, but pinned by the task's own aggregation rule and self-review
	// checklist ("is every distinct source device genuinely deduplicated?").

	it('treats a virtual device with only owned properties as always connected', async () => {
		// No sourcesFor() call: findLinksByVirtualDevice keeps its default [] — an owned-only device
		// has nothing indexed (byVirtualDevice only ever holds PROJECTING properties), so there are no
		// sources and, per the rule, that is vacuously CONNECTED rather than a zero-source failure.
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
		expect(connectionState.readLatest).not.toHaveBeenCalled();
	});

	it('reads a source device once even when two properties project through it', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		index.findLinksByVirtualDevice.mockReturnValue([link('prop-a', 'shared-device'), link('prop-b', 'shared-device')]);
		connectionState.readLatest.mockResolvedValue({
			online: true,
			status: ConnectionState.CONNECTED,
			lastChanged: null,
		});

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
		// Deduplicated by id, so one status read — not one per property.
		expect(connectionState.readLatest).toHaveBeenCalledTimes(1);
	});

	it('aggregates independently for every virtual device the changed source device affects', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-online', 'virtual-offline']);

		index.findLinksByVirtualDevice.mockImplementation((virtualDeviceId: string) =>
			virtualDeviceId === 'virtual-online'
				? [link('online-prop', 'online-device')]
				: [link('offline-prop', 'offline-device')],
		);

		connectionState.readLatest.mockImplementation((device: { id: string }) =>
			Promise.resolve(
				readingOf(device.id === 'online-device' ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED),
			),
		);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-online',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-offline',
			expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
		);
	});

	// -- recompute() serialization ----------------------------------------------------------------
	//
	// Three callers reach recompute() and none awaits the others: a source connection change, a
	// rebuild that re-wired a device, and VirtualDeviceInformationListener's synthesis on
	// DEVICE_CREATED. Serializing only the write would still let a recompute aggregate off an index
	// that a concurrent recompute replaces before its own write lands — the exact interleaving that
	// let an assumed CONNECTED overwrite an aggregated DISCONNECTED on a device created with nested
	// linked properties. The queue therefore has to hold across the index read as well.

	it('does not read the index for a second recompute until the first has finished writing', async () => {
		const order: string[] = [];
		let releaseFirstWrite: () => void = () => {};
		const firstWrite = new Promise<void>((resolve) => (releaseFirstWrite = resolve));
		let writes = 0;

		index.findLinksByVirtualDevice.mockImplementation(() => {
			order.push('read');

			return [];
		});

		connectivity.setConnectionState.mockImplementation(() => {
			writes += 1;
			order.push('write');

			return writes === 1 ? firstWrite : Promise.resolve();
		});

		const first = listener.recompute('virtual-device', 'first');
		const second = listener.recompute('virtual-device', 'second');

		// Give the second recompute every chance to run ahead. Without the queue it reads here, which
		// is what makes this the discriminator: the assertion below would then already see two reads.
		for (let turn = 0; turn < 10; turn++) {
			await Promise.resolve();
		}

		expect(order).toEqual(['read', 'write']);

		releaseFirstWrite();

		await Promise.all([first, second]);

		expect(order).toEqual(['read', 'write', 'read', 'write']);
	});

	it('lets the next recompute through when one fails', async () => {
		// The queue entry is settled from a `finally`, so a rejected recompute neither wedges the chain
		// nor pushes its own failure onto whoever is waiting behind it.
		connectivity.setConnectionState.mockRejectedValueOnce(new Error('boom'));

		await expect(listener.recompute('virtual-device', 'first')).rejects.toThrow('boom');
		await expect(listener.recompute('virtual-device', 'second')).resolves.toBeUndefined();

		expect(connectivity.setConnectionState).toHaveBeenCalledTimes(2);
	});

	// -- regression cases, wired against the REAL index ------------------------------------------
	// Both failures below were invisible to a mocked index, because the mock could return whatever
	// the test wanted rather than what VirtualPropertyIndexService can actually produce. These build
	// the real service over a mocked repository, so the listener sees exactly the index shape the
	// running system would hand it.

	describe('against a real VirtualPropertyIndexService', () => {
		const buildRealIndex = async (rows: VirtualChannelPropertyEntity[]): Promise<VirtualPropertyIndexService> => {
			const repository = { find: jest.fn().mockResolvedValue(rows) };
			const realIndex = new VirtualPropertyIndexService(repository as never);

			await realIndex.rebuild();

			return realIndex;
		};

		// Mirrors a row TypeORM returns once rebuild()'s relations are loaded: the virtual property's
		// own channel -> device, plus sourceProperty -> channel -> device. `sourceOnlineAtIndexTime`
		// controls the *hydrated* status on that source DeviceEntity — the snapshot
		// DeviceEntitySubscriber.afterLoad copies in field by field at load time.
		const hydratedRow = (options: {
			id: string;
			sourcePropertyId: string | null;
			sourceOnlineAtIndexTime?: boolean;
		}): VirtualChannelPropertyEntity => {
			const property = new VirtualChannelPropertyEntity();

			const virtualDevice = Object.assign(new DeviceEntity(), { id: 'virtual-device' });
			const virtualChannel = Object.assign(new ChannelEntity(), { id: 'virtual-channel', device: virtualDevice });

			Object.assign(property, {
				id: options.id,
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: options.sourcePropertyId,
				channel: virtualChannel,
				sourceProperty: null,
			});

			if (options.sourcePropertyId !== null) {
				const hydratedSourceDevice = Object.assign(new DeviceEntity(), { id: 'source-device' });

				hydratedSourceDevice.status.online = options.sourceOnlineAtIndexTime ?? false;

				const sourceChannel = Object.assign(new ChannelEntity(), {
					id: 'source-channel',
					device: hydratedSourceDevice,
				});

				property.sourceProperty = Object.assign(new ChannelPropertyEntity(), {
					id: options.sourcePropertyId,
					channel: sourceChannel,
				});
			}

			return property;
		};

		const listenerOver = (
			realIndex: VirtualPropertyIndexService,
			live: { status: ConnectionState },
		): VirtualStatusListener =>
			new VirtualStatusListener(
				realIndex,
				connectivity as unknown as DeviceConnectivityService,
				{
					readLatest: jest.fn().mockResolvedValue(readingOf(live.status)),
				} as unknown as DeviceConnectionStateService,
			);

		// CC-1. On a fresh restart the index hydrates before any plugin has connected, so every source
		// row carries `status.online === false`. Nothing rebuilds the index on a connection change:
		// VirtualIndexMaintenanceListener subscribes to structural events only, and the connection-state
		// property's own PATCH emits CHANNEL_PROPERTY_VALUE_SET rather than CHANNEL_PROPERTY_UPDATED.
		// Aggregating off the hydrated snapshot therefore pinned the virtual device to DISCONNECTED
		// forever — and PropertyCommandService refuses every command to an offline device.
		it('follows the live status of a source that came online after the index was hydrated', async () => {
			const realIndex = await buildRealIndex([
				hydratedRow({ id: 'linked-prop', sourcePropertyId: 'source-prop', sourceOnlineAtIndexTime: false }),
			]);

			const realListener = listenerOver(realIndex, { status: ConnectionState.CONNECTED });

			await realListener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

			expect(connectivity.setConnectionState).toHaveBeenCalledWith(
				'virtual-device',
				expect.objectContaining({ state: ConnectionState.CONNECTED }),
			);
		});

		// The inverse, so the test above cannot pass by simply always answering CONNECTED: a source
		// hydrated as online that has since dropped must drag the virtual device down with it.
		it('follows the live status of a source that went offline after the index was hydrated', async () => {
			const realIndex = await buildRealIndex([
				hydratedRow({ id: 'linked-prop', sourcePropertyId: 'source-prop', sourceOnlineAtIndexTime: true }),
			]);

			const realListener = listenerOver(realIndex, { status: ConnectionState.DISCONNECTED });

			await realListener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.DISCONNECTED });

			expect(connectivity.setConnectionState).toHaveBeenCalledWith(
				'virtual-device',
				expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
			);
		});

		// CC-2. The orphan degradation branch was unreachable: the index stored only properties that
		// were SOURCE *and* had a non-null source, while `isOrphaned` means SOURCE *and* a null source.
		// A real index could never hand the listener an orphan, so the branch was dead code and the
		// unit test above ("marks the virtual device offline when any property is orphaned") asserted a
		// state the system could not reach. Here the orphan comes from the real index.
		it('degrades a virtual device whose projection lost its source, as the real index reports it', async () => {
			const realIndex = await buildRealIndex([
				hydratedRow({ id: 'linked-prop', sourcePropertyId: 'source-prop', sourceOnlineAtIndexTime: true }),
				hydratedRow({ id: 'orphaned-prop', sourcePropertyId: null }),
			]);

			// Every source that still exists is online — the orphan is the only reason to degrade.
			const realListener = listenerOver(realIndex, { status: ConnectionState.CONNECTED });

			await realListener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

			expect(connectivity.setConnectionState).toHaveBeenCalledWith(
				'virtual-device',
				expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
			);
		});
	});
});
