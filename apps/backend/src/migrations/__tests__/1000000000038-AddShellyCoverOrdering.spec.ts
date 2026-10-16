import { AddShellyCoverOrdering1000000000038 } from '../1000000000038-AddShellyCoverOrdering';
import { SqliteDataSource } from '../../common/database/sqlite-data-source';
import { ShellyCoverOrderingEntity } from '../../plugins/devices-shelly-ng/entities/shelly-cover-ordering.entity';
import { ShellyCoverOrderingService } from '../../plugins/devices-shelly-ng/services/shelly-cover-ordering.service';

describe('incremental cover ordering journal', () => {
	it('installs on an existing database, fences duplicate/restarted writers and cannot drop unresolved execution', async () => {
		const db = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [ShellyCoverOrderingEntity],
		}).initialize();
		const runner = db.createQueryRunner();
		const migration = new AddShellyCoverOrdering1000000000038();
		try {
			await db.query('CREATE TABLE existing_installation (id integer PRIMARY KEY)');
			await db.query('INSERT INTO existing_installation (id) VALUES (1)');
			await migration.up(runner);
			const first = new ShellyCoverOrderingService(db.getRepository(ShellyCoverOrderingEntity));
			const token = await first.reserve('AABBCC|cover:0');
			expect(token).toBeTruthy();
			const restarted = new ShellyCoverOrderingService(db.getRepository(ShellyCoverOrderingEntity));
			expect(await restarted.blocked('AABBCC|cover:0')).toBe(true);
			expect(await restarted.reserve('AABBCC|cover:0')).toBeNull();
			await restarted.settle('AABBCC|cover:0', 'other-generation');
			expect(await restarted.blocked('AABBCC|cover:0')).toBe(true);
			await expect(migration.down(runner)).rejects.toThrow('unresolved');
			await first.settle('AABBCC|cover:0', token);
			await migration.down(runner);
			expect(await runner.hasTable('devices_shelly_ng_cover_ordering')).toBe(false);
			expect(await db.query('SELECT id FROM existing_installation')).toEqual([{ id: 1 }]);
		} finally {
			await runner.release();
			await db.destroy();
		}
	});
});
