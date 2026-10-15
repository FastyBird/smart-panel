import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShellyCoverOrdering1000000000038 implements MigrationInterface {
	name = 'AddShellyCoverOrdering1000000000038';
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			'CREATE TABLE "devices_shelly_ng_cover_ordering" ("physicalIdentity" text PRIMARY KEY NOT NULL, "token" text NOT NULL, "startedAt" datetime NOT NULL)',
		);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		// Unresolved execution must not silently regain eligibility after downgrade/re-upgrade.
		const rows = (await queryRunner.query(
			'SELECT "physicalIdentity" FROM "devices_shelly_ng_cover_ordering" LIMIT 1',
		)) as unknown[];
		if (rows.length) throw new Error('Cannot remove unresolved cover ordering journals');
		await queryRunner.query('DROP TABLE "devices_shelly_ng_cover_ordering"');
	}
}
