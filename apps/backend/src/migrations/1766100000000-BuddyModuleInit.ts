import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuddyModuleInit1766100000000 implements MigrationInterface {
	name = 'BuddyModuleInit1766100000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		// Create conversations table
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "buddy_module_conversations" (
				"id" varchar PRIMARY KEY NOT NULL,
				"title" varchar NULL,
				"spaceId" varchar NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP)
			)
		`);

		// Create messages table
		await queryRunner.query(`
			CREATE TABLE IF NOT EXISTS "buddy_module_messages" (
				"id" varchar PRIMARY KEY NOT NULL,
				"conversationId" varchar NOT NULL,
				"role" varchar NOT NULL,
				"content" text NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				FOREIGN KEY ("conversationId") REFERENCES "buddy_module_conversations" ("id") ON DELETE CASCADE
			)
		`);

		// Index for faster message lookup by conversation
		await queryRunner.query(`
			CREATE INDEX IF NOT EXISTS "IDX_buddy_messages_conversation" ON "buddy_module_messages" ("conversationId")
		`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_buddy_messages_conversation"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "buddy_module_messages"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "buddy_module_conversations"`);
	}
}
