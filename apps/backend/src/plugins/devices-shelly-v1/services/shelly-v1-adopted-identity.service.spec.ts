import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { SqliteDataSource, isSqliteTransactionActive } from '../../../common/database/sqlite-data-source';
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

import { ShellyV1AdoptedIdentityService, shellyV1PinMatches } from './shelly-v1-adopted-identity.service';
import { ShellyV1AdoptionService } from './shelly-v1-adoption.service';
import { ShellyV1HttpClientService } from './shelly-v1-http-client.service';

jest.setTimeout(30_000);

async function open(file = ':memory:', events = new EventEmitter2()) {
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
	const mapping = new DevicesTypeMapperService();
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
	mapping.registerMapping({
		type: DEVICES_SHELLY_V1_TYPE,
		class: ShellyV1DeviceEntity,
		createDto: CreateShellyV1DeviceDto,
		updateDto: UpdateShellyV1DeviceDto,
		beforeUpdate: (device, previous) => pins.validateIdentifier(device, previous),
	});
	return { db, devices, pins, events };
}

const a = {
	type: DEVICES_SHELLY_V1_TYPE,
	identifier: 'DDEEFF',
	hostname: 'host-a',
	name: 'Original',
	category: DeviceCategory.SWITCHER,
} as const;
const b = { ...a, hostname: 'host-b', name: 'Other' };
const mac = 'AABBCCDDEEFF';

function wizard(pins: ShellyV1AdoptedIdentityService, getDeviceInfo: () => Promise<{ mac: string } | null>) {
	return new ShellyV1AdoptionService(
		pins,
		{ getDeviceInfo } as unknown as ShellyV1HttpClientService,
		new DeviceProvisionQueueService(),
	);
}

