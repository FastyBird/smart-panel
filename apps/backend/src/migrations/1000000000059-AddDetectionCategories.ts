import { MigrationInterface, QueryRunner } from 'typeorm';

import { extendCategoryCheck, reduceCategoryCheck } from './utils/category-check.utils';

/**
 * Allows the object/sound detection channel categories and the object/sound type property categories.
 *
 * The category CHECK lists are edited in place in the stored CREATE TABLE text (SQLite's documented procedure for
 * changing a CHECK without touching table content). The tables are deliberately not rebuilt: the catalogBirth column,
 * its allocation triggers and the thermostat creation catalog verifier depend on stable rowids and on the exact
 * stored table and trigger SQL (migrations 048, 049 and 054).
 *
 * Atomicity: the migration keeps TypeORM's default transaction handling (the app uses migrationsTransactionMode
 * 'each'), so the schema rewrite, the integrity check and the migration-history row commit or roll back together. A
 * failed history write therefore leaves the CHECK lists untouched and the next run retries cleanly. PRAGMA
 * writable_schema, the sqlite_master updates and the schema_version bump are valid inside that transaction. When run
 * without an outer transaction (direct up()/down() calls) inTransaction() opens and commits its own.
 *
 * Ordering hazard: the stored CHECK lists must be rewritten before any row is written in the same transaction. A schema
 * reload after writes that fire the FTS5 home search triggers can make integrity_check report a malformed search index.
 */
const CATEGORIES: readonly (readonly [string, readonly string[]])[] = [
	['devices_module_channels', ['object_detection', 'sound_detection']],
	['devices_module_channels_properties', ['object_type', 'sound_type']],
];

type Rewrite = (tableSql: string, values: readonly string[]) => string;

export class AddDetectionCategories1000000000059 implements MigrationInterface {
	name = 'AddDetectionCategories1000000000059';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await this.inTransaction(queryRunner, async () => {
			await this.rewriteChecks(queryRunner, extendCategoryCheck);
			await this.assertIntegrity(queryRunner);
		});
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await this.inTransaction(queryRunner, async () => {
			// Rewrite the CHECK lists before touching rows (see the FTS5 ordering note in the class docblock).
			await this.rewriteChecks(queryRunner, reduceCategoryCheck);

			for (const [table, values] of CATEGORIES) {
				const list = values.map((value) => `'${value}'`).join(',');

				await queryRunner.query(`UPDATE "${table}" SET "category" = 'generic' WHERE "category" IN (${list})`);
			}

			await this.assertIntegrity(queryRunner);
		});
	}

	private async inTransaction(queryRunner: QueryRunner, work: () => Promise<void>): Promise<void> {
		let transactionStarted = false;

		try {
			if (!queryRunner.isTransactionActive) {
				await queryRunner.startTransaction();
				transactionStarted = true;
			}

			await work();

			if (transactionStarted) {
				await queryRunner.commitTransaction();
			}
		} catch (error) {
			if (transactionStarted) {
				await queryRunner.rollbackTransaction();
			}

			throw error;
		}
	}

	private async rewriteChecks(queryRunner: QueryRunner, rewrite: Rewrite): Promise<void> {
		// Compute every new statement first so that an unexpected stored CHECK list throws before any write.
		const updates: { table: string; sql: string }[] = [];

		for (const [table, values] of CATEGORIES) {
			const rows = (await queryRunner.query(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`, [
				table,
			])) as { sql: string | null }[];

			if (rows.length !== 1 || typeof rows[0].sql !== 'string') {
				throw new Error(`Table "${table}" was not found in sqlite_master`);
			}

			updates.push({ table, sql: rewrite(rows[0].sql, values) });
		}

		const versionRows = (await queryRunner.query('PRAGMA schema_version')) as { schema_version: number }[];
		const nextVersion = Number(versionRows[0].schema_version) + 1;

		try {
			await queryRunner.query('PRAGMA writable_schema = ON');

			for (const { table, sql } of updates) {
				await queryRunner.query(`UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = ?`, [sql, table]);
			}

			await queryRunner.query(`PRAGMA schema_version = ${nextVersion}`);
		} finally {
			await queryRunner.query('PRAGMA writable_schema = OFF');
		}
	}

	private async assertIntegrity(queryRunner: QueryRunner): Promise<void> {
		const integrity = (await queryRunner.query('PRAGMA integrity_check')) as { integrity_check: string }[];

		if (integrity.length !== 1 || integrity[0].integrity_check !== 'ok') {
			throw new Error(`Integrity check failed after rewriting the category CHECK lists: ${JSON.stringify(integrity)}`);
		}
	}
}
