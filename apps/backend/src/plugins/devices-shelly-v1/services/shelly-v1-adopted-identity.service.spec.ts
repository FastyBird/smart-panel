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
import { RegisteredDevice, ShellyDevice } from '../interfaces/shellies.interface';
import { ShellyInfoResponse } from '../interfaces/shelly-http.interface';

import { ShelliesAdapterService } from './shellies-adapter.service';
import { ShellyV1AdoptedIdentityService, shellyV1PinMatches } from './shelly-v1-adopted-identity.service';
import { ShellyV1AdoptionService } from './shelly-v1-adoption.service';
import { ShellyV1DiscoveryService } from './shelly-v1-discovery.service';
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
	it.each(['full', 'short'])(
		'keeps one UUID when a %s-address create races the other identifier on a second SQLite connection',
		async (firstFormat) => {
			const dir = await mkdtemp(join(tmpdir(), 'shelly-address-race-'));
			const file = join(dir, 'devices.sqlite');
			const events = new EventEmitter2();
			const claimed = jest.fn();
			events.on(EventType.DEVICE_CREATED, claimed);
			const first = await open(file, events);
			const second = await open(file, events);
			const beforeCommit = deferred<void>();
			const release = deferred<void>();
			try {
				first.db.subscribers.push({
					beforeTransactionCommit: async () => {
						beforeCommit.resolve();
						await release.promise;
					},
				});
				second.db.subscribers.push({ beforeTransactionStart: () => release.resolve() });
				const full = { ...a, identifier: `shelly1-${mac.toLowerCase()}` };
				const short = { ...a, identifier: 'shelly1-DDEEFF' };
				const firstIsFull = firstFormat === 'full';
				const winner = first.pins.createDevice(firstIsFull ? full : short, firstIsFull ? undefined : mac);
				await beforeCommit.promise;
				const competing = second.pins.createDevice(firstIsFull ? short : full, firstIsFull ? mac : undefined);
				const [saved] = await Promise.all([winner, expect(competing).rejects.toThrow('already adopted')]);
				expect(claimed).toHaveBeenCalledTimes(1);
				expect(await second.db.getRepository(ShellyV1DeviceEntity).count()).toBe(1);
				await expect(
					wizard(second.pins, () => Promise.resolve({ mac })).adopt([firstIsFull ? short : full]),
				).resolves.toEqual([expect.objectContaining({ status: 'updated', deviceId: saved.id })]);
				expect(await second.pins.findPin(saved.id)).toMatchObject({ mac, verifiedHost: a.hostname });
			} finally {
				release.resolve();
				await Promise.all([first.db.destroy(), second.db.destroy()]);
				await rm(dir, { recursive: true, force: true });
			}
		},
	);

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

	it.each([
		['password', { password: 'operator-password' }],
		['name', { name: 'Operator name' }],
		['category', { category: DeviceCategory.LIGHTING }],
	] as const)('refuses stale wizard edits to %s during the MAC probe', async (_field, edit) => {
		const device = await f.pins.createDevice(a, mac);
		const started = deferred<void>();
		const response = deferred<{ mac: string }>();
		const pending = wizard(f.pins, () => {
			started.resolve();
			return response.promise;
		}).adopt([{ ...b, password: 'wizard-password' }]);
		await started.promise;
		await f.devices.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(device.id, { type: a.type, ...edit });
		response.resolve({ mac });
		await expect(pending).resolves.toEqual([expect.objectContaining({ status: 'failed', deviceId: device.id })]);
		expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
			hostname: a.hostname,
			...edit,
			pin: { verifiedHost: a.hostname, revision: 1 },
		});
		expect(updates).toHaveBeenCalledTimes(1);
	});

	it('preserves an operator password and commits the verified move when adoption omits the password', async () => {
		const device = await f.pins.createDevice(a, mac);
		const started = deferred<void>();
		const response = deferred<{ mac: string }>();
		const pending = wizard(f.pins, () => {
			started.resolve();
			return response.promise;
		}).adopt([b]);
		await started.promise;
		await f.devices.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(device.id, {
			type: a.type,
			password: 'operator-password',
		});
		response.resolve({ mac });
		await expect(pending).resolves.toEqual([expect.objectContaining({ status: 'updated', deviceId: device.id })]);
		expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
			hostname: b.hostname,
			password: 'operator-password',
			pin: { verifiedHost: b.hostname, revision: 2 },
		});
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
		await expect(
			f.pins.updateDevice(state, { type: a.type, hostname: b.hostname }, mac, { assertEndpoint: assertPeer }),
		).rejects.toThrow();
		expect(peerCurrent).toBe(false);
		expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
			hostname: a.hostname,
			pin: { mac, verifiedHost: a.hostname, revision: 1 },
		});
		expect(updates).not.toHaveBeenCalled();
	});

	it('returns the committed disable when discovery waits behind the catalog edit to move the verified host', async () => {
		const device = await f.pins.createDevice(a, mac);
		const original = await f.pins.captureDevice(a.identifier);
		const editStarted = deferred<void>();
		const finishEdit = deferred<void>();
		f.db.subscribers.push({
			beforeUpdate: async ({ entity }) => {
				if (entity instanceof ShellyV1DeviceEntity && !entity.enabled && entity.hostname === a.hostname) {
					editStarted.resolve();
					await finishEdit.promise;
				}
			},
		});
		const disabling = f.devices.update(device.id, { type: a.type, enabled: false });
		await editStarted.promise;
		const moving = f.pins.updateDevice(original, { type: a.type, hostname: b.hostname }, mac);
		finishEdit.resolve();
		await disabling;
		await expect(moving).resolves.toMatchObject({ id: device.id, hostname: b.hostname, enabled: false });
		expect(await f.pins.captureDevice(a.identifier)).toMatchObject({
			hostname: b.hostname,
			enabled: false,
			pin: { verifiedHost: b.hostname, revision: 2 },
		});
	});

	it.each([
		['short pinned', a.identifier, mac],
		['short unpinned', a.identifier, undefined],
		['full address', mac, mac],
	])('guards discovery creation at native COMMIT for a %s device', async (_label, identifier, reportedMac) => {
		const created = jest.fn();
		f.events.on(EventType.DEVICE_CREATED, created);
		let current = true;
		const subscriber = {
			beforeTransactionCommit: () => {
				current = false;
			},
		};
		f.db.subscribers.push(subscriber);
		const assertPeer = () => {
			if (!current) throw new Error('Discovery peer changed');
		};
		const dto = { ...a, identifier };
		await expect(f.pins.createDevice(dto, reportedMac, assertPeer)).rejects.toThrow();
		expect(current).toBe(false);
		expect(await f.db.getRepository(DeviceEntity).count()).toBe(0);
		expect(await f.db.getRepository(ShellyV1AdoptedIdentityEntity).count()).toBe(0);
		expect(created).not.toHaveBeenCalled();

		f.db.subscribers.splice(f.db.subscribers.indexOf(subscriber), 1);
		current = true;
		const saved = await f.pins.createDevice(dto, reportedMac, assertPeer);
		expect(created).toHaveBeenCalledTimes(1);
		const pin = await f.pins.findPin(saved.id);
		if (identifier === a.identifier && reportedMac) expect(pin).toMatchObject({ mac });
		else expect(pin).toBeNull();
	});

	it('updates a renamed pin only after verifying the full MAC and prevents duplicate short-ID creations', async () => {
		const device = await f.pins.createDevice(a, mac);
		const renamed = 'shelly1-aabbccddeeff';
		await f.devices.update(device.id, { type: a.type, identifier: renamed });
		await expect(wizard(f.pins, () => Promise.resolve(null)).adopt([b])).resolves.toEqual([
			expect.objectContaining({ status: 'failed' }),
		]);
		await expect(f.pins.createDevice(b, mac)).rejects.toThrow('already adopted');
		await expect(f.pins.createDevice(b)).rejects.toThrow('already adopted');
		expect(await f.pins.captureDevice(renamed)).toMatchObject({
			id: device.id,
			hostname: a.hostname,
			pin: { mac, revision: 1 },
		});

		await expect(wizard(f.pins, () => Promise.resolve({ mac })).adopt([b])).resolves.toEqual([
			expect.objectContaining({ status: 'updated', deviceId: device.id }),
		]);
		expect(await f.pins.captureDevice(renamed)).toMatchObject({
			id: device.id,
			hostname: b.hostname,
			pin: { mac, revision: 2 },
		});
		expect(await f.db.getRepository(ShellyV1DeviceEntity).count()).toBe(1);
	});

	it('keeps verified devices with different full MACs and the same short suffix distinct', async () => {
		const first = await f.pins.createDevice(a, mac);
		const renamed = 'shelly1-aabbccddeeff';
		await f.devices.update(first.id, { type: a.type, identifier: renamed });
		const other = { ...b, identifier: 'shellyht-DDEEFF' };
		const otherMac = '112233DDEEFF';
		const [created] = await wizard(f.pins, () => Promise.resolve({ mac: otherMac })).adopt([other]);
		expect(created.status).toBe('created');
		expect(created.deviceId).not.toBe(first.id);
		await expect(wizard(f.pins, () => Promise.resolve({ mac })).adopt([other])).resolves.toEqual([
			expect.objectContaining({ status: 'failed' }),
		]);
		await expect(wizard(f.pins, () => Promise.resolve({ mac })).adopt([a])).resolves.toEqual([
			expect.objectContaining({ status: 'updated', deviceId: first.id }),
		]);
		expect(await f.pins.captureDevice(renamed)).toMatchObject({
			id: first.id,
			hostname: a.hostname,
			pin: { mac, revision: 1 },
		});
		expect(await f.pins.captureDevice(other.identifier)).toMatchObject({
			id: created.deviceId,
			hostname: other.hostname,
			pin: { mac: otherMac, revision: 1 },
		});
		expect(await f.db.getRepository(ShellyV1DeviceEntity).count()).toBe(2);
	});

	it('resolves only the verified full-address catalog row when two unpinned MACs have the same SDK suffix', async () => {
		const otherMac = '112233DDEEFF';
		const first = await f.pins.createDevice({ ...a, identifier: `shelly1-${mac.toLowerCase()}` });
		const second = await f.pins.createDevice({ ...b, identifier: otherMac });
		expect(await f.pins.findPin(first.id)).toBeNull();
		expect(await f.pins.findPin(second.id)).toBeNull();
		const short = { ...b, identifier: 'shelly1-DDEEFF' };
		await expect(wizard(f.pins, () => Promise.resolve(null)).adopt([short])).resolves.toEqual([
			expect.objectContaining({ status: 'failed' }),
		]);
		await expect(wizard(f.pins, () => Promise.resolve({ mac })).adopt([short])).resolves.toEqual([
			expect.objectContaining({ status: 'updated', deviceId: first.id }),
		]);
		expect(await f.pins.captureDevice(first.identifier)).toMatchObject({
			id: first.id,
			hostname: short.hostname,
			pin: { mac, verifiedHost: short.hostname },
		});
		expect(await f.pins.captureDevice(second.identifier)).toMatchObject({ id: second.id, pin: null });
		expect(await f.db.getRepository(ShellyV1DeviceEntity).count()).toBe(2);
	});

	it.each(['different pinned device', 'unverified exact device', 'duplicate MAC', 'same host'])(
		'disambiguates a full-address catalog row from an exact short identifier (%s)',
		async (scenario) => {
			const aliasMac = '112233DDEEFF';
			const exact = await f.pins.createDevice(a, scenario === 'unverified exact device' ? undefined : mac);
			const alias = await f.pins.createDevice({ ...b, identifier: `shellyht-${aliasMac}` });
			if (scenario === 'duplicate MAC') {
				await f.db.getRepository(ShellyV1AdoptedIdentityEntity).update({ deviceId: exact.id }, { mac: aliasMac });
			}
			const input = { ...b, hostname: scenario === 'same host' ? a.hostname : b.hostname };
			const [outcome] = await wizard(f.pins, () => Promise.resolve({ mac: aliasMac })).adopt([input]);
			if (scenario === 'different pinned device') {
				expect(outcome).toMatchObject({ status: 'updated', deviceId: alias.id });
				expect(await f.pins.findPin(alias.id)).toMatchObject({ mac: aliasMac, verifiedHost: b.hostname });
			} else {
				expect(outcome.status).toBe('failed');
				expect(await f.pins.findPin(alias.id)).toBeNull();
			}
			expect(await f.pins.captureDevice(exact.identifier)).toMatchObject({
				id: exact.id,
				name: a.name,
				hostname: a.hostname,
			});
			expect(await f.db.getRepository(ShellyV1DeviceEntity).count()).toBe(2);
		},
	);

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

	it('preserves both catalog rows if an exact device confirms the same host while an alias probe is pending', async () => {
		const aliasMac = '112233DDEEFF';
		const exact = await f.pins.createDevice(a, mac);
		const alias = await f.pins.createDevice({ ...a, identifier: `shellyht-${aliasMac}`, hostname: 'previous-host' });
		const started = deferred<void>();
		const report = deferred<{ mac: string }>();
		const pending = wizard(f.pins, () => {
			started.resolve();
			return report.promise;
		}).adopt([b]);
		await started.promise;
		await expect(f.pins.confirmHost(exact.id, mac, b.hostname, a.hostname, 1)).resolves.toBe(true);
		report.resolve({ mac: aliasMac });
		await expect(pending).resolves.toEqual([expect.objectContaining({ status: 'failed' })]);
		expect(await f.pins.captureDevice(alias.identifier)).toMatchObject({
			id: alias.id,
			hostname: 'previous-host',
			pin: null,
		});
		expect(await f.pins.findPin(exact.id)).toMatchObject({ mac, verifiedHost: b.hostname, revision: 2 });
		expect(updates).not.toHaveBeenCalled();
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
		const unpinned = await f.pins.createDevice({ ...a, identifier: '112233' });
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

describe('Shelly discovery scan catalog identities', () => {
	let db: Awaited<ReturnType<typeof open>>;
	beforeEach(async () => {
		db = await open();
		jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
	});
	afterEach(async () => {
		jest.useRealTimers();
		await db.db.destroy();
	});

	function fixture(registrations: RegisteredDevice[] = []) {
		const peers = registrations.map((registration) => ({ ...registration, online: true }) as unknown as ShellyDevice);
		const getRegisteredDevice = (id: string, type?: string) => {
			const matching = registrations.filter((entry) => entry.id === id && (!type || type === entry.type));
			return matching.length === 1 ? matching[0] : undefined;
		};
		const adapter = {
			getKnownDevices: () => peers,
			subscribeToAddedDevice: () => () => undefined,
			getDevice: (type: string, id: string) => peers.find((peer) => peer.type === type && peer.id === id),
			getRegisteredDevice,
			getRegisteredDeviceForCatalog: (row: ShellyV1DeviceEntity) =>
				registrations.find((entry) => entry.catalog?.deviceId === row.id) ?? getRegisteredDevice(row.identifier),
		};
		const getDeviceInfo = jest.fn<Promise<ShellyInfoResponse>, [string, number?]>();
		const scan = new ShellyV1DiscoveryService(adapter as unknown as ShelliesAdapterService, db.pins, {
			getDeviceInfo,
		} as unknown as ShellyV1HttpClientService);
		const probes = jest.spyOn(scan as unknown as { handleLibDevice(): Promise<void> }, 'handleLibDevice');
		const start = async () => {
			probes.mockClear();
			const session = scan.start({ duration: 30 });
			await Promise.all(probes.mock.results.map((call) => call.value as Promise<void>));
			return scan.get(session.id);
		};
		return { start, getDeviceInfo, scan };
	}

	it('shows the sleeping relay and the colliding sensor separately and submits an independently adoptable sensor identifier', async () => {
		const relay = await db.pins.createDevice(a, mac);
		const sensorMac = '112233DDEEFF';
		const sensorHost = 'sensor-host';
		const f = fixture([
			{
				id: a.identifier,
				type: 'SHSW-1',
				host: a.hostname,
				enabled: true,
				catalog: { deviceId: relay.id, mac, revision: 1 },
			},
			{ id: a.identifier, type: 'SHHT-1', host: sensorHost, enabled: true },
		]);
		f.getDeviceInfo.mockImplementation((host) =>
			host === a.hostname
				? Promise.reject(new Error('sleeping'))
				: Promise.resolve({ type: 'SHHT-1', mac: sensorMac, auth: false, fw: '1.14.0', longid: 1 }),
		);
		const found = await f.start();
		expect(found.devices).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					hostname: a.hostname,
					identifier: a.identifier,
					status: 'already_registered',
					registeredDeviceId: relay.id,
				}),
				expect.objectContaining({
					hostname: sensorHost,
					identifier: sensorMac,
					status: 'ready',
					registeredDeviceId: null,
				}),
			]),
		);
		const sensor = found.devices.find((entry) => entry.hostname === sensorHost);
		const [adopted] = await wizard(db.pins, () => Promise.resolve({ mac: sensorMac })).adopt([
			{
				identifier: sensor.identifier,
				hostname: sensor.hostname,
				category: DeviceCategory.SENSOR,
				name: 'Room sensor',
			},
		]);
		expect(adopted.status).toBe('created');
		const again = await f.start();
		expect(again.devices.find((entry) => entry.hostname === sensorHost)).toMatchObject({
			identifier: sensorMac,
			registeredDeviceId: adopted.deviceId,
			registeredDeviceName: 'Room sensor',
			status: 'already_registered',
		});
		expect(f.getDeviceInfo.mock.calls).toEqual([
			[a.hostname, 3000],
			[sensorHost, 3000],
			[a.hostname, 3000],
			[sensorHost, 3000],
		]);
	});

	it('recognizes a probed unpinned legacy endpoint when another model uses its short ID at a different host', async () => {
		const relay = await db.pins.createDevice(a);
		const sensorMac = '112233DDEEFF';
		const f = fixture([
			{ id: a.identifier, type: 'SHSW-1', host: a.hostname, enabled: true },
			{ id: a.identifier, type: 'SHHT-1', host: 'sensor-host', enabled: true },
		]);
		f.getDeviceInfo.mockImplementation((host) => {
			const identity = host === a.hostname ? { type: 'SHSW-1', mac } : { type: 'SHHT-1', mac: sensorMac };
			return Promise.resolve({ ...identity, auth: false, fw: '1.14.0', longid: 0 });
		});
		const found = await f.start();
		expect(found.devices.find((entry) => entry.hostname === a.hostname)).toMatchObject({
			registeredDeviceId: relay.id,
			status: 'already_registered',
		});
		expect(found.devices.find((entry) => entry.hostname === 'sensor-host')).toMatchObject({
			identifier: sensorMac,
			registeredDeviceId: null,
			status: 'ready',
		});
		f.getDeviceInfo.mockRejectedValue(new Error('sleeping'));
		const asleep = await f.start();
		expect(asleep.devices.find((entry) => entry.hostname === a.hostname)).toMatchObject({
			registeredDeviceId: null,
			status: 'failed',
		});
	});

	it('matches a manual full MAC to just one unpinned legacy short identifier at the configured host', async () => {
		const legacy = await db.pins.createDevice({ ...a, identifier: 'shelly1-ddeeff' });
		const f = fixture();
		f.getDeviceInfo.mockResolvedValue({ type: 'SHSW-1', mac, auth: false, fw: '1.14.0', longid: 0 });
		const session = await f.start();
		const manual = async (hostname: string) =>
			(await f.scan.manual(session.id, { hostname })).devices.find((entry) => entry.hostname === hostname);
		await expect(manual(a.hostname)).resolves.toMatchObject({
			registeredDeviceId: legacy.id,
			identifier: legacy.identifier,
			status: 'already_registered',
		});
		await expect(manual('another-host')).resolves.toMatchObject({
			registeredDeviceId: null,
			identifier: mac,
			status: 'ready',
		});
		await db.pins.createDevice({ ...a, identifier: 'another-ddeeff' });
		await expect(manual(a.hostname)).resolves.toMatchObject({ registeredDeviceId: null, status: 'failed' });
		expect(f.getDeviceInfo).toHaveBeenCalledTimes(3);
	});
});
