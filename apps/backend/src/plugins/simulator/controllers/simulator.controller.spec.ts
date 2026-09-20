import { DeviceCategory, PermissionType, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelInputOccurrencesService } from '../../../modules/devices/services/channel-input-occurrences.service';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DeviceGeneratorService } from '../services/device-generator.service';

import { SimulatorController } from './simulator.controller';

describe('SimulatorController', () => {
	const devicesService = {
		create: jest.fn(),
		findOne: jest.fn(),
	};
	const channelsService = {
		findOne: jest.fn(),
	};
	const channelsPropertiesService = {
		findAll: jest.fn(),
		findOne: jest.fn(),
		update: jest.fn(),
	};
	const deviceConnectivityService = {
		setConnectionState: jest.fn(),
	};
	const deviceGeneratorService = {
		generateDevice: jest.fn(),
	};
	const channelInputOccurrencesService = {
		publishOccurrence: jest.fn(),
	};

	const controller = new SimulatorController(
		devicesService as unknown as DevicesService,
		channelsService as unknown as ChannelsService,
		channelsPropertiesService as unknown as ChannelsPropertiesService,
		deviceConnectivityService as unknown as DeviceConnectivityService,
		deviceGeneratorService as unknown as DeviceGeneratorService,
		channelInputOccurrencesService as unknown as ChannelInputOccurrencesService,
	);

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('serializes device categories with their identifier and name preserved', () => {
		const response = controller.getCategories();

		expect(response.data.length).toBeGreaterThan(0);

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

	it('simulates an occurrence using ChannelInputOccurrencesService', async () => {
		const deviceId = '11111111-1111-4111-8111-111111111111';
		const channelId = '22222222-2222-4222-8222-222222222222';
		const propertyId = '33333333-3333-4333-8333-333333333333';

		const device = { id: deviceId, type: 'simulator' };
		const channel = { id: channelId, device: deviceId };
		const property = {
			id: propertyId,
			category: PropertyCategory.EVENT,
			permissions: [PermissionType.EVENT_ONLY],
		};

		devicesService.findOne.mockResolvedValue(device);
		channelsService.findOne.mockResolvedValue(channel);
		channelsPropertiesService.findAll.mockResolvedValue([property]);
		channelInputOccurrencesService.publishOccurrence.mockResolvedValue({
			id: '44444444-4444-4444-8444-444444444444',
			deviceId,
			channelId,
			propertyId,
			event: 'press',
			timestamp: '2026-03-30T12:00:00.000Z',
		});

		const response = await controller.simulateOccurrence(deviceId, {
			data: {
				channel_id: channelId,
				event: 'press',
			},
		});

		expect(response.data.success).toBe(true);
		expect(response.data.occurrence_id).toBe('44444444-4444-4444-8444-444444444444');
		expect(response.data.event).toBe('press');
		expect(response.data.dropped).toBe(false);
		expect(channelInputOccurrencesService.publishOccurrence).toHaveBeenCalledWith(
			expect.objectContaining({
				deviceId,
				channelId,
				propertyId,
				event: 'press',
			}),
		);
	});
});
