import { DataSource } from 'typeorm';

import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

export const SHELLY_THERMOSTAT_IDENTITY_GUARD = `CREATE TRIGGER IF NOT EXISTS "shelly_ng_thermostat_identity"
	BEFORE UPDATE OF "canonicalMac" ON "devices_module_devices"
	WHEN NEW."canonicalMac" IS NOT OLD."canonicalMac" AND EXISTS (
		SELECT 1 FROM "devices_virtual_thermostat_actuator_claims" WHERE "sourceDeviceId" = OLD."id" AND "state" != 'released'
	)
	BEGIN SELECT RAISE(ABORT, 'Thermostat hardware identity is reserved; qualified release and repair required'); END`;

/** Hardware aliases share a single reservation, including direct SQL catalog writes. */
@Injectable()
export class ShellyThermostatIdentityGuard implements OnApplicationBootstrap {
	constructor(private readonly database: DataSource) {}

	async onApplicationBootstrap(): Promise<void> {
		// Migrated catalogs install this trigger together with the claim schema.
		if (!this.database.options.synchronize) return;
		const runner = this.database.createQueryRunner();
		try {
			if (await runner.hasTable('devices_virtual_thermostat_actuator_claims'))
				await runner.query(SHELLY_THERMOSTAT_IDENTITY_GUARD);
		} finally {
			await runner.release();
		}
	}
}
