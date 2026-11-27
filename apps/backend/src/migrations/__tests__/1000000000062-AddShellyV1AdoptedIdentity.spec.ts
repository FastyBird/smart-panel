import { DataSource } from 'typeorm';

import { AddShellyV1AdoptedIdentity1000000000062 } from '../1000000000062-AddShellyV1AdoptedIdentity';
import { AddShellyV1VerifiedHost1000000000063 } from '../1000000000063-AddShellyV1VerifiedHost';
import { DeviceZoneEntity } from '../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../modules/devices/entities/devices.entity';
import { DeviceStructureLockService } from '../../modules/devices/services/device-structure-lock.service';
import { DevicesService } from '../../modules/devices/services/devices.service';
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
			await runner.query("INSERT INTO devices_module_devices VALUES ('pinned', 'shellyht-ABC123')");
			await runner.query("INSERT INTO devices_shelly_v1_adopted_identities VALUES ('pinned', 'DEADBEABC123')");
			const hosts = new AddShellyV1VerifiedHost1000000000063();
			await hosts.up(runner);
			const pins = new ShellyV1AdoptedIdentityService(
				database.getRepository(ShellyV1AdoptedIdentityEntity),
				{} as DevicesService,
				new DeviceStructureLockService(),
			);
			expect(await pins.findPin('pinned')).toMatchObject({ mac: 'DEADBEABC123', verifiedHost: null });
			await expect(pins.confirmHost('pinned', '112233ABC123', 'first', null)).resolves.toBe(false);
			await expect(pins.confirmHost('pinned', 'DEADBEABC123', 'first', null)).resolves.toBe(true);
			await expect(pins.confirmHost('pinned', 'DEADBEABC123', 'first', null)).resolves.toBe(true);
			await expect(pins.confirmHost('pinned', 'DEADBEABC123', 'second', 'first')).resolves.toBe(true);
			await expect(pins.confirmHost('pinned', 'DEADBEABC123', 'outdated', 'first')).resolves.toBe(false);
			expect(await pins.findPin('pinned')).toMatchObject({ mac: 'DEADBEABC123', verifiedHost: 'second' });
			await expect(pins.expected('legacy', 'DDEEFF')).resolves.toBeNull();
			await expect(pins.expected('direct', 'shelly1-AABBCCDDEEFF')).resolves.toBe('AABBCCDDEEFF');
			await expect(pins.adopt('legacy', 'DDEEFF', '123456789ABC')).resolves.toBeNull();
			await expect(pins.adopt('legacy', 'DDEEFF', 'DDEEFF')).resolves.toBeNull();
			await expect(pins.adopt('legacy', 'DDEEFF', 'aabbccddeeff', 'original')).resolves.toBe('AABBCCDDEEFF');
			await expect(pins.adopt('legacy', 'DDEEFF', '112233DDEEFF', 'foreign')).resolves.toBe('AABBCCDDEEFF');
			expect(await pins.findPin('legacy')).toMatchObject({ verifiedHost: 'original' });
			await expect(pins.adopt('legacy', 'DDEEFF', 'AABBCCDDEEFF', 'confirmed')).resolves.toBe('AABBCCDDEEFF');
			expect(await pins.findPin('legacy')).toMatchObject({ verifiedHost: 'confirmed' });
			await expect(pins.adopt('legacy', 'DDEEFF', undefined)).resolves.toBe('AABBCCDDEEFF');
			await expect(pins.expected('legacy', 'shelly1-112233DDEEFF')).resolves.toBeNull();
			await runner.query("DELETE FROM devices_module_devices WHERE id = 'legacy'");
			await runner.query("INSERT INTO devices_module_devices VALUES ('legacy', 'shelly1-DDEEFF')");
			await expect(pins.expected('legacy', 'DDEEFF')).resolves.toBeNull();
			await hosts.down(runner);
			expect(
				await runner.query("SELECT * FROM devices_shelly_v1_adopted_identities WHERE deviceId = 'pinned'"),
			).toEqual([{ deviceId: 'pinned', mac: 'DEADBEABC123' }]);
			await migration.down(runner);
			expect(await runner.hasTable('devices_shelly_v1_adopted_identities')).toBe(false);
		} finally {
			await runner.release();
			await database.destroy();
		}
	});
});
