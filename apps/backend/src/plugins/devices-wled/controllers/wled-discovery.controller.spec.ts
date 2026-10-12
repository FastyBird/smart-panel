/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { WledService } from '../services/wled.service';

import { WledDiscoveryController } from './wled-discovery.controller';

describe('WledDiscoveryController', () => {
	let controller: WledDiscoveryController;
	let service: jest.Mocked<WledService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [WledDiscoveryController],
			providers: [
				{
					provide: WledService,
					useValue: {
						getDiscoveryInventory: jest.fn(),
						rescanDiscovery: jest.fn(),
						probeDevice: jest.fn(),
						adoptDevices: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get(WledDiscoveryController);
		service = module.get(WledService);
	});

	it('returns the enriched discovery inventory', async () => {
		service.getDiscoveryInventory.mockResolvedValue({ mdnsEnabled: true, discoveryRunning: true, devices: [] });

		const response = await controller.getDiscovery();

		expect(response.data).toEqual({ mdnsEnabled: true, discoveryRunning: true, devices: [] });
	});

	it('delegates a stateless manual probe', async () => {
		service.probeDevice.mockResolvedValue({
			host: '192.168.1.100',
			name: 'WLED',
			mac: 'AA:BB:CC:DD:EE:FF',
			port: 80,
			adoptedDeviceId: null,
		});

		const response = await controller.probeDevice({ data: { host: '192.168.1.100' } });

		expect(service.probeDevice).toHaveBeenCalledWith('192.168.1.100');
		expect(response.data.mac).toBe('AA:BB:CC:DD:EE:FF');
	});

	it('returns independent batch adoption results', async () => {
		service.adoptDevices.mockResolvedValue([
			{ host: '192.168.1.100', name: 'WLED', status: 'created', error: null, deviceId: 'device-1' },
		]);
		const devices = [
			{ host: '192.168.1.100', name: 'WLED', category: DeviceCategory.LIGHTING as DeviceCategory.LIGHTING },
		];

		const response = await controller.adoptDevices({ data: { devices } });

		expect(service.adoptDevices).toHaveBeenCalledWith(devices);
		expect(response.data[0].status).toBe('created');
	});
});
