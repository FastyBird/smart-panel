import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEnergyDeltaIntervalEndIndex1765900000000 implements MigrationInterface {
	name = 'AddEnergyDeltaIntervalEndIndex1765900000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
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
