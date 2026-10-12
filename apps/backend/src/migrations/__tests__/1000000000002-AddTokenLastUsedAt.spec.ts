import { DataSource } from 'typeorm';

import { AddTokenLastUsedAt1000000000002 } from '../1000000000002-AddTokenLastUsedAt';

describe('AddTokenLastUsedAt migration round trip', () => {
	it('preserves token rows when reverting and running again', async () => {
		const database = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
		const runner = database.createQueryRunner();
		const migration = new AddTokenLastUsedAt1000000000002();

		try {
			await runner.query(`CREATE TABLE "auth_module_tokens" ("id" varchar PRIMARY KEY, "token" varchar NOT NULL)`);
			await runner.query(`INSERT INTO "auth_module_tokens" ("id", "token") VALUES ('token-id', 'stored-token')`);
			await migration.up(runner);
			await runner.query(`UPDATE "auth_module_tokens" SET "lastUsedAt" = '2026-10-12 12:00:00'`);
			await migration.down(runner);

			expect((await runner.getTable('auth_module_tokens'))?.findColumnByName('lastUsedAt')).toBeUndefined();
			await migration.up(runner);
			expect(await runner.query(`SELECT * FROM "auth_module_tokens"`)).toEqual([
				{ id: 'token-id', token: 'stored-token', lastUsedAt: null },
			]);
		} finally {
			await runner.release();
			await database.destroy();
		}
	});
});
