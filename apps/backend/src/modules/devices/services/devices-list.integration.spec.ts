import { instanceToPlain } from 'class-transformer';
import { DataSource } from 'typeorm';

import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../../plugins/simulator/entities/simulator.entity';
import { SIMULATOR_TYPE } from '../../../plugins/simulator/simulator.constants';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { SpaceType } from '../../spaces/spaces.constants';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceHiddenFilter,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../entities/devices.entity';
import { ChannelPropertyEntitySubscriber } from '../subscribers/channel-property-entity.subscriber';
import { DeviceEntitySubscriber } from '../subscribers/device-entity.subscriber';

import { DeviceConnectionStateService } from './device-connection-state.service';
import { DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesService } from './devices.service';
import { PropertyValueService } from './property-value.service';

const relations = [
	'controls',
	'controls.device',
	'channels',
	'channels.device',
	'channels.controls',
	'channels.controls.channel',
	'channels.properties',
	'channels.properties.channel',
	'deviceZones',
];
const plain = (devices: DeviceEntity[]) =>
	instanceToPlain(
		devices.sort((a, b) => a.id.localeCompare(b.id)),
		{ enableCircularCheck: true },
	);

describe('Batched device catalog with SQLite and production afterLoad subscribers', () => {
	let database: DataSource;
	let service: DevicesService;
	let sourceId: string;
	let liveValue: number;
	let readLatest: jest.Mock;

	beforeEach(async () => {
		database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				DeviceEntity,
				ChannelEntity,
				ChannelPropertyEntity,
				DeviceControlEntity,
				ChannelControlEntity,
				DeviceZoneEntity,
				SpaceEntity,
				SimulatorDeviceEntity,
				SimulatorChannelEntity,
				SimulatorChannelPropertyEntity,
			],
		}).initialize();
		liveValue = 21;
		readLatest = jest.fn(() => Promise.resolve({ value: liveValue }));
		new ChannelPropertyEntitySubscriber({ readLatest } as unknown as PropertyValueService, null as never, database);
		new DeviceEntitySubscriber(
			{
				readLatest: () =>
					Promise.resolve({ online: true, status: ConnectionState.CONNECTED, lastChanged: new Date(0) }),
			} as unknown as DeviceConnectionStateService,
			database,
		);
		service = new DevicesService(
			database.getRepository(DeviceEntity),
			database.getRepository(SpaceEntity),
			{ getMapping: () => ({ class: SimulatorDeviceEntity }) } as unknown as DevicesTypeMapperService,
			null as never,
			null as never,
			null as never,
			null as never,
			null as never,
			database,
			null as never,
		);
		const zone = await database.getRepository(SpaceEntity).save({ name: 'Zone', type: SpaceType.ZONE });
		for (let i = 0; i < 17; i++) {
			const device = await database
				.getRepository(SimulatorDeviceEntity)
				.save({ name: `Sensor ${i}`, hidden: i % 3 === 0, enabled: i !== 1 });
			if (i === 0) sourceId = device.id;
			const channel = await database
				.getRepository(SimulatorChannelEntity)
				.save({ device, name: 'Temperature', category: ChannelCategory.TEMPERATURE });
			await database.getRepository(SimulatorChannelPropertyEntity).save({
				channel,
				category: PropertyCategory.TEMPERATURE,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
			});
			await database.getRepository(DeviceControlEntity).save({ device, name: 'Device control' });
			await database.getRepository(ChannelControlEntity).save({ channel, name: 'Channel control' });
			await database.getRepository(DeviceZoneEntity).save({ deviceId: device.id, zoneId: zone.id });
		}
		await database.getRepository(DeviceEntity).save({ name: 'Other integration', hidden: false });
		readLatest.mockClear();
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	it('preserves the joined API graph, computed units, live values, statuses and disabled devices across batches', async () => {
		const repository = database.getRepository(DeviceEntity);
		const baseline = await repository.find({ relations });
		const devices = await service.findAll();
		expect(devices).toHaveLength(18);
		expect(plain(devices)).toEqual(plain(baseline));
		const sensor = devices.find(({ id }) => id === sourceId);
		expect(sensor.channels[0].properties[0]).toMatchObject({ unit: '°C', value: { value: 21 } });
		expect(sensor.status).toMatchObject({ online: true, status: ConnectionState.CONNECTED });
		expect(sensor.controls).toHaveLength(1);
		expect(sensor.channels[0].controls).toHaveLength(1);
		expect(sensor.deviceZones).toHaveLength(1);
		expect(devices.some(({ enabled }) => !enabled)).toBe(true);

		liveValue = 23;
		const refreshed = await service.findAll();
		expect(refreshed.find(({ id }) => id === sourceId).channels[0].properties[0].value?.value).toBe(23);
	});

	it.each([DeviceHiddenFilter.ALL, DeviceHiddenFilter.TRUE, DeviceHiddenFilter.FALSE])(
		'preserves integration discriminator and hidden=%s in ID and graph queries',
		async (hidden) => {
			const expected = await database.getRepository(SimulatorDeviceEntity).find({
				...(hidden === DeviceHiddenFilter.ALL ? {} : { where: { hidden: hidden === DeviceHiddenFilter.TRUE } }),
				relations,
			});
			const devices = await service.findAll<SimulatorDeviceEntity>(SIMULATOR_TYPE, hidden);
			expect(plain(devices)).toEqual(plain(expected));
			expect(devices).toHaveLength(
				hidden === DeviceHiddenFilter.ALL ? 17 : hidden === DeviceHiddenFilter.TRUE ? 6 : 11,
			);
			expect(devices.every((device) => device instanceof SimulatorDeviceEntity)).toBe(true);
		},
	);

	it('rechecks visibility and observes deletion between the ID read and graph read', async () => {
		const repository = database.getRepository(DeviceEntity);
		const before = await service.findAll(undefined, DeviceHiddenFilter.FALSE);
		const [removed, hidden] = before;
		jest.spyOn(repository, 'find').mockImplementationOnce(async (options) => {
			await repository.delete(removed.id);
			await repository.update(hidden.id, { hidden: true });
			return database.manager.find(DeviceEntity, options);
		});
		const devices = await service.findAll(undefined, DeviceHiddenFilter.FALSE);
		expect(devices).toHaveLength(before.length - 2);
		expect(devices.some(({ id }) => id === removed.id || id === hidden.id)).toBe(false);
	});
});
