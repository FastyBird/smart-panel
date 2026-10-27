import { randomUUID } from 'node:crypto';
import { QueryRunner } from 'typeorm';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource, createSqliteDataSource } from '../../../common/database/sqlite-data-source';
import { CreateSimulatorChannelDto } from '../../../plugins/simulator/dto/create-channel.dto';
import { UpdateSimulatorChannelDto } from '../../../plugins/simulator/dto/update-channel.dto';
import {
	SimulatorChannelEntity,
	SimulatorChannelPropertyEntity,
	SimulatorDeviceEntity,
} from '../../../plugins/simulator/entities/simulator.entity';
import { SpaceEntity } from '../../spaces/entities/space.entity';
import { ChannelCategory, EventType } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import { DeviceZoneEntity } from '../entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../entities/devices.entity';
import { ChannelEntitySubscriber } from '../subscribers/channel-entity.subscriber';

import { ChannelTypeMapping, ChannelsTypeMapperService } from './channels-type-mapper.service';
import { ChannelsControlsService } from './channels.controls.service';
import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

function deferred() {
	let resolve: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve: () => resolve() };
}

describe('ChannelsService consumed SQLite writer admission', () => {
	let source: SqliteDataSource;
	let service: ChannelsService;
	let lock: DeviceStructureLockService;
	let mapping: ChannelTypeMapping<SimulatorChannelEntity, CreateSimulatorChannelDto, UpdateSimulatorChannelDto>;
	let channel: SimulatorChannelEntity, parent: SimulatorChannelEntity, device: SimulatorDeviceEntity;
	let events: EventEmitter2;
	let emit: jest.SpyInstance;
	let sql: string[];

	beforeEach(async () => {
		source = await createSqliteDataSource({
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
		});
		new ChannelEntitySubscriber(source);
		device = await source.getRepository(SimulatorDeviceEntity).save({ name: 'original device' });
		channel = await source
			.getRepository(SimulatorChannelEntity)
			.save({ device, name: 'target', category: ChannelCategory.GENERIC, updatedAt: new Date(2000) });
		parent = await source
			.getRepository(SimulatorChannelEntity)
			.save({ device, name: 'parent', category: ChannelCategory.GENERIC });
		const mapper = new ChannelsTypeMapperService();
		mapping = {
			type: 'simulator',
			class: SimulatorChannelEntity,
			createDto: CreateSimulatorChannelDto,
			updateDto: UpdateSimulatorChannelDto,
		};
		mapper.registerMapping(mapping);
		lock = new DeviceStructureLockService();
		events = new EventEmitter2();
		emit = jest.spyOn(events, 'emit');
		service = new ChannelsService(
			source.getRepository(ChannelEntity),
			mapper,
			{} as ChannelsPropertiesService,
			{} as ChannelsControlsService,
			lock,
			source,
			events,
		);
		sql = [];
		source.subscribers.push({
			beforeQuery: (event) => {
				sql.push(event.query);
			},
		});
	});

	afterEach(async () => {
		jest.restoreAllMocks();
		if (source.isInitialized) await source.destroy();
	});

	const patch = (fields: Partial<UpdateSimulatorChannelDto> = {}) =>
		service.update(channel.id, { type: 'simulator', ...fields });
	const transactions = () => sql.filter((query) => /^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)/.test(query));

	it('uses the same reserved runner/native manager for full re-read, root hook query and listener save', async () => {
		let runner: QueryRunner;
		const native = (source.driver as SqliteDriver).databaseConnection as unknown;
		source.subscribers.push({
			afterTransactionStart(event) {
				runner = event.queryRunner;
			},
			async beforeUpdate(event) {
				expect(event.manager.queryRunner).toBe(runner);
				expect(Object.getPrototypeOf(await event.queryRunner.connect())).toBe(Object.getPrototypeOf(native));
				await event.manager.findBy(ChannelPropertyEntity, { channel: { id: channel.id } });
			},
		});
		mapping.beforeUpdate = async (current, previous) => {
			expect(lock.hasCurrentStructuralLease()).toBe(true);
			expect(source.createQueryRunner()).toBe(runner);
			expect(current).toMatchObject({ properties: [], controls: [], device: { id: device.id } });
			expect(previous.name).toBe('target');
			await source.getRepository(ChannelEntity).findOneByOrFail({ id: parent.id });
		};
		const read = jest.spyOn(service, 'getOneOrThrow');
		const result = await patch({ parent: parent.id, name: 'changed' });
		expect(result).toMatchObject({ id: channel.id, parentId: parent.id, name: 'changed' });
		expect(
			result.updatedAt instanceof Date ? result.updatedAt.getTime() : Date.parse(result.updatedAt),
		).toBeGreaterThan(2000);
		expect(read.mock.calls[1][1].queryRunner).toBe(runner);
		expect(transactions()).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'COMMIT']);
		expect(emit).toHaveBeenCalledWith(EventType.CHANNEL_UPDATED, result);
	});

	it.each(['omitted', 'null'] as const)('preserves %s parent semantics', async (kind) => {
		await source.getRepository(SimulatorChannelEntity).update(channel.id, { parentId: parent.id });
		const result = await patch(kind === 'null' ? { parent: null } : { name: 'renamed' });
		expect(result.parentId).toBe(kind === 'null' ? null : parent.id);
	});

	it.each(['missing', 'foreign', 'self', 'cycle'] as const)('rejects %s hierarchy after reservation', async (kind) => {
		let selected = parent.id;
		if (kind === 'missing') selected = randomUUID();
		if (kind === 'self') selected = channel.id;
		if (kind === 'foreign') {
			const foreign = await source.getRepository(SimulatorDeviceEntity).save({ name: 'foreign' });
			await source.getRepository(SimulatorChannelEntity).update(parent.id, { device: foreign });
		}
		if (kind === 'cycle')
			await source.getRepository(SimulatorChannelEntity).update(parent.id, { parentId: channel.id });
		sql.length = 0;
		await expect(patch({ parent: selected })).rejects.toBeInstanceOf(DevicesValidationException);
		expect(transactions()).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'ROLLBACK']);
		expect(
			(await source.getRepository(SimulatorChannelEntity).findOneByOrFail({ id: channel.id })).parentId,
		).toBeNull();
		expect(emit).not.toHaveBeenCalled();
	});

	it.each(['delete', 'membership'] as const)(
		'uses current %s after waiting for the structure ticket',
		async (change) => {
			const entered = deferred(),
				release = deferred();
			const holder = lock.runExclusive(async () => {
				entered.resolve();
				await release.promise;
			});
			await entered.promise;
			const preliminary = deferred();
			const original = service.getOneOrThrow.bind(service) as ChannelsService['getOneOrThrow'];
			jest.spyOn(service, 'getOneOrThrow').mockImplementationOnce(async (id) => {
				const row = await original(id);
				preliminary.resolve();
				return row;
			});
			const pending = patch({ parent: parent.id });
			try {
				await preliminary.promise;
				if (change === 'delete') await source.getRepository(SimulatorChannelEntity).delete(channel.id);
				else {
					const foreign = await source.getRepository(SimulatorDeviceEntity).save({ name: 'new membership' });
					await source.getRepository(SimulatorChannelEntity).update(channel.id, { device: foreign });
				}
			} finally {
				release.resolve();
				await holder;
			}
			await expect(pending).rejects.toThrow(change === 'delete' ? 'Channel does not exist' : 'same device');
			if (change === 'delete')
				expect(await source.getRepository(SimulatorChannelEntity).countBy({ id: channel.id })).toBe(0);
		},
	);

	it('reserves a no-op without candidate DML or update event', async () => {
		const before = jest.fn(),
			after = jest.fn();
		source.subscribers.push({ beforeTransactionStart: before, afterTransactionStart: after });
		await patch({ name: channel.name });
		expect(transactions()).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'COMMIT']);
		expect(before).toHaveBeenCalledTimes(1);
		expect(after).toHaveBeenCalledTimes(1);
		expect(sql.some((query) => /^(INSERT|UPDATE|DELETE)/.test(query))).toBe(false);
		expect(emit).not.toHaveBeenCalled();
	});

	it('rolls back exact mapping refusal without channel event', async () => {
		const cause = new DevicesValidationException('category is reserved');
		mapping.beforeUpdate = () => Promise.reject(cause);
		await expect(patch({ name: 'refused' })).rejects.toBe(cause);
		expect(transactions()).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'ROLLBACK']);
		expect(emit).not.toHaveBeenCalled();
		expect((await source.getRepository(SimulatorChannelEntity).findOneByOrFail({ id: channel.id })).name).toBe(
			'target',
		);
	});

	it('allows process-only Homey-like nesting and retains borrowed parent rollback', async () => {
		await lock.runExclusive(() => patch({ name: 'process nested' }));
		expect(transactions()).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'COMMIT']);
		sql.length = 0;
		const cause = new Error('outer rollback');
		await expect(
			lock.runExclusive(() =>
				source.transaction(async (manager) => {
					await patch({ name: 'borrowed' });
					expect(manager.queryRunner.isTransactionActive).toBe(true);
					expect(transactions()).toEqual(['BEGIN TRANSACTION']);
					throw cause;
				}),
			),
		).rejects.toBe(cause);
		expect(transactions()).toEqual(['BEGIN TRANSACTION', 'ROLLBACK']);
		expect((await service.getOneOrThrow(channel.id)).name).toBe('process nested');
	});

	it.each(['absent', 'shared', 'retiring'] as const)(
		'refuses unsafe ambient lease with %s structure owner before queue entry',
		async (mode) => {
			const invoke = async () => {
				const queue = jest.spyOn(lock, 'runExclusive');
				if (mode === 'retiring') {
					const context = Reflect.get(lock, 'context') as { getStore(): { accepting: boolean } };
					context.getStore().accepting = false;
				}
				await source.transaction(async () => {
					await expect(patch()).rejects.toThrow('accepting exclusive structure owner');
					expect(queue).not.toHaveBeenCalled();
				});
			};
			if (mode === 'shared') await lock.runShared(invoke);
			else if (mode === 'retiring') await lock.runExclusive(invoke);
			else await invoke();
		},
	);

	it.each([false, true])('keeps final read and afterUpdate outside inner lock, after hook fails=%s', async (fails) => {
		const cause = new Error('after update');
		mapping.afterUpdate = async (current) => {
			expect(lock.hasCurrentStructuralLease()).toBe(false);
			expect(transactions()).toEqual(['BEGIN IMMEDIATE TRANSACTION', 'COMMIT']);
			if (fails) throw cause;
			await source.getRepository(SimulatorChannelEntity).update(current.id, { name: 'after hook' });
			return current;
		};
		if (fails) {
			await expect(patch({ name: 'committed' })).rejects.toBe(cause);
			expect(emit).not.toHaveBeenCalled();
		} else {
			const result = await patch({ name: 'committed' });
			expect(result.name).toBe('after hook');
			expect(emit).toHaveBeenCalledWith(EventType.CHANNEL_UPDATED, result);
		}
	});
});
