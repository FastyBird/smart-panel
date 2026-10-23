import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../config/services/config.service';
import { StoragePlugin } from '../../storage/interfaces/storage-plugin.interface';
import { StorageConfigModel } from '../../storage/models/config.model';
import { CreationStorageDestinations } from '../../storage/services/storage.service';
import { StorageService } from '../../storage/services/storage.service';
import { ConnectionState, PropertyCategory } from '../devices.constants';
import { ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import { DeviceConnectionStateService } from './device-connection-state.service';
import {
	DeviceCreationPublicationEngine,
	DeviceCreationPublicationLease,
	ReadCacheObservation,
	originalReadCacheApi,
} from './device-creation-context';

describe('DeviceConnectionStateService', () => {
	let service: DeviceConnectionStateService;
	let storageModule: TestingModule | undefined;
	let actualStorage: StorageService;
	let storageService: { isConnected: jest.Mock; query: jest.Mock; queryStrict: jest.Mock };

	beforeEach(async () => {
		storageService = {
			isConnected: jest.fn().mockReturnValue(true),
			query: jest.fn(),
			queryStrict: jest.fn(),
		};
		storageModule = await Test.createTestingModule({
			providers: [
				StorageService,
				{
					provide: ConfigService,
					useValue: {
						getModuleConfig: () => Object.assign(new StorageConfigModel(), { primaryStorage: 'read-test-primary' }),
					},
				},
			],
		}).compile();
		actualStorage = storageModule.get(StorageService);
		const plugin: StoragePlugin = {
			name: 'read-test-primary',
			initialize: () => Promise.resolve(),
			destroy: () => Promise.resolve(),
			isAvailable: () => true,
			writePoints: () => Promise.resolve(),
			query: <T>() => Promise.resolve<T[]>([]),
			queryRaw: <T>() => Promise.reject<T>(new Error('Raw query outside fixture')),
			registerSchema: () => undefined,
			dropMeasurement: () => Promise.resolve(),
			getMeasurements: () => Promise.resolve([]),
		};
		actualStorage.registerPlugin(plugin.name, plugin);
		Object.assign(actualStorage, storageService);
		service = new DeviceConnectionStateService(actualStorage);
	});

	afterEach(async () => {
		const closing = storageModule;
		storageModule = undefined;
		await closing?.close();
	});

	it('batches strict status reads for uncached devices', async () => {
		storageService.queryStrict.mockResolvedValue([
			{
				deviceId: 'device-a',
				online: true,
				status: ConnectionState.CONNECTED,
				time: '2026-08-06T12:00:00Z',
			},
			{
				deviceId: 'device-b',
				onlineI: 0,
				status: ConnectionState.LOST,
				time: '2026-08-06T12:01:00Z',
			},
		]);

		const result = await service.readLatestManyStrict([
			{ id: 'device-a' } as DeviceEntity,
			{ id: 'device-b' } as DeviceEntity,
		]);

		expect(result.get('device-a')).toEqual(
			expect.objectContaining({ online: true, status: ConnectionState.CONNECTED }),
		);
		expect(result.get('device-b')).toEqual(expect.objectContaining({ online: false, status: ConnectionState.LOST }));
		expect(storageService.queryStrict).toHaveBeenCalledTimes(1);
		expect(storageService.queryStrict).toHaveBeenCalledWith(expect.stringContaining('GROUP BY "deviceId"'));
	});

	it('rejects strict reads when storage is disconnected', async () => {
		storageService.isConnected.mockReturnValue(false);

		await expect(service.readLatestStrict({ id: 'device-a' })).rejects.toThrow('storage is unavailable');
		await expect(service.readLatestManyStrict([{ id: 'device-a' }])).rejects.toThrow('storage is unavailable');
	});

	it('returns unknown statuses for best-effort batch reads when storage is disconnected', async () => {
		storageService.isConnected.mockReturnValue(false);

		const result = await service.readLatestMany([{ id: 'device-a' }, { id: 'device-b' }]);

		expect(result.get('device-a')).toEqual(expect.objectContaining({ online: false, status: ConnectionState.UNKNOWN }));
		expect(result.get('device-b')).toEqual(expect.objectContaining({ online: false, status: ConnectionState.UNKNOWN }));
		expect(storageService.queryStrict).not.toHaveBeenCalled();
	});

	it('propagates strict storage query failures', async () => {
		storageService.queryStrict.mockRejectedValue(new Error('database detail'));

		await expect(service.readLatestStrict({ id: 'device-a' })).rejects.toThrow('database detail');
		await expect(service.readLatestManyStrict([{ id: 'device-b' }])).rejects.toThrow('database detail');
	});

	it('returns unknown statuses for best-effort batch query failures', async () => {
		storageService.queryStrict.mockRejectedValue(new Error('database detail'));

		const result = await service.readLatestMany([{ id: 'device-a' }]);

		expect(result.get('device-a')).toEqual(expect.objectContaining({ online: false, status: ConnectionState.UNKNOWN }));
	});

	it('caches a successful cold read with no stored row', async () => {
		storageService.query.mockResolvedValue([]);
		storageService.queryStrict.mockResolvedValue([]);

		await expect(service.readLatest({ id: 'device-a' })).resolves.toEqual({
			online: false,
			status: ConnectionState.UNKNOWN,
			lastChanged: null,
		});
		await service.readLatest({ id: 'device-a' });

		expect(storageService.query).toHaveBeenCalledTimes(1);
	});

	it('does not cache unknown after a transient best-effort storage failure', async () => {
		storageService.query.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce([]);

		await service.readLatest({ id: 'device-a' });
		await service.readLatest({ id: 'device-a' });

		expect(storageService.query).toHaveBeenCalledTimes(2);
	});

	it('keeps a newer report that arrives while a cold read is in flight', async () => {
		let resolveRead: (rows: Array<{ deviceId: string; online: boolean; status: ConnectionState }>) => void = () => {};
		storageService.query.mockReturnValue(
			new Promise((resolve) => {
				resolveRead = resolve;
			}),
		);
		const coldRead = service.readLatest({ id: 'device-a' });
		await service.write(
			{ id: 'device-a' } as DeviceEntity,
			{ id: 'status-property', category: PropertyCategory.STATUS } as never,
			ConnectionState.CONNECTED,
		);
		resolveRead([{ deviceId: 'device-a', online: false, status: ConnectionState.DISCONNECTED }]);

		await expect(coldRead).resolves.toEqual(
			expect.objectContaining({ status: ConnectionState.CONNECTED, online: true }),
		);
	});
	it('refuses a forged creation lease before device getters, cache or storage work', async () => {
		let getters = 0;
		const device = new DeviceEntity();
		Object.defineProperty(device, 'id', {
			get: () => {
				getters++;
				throw new Error('Business getter must not run');
			},
		});
		const property = new ChannelPropertyEntity();
		const lease = Object.freeze(new DeviceCreationPublicationLease());
		expect(() => service.readCreated(lease, device)).toThrow('Original creation publication unavailable');
		await expect(
			service.writeCreated(lease, device, property, ConnectionState.UNKNOWN, new CreationStorageDestinations()),
		).rejects.toThrow('Original creation publication unavailable');
		expect(getters).toBe(0);
		expect(storageService.query).not.toHaveBeenCalled();
		expect(storageService.queryStrict).not.toHaveBeenCalled();
	});
	describe('finite original cold status hydration', () => {
		it.each([
			{ deleted: 'status-a', property: 'status-a', expected: ConnectionState.UNKNOWN },
			{ deleted: 'status-b', property: 'status-a', expected: ConnectionState.CONNECTED },
			{ deleted: 'status-b', property: undefined, expected: ConnectionState.UNKNOWN },
		])(
			'correlates a live cold binding against actual deletion $deleted / $property',
			async ({ deleted, property, expected }) => {
				let release: (rows: unknown[]) => void = () => {};
				const held = new Promise<unknown[]>((resolve) => {
					release = resolve;
				});
				storageService.query.mockResolvedValue([]).mockImplementationOnce(() => held);
				const pending = service.readLatest({ id: 'cold-a' });
				const removed = Object.assign(new ChannelPropertyEntity(), { id: deleted });
				try {
					await service.deleteByProperty(removed);
					release([{ deviceId: 'cold-a', propertyId: property, status: ConnectionState.CONNECTED, online: true }]);
					await expect(pending).resolves.toEqual(expect.objectContaining({ status: expected }));
					await service.readLatest({ id: 'cold-a' });
					expect(storageService.query).toHaveBeenCalledTimes(expected === ConnectionState.CONNECTED ? 2 : 3);
				} finally {
					release([]);
					await pending.catch(() => undefined);
				}
			},
		);
		it('keeps an empty cold result with witnessed unbound deletion out of the shared cache', async () => {
			let release: (rows: unknown[]) => void = () => {};
			const held = new Promise<unknown[]>((resolve) => {
				release = resolve;
			});
			storageService.query.mockResolvedValue([]).mockImplementationOnce(() => held);
			const pending = service.readLatest({ id: 'cold-a' });
			try {
				await service.deleteByProperty(Object.assign(new ChannelPropertyEntity(), { id: 'deleted' }));
				release([]);
				await expect(pending).resolves.toEqual(expect.objectContaining({ status: ConnectionState.UNKNOWN }));
				await service.readLatest({ id: 'cold-a' });
				expect(storageService.query).toHaveBeenCalledTimes(3);
			} finally {
				release([]);
				await pending.catch(() => undefined);
			}
		});
		it('keeps a known unrelated batch key eligible after a real property deletion', async () => {
			let release: (rows: unknown[]) => void = () => {};
			const held = new Promise<unknown[]>((resolve) => {
				release = resolve;
			});
			storageService.queryStrict.mockImplementationOnce(() => held);
			storageService.query.mockResolvedValue([]);
			const pending = service.readLatestManyStrict([{ id: 'cold-a' }, { id: 'cold-b' }]);
			try {
				await service.deleteByProperty(Object.assign(new ChannelPropertyEntity(), { id: 'status-a' }));
				release([
					{ deviceId: 'cold-a', propertyId: 'status-a', status: ConnectionState.CONNECTED, online: true },
					{ deviceId: 'cold-b', propertyId: 'status-b', status: ConnectionState.CONNECTED, online: true },
				]);
				const result = await pending;
				expect(result.get('cold-a')?.status).toBe(ConnectionState.UNKNOWN);
				expect(result.get('cold-b')?.status).toBe(ConnectionState.CONNECTED);
				await expect(service.readLatest({ id: 'cold-b' })).resolves.toEqual(
					expect.objectContaining({ status: ConnectionState.CONNECTED }),
				);
				expect(storageService.query).toHaveBeenCalledTimes(1);
			} finally {
				release([]);
				await pending.catch(() => undefined);
			}
		});
		it('does not restore a report removed while the original cold read waits', async () => {
			let release: (rows: unknown[]) => void = () => {};
			const held = new Promise<unknown[]>((resolve) => {
				release = resolve;
			});
			storageService.query.mockResolvedValue([]).mockImplementationOnce(() => held);
			const device = Object.assign(new DeviceEntity(), { id: 'cold-a' });
			const property = Object.assign(new ChannelPropertyEntity(), {
				id: 'status-a',
				category: PropertyCategory.STATUS,
			});
			const pending = service.readLatest(device);
			try {
				await service.write(device, property, ConnectionState.CONNECTED);
				await service.delete(device);
				release([{ deviceId: device.id, propertyId: property.id, status: ConnectionState.CONNECTED, online: true }]);
				await expect(pending).resolves.toEqual(expect.objectContaining({ status: ConnectionState.UNKNOWN }));
			} finally {
				release([]);
				await pending.catch(() => undefined);
			}
		});
		it('consumes observations once and cleans through original API replacement without calling a substitute', () => {
			const observation = originalReadCacheApi.observe.call(originalReadCacheApi.receiver, 'cold-a', true);
			const replacement = jest.spyOn(DeviceCreationPublicationEngine, 'finishReadCache');
			try {
				expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, observation)).toBe('changed');
				expect(replacement).not.toHaveBeenCalled();
				originalReadCacheApi.close.call(originalReadCacheApi.receiver, observation);
			} finally {
				replacement.mockRestore();
			}
			expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, observation)).toBe('changed');
			expect(originalReadCacheApi.finish.call(originalReadCacheApi.receiver, new ReadCacheObservation())).toBe(
				'changed',
			);
		});
	});
});
