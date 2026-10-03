import { DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	DeviceCategory,
	EventType as DeviceEvent,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { PropertyValueState } from '../../../modules/devices/models/property-value-state.model';
import { DeviceCommandGraphService } from '../../../modules/devices/services/device-command-graph.service';
import { DeviceConnectionStateService } from '../../../modules/devices/services/device-connection-state.service';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { PropertyValueService } from '../../../modules/devices/services/property-value.service';
import { IntentTimeseriesService } from '../../../modules/intents/services/intent-timeseries.service';
import { SpaceRoleEntity } from '../../../modules/spaces/entities/space-role.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpacesNotFoundException } from '../../../modules/spaces/spaces.exceptions';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../simulator/entities/simulator.entity';
import { RoomSpaceEntity } from '../entities/room-space.entity';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceSensorRoleEntity } from '../entities/space-sensor-role.entity';
import { ZoneSpaceEntity } from '../entities/zone-space.entity';
import { SpaceClimateStateListener } from '../listeners/space-climate-state.listener';
import { SpaceLightingStateListener } from '../listeners/space-lighting-state.listener';
import { SpaceSensorStateListener } from '../listeners/space-sensor-state.listener';
import { ClimateRole, EventType, LightingRole, SensorRole } from '../spaces-home-control.constants';
import { IntentSpecLoaderService } from '../spec/intent-spec-loader.service';

import { SpaceClimateStateService } from './space-climate-state.service';
import { SpaceLightingStateService } from './space-lighting-state.service';
import { SpaceSensorStateService } from './space-sensor-state.service';
import { SpaceStateReadService } from './space-state-read.service';

