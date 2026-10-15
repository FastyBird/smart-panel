import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddShellyCoverRecoveries1000000000042 implements MigrationInterface {
	name = 'AddShellyCoverRecoveries1000000000042';
	async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			'CREATE TABLE "devices_shelly_ng_cover_recoveries" ("id" text PRIMARY KEY NOT NULL, "actorId" text NOT NULL, "createdAt" datetime NOT NULL, "physicalIdentity" text NOT NULL, "deviceId" text NOT NULL, "channelId" text NOT NULL, "propertyId" text NOT NULL, "oldToken" text NOT NULL, "oldStartedAt" datetime NOT NULL, "contextRevision" text NOT NULL, "reason" text NOT NULL, "observedState" text NOT NULL, "observedPosition" real NOT NULL, "observedAt" datetime NOT NULL, "advisory" text NOT NULL)',
		);
	}
	async down(queryRunner: QueryRunner): Promise<void> {
		const rows = (await queryRunner.query(
			'SELECT "id" FROM "devices_shelly_ng_cover_recoveries" LIMIT 1',
		)) as unknown[];
		if (rows.length) throw new Error('Cannot discard operator cover uncertainty acceptance history');
		await queryRunner.query('DROP TABLE "devices_shelly_ng_cover_recoveries"');
	}
}
