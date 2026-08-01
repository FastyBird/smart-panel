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

	// -- Task 12 addition: findByVirtualDevice -------------------------------------------------
	// The connection-status listener needs to enumerate one virtual device's properties (to check
	// for orphans and collect distinct source devices) without querying the database. byVirtualDevice
	// already holds exactly that, so this exposes it read-only instead of adding a fourth map.

	it('returns every property indexed for a given virtual device', async () => {
		repository.find.mockResolvedValue([linkedProperty]);

		await service.onApplicationBootstrap();

		expect(service.findByVirtualDevice('virtual-device')).toEqual([linkedProperty]);
	});

	it('returns an empty array for a virtual device with nothing indexed', () => {
		expect(service.findByVirtualDevice('unknown-virtual-device')).toEqual([]);
	});
});
