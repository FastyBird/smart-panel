import { ChildEntity, DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { PageEntity } from '../../../modules/dashboard/entities/dashboard.entity';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
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
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { DisplayEntity } from '../../../modules/displays/entities/displays.entity';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../simulator/entities/simulator.entity';
import { SpaceClimateStateService } from '../services/space-climate-state.service';
import { SpaceLightingStateService } from '../services/space-lighting-state.service';
import { SpaceSensorStateService } from '../services/space-sensor-state.service';

import { SpaceClimateStateListener } from './space-climate-state.listener';
import { SpaceLightingStateListener } from './space-lighting-state.listener';
import { SpaceSensorStateListener } from './space-sensor-state.listener';

@ChildEntity(SpaceType.ROOM)
class RoutingTestRoom extends SpaceEntity {
	get type(): SpaceType {
		return SpaceType.ROOM;
	}
}

// Aggregate calculators are stubbed: this suite measures event-to-room routing only.
// Their space/role/device queries and downstream Influx reads are outside this boundary.
describe.each([
	['lighting', ChannelCategory.LIGHT, PropertyCategory.ON],
	['climate', ChannelCategory.HEATER, PropertyCategory.ON],
	['sensor', ChannelCategory.ELECTRICAL_POWER, PropertyCategory.POWER],
] as const)('%s state event routing through SQLite', (domain, channelCategory, propertyCategory) => {
	let database: DataSource;
	let module: TestingModule;
	let events: EventEmitter2;
	let metadata: PropertyMetadataService;
	let room: RoutingTestRoom;
	let other: RoutingTestRoom;
	let device: SimulatorDeviceEntity;
	let channel: SimulatorChannelEntity;
	let property: SimulatorChannelPropertyEntity;
	let recalculate: jest.Mock;

	beforeEach(async () => {
		database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				PageEntity,
				DisplayEntity,
				SpaceEntity,
				RoutingTestRoom,
				DeviceEntity,
				ChannelEntity,
				ChannelPropertyEntity,
				DeviceControlEntity,
				ChannelControlEntity,
				DeviceZoneEntity,
				SimulatorDeviceEntity,
				SimulatorChannelEntity,
				SimulatorChannelPropertyEntity,
			],
		}).initialize();
		room = await database.getRepository(RoutingTestRoom).save({ name: 'Original room' });
		other = await database.getRepository(RoutingTestRoom).save({ name: 'Other room' });
		device = await database.getRepository(SimulatorDeviceEntity).save({
			name: 'Light',
			category: DeviceCategory.LIGHTING,
			roomId: room.id,
		});
		channel = await database.getRepository(SimulatorChannelEntity).save({
			device,
			name: 'Light',
			category: channelCategory,
		});
		property = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel,
			category: propertyCategory,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		const calculators = {
			lighting: jest.fn().mockResolvedValue(null),
			climate: jest.fn().mockResolvedValue(null),
			sensor: jest.fn().mockResolvedValue(null),
		};
		recalculate = calculators[domain];
		module = await Test.createTestingModule({
			imports: [EventEmitterModule.forRoot()],
			providers: [
				SpaceLightingStateListener,
				SpaceClimateStateListener,
				SpaceSensorStateListener,
				PropertyMetadataService,
				{ provide: DataSource, useValue: database },
				{ provide: ConfigService, useValue: new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }) },
				{ provide: SpaceLightingStateService, useValue: { getLightingState: calculators.lighting } },
				{ provide: SpaceClimateStateService, useValue: { getClimateState: calculators.climate } },
				{ provide: SpaceSensorStateService, useValue: { getSensorState: calculators.sensor } },
			],
		}).compile();
		await module.init();
		events = module.get(EventEmitter2);
		metadata = module.get(PropertyMetadataService);
		jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
	});

	afterEach(async () => {
		await module?.close();
		jest.useRealTimers();
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
	});

	const emit = async (event = EventType.CHANNEL_PROPERTY_VALUE_SET): Promise<void> => {
		await events.emitAsync(event, property);
	};
	const flush = async (): Promise<void> => {
		await jest.advanceTimersByTimeAsync(110);
	};
	const expectRoom = (id: string): void => {
		expect(recalculate).toHaveBeenCalledTimes(1);
		if (domain === 'lighting') {
			expect(recalculate).toHaveBeenCalledWith(id, { synchronizeModeValidity: false });
		} else {
			expect(recalculate).toHaveBeenCalledWith(id);
		}
	};

	it('routes repeated value and metadata events without SQL after warmup and coalesces the room calculation', async () => {
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		for (let i = 0; i < 10; i++) {
			await emit();
			await emit(EventType.CHANNEL_PROPERTY_UPDATED);
		}
		expect(recalculate).not.toHaveBeenCalled();
		await flush();
		expectRoom(room.id);
		expect(query).not.toHaveBeenCalled();
	});

	it('routes a stale event to the current room after a device move, then resumes zero-SQL routing', async () => {
		await database.getRepository(SimulatorDeviceEntity).update(device.id, { roomId: other.id });
		await emit();
		await flush();
		expectRoom(other.id);
		recalculate.mockClear();
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		await emit();
		await flush();
		expectRoom(other.id);
		expect(query).not.toHaveBeenCalled();
	});

	it('uses the current property mapping instead of the old channel in the event', async () => {
		const replacementDevice = await database.getRepository(SimulatorDeviceEntity).save({
			name: 'Replacement',
			category: DeviceCategory.LIGHTING,
			roomId: other.id,
		});
		const replacementChannel = await database.getRepository(SimulatorChannelEntity).save({
			device: replacementDevice,
			name: 'Replacement',
			category: channelCategory,
		});
		await database.getRepository(SimulatorChannelPropertyEntity).update(property.id, { channel: replacementChannel });
		await emit();
		await flush();
		expectRoom(other.id);
	});

	it('ignores a now unrelated channel category and an unassigned device', async () => {
		await database.getRepository(SimulatorChannelEntity).update(channel.id, { category: ChannelCategory.GENERIC });
		await emit();
		await flush();
		expect(recalculate).not.toHaveBeenCalled();
		await database.getRepository(SimulatorChannelEntity).update(channel.id, { category: channelCategory });
		await database.getRepository(SimulatorDeviceEntity).update(device.id, { roomId: null });
		await emit();
		await flush();
		expect(recalculate).not.toHaveBeenCalled();
	});

	it('ignores a deleted property even though its old channel still exists', async () => {
		await database.getRepository(SimulatorChannelPropertyEntity).delete(property.id);
		await emit();
		await flush();
		expect(recalculate).not.toHaveBeenCalled();
	});

	it.each(['commitTransaction', 'rollbackTransaction'] as const)(
		'reloads membership after outer rollback following an inner %s',
		async (settleInner) => {
			const runner = database.createQueryRunner();
			await runner.startTransaction();
			try {
				await runner.manager.update(SimulatorDeviceEntity, device.id, { roomId: other.id });
				await runner.startTransaction();
				await runner[settleInner]();
				await metadata.findOne(property.id);
			} finally {
				await runner.rollbackTransaction();
			}
			await emit();
			await flush();
			expectRoom(room.id);
		},
	);

	it('bypasses local metadata for independent writers when shared-writer mode is enabled', async () => {
		metadata.onModuleDestroy();
		const shared = new PropertyMetadataService(database, new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: true }));
		jest.spyOn(metadata, 'findOne').mockImplementation((id) => shared.findOne(id));
		try {
			await emit();
			await flush();
			expectRoom(room.id);
			recalculate.mockClear();
			// Deliberately bypass mutation hooks, like another backend process would.
			await database
				.createQueryBuilder()
				.update(SimulatorDeviceEntity)
				.set({ roomId: other.id })
				.where('id = :id', { id: device.id })
				.callListeners(false)
				.execute();
			const query = jest.spyOn(database.createQueryRunner(), 'query');
			await emit();
			await flush();
			expectRoom(other.id);
			expect(query).toHaveBeenCalled();
		} finally {
			shared.onModuleDestroy();
		}
	});

	it('accepts minimal events without a channel relation and ignores missing property IDs', async () => {
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, { id: property.id, category: propertyCategory });
		await flush();
		expectRoom(room.id);
		recalculate.mockClear();
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, { category: propertyCategory });
		await flush();
		expect(recalculate).not.toHaveBeenCalled();
	});

	it('does not schedule a calculation on metadata lookup failure and retries on the next event', async () => {
		const lookup = jest.spyOn(metadata, 'findOne').mockRejectedValue(new Error('catalog unavailable'));
		await expect(emit()).resolves.toBeUndefined();
		await flush();
		expect(recalculate).not.toHaveBeenCalled();
		lookup.mockRestore();
		await emit();
		await flush();
		expectRoom(room.id);
	});

	it('cancels scheduled room work on shutdown', async () => {
		await emit();
		await module.close();
		await flush();
		expect(recalculate).not.toHaveBeenCalled();
	});
});
