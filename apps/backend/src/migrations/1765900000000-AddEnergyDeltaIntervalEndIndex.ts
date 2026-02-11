import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnergyDeltaIntervalEndIndex1765900000000 implements MigrationInterface {
	name = 'AddEnergyDeltaIntervalEndIndex1765900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Guard: skip if the table does not exist yet (energy module not activated).
		// The @Index decorator on the entity will create the index when the table is first created.
		const tables: { name: string }[] = await queryRunner.query(
			`SELECT name FROM sqlite_master WHERE type='table' AND name='energy_module_deltas'`,
		);

		if (tables.length === 0) {
			return;
		}

		// Check if index already exists (e.g. from synchronize:true environments)
		const indices: { name: string }[] = await queryRunner.query(
			`PRAGMA index_list("energy_module_deltas")`,
		);
		const hasIndex = indices.some((idx) => idx.name === 'IDX_energy_deltas_interval_end');

		if (!hasIndex) {
			await queryRunner.query(
				`CREATE INDEX "IDX_energy_deltas_interval_end" ON "energy_module_deltas" ("intervalEnd")`,
			);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_energy_deltas_interval_end"`);
	}
}