function deferred<T>() {
	let resolve: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe('atomic Shelly short-ID adoption through the device catalog', () => {
	it('rolls back a failed first pin, retries after reopening the database, and refuses a conflicting adoption', async () => {
		const dir = await mkdtemp(join(tmpdir(), 'shelly-pin-'));
		const file = join(dir, 'devices.sqlite');
		const publications: string[] = [];
		const events = new EventEmitter2();
		events.on(EventType.DEVICE_CREATED, (device: DeviceEntity) => publications.push(device.id));
		let f = await open(file, events);
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
			f = await open(file, events);

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

describe('Shelly identity changes through the catalog', () => {
	let f: Awaited<ReturnType<typeof open>>;
	let updates: jest.Mock;
	beforeEach(async () => {
		f = await open();
		updates = jest.fn();
		f.events.on(EventType.DEVICE_UPDATED, updates);
	});
	afterEach(async () => {
		await f.db.destroy();
	});

	it.each([false, true])(
		'rejects a competing verified move during the probe, including a move back (ABA=%s)',
		async (moveBack) => {
			const device = await f.pins.createDevice(a, mac);
			const started = deferred<void>();
			const response = deferred<{ mac: string }>();
			const adopting = wizard(f.pins, () => {
				started.resolve();
				return response.promise;
			}).adopt([b]);
			await started.promise;
			await expect(f.pins.confirmHost(device.id, mac, 'host-c', a.hostname, 1)).resolves.toBe(true);
			if (moveBack) await expect(f.pins.confirmHost(device.id, mac, a.hostname, 'host-c', 2)).resolves.toBe(true);
			response.resolve({ mac });
			await expect(adopting).resolves.toEqual([expect.objectContaining({ status: 'failed', deviceId: device.id })]);
			expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
				hostname: a.hostname,
				pin: { mac, verifiedHost: moveBack ? a.hostname : 'host-c', revision: moveBack ? 3 : 2 },
			});
			expect(updates).not.toHaveBeenCalled();
		},
	);

	it('preserves an intervening catalog edit even when its pin did not change', async () => {
		const device = await f.pins.createDevice(a, mac);
		const started = deferred<void>();
		const response = deferred<{ mac: string }>();
		const adopting = wizard(f.pins, () => {
			started.resolve();
			return response.promise;
		}).adopt([b]);
		await started.promise;
		await f.devices.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(device.id, {
			type: a.type,
			hostname: 'operator-host',
			password: 'new-password',
		});
		response.resolve({ mac });
		await expect(adopting).resolves.toEqual([expect.objectContaining({ status: 'failed' })]);
		expect(await f.db.getRepository(ShellyV1DeviceEntity).findOneByOrFail({ id: device.id })).toMatchObject({
			name: a.name,
			hostname: 'operator-host',
			password: 'new-password',
		});
		expect(await f.pins.findPin(device.id)).toMatchObject({ verifiedHost: a.hostname, revision: 1 });
		expect(updates).toHaveBeenCalledTimes(1);
	});

	it('preserves the winner of first adoption even when the original probe returned the same full MAC', async () => {
		const started = deferred<void>();
		const response = deferred<{ mac: string }>();
		const adopting = wizard(f.pins, () => {
			started.resolve();
			return response.promise;
		}).adopt([b]);
		await started.promise;
		const winner = await f.pins.createDevice(a, mac);
		response.resolve({ mac });
		await expect(adopting).resolves.toEqual([expect.objectContaining({ status: 'failed', deviceId: winner.id })]);
		expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
			id: winner.id,
			hostname: a.hostname,
			pin: { verifiedHost: a.hostname, revision: 1 },
		});
		expect(updates).not.toHaveBeenCalled();
	});

	it('refuses a delayed first binding after another request pins the same legacy row', async () => {
		const device = await f.pins.createDevice(a);
		const started = deferred<void>();
		const response = deferred<{ mac: string }>();
		const pending = wizard(f.pins, () => {
			started.resolve();
			return response.promise;
		}).adopt([b]);
		await started.promise;
		const current = wizard(f.pins, () => Promise.resolve({ mac }));
		await expect(current.adopt([a])).resolves.toEqual([expect.objectContaining({ status: 'updated' })]);
		response.resolve({ mac });
		await expect(pending).resolves.toEqual([expect.objectContaining({ status: 'failed', deviceId: device.id })]);
		expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
			hostname: a.hostname,
			pin: { mac, verifiedHost: a.hostname, revision: 1 },
		});
		expect(updates).toHaveBeenCalledTimes(1);
	});

	it('rolls back the catalog move and pin when the discovery peer changes immediately before native commit', async () => {
		await f.pins.createDevice(a, mac);
		const state = await f.pins.captureDevice(a.identifier);
		let peerCurrent = true;
		f.db.subscribers.push({
			beforeTransactionCommit: () => {
				peerCurrent = false;
			},
		});
		const assertPeer = () => {
			if (!peerCurrent) throw new Error('Discovery peer changed');
		};
		await expect(f.pins.updateDevice(state, { type: a.type, hostname: b.hostname }, mac, assertPeer)).rejects.toThrow();
		expect(peerCurrent).toBe(false);
		expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
			hostname: a.hostname,
			pin: { mac, verifiedHost: a.hostname, revision: 1 },
		});
		expect(updates).not.toHaveBeenCalled();
	});

	it('requires the pinned MAC at an edited catalog host before adoption can change credentials', async () => {
		const device = await f.pins.createDevice(a, mac);
		await f.devices.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(device.id, {
			type: a.type,
			hostname: b.hostname,
		});
		const offline = wizard(f.pins, () => Promise.resolve(null));
		await expect(offline.adopt([{ ...b, password: 'new' }])).resolves.toEqual([
			expect.objectContaining({ status: 'failed' }),
		]);
		expect(await f.db.getRepository(ShellyV1DeviceEntity).findOneByOrFail({ id: device.id })).toMatchObject({
			hostname: b.hostname,
			name: a.name,
			password: null,
		});
		expect(await f.pins.findPin(device.id)).toMatchObject({ mac, verifiedHost: a.hostname, revision: 1 });
		expect(updates).toHaveBeenCalledTimes(1);
	});

	it.each([false, true])(
		'rolls back both writes on catalog failure and publishes a fresh verified move after commit (pinned=%s)',
		async (pinned) => {
			const device = await f.pins.createDevice(a, pinned ? mac : undefined);
			await f.db.query(
				"CREATE TRIGGER reject_move BEFORE UPDATE ON devices_module_devices BEGIN SELECT RAISE(ABORT, 'catalog refused move'); END",
			);
			const adoption = wizard(f.pins, () => Promise.resolve({ mac }));
			const [failure] = await adoption.adopt([b]);
			expect(failure.status).toBe('failed');
			expect(failure.error).toContain('catalog refused move');
			expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
				hostname: a.hostname,
				pin: pinned ? { mac, verifiedHost: a.hostname, revision: 1 } : null,
			});
			expect(updates).not.toHaveBeenCalled();
			await f.db.query('DROP TRIGGER reject_move');
			const publications: {
				host: string;
				active: boolean;
				snapshot: ReturnType<ShellyV1AdoptedIdentityService['captureDevice']>;
			}[] = [];
			f.events.on(EventType.DEVICE_UPDATED, (updated: ShellyV1DeviceEntity) => {
				publications.push({
					host: updated.hostname,
					active: isSqliteTransactionActive(f.db),
					snapshot: f.pins.captureDevice(a.identifier),
				});
			});
			await expect(adoption.adopt([b])).resolves.toEqual([
				expect.objectContaining({ status: 'updated', deviceId: device.id }),
			]);
			expect(publications).toHaveLength(1);
			expect(publications[0]).toMatchObject({ host: b.hostname, active: false });
			await expect(publications[0].snapshot).resolves.toMatchObject({
				hostname: b.hostname,
				pin: { mac, verifiedHost: b.hostname, revision: pinned ? 2 : 1 },
			});
		},
	);

	it('requires a full matching MAC to pin a legacy row, preserves its revision on a repeat confirmation and publishes a pin-only change', async () => {
		const device = await f.pins.createDevice(a);
		for (const invalidMac of ['123456789ABC', 'DDEEFF']) {
			await expect(wizard(f.pins, () => Promise.resolve({ mac: invalidMac })).adopt([a])).resolves.toEqual([
				expect.objectContaining({ status: 'failed' }),
			]);
		}
		await expect(wizard(f.pins, () => Promise.resolve(null)).adopt([a])).resolves.toEqual([
			expect.objectContaining({ status: 'updated' }),
		]);
		expect(await f.pins.findPin(device.id)).toBeNull();
		expect(updates).not.toHaveBeenCalled();
		const adoption = wizard(f.pins, () => Promise.resolve({ mac: mac.toLowerCase() }));
		await expect(adoption.adopt([a])).resolves.toEqual([expect.objectContaining({ status: 'updated' })]);
		await expect(adoption.adopt([a])).resolves.toEqual([expect.objectContaining({ status: 'updated' })]);
		expect(await f.pins.findPin(device.id)).toMatchObject({ mac, verifiedHost: a.hostname, revision: 1 });
		expect(updates).toHaveBeenCalledTimes(1);
	});

	it('rejects a conflicting or cleared identifier on an ordinary PATCH and allows matching aliases and unpinned edits', async () => {
		const pinned = await f.pins.createDevice(a, mac);
		for (const identifier of [null, 'shelly1-112233DDEEFF', 'not-a-mac']) {
			await expect(f.devices.update(pinned.id, { type: a.type, identifier })).rejects.toThrow('does not match');
		}
		expect(updates).not.toHaveBeenCalled();
		await f.devices.update(pinned.id, { type: a.type, identifier: 'shelly1-aabbccddeeff' });
		const unpinned = await f.pins.createDevice(a);
		await f.devices.update(unpinned.id, { type: a.type, identifier: 'operator-alias' });
		expect(await f.pins.captureDevice('shelly1-aabbccddeeff')).toMatchObject({ id: pinned.id, pin: { mac } });
		expect(await f.pins.captureDevice('operator-alias')).toMatchObject({ id: unpinned.id, pin: null });
		expect(updates).toHaveBeenCalledTimes(2);
	});

	it('requires stored pins to be normalized full MACs for the parsed address', () => {
		expect(shellyV1PinMatches('shelly1-ddeeff', mac)).toBe(true);
		expect(shellyV1PinMatches('shelly1-aabbccddeeff', mac)).toBe(true);
		expect(shellyV1PinMatches('shelly1-ddeeff', mac.toLowerCase())).toBe(false);
		expect(shellyV1PinMatches(null, mac)).toBe(false);
		expect(shellyV1PinMatches('shelly1-112233DDEEFF', mac)).toBe(false);
	});
});
