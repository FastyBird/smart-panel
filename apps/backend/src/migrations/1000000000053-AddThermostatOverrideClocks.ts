import { MigrationInterface, QueryRunner } from 'typeorm';

import { THERMOSTAT_OVERRIDE_CLOCK_TRIGGERS } from '../plugins/devices-virtual/services/thermostat-override-clock.sql';

export class AddThermostatOverrideClocks1000000000053 implements MigrationInterface {
	name = 'AddThermostatOverrideClocks1000000000053';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_virtual_thermostat_override_clocks" (
			"controllerId" varchar NOT NULL, "overrideId" varchar NOT NULL, "watermark" integer NOT NULL,
			PRIMARY KEY ("controllerId", "overrideId"),
			CONSTRAINT "CHK_thermostat_override_clock" CHECK (typeof("watermark") = 'integer' AND "watermark" >= 0 AND "watermark" <= 9007199254740991),
			FOREIGN KEY ("controllerId") REFERENCES "devices_virtual_thermostat_configs" ("controllerId") ON DELETE CASCADE
		)`);
		// Legacy JSON remains untouched and is still included in recovery's maximum lower bound.
		for (const [name, sql] of Object.entries(THERMOSTAT_OVERRIDE_CLOCK_TRIGGERS))
			await runner.query(`CREATE TRIGGER "${name}" ${sql}`);
	}
	async down(runner: QueryRunner): Promise<void> {
		// Copy the high-water mark back before removing its separate store, including terminated overrides.
		await runner.query(`UPDATE "devices_virtual_thermostat_configs" SET "comfort" = json_set("comfort", '$.temporary_override.wall_watermark_ms',
			max(coalesce(json_extract("comfort", '$.temporary_override.wall_watermark_ms'), 0),
			(SELECT "watermark" FROM "devices_virtual_thermostat_override_clocks" c
			 WHERE c."controllerId" = "devices_virtual_thermostat_configs"."controllerId"
			 AND c."overrideId" = json_extract("comfort", '$.temporary_override.id'))))
			WHERE json_valid("comfort")
			AND (json_type("comfort", '$.temporary_override.wall_watermark_ms') IS NULL
			 OR json_type("comfort", '$.temporary_override.wall_watermark_ms') IN ('integer', 'real'))
			AND EXISTS (SELECT 1 FROM "devices_virtual_thermostat_override_clocks" c
			 WHERE c."controllerId" = "devices_virtual_thermostat_configs"."controllerId"
			 AND c."overrideId" = json_extract("comfort", '$.temporary_override.id'))`);
		await runner.query('DROP TABLE "devices_virtual_thermostat_override_clocks"');
	}
}
