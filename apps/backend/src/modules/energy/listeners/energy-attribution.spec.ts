import { DataSource, Repository } from 'typeorm';

import {
	ThirdPartyChannelEntity,
	ThirdPartyChannelPropertyEntity,
	ThirdPartyDeviceEntity,
} from '../../../plugins/devices-third-party/entities/devices-third-party.entity';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualValueOrigin,
} from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import { VirtualEnergyClaimService } from '../../../plugins/devices-virtual/services/virtual-energy-claim.service';
import { VirtualPropertyIndexService } from '../../../plugins/devices-virtual/services/virtual-property-index.service';
import { VirtualValueSourceService } from '../../../plugins/devices-virtual/services/virtual-value-source.service';
import { RoomSpaceEntity } from '../../../plugins/spaces-home-control/entities/room-space.entity';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity } from '../../devices/entities/devices.entity';
import { PropertyValueSourceRegistryService } from '../../devices/services/property-value-source.registry.service';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';
import { DeltaComputationService } from '../services/delta-computation.service';
import { EnergyClaimRegistryService } from '../services/energy-claim.registry.service';
import { EnergyDataService } from '../services/energy-data.service';
import { EnergyMetricsService } from '../services/energy-metrics.service';

import { EnergyIngestionListener } from './energy-ingestion.listener';

/**
 * The bug's own reproduction, kept as the regression test:
 * `BUG-ENERGY-VIRTUAL-ROOM-ATTRIBUTION` was filed with these numbers, produced by driving the real
 * listener and the real `EnergyDataService` against sqlite. Splitting a multi-channel device moved
 * the devices into rooms but not their energy — a room holding only virtual devices reported zero,
 * and the room holding the hardware was billed for channels it no longer presents.
 *
 * Real components throughout, because every piece of this is a seam between two of them: the value
 * source registry decides what a projection *is*, the claim registry decides who is accountable, the
 * baseline lives in `DeltaComputationService` keyed by device and channel, and the summary reads
 * `delta.roomId` back out. A mock at any of those seams would test the mock.
 *
 * Events are fed straight to the handler. In production `VirtualProjectionListener` re-emits
 * CHANNEL_PROPERTY_VALUE_SET for each projection of a reading, so both the source's event and the
 * projection's arrive — which is exactly what these cases feed, since counting one reading twice is
 * half of what the fix is about.
 */
