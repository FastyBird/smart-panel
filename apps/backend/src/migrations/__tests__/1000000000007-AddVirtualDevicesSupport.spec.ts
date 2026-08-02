import { DataSource, QueryRunner } from 'typeorm';

import { AddVirtualDevicesSupport1000000000007 } from '../1000000000007-AddVirtualDevicesSupport';

/**
 * Revert-then-reapply is a supported workflow (`typeorm:migration:revert` followed by
 * `typeorm:migration:run`), and this migration used to break it: `down()` dropped only the two
 * indexes and left `hidden`, `valueOrigin` and `sourcePropertyId` behind, so the very next `up()`
 * failed on `duplicate column name` at its first `ADD COLUMN`.
 *
 * Run against a real sqlite DataSource rather than a mocked QueryRunner, because the claim under test
 * is about what SQLite itself accepts. Earlier migrations in this repo assert in comments that SQLite
 * cannot DROP COLUMN — true before 3.35 (2021), not true of the 3.44 the bundled driver actually
 * carries — and the restrictions that do still apply (a column may not be dropped while it is
 * indexed) are exactly what a mock would fail to model. Only the two tables the migration touches are
 * created, with the columns and constraints that matter to those restrictions.
 *
 * Lives in `__tests__/` rather than beside the migration, unlike every other unit spec in this repo,
 * because TypeORM's migration glob (`src/migrations/*{.ts,.js}`, in both dataSource.ts and
 * app.module.ts) imports *every* file it matches. A spec sitting directly in that directory is
 * therefore loaded whenever the app builds its DataSource — which is what `generate:openapi` does, so
 * it took the CI setup step down with `describe is not defined`, and what the e2e suite does, where it
 * surfaced as "Cannot add a test after tests have started running". The glob's `*` does not cross a
 * directory separator, so one level down is out of its reach.
 */
describe('AddVirtualDevicesSupport1000000000007', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new AddVirtualDevicesSupport1000000000007();

	const columnNames = async (table: string): Promise<string[]> => {
		const rows = (await queryRunner.query(`PRAGMA table_info("${table}")`)) as { name: string }[];

		return rows.map((row) => row.name);
	};

	const indexNames = async (): Promise<string[]> => {
		const rows = (await queryRunner.query(`SELECT name FROM sqlite_master WHERE type = 'index'`)) as {
			name: string;
		}[];

		return rows.map((row) => row.name);
	};

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });

		await dataSource.initialize();

		queryRunner = dataSource.createQueryRunner();

		// The pre-migration shape of the two tables, reduced to what the migration's own statements and
		// SQLite's DROP COLUMN restrictions depend on: a primary key on each, and the unique index on
		// the properties table that `sourcePropertyId` sits alongside.
		await queryRunner.query(
			`CREATE TABLE "devices_module_devices" ("id" varchar PRIMARY KEY NOT NULL, "identifier" varchar, "type" varchar NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_devices_identifier_type" ON "devices_module_devices" ("identifier", "type")`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" ("id" varchar PRIMARY KEY NOT NULL, "identifier" varchar, "channelId" varchar)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_channels_properties_identifier_type" ON "devices_module_channels_properties" ("identifier", "channelId")`,
		);
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('adds the hidden flag and both virtual property columns', async () => {
		await migration.up(queryRunner);

		expect(await columnNames('devices_module_devices')).toContain('hidden');
		expect(await columnNames('devices_module_channels_properties')).toEqual(
			expect.arrayContaining(['valueOrigin', 'sourcePropertyId']),
		);
	});

	it('removes every column it added when reverted', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		expect(await columnNames('devices_module_devices')).not.toContain('hidden');
		expect(await columnNames('devices_module_channels_properties')).not.toContain('valueOrigin');
		expect(await columnNames('devices_module_channels_properties')).not.toContain('sourcePropertyId');
	});

	it('removes both of its indexes when reverted, and leaves the pre-existing ones alone', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		const indexes = await indexNames();

		expect(indexes).not.toContain('IDX_devices_hidden');
		expect(indexes).not.toContain('IDX_channels_properties_sourcePropertyId');
		expect(indexes).toEqual(
			expect.arrayContaining(['UQ_devices_identifier_type', 'UQ_channels_properties_identifier_type']),
		);
	});

	// The regression itself: this is what `typeorm:migration:revert && typeorm:migration:run` does, and
	// it used to fail on `SQLITE_ERROR: duplicate column name: hidden`.
	it('can be reapplied after a revert', async () => {
		await migration.up(queryRunner);
		await migration.down(queryRunner);

		await expect(migration.up(queryRunner)).resolves.toBeUndefined();

		expect(await columnNames('devices_module_devices')).toContain('hidden');
		expect(await indexNames()).toEqual(
			expect.arrayContaining(['IDX_devices_hidden', 'IDX_channels_properties_sourcePropertyId']),
		);
	});
});
