import { randomUUID } from 'node:crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

/** Incremental STI extension; existing role rows and all prior migrations stay intact. */
export class AddSpaceActivityModes1000000000046 implements MigrationInterface {
	name = 'AddSpaceActivityModes1000000000046';
	private readonly columns: Record<string, string> = {
		activityMode: 'varchar',
		activityEnabled: 'boolean',
		activityOrder: 'integer',
		activityRevision: 'integer',
		activityConfiguration: 'text',
		selectedActivityMode: 'varchar',
		activationId: 'varchar',
		selectedActivityRevision: 'integer',
		activityStatus: 'varchar',
		activityActor: 'varchar',
		activityResults: 'text',
	};
	async up(runner: QueryRunner): Promise<void> {
		for (const [name, type] of Object.entries(this.columns))
			await runner.query(`ALTER TABLE "spaces_module_space_roles" ADD COLUMN "${name}" ${type}`);
		await runner.query(
			`CREATE UNIQUE INDEX "IDX_activity_config_space" ON "spaces_module_space_roles" ("spaceId", "activityMode") WHERE type = 'activity_config'`,
		);
		await runner.query(
			`CREATE UNIQUE INDEX "IDX_activity_state_space" ON "spaces_module_space_roles" ("spaceId") WHERE type = 'activity_state'`,
		);
		const spaces = (await runner.query(`SELECT id FROM "spaces_module_spaces" WHERE type IN ('room', 'zone')`)) as {
			id: string;
		}[];
		for (const space of spaces) {
			for (const [order, mode] of ['work', 'relax', 'sleep', 'entertainment', 'away'].entries()) {
				const configuration = {
					lighting: {
						enabled: true,
						mode: ['sleep', 'away'].includes(mode) ? 'off' : mode === 'work' ? 'work' : 'relax',
					},
					climate: { enabled: false },
					covers: { enabled: mode !== 'away', position: mode === 'work' ? 75 : mode === 'relax' ? 100 : 0 },
					media: { enabled: true, activity: mode === 'relax' ? 'background' : 'off' },
					security: { enabled: false },
				};
				await runner.query(
					`INSERT INTO "spaces_module_space_roles" ("id", "spaceId", "type", "activityMode", "activityEnabled", "activityOrder", "activityRevision", "activityConfiguration") VALUES (?, ?, 'activity_config', ?, 1, ?, 1, ?)`,
					[randomUUID(), space.id, mode, order, JSON.stringify(configuration)],
				);
			}
		}
	}
	async down(runner: QueryRunner): Promise<void> {
		await runner.query(`DELETE FROM "spaces_module_space_roles" WHERE type IN ('activity_config', 'activity_state')`);
		await runner.query(`DROP INDEX "IDX_activity_config_space"`);
		await runner.query(`DROP INDEX "IDX_activity_state_space"`);
		const table = await runner.getTable('spaces_module_space_roles');
		if (table)
			await runner.dropColumns(
				table,
				table.columns.filter((column) => Object.hasOwn(this.columns, column.name)),
			);
	}
}
