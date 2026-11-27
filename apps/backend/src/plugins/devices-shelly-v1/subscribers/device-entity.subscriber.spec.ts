import { DataSource } from 'typeorm';

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
import { DeviceStructureLockService } from '../../../modules/devices/services/device-structure-lock.service';
import { DevicesTypeMapperService } from '../../../modules/devices/services/devices-type-mapper.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { SpaceEntity } from '../../../modules/spaces/entities/space.entity';
import { DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { CreateShellyV1DeviceDto } from '../dto/create-device.dto';
import { UpdateShellyV1DeviceDto } from '../dto/update-device.dto';
import { ShellyV1DeviceEntity } from '../entities/devices-shelly-v1.entity';
import { ShellyV1AdoptedIdentityEntity } from '../entities/shelly-v1-adopted-identity.entity';
import { ShelliesAdapterService } from '../services/shellies-adapter.service';
import { ShellyV1AdoptedIdentityService } from '../services/shelly-v1-adopted-identity.service';
import { ShellyV1HttpClientService } from '../services/shelly-v1-http-client.service';

import { DeviceEntitySubscriber } from './device-entity.subscriber';

const sampleDevice = (overrides: Partial<ShellyV1DeviceEntity> = {}) =>
	Object.assign(new ShellyV1DeviceEntity(), {
		id: 'stored',
		identifier: 'DDEEFF',
		hostname: 'host',
		password: 'old',
		enabled: true,
		...overrides,
	});
const adapterFixture = (id = 'DDEEFF') => {
	const peer = { id, type: 'SHSW-1', host: 'host' };
	const registration = { ...peer };
	return {
		getRegisteredDevice: () => registration,
		getDevice: () => peer,
		setDeviceAuthCredentials: jest.fn<void, [unknown, string, string, string | null]>(),
		updateDeviceEnabledStatus: jest.fn(),
	};
};

describe('Gen1 credential setup after catalog publication', () => {
	it.each([
		{ identifier: 'shelly1-AABBCCDDEEFF', usesRegistration: true },
		{ identifier: 'shelly1-DDEEFF', usesRegistration: false },
	])(
		'resolves a missing hostname for $identifier and clears credentials on deletion',
		async ({ identifier, usesRegistration }) => {
			const adapter = adapterFixture(identifier);
			const http = { getLoginSettings: jest.fn().mockResolvedValue({ username: 'operator' }) };
			const subscriber = new DeviceEntitySubscriber(
				{ subscribers: [] } as unknown as DataSource,
				adapter as unknown as ShelliesAdapterService,
				http as unknown as ShellyV1HttpClientService,
				{ findPin: () => Promise.resolve(null) } as unknown as ShellyV1AdoptedIdentityService,
			);
			const device = sampleDevice({ identifier, hostname: null });
			await subscriber.deviceCreated(device);
			subscriber.deviceDeleted(device);
			expect(http.getLoginSettings.mock.calls).toEqual(usesRegistration ? [['host']] : []);
			expect(adapter.setDeviceAuthCredentials.mock.calls.map(([, host, , password]) => [host, password])).toEqual(
				usesRegistration
					? [
							['host', 'old'],
							['host', null],
						]
					: [],
			);
		},
	);

	it.each(['replaced peer', 'pin changed', 'conflicting identifier'])(
		'withholds credentials when the captured full-address registration has a %s',
		async (change) => {
			const identifier = 'shelly1-AABBCCDDEEFF';
			const adapter = adapterFixture(identifier);
			const pin = {
				mac: change === 'conflicting identifier' ? '112233DDEEFF' : 'AABBCCDDEEFF',
				verifiedHost: 'host',
				revision: 1,
			};
			const http = {
				getLoginSettings: jest.fn(() => {
					if (change === 'replaced peer') {
						const peer = { ...adapter.getDevice() };
						jest.spyOn(adapter, 'getDevice').mockReturnValue(peer);
					}
					if (change === 'pin changed') pin.revision++;
					return Promise.resolve({ username: 'operator' });
				}),
			};
			const subscriber = new DeviceEntitySubscriber(
				{ subscribers: [] } as unknown as DataSource,
				adapter as unknown as ShelliesAdapterService,
				http as unknown as ShellyV1HttpClientService,
				{ findPin: () => Promise.resolve({ ...pin }) } as unknown as ShellyV1AdoptedIdentityService,
			);
			await subscriber.deviceCreated(sampleDevice({ identifier, hostname: null }));
			expect(http.getLoginSettings).toHaveBeenCalledTimes(change === 'conflicting identifier' ? 0 : 1);
			expect(adapter.setDeviceAuthCredentials).not.toHaveBeenCalled();
		},
	);

	it.each(['new password', 'disabled', 'deleted'])(
		'revokes an outstanding login after the device is %s',
		async (change) => {
			const adapter = adapterFixture();
			let resume: () => void, started: () => void;
			const reachedLogin = new Promise<void>((resolve) => {
				started = resolve;
			});
			const pending = new Promise<void>((resolve) => {
				resume = resolve;
			});
			const http = {
				getLoginSettings: jest
					.fn()
					.mockImplementationOnce(async () => {
						started();
						await pending;
						return { username: 'admin' };
					})
					.mockResolvedValue({ username: 'admin' }),
			};
			const subscriber = new DeviceEntitySubscriber(
				{ subscribers: [] } as unknown as DataSource,
				adapter as unknown as ShelliesAdapterService,
				http as unknown as ShellyV1HttpClientService,
				{ findPin: () => Promise.resolve(null) } as unknown as ShellyV1AdoptedIdentityService,
			);
			const first = subscriber.deviceCreated(sampleDevice());
			await reachedLogin;
			await subscriber.deviceUpdated(sampleDevice({ name: 'Unrelated rename' }));
			expect(http.getLoginSettings).toHaveBeenCalledTimes(1);
			if (change === 'deleted') subscriber.deviceDeleted(sampleDevice());
			else
				await subscriber.deviceUpdated(sampleDevice(change === 'disabled' ? { enabled: false } : { password: 'new' }));
			resume();
			await first;
			expect(adapter.setDeviceAuthCredentials.mock.calls.map(([, , , password]) => password).filter(Boolean)).toEqual(
				change === 'new password' ? ['new'] : [],
			);
			if (change === 'disabled') {
				expect(adapter.updateDeviceEnabledStatus).toHaveBeenLastCalledWith('DDEEFF', false);
				await subscriber.deviceUpdated(sampleDevice({ enabled: true }));
				expect(adapter.setDeviceAuthCredentials.mock.lastCall[3]).toBe('old');
			}
		},
	);

	it('keeps a rolled-back password change and unrelated edits offline, then reads the pin after commit', async () => {
		const db = await new SqliteDataSource({
			type: 'sqlite',
			database: ':memory:',
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
		try {
			const repo = db.getRepository(ShellyV1DeviceEntity);
			const saved = await repo.save(
				repo.create({
					identifier: 'DDEEFF',
					hostname: 'host',
					name: 'Relay',
					password: 'old',
					enabled: true,
					category: DeviceCategory.SWITCHER,
				}),
			);
			const adapter = adapterFixture(),
				events = new EventEmitter2(),
				lock = new DeviceStructureLockService();
			const mapping = new DevicesTypeMapperService();
			mapping.registerMapping({
				type: DEVICES_SHELLY_V1_TYPE,
				class: ShellyV1DeviceEntity,
				createDto: CreateShellyV1DeviceDto,
				updateDto: UpdateShellyV1DeviceDto,
			});
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
			const findPin = jest.spyOn(pins, 'findPin').mockImplementation((id) => {
				expect(isSqliteTransactionActive(db)).toBe(false);
				return db.getRepository(ShellyV1AdoptedIdentityEntity).findOneBy({ deviceId: id });
			});
			const http = { getLoginSettings: jest.fn().mockResolvedValue({ username: 'admin' }) };
			const subscriber = new DeviceEntitySubscriber(
				db,
				adapter as unknown as ShelliesAdapterService,
				http as unknown as ShellyV1HttpClientService,
				pins,
			);
			const publications: Promise<void>[] = [];
			events.on(EventType.DEVICE_UPDATED, (device: ShellyV1DeviceEntity) =>
				publications.push(subscriber.deviceUpdated(device)),
			);
			await expect(
				db.transaction(async (manager) => {
					const row = await manager.findOneByOrFail(ShellyV1DeviceEntity, { id: saved.id });
					row.enabled = false;
					row.password = 'rolled back';
					await manager.save(row);
					expect(findPin).not.toHaveBeenCalled();
					expect(adapter.updateDeviceEnabledStatus).not.toHaveBeenCalled();
					throw new Error('roll back');
				}),
			).rejects.toThrow('roll back');
			await devices.update(saved.id, { type: DEVICES_SHELLY_V1_TYPE, name: 'Renamed' });
			await Promise.all(publications);
			expect(findPin).not.toHaveBeenCalled();
			expect(http.getLoginSettings).not.toHaveBeenCalled();
			expect(adapter.setDeviceAuthCredentials).not.toHaveBeenCalled();
			expect(await repo.findOneByOrFail({ id: saved.id })).toMatchObject({ enabled: true, password: 'old' });
			await devices.update<ShellyV1DeviceEntity, UpdateShellyV1DeviceDto>(saved.id, {
				type: DEVICES_SHELLY_V1_TYPE,
				password: 'committed',
			});
			await Promise.all(publications);
			expect(findPin).toHaveBeenCalledTimes(2);
			expect(adapter.setDeviceAuthCredentials.mock.calls.map(([, , , password]) => password)).toEqual([
				null,
				'committed',
			]);
			subscriber.onModuleDestroy();
		} finally {
			await db.destroy();
		}
	}, 30_000);

	it.each(['missing', 'conflicting', 'moved', 'verified', 'legacy'])(
		'applies credentials only to the captured and authorized peer (%s)',
		async (scenario) => {
			const peer = { id: 'DDEEFF', type: 'SHSW-1', host: 'new-host' };
			const registration = { ...peer };
			const adapter = {
				getRegisteredDevice: () => registration,
				getDevice: () => peer,
				setDeviceAuthCredentials: jest.fn(),
				updateDeviceEnabledStatus: jest.fn(),
			};
			const identities = {
				findPin: jest
					.fn()
					.mockResolvedValue(
						scenario === 'legacy' ? null : { mac: 'AABBCCDDEEFF', verifiedHost: 'old-host', revision: 1 },
					),
				confirmHost: jest.fn().mockResolvedValue(true),
			};
			const http = {
				getDeviceInfo: jest
					.fn()
					.mockResolvedValue(
						scenario === 'missing'
							? null
							: { type: peer.type, mac: scenario === 'conflicting' ? '112233DDEEFF' : 'AABBCCDDEEFF' },
					),
				getLoginSettings: jest.fn(() => {
					if (scenario === 'moved') peer.host = 'elsewhere';
					return Promise.resolve({ username: 'admin' });
				}),
			};
			const subscriber = new DeviceEntitySubscriber(
				{ subscribers: [] } as unknown as DataSource,
				adapter as unknown as ShelliesAdapterService,
				http as unknown as ShellyV1HttpClientService,
				identities as unknown as ShellyV1AdoptedIdentityService,
			);
			const device = Object.assign(new ShellyV1DeviceEntity(), {
				id: 'stored',
				identifier: 'DDEEFF',
				hostname: 'new-host',
				password: 'fixture',
			});
			await subscriber.deviceCreated(device);
			expect(adapter.setDeviceAuthCredentials).toHaveBeenCalledTimes(['verified', 'legacy'].includes(scenario) ? 1 : 0);
			expect(http.getLoginSettings).toHaveBeenCalledTimes(['verified', 'legacy', 'moved'].includes(scenario) ? 1 : 0);
			expect(identities.confirmHost).toHaveBeenCalledTimes(scenario === 'verified' ? 1 : 0);
			if (scenario === 'verified')
				expect(identities.confirmHost).toHaveBeenCalledWith('stored', 'AABBCCDDEEFF', 'new-host', 'old-host', 1);
		},
	);
});
