import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVirtualAggregatePolicies1000000000036 implements MigrationInterface {
	name = 'AddVirtualAggregatePolicies1000000000036';

	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			'ALTER TABLE "devices_virtual_aggregate_inputs" ADD COLUMN "weight" float NOT NULL DEFAULT (1)',
		);
		await queryRunner.query('ALTER TABLE "devices_virtual_aggregate_configs" ADD COLUMN "outlierFilter" text');
	}

	async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query('ALTER TABLE "devices_virtual_aggregate_configs" DROP COLUMN "outlierFilter"');
		await queryRunner.query('ALTER TABLE "devices_virtual_aggregate_inputs" DROP COLUMN "weight"');
	}
}
