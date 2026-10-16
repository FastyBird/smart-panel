import { DataSource } from 'typeorm';

import { AddSpaceActivityModes1000000000046 } from '../1000000000046-AddSpaceActivityModes';
import { ActivityMode } from '../../plugins/spaces-home-control/activity/space-activity.constants';
import { defaultActivityConfiguration } from '../../plugins/spaces-home-control/activity/space-activity.defaults';

describe('migration 46 on real SQLite', () => {
	it('backfills room/zone defaults, preserves other roles and reverses incrementally', async () => {
		const database = await new DataSource({ type: 'sqlite', database: ':memory:' }).initialize();
		const runner = database.createQueryRunner();
		try {
			await runner.query(`CREATE TABLE spaces_module_spaces (id varchar PRIMARY KEY, type varchar NOT NULL)`);
			await runner.query(
				`CREATE TABLE spaces_module_space_roles (id varchar PRIMARY KEY, spaceId varchar NOT NULL REFERENCES spaces_module_spaces(id) ON DELETE CASCADE, type varchar NOT NULL, createdAt datetime DEFAULT CURRENT_TIMESTAMP, updatedAt datetime)`,
			);
			await runner.query(
				`INSERT INTO spaces_module_spaces VALUES ('room', 'room'), ('zone', 'zone'), ('entry', 'entry')`,
			);
			await runner.query(
				`INSERT INTO spaces_module_space_roles (id, spaceId, type) VALUES ('old', 'room', 'lighting')`,
			);
			const migration = new AddSpaceActivityModes1000000000046();
			await migration.up(runner);
			const rows = await runner.query(`SELECT * FROM spaces_module_space_roles WHERE type = 'activity_config'`);
			expect(rows).toHaveLength(10);
			for (const mode of Object.values(ActivityMode)) {
				expect(
					JSON.parse(rows.find((row) => row.spaceId === 'room' && row.activityMode === mode).activityConfiguration),
				).toEqual(defaultActivityConfiguration(mode));
			}
			await expect(
				runner.query(
					`INSERT INTO spaces_module_space_roles (id, spaceId, type, activityMode) VALUES ('duplicate', 'room', 'activity_config', 'work')`,
				),
			).rejects.toThrow();
			await migration.down(runner);
			expect(await runner.query(`SELECT id FROM spaces_module_space_roles`)).toEqual([{ id: 'old' }]);
			expect(
				(await runner.getTable('spaces_module_space_roles')).columns.some((column) => column.name === 'activationId'),
			).toBe(false);
		} finally {
			await runner.release();
			await database.destroy();
		}
	});
});
