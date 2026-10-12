import { StorageService } from '../../storage/services/storage.service';
import { ConnectionState, PropertyCategory } from '../devices.constants';
import { DeviceEntity } from '../entities/devices.entity';

import { DeviceConnectionStateService } from './device-connection-state.service';

describe('DeviceConnectionStateService', () => {
	let service: DeviceConnectionStateService;
	let storageService: { isConnected: jest.Mock; query: jest.Mock; queryStrict: jest.Mock };

	beforeEach(() => {
		storageService = {
			isConnected: jest.fn().mockReturnValue(true),
			query: jest.fn(),
			queryStrict: jest.fn(),
		};
		service = new DeviceConnectionStateService(storageService as unknown as StorageService);
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
});
