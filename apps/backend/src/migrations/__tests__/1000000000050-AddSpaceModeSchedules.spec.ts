import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AddSpaceModeSchedules1000000000050 } from '../1000000000050-AddSpaceModeSchedules';
import { SqliteDataSource } from '../../common/database/sqlite-data-source';

it('upgrades an existing installation without seeds or actuation, persists across reopen, and cascades deletion', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'space-schedule-'));
	const options = { type: 'sqlite' as const, database: join(directory, 'database.sqlite') };
	let database = await new SqliteDataSource(options).initialize();
	try {
		await database.query('CREATE TABLE spaces_module_spaces (id varchar PRIMARY KEY NOT NULL, type varchar NOT NULL)');
		await database.query('CREATE TABLE spaces_module_space_roles (id varchar PRIMARY KEY NOT NULL, selection text)');
		await database.query("INSERT INTO spaces_module_spaces VALUES ('room','room'),('zone','zone'),('floor','floor')");
		await database.query("INSERT INTO spaces_module_space_roles VALUES ('manual','original')");
		const runner = database.createQueryRunner();
		try {
			await new AddSpaceModeSchedules1000000000050().up(runner);
		} finally {
			await runner.release();
		}
		expect(
			await database.query(
				'SELECT spaceId,enabled,entries,seenOccurrences,cursor FROM spaces_home_control_mode_schedules ORDER BY spaceId',
			),
		).toEqual([
			{ spaceId: 'room', enabled: 0, entries: '[]', seenOccurrences: '{}', cursor: null },
			{ spaceId: 'zone', enabled: 0, entries: '[]', seenOccurrences: '{}', cursor: null },
		]);
		expect(await database.query('SELECT * FROM spaces_module_space_roles')).toEqual([
			{ id: 'manual', selection: 'original', activityRequestedAt: null },
		]);
		await database.query('UPDATE spaces_home_control_mode_schedules SET cursor = 1793610000000 WHERE spaceId = ?', [
			'room',
		]);
		await expect(
			database.query("INSERT INTO spaces_home_control_mode_schedules(id,spaceId) VALUES ('duplicate','room')"),
		).rejects.toThrow();
		await expect(
			database.query("INSERT INTO spaces_home_control_mode_schedules(id,spaceId) VALUES ('missing','missing')"),
		).rejects.toThrow();
		await database.destroy();
		database = await new SqliteDataSource(options).initialize();
		expect(await database.query("SELECT cursor FROM spaces_home_control_mode_schedules WHERE spaceId='room'")).toEqual([
			{ cursor: 1793610000000 },
		]);
		await database.query("DELETE FROM spaces_module_spaces WHERE id='room'");
		expect(await database.query('SELECT spaceId FROM spaces_home_control_mode_schedules')).toEqual([
			{ spaceId: 'zone' },
		]);
		const down = database.createQueryRunner();
		try {
			await new AddSpaceModeSchedules1000000000050().down(down);
		} finally {
			await down.release();
		}
		expect(await database.query('SELECT * FROM spaces_module_space_roles')).toEqual([
			{ id: 'manual', selection: 'original' },
		]);
	} finally {
		if (database.isInitialized) await database.destroy();
		await rm(directory, { recursive: true, force: true });
	}
});
