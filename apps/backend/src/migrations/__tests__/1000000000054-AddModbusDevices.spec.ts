import { DataSource, QueryRunner } from 'typeorm';

import { FenceClimateAutomationLifecycle1000000000049 } from '../1000000000049-FenceClimateAutomationLifecycle';
import { AddModbusDevices1000000000054 } from '../1000000000054-AddModbusDevices';
import { climateDeletionCaptureSql } from '../../plugins/devices-virtual/services/virtual-thermostat-ownership.sql';

const DELETION_CAPTURE_TRIGGER = 'virtual_thermostat_capture_admitted_deletion';

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
		expect(await names('index')).toContain('IDX_devices_modbus_binding_device');
	});

	it('stores the template revision as text', async () => {
		const columns = (await queryRunner.query(`PRAGMA table_info("devices_module_devices")`)) as Array<{
			name: string;
			type: string;
		}>;

		expect(columns.find((column) => column.name === 'modbusTemplateRevision')?.type).toBe('varchar');

		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "modbusTemplateRevision") VALUES ('d1', 'ModbusDeviceEntity', '1.2.0+3f2a9c1b')`,
		);

		const [row] = (await queryRunner.query(
			`SELECT "modbusTemplateRevision" FROM "devices_module_devices" WHERE "id" = 'd1'`,
		)) as Array<{ modbusTemplateRevision: unknown }>;

		expect(row.modbusTemplateRevision).toBe('1.2.0+3f2a9c1b');
	});

	it('rejects a second endpoint with the same host and port', async () => {
		await insertEndpoint('e1', '10.10.0.230', 8080);

		await expect(insertEndpoint('e2', '10.10.0.230', 8080)).rejects.toThrow(/UNIQUE constraint failed/);
		await expect(insertEndpoint('e3', '10.10.0.230', 502)).resolves.toBeDefined();
	});

	it('rejects two modbus devices with the same endpoint and unit', async () => {
		await insertDevice('d1', 'ModbusDeviceEntity', 'e1', 2);

		await expect(insertDevice('d2', 'ModbusDeviceEntity', 'e1', 2)).rejects.toThrow(/UNIQUE constraint failed/);
		await expect(insertDevice('d3', 'ModbusDeviceEntity', 'e1', 3)).resolves.toBeDefined();
		await expect(insertDevice('d4', 'other', 'e1', 2)).resolves.toBeDefined();
	});

	it('deletes bindings with their property', async () => {
		await queryRunner.query(`INSERT INTO "devices_module_devices" ("id", "type") VALUES ('d1', 'ModbusDeviceEntity')`);
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
		expect(await names('index')).not.toContain('IDX_devices_modbus_binding_device');
		expect(await deviceColumns()).toEqual(['id', 'type']);
	});

	it('does not create the thermostat deletion trigger when migration 49 has not installed it', async () => {
		const triggers = (await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = '${DELETION_CAPTURE_TRIGGER}'`,
		)) as unknown[];

		expect(triggers).toHaveLength(0);
	});
});

describe('AddModbusDevices1000000000054 thermostat deletion trigger', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;
	let installedBefore: string;

	const migration = new AddModbusDevices1000000000054();

	const triggerSql = async (): Promise<string[]> =>
		(
			(await queryRunner.query(`SELECT "sql" FROM sqlite_master WHERE type = 'trigger' AND name = ?`, [
				DELETION_CAPTURE_TRIGGER,
			])) as Array<{ sql: string }>
		).map((row) => row.sql);

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
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "type" varchar NOT NULL, "name" varchar)`,
		);
		await queryRunner.query(`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL)`);
		await queryRunner.query(
			`CREATE TABLE "devices_virtual_thermostat_configs" ("controllerId" varchar PRIMARY KEY NOT NULL, "revision" integer)`,
		);
		await new FenceClimateAutomationLifecycle1000000000049().up(queryRunner);
		[installedBefore] = await triggerSql();
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('rebuilds the trigger with the modbus columns exactly as the runtime expects', async () => {
		expect(installedBefore).toBe(await climateDeletionCaptureSql(queryRunner.manager));

		await migration.up(queryRunner);

		const expected = await climateDeletionCaptureSql(queryRunner.manager);

		expect(await triggerSql()).toEqual([expected]);
		expect(expected).not.toBe(installedBefore);

		for (const column of ['modbusEndpointId', 'modbusUnitId', 'modbusTemplateRevision']) {
			expect(expected).toContain(`'${column}', OLD."${column}"`);
		}
	});

	it('captures the modbus columns when an admitted controller is deleted', async () => {
		await migration.up(queryRunner);

		await queryRunner.query(
			`INSERT INTO "devices_module_devices" ("id", "type", "name", "modbusUnitId") VALUES ('controller', 'VirtualDeviceEntity', 'Hall', 4)`,
		);
		await queryRunner.query(`INSERT INTO "devices_virtual_thermostat_configs" VALUES ('controller', 3)`);
		await queryRunner.query(
			`INSERT INTO "devices_module_climate_automation_deletions"
			 ("deletionId", "controllerId", "controllerIncarnation", "providerKey", "slotRevision", "manualCounter",
			  "slotEvidence", "controllerEvidence", "deviceEvidence", "configurationEvidence")
			 VALUES ('deletion', 'controller', 'incarnation', 'provider', 1, 1, '{}', '{}', '{}', '{}')`,
		);

		await queryRunner.query(`DELETE FROM "devices_module_devices" WHERE "id" = 'controller'`);

		const [row] = (await queryRunner.query(
			`SELECT "nativeDeviceEvidence" FROM "devices_module_climate_automation_deletions" WHERE "deletionId" = 'deletion'`,
		)) as Array<{ nativeDeviceEvidence: string }>;

		expect(JSON.parse(row.nativeDeviceEvidence)).toMatchObject({ id: 'controller', name: 'Hall', modbusUnitId: 4 });
	});

	it('down drops the modbus columns and restores the original trigger', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		expect(await deviceColumns()).toEqual(['id', 'type', 'name']);
		expect(await triggerSql()).toEqual([await climateDeletionCaptureSql(queryRunner.manager)]);
		expect(await triggerSql()).toEqual([installedBefore]);
	});
});
