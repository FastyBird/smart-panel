import { DataSource, Repository } from 'typeorm';

import { ThirdPartyDeviceEntity } from '../../../plugins/devices-third-party/entities/devices-third-party.entity';
import { RoomSpaceEntity } from '../../../plugins/spaces-home-control/entities/room-space.entity';
import { ZoneSpaceEntity } from '../../../plugins/spaces-home-control/entities/zone-space.entity';
import { DeviceCategory } from '../../devices/devices.constants';
import { EnergySourceType } from '../energy.constants';
import { EnergyDeltaEntity } from '../entities/energy-delta.entity';

import { EnergyDataService } from './energy-data.service';

/**
 * What a space's energy history is a claim about.
 *
 * Every delta carries the room it was recorded in, and the space readers used to ignore it: they
 * reached the room by joining the device's *current* `roomId`, so moving a device rewrote its past
 * between spaces and deleting one erased that past outright. Splitting a device into rooms makes both
 * routine — the whole point of a split is that devices move — so a fix that promised stable history
 * while the read path contradicted it would be promising nothing.
 *
 * Driven against sqlite through the real service, because every claim here is about what the SQL
 * does: which join decides the room, whether a missing row drops a total, and what the upsert does
 * with a bucket that is still open when the device moves.
 */
describe('energy history across a room change', () => {
	let dataSource: DataSource;
	let service: EnergyDataService;
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

		deltas = dataSource.getRepository(EnergyDeltaEntity);
		service = new EnergyDataService(deltas);

		await dataSource.getRepository(ZoneSpaceEntity).insert({ id: 'upstairs', name: 'Upstairs' } as never);
		await dataSource.getRepository(RoomSpaceEntity).insert([
			{ id: 'kitchen', name: 'Kitchen' },
			{ id: 'office', name: 'Office', parentId: 'upstairs' },
			{ id: 'bedroom', name: 'Bedroom', parentId: 'upstairs' },
		] as never);
	});

	afterEach(async () => {
		await dataSource.destroy();
	});

	const givenDevice = async (id: string, roomId: string | null): Promise<void> => {
		await dataSource
			.getRepository(ThirdPartyDeviceEntity)
			.insert({ id, category: DeviceCategory.GENERIC, name: id, roomId } as never);
	};

	const moveDevice = async (id: string, roomId: string | null): Promise<void> => {
		await dataSource.getRepository(ThirdPartyDeviceEntity).update({ id }, { roomId });
	};

	const recorded = async (deviceId: string, roomId: string | null, kwh: number, at: string): Promise<void> => {
		const intervalStart = new Date(at);

		await service.saveDelta({
			deviceId,
			roomId,
			sourceType: EnergySourceType.CONSUMPTION_IMPORT,
			deltaKwh: kwh,
			intervalStart,
			intervalEnd: new Date(intervalStart.getTime() + 5 * 60 * 1000),
		});
	};

	const consumptionOf = async (spaceId?: string): Promise<number> =>
		(await service.getSpaceSummary(RANGE_START, RANGE_END, spaceId)).totalConsumptionKwh;

	// The promise the task makes to anyone expecting a backfill, kept on the read side too: what was
	// recorded in the kitchen stays the kitchen's, and only what comes after the move is the office's.
	it('leaves a moved device’s consumption in the room that consumed it', async () => {
		await givenDevice('heater', 'kitchen');
		await recorded('heater', 'kitchen', 3, '2026-08-01T10:00:00.000Z');

		await moveDevice('heater', 'office');
		await recorded('heater', 'office', 4, '2026-08-01T11:00:00.000Z');

		await expect(consumptionOf('kitchen')).resolves.toBe(3);
		await expect(consumptionOf('office')).resolves.toBe(4);
		await expect(consumptionOf('home')).resolves.toBe(7);
	});

	// A zone reaches its rooms through the room row, which is a *current* fact and stays one: a room
	// moved to another zone is the same room, and its history moves with it.
	it('follows a room into the zone it belongs to now', async () => {
		await givenDevice('lamp', 'office');
		await recorded('lamp', 'office', 2, '2026-08-01T10:00:00.000Z');
		await recorded('lamp', 'bedroom', 5, '2026-08-01T11:00:00.000Z');

		await expect(consumptionOf('upstairs')).resolves.toBe(7);
		await expect(consumptionOf('kitchen')).resolves.toBe(0);
	});

	// Deleting a device is not a reason for a room to forget what it consumed. The join that supplied
	// the device's name used to drop the row entirely.
	it('keeps a deleted device’s consumption in its room', async () => {
		await givenDevice('kettle', 'kitchen');
		await recorded('kettle', 'kitchen', 6, '2026-08-01T10:00:00.000Z');

		await dataSource.getRepository(ThirdPartyDeviceEntity).delete({ id: 'kettle' });

		await expect(consumptionOf('kitchen')).resolves.toBe(6);

		const breakdown = await service.getSpaceBreakdown(RANGE_START, RANGE_END, 'kitchen');

		expect(breakdown).toEqual([expect.objectContaining({ deviceId: 'kettle', roomId: 'kitchen', consumptionKwh: 6 })]);
	});

	// One row per device, reporting the room it was last recorded in — the panel renders this list as
	// one tile per device, and the same device twice would read as a duplicate rather than as history.
	it('reports a moved device once, in the room it ended up in', async () => {
		await givenDevice('heater', 'office');
		await recorded('heater', 'office', 2, '2026-08-01T10:00:00.000Z');
		await recorded('heater', 'bedroom', 5, '2026-08-01T11:00:00.000Z');

		const breakdown = await service.getSpaceBreakdown(RANGE_START, RANGE_END, 'upstairs');

		expect(breakdown).toEqual([
			expect.objectContaining({ deviceId: 'heater', roomId: 'bedroom', roomName: 'Bedroom', consumptionKwh: 7 }),
		]);
	});

	// The write side of the same promise. A bucket is open for five minutes, and a device that moves
	// inside one used to go on filling the row the old room owns.
	it('stops filling the old room’s bucket once the device has moved', async () => {
		await givenDevice('heater', 'kitchen');
		await recorded('heater', 'kitchen', 1, '2026-08-01T10:00:00.000Z');

		await moveDevice('heater', 'office');
		// Same interval, so the upsert lands on the row that already exists.
		await recorded('heater', 'office', 2, '2026-08-01T10:00:00.000Z');

		const stored = await deltas.find();

		// One bucket still — the device and the interval are unchanged — carrying the room the device
		// ended the interval in. Up to one interval of energy moves with it; the alternative is a
		// nullable column in a unique key, which SQLite does not conflict against itself.
		expect(stored).toHaveLength(1);
		expect(stored[0].roomId).toBe('office');
		expect(stored[0].deltaKwh).toBe(3);

		await expect(consumptionOf('kitchen')).resolves.toBe(0);
		await expect(consumptionOf('office')).resolves.toBe(3);
	});

	// A device in no room is not in any space, and must not be lost from the house total either.
	it('counts an unassigned device at home and in no room', async () => {
		await givenDevice('boiler', null);
		await recorded('boiler', null, 8, '2026-08-01T10:00:00.000Z');

		await expect(consumptionOf('home')).resolves.toBe(8);
		await expect(consumptionOf('kitchen')).resolves.toBe(0);
	});

	// Charts are claims about the past, and one that redraws itself when a device changes room is
	// claiming something that never happened.
	it('does not redraw a room’s chart when a device leaves it', async () => {
		await givenDevice('heater', 'kitchen');
		await recorded('heater', 'kitchen', 3, '2026-08-01T10:00:00.000Z');

		const before = await service.getSpaceTimeseries(RANGE_START, RANGE_END, '1h', 'kitchen');

		await moveDevice('heater', 'office');

		const after = await service.getSpaceTimeseries(RANGE_START, RANGE_END, '1h', 'kitchen');

		expect(after).toEqual(before);
		expect(after.reduce((total, point) => total + point.consumptionDeltaKwh, 0)).toBe(3);
	});
});
