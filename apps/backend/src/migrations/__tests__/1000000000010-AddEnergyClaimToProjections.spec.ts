import { DataSource, QueryRunner } from 'typeorm';

import { AddEnergyClaimToProjections1000000000010 } from '../1000000000010-AddEnergyClaimToProjections';

/**
 * The backfill is the whole risk in this migration: after it runs, one projection per meter is
 * accountable for that meter's kWh, and everything downstream trusts that. Awarding it to the wrong
 * one is not visible until a room's energy is quietly wrong.
 *
 * Run against a real sqlite DataSource for the same reason the sibling spec gives — the claims are
 * about what SQLite itself does with a partial unique index and a window function, which a mocked
 * QueryRunner cannot model — and lives in `__tests__/` because TypeORM's migration glob imports every
 * file directly beside a migration.
 */
describe('AddEnergyClaimToProjections1000000000010', () => {
	let dataSource: DataSource;
	let queryRunner: QueryRunner;

	const migration = new AddEnergyClaimToProjections1000000000010();

	const property = async (
		id: string,
		category: string,
		channelId: string,
		options: { type?: string; source?: string; createdAt?: string } = {},
	): Promise<void> => {
		await queryRunner.query(
			`INSERT INTO "devices_module_channels_properties"
			 ("id", "createdAt", "category", "type", "channelId", "sourcePropertyId")
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				id,
				options.createdAt ?? '2026-01-01 00:00:00',
				category,
				options.type ?? 'mock',
				channelId,
				options.source ?? null,
			],
		);
	};

	const channel = async (id: string, category: string): Promise<void> => {
		await queryRunner.query(`INSERT INTO "devices_module_channels" ("id", "category") VALUES (?, ?)`, [id, category]);
	};

	const claims = async (): Promise<Record<string, string | null>> => {
		const rows = (await queryRunner.query(
			`SELECT "id", "energyClaimPropertyId" FROM "devices_module_channels_properties" WHERE "type" = 'virtual'`,
		)) as { id: string; energyClaimPropertyId: string | null }[];

		return Object.fromEntries(rows.map((row) => [row.id, row.energyClaimPropertyId]));
	};

	beforeEach(async () => {
		dataSource = new DataSource({ type: 'sqlite', database: ':memory:', entities: [], synchronize: false });

		await dataSource.initialize();

		queryRunner = dataSource.createQueryRunner();

		await queryRunner.query(
			`CREATE TABLE "devices_module_channels" ("id" varchar PRIMARY KEY NOT NULL, "category" varchar NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE TABLE "devices_module_channels_properties" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
				"category" varchar NOT NULL,
				"type" varchar NOT NULL,
				"channelId" varchar,
				"sourcePropertyId" varchar
			)`,
		);

		// The physical side: one ordinary meter, one generation meter, one grid-import meter, and one
		// `consumption` sitting in a `generic` channel — which the ingestion does not recognise as a
		// meter on its own, and which is exactly why a projection of it may become one.
		await channel('meter-channel', 'electrical_energy');
		await channel('generic-channel', 'generic');
		await property('meter', 'consumption', 'meter-channel');
		await property('grid-meter', 'grid_import', 'meter-channel');
		await property('unrecognised-meter', 'consumption', 'generic-channel');

		// The virtual side.
		await channel('virtual-energy-a', 'electrical_energy');
		await channel('virtual-energy-b', 'electrical_energy');
		await channel('virtual-export', 'electrical_energy');
		await channel('virtual-light', 'light');
	});

	afterEach(async () => {
		await queryRunner.release();
		await dataSource.destroy();
	});

	it('awards a meter claimed twice to the older projection', async () => {
		await property('younger', 'consumption', 'virtual-energy-a', {
			type: 'virtual',
			source: 'meter',
			createdAt: '2026-03-01 00:00:00',
		});
		await property('older', 'consumption', 'virtual-energy-b', {
			type: 'virtual',
			source: 'meter',
			createdAt: '2026-02-01 00:00:00',
		});

		await migration.up(queryRunner);

		expect(await claims()).toEqual({ older: 'meter', younger: null });
	});

	// The case `wasIngestedAsSource()` cannot see: the source is not a meter anywhere else, so nothing
	// skips these projections and both of them ingest today. The claim is what stops the second.
	it('claims a source the ingestion would not recognise on its own', async () => {
		await property('first', 'consumption', 'virtual-energy-a', {
			type: 'virtual',
			source: 'unrecognised-meter',
			createdAt: '2026-02-01 00:00:00',
		});
		await property('second', 'consumption', 'virtual-energy-b', {
			type: 'virtual',
			source: 'unrecognised-meter',
			createdAt: '2026-03-01 00:00:00',
		});

		await migration.up(queryRunner);

		expect(await claims()).toEqual({ first: 'unrecognised-meter', second: null });
	});

	// Age alone is the wrong rule. A projection that changes what the reading means — import presented
	// as export — is one the new persistence refuses, and handing it the claim would keep the room's
	// summary wrong in the way this migration exists to fix.
	it('passes over an older projection that changes the meaning of the reading', async () => {
		await property('cross-type', 'grid_export', 'virtual-export', {
			type: 'virtual',
			source: 'grid-meter',
			createdAt: '2026-02-01 00:00:00',
		});
		await property('faithful', 'grid_import', 'virtual-energy-a', {
			type: 'virtual',
			source: 'grid-meter',
			createdAt: '2026-03-01 00:00:00',
		});

		await migration.up(queryRunner);

		expect(await claims()).toEqual({ 'cross-type': null, faithful: 'grid-meter' });
	});

	it('leaves a meter unclaimed when no projection of it is admissible', async () => {
		await property('only-cross-type', 'grid_export', 'virtual-export', {
			type: 'virtual',
			source: 'grid-meter',
			createdAt: '2026-02-01 00:00:00',
		});

		await migration.up(queryRunner);

		expect(await claims()).toEqual({ 'only-cross-type': null });
	});

	// A projection into a slot the ingestion never treats as energy is not a meter claimant at all.
	it('claims nothing for a projection into a slot that carries no energy', async () => {
		await property('switch', 'on', 'virtual-light', {
			type: 'virtual',
			source: 'meter',
			createdAt: '2026-02-01 00:00:00',
		});

		await migration.up(queryRunner);

		expect(await claims()).toEqual({ switch: null });
	});

	// What makes the claim a fact rather than a convention: a second claimant is refused by the
	// database, whatever raced its way there.
	it('refuses a second claim on the same meter', async () => {
		// Dated so the winner is not decided by the id tiebreak: the assertion below is about the index
		// refusing the *other* row, which is only a refusal if that row does not already hold it.
		await property('holder', 'consumption', 'virtual-energy-a', {
			type: 'virtual',
			source: 'meter',
			createdAt: '2026-02-01 00:00:00',
		});
		await property('contender', 'consumption', 'virtual-energy-b', {
			type: 'virtual',
			source: 'meter',
			createdAt: '2026-03-01 00:00:00',
		});

		await migration.up(queryRunner);

		expect(await claims()).toEqual({ holder: 'meter', contender: null });

		await expect(
			queryRunner.query(
				`UPDATE "devices_module_channels_properties" SET "energyClaimPropertyId" = 'meter' WHERE "id" = 'contender'`,
			),
		).rejects.toThrow(/UNIQUE constraint failed/);
	});

	// Revert-then-reapply is a supported workflow, and the index has to go with the column or the next
	// `up()` fails on a name that is still taken.
	it('reverts cleanly enough to be applied again', async () => {
		await property('holder', 'consumption', 'virtual-energy-a', { type: 'virtual', source: 'meter' });

		await migration.up(queryRunner);
		await migration.down(queryRunner);
		await migration.up(queryRunner);

		expect(await claims()).toEqual({ holder: 'meter' });
	});
});
