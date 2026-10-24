import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SqliteDriver } from 'typeorm/driver/sqlite/SqliteDriver';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	VirtualChannelEntity,
	VirtualChannelPropertyEntity,
	VirtualDeviceEntity,
	VirtualDeviceMode,
	VirtualValueOrigin,
} from '../entities/devices-virtual.entity';

import { initializeThermostatCreationCatalog, thermostatCreationCatalog } from './thermostat-creation-catalog';

const sourceRoot = path.resolve(__dirname, '../../..');
for (const name of readdirSync(sourceRoot, { recursive: true }) as string[])
	if (/\.(entity|subscriber)\.ts$/.test(name)) jest.requireActual(path.join(sourceRoot, name));
const pause = () => {
	let resolve: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve: () => resolve() };
};

describe('thermostat catalog original reader and finite observations', () => {
	let database: SqliteDataSource;
	let directory: string;
	let root: string, temperature: string, policy: string, reading: string, locked: string;
	const expected = () =>
		thermostatCreationCatalog.expected({
			id: root,
			channels: [
				{ id: temperature, properties: [{ id: reading }] },
				{ id: policy, properties: [{ id: locked }] },
			],
		});
	const ready = () => database.transaction((manager) => initializeThermostatCreationCatalog(manager, true));
	beforeEach(async () => {
		directory = mkdtempSync(path.join(tmpdir(), 'catalog-reader-'));
		database = await new SqliteDataSource({
			type: 'sqlite',
			database: path.join(directory, 'catalog.sqlite'),
			synchronize: true,
			entities: [sourceRoot + '/**/*.entity.ts'],
			subscribers: [sourceRoot + '/**/*.subscriber.ts'],
		}).initialize();
		[root, temperature, policy, reading, locked] = Array.from({ length: 5 }, () => randomUUID());
		await database.manager.insert(VirtualDeviceEntity, {
			id: root,
			name: 'Reader fixture',
			category: DeviceCategory.THERMOSTAT,
			mode: VirtualDeviceMode.CLIMATE_CONTROLLER,
		});
		await database.manager.insert(VirtualChannelEntity, [
			{ id: temperature, name: 'Temperature', category: ChannelCategory.TEMPERATURE, device: root },
			{ id: policy, name: 'Policy', category: ChannelCategory.THERMOSTAT, device: root },
		]);
		await database.manager.insert(VirtualChannelPropertyEntity, [
			{
				id: reading,
				category: PropertyCategory.TEMPERATURE,
				channel: temperature,
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_ONLY],
				valueOrigin: VirtualValueOrigin.LOCAL,
			},
			{
				id: locked,
				category: PropertyCategory.LOCKED,
				channel: policy,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				valueOrigin: VirtualValueOrigin.LOCAL,
			},
		]);
	});
	afterEach(async () => {
		jest.restoreAllMocks();
		if (database?.isInitialized) await database.destroy();
		if (directory) rmSync(directory, { recursive: true, force: true });
	});
	it('captures V0 on the exact original depth-one manager and finals on the original ordinary manager', async () => {
		await ready();
		const query = jest.spyOn(database.manager, 'query');
		const reader = thermostatCreationCatalog.pin(database);
		const original = await database.transaction(async (manager) => {
			expect(manager).not.toBe(database.manager);
			return reader.scoped(manager)(root, expected());
		});
		expect(query).not.toHaveBeenCalled();
		const final = await reader.read(root, expected());
		expect(query).toHaveBeenCalledTimes(1);
		expect(query.mock.calls[0][0]).toMatch(/^WITH root AS/);
		thermostatCreationCatalog.same(final, original);
		expect(Object.isFrozen(original)).toBe(true);
		expect(Object.isFrozen(original.members)).toBe(true);
		expect(new Set(original.members.map(({ birth }) => birth)).size).toBe(5);
	});
	it.each([
		['device', 'devices_module_devices', VirtualChannelEntity.name],
		['channel', 'devices_module_channels', VirtualChannelPropertyEntity.name],
		['property', 'devices_module_channels_properties', VirtualDeviceEntity.name],
		['device', 'devices_module_devices', 'virtual'],
		['channel', 'devices_module_channels', 'virtual'],
		['property', 'devices_module_channels_properties', 'virtual'],
	])(
		'rejects a substituted raw %s discriminator %s/%s after a healthy real ORM observation',
		async (kind, table, substituted) => {
			await ready();
			const reader = thermostatCreationCatalog.pin(database);
			const original = await reader.read(root, expected());
			const id = kind === 'device' ? root : kind === 'channel' ? temperature : reading;
			const before = await database.query<{ type: string; catalogBirth: number }[]>(
				`SELECT type, catalogBirth FROM "${table}" WHERE id = ?`,
				[id],
			);
			// Unsupported raw private storage tamper is a negative fixture, never a qualifying setup.
			await database.query(`UPDATE "${table}" SET type = ? WHERE id = ?`, [substituted, id]);
			await expect(reader.read(root, expected())).rejects.toThrow('catalog identity');
			expect(await database.query(`SELECT catalogBirth FROM "${table}" WHERE id = ?`, [id])).toEqual([
				{ catalogBirth: before[0].catalogBirth },
			]);
			expect(original.members.find((member) => member.id === id).type).toBe('virtual');
		},
	);
	it('rejects an unregistered metadata lookalike rather than accepting a received arbitrary object', async () => {
		await ready();
		const metadata = database.getMetadata(VirtualDeviceEntity);
		jest.spyOn(database, 'getMetadata').mockImplementation(() => Object.create(metadata) as typeof metadata);
		expect(() => thermostatCreationCatalog.pin(database)).toThrow('catalog identity');
	});
	it('expires the original reader when a native discriminator data descriptor changes', async () => {
		await ready();
		const reader = thermostatCreationCatalog.pin(database);
		await reader.read(root, expected());
		const metadata = database.getMetadata(VirtualDeviceEntity);
		const descriptor = Object.getOwnPropertyDescriptor(metadata, 'discriminatorValue');
		try {
			Object.defineProperty(metadata, 'discriminatorValue', { ...descriptor, value: 'virtual' });
			expect(reader.current()).toBe(false);
			await expect(reader.read(root, expected())).rejects.toThrow('catalog identity');
		} finally {
			Object.defineProperty(metadata, 'discriminatorValue', descriptor);
		}
	});
	it('allows ordinary same-birth metadata and graph advances without recapturing the original vector', async () => {
		await ready();
		const reader = thermostatCreationCatalog.pin(database),
			original = await reader.read(root, expected());
		await database.manager.update(VirtualDeviceEntity, { id: root }, { name: 'Healthy latest metadata' });
		await database.query('UPDATE devices_virtual_graph_revision SET revision = 20 WHERE id = 1');
		thermostatCreationCatalog.same(await reader.read(root, expected()), original);
	});
	it('distinguishes an actual ORM remove/create successor at the same UUID and equal stored timestamps (native fixture only)', async () => {
		await ready();
		const reader = thermostatCreationCatalog.pin(database),
			original = await reader.read(root, expected());
		const before = await database.manager.findOneByOrFail(VirtualChannelPropertyEntity, { id: reading });
		await database.manager.delete(VirtualChannelPropertyEntity, { id: reading });
		await database.manager.insert(VirtualChannelPropertyEntity, {
			id: reading,
			channel: temperature,
			category: before.category,
			dataType: before.dataType,
			permissions: before.permissions,
			valueOrigin: before.valueOrigin,
			createdAt: before.createdAt,
			updatedAt: before.updatedAt,
		});
		const after = await reader.read(root, expected());
		expect(() => thermostatCreationCatalog.same(after, original)).toThrow('catalog identity');
		expect(after.members.find(({ id }) => id === reading).birth).not.toBe(
			original.members.find(({ id }) => id === reading).birth,
		);
	});
	it('vetoes a same-device acyclic parent change without rebirthing and does not claim continuous restored-ABA coverage', async () => {
		await ready();
		const reader = thermostatCreationCatalog.pin(database),
			original = await reader.read(root, expected());
		await database.manager.update(VirtualChannelEntity, { id: temperature }, { parentId: policy });
		await expect(reader.read(root, expected())).rejects.toThrow('catalog identity');
		await database.manager.update(VirtualChannelEntity, { id: temperature }, { parentId: null });
		thermostatCreationCatalog.same(await reader.read(root, expected()), original);
	});
	it('rejects a changed actual trigger body with the same name and never repairs installed schema', async () => {
		await ready();
		const reader = thermostatCreationCatalog.pin(database);
		const name = 'devices_module_devices_thermostat_catalog_birth_insert';
		await database.query(`DROP TRIGGER "${name}"`);
		await database.query(`CREATE TRIGGER "${name}" AFTER INSERT ON devices_module_devices BEGIN SELECT 1; END`);
		const before = await database.query<{ name: string; sql: string | null }[]>(
			'SELECT name, sql FROM sqlite_master ORDER BY name',
		);
		await expect(reader.read(root, expected())).rejects.toThrow('catalog identity');
		await expect(ready()).rejects.toThrow('catalog identity');
		expect(await database.query('SELECT name, sql FROM sqlite_master ORDER BY name')).toEqual(before);
	});
	it('refuses an installed NULL stamp instead of filling it', async () => {
		await ready();
		// Unsupported private-schema tamper used only as a fail-closed negative fixture.
		await database.query('UPDATE devices_module_channels_properties SET catalogBirth = NULL WHERE id = ?', [reading]);
		await expect(ready()).rejects.toThrow('catalog identity');
		expect(
			await database.query('SELECT catalogBirth FROM devices_module_channels_properties WHERE id = ?', [reading]),
		).toEqual([{ catalogBirth: null }]);
	});
	it('refuses a nested SAVEPOINT reader instead of blessing a replacement context', async () => {
		await ready();
		const reader = thermostatCreationCatalog.pin(database);
		await database.transaction(async (manager) => {
			await expect(manager.transaction((nested) => reader.scoped(nested)(root, expected()))).rejects.toThrow(
				'catalog identity',
			);
		});
	});
	it.each([undefined, null, false, 0, '', new Error('original query failure')])(
		'preserves the exact original query rejection %p',
		async (cause) => {
			await ready();
			jest.spyOn(database.manager, 'query').mockRejectedValueOnce(cause);
			const reader = thermostatCreationCatalog.pin(database);
			await expect(reader.read(root, expected())).rejects.toBe(cause);
			expect(reader.evidence()).toBeUndefined();
		},
	);
	it('does not adopt an actual reconnected driver handle while its original query is awaiting a BeforeQuery subscriber', async () => {
		await ready();
		const entered = pause(),
			resume = pause();
		const observer = {
			async beforeQuery(event: { query: string }) {
				if (event.query.startsWith('WITH root AS')) {
					entered.resolve();
					await resume.promise;
				}
			},
		};
		database.subscribers.push(observer);
		const reader = thermostatCreationCatalog.pin(database);
		const driver = database.driver as SqliteDriver,
			physical: unknown = driver.databaseConnection;
		const issued = reader.read(root, expected()).then(
			() => ({ accepted: true }),
			(cause: unknown) => ({ accepted: false, cause }),
		);
		try {
			await entered.promise;
			await driver.disconnect();
			await driver.connect();
			expect(driver.databaseConnection).not.toBe(physical);
		} finally {
			resume.resolve();
		}
		expect((await issued).accepted).toBe(false);
		expect(reader.current()).toBe(false);
	});
	it('refuses a new physical handle before a genuinely awaited original manager-query result is released', async () => {
		await ready();
		await thermostatCreationCatalog.pin(database).read(root, expected());
		const entered = pause(),
			resume = pause(),
			observations: string[] = [];
		const query = database.manager.query.bind(database.manager) as typeof database.manager.query;
		const held = jest.spyOn(database.manager, 'query').mockImplementation(async (...args: Parameters<typeof query>) => {
			const raw: unknown = await query.call(database.manager, ...args);
			observations.push('original-query-complete');
			entered.resolve();
			await resume.promise;
			observations.push('captured-wrapper-settled');
			return raw;
		});
		// The delay seam is registered before pin; it calls the original method with its original receiver.
		const reader = thermostatCreationCatalog.pin(database);
		const driver = database.driver as SqliteDriver,
			physical: unknown = driver.databaseConnection;
		const issued = reader.read(root, expected()).then(
			() => ({ accepted: true }),
			(cause: unknown) => ({ accepted: false, cause }),
		);
		try {
			await entered.promise;
			observations.push('disconnect-start');
			await driver.disconnect();
			observations.push('disconnect-complete');
			await driver.connect();
			observations.push('reconnect-complete');
			expect(driver.databaseConnection).not.toBe(physical);
		} finally {
			resume.resolve();
		}
		const outcome = await issued;
		console.info(
			'awaited-physical-reader-order',
			JSON.stringify({ observations, outcome, readerCurrent: reader.current() }),
		);
		expect(outcome.accepted).toBe(false);
		expect(reader.current()).toBe(false);
		expect(held).toHaveBeenCalledTimes(1);
	});
	it.each(['destroy', 'manager'])('refuses actual source %s before its original held query settles', async (action) => {
		await ready();
		const manager = database.manager,
			entered = pause(),
			resume = pause();
		const query = manager.query.bind(manager) as typeof manager.query;
		const held = jest.spyOn(manager, 'query').mockImplementation(async (...args: Parameters<typeof query>) => {
			const raw: unknown = await query(...args);
			entered.resolve();
			await resume.promise;
			return raw;
		});
		const reader = thermostatCreationCatalog.pin(database);
		const issued = reader.read(root, expected()).then(
			() => ({ accepted: true }),
			() => ({ accepted: false }),
		);
		try {
			await entered.promise;
			if (action === 'destroy') await database.destroy();
			else {
				expect(Reflect.set(database, 'manager', database.createEntityManager())).toBe(true);
				expect(database.manager).not.toBe(manager);
			}
		} finally {
			resume.resolve();
		}
		try {
			expect((await issued).accepted).toBe(false);
			expect(reader.current()).toBe(false);
			expect(held).toHaveBeenCalledTimes(1);
		} finally {
			if (action === 'manager') Reflect.set(database, 'manager', manager);
		}
	});
});
