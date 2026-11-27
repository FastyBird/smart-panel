import { DataSource } from 'typeorm';

import { AddShellyV1AdoptedIdentity1000000000062 } from '../1000000000062-AddShellyV1AdoptedIdentity';
import { DeviceZoneEntity } from '../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../modules/devices/entities/devices.entity';
import { SpaceEntity } from '../../modules/spaces/entities/space.entity';
import { ShellyV1AdoptedIdentityEntity } from '../../plugins/devices-shelly-v1/entities/shelly-v1-adopted-identity.entity';
import { ShellyV1AdoptedIdentityService } from '../../plugins/devices-shelly-v1/services/shelly-v1-adopted-identity.service';

describe('Gen1 adopted hardware identity upgrade', () => {
	it('leaves legacy short identifiers unverified, pins one MAC on adoption, and forgets it on deletion', async () => {
		const database = new DataSource({
			type: 'sqlite',
			database: ':memory:',
			entities: [
				ShellyV1AdoptedIdentityEntity,
				DeviceEntity,
				DeviceControlEntity,
				ChannelEntity,
				ChannelControlEntity,
				ChannelPropertyEntity,
				DeviceZoneEntity,
				SpaceEntity,
			],
		});
		await database.initialize();
		const runner = database.createQueryRunner();
		try {
			await runner.query('CREATE TABLE devices_module_devices (id varchar PRIMARY KEY, identifier varchar)');
			await runner.query("INSERT INTO devices_module_devices VALUES ('legacy', 'shelly1-DDEEFF')");
			const migration = new AddShellyV1AdoptedIdentity1000000000062();
			await migration.up(runner);
			const pins = new ShellyV1AdoptedIdentityService(database.getRepository(ShellyV1AdoptedIdentityEntity));
			await expect(pins.expected('legacy', 'DDEEFF')).resolves.toBeNull();
			await expect(pins.expected('direct', 'shelly1-AABBCCDDEEFF')).resolves.toBe('AABBCCDDEEFF');
			await expect(pins.adopt('legacy', 'DDEEFF', '123456789ABC')).resolves.toBeNull();
			await expect(pins.adopt('legacy', 'DDEEFF', 'DDEEFF')).resolves.toBeNull();
			await expect(pins.adopt('legacy', 'DDEEFF', 'aabbccddeeff')).resolves.toBe('AABBCCDDEEFF');
			await expect(pins.adopt('legacy', 'DDEEFF', '112233DDEEFF')).resolves.toBe('AABBCCDDEEFF');
			await expect(pins.adopt('legacy', 'DDEEFF', undefined)).resolves.toBe('AABBCCDDEEFF');
			await expect(pins.expected('legacy', 'shelly1-112233DDEEFF')).resolves.toBeNull();
			await runner.query("DELETE FROM devices_module_devices WHERE id = 'legacy'");
			await runner.query("INSERT INTO devices_module_devices VALUES ('legacy', 'shelly1-DDEEFF')");
			await expect(pins.expected('legacy', 'DDEEFF')).resolves.toBeNull();
			await migration.down(runner);
			expect(await runner.hasTable('devices_shelly_v1_adopted_identities')).toBe(false);
		} finally {
			await runner.release();
			await database.destroy();
		}
	});
});
