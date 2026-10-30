import { instanceToPlain } from 'class-transformer';
import { DataSource } from 'typeorm';

import { FenceClimateAutomationLifecycle1000000000049 } from '../1000000000049-FenceClimateAutomationLifecycle';
import { SqliteDataSource, createSqliteDataSource } from '../../common/database/sqlite-data-source';
import { ClimateAutomationDeletionEntity } from '../../modules/devices/entities/climate-automation.entity';
import { climateDeletionCaptureSql } from '../../plugins/devices-virtual/services/virtual-thermostat-ownership.sql';

const table = 'devices_module_climate_automation_deletions';
const pending = {
	deletionId: 'deletion-A',
	controllerId: 'controller',
	controllerIncarnation: 'incarnation-A',
	providerKey: 'virtual-thermostat:v1',
	slotRevision: 7,
	manualCounter: 5,
	slotEvidence: '{"ownerId":"original"}',
	controllerEvidence: '{"revision":3}',
	deviceEvidence: '{"id":"controller","name":"Original","catalogBirth":11}',
	configurationEvidence: '{"controllerId":"controller","revision":3,"ownerDeviceId":"controller"}',
	nativeDeviceEvidence: null,
	nativeConfigurationEvidence: null,
	consumedByIncarnation: null,
	consumedSlotRevision: null,
};

async function catalog(database: DataSource): Promise<void> {
	await database.query(
		'CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY, "name" text, "catalogBirth" integer)',
	);
	await database.query(
		'CREATE TABLE "devices_virtual_thermostat_configs" ("controllerId" varchar PRIMARY KEY REFERENCES "devices_module_devices"("id") ON DELETE CASCADE, "revision" integer, "ownerDeviceId" varchar)',
	);
	await database.query('INSERT INTO "devices_module_devices" VALUES (?, ?, ?)', ['controller', 'Original', 11]);
	await database.query('INSERT INTO "devices_virtual_thermostat_configs" VALUES (?, ?, ?)', [
		'controller',
		3,
		'controller',
	]);
}

describe('migration 49 native retained controller deletion provenance', () => {
	let database: SqliteDataSource;
	const migration = new FenceClimateAutomationLifecycle1000000000049();
	beforeEach(async () => {
		database = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [ClimateAutomationDeletionEntity],
		});
		await catalog(database);
		const runner = database.createQueryRunner();
		try {
			await migration.up(runner);
		} finally {
			await runner.release();
		}
	});
	afterEach(async () => {
		await database.destroy();
	});

	it('has the same private schema under migration and synchronize, and reverses without changing catalog rows', async () => {
		expect((await database.driver.createSchemaBuilder().log()).upQueries).toEqual([]);
		const synchronized = await createSqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [ClimateAutomationDeletionEntity],
			synchronize: true,
		});
		try {
			await catalog(synchronized);
			await synchronized.query(await climateDeletionCaptureSql(synchronized.manager));
			expect(await synchronized.query(`PRAGMA table_info("${table}")`)).toEqual(
				await database.query(`PRAGMA table_info("${table}")`),
			);
			const actual = await database.query<{ sql: string }[]>('SELECT sql FROM sqlite_master WHERE name = ?', [
				'virtual_thermostat_capture_admitted_deletion',
			]);
			expect(actual[0].sql).toBe(await climateDeletionCaptureSql(synchronized.manager));
		} finally {
			await synchronized.destroy();
		}
		const before: unknown = await database.query('SELECT * FROM "devices_module_devices"');
		const runner = database.createQueryRunner();
		try {
			await migration.down(runner);
		} finally {
			await runner.release();
		}
		expect(await database.query('SELECT * FROM "devices_module_devices"')).toEqual(before);
		expect(
			await database.query('SELECT name FROM sqlite_master WHERE name IN (?, ?)', [
				table,
				'virtual_thermostat_capture_admitted_deletion',
			]),
		).toEqual([]);
	});

	it.each([false, true])(
		'captures actual OLD rows only for the original pending intent; rollback=%s',
		async (rollback) => {
			const remove = database.transaction(async (manager) => {
				await manager.insert(ClimateAutomationDeletionEntity, pending);
				await manager.query('DELETE FROM "devices_module_devices" WHERE "id" = ?', ['controller']);
				const record = await manager.findOneByOrFail(ClimateAutomationDeletionEntity, {
					deletionId: pending.deletionId,
				});
				expect(JSON.parse(record.nativeDeviceEvidence)).toEqual({
					id: 'controller',
					name: 'Original',
					catalogBirth: 11,
				});
				expect(JSON.parse(record.nativeConfigurationEvidence)).toEqual({
					controllerId: 'controller',
					revision: 3,
					ownerDeviceId: 'controller',
				});
				expect(await manager.query('SELECT * FROM "devices_virtual_thermostat_configs"')).toEqual([]);
				if (rollback) throw new Error('original deletion rollback');
			});
			if (rollback) {
				await expect(remove).rejects.toThrow('original deletion rollback');
				expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(0);
				expect(await database.query('SELECT id FROM "devices_module_devices"')).toEqual([{ id: 'controller' }]);
				expect(await database.query('SELECT revision FROM "devices_virtual_thermostat_configs"')).toEqual([
					{ revision: 3 },
				]);
			} else {
				await remove;
				expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(1);
			}
		},
	);

	it('does not infer deletion provenance from raw deletion without an admitted intent', async () => {
		await database.query('DELETE FROM "devices_module_devices" WHERE "id" = ?', ['controller']);
		expect(await database.manager.count(ClimateAutomationDeletionEntity)).toBe(0);
	});

	it('retains original evidence after consumption, rejects counter reset, and stays private', async () => {
		await database.manager.insert(ClimateAutomationDeletionEntity, pending);
		await expect(
			database.manager.update(
				ClimateAutomationDeletionEntity,
				{ deletionId: pending.deletionId },
				{
					consumedByIncarnation: 'successor',
					consumedSlotRevision: 7,
				},
			),
		).rejects.toThrow();
		await expect(
			database.manager.update(
				ClimateAutomationDeletionEntity,
				{ deletionId: pending.deletionId },
				{
					consumedByIncarnation: 'successor',
					consumedSlotRevision: 8,
				},
			),
		).rejects.toThrow();
		await database.query('DELETE FROM "devices_module_devices" WHERE "id" = ?', ['controller']);
		const native = {
			...(await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, { deletionId: pending.deletionId })),
		};
		await expect(
			database.manager.update(
				ClimateAutomationDeletionEntity,
				{ deletionId: pending.deletionId },
				{
					consumedByIncarnation: pending.controllerIncarnation,
					consumedSlotRevision: 8,
				},
			),
		).rejects.toThrow();
		await database.manager.update(
			ClimateAutomationDeletionEntity,
			{ deletionId: pending.deletionId },
			{
				consumedByIncarnation: 'successor',
				consumedSlotRevision: 8,
			},
		);
		const record = await database.manager.findOneByOrFail(ClimateAutomationDeletionEntity, {
			deletionId: pending.deletionId,
		});
		expect(record).toMatchObject({ ...native, consumedByIncarnation: 'successor', consumedSlotRevision: 8 });
		expect(JSON.stringify(record)).toBe('{}');
		expect(instanceToPlain(record)).toEqual({});
	});
});
