import { MigrationInterface, QueryRunner } from 'typeorm';

/** Frozen independently of later entity changes. No backfill can infer a native deletion. */
export class FenceClimateAutomationLifecycle1000000000049 implements MigrationInterface {
	name = 'FenceClimateAutomationLifecycle1000000000049';
	async up(runner: QueryRunner): Promise<void> {
		await runner.query(`CREATE TABLE "devices_module_climate_automation_deletions" (
			"deletionId" varchar PRIMARY KEY NOT NULL, "controllerId" varchar NOT NULL,
			"controllerIncarnation" varchar NOT NULL, "providerKey" varchar NOT NULL,
			"slotRevision" integer NOT NULL, "manualCounter" integer NOT NULL,
			"slotEvidence" text NOT NULL, "controllerEvidence" text NOT NULL, "deviceEvidence" text NOT NULL,
			"configurationEvidence" text NOT NULL, "nativeDeviceEvidence" text, "nativeConfigurationEvidence" text,
			"consumedByIncarnation" varchar, "consumedSlotRevision" integer,
			CONSTRAINT "CHK_climate_deletion_revision" CHECK (typeof("slotRevision") = 'integer' AND typeof("manualCounter") = 'integer' AND "slotRevision" BETWEEN 1 AND 9007199254740991 AND "manualCounter" BETWEEN 1 AND 9007199254740991),
			CONSTRAINT "CHK_climate_deletion_consumption" CHECK (("consumedByIncarnation" IS NULL AND "consumedSlotRevision" IS NULL) OR ("consumedByIncarnation" IS NOT NULL AND "consumedByIncarnation" <> "controllerIncarnation" AND "nativeDeviceEvidence" IS NOT NULL AND "nativeConfigurationEvidence" IS NOT NULL AND "consumedSlotRevision" > "slotRevision" AND "consumedSlotRevision" <= 9007199254740991)),
			CONSTRAINT "UQ_climate_deletion_incarnation" UNIQUE ("controllerId", "controllerIncarnation")
		)`);
		const device = await runner.manager.query<{ name: string }[]>('PRAGMA table_info("devices_module_devices")');
		const config = await runner.manager.query<{ name: string }[]>(
			'PRAGMA table_info("devices_virtual_thermostat_configs")',
		);
		const image = (columns: { name: string }[], prefix: string) =>
			'json_object(' +
			columns.map(({ name }) => `'${name.replace(/'/g, "''")}', ${prefix}."${name.replace(/"/g, '""')}"`).join(', ') +
			')';
		if (!device.length || !config.length) throw new Error('Controller deletion schema is missing');
		await runner.query(`CREATE TRIGGER "virtual_thermostat_capture_admitted_deletion" BEFORE DELETE ON "devices_module_devices"
		BEGIN UPDATE "devices_module_climate_automation_deletions"
		SET "nativeDeviceEvidence" = ${image(device, 'OLD')},
		"nativeConfigurationEvidence" = (SELECT ${image(config, 'c')} FROM "devices_virtual_thermostat_configs" c WHERE c."controllerId" = OLD."id")
		WHERE "controllerId" = OLD."id" AND "nativeDeviceEvidence" IS NULL AND "consumedByIncarnation" IS NULL;
		END`);
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query('DROP TRIGGER "virtual_thermostat_capture_admitted_deletion"');
		await runner.query('DROP TABLE "devices_module_climate_automation_deletions"');
	}
}
