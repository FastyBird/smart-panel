import { ConnectionState } from '../../../modules/devices/devices.constants';
import { DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DEVICES_VIRTUAL_TYPE } from '../devices-virtual.constants';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';
import { VirtualPropertyIndexService } from '../services/virtual-property-index.service';

import { VirtualStatusListener } from './virtual-status.listener';

describe('VirtualStatusListener', () => {
	let listener: VirtualStatusListener;
	let index: { findVirtualDeviceIdsBySourceDevice: jest.Mock; findByVirtualDevice: jest.Mock };
	let connectivity: { setConnectionState: jest.Mock };

	// The device whose connectivity change drives most tests below. Never the virtual type, so it
	// never trips the recursion guard on its own; its identity does not need to match any of the
	// fabricated sources below since `findVirtualDeviceIdsBySourceDevice` is mocked independently.
	const sourceDevice = { id: 'source-device', type: 'generic' } as DeviceEntity;

	// A source device stub carrying just enough of DeviceEntity for aggregateState to read: an id
	// (so distinct devices can be told apart) and a status.online flag.
	const makeSourceDevice = (id: string, online: boolean): DeviceEntity => ({ id, status: { online } }) as DeviceEntity;

	// A linked virtual property projecting a freshly-made, distinct source device, mirroring the
	// relation shape VirtualPropertyIndexService actually indexes (channel -> device,
	// sourceProperty -> channel -> device).
	const makeLinkedProperty = (id: string, deviceId: string, online: boolean): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(property, {
			id,
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: `${id}-source`,
			sourceProperty: { channel: { device: makeSourceDevice(deviceId, online) } },
		});

		return property;
	};

	// An orphaned property: SOURCE origin, but its source was deleted (sourcePropertyId null). See
	// VirtualChannelPropertyEntity.isOrphaned.
	const makeOrphanedProperty = (id: string): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(property, {
			id,
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: null,
			sourceProperty: null,
		});

		return property;
	};

	// Arranges the mocked index so `findByVirtualDevice(virtualDeviceId)` returns one linked
	// property per entry in `sources` (each projecting its own distinct device), plus one orphaned
	// property when `orphaned` is set.
	const sourcesFor = (
		virtualDeviceId: string,
		sources: { online: boolean }[],
		options: { orphaned?: boolean } = {},
	): void => {
		const properties = sources.map((source, i) =>
			makeLinkedProperty(`${virtualDeviceId}-prop-${i}`, `${virtualDeviceId}-device-${i}`, source.online),
		);

		if (options.orphaned) {
			properties.push(makeOrphanedProperty(`${virtualDeviceId}-orphan`));
		}

		index.findByVirtualDevice.mockReturnValue(properties);
	};

	beforeEach(() => {
		index = {
			findVirtualDeviceIdsBySourceDevice: jest.fn(),
			findByVirtualDevice: jest.fn().mockReturnValue([]),
		};
		connectivity = { setConnectionState: jest.fn().mockResolvedValue(undefined) };

		listener = new VirtualStatusListener(
			index as unknown as VirtualPropertyIndexService,
			connectivity as unknown as DeviceConnectivityService,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief cases ---------------------------------------------------------------------

	it('marks the virtual device online when every source is online', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ online: true }, { online: true }]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
	});

	it('marks the virtual device offline when any source is offline', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ online: true }, { online: false }]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.DISCONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
		);
	});

	it('marks the virtual device offline when any property is orphaned', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);
		sourcesFor('virtual-device', [{ online: true }], { orphaned: true });

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.DISCONNECTED }),
		);
	});

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
		// No sourcesFor() call: findByVirtualDevice keeps its default [] — an owned-only device has
		// nothing indexed (byVirtualDevice only ever holds LINKED properties), so there are no
		// sources and, per the rule, that is vacuously CONNECTED rather than a zero-source failure.
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
	});

	it('counts a source device once even when two properties project through it', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-device']);

		// Two DISTINCT property/device object instances that happen to share one device id — exactly
		// what VirtualPropertyIndexService produces in practice, since TypeORM hydrates a fresh
		// DeviceEntity per relation path rather than reusing one instance for the same row. If the
		// listener deduplicated by object identity instead of by id, this would not collapse.
		const propertyA = makeLinkedProperty('prop-a', 'shared-device', true);
		const propertyB = makeLinkedProperty('prop-b', 'shared-device', true);

		index.findByVirtualDevice.mockReturnValue([propertyA, propertyB]);

		await listener.handleConnectionChanged({ device: sourceDevice, state: ConnectionState.CONNECTED });

		expect(connectivity.setConnectionState).toHaveBeenCalledWith(
			'virtual-device',
			expect.objectContaining({ state: ConnectionState.CONNECTED }),
		);
	});

	it('aggregates independently for every virtual device the changed source device affects', async () => {
		index.findVirtualDeviceIdsBySourceDevice.mockReturnValue(['virtual-online', 'virtual-offline']);

		index.findByVirtualDevice.mockImplementation((virtualDeviceId: string) => {
			if (virtualDeviceId === 'virtual-online') {
				return [makeLinkedProperty('online-prop', 'online-device', true)];
			}

			return [makeLinkedProperty('offline-prop', 'offline-device', false)];
		});

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
});
