import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualAggregateProfiles1000000000037 implements MigrationInterface {
	name = 'AddVirtualAggregateProfiles1000000000037';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "devices_virtual_aggregate_configs" ADD COLUMN "profile" text NOT NULL DEFAULT ('temperature')`,
		);
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('ALTER TABLE "devices_virtual_aggregate_configs" DROP COLUMN "profile"');
	}
}
