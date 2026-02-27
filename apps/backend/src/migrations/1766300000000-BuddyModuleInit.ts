import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuddyModuleInit1766300000000 implements MigrationInterface {
	name = 'BuddyModuleInit1766300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "buddy_module_conversations" (
				"id" varchar PRIMARY KEY NOT NULL,
				"title" varchar NULL,
				"spaceId" varchar NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
			)
		`);

		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "buddy_module_messages" (
				"id" varchar PRIMARY KEY NOT NULL,
				"conversationId" varchar NOT NULL,
				"role" varchar NOT NULL,
				"content" text NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				CONSTRAINT "FK_buddy_message_conversation" FOREIGN KEY ("conversationId") REFERENCES "buddy_module_conversations" ("id") ON DELETE CASCADE
			)
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP TABLE IF EXISTS "buddy_module_messages"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "buddy_module_conversations"`);
	}
}
