/*
eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unnecessary-type-assertion,
@typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { DevicesShellyV1Exception } from '../devices-shelly-v1.exceptions';
import { ShellyV1DeviceInfoModel } from '../models/shelly-v1.model';
import { ShellyV1ProbeService } from '../services/shelly-v1-probe.service';

import { ShellyV1DevicesController } from './shelly-v1-devices.controller';

describe('ShellyV1DevicesController', () => {
	let controller: ShellyV1DevicesController;
	let probeService: jest.Mocked<ShellyV1ProbeService>;

	beforeAll(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined as any);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined as any);
	});

	beforeEach(async () => {
		const probeServiceMock: Partial<jest.Mocked<ShellyV1ProbeService>> = {
			probeDevice: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [ShellyV1DevicesController],
			providers: [{ provide: ShellyV1ProbeService, useValue: probeServiceMock }],
		}).compile();

		controller = module.get(ShellyV1DevicesController);
		probeService = module.get(ShellyV1ProbeService) as jest.Mocked<ShellyV1ProbeService>;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('controller is defined', () => {
		expect(controller).toBeDefined();
	});

	describe('POST /devices/info', () => {
		it('returns successful probe result for reachable device without auth', async () => {
			const mockResponse: ShellyV1DeviceInfoModel = {
				reachable: true,
				authRequired: false,
				host: '192.168.1.100',
				ip: '192.168.1.100',
				mac: '8CBFEAA58474',
				model: 'SHSW-1',
				firmware: '1.14.0',
				deviceType: 'Shelly 1',
				description: 'Shelly 1 (SHSW-1)',
			};

			probeService.probeDevice.mockResolvedValue(mockResponse);

			const payload = { data: { hostname: '192.168.1.100' } };
			const result = await controller.getInfo(payload);

			expect(result.data.reachable).toBe(true);
			expect(result.data.authRequired).toBe(false);
			expect(result.data.host).toBe('192.168.1.100');
			expect(result.data.model).toBe('SHSW-1');

			expect(probeService.probeDevice).toHaveBeenCalledWith({ hostname: '192.168.1.100' });
		});

		it('returns probe result with auth status for device requiring auth', async () => {
			const mockResponse: ShellyV1DeviceInfoModel = {
				reachable: true,
				authRequired: true,
				authValid: true,
				host: '192.168.1.101',
				ip: '192.168.1.101',
				mac: '8CBFEAA58475',
				model: 'SHSW-25',
				firmware: '1.14.0',
				deviceType: 'Shelly 2.5',
				description: 'Shelly 2.5 (SHSW-25)',
			};

			probeService.probeDevice.mockResolvedValue(mockResponse);

			const payload = { data: { hostname: '192.168.1.101', password: 'secret' } };
			const result = await controller.getInfo(payload);

			expect(result.data.reachable).toBe(true);
			expect(result.data.authRequired).toBe(true);
			expect(result.data.authValid).toBe(true);

			expect(probeService.probeDevice).toHaveBeenCalledWith({ hostname: '192.168.1.101', password: 'secret' });
		});

		it('returns unreachable result for device that cannot be reached', async () => {
			const mockResponse: ShellyV1DeviceInfoModel = {
				reachable: false,
				authRequired: false,
				host: '192.168.1.200',
			};

			probeService.probeDevice.mockResolvedValue(mockResponse);

			const payload = { data: { hostname: '192.168.1.200' } };
			const result = await controller.getInfo(payload);

			expect(result.data.reachable).toBe(false);
			expect(result.data.host).toBe('192.168.1.200');
		});

		it('returns unreachable result when probeDevice throws DevicesShellyV1Exception', async () => {
			probeService.probeDevice.mockRejectedValue(new DevicesShellyV1Exception('Network timeout'));

			const payload = { data: { hostname: '192.168.1.200' } };
			const result = await controller.getInfo(payload);

			expect(result.data.reachable).toBe(false);
			expect(result.data.host).toBe('192.168.1.200');
		});

		it('rethrows unexpected errors', async () => {
			const unexpectedError = new Error('Unexpected system error');

			probeService.probeDevice.mockRejectedValue(unexpectedError);

			const payload = { data: { hostname: '192.168.1.100' } };

			await expect(controller.getInfo(payload)).rejects.toThrow(unexpectedError);
		});
	});

	describe('GET /devices/supported', () => {
		it('returns list of supported Shelly V1 devices', async () => {
			const result = await controller.getSupported();

			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data.length).toBeGreaterThan(0);

			// Check structure of first device
			const firstDevice = result.data[0];

			expect(firstDevice).toHaveProperty('group');
			expect(firstDevice).toHaveProperty('name');
			expect(firstDevice).toHaveProperty('models');
			expect(firstDevice).toHaveProperty('categories');
			expect(Array.isArray(firstDevice.models)).toBe(true);
			expect(Array.isArray(firstDevice.categories)).toBe(true);
		});
	});
});
