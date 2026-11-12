import { DataSource, QueryRunner } from 'typeorm';

import { AddModbusLongPress1000000000058 } from '../1000000000058-AddModbusLongPress';

describe('AddModbusLongPress1000000000058', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new AddModbusLongPress1000000000058();

	const columns = async (): Promise<Array<{ name: string; type: string; notnull: number }>> =>
		queryRunner.query(`PRAGMA table_info("devices_modbus_bindings")`);

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query(
			`CREATE TABLE "devices_modbus_bindings" ("id" varchar PRIMARY KEY NOT NULL, "pollIntervalMs" integer)`,
		);
		await queryRunner.query(`INSERT INTO "devices_modbus_bindings" ("id") VALUES ('existing')`);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('adds a nullable integer column and keeps existing rows', async () => {
		await migration.up(queryRunner);

		const column = (await columns()).find((candidate) => candidate.name === 'longPressMs');

		expect(column?.type.toLowerCase()).toBe('integer');
		expect(column?.notnull).toBe(0);
		expect(await queryRunner.query(`SELECT "longPressMs" FROM "devices_modbus_bindings"`)).toEqual([
			{ longPressMs: null },
		]);
	});

	it('drops the column on down', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		expect((await columns()).map((column) => column.name)).not.toContain('longPressMs');
	});
});