describe('Runtime space state configuration with SQLite and real aggregate calculators', () => {
	let database: DataSource;
	let module: TestingModule;
	let metadata: PropertyMetadataService;
	let reads: SpaceStateReadService;
	let graphs: DeviceCommandGraphService;
	let room: RoomSpaceEntity;
	let other: RoomSpaceEntity;
	let zone: ZoneSpaceEntity;
	let light: SimulatorDeviceEntity;
	let heater: SimulatorDeviceEntity;
	let lightChannel: SimulatorChannelEntity;
	let temperatureChannel: SimulatorChannelEntity;
	let on: SimulatorChannelPropertyEntity;
	let temperature: SimulatorChannelPropertyEntity;
	let lightRole: SpaceLightingRoleEntity;
	let climateRole: SpaceClimateRoleEntity;
	let sensorRole: SpaceSensorRoleEntity;
	let live: Map<string, PropertyValueState>;
	let online: boolean;
	let lighting: SpaceLightingStateService;
	let climate: SpaceClimateStateService;
	let sensors: SpaceSensorStateService;
	let events: EventEmitter2;
	let values: { readLatest: jest.Mock };
	let connectivity: { readLatest: jest.Mock };

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
				RoomSpaceEntity,
				ZoneSpaceEntity,
				SpaceRoleEntity,
				SpaceLightingRoleEntity,
				SpaceClimateRoleEntity,
				SpaceSensorRoleEntity,
				SimulatorDeviceEntity,
				SimulatorChannelEntity,
				SimulatorChannelPropertyEntity,
			],
		}).initialize();
		room = await database.getRepository(RoomSpaceEntity).save({ name: 'Room' });
		other = await database.getRepository(RoomSpaceEntity).save({ name: 'Other' });
		zone = await database.getRepository(ZoneSpaceEntity).save({ name: 'Zone' });
		light = await database
			.getRepository(SimulatorDeviceEntity)
			.save({ name: 'A light', category: DeviceCategory.LIGHTING, roomId: room.id });
		heater = await database
			.getRepository(SimulatorDeviceEntity)
			.save({ name: 'B heater', category: DeviceCategory.HEATING_UNIT, roomId: room.id });
		lightChannel = await database
			.getRepository(SimulatorChannelEntity)
			.save({ device: light, name: 'Light', category: ChannelCategory.LIGHT });
		const heaterChannel = await database
			.getRepository(SimulatorChannelEntity)
			.save({ device: heater, name: 'Heater', category: ChannelCategory.HEATER });
		temperatureChannel = await database
			.getRepository(SimulatorChannelEntity)
			.save({ device: heater, name: 'Temperature', category: ChannelCategory.TEMPERATURE });
		on = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel: lightChannel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		const heaterOn = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel: heaterChannel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		temperature = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel: temperatureChannel,
			category: PropertyCategory.TEMPERATURE,
			dataType: DataTypeType.FLOAT,
			permissions: [PermissionType.READ_ONLY],
		});
		lightRole = await database
			.getRepository(SpaceLightingRoleEntity)
			.save({ spaceId: room.id, deviceId: light.id, channelId: lightChannel.id, role: LightingRole.MAIN });
		climateRole = await database
			.getRepository(SpaceClimateRoleEntity)
			.save({ spaceId: room.id, deviceId: heater.id, channelId: null, role: ClimateRole.AUTO });
		sensorRole = await database
			.getRepository(SpaceSensorRoleEntity)
			.save({ spaceId: room.id, deviceId: heater.id, channelId: temperatureChannel.id, role: SensorRole.ENVIRONMENT });
		live = new Map([
			[on.id, new PropertyValueState(false)],
			[heaterOn.id, new PropertyValueState(true)],
			[temperature.id, new PropertyValueState(21)],
		]);
		online = true;
		values = {
			readLatest: jest.fn((property: ChannelPropertyEntity) => Promise.resolve(live.get(property.id) ?? null)),
		};
		connectivity = {
			readLatest: jest.fn(() =>
				Promise.resolve({
					online,
					status: online ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
					lastChanged: new Date(1000),
				}),
			),
		};
		module = await Test.createTestingModule({
			imports: [EventEmitterModule.forRoot()],
			providers: [
				PropertyMetadataService,
				DeviceCommandGraphService,
				SpaceStateReadService,
				SpaceLightingStateService,
				SpaceClimateStateService,
				SpaceSensorStateService,
				SpaceLightingStateListener,
				SpaceClimateStateListener,
				SpaceSensorStateListener,
				IntentSpecLoaderService,
				{ provide: DataSource, useValue: database },
				{ provide: ConfigService, useValue: new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }) },
				{ provide: PropertyValueService, useValue: values },
				{ provide: DeviceConnectionStateService, useValue: connectivity },
				{
					provide: IntentTimeseriesService,
					useValue: {
						getLastLightingMode: jest.fn().mockResolvedValue(null),
						getModeValidity: jest.fn().mockResolvedValue(null),
						storeModeValidity: jest.fn().mockResolvedValue(undefined),
						getLastClimateState: jest.fn().mockResolvedValue(null),
					},
				},
			],
		}).compile();
		await module.init();
		metadata = module.get(PropertyMetadataService);
		reads = module.get(SpaceStateReadService);
		graphs = module.get(DeviceCommandGraphService);
		lighting = module.get(SpaceLightingStateService);
		climate = module.get(SpaceClimateStateService);
		sensors = module.get(SpaceSensorStateService);
		events = module.get(EventEmitter2);
	});

	afterEach(async () => {
		await module?.close();
		reads?.onModuleDestroy();
		metadata?.onModuleDestroy();
		jest.useRealTimers();
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	const state = async () =>
		Promise.all([
			lighting.getLightingState(room.id),
			climate.getClimateState(room.id),
			sensors.getSensorState(room.id),
		]);
	const ids = async (spaceId = room.id) => (await reads.findDevicesBySpace(spaceId)).map((device) => device.id);

	it('recalculates all three real domains from fresh live values with no warm ORM or SQL', async () => {
		await state();
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		const repository = jest.spyOn(database, 'getRepository');
		live.set(on.id, new PropertyValueState(true));
		live.set(temperature.id, new PropertyValueState(27, '2026-10-03T08:00:00Z', 'rising'));
		online = false;
		const [lightState, climateState, sensorState] = await state();
		expect(lightState.roles[LightingRole.MAIN]?.isOn).toBe(true);
		expect(climateState.currentTemperature).toBe(27);
		expect(sensorState.environment?.averageTemperature).toBe(27);
		expect(sensorState.readings[0].readings[0]).toMatchObject({
			updatedAt: new Date('2026-10-03T08:00:00Z'),
			trend: 'rising',
		});
		expect((await reads.findDevicesBySpace(room.id))[0].status.online).toBe(false);
		expect(query).not.toHaveBeenCalled();
		expect(repository).not.toHaveBeenCalled();
	});

	it('publishes real debounced aggregate events from warmed property notifications without SQL', async () => {
		await state();
		const output = {
			lighting: jest.fn(),
			climate: jest.fn<void, [{ space_id: string; state: { currentTemperature: number } }]>(),
			sensor: jest.fn(),
		};
		events.on(EventType.LIGHTING_STATE_CHANGED, output.lighting);
		events.on(EventType.CLIMATE_STATE_CHANGED, output.climate);
		events.on(EventType.SENSOR_STATE_CHANGED, output.sensor);
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
		live.set(on.id, new PropertyValueState(true));
		live.set(temperature.id, new PropertyValueState(25));
		await events.emitAsync(DeviceEvent.CHANNEL_PROPERTY_VALUE_SET, on);
		await events.emitAsync(DeviceEvent.CHANNEL_PROPERTY_VALUE_SET, temperature);
		await jest.advanceTimersByTimeAsync(150);
		for (const emit of Object.values(output)) expect(emit).toHaveBeenCalledTimes(1);
		expect(output.climate.mock.calls[0][0].space_id).toBe(room.id);
		expect(output.climate.mock.calls[0][0].state.currentTemperature).toBe(25);
		expect(query).not.toHaveBeenCalled();
	});

	it('retains room name ordering, excludes hidden devices and follows moves and zone membership', async () => {
		expect(await ids()).toEqual([light.id, heater.id]);
		await database.getRepository(SimulatorDeviceEntity).update(heater.id, { name: '0 heater' });
		expect(await ids()).toEqual([heater.id, light.id]);
		await database.getRepository(SimulatorDeviceEntity).update(light.id, { hidden: true });
		expect(await ids()).toEqual([heater.id]);
		await database.getRepository(SimulatorDeviceEntity).update(light.id, { hidden: false, roomId: other.id });
		expect(await ids()).toEqual([heater.id]);
		expect(await ids(other.id)).toEqual([light.id]);
		expect(await ids(zone.id)).toEqual([]);
		await database.getRepository(DeviceZoneEntity).save({ deviceId: light.id, zoneId: zone.id });
		expect(await ids(zone.id)).toEqual([light.id]);
		await database.getRepository(SimulatorDeviceEntity).update(light.id, { hidden: true });
		expect(await ids(zone.id)).toEqual([]);
		await database.getRepository(SimulatorDeviceEntity).update(light.id, { hidden: false });
		await database.getRepository(DeviceZoneEntity).delete({ deviceId: light.id, zoneId: zone.id });
		expect(await ids(zone.id)).toEqual([]);
	});

	it('invalidates role updates, deletes and inserts for all three domains', async () => {
		await state();
		await database.getRepository(SpaceLightingRoleEntity).update(lightRole.id, { role: LightingRole.HIDDEN });
		await database.getRepository(SpaceClimateRoleEntity).update(climateRole.id, { role: ClimateRole.HIDDEN });
		await database.getRepository(SpaceSensorRoleEntity).update(sensorRole.id, { role: SensorRole.HIDDEN });
		const [l, c, s] = await state();
		expect(l.hasLights).toBe(false);
		expect(c.hasClimate).toBe(false);
		expect(s.hasSensors).toBe(false);
		await database.getRepository(SpaceSensorRoleEntity).delete(sensorRole.id);
		expect((await reads.getSensorRoleMap(room.id)).size).toBe(0);
		await database
			.getRepository(SpaceSensorRoleEntity)
			.save({ spaceId: room.id, deviceId: heater.id, channelId: temperatureChannel.id, role: SensorRole.ENVIRONMENT });
		expect((await sensors.getSensorState(room.id)).environment?.averageTemperature).toBe(21);
	});

	it('isolates mutable role maps, role dates, space facts and device graphs from later readers', async () => {
		const map = await reads.getLightingRoleMap(room.id);
		const role = map.get(`${light.id}:${lightChannel.id}`);
		role.role = LightingRole.HIDDEN;
		(role.createdAt as Date).setFullYear(1990);
		map.clear();
		(await reads.findOne(room.id)).id = 'mutated';
		const devices = await reads.findDevicesBySpace(room.id);
		devices[0].channels[0].properties[0].value.value = 100;
		devices[0].name = 'mutated';
		expect((await reads.getLightingRoleMap(room.id)).get(`${light.id}:${lightChannel.id}`)).toMatchObject({
			role: LightingRole.MAIN,
		});
		expect(
			((await reads.getLightingRoleMap(room.id)).get(`${light.id}:${lightChannel.id}`).createdAt as Date).getFullYear(),
		).not.toBe(1990);
		expect((await reads.findOne(room.id)).id).toBe(room.id);
		expect((await reads.findDevicesBySpace(room.id))[0]).toMatchObject({
			name: 'A light',
			channels: [{ properties: [{ value: { value: false } }] }],
		});
	});

	it.each(['commitTransaction', 'rollbackTransaction'] as const)(
		'does not retain uncommitted room or role facts after nested %s and outer rollback',
		async (settleInner) => {
			await state();
			const runner = database.createQueryRunner();
			await runner.startTransaction();
			try {
				await runner.manager.update(SimulatorDeviceEntity, light.id, { roomId: other.id });
				await runner.manager.update(SpaceSensorRoleEntity, sensorRole.id, { role: SensorRole.HIDDEN });
				await runner.startTransaction();
				await runner[settleInner]();
				expect(await ids()).toEqual([heater.id]);
				expect((await sensors.getSensorState(room.id)).hasSensors).toBe(false);
			} finally {
				await runner.rollbackTransaction();
			}
			expect(await ids()).toEqual([light.id, heater.id]);
			expect((await sensors.getSensorState(room.id)).hasSensors).toBe(true);
			const query = jest.spyOn(runner, 'query');
			await state();
			query.mockClear();
			await state();
			expect(query).not.toHaveBeenCalled();
		},
	);

	it.each(['commitTransaction', 'rollbackTransaction'] as const)(
		'discards role-only changes after nested %s and outer rollback',
		async (settleInner) => {
			await reads.getSensorRoleMap(room.id);
			const runner = database.createQueryRunner();
			await runner.startTransaction();
			try {
				await runner.manager.update(SpaceSensorRoleEntity, sensorRole.id, { role: SensorRole.HIDDEN });
				await runner.startTransaction();
				await runner[settleInner]();
				expect((await reads.getSensorRoleMap(room.id)).get(`${heater.id}:${temperatureChannel.id}`).role).toBe(
					SensorRole.HIDDEN,
				);
			} finally {
				await runner.rollbackTransaction();
			}
			expect((await reads.getSensorRoleMap(room.id)).get(`${heater.id}:${temperatureChannel.id}`).role).toBe(
				SensorRole.ENVIRONMENT,
			);
		},
	);

	it('invalidates channel/device cascades and bulk space reset through the shared catalog revision', async () => {
		await state();
		await database.getRepository(ChannelEntity).delete(temperatureChannel.id);
		expect((await reads.getSensorRoleMap(room.id)).size).toBe(0);
		expect((await sensors.getSensorState(room.id)).hasSensors).toBe(false);
		await database.getRepository(DeviceEntity).delete(light.id);
		expect(await ids()).toEqual([heater.id]);
		await database.getRepository(SpaceEntity).clear();
		metadata.invalidate();
		expect(await reads.findOne(room.id)).toBeNull();
		await expect(reads.findDevicesBySpace(room.id)).rejects.toBeInstanceOf(SpacesNotFoundException);
	});

	it('retries membership when a device moves during live-state hydration', async () => {
		await ids();
		let entered!: () => void;
		let release!: () => void;
		const started = new Promise<void>((resolve) => {
			entered = resolve;
		});
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const original = graphs.findOne.bind(graphs) as (id: string) => Promise<DeviceEntity | null>;
		jest.spyOn(graphs, 'findOne').mockImplementationOnce(async (id) => {
			const old = await original(id);
			entered();
			await gate;
			return old;
		});
		const pending = ids();
		await started;
		try {
			await database.getRepository(SimulatorDeviceEntity).update(light.id, { roomId: other.id });
		} finally {
			release();
		}
		expect(await pending).toEqual([heater.id]);
	});

	it('sees listener-disabled external membership/role writes in shared-writer mode', async () => {
		reads.onModuleDestroy();
		metadata.onModuleDestroy();
		const config = new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true });
		metadata = new PropertyMetadataService(database, config);
		graphs = new DeviceCommandGraphService(
			metadata,
			values as unknown as PropertyValueService,
			connectivity as unknown as DeviceConnectionStateService,
		);
		reads = new SpaceStateReadService(database, metadata, graphs, config);
		await reads.findDevicesBySpace(room.id);
		await reads.getSensorRoleMap(room.id);
		await database
			.createQueryBuilder()
			.update(SimulatorDeviceEntity)
			.set({ roomId: other.id })
			.where('id = :id', { id: light.id })
			.callListeners(false)
			.execute();
		await database
			.createQueryBuilder()
			.update(SpaceSensorRoleEntity)
			.set({ role: SensorRole.HIDDEN })
			.where('id = :id', { id: sensorRole.id })
			.callListeners(false)
			.execute();
		expect(await ids()).toEqual([heater.id]);
		expect((await reads.getSensorRoleMap(room.id)).get(`${heater.id}:${temperatureChannel.id}`).role).toBe(
			SensorRole.HIDDEN,
		);
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		await ids();
		expect(query).toHaveBeenCalled();
	});
});
