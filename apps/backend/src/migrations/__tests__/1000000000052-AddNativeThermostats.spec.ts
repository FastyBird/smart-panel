import { AddNativeThermostats1000000000052 } from '../1000000000052-AddNativeThermostats';
import { SqliteDataSource } from '../../common/database/sqlite-data-source';

it('adds native ownership without touching guarded history and retains released history across reassignment', async () => {
	const database = await new SqliteDataSource({ type: 'sqlite', database: ':memory:' }).initialize();
	const runner = database.createQueryRunner();
	try {
		await runner.query(
			'CREATE TABLE devices_virtual_thermostat_configs (controllerId varchar PRIMARY KEY, revision integer)',
		);
		await runner.query("INSERT INTO devices_virtual_thermostat_configs VALUES ('old-guarded',7)");
		await new AddNativeThermostats1000000000052().up(runner);
		expect(await runner.query('SELECT * FROM devices_virtual_thermostat_configs')).toEqual([
			{ controllerId: 'old-guarded', revision: 7 },
		]);
		const insert = (id: string, physical = 'unit') =>
			runner.query(
				`INSERT INTO devices_virtual_native_thermostats
			(controllerId,sourceDeviceId,physicalIdentity,fingerprint,provider,requested,propertyIds,ownedPropertyIds)
			VALUES (?,?,?,'v1','home-assistant','{}','{}','[]')`,
				[id, 'source', physical],
			);
		await expect(insert('old-guarded')).rejects.toThrow('mutually exclusive');
		await insert('native');
		await expect(insert('other')).rejects.toThrow();
		await expect(insert('renamed-server', 'different-upstream-identity')).rejects.toThrow('sourceDeviceId');
		await expect(runner.query("INSERT INTO devices_virtual_thermostat_configs VALUES ('native',1)")).rejects.toThrow(
			'mutually exclusive',
		);
		await expect(runner.query("UPDATE devices_virtual_native_thermostats SET bindingState='typo'")).rejects.toThrow();
		await runner.query(
			"UPDATE devices_virtual_native_thermostats SET bindingState='released' WHERE controllerId='native'",
		);
		await insert('successor');
		expect(
			await runner.query(
				'SELECT controllerId,bindingState FROM devices_virtual_native_thermostats ORDER BY controllerId',
			),
		).toEqual([
			{ controllerId: 'native', bindingState: 'released' },
			{ controllerId: 'successor', bindingState: 'bound' },
		]);
		await new AddNativeThermostats1000000000052().down(runner);
		expect(await runner.query('SELECT * FROM devices_virtual_thermostat_configs')).toEqual([
			{ controllerId: 'old-guarded', revision: 7 },
		]);
	} finally {
		await runner.release();
		await database.destroy();
	}
});
