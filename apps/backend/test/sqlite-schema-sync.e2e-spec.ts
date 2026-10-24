import { readdirSync } from 'node:fs';
import path from 'node:path';
import { DataSource } from 'typeorm';

import { SqliteDataSource } from '../src/common/database/sqlite-data-source';

// Load the actual discovery modules before the timed database scenario, as with static imports.
const sourceRoot = path.resolve(__dirname, '../src');
for (const name of readdirSync(sourceRoot, { recursive: true }) as string[]) {
	if (/\.(entity|subscriber)\.ts$/.test(name)) jest.requireActual(path.join(sourceRoot, name));
}

const catalogTables = ['devices_module_devices', 'devices_module_channels', 'devices_module_channels_properties'];

async function plannedQueries(database: DataSource) {
	return (await database.driver.createSchemaBuilder().log()).upQueries.map((query) => query.query);
}

async function triggers(database: DataSource) {
	return database.query<{ name: string; sql: string }[]>(
		"SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_probe_%' ORDER BY name",
	);
}

async function installTrigger(database: DataSource, table: string) {
	await database.query(
		`CREATE TRIGGER "sync_probe_${table}" BEFORE DELETE ON "${table}" BEGIN SELECT RAISE(ABORT, 'preserved trigger'); END`,
	);
}

describe('SQLite schema synchronization with full application discovery', () => {
	let ownedDatabase: SqliteDataSource;
	let issuedWork: Promise<void>;
	const issuedReads: Promise<unknown>[] = [];
	const trackRead = <T>(read: Promise<T>): Promise<T> => {
		issuedReads.push(read);
		return read;
	};

	afterEach(async () => {
		try {
			await issuedWork;
		} finally {
			// Even if a parallel read rejects first, settle every original read before closing its database.
			await Promise.allSettled(issuedReads);
			if (ownedDatabase?.isInitialized) await ownedDatabase.destroy();
		}
	});

	it('preserves the full discovered catalog, rows, enum CHECKs and triggers through unchanged sync', async () => {
		// Capture the actual instance before issuing initialization; teardown never adopts a late successor.
		const database = new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			synchronize: true,
			entities: [sourceRoot + '/**/*.entity.ts'],
			subscribers: [sourceRoot + '/**/*.subscriber.ts'],
		});
		ownedDatabase = database;
		issuedWork = (async () => {
			await database.initialize();
			expect(database.entityMetadatas.length).toBeGreaterThan(72);
			expect(database.subscribers.length).toBeGreaterThan(0);
			await database.query(
				"INSERT INTO devices_module_devices(id, name, type) VALUES ('device', 'Original', 'simulator')",
			);
			await database.query(
				"INSERT INTO devices_module_channels(id, name, type, deviceId) VALUES ('channel', 'Original', 'simulator', 'device')",
			);
			await database.query(
				"INSERT INTO devices_module_channels_properties(id, type, channelId) VALUES ('property', 'simulator', 'channel')",
			);
			const rows = await Promise.all(
				catalogTables.map((table) =>
					trackRead(database.query<Record<string, unknown>[]>(`SELECT * FROM "${table}" ORDER BY id`)),
				),
			);
			for (const table of catalogTables) await installTrigger(database, table);
			const before = await triggers(database);
			const runner = database.createQueryRunner();
			const columnsBefore = (await runner.getTables()).map((table) => ({ name: table.name, columns: table.columns }));
			await runner.release();
			expect(before).toHaveLength(3);
			expect(await plannedQueries(database)).toEqual([]);
			await database.synchronize();
			expect(await triggers(database)).toEqual(before);
			const verificationRunner = database.createQueryRunner();
			try {
				expect(
					(await verificationRunner.getTables()).map((table) => ({ name: table.name, columns: table.columns })),
				).toEqual(columnsBefore);
			} finally {
				await verificationRunner.release();
			}
			expect(
				await Promise.all(
					catalogTables.map((table) =>
						trackRead(database.query<Record<string, unknown>[]>(`SELECT * FROM "${table}" ORDER BY id`)),
					),
				),
			).toEqual(rows);
			for (const table of catalogTables) {
				await expect(database.query(`UPDATE "${table}" SET category = 'invalid'`)).rejects.toThrow(
					'CHECK constraint failed',
				);
				await expect(database.query(`DELETE FROM "${table}"`)).rejects.toThrow('preserved trigger');
			}
			await expect(database.query("UPDATE devices_module_devices SET hiddenBy = 'invalid'")).rejects.toThrow(
				'CHECK constraint failed',
			);
			await database.query("UPDATE devices_module_devices SET hiddenBy = NULL WHERE id = 'device'");
			await database.query("UPDATE devices_module_devices SET hiddenBy = 'user' WHERE id = 'device'");
			await expect(database.query("UPDATE devices_module_devices SET mode = 'invalid'")).rejects.toThrow(
				'CHECK constraint failed',
			);
			await expect(
				database.query("UPDATE devices_module_channels_properties SET dataType = 'invalid'"),
			).rejects.toThrow('CHECK constraint failed');
			await expect(
				database.query("UPDATE devices_module_channels_properties SET valueOrigin = 'invalid'"),
			).rejects.toThrow('CHECK constraint failed');
			expect(await plannedQueries(database)).toEqual([]);
		})();
		await issuedWork;
	});
});
