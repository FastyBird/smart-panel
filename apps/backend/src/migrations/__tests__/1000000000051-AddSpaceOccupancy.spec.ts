import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AddSpaceOccupancy1000000000051 } from '../1000000000051-AddSpaceOccupancy';
import { SqliteDataSource } from '../../common/database/sqlite-data-source';

it('upgrades an existing installation without seeds or actuation, persists across reopen, and cascades deletion', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'space-occupancy-'));
	const options = { type: 'sqlite' as const, database: join(directory, 'database.sqlite') };
	let database = await new SqliteDataSource(options).initialize();
	try {
		await database.query('CREATE TABLE spaces_module_spaces (id varchar PRIMARY KEY NOT NULL, type varchar NOT NULL)');
		await database.query('CREATE TABLE spaces_module_space_roles (id varchar PRIMARY KEY NOT NULL, selection text)');
		await database.query("INSERT INTO spaces_module_spaces VALUES ('room','room'),('zone','zone'),('floor','floor')");
		await database.query("INSERT INTO spaces_module_space_roles VALUES ('manual','original')");
		const runner = database.createQueryRunner();
		try {
			await new AddSpaceOccupancy1000000000051().up(runner);
		} finally {
			await runner.release();
		}
		expect(
			await database.query(
				'SELECT spaceId,enabled,sensorPropertyIds,vacancyTimeoutSeconds,status FROM spaces_home_control_occupancy ORDER BY spaceId',
			),
		).toEqual([
			{ spaceId: 'room', enabled: 0, sensorPropertyIds: '[]', vacancyTimeoutSeconds: 900, status: 'unknown' },
			{ spaceId: 'zone', enabled: 0, sensorPropertyIds: '[]', vacancyTimeoutSeconds: 900, status: 'unknown' },
		]);
		expect(await database.query('SELECT * FROM spaces_module_space_roles')).toEqual([
			{ id: 'manual', selection: 'original' },
		]);
		await database.query('UPDATE spaces_home_control_occupancy SET manualOverride = 1 WHERE spaceId = ?', ['room']);
		await expect(
			database.query("INSERT INTO spaces_home_control_occupancy(id,spaceId) VALUES ('duplicate','room')"),
		).rejects.toThrow();
		await expect(
			database.query("INSERT INTO spaces_home_control_occupancy(id,spaceId) VALUES ('missing','missing')"),
		).rejects.toThrow();
		await database.destroy();
		database = await new SqliteDataSource(options).initialize();
		expect(
			await database.query("SELECT manualOverride FROM spaces_home_control_occupancy WHERE spaceId='room'"),
		).toEqual([{ manualOverride: 1 }]);
		await database.query("DELETE FROM spaces_module_spaces WHERE id='room'");
		expect(await database.query('SELECT spaceId FROM spaces_home_control_occupancy')).toEqual([{ spaceId: 'zone' }]);
		const down = database.createQueryRunner();
		try {
			await new AddSpaceOccupancy1000000000051().down(down);
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
