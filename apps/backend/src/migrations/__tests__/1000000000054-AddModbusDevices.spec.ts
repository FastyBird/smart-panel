import { DataSource, QueryRunner } from 'typeorm';

import { AddModbusDevices1000000000054 } from '../1000000000054-AddModbusDevices';

describe('AddModbusDevices1000000000054', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new AddModbusDevices1000000000054();

	const names = async (type: 'table' | 'index'): Promise<string[]> =>
		((await queryRunner.query(`SELECT name FROM sqlite_master WHERE type = '${type}'`)) as Array<{ name: string }>).map(
			(row) => row.name,
		);

	const deviceColumns = async (): Promise<string[]> =>
		((await queryRunner.query(`PRAGMA table_info("devices_module_devices")`)) as Array<{ name: string }>).map(
			(row) => row.name,
		);

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });
		await dataSource.initialize();
		queryRunner = dataSource.createQueryRunner();
		await queryRunner.query('PRAGMA foreign_keys = ON');
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL)`,
		);
		await queryRunner.query(`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL)`);
		await migration.up(queryRunner);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	const insertEndpoint = (id: string, host: string, port: number) =>
		queryRunner.query(
			`INSERT INTO "devices_modbus_endpoints"
			 ("id", "name", "host", "port", "framing", "connectTimeoutMs", "requestTimeoutMs", "interRequestDelayMs", "maxInFlight", "enabled")
			 VALUES ('${id}', 'n', '${host}', ${port}, 'tcp', 2000, 1000, 0, 1, 1)`,
		);

	const insertDevice = (id: string, type: string, endpoint: string, unit: number) =>
		queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "modbusEndpointId", "modbusUnitId")
			 VALUES ('${id}', '${type}', '${endpoint}', ${unit})`,
		);

	it('creates endpoint and binding tables', async () => {
		const tables = await names('table');

		expect(tables).toContain('devices_modbus_endpoints');
		expect(tables).toContain('devices_modbus_bindings');
	});

	it('rejects a second endpoint with the same host and port', async () => {
		await insertEndpoint('e1', '10.10.0.230', 8080);

		await expect(insertEndpoint('e2', '10.10.0.230', 8080)).rejects.toThrow(/UNIQUE constraint failed/);
		await expect(insertEndpoint('e3', '10.10.0.230', 502)).resolves.toBeDefined();
	});

	it('rejects two modbus devices with the same endpoint and unit', async () => {
		await insertDevice('d1', 'devices-modbus', 'e1', 2);

		await expect(insertDevice('d2', 'devices-modbus', 'e1', 2)).rejects.toThrow(/UNIQUE constraint failed/);
		await expect(insertDevice('d3', 'devices-modbus', 'e1', 3)).resolves.toBeDefined();
		await expect(insertDevice('d4', 'other', 'e1', 2)).resolves.toBeDefined();
	});

	it('deletes bindings with their property', async () => {
		await queryRunner.query(`INSERT INTO "devices_module_devices" ("id", "type") VALUES ('d1', 'devices-modbus')`);
		await queryRunner.query(`INSERT INTO "devices_module_channels_properties" ("id") VALUES ('p1')`);
		await queryRunner.query(
			`INSERT INTO "devices_modbus_bindings" ("id", "propertyId", "deviceId", "role", "registerType", "address", "dataType")
			 VALUES ('b1', 'p1', 'd1', 'read', 'holding_register', 10, 'uint16')`,
		);
		await expect(
			queryRunner.query(
				`INSERT INTO "devices_modbus_bindings" ("id", "propertyId", "deviceId", "role", "registerType", "address", "dataType")
				 VALUES ('b2', 'p1', 'd1', 'read', 'coil', 1, 'bool')`,
			),
		).rejects.toThrow(/UNIQUE constraint failed/);

		await queryRunner.query(`DELETE FROM "devices_module_channels_properties" WHERE "id" = 'p1'`);

		const rows = (await queryRunner.query(`SELECT * FROM "devices_modbus_bindings"`)) as unknown[];
		expect(rows).toHaveLength(0);
	});

	it('down removes everything up added', async () => {
		await migration.down(queryRunner);

		const tables = await names('table');
		expect(tables).not.toContain('devices_modbus_endpoints');
		expect(tables).not.toContain('devices_modbus_bindings');
		expect(await names('index')).not.toContain('IDX_devices_modbus_endpoint_unit');
		expect(await deviceColumns()).toEqual(['id', 'type']);
	});
});
