import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EntityManager, EntitySubscriberInterface } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../../../plugins/devices-virtual/entities/devices-virtual.entity';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	EventType,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';

import { ChannelsPropertiesService } from './channels.properties.service';
import { DeviceStructureLockService } from './device-structure-lock.service';

const gate = () => {
	let release: () => void;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, release: () => release() };
};

describe('standalone SQLite property removal writer admission', () => {
	let directory: string;
	let first: SqliteDataSource;
	let second: SqliteDataSource;
	let service: ChannelsPropertiesService;
	let events: EventEmitter2;
	let propertyId: string;
	let deviceId: string;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'property-remove-admission-'));
		const options = {
			type: 'sqlite' as const,
			database: join(directory, 'test.sqlite'),
			entities: [__dirname + '/../../../**/*.entity.ts'],
		};
		first = await new SqliteDataSource({ ...options, synchronize: true }).initialize();
		second = await new SqliteDataSource(options).initialize();
		deviceId = uuid();
		const channelId = uuid();
		propertyId = uuid();
		await first.manager.insert(VirtualDeviceEntity, {
			id: deviceId,
			name: 'Original device',
			category: DeviceCategory.GENERIC,
			enabled: true,
			mode: VirtualDeviceMode.PROJECTION,
		});
		await first.manager.insert(VirtualChannelEntity, {
			id: channelId,
			device: deviceId,
			name: 'Information',
			category: ChannelCategory.DEVICE_INFORMATION,
		} as never);
		await first.manager.insert(VirtualChannelPropertyEntity, {
			id: propertyId,
			channel: channelId,
			category: PropertyCategory.MANUFACTURER,
			dataType: DataTypeType.STRING,
			permissions: [PermissionType.READ_ONLY],
			valueOrigin: VirtualValueOrigin.LOCAL,
		} as never);
		events = new EventEmitter2();
		service = Object.create(ChannelsPropertiesService.prototype) as ChannelsPropertiesService;
		Object.defineProperties(service, {
			dataSource: { value: second },
			structureLock: { value: new DeviceStructureLockService() },
			propertyCommandWindowService: { value: { cancel: jest.fn() } },
			valueSourceRegistry: { value: { resolve: (property: { id: string }) => property.id } },
			eventEmitter: { value: events },
			logger: { value: { log: jest.fn(), warn: jest.fn() } },
		});
	});

	afterEach(async () => {
		if (second?.isInitialized) await second.destroy();
		if (first?.isInitialized) await first.destroy();
		if (directory) await rm(directory, { recursive: true, force: true });
	});

	it('reserves its writer before subscriber reads and emits deletion only after COMMIT', async () => {
		const ready = gate(),
			release = gate();
		const facts: string[] = [];
		const readBeforeRemove: EntitySubscriberInterface = {
			async beforeRemove(event) {
				if (!(event.entity instanceof VirtualChannelPropertyEntity)) return;
				expect(event.queryRunner.isTransactionActive).toBe(true);
				await event.manager.query('SELECT id FROM devices_module_channels_properties WHERE id = ?', [propertyId]);
				facts.push('B:subscriber-read');
			},
			beforeQuery(event) {
				if (event.query === 'BEGIN IMMEDIATE TRANSACTION') {
					facts.push('B:writer-submit');
					release.release();
				}
			},
			afterQuery(event) {
				if (event.success && event.query === 'BEGIN IMMEDIATE TRANSACTION') facts.push('B:writer-ack');
				if (event.success && event.query === 'COMMIT') facts.push('B:commit');
			},
		};
		second.subscribers.push(readBeforeRemove);
		first.subscribers.push({
			afterQuery(event) {
				if (event.success && event.query === 'COMMIT') facts.push('A:commit');
			},
		});
		const emitted: unknown[] = [];
		events.on(EventType.CHANNEL_PROPERTY_DELETED, (property: { id: string }) => {
			expect(facts).toContain('B:commit');
			emitted.push(property);
		});
		const writer = first.transaction(async (manager) => {
			await manager.query('UPDATE devices_module_devices SET name = ? WHERE id = ?', ['Independent writer', deviceId]);
			ready.release();
			await release.promise;
		});
		// Attach rejection custody immediately while the original native operation is held.
		void writer.catch(() => undefined);
		await ready.promise;
		const removal = service.remove(propertyId);
		try {
			await removal;
			await writer;
			expect(facts).toEqual(['B:writer-submit', 'A:commit', 'B:writer-ack', 'B:subscriber-read', 'B:commit']);
			expect(emitted).toHaveLength(1);
			expect(emitted[0]).toMatchObject({ id: propertyId });
			expect(await second.manager.countBy(VirtualChannelPropertyEntity, { id: propertyId })).toBe(0);
			expect(await first.manager.findOneByOrFail(VirtualDeviceEntity, { id: deviceId })).toMatchObject({
				name: 'Independent writer',
			});
		} finally {
			release.release();
			await Promise.allSettled([writer, removal]);
		}
	});

	it('keeps an explicitly borrowed manager and its outer rollback', async () => {
		const freshAdmission = jest.spyOn(second, 'transactionWithWriteIntent');
		const managers: EntityManager[] = [];
		second.subscribers.push({
			beforeRemove(event) {
				managers.push(event.manager);
			},
		});
		const rollback = new Error('original outer rollback');
		let original: EntityManager;
		await expect(
			second.transaction(async (manager) => {
				original = manager;
				await service.remove(propertyId, manager);
				expect(await manager.countBy(VirtualChannelPropertyEntity, { id: propertyId })).toBe(0);
				throw rollback;
			}),
		).rejects.toBe(rollback);
		expect(freshAdmission).not.toHaveBeenCalled();
		expect(managers).toEqual([original]);
		expect(await second.manager.countBy(VirtualChannelPropertyEntity, { id: propertyId })).toBe(1);
	});
});
