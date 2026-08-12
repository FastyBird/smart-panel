import { DataSource } from 'typeorm';

import { WledDeviceEntity } from '../entities/devices-wled.entity';

import { WledHardwareIdentityService } from './hardware-identity.service';

describe('WledHardwareIdentityService', () => {
	it('persists a verified normalized identity through the internal repository path', async () => {
		const device = { id: 'device-1', mac: null } as WledDeviceEntity;
		const update = jest.fn().mockResolvedValue(undefined);
		const repository = { findOne: jest.fn().mockResolvedValue(null), update };
		const dataSource = { getRepository: jest.fn().mockReturnValue(repository) } as unknown as DataSource;
		const service = new WledHardwareIdentityService(dataSource);

		await expect(service.persist(device, 'AA:BB:CC:DD:EE:FF')).resolves.toBe('persisted');

		expect(update).toHaveBeenCalledWith('device-1', { mac: 'aabbccddeeff' });
		expect(device.mac).toBe('aabbccddeeff');
	});

	it('rejects a hardware identity owned by another device', async () => {
		const device = { id: 'device-legacy', mac: null } as WledDeviceEntity;
		const update = jest.fn();
		const repository = {
			findOne: jest.fn().mockResolvedValue({ id: 'device-canonical', mac: 'aabbccddeeff' }),
			update,
		};
		const dataSource = { getRepository: jest.fn().mockReturnValue(repository) } as unknown as DataSource;
		const service = new WledHardwareIdentityService(dataSource);

		await expect(service.persist(device, 'AA:BB:CC:DD:EE:FF')).resolves.toBe('conflict');

		expect(update).not.toHaveBeenCalled();
	});
});
