import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { VirtualChannelPropertyEntity, VirtualValueOrigin } from '../entities/devices-virtual.entity';

import { VirtualPropertyIndexService } from './virtual-property-index.service';

describe('VirtualPropertyIndexService', () => {
	let service: VirtualPropertyIndexService;
	let repository: { find: jest.Mock };

	// -- fixture builders ----------------------------------------------------------------------
	// Every "linked" fixture below walks property -> channel -> device (and, for the source side,
	// property -> sourceProperty -> channel -> device) exactly like a row TypeORM returns once
	// those relations are loaded — see the "loads exactly the relations..." test, which pins the
	// relations array that makes that true.

	const makeDevice = (id: string): DeviceEntity => {
		const device = new DeviceEntity();

		Object.assign(device, { id });

		return device;
	};

	const makeChannel = (id: string, device: DeviceEntity | string): ChannelEntity => {
		const channel = new ChannelEntity();

		Object.assign(channel, { id, device });

		return channel;
	};

	const makeSourceProperty = (id: string, channel: ChannelEntity | string): ChannelPropertyEntity => {
		const property = new ChannelPropertyEntity();

		Object.assign(property, { id, channel });

		return property;
	};

	const virtualProperty = (overrides: Partial<VirtualChannelPropertyEntity> = {}): VirtualChannelPropertyEntity => {
		const property = new VirtualChannelPropertyEntity();

		Object.assign(
			property,
			{
				id: 'linked-prop',
				valueOrigin: VirtualValueOrigin.SOURCE,
				sourcePropertyId: null,
				sourceProperty: null,
				channel: makeChannel('virtual-channel', makeDevice('virtual-device')),
			},
			overrides,
		);

		return property;
	};

	// The source chain every fixture below points at: one physical device, one channel, one
	// property. The pinned tests key off this exact chain ('source-prop' / 'source-device').
	const sourceDevice = makeDevice('source-device');
	const sourceChannel = makeChannel('source-channel', sourceDevice);
	const sourceProperty = makeSourceProperty('source-prop', sourceChannel);

	// The single linked property most of the brief's pinned tests hydrate with. Belongs to
	// device 'virtual-device'; projects 'source-prop' on 'source-device'.
	const linkedProperty = virtualProperty({
		id: 'linked-prop',
		sourcePropertyId: 'source-prop',
		sourceProperty,
	});

	// Two linked properties on two DIFFERENT virtual devices, both projecting the SAME source
	// property (and therefore the same source device). Used for the "several properties share
	// one source" case and, later, to prove removeVirtualDevice does not evict a sibling.
	const linkedA = virtualProperty({
		id: 'linked-a',
		sourcePropertyId: 'source-prop',
		sourceProperty,
		channel: makeChannel('virtual-channel-a', makeDevice('virtual-device-a')),
	});

	const linkedB = virtualProperty({
		id: 'linked-b',
		sourcePropertyId: 'source-prop',
		sourceProperty,
		channel: makeChannel('virtual-channel-b', makeDevice('virtual-device-b')),
	});

	// LOCAL (owned) but with a non-null sourcePropertyId on purpose: proves the valueOrigin
	// check — not a coincidentally-null sourcePropertyId — is what keeps this out of the index.
	const ownedProperty = virtualProperty({
		id: 'owned-prop',
		valueOrigin: VirtualValueOrigin.LOCAL,
		sourcePropertyId: 'source-prop',
		sourceProperty,
	});

	// SOURCE with sourcePropertyId null: the source was deleted. See VirtualChannelPropertyEntity.isOrphaned.
	const orphanedProperty = virtualProperty({
		id: 'orphaned-prop',
		valueOrigin: VirtualValueOrigin.SOURCE,
		sourcePropertyId: null,
		sourceProperty: null,
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				VirtualPropertyIndexService,
				{
					provide: getRepositoryToken(VirtualChannelPropertyEntity),
					useValue: { find: jest.fn() },
				},
			],
		}).compile();

		service = module.get(VirtualPropertyIndexService);
		repository = module.get(getRepositoryToken(VirtualChannelPropertyEntity));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// -- pinned brief cases ---------------------------------------------------------------------

	it('is empty before hydration', () => {
		expect(service.findBySourceProperty('source-prop')).toEqual([]);
	});

	it('indexes virtual properties by source property on bootstrap', async () => {
		repository.find.mockResolvedValue([linkedProperty]);

		await service.onApplicationBootstrap();

		expect(service.findBySourceProperty('source-prop')).toEqual([linkedProperty]);
	});

	// Regression test for bootstrap hydration aborting application startup. The rebuild query is the
	// first thing to touch the schema, so it is also the first thing to fail when there is no schema:
	// a fresh install before migrations, and `generate:openapi`, which boots the whole Nest app purely
	// to read Swagger metadata. An unguarded `await this.rebuild()` turned that into
	// `SQLITE_ERROR: no such table: devices_module_channels_properties` escaping onApplicationBootstrap
	// and killing the process. The index is an optimization — VirtualIndexMaintenanceListener rebuilds
	// it on the next structural event — so a failed first pass must degrade to an empty index, never to
	// a dead application.
	it('survives a bootstrap hydration failure, leaving the index empty rather than aborting startup', async () => {
		const error = new Error('SQLITE_ERROR: no such table: devices_module_channels_properties');

		repository.find.mockRejectedValue(error);

		const logged = jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

		await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();

		expect(service.findBySourceProperty('source-prop')).toEqual([]);
		expect(service.findLinksByVirtualDevice('virtual-device')).toEqual([]);
		expect(logged).toHaveBeenCalledWith(expect.stringContaining('no such table'));
	});

	// The failure above must not be terminal for the index either: the very next rebuild — which is
	// what the maintenance listener issues on the next structural event — has to hydrate normally.
	it('hydrates normally on a later rebuild after bootstrap hydration failed', async () => {
		repository.find.mockRejectedValueOnce(new Error('SQLITE_ERROR: no such table: x'));

		jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

		await service.onApplicationBootstrap();

		repository.find.mockResolvedValue([linkedProperty]);

		await service.rebuild();

		expect(service.findBySourceProperty('source-prop')).toEqual([linkedProperty]);
	});

	it('indexes several virtual properties sharing one source', async () => {
		repository.find.mockResolvedValue([linkedA, linkedB]);

		await service.onApplicationBootstrap();

		expect(service.findBySourceProperty('source-prop')).toHaveLength(2);
	});

	it('skips owned and orphaned properties', async () => {
		repository.find.mockResolvedValue([ownedProperty, orphanedProperty]);

		await service.onApplicationBootstrap();

		expect(service.findBySourceProperty('source-prop')).toEqual([]);
	});

	// Regression test for the orphan branch being structurally unreachable. The index used to store
	// only LINKED properties (SOURCE *and* a non-null source), while `isOrphaned` means SOURCE *and* a
	// null source — mutually exclusive by construction, so the connection-status listener's
	// "any property orphaned -> DISCONNECTED" branch could never fire against a real index, and its
	// unit test proved nothing because it fabricated a state the index could not produce. An orphan
	// contributes nothing to the two source-keyed maps (there is no source to key on), but it MUST
	// appear against its own virtual device, which is the only place that degradation can be seen.
	it('records an orphaned property against its virtual device, with no source ids', async () => {
		repository.find.mockResolvedValue([orphanedProperty]);

		await service.onApplicationBootstrap();

		expect(service.findLinksByVirtualDevice('virtual-device')).toEqual([
			{ propertyId: 'orphaned-prop', sourcePropertyId: null, sourceDeviceId: null },
		]);
	});

	it('keeps an owned property out of every map, including its own virtual device', async () => {
		repository.find.mockResolvedValue([ownedProperty]);

		await service.onApplicationBootstrap();

		expect(service.findLinksByVirtualDevice('virtual-device')).toEqual([]);
		expect(service.findBySourceProperty('source-prop')).toEqual([]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);
	});

	it('maps a source device to the virtual devices projecting it', async () => {
		repository.find.mockResolvedValue([linkedProperty]);

		await service.onApplicationBootstrap();

		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual(['virtual-device']);
	});

	it('drops every entry for a removed virtual device', async () => {
		repository.find.mockResolvedValue([linkedProperty]);

		await service.onApplicationBootstrap();
		service.removeVirtualDevice('virtual-device');

		expect(service.findBySourceProperty('source-prop')).toEqual([]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);
	});

	// -- supplementary cases --------------------------------------------------------------------
	// These pin behaviour the design constraints call for that the six pinned cases above don't
	// individually exercise: the exact relations loaded, add() as a standalone entry point, the
	// two-virtual-devices-share-one-source removal case the task brief calls out by name, rebuild()
	// clearing stale state, and the string-shaped relation shape the entity notes explicitly allow.

	it('loads exactly the relations needed to resolve both the virtual and source device in one query', async () => {
		repository.find.mockResolvedValue([]);

		await service.onApplicationBootstrap();

		expect(repository.find).toHaveBeenCalledTimes(1);
		expect(repository.find).toHaveBeenCalledWith({
			relations: [
				'channel',
				'channel.device',
				'sourceProperty',
				'sourceProperty.channel',
				'sourceProperty.channel.device',
			],
		});
	});

	it('removing one virtual device does not evict a sibling sharing the same source property and source device', async () => {
		repository.find.mockResolvedValue([linkedA, linkedB]);

		await service.onApplicationBootstrap();
		service.removeVirtualDevice('virtual-device-a');

		expect(service.findBySourceProperty('source-prop')).toEqual([linkedB]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual(['virtual-device-b']);
	});

	it('rebuild() clears previously indexed state instead of merging with it', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.onApplicationBootstrap();

		expect(service.findBySourceProperty('source-prop')).toEqual([linkedProperty]);

		repository.find.mockResolvedValue([]);
		await service.rebuild();

		expect(service.findBySourceProperty('source-prop')).toEqual([]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);
	});

	it('add() indexes a property immediately, without a full reload', () => {
		service.add(linkedProperty, 'source-device');

		expect(service.findBySourceProperty('source-prop')).toEqual([linkedProperty]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual(['virtual-device']);
		expect(repository.find).not.toHaveBeenCalled();
	});

	it('add() replaces rather than duplicates an entry when called twice for the same property', () => {
		service.add(linkedProperty, 'source-device');
		service.add(linkedProperty, 'source-device');

		expect(service.findBySourceProperty('source-prop')).toEqual([linkedProperty]);
	});

	it('resolves the owning device from a plain id string, not only a loaded relation object', () => {
		const property = virtualProperty({
			id: 'string-linked-prop',
			sourcePropertyId: 'source-prop',
			sourceProperty,
			channel: makeChannel('string-virtual-channel', 'string-virtual-device'),
		});

		service.add(property, 'source-device');

		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual(['string-virtual-device']);
	});

	it('still indexes by source property when the channel relation is a bare id with no device to resolve', () => {
		const property = virtualProperty({
			id: 'unresolvable-prop',
			sourcePropertyId: 'source-prop',
			sourceProperty,
			channel: 'bare-channel-id',
		});

		service.add(property, 'source-device');

		expect(service.findBySourceProperty('source-prop')).toEqual([property]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);
	});

	// Regression test: rebuild() used to resolve sourceDeviceId and `continue` past the whole row
	// — including the bySourceProperty index — when that resolution failed, even though
	// bySourceProperty only reads property.sourcePropertyId and never depended on it. This fixture's
	// source chain is deliberately unresolvable (sourceProperty.channel is a bare id, no nested
	// device) while its OWN channel/device resolves fine, isolating the source side as the cause of
	// failure so this cannot pass by coincidence via the virtual-side guard tested above.
	it('rebuild() keeps a property in bySourceProperty even when its source device relation cannot be resolved', async () => {
		const property = virtualProperty({
			id: 'linked-unresolvable-source',
			sourcePropertyId: 'source-prop-x',
			sourceProperty: makeSourceProperty('source-prop-x', 'bare-source-channel-id'),
			channel: makeChannel('virtual-channel-x', makeDevice('virtual-device-x')),
		});

		repository.find.mockResolvedValue([property]);

		await service.onApplicationBootstrap();

		expect(service.findBySourceProperty('source-prop-x')).toEqual([property]);

		// Nothing could be indexed under any source device for this property.
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);

		// byVirtualDevice was still populated — the virtual side resolved independently of the
		// broken source side — proven by removeVirtualDevice finding and clearing this property.
		service.removeVirtualDevice('virtual-device-x');

		expect(service.findBySourceProperty('source-prop-x')).toEqual([]);
	});

	// -- findLinksByVirtualDevice ----------------------------------------------------------------
	// The connection-status listener needs to enumerate one virtual device's projections (to check
	// for orphans and collect distinct source device ids) without querying the database.
	// byVirtualDevice already holds exactly that, so this exposes it read-only instead of adding a
	// fourth map. It yields plain ids, never hydrated entities — see the service docstring.

	it('returns an id-only link for every projection indexed for a given virtual device', async () => {
		repository.find.mockResolvedValue([linkedProperty]);

		await service.onApplicationBootstrap();

		expect(service.findLinksByVirtualDevice('virtual-device')).toEqual([
			{ propertyId: 'linked-prop', sourcePropertyId: 'source-prop', sourceDeviceId: 'source-device' },
		]);
	});

	it('returns an empty array for a virtual device with nothing indexed', () => {
		expect(service.findLinksByVirtualDevice('unknown-virtual-device')).toEqual([]);
	});

	it('records a link with no source device when the source relation cannot be resolved', async () => {
		const property = virtualProperty({
			id: 'linked-unresolvable-source',
			sourcePropertyId: 'source-prop-x',
			sourceProperty: makeSourceProperty('source-prop-x', 'bare-source-channel-id'),
			channel: makeChannel('virtual-channel-x', makeDevice('virtual-device-x')),
		});

		repository.find.mockResolvedValue([property]);

		await service.onApplicationBootstrap();

		// Still linked (its source property id survives — it is not an orphan), just with nothing
		// resolvable on the source-device side.
		expect(service.findLinksByVirtualDevice('virtual-device-x')).toEqual([
			{ propertyId: 'linked-unresolvable-source', sourcePropertyId: 'source-prop-x', sourceDeviceId: null },
		]);
	});

	// Regression test: rebuild() used to clear all three maps and only THEN await its five-hop,
	// relation-loaded SELECT. Every reader during that window — the projection listener on each
	// property value change, the connection-status listener on each source device change — saw an
	// empty index and silently did nothing. Building into locals and swapping at the end closes it.
	it('rebuild() keeps serving the previous index until its query has returned', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.onApplicationBootstrap();

		let releaseQuery: (rows: VirtualChannelPropertyEntity[]) => void;

		repository.find.mockReturnValue(
			new Promise<VirtualChannelPropertyEntity[]>((resolve) => {
				releaseQuery = resolve;
			}),
		);

		const rebuilding = service.rebuild();

		// Let the rebuild run up to its await — the point at which the old code had already emptied
		// every map.
		await Promise.resolve();

		expect(service.findBySourceProperty('source-prop')).toEqual([linkedProperty]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual(['virtual-device']);
		expect(service.findLinksByVirtualDevice('virtual-device')).toHaveLength(1);

		releaseQuery([]);
		await rebuilding;

		// ...and the swap still happens once the query returns.
		expect(service.findBySourceProperty('source-prop')).toEqual([]);
		expect(service.findVirtualDeviceIdsBySourceDevice('source-device')).toEqual([]);
		expect(service.findLinksByVirtualDevice('virtual-device')).toEqual([]);
	});

	// -- rebuild() reports which virtual devices came out re-wired --------------------------------
	//
	// A virtual device's aggregated connection state is invalidated by a change to *which* sources it
	// draws from, not only by those sources going up and down. Nothing carried that signal, so a
	// device whose last linked source property was deleted — which drops it out of `bySourceDevice`
	// entirely, beyond the reach of any DEVICE_CONNECTION_CHANGED event — stayed reported as connected
	// forever. This is the one moment the outgoing and incoming maps both exist, so it is the only
	// place the comparison can be made.

	it('reports a virtual device that gained its first link', async () => {
		repository.find.mockResolvedValue([linkedProperty]);

		await expect(service.rebuild()).resolves.toEqual(
			expect.objectContaining({ rewiredVirtualDeviceIds: ['virtual-device'] }),
		);
	});

	it('reports a virtual device whose link lost its source (the deletion that orphans it)', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.rebuild();

		// Same property id, but its source property is gone — exactly what ON DELETE SET NULL leaves
		// behind, and the case no connection event can ever reach afterwards.
		repository.find.mockResolvedValue([
			virtualProperty({ id: 'linked-prop', sourcePropertyId: null, sourceProperty: null }),
		]);

		await expect(service.rebuild()).resolves.toEqual(
			expect.objectContaining({ rewiredVirtualDeviceIds: ['virtual-device'] }),
		);
	});

	it('reports a virtual device whose links disappeared entirely', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.rebuild();

		repository.find.mockResolvedValue([]);

		await expect(service.rebuild()).resolves.toEqual(
			expect.objectContaining({ rewiredVirtualDeviceIds: ['virtual-device'] }),
		);
	});

	it('reports nothing when a rebuild leaves every virtual device wired identically', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.rebuild();

		await expect(service.rebuild()).resolves.toEqual({
			rewiredVirtualDeviceIds: [],
			abandonedSourceDeviceIds: [],
		});
	});

	// Row order out of find() is not guaranteed stable, and a reordering is not a re-wiring — a
	// per-index comparison would report every virtual device as changed on an arbitrary subset of
	// rebuilds, and recompute the whole system's connection state for nothing.
	it('does not report a virtual device whose links merely came back in a different order', async () => {
		const first = virtualProperty({ id: 'link-1', sourcePropertyId: 'source-prop', sourceProperty });
		const second = virtualProperty({ id: 'link-2', sourcePropertyId: 'source-prop', sourceProperty });

		repository.find.mockResolvedValue([first, second]);
		await service.rebuild();

		repository.find.mockResolvedValue([second, first]);

		await expect(service.rebuild()).resolves.toEqual(expect.objectContaining({ rewiredVirtualDeviceIds: [] }));
	});

	it('reports only the virtual devices that actually changed, not every indexed one', async () => {
		repository.find.mockResolvedValue([linkedA, linkedB]);
		await service.rebuild();

		// linkedA loses its source; linkedB is untouched.
		repository.find.mockResolvedValue([
			virtualProperty({
				id: 'linked-a',
				sourcePropertyId: null,
				sourceProperty: null,
				channel: makeChannel('virtual-channel-a', makeDevice('virtual-device-a')),
			}),
			linkedB,
		]);

		await expect(service.rebuild()).resolves.toEqual(
			expect.objectContaining({ rewiredVirtualDeviceIds: ['virtual-device-a'] }),
		);
	});

	// An owned property is in none of the maps, so adding or removing one is not a re-wiring and must
	// not drag the whole device through a pointless status recompute.
	it('does not report a virtual device when only an owned property changed', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.rebuild();

		repository.find.mockResolvedValue([linkedProperty, ownedProperty]);

		await expect(service.rebuild()).resolves.toEqual(expect.objectContaining({ rewiredVirtualDeviceIds: [] }));
	});

	// -- rebuild() reports which source devices nothing references anymore -----------------------
	//
	// The signal the "unhide the source its virtual device replaced" rule runs on. It cannot be taken
	// from DEVICE_DELETED instead: DevicesService.remove() deletes a device's channels and properties
	// before it emits that event, and a rebuild triggered by one of those deletions routinely lands in
	// between — so by the time the device event arrives the index has already forgotten every link the
	// device had. A transition between two index versions has no such dependency on event ordering.

	it('reports a source device that lost its last referencing virtual device', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.rebuild();

		repository.find.mockResolvedValue([]);

		await expect(service.rebuild()).resolves.toEqual(
			expect.objectContaining({ abandonedSourceDeviceIds: ['source-device'] }),
		);
	});

	// Fires on the last *reference* going, not only on a whole virtual device being deleted: unlinking
	// the property leaves the source just as unreferenced.
	it('reports a source device whose last link was orphaned rather than deleted', async () => {
		repository.find.mockResolvedValue([linkedProperty]);
		await service.rebuild();

		repository.find.mockResolvedValue([
			virtualProperty({ id: 'linked-prop', sourcePropertyId: null, sourceProperty: null }),
		]);

		await expect(service.rebuild()).resolves.toEqual(
			expect.objectContaining({ abandonedSourceDeviceIds: ['source-device'] }),
		);
	});

	it('does not report a source device another virtual device still references', async () => {
		repository.find.mockResolvedValue([linkedA, linkedB]);
		await service.rebuild();

		// linkedA is gone; linkedB still projects the same source property on the same source device.
		repository.find.mockResolvedValue([linkedB]);

		await expect(service.rebuild()).resolves.toEqual(expect.objectContaining({ abandonedSourceDeviceIds: [] }));
	});

	// The index starts empty, so the first rebuild only ever adds source devices. Reporting an addition
	// as an abandonment would unhide every hidden source on the first structural event after boot.
	it('reports nothing abandoned on the first rebuild after boot', async () => {
		repository.find.mockResolvedValue([linkedProperty]);

		await expect(service.rebuild()).resolves.toEqual(expect.objectContaining({ abandonedSourceDeviceIds: [] }));
	});
});
