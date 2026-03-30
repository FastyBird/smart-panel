/*
eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-call,
@typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access,
@typescript-eslint/no-unsafe-return
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { AddressType } from '../devices-shelly-ng.constants';
import { ShellyNgDeviceEntity } from '../entities/devices-shelly-ng.entity';

import { DeviceAddressService, normalizeMac } from './device-address.service';

describe('normalizeMac', () => {
	test('strips colons and uppercases', () => {
		expect(normalizeMac('a8:03:2a:be:50:84')).toBe('A8032ABE5084');
	});

	test('strips dashes and uppercases', () => {
		expect(normalizeMac('a8-03-2a-be-50-84')).toBe('A8032ABE5084');
	});

	test('already-uppercase bare hex passes through', () => {
		expect(normalizeMac('A8032ABE5084')).toBe('A8032ABE5084');
	});

	test('mixed case bare hex uppercases', () => {
		expect(normalizeMac('a8032aBE5084')).toBe('A8032ABE5084');
	});
});

describe('DeviceAddressService', () => {
	let svc: DeviceAddressService;
	let addressRepo: any;
	let deviceRepo: any;

	beforeEach(() => {
		addressRepo = {
			findOne: jest.fn(),
			find: jest.fn(),
			create: jest.fn((data: any) => ({ ...data })),
			save: jest.fn(async (entity: any) => entity),
			update: jest.fn().mockResolvedValue(undefined),
		};

		deviceRepo = {
			findOne: jest.fn(),
			update: jest.fn().mockResolvedValue(undefined),
		};

		svc = new DeviceAddressService(addressRepo, deviceRepo);
	});

	describe('upsertAddress', () => {
		test('inserts new address when none exists', async () => {
			addressRepo.findOne.mockResolvedValue(null);

			await svc.upsertAddress('dev-1', AddressType.WIFI, '192.168.1.10');

			expect(addressRepo.create).toHaveBeenCalledWith({
				deviceId: 'dev-1',
				interfaceType: AddressType.WIFI,
				address: '192.168.1.10',
			});
			expect(addressRepo.save).toHaveBeenCalled();
		});

		test('updates existing address when it changed', async () => {
			const existing = { deviceId: 'dev-1', interfaceType: AddressType.WIFI, address: '192.168.1.5' };
			addressRepo.findOne.mockResolvedValue(existing);

			await svc.upsertAddress('dev-1', AddressType.WIFI, '192.168.1.10');

			expect(existing.address).toBe('192.168.1.10');
			expect(addressRepo.save).toHaveBeenCalledWith(existing);
		});

		test('does nothing when address is unchanged', async () => {
			const existing = { deviceId: 'dev-1', interfaceType: AddressType.WIFI, address: '192.168.1.10' };
			addressRepo.findOne.mockResolvedValue(existing);

			await svc.upsertAddress('dev-1', AddressType.WIFI, '192.168.1.10');

			expect(addressRepo.save).not.toHaveBeenCalled();
		});

		test('retries as update on unique constraint violation', async () => {
			addressRepo.findOne.mockResolvedValue(null);
			addressRepo.save.mockRejectedValueOnce(new Error('UNIQUE constraint failed'));

			await svc.upsertAddress('dev-1', AddressType.ETHERNET, '192.168.1.20');

			expect(addressRepo.update).toHaveBeenCalledWith(
				{ deviceId: 'dev-1', interfaceType: AddressType.ETHERNET },
				{ address: '192.168.1.20' },
			);
		});
	});

	describe('syncAddresses', () => {
		test('upserts both addresses when both provided', async () => {
			addressRepo.findOne.mockResolvedValue(null);

			await svc.syncAddresses('dev-1', '10.0.0.1', '10.0.0.2');

			expect(addressRepo.create).toHaveBeenCalledTimes(2);
		});

		test('only upserts wifi when ethernet is null', async () => {
			addressRepo.findOne.mockResolvedValue(null);

			await svc.syncAddresses('dev-1', '10.0.0.1', null);

			expect(addressRepo.create).toHaveBeenCalledTimes(1);
			expect(addressRepo.create).toHaveBeenCalledWith(expect.objectContaining({ interfaceType: AddressType.WIFI }));
		});

		test('only upserts ethernet when wifi is null', async () => {
			addressRepo.findOne.mockResolvedValue(null);

			await svc.syncAddresses('dev-1', null, '10.0.0.2');

			expect(addressRepo.create).toHaveBeenCalledTimes(1);
			expect(addressRepo.create).toHaveBeenCalledWith(expect.objectContaining({ interfaceType: AddressType.ETHERNET }));
		});

		test('does nothing when both are null', async () => {
			await svc.syncAddresses('dev-1', null, null);

			expect(addressRepo.findOne).not.toHaveBeenCalled();
		});
	});

	describe('getPreferredAddress', () => {
		test('returns ethernet when both exist (ethernet preferred)', async () => {
			addressRepo.find.mockResolvedValue([
				{ deviceId: 'dev-1', interfaceType: AddressType.WIFI, address: '10.0.0.1' },
				{ deviceId: 'dev-1', interfaceType: AddressType.ETHERNET, address: '10.0.0.2' },
			]);

			const result = await svc.getPreferredAddress('dev-1');

			expect(result).toBe('10.0.0.2');
		});

		test('returns wifi when only wifi exists', async () => {
			addressRepo.find.mockResolvedValue([{ deviceId: 'dev-1', interfaceType: AddressType.WIFI, address: '10.0.0.1' }]);

			const result = await svc.getPreferredAddress('dev-1');

			expect(result).toBe('10.0.0.1');
		});

		test('returns null when no addresses exist', async () => {
			addressRepo.find.mockResolvedValue([]);

			const result = await svc.getPreferredAddress('dev-1');

			expect(result).toBeNull();
		});
	});

	describe('getPreferredAddresses', () => {
		test('returns empty map for empty input', async () => {
			const result = await svc.getPreferredAddresses([]);

			expect(result.size).toBe(0);
			expect(addressRepo.find).not.toHaveBeenCalled();
		});

		test('returns preferred address per device', async () => {
			addressRepo.find.mockResolvedValue([
				{ deviceId: 'dev-1', interfaceType: AddressType.WIFI, address: '10.0.0.1' },
				{ deviceId: 'dev-1', interfaceType: AddressType.ETHERNET, address: '10.0.0.2' },
				{ deviceId: 'dev-2', interfaceType: AddressType.WIFI, address: '10.0.0.3' },
			]);

			const result = await svc.getPreferredAddresses(['dev-1', 'dev-2']);

			expect(result.get('dev-1')).toBe('10.0.0.2'); // ethernet preferred
			expect(result.get('dev-2')).toBe('10.0.0.3'); // only wifi
		});
	});

	describe('findDeviceByCanonicalMac', () => {
		test('normalizes MAC before querying', async () => {
			deviceRepo.findOne.mockResolvedValue(null);

			await svc.findDeviceByCanonicalMac('a8:03:2a:be:50:84');

			expect(deviceRepo.findOne).toHaveBeenCalledWith({
				where: { canonicalMac: 'A8032ABE5084' },
			});
		});

		test('returns device when found', async () => {
			const device = { id: 'dev-1' } as ShellyNgDeviceEntity;
			deviceRepo.findOne.mockResolvedValue(device);

			const result = await svc.findDeviceByCanonicalMac('A8032ABE5084');

			expect(result).toBe(device);
		});
	});

	describe('setCanonicalMac', () => {
		test('normalizes MAC before storing', async () => {
			await svc.setCanonicalMac('dev-1', 'a8:03:2a:be:50:84');

			expect(deviceRepo.update).toHaveBeenCalledWith('dev-1', { canonicalMac: 'A8032ABE5084' });
		});
	});
});
