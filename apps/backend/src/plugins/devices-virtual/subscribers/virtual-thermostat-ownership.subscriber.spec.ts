import { DataSource } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource, createSqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { PropertyCommandAdmissionRegistryService } from '../../../modules/devices/services/property-command-admission.registry.service';
import { VirtualDependencyGraphService } from '../services/virtual-dependency-graph.service';
import { VirtualThermostatClaimsService } from '../services/virtual-thermostat-claims.service';

import { VirtualThermostatOwnershipSubscriber } from './virtual-thermostat-ownership.subscriber';

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve: () => resolve() };
};

describe('thermostat ownership persistence boundaries (real SQLite)', () => {
	let database: SqliteDataSource;
	let lock: DeviceStructureLockService;
	let refresh: jest.Mock;
	let invalidate: jest.Mock;

	beforeEach(async () => {
		database = await createSqliteDataSource({ type: 'sqlite', database: ':memory:' });
		await database.query('CREATE TABLE devices_module_devices (id INTEGER PRIMARY KEY)');
		lock = new DeviceStructureLockService();
		refresh = jest.fn(() => lock.runShared(async () => void (await database.query('SELECT 1'))));
		invalidate = jest.fn();
		const subscriber = new VirtualThermostatOwnershipSubscriber(
			database as DataSource,
			{
				refresh,
				invalidate,
				isQualifiedReleaseWrite: () => false,
				revokeAllQualifications: jest.fn(),
			} as unknown as VirtualThermostatClaimsService,
		);
		(subscriber as unknown as { installed: boolean }).installed = true;
	});

	afterEach(async () => {
		await database.destroy();
	});

	it('lets a read-only snapshot commit while a structural writer holds its lock and waits for SQLite', async () => {
		const snapshotRead = deferred();
		const writerStarted = deferred();
		const snapshot = database.transaction(async (manager) => {
			await manager.query('SELECT 1');
			snapshotRead.resolve();
			await writerStarted.promise;
		});
		await snapshotRead.promise;
		const writer = lock.runExclusive(async () => {
			writerStarted.resolve();
			await database.query('SELECT 2');
		});
		await Promise.all([snapshot, writer]);
		expect(refresh).not.toHaveBeenCalled();
		expect(invalidate).not.toHaveBeenCalled();
	});

	it.each(['commit', 'rollback'] as const)(
		'reconciles catalog writes only at outer %s, including inner rollback',
		async (boundary) => {
			await lock.runExclusive(async () => {
				const operation = database.transaction(async (manager) => {
					await expect(
						manager.transaction(async (nested) => {
							await nested.query('INSERT INTO devices_module_devices (id) VALUES (1)');
							throw new Error('inner rollback');
						}),
					).rejects.toThrow('inner rollback');
					expect(refresh).not.toHaveBeenCalled();
					if (boundary === 'rollback') throw new Error('outer rollback');
				});
				if (boundary === 'rollback') await expect(operation).rejects.toThrow('outer rollback');
				else await operation;
			});
			expect(invalidate).toHaveBeenCalledTimes(1);
			expect(refresh).toHaveBeenCalledTimes(1);
			await database.transaction(async (manager) => void (await manager.query('SELECT 1')));
			expect(refresh).toHaveBeenCalledTimes(1);
		},
	);

	it('reconciles autocommit writes and failed catalog SQL after synchronous invalidation', async () => {
		await database.query('INSERT INTO devices_module_devices (id) VALUES (1)');
		await expect(database.query('INSERT INTO devices_module_devices (id) VALUES (1)')).rejects.toThrow();
		expect(invalidate).toHaveBeenCalledTimes(2);
		expect(refresh).toHaveBeenCalledTimes(2);
	});

	it.each(['settings', 'slot', 'rollback', 'new claim', 'catalog', 'release'])(
		'checks an existing light command against the committed reservation after %s SQL',
		async (change) => {
			await database.query('CREATE TABLE devices_module_climate_automation_slots (id INTEGER PRIMARY KEY)');
			await database.query(
				'CREATE TABLE devices_virtual_thermostat_configs (id INTEGER PRIMARY KEY, revision INTEGER, comfort TEXT, releaseRequestedAt TEXT)',
			);
			await database.query('INSERT INTO devices_virtual_thermostat_configs (id, revision) VALUES (1, 1)');
			await database.query(
				'CREATE TABLE devices_virtual_thermostat_actuator_claims (id TEXT, controllerId TEXT, sourcePropertyIdentity TEXT, physicalIdentity TEXT)',
			);
			const claims = new VirtualThermostatClaimsService(
				{
					manager: { find: () => database.query('SELECT * FROM devices_virtual_thermostat_actuator_claims') },
				} as unknown as DataSource,
				lock,
				{} as VirtualDependencyGraphService,
				new PropertyCommandAdmissionRegistryService(),
				new EventEmitter2(),
			);
			invalidate.mockImplementation((...args: Parameters<typeof claims.invalidate>) => claims.invalidate(...args));
			refresh.mockImplementation(() => claims.refresh());
			const light = {
				device: Object.assign(new DeviceEntity(), { id: 'device' }),
				channel: Object.assign(new ChannelEntity(), { id: 'channel', category: ChannelCategory.LIGHT }),
				property: Object.assign(new ChannelPropertyEntity(), {
					id: 'light',
					category: PropertyCategory.ON,
					dataType: DataTypeType.BOOL,
					permissions: [PermissionType.READ_WRITE],
				}),
				value: true,
			};
			if (change === 'new claim')
				await database.query(`CREATE TRIGGER reserve_light AFTER UPDATE OF comfort ON devices_virtual_thermostat_configs
					BEGIN INSERT INTO devices_virtual_thermostat_actuator_claims VALUES ('claim', 'controller', 'light', 'property:device:channel:light'); END`);
			try {
				await claims.refresh();
				const captured = claims.capture();
				const write = database.transaction(async (manager) => {
					if (change === 'slot') await manager.query('INSERT INTO devices_module_climate_automation_slots VALUES (1)');
					else
						await manager.query(
							'UPDATE "devices_virtual_thermostat_configs" SET "revision" = 2, "comfort" = ? WHERE id = 1',
							['eco'],
						);
					expect(captured.isCurrent(light)).toBe(false);
					await claims.refresh();
					expect(captured.isCurrent(light)).toBe(false);
					if (change === 'catalog') await manager.query('INSERT INTO devices_module_devices VALUES (1)');
					if (change === 'release')
						await manager.query('UPDATE devices_virtual_thermostat_configs SET releaseRequestedAt = ? WHERE id = 1', [
							'now',
						]);
					if (change === 'rollback') throw new Error('rollback');
				});
				if (change === 'rollback') await expect(write).rejects.toThrow('rollback');
				else await write;
				expect(captured.isCurrent()).toBe(false);
				expect(captured.isCurrent(light)).toBe(['settings', 'slot', 'rollback'].includes(change));
				if (change === 'new claim') expect(() => claims.assertAllowed(light)).toThrow('reserved');
				else await expect(claims.assertAllowed(light)).resolves.toBeUndefined();
			} finally {
				claims.onModuleDestroy();
			}
		},
	);
});
