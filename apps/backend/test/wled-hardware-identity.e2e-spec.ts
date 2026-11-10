import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EntityManager } from 'typeorm';

import { SqliteDataSource, createSqliteDataSource } from '../src/common/database/sqlite-data-source';
import { DeviceCategory } from '../src/modules/devices/devices.constants';
import { WledDeviceEntity } from '../src/plugins/devices-wled/entities/devices-wled.entity';

const sourceRoot = path.resolve(__dirname, '../src');
for (const name of readdirSync(sourceRoot, { recursive: true }) as string[])
	if (/\.(entity|subscriber)\.ts$/.test(name)) jest.requireActual(path.join(sourceRoot, name));

const migrationPaths = (through = Number.POSITIVE_INFINITY) =>
	readdirSync(sourceRoot + '/migrations')
		.filter((name) => /^\d+.*\.ts$/.test(name) && Number(name.slice(0, 13)) <= 1000000000000 + through)
		.map((name) => sourceRoot + '/migrations/' + name);

function open(migrations: string[], database = ':memory:'): Promise<SqliteDataSource> {
	return createSqliteDataSource({
		type: 'sqlite',
		database,
		entities: [sourceRoot + '/**/*.entity.ts'],
		subscribers: [sourceRoot + '/**/*.subscriber.ts'],
		migrations,
		migrationsTransactionMode: 'each',
		migrationsRun: true,
	});
}

function saveWled(manager: EntityManager, identifier: string, mac: string | null): Promise<WledDeviceEntity> {
	const repository = manager.getRepository(WledDeviceEntity);
	return repository.save(
		repository.create({ name: identifier, identifier, category: DeviceCategory.LIGHTING, hostname: identifier, mac }),
	);
}

describe('WLED hardware identity uniqueness', () => {
	const owned: SqliteDataSource[] = [];
	let directory: string;

	beforeEach(() => {
		directory = mkdtempSync(path.join(tmpdir(), 'wled-identity-'));
	});

	afterEach(async () => {
		for (const database of owned.splice(0)) if (database.isInitialized) await database.destroy();
		rmSync(directory, { recursive: true, force: true });
	});

	it('stores WLED devices under the class-name discriminator', async () => {
		const database = await open(migrationPaths());
		owned.push(database);

		const device = await saveWled(database.manager, 'wled-a', 'aabbccddeeff');
		const [row] = await database.query<{ type: string }[]>(
			'SELECT "type" FROM "devices_module_devices" WHERE "id" = ?',
			[device.id],
		);

		expect(row.type).toBe('WledDeviceEntity');
	});

	it('refuses a second WLED device with the same hardware MAC on a fresh schema', async () => {
		const database = await open(migrationPaths());
		owned.push(database);

		await saveWled(database.manager, 'wled-a', 'aabbccddeeff');

		await expect(saveWled(database.manager, 'wled-b', 'aabbccddeeff')).rejects.toThrow('UNIQUE constraint failed');
		await expect(saveWled(database.manager, 'wled-c', null)).resolves.toBeDefined();
		await expect(saveWled(database.manager, 'wled-d', null)).resolves.toBeDefined();
	});

	it('clears duplicates the broken index let through, then enforces uniqueness after upgrade', async () => {
		const file = path.join(directory, 'upgrade.sqlite');
		const legacy = await open(migrationPaths(54), file);
		owned.push(legacy);

		const keeper = await saveWled(legacy.manager, 'wled-a', 'aabbccddeeff');
		const duplicate = await saveWled(legacy.manager, 'wled-b', 'aabbccddeeff');
		const other = await saveWled(legacy.manager, 'wled-c', '112233445566');

		await legacy.destroy();
		const upgraded = await open(migrationPaths(), file);
		owned.push(upgraded);

		const rows = await upgraded.query<{ id: string; mac: string | null }[]>(
			'SELECT "id", "mac" FROM "devices_module_devices" WHERE "id" IN (?, ?, ?)',
			[keeper.id, duplicate.id, other.id],
		);
		const macs = Object.fromEntries(rows.map((row) => [row.id, row.mac]));
		const [first, second] = [keeper.id, duplicate.id].sort();

		expect(macs[first]).toBe('aabbccddeeff');
		expect(macs[second]).toBeNull();
		expect(macs[other.id]).toBe('112233445566');
		await expect(saveWled(upgraded.manager, 'wled-e', '112233445566')).rejects.toThrow('UNIQUE constraint failed');
	});
});
