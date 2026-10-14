import { DataSource } from 'typeorm';

import { AddVirtualThermostatRecoveries1000000000034 } from '../1000000000034-AddVirtualThermostatRecoveries';

describe('thermostat recovery audit migration', () => {
	it('persists append-only operator records across connections and removes its schema on rollback', async () => {
		const database = await new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [],
			migrations: [AddVirtualThermostatRecoveries1000000000034],
		}).initialize();
		try {
			await database.query(
				'CREATE TABLE "devices_virtual_thermostat_actuator_claims" ("id" varchar PRIMARY KEY NOT NULL)',
			);
			await database.runMigrations();
			await database.query(
				`INSERT INTO "devices_virtual_thermostat_recoveries" (
				"id", "controllerId", "claimId", "physicalIdentity", "previousPropertyIdentity",
				"restoredPropertyId", "actorId", "reason", "disconnectionAcknowledged",
				"configurationRevision", "claimRevision", "createdAt"
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					'event',
					'controller',
					'claim',
					'shelly-ng:MAC:switch:0:output',
					'old-property',
					'new-property',
					'operator',
					'Restored same relay after discovery loss',
					true,
					2,
					2,
					new Date().toISOString(),
				],
			);
			expect(
				(await database.query('SELECT "actorId", "reason" FROM "devices_virtual_thermostat_recoveries"'))[0],
			).toMatchObject({ actorId: 'operator', reason: 'Restored same relay after discovery loss' });
			await database.undoLastMigration();
			expect(
				await database.query(`SELECT name FROM sqlite_master WHERE name = 'devices_virtual_thermostat_recoveries'`),
			).toHaveLength(0);
		} finally {
			await database.destroy();
		}
	});
});
