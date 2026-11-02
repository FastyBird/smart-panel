import { AddThermostatOverrideClocks1000000000053 } from '../1000000000053-AddThermostatOverrideClocks';
import { SqliteDataSource } from '../../common/database/sqlite-data-source';

it('retains legacy clocks, rejects decreasing/replaced/deleted evidence and preserves recovery on downgrade', async () => {
	const database = await new SqliteDataSource({ type: 'sqlite', database: ':memory:' }).initialize();
	const runner = database.createQueryRunner();
	const migration = new AddThermostatOverrideClocks1000000000053();
	try {
		await runner.query(
			'CREATE TABLE devices_virtual_thermostat_configs (controllerId varchar PRIMARY KEY, comfort text, revision integer)',
		);
		const comfort = JSON.stringify({ temporary_override: { id: 'old', wall_watermark_ms: 1000, status: 'active' } });
		await runner.query('INSERT INTO devices_virtual_thermostat_configs VALUES (?, ?, ?)', ['controller', comfort, 7]);
		await migration.up(runner);
		expect(
			await runner.query('SELECT * FROM devices_virtual_thermostat_configs WHERE controllerId = ?', ['controller']),
		).toEqual([{ controllerId: 'controller', comfort, revision: 7 }]);
		const insert = (watermark: unknown, replace = false) =>
			runner.query(
				`INSERT ${replace ? 'OR REPLACE ' : ''}INTO devices_virtual_thermostat_override_clocks VALUES (?, ?, ?)`,
				['controller', 'old', watermark],
			);
		await insert(1500);
		await expect(insert(1499, true)).rejects.toThrow('cannot decrease');
		await expect(
			runner.query('UPDATE devices_virtual_thermostat_override_clocks SET watermark = 1499'),
		).rejects.toThrow('lower bound');
		await expect(
			runner.query("UPDATE devices_virtual_thermostat_override_clocks SET overrideId = 'other'"),
		).rejects.toThrow('identity');
		await expect(runner.query('DELETE FROM devices_virtual_thermostat_override_clocks')).rejects.toThrow('retained');
		await expect(insert(null, true)).rejects.toThrow();
		await expect(insert('bad', true)).rejects.toThrow();
		await expect(insert(1.5, true)).rejects.toThrow();
		await expect(insert(Number.MAX_SAFE_INTEGER + 1, true)).rejects.toThrow();
		await insert(1600, true);
		await database
			.transaction(async (manager) => {
				await manager.query('UPDATE devices_virtual_thermostat_override_clocks SET watermark = 1700');
				throw new Error('rollback');
			})
			.catch((error) => {
				expect((error as Error).message).toBe('rollback');
			});
		expect(await runner.query('SELECT watermark FROM devices_virtual_thermostat_override_clocks')).toEqual([
			{ watermark: 1600 },
		]);
		const invalidLegacy = [null, 'bad', false].map((value, index) => ({
			controllerId: 'invalid-' + index,
			comfort: JSON.stringify({ temporary_override: { id: 'old', wall_watermark_ms: value, status: 'active' } }),
		}));
		for (const invalid of invalidLegacy) {
			await runner.query('INSERT INTO devices_virtual_thermostat_configs VALUES (?, ?, 7)', [
				invalid.controllerId,
				invalid.comfort,
			]);
			await runner.query('INSERT INTO devices_virtual_thermostat_override_clocks VALUES (?, ?, ?)', [
				invalid.controllerId,
				'old',
				1600,
			]);
		}
		await migration.down(runner);
		for (const invalid of invalidLegacy)
			expect(
				await runner.query('SELECT comfort FROM devices_virtual_thermostat_configs WHERE controllerId = ?', [
					invalid.controllerId,
				]),
			).toEqual([{ comfort: invalid.comfort }]);
		expect(
			await runner.query('SELECT * FROM devices_virtual_thermostat_configs WHERE controllerId = ?', ['controller']),
		).toEqual([
			{
				controllerId: 'controller',
				revision: 7,
				comfort: JSON.stringify({ temporary_override: { id: 'old', wall_watermark_ms: 1600, status: 'active' } }),
			},
		]);
		await migration.up(runner);
		await insert(1700);
		await runner.query('DELETE FROM devices_virtual_thermostat_configs');
		expect(await runner.query('SELECT * FROM devices_virtual_thermostat_override_clocks')).toEqual([]);
	} finally {
		await runner.release();
		await database.destroy();
	}
});