describe('energy attribution across a split device', () => {
	let dataSource: DataSource;
	let listener: EnergyIngestionListener;
	let energyData: EnergyDataService;
	let deltas: Repository<EnergyDeltaEntity>;

	const RANGE_START = new Date('2026-08-01T00:00:00.000Z');
	const RANGE_END = new Date('2026-08-02T00:00:00.000Z');

	beforeEach(async () => {
		dataSource = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [__dirname + '/../../../**/*.entity.ts'],
			synchronize: true,
		});

		await dataSource.initialize();

		const metrics = new EnergyMetricsService();
		const valueSources = new PropertyValueSourceRegistryService();
		const claims = new EnergyClaimRegistryService();

		valueSources.register(new VirtualValueSourceService());
		claims.register(
			new VirtualEnergyClaimService(
				new VirtualPropertyIndexService(dataSource.getRepository(VirtualChannelPropertyEntity)),
			),
		);

		deltas = dataSource.getRepository(EnergyDeltaEntity);
		energyData = new EnergyDataService(deltas);

		// Rooms are real rows: `roomId` is a foreign key, and the point of the whole exercise is which
		// room a delta lands in.
		for (const room of ['kitchen', 'office', 'utility']) {
			await dataSource.getRepository(RoomSpaceEntity).insert({ id: room, name: room } as never);
		}

		listener = new EnergyIngestionListener(
			dataSource.getRepository(ChannelEntity),
			dataSource.getRepository(ChannelPropertyEntity),
			new DeltaComputationService(metrics),
			energyData,
			metrics,
			valueSources,
			claims,
		);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	/** A physical device, its energy channel and the cumulative meter on it. */
	const givenMeter = async (
		id: string,
		roomId: string | null,
		options: { channelCategory?: ChannelCategory } = {},
	): Promise<ChannelPropertyEntity> => {
		await dataSource.getRepository(ThirdPartyDeviceEntity).insert({
			id: `${id}-device`,
			category: DeviceCategory.GENERIC,
			name: id,
			roomId,
		} as never);
		await dataSource.getRepository(ThirdPartyChannelEntity).insert({
			id: `${id}-channel`,
			category: options.channelCategory ?? ChannelCategory.ELECTRICAL_ENERGY,
			name: id,
			device: `${id}-device`,
		} as never);
		await dataSource.getRepository(ThirdPartyChannelPropertyEntity).insert({
			id,
			category: PropertyCategory.CONSUMPTION,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
			channel: `${id}-channel`,
		} as never);

		return await read(id);
	};

	/**
	 * A virtual device in `roomId` presenting `meter` as its own. `claims` is what the projection's
	 * write path settles; it is set directly here so the case is about the ingestion rather than about
	 * `settleEnergyClaim`, which has its own tests — and so a legacy unclaimed projection, the shape an
	 * upgraded installation holds, can be expressed at all.
	 */
	const givenProjection = async (
		id: string,
		roomId: string | null,
		meter: string,
		options: { claims?: boolean } = {},
	): Promise<ChannelPropertyEntity> => {
		await dataSource.getRepository(VirtualDeviceEntity).insert({
			id: `${id}-device`,
			category: DeviceCategory.GENERIC,
			name: id,
			roomId,
		} as never);
		await dataSource.getRepository(VirtualChannelEntity).insert({
			id: `${id}-channel`,
			category: ChannelCategory.ELECTRICAL_ENERGY,
			name: id,
			device: `${id}-device`,
		} as never);
		await dataSource.getRepository(VirtualChannelPropertyEntity).insert({
			id,
			category: PropertyCategory.CONSUMPTION,
			permissions: [PermissionType.READ_ONLY],
			dataType: DataTypeType.FLOAT,
			channel: `${id}-channel`,
			valueOrigin: VirtualValueOrigin.SOURCE,
			sourcePropertyId: meter,
			energyClaimPropertyId: options.claims === false ? null : meter,
		} as never);

		return await read(id);
	};

	/**
	 * Loaded the way an event payload arrives: a real entity — single-table inheritance resolves the
	 * projection to its own class, which is what the value source registry keys on — carrying the
	 * channel the ingestion reads its category from.
	 */
	const read = async (id: string): Promise<ChannelPropertyEntity> => {
		const property = await dataSource
			.getRepository(ChannelPropertyEntity)
			.findOne({ where: { id }, relations: ['channel'] });

		if (!property) {
			throw new Error(`Fixture ${id} was not stored`);
		}

		return property;
	};

	/**
	 * One reading, delivered the way the system delivers it: to the meter, and then to every property
	 * presenting the meter's value as its own.
	 */
	const reports = async (
		meter: ChannelPropertyEntity,
		kwh: number,
		at: string,
		...projections: ChannelPropertyEntity[]
	): Promise<void> => {
		for (const property of [meter, ...projections]) {
			// Assigned onto the entity rather than spread into a copy: `type` is a getter on the
			// prototype, and a projection that loses it is no longer recognisable as one.
			(property as { value: unknown }).value = { value: kwh, lastUpdated: at, trend: 'stable' };

			await listener.handlePropertyValueSet(property);
		}
	};

	const consumptionOf = async (roomId?: string): Promise<number> =>
		(await energyData.getSummary(RANGE_START, RANGE_END, roomId)).totalConsumptionKwh;

	// §2(a): the epic's headline example — a multi-channel device whose relays belong to different
	// rooms. Before the fix both rooms reported zero and the whole 7 kWh sat on a device in no room.
	it('bills each room for the channel its own device presents', async () => {
		const kitchenMeter = await givenMeter('kitchen-relay', null);
		const officeMeter = await givenMeter('office-relay', null);
		const kitchenLight = await givenProjection('kitchen-projection', 'kitchen', kitchenMeter.id);
		const officeLight = await givenProjection('office-projection', 'office', officeMeter.id);

		await reports(kitchenMeter, 10, '2026-08-01T10:00:00.000Z', kitchenLight);
		await reports(officeMeter, 100, '2026-08-01T10:00:00.000Z', officeLight);
		await reports(kitchenMeter, 12, '2026-08-01T10:05:00.000Z', kitchenLight);
		await reports(officeMeter, 105, '2026-08-01T10:05:00.000Z', officeLight);

		await expect(consumptionOf('kitchen')).resolves.toBe(2);
		await expect(consumptionOf('office')).resolves.toBe(5);
		// The house is billed once for each reading, not once per projection of it.
		await expect(consumptionOf()).resolves.toBe(7);
	});

	// §2(b): the hardware sits in the utility room, the channel is presented in the kitchen.
	it('bills the room the device is seen in, not the one the hardware sits in', async () => {
		const meter = await givenMeter('utility-meter', 'utility');
		const kitchenLight = await givenProjection('kitchen-projection', 'kitchen', meter.id);

		await reports(meter, 100, '2026-08-01T10:00:00.000Z', kitchenLight);
		await reports(meter, 105, '2026-08-01T10:05:00.000Z', kitchenLight);

		await expect(consumptionOf('kitchen')).resolves.toBe(5);
		await expect(consumptionOf('utility')).resolves.toBe(0);
	});

	// A meter nothing has taken over is billed where it always was. The fix moves attribution; it does
	// not require a virtual device to exist for energy to be recorded at all.
	it('leaves an unprojected meter where it is', async () => {
		const meter = await givenMeter('utility-meter', 'utility');

		await reports(meter, 100, '2026-08-01T10:00:00.000Z');
		await reports(meter, 105, '2026-08-01T10:05:00.000Z');

		await expect(consumptionOf('utility')).resolves.toBe(5);
	});

	// The "missing meter" shape: a `consumption` property in a `generic` channel is not energy to the
	// ingestion, so only the projection's event carries a qualifying classification. Two projections of
	// it both ingested before the claim existed, doubling the household total.
	it('counts an unrecognised meter once, through the projection that claims it', async () => {
		const meter = await givenMeter('hidden-meter', null, { channelCategory: ChannelCategory.GENERIC });
		const claimant = await givenProjection('kitchen-projection', 'kitchen', meter.id);
		const legacy = await givenProjection('office-projection', 'office', meter.id, { claims: false });

		await reports(meter, 10, '2026-08-01T10:00:00.000Z', claimant, legacy);
		await reports(meter, 12, '2026-08-01T10:05:00.000Z', claimant, legacy);

		await expect(consumptionOf('kitchen')).resolves.toBe(2);
		await expect(consumptionOf('office')).resolves.toBe(0);
		await expect(consumptionOf()).resolves.toBe(2);
	});

	// The transition is the test: the baseline is keyed to the physical meter, so the first reading
	// after a projection appears is still measured against the reading before it. Keyed to the
	// claimant instead, `computeDelta` would meet a key it has never seen, answer null, and drop the
	// 3 kWh accumulated in between — invisibly, since nothing reports a delta that was never computed.
	it('keeps the meter running across the moment it is projected', async () => {
		const meter = await givenMeter('utility-meter', 'utility');

		await reports(meter, 10, '2026-08-01T10:00:00.000Z');
		await reports(meter, 12, '2026-08-01T10:05:00.000Z');

		const kitchenLight = await givenProjection('kitchen-projection', 'kitchen', meter.id);

		await reports(meter, 15, '2026-08-01T10:10:00.000Z', kitchenLight);

		await expect(consumptionOf('utility')).resolves.toBe(2);
		await expect(consumptionOf('kitchen')).resolves.toBe(3);
		// Nothing is lost in the handover: 15 kWh measured, 5 of it since the first sample.
		await expect(consumptionOf()).resolves.toBe(5);
	});

	// History is not re-attributed. What was recorded under the utility room stays there, which is the
	// promise the task makes to anyone expecting a backfill — and the readers have to agree with it.
	it('leaves what was already recorded where it was recorded', async () => {
		const meter = await givenMeter('utility-meter', 'utility');

		await reports(meter, 10, '2026-08-01T10:00:00.000Z');
		await reports(meter, 12, '2026-08-01T10:05:00.000Z');

		const kitchenLight = await givenProjection('kitchen-projection', 'kitchen', meter.id);

		await reports(meter, 15, '2026-08-01T10:10:00.000Z', kitchenLight);

		const recorded = await deltas.find({ order: { intervalStart: 'ASC' } });

		expect(recorded.map((delta) => [delta.deviceId, delta.roomId, delta.deltaKwh])).toEqual([
			['utility-meter-device', 'utility', 2],
			['kitchen-projection-device', 'kitchen', 3],
		]);
	});
});
