import { StorageService } from '../../storage/services/storage.service';
import { ConnectionState } from '../devices.constants';
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

	it('propagates strict storage query failures', async () => {
		storageService.queryStrict.mockRejectedValue(new Error('database detail'));

		await expect(service.readLatestStrict({ id: 'device-a' })).rejects.toThrow('database detail');
		await expect(service.readLatestManyStrict([{ id: 'device-b' }])).rejects.toThrow('database detail');
	});
});
