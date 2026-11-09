import { MigrationInterface, QueryRunner } from 'typeorm';

const DEVICE_COLUMNS: Array<[string, string]> = [
	['modbusEndpointId', 'varchar'],
	['modbusUnitId', 'integer'],
	['modbusPollIntervalMs', 'integer'],
	['modbusByteOrder', 'varchar'],
	['modbusWordOrder', 'varchar'],
	['modbusMaxReadRegisters', 'integer'],
	['modbusMaxReadBits', 'integer'],
	['modbusMaxReadGap', 'integer'],
	['modbusTemplateId', 'varchar'],
	['modbusTemplateRevision', 'varchar'],
];

export class AddModbusDevices1000000000054 implements MigrationInterface {
	name = 'AddModbusDevices1000000000054';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`CREATE TABLE "devices_modbus_endpoints" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"name" varchar NOT NULL,
			"host" varchar NOT NULL,
			"port" integer NOT NULL,
			"framing" varchar NOT NULL,
			"connectTimeoutMs" integer NOT NULL,
			"requestTimeoutMs" integer NOT NULL,
			"interRequestDelayMs" integer NOT NULL,
			"maxInFlight" integer NOT NULL,
			"enabled" boolean NOT NULL DEFAULT (1),
			CONSTRAINT "UQ_devices_modbus_endpoint_host_port" UNIQUE ("host", "port")
		)`);

		// The endpoint reference is enforced in the service: SQLite cannot add a foreign key with ALTER TABLE.
		for (const [column, type] of DEVICE_COLUMNS) {
			await queryRunner.query(`ALTER TABLE "devices_module_devices" ADD COLUMN "${column}" ${type}`);
		}

		// Single-table inheritance stores the child entity class name as the discriminator (`@ChildEntity()` without a
		// value), not the plugin type, so the condition names `ModbusDeviceEntity`.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_devices_modbus_endpoint_unit" ON "devices_module_devices" ("modbusEndpointId", "modbusUnitId") WHERE "type" = 'ModbusDeviceEntity'`,
		);

		await queryRunner.query(`CREATE TABLE "devices_modbus_bindings" (
			"id" varchar PRIMARY KEY NOT NULL,
			"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
			"updatedAt" datetime,
			"propertyId" varchar NOT NULL,
			"deviceId" varchar NOT NULL,
			"role" varchar NOT NULL,
			"registerType" varchar NOT NULL,
			"address" integer NOT NULL,
			"dataType" varchar NOT NULL,
			"bit" integer,
			"byteOrder" varchar,
			"wordOrder" varchar,
			"scale" float NOT NULL DEFAULT (1),
			"offset" float NOT NULL DEFAULT (0),
			"invert" boolean NOT NULL DEFAULT (0),
			"valueMap" text,
			"writeFunction" varchar,
			"pollIntervalMs" integer,
			CONSTRAINT "UQ_devices_modbus_binding_property_role" UNIQUE ("propertyId", "role"),
			CONSTRAINT "FK_devices_modbus_binding_property" FOREIGN KEY ("propertyId")
				REFERENCES "devices_module_channels_properties" ("id") ON DELETE CASCADE,
			CONSTRAINT "FK_devices_modbus_binding_device" FOREIGN KEY ("deviceId")
				REFERENCES "devices_module_devices" ("id") ON DELETE CASCADE
		)`);

		await queryRunner.query(
			`CREATE INDEX "IDX_devices_modbus_binding_device" ON "devices_modbus_bindings" ("deviceId")`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_modbus_binding_device"`);
		await queryRunner.query(`DROP TABLE "devices_modbus_bindings"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_devices_modbus_endpoint_unit"`);

		for (const [column] of [...DEVICE_COLUMNS].reverse()) {
			await queryRunner.query(`ALTER TABLE "devices_module_devices" DROP COLUMN "${column}"`);
		}

		await queryRunner.query(`DROP TABLE "devices_modbus_endpoints"`);
	}
}
