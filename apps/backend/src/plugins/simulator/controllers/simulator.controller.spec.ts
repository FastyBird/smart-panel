import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceGeneratorService } from '../services/device-generator.service';

import { SimulatorController } from './simulator.controller';

describe('SimulatorController', () => {
	const devicesService = {
		create: jest.fn(),
	};
	const channelsPropertiesService = {};
	const deviceConnectivityService = {
		setConnectionState: jest.fn(),
	};
	const deviceGeneratorService = {
		generateDevice: jest.fn(),
	};

	const controller = new SimulatorController(
		devicesService as unknown as DevicesService,
		channelsPropertiesService as ChannelsPropertiesService,
		deviceConnectivityService as unknown as DeviceConnectivityService,
		deviceGeneratorService as unknown as DeviceGeneratorService,
	);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('serializes device categories with their identifier and name preserved', () => {
		const response = controller.getCategories();

		expect(response.data.length).toBeGreaterThan(0);

		// Regression: the response model exposed `data` without `@Type`, so
		// `excludeExtraneousValues` stripped every nested category down to an
		// empty object and the admin wizard rendered options with no value.
		for (const category of response.data) {
			expect(typeof category.category).toBe('string');
			expect(category.category.length).toBeGreaterThan(0);
			expect(typeof category.name).toBe('string');
			expect(category.name.length).toBeGreaterThan(0);
		}

		expect(response.data.map((category) => category.category)).toContain(DeviceCategory.LIGHTING);
	});

	it('returns the persisted device when initial connectivity setup fails', async () => {
		const dto = {
			category: DeviceCategory.LIGHTING,
			name: 'Generated light',
		};
		const generatedData = { id: '11111111-1111-4111-8111-111111111111', type: 'simulator' };
		const device = { ...generatedData, category: DeviceCategory.LIGHTING, name: dto.name };

		deviceGeneratorService.generateDevice.mockReturnValue(generatedData);
		devicesService.create.mockResolvedValue(device);
		deviceConnectivityService.setConnectionState.mockRejectedValue(new Error('status storage unavailable'));

		const response = await controller.generateDevice({ data: dto });

		expect(response.data).toEqual(expect.objectContaining({ id: device.id, name: device.name }));
		expect(devicesService.create).toHaveBeenCalledWith(generatedData);
		expect(deviceConnectivityService.setConnectionState).toHaveBeenCalledWith(device.id, {
			state: 'connected',
			reason: 'Simulator device created',
		});
	});
});
