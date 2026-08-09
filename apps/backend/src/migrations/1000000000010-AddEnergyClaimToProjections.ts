import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives a projected meter one accountable claimant.
 *
 * Energy is additive: a reading may be counted once, and attributed to one room. A source property
 * may legitimately feed several virtual devices — one sensor serves two rooms' climate — but only one
 * of them may bill its kWh. `energyClaimPropertyId` is that claim, and the partial unique index below
 * makes "one claimant per meter" something the database enforces rather than something every write
 * path remembers to check.
 *
 * The backfill awards each meter to the oldest *admissible* projection, which is not the same as the
 * oldest projection:
 *
 * - the **destination** slot has to be energy-bearing — the (channel category, property category)
 *   pair the ingestion recognises, judged on the projection's own channel, because that is what
 *   decides whether it is treated as a meter at all. A `generic.consumption` source projected into an
 *   `electrical_energy` slot is a meter here even though its source is not one anywhere else;
 * - and where the **source** is itself energy-bearing, the two have to mean the same thing.
 *   `reportCompatibility` sees nothing separating `grid_import` from `grid_export` — both read-only
 *   floats in kWh over the same range — so an installation can hold a projection that changes what
 *   the reading means. Handing it the claim would keep the room's summary wrong in exactly the way
 *   this migration exists to fix.
 *
 * A meter with no admissible projection is left unclaimed and goes on attributing to the physical
 * device, which is today's behaviour: not right, but not misleading either.
 */
export class AddEnergyClaimToProjections1000000000010 implements MigrationInterface {
	name = 'AddEnergyClaimToProjections1000000000010';

	/**
	 * The (channel, property) pairs `EnergyIngestionListener.SOURCE_TYPE_MAP` recognises, as a SQL
	 * expression answering the source type or NULL. Duplicated here rather than imported on purpose: a
	 * migration is a statement about what the schema looked like at one moment, and it must keep
	 * producing the same result when the map it was written against changes.
	 */
	private static readonly SOURCE_TYPE = (channel: string, property: string): string => `
		CASE
			WHEN ${channel} = 'electrical_energy' AND ${property} = 'consumption' THEN 'consumption_import'
			WHEN ${channel} = 'electrical_generation' AND ${property} = 'production' THEN 'generation_production'
			WHEN ${channel} = 'electrical_energy' AND ${property} = 'grid_import' THEN 'grid_import'
			WHEN ${channel} = 'electrical_energy' AND ${property} = 'grid_export' THEN 'grid_export'
			ELSE NULL
		END`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "devices_module_channels_properties" ADD COLUMN "energyClaimPropertyId" varchar ` +
				`REFERENCES "devices_module_channels_properties" ("id") ON DELETE SET NULL`,
		);

		// Partial, so the many projections that claim nothing are not competing for a single NULL slot.
		// Precedent: 1000000000003-UnifySpaceRoleTables uses the same shape to keep each role subtype's
		// uniqueness after collapsing four tables into one.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_channels_properties_energyClaim" ` +
				`ON "devices_module_channels_properties" ("energyClaimPropertyId") ` +
				`WHERE "energyClaimPropertyId" IS NOT NULL`,
		);

		const destinationType = AddEnergyClaimToProjections1000000000010.SOURCE_TYPE(
			'destination_channel."category"',
			'projection."category"',
		);
		const sourceType = AddEnergyClaimToProjections1000000000010.SOURCE_TYPE(
			'source_channel."category"',
			'source."category"',
		);

		// One statement, so a half-awarded set cannot survive a failure part-way. `ROW_NUMBER()` picks
		// the winner per meter; `createdAt` then `id` makes it deterministic, which is what lets the
		// same installation upgrade twice and land on the same answer.
		await queryRunner.query(`
			WITH admissible AS (
				SELECT projection."id" AS "projectionId",
				       projection."sourcePropertyId" AS "meterId",
				       ROW_NUMBER() OVER (
				           PARTITION BY projection."sourcePropertyId"
				           ORDER BY projection."createdAt" ASC, projection."id" ASC
				       ) AS "rank"
				FROM "devices_module_channels_properties" projection
				INNER JOIN "devices_module_channels" destination_channel
				        ON destination_channel."id" = projection."channelId"
				INNER JOIN "devices_module_channels_properties" source
				        ON source."id" = projection."sourcePropertyId"
				INNER JOIN "devices_module_channels" source_channel
				        ON source_channel."id" = source."channelId"
				WHERE projection."type" = 'virtual'
				  AND projection."sourcePropertyId" IS NOT NULL
				  AND (${destinationType}) IS NOT NULL
				  AND ((${sourceType}) IS NULL OR (${sourceType}) = (${destinationType}))
			)
			UPDATE "devices_module_channels_properties"
			   SET "energyClaimPropertyId" = (
			       SELECT "meterId" FROM admissible
			        WHERE admissible."projectionId" = "devices_module_channels_properties"."id"
			          AND admissible."rank" = 1
			   )
			 WHERE "id" IN (SELECT "projectionId" FROM admissible WHERE "rank" = 1)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_channels_properties_energyClaim"`);
		await queryRunner.query(`ALTER TABLE "devices_module_channels_properties" DROP COLUMN "energyClaimPropertyId"`);
	}
}
