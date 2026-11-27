import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource } from '../../../common/database/sqlite-data-source';
import { DeviceCategory, EventType } from '../../../modules/devices/devices.constants';
import { DeviceZoneEntity } from '../../../modules/devices/entities/device-zone.entity';
import {
	ChannelControlEntity,
	ChannelEntity,
	ChannelPropertyEntity,
	DeviceControlEntity,
	DeviceEntity,
} from '../../../modules/devices/entities/devices.entity';
import { DeviceProvisionQueueService } from '../../../modules/devices/services/device-provision-queue.service';
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyV1AdoptedIdentityEntity } from '../entities/shelly-v1-adopted-identity.entity';

import { ShellyV1AdoptedIdentityService } from './shelly-v1-adopted-identity.service';
import { ShellyV1AdoptionService } from './shelly-v1-adoption.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

jest.setTimeout(30_000);

describe('atomic Shelly short-ID adoption through the device catalog', () => {
	it('rolls back a failed first pin, retries after reopening the database, and refuses a conflicting adoption', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'shelly-pin-'));
		const file = join(dir, 'devices.sqlite');
		const publications: string[] = [];
		async function open() {
			const db = await new SqliteDataSource({
				type: 'sqlite',
				database: file,
				synchronize: true,
				entities: [
					DeviceEntity,
					DeviceControlEntity,
					ChannelEntity,
					ChannelControlEntity,
					ChannelPropertyEntity,
					SpaceEntity,
					DeviceZoneEntity,
					ShellyV1DeviceEntity,
					ShellyV1AdoptedIdentityEntity,
				],
			}).initialize();
			const events = new EventEmitter2();
			events.on(EventType.DEVICE_CREATED, (device: DeviceEntity) => publications.push(device.id));
			const mapping = new DevicesTypeMapperService();
			mapping.registerMapping({
				type: DEVICES_SHELLY_V1_TYPE,
				class: ShellyV1DeviceEntity,
				createDto: CreateShellyV1DeviceDto,
				updateDto: UpdateShellyV1DeviceDto,
			});
			const lock = new DeviceStructureLockService();
			const devices = new DevicesService(
				db.getRepository(DeviceEntity),
				db.getRepository(SpaceEntity),
				mapping,
				undefined,
				undefined,
				undefined,
				undefined,
				lock,
				db,
				events,
			);
			const pins = new ShellyV1AdoptedIdentityService(db.getRepository(ShellyV1AdoptedIdentityEntity), devices, lock);
			return { db, devices, pins };
		}
		let f = await open();
		const a = {
			type: DEVICES_SHELLY_V1_TYPE,
			identifier: 'DDEEFF',
			hostname: 'host-a',
			name: 'Original',
			category: DeviceCategory.SWITCHER,
		} as const;
		const b = { ...a, hostname: 'host-b', name: 'Other' };
		try {
			await f.db.query(
				"CREATE TRIGGER refuse_pin BEFORE INSERT ON devices_shelly_v1_adopted_identities BEGIN SELECT RAISE(ABORT, 'pin unavailable'); END",
			);
			await expect(f.pins.createDevice(a, 'AABBCCDDEEFF')).rejects.toThrow('pin unavailable');
			expect(await f.db.getRepository(DeviceEntity).count()).toBe(0);
			expect(await f.db.getRepository(ShellyV1AdoptedIdentityEntity).count()).toBe(0);
			expect(publications).toEqual([]);
			await f.db.query('DROP TRIGGER refuse_pin');
			await f.db.destroy();
			f = await open();

			const [first, second] = await Promise.allSettled([
				f.pins.createDevice(a, 'AABBCCDDEEFF'),
				f.pins.createDevice(b, '112233DDEEFF'),
			]);
			expect(first.status).toBe('fulfilled');
			expect(second.status).toBe('rejected');
			const saved = await f.db.getRepository(ShellyV1DeviceEntity).findOneByOrFail({ identifier: a.identifier });
			expect(publications).toEqual([saved.id]);
			expect(await f.db.getRepository(ShellyV1AdoptedIdentityEntity).find()).toEqual([
				expect.objectContaining({ deviceId: saved.id, mac: 'AABBCCDDEEFF', verifiedHost: 'host-a' }),
			]);
			const adoption = new ShellyV1AdoptionService(
				f.devices,
				f.pins,
				{ getDeviceInfo: () => Promise.resolve({ mac: '112233DDEEFF' }) } as unknown as ShellyV1HttpClientService,
				new DeviceProvisionQueueService(),
			);
			await expect(adoption.adopt([b])).resolves.toEqual([
				expect.objectContaining({ status: 'failed', deviceId: saved.id }),
			]);
			expect(await f.db.getRepository(ShellyV1DeviceEntity).findOneByOrFail({ id: saved.id })).toMatchObject({
				name: 'Original',
				hostname: 'host-a',
			});
			expect(await f.pins.findPin(saved.id)).toMatchObject({ mac: 'AABBCCDDEEFF', verifiedHost: 'host-a' });
		} finally {
			if (f.db.isInitialized) await f.db.destroy();
			await rm(dir, { recursive: true, force: true });
		}
	});
});
