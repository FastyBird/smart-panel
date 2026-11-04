/** A clock write can only tighten recovery. No runner, SQL or callback receives an authority exemption. */
export const THERMOSTAT_OVERRIDE_CLOCK_TRIGGERS: Readonly<Record<string, string>> = {
	thermostat_override_clock_insert: `BEFORE INSERT ON "devices_virtual_thermostat_override_clocks"
		WHEN EXISTS (SELECT 1 FROM "devices_virtual_thermostat_override_clocks"
			WHERE "controllerId" = NEW."controllerId" AND "overrideId" = NEW."overrideId" AND "watermark" > NEW."watermark")
		BEGIN SELECT RAISE(ABORT, 'Thermostat override clock cannot decrease'); END`,
	thermostat_override_clock_update: `BEFORE UPDATE ON "devices_virtual_thermostat_override_clocks"
		WHEN NEW."controllerId" IS NOT OLD."controllerId" OR NEW."overrideId" IS NOT OLD."overrideId" OR NEW."watermark" < OLD."watermark"
		BEGIN SELECT RAISE(ABORT, 'Thermostat override clock identity and lower bound are retained'); END`,
	thermostat_override_clock_delete: `BEFORE DELETE ON "devices_virtual_thermostat_override_clocks"
		WHEN EXISTS (SELECT 1 FROM "devices_virtual_thermostat_configs" WHERE "controllerId" = OLD."controllerId")
		BEGIN SELECT RAISE(ABORT, 'Thermostat override clock is retained until controller deletion'); END`,
};
