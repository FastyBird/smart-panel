import { DataSource } from 'typeorm';

import { SqliteDataSource, createSqliteDataSource } from '../../../common/database/sqlite-data-source';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
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
});
