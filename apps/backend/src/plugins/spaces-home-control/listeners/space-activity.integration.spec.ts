import { instanceToPlain } from 'class-transformer';
import { ChildEntity, DataSource } from 'typeorm';

import { ConfigService } from '@nestjs/config';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

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
import { SpacesModuleResetService } from '../../../modules/spaces/services/module-reset.service';
import { SpaceActivityService } from '../../../modules/spaces/services/space-activity.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SpaceType } from '../../../modules/spaces/spaces.constants';
import { SpaceActivitySubscriber } from '../../../modules/spaces/subscribers/space-activity.subscriber';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../simulator/entities/simulator.entity';

import { SpaceActivityListener } from './space-activity.listener';

@ChildEntity(SpaceType.ROOM)
class ActivityTestRoom extends SpaceEntity {
	get type(): SpaceType {
		return SpaceType.ROOM;
	}
}

describe('Space activity through real events and SQLite', () => {
	let database: DataSource;
	let module: TestingModule;
	let events: EventEmitter2;
	let activity: SpaceActivityService;
	let metadata: PropertyMetadataService;
	let room: ActivityTestRoom;
	let other: ActivityTestRoom;
	let device: SimulatorDeviceEntity;
	let property: SimulatorChannelPropertyEntity;
	const legacy = new Date('2020-01-01T00:00:00Z');

	beforeEach(async () => {
		database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [
				PageEntity,
				DisplayEntity,
				SpaceEntity,
				ActivityTestRoom,
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
		room = await database.getRepository(ActivityTestRoom).save({ name: 'Original room', lastActivityAt: legacy });
		other = await database.getRepository(ActivityTestRoom).save({ name: 'Other room' });
		device = await database.getRepository(SimulatorDeviceEntity).save({
			name: 'Light',
			category: DeviceCategory.LIGHTING,
			roomId: room.id,
		});
		const channel = await database.getRepository(SimulatorChannelEntity).save({
			device,
			name: 'Light',
			category: ChannelCategory.LIGHT,
		});
		property = await database.getRepository(SimulatorChannelPropertyEntity).save({
			channel,
			category: PropertyCategory.ON,
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
		});
		module = await Test.createTestingModule({
			imports: [EventEmitterModule.forRoot()],
			providers: [
				SpaceActivityService,
				SpaceActivitySubscriber,
				SpaceActivityListener,
				PropertyMetadataService,
				SpacesModuleResetService,
				{ provide: DataSource, useValue: database },
				{ provide: ConfigService, useValue: new ConfigService({ FB_PROPERTY_VALUE_LOCKS_ENABLED: false }) },
				{ provide: getRepositoryToken(SpaceEntity), useValue: database.getRepository(SpaceEntity) },
				{ provide: getRepositoryToken(ChannelEntity), useValue: database.getRepository(ChannelEntity) },
			],
		}).compile();
		await module.init();
		events = module.get(EventEmitter2);
		activity = module.get(SpaceActivityService);
		metadata = module.get(PropertyMetadataService);
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		await module?.close();
		if (database?.isInitialized) await database.destroy();
	});

	it('delivers both property events with no warm-path SQL, while API serialization exposes runtime activity', async () => {
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		for (let i = 0; i < 10; i++) {
			await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
			await events.emitAsync(EventType.CHANNEL_PROPERTY_UPDATED, property);
		}
		expect(query).not.toHaveBeenCalled();
		const loaded = await database.getRepository(SpaceEntity).findOneByOrFail({ id: room.id });
		expect(loaded.lastActivityAt).toBeInstanceOf(Date);
		expect((loaded.lastActivityAt as Date).getTime()).toBeGreaterThan(legacy.getTime());
		expect(instanceToPlain(loaded).last_activity_at).toBe((loaded.lastActivityAt as Date).toISOString());
		const raw = await database
			.getRepository(SpaceEntity)
			.createQueryBuilder('space')
			.select('space.lastActivityAt', 'activity')
			.where('space.id = :id', { id: room.id })
			.getRawOne<{ activity: string }>();
		expect(new Date(raw.activity.replace(' ', 'T') + 'Z')).toEqual(legacy);
		activity.onModuleDestroy();
		expect((await database.getRepository(SpaceEntity).findOneByOrFail({ id: room.id })).lastActivityAt).toEqual(legacy);
	});

	it('uses fresh room membership after a device move, even when the event carries the old relation', async () => {
		await database.getRepository(SimulatorDeviceEntity).update(device.id, { roomId: other.id });
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect(activity.readLatest(room)).toEqual(legacy);
		expect(activity.readLatest(other)).toBeInstanceOf(Date);
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect(query).not.toHaveBeenCalled();
	});

	it('invalidates metadata loaded inside a rolled-back move and ignores deleted properties', async () => {
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.manager.update(SimulatorDeviceEntity, device.id, { roomId: other.id });
		await metadata.findOne(property.id);
		await runner.rollbackTransaction();
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect(activity.readLatest(room)).not.toEqual(legacy);
		expect(activity.readLatest(other)).toBeNull();
		activity.clear();
		await database.getRepository(SimulatorChannelPropertyEntity).delete(property.id);
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect(activity.readLatest(room)).toEqual(legacy);
	});

	it('preserves activity on rolled-back deletion and removes it after a committed deletion', async () => {
		const at = new Date();
		activity.record(other.id, at);
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.manager.remove(await runner.manager.findOneByOrFail(ActivityTestRoom, { id: other.id }));
		await runner.rollbackTransaction();
		expect(activity.readLatest(other)).toEqual(at);
		await database
			.getRepository(ActivityTestRoom)
			.remove(await database.getRepository(ActivityTestRoom).findOneByOrFail({ id: other.id }));
		expect(activity.readLatest(other)).toBeNull();
	});

	it('does not clear a savepoint deletion when its outer transaction rolls back', async () => {
		const at = new Date();
		activity.record(other.id, at);
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.startTransaction();
		await runner.manager.delete(ActivityTestRoom, other.id);
		await runner.commitTransaction();
		expect(activity.readLatest(other)).toEqual(at);
		await runner.rollbackTransaction();
		expect(activity.readLatest(other)).toEqual(at);
	});

	it('keeps outer deletion cleanup when an inner savepoint rolls back', async () => {
		activity.record(room.id, new Date());
		activity.record(other.id, new Date());
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.manager.remove(await runner.manager.findOneByOrFail(ActivityTestRoom, { id: other.id }));
		await runner.startTransaction();
		await runner.manager.delete(ActivityTestRoom, room.id);
		await runner.rollbackTransaction();
		await runner.commitTransaction();
		expect(activity.readLatest(other)).toBeNull();
		expect(activity.readLatest(room)).not.toEqual(legacy);
	});

	it('clears unknown bulk deletions conservatively, only after commit', async () => {
		activity.record(room.id, new Date());
		activity.record(other.id, new Date());
		const runner = database.createQueryRunner();
		await runner.startTransaction();
		await runner.manager.delete(ActivityTestRoom, other.id);
		expect(activity.readLatest(other)).toBeInstanceOf(Date);
		await runner.commitTransaction();
		expect(activity.readLatest(other)).toBeNull();
		expect(activity.readLatest(room)).toEqual(legacy);
	});

	it('clears activity after a successful factory reset but preserves it if the reset fails', async () => {
		activity.record(other.id, new Date());
		const repository = database.getRepository(SpaceEntity);
		const generation = activity.getGeneration();
		const clear = jest.spyOn(repository, 'clear').mockRejectedValueOnce(new Error('reset failed'));
		expect(await module.get(SpacesModuleResetService).reset()).toEqual({ success: false, reason: 'reset failed' });
		expect(activity.readLatest(other)).toBeInstanceOf(Date);
		expect(activity.getGeneration()).toBe(generation);
		const query = jest.spyOn(database.createQueryRunner(), 'query');
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect(query).not.toHaveBeenCalled();
		expect(activity.readLatest(room)).not.toEqual(legacy);
		clear.mockRestore();
		expect(await module.get(SpacesModuleResetService).reset()).toEqual({ success: true });
		expect(activity.readLatest(other)).toBeNull();
	});

	it('does not restore pre-reset membership when a removed space UUID is reused', async () => {
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect(await module.get(SpacesModuleResetService).reset()).toEqual({ success: true });
		expect((await database.getRepository(SimulatorDeviceEntity).findOneByOrFail({ id: device.id })).roomId).toBeNull();
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		await database.getRepository(ActivityTestRoom).save({ id: room.id, name: 'Recreated room' });
		expect((await database.getRepository(ActivityTestRoom).findOneByOrFail({ id: room.id })).lastActivityAt).toBeNull();
	});

	it('discards a report whose metadata callback finishes after reset', async () => {
		const stale = await metadata.findOne(property.id);
		let finish!: (value: ChannelPropertyEntity | null) => void;
		jest.spyOn(metadata, 'findOne').mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const report = events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect(finish).toBeDefined();
		try {
			expect(await module.get(SpacesModuleResetService).reset()).toEqual({ success: true });
			await database.getRepository(ActivityTestRoom).save({ id: room.id, name: 'Recreated room' });
		} finally {
			finish(stale);
			await report;
		}
		expect((await database.getRepository(ActivityTestRoom).findOneByOrFail({ id: room.id })).lastActivityAt).toBeNull();
	});

	it('keeps a pending report for another room when one space is deleted', async () => {
		const current = await metadata.findOne(property.id);
		let finish!: (value: ChannelPropertyEntity | null) => void;
		jest.spyOn(metadata, 'findOne').mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const report = events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		try {
			await database.getRepository(ActivityTestRoom).remove(other);
		} finally {
			finish(current);
			await report;
		}
		expect(activity.readLatest(room)).not.toEqual(legacy);
	});

	it('invalidates room membership through the production SpacesService.remove path', async () => {
		// Removal uses real repositories/transactions; unrelated command and type-mapping collaborators are unused.
		const spaces = new SpacesService(
			database.getRepository(SpaceEntity),
			database.getRepository(DeviceEntity),
			database.getRepository(DisplayEntity),
			null as never,
			null as never,
			null as never,
			null as never,
			database,
			events,
			null as never,
		);
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		await spaces.remove(room.id);
		expect((await database.getRepository(SimulatorDeviceEntity).findOneByOrFail({ id: device.id })).roomId).toBeNull();
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		await database.getRepository(ActivityTestRoom).save({ id: room.id, name: 'Recreated room' });
		await events.emitAsync(EventType.CHANNEL_PROPERTY_VALUE_SET, property);
		expect((await database.getRepository(ActivityTestRoom).findOneByOrFail({ id: room.id })).lastActivityAt).toBeNull();
	});
});
