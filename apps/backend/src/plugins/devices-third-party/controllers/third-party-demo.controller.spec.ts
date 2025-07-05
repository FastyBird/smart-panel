import { Test, TestingModule } from '@nestjs/testing';

import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';
import { PropertiesUpdateRequestDto } from '../dto/third-party-property-update-request.dto';

import { ThirdPartyDemoController } from './third-party-demo.controller';

jest.useFakeTimers();

describe('ThirdPartyDemoController', () => {
	let controller: ThirdPartyDemoController;
	let propertiesService: ChannelsPropertiesService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [ThirdPartyDemoController],
			providers: [
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findOne: jest.fn(),
						update: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<ThirdPartyDemoController>(ThirdPartyDemoController);
		propertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should return response with SUCCESS status and queue property update', async () => {
		const mockProperty = {
			id: 'property-123',
			type: 'string',
		};

		const body: PropertiesUpdateRequestDto = {
			properties: [
				{
					device: 'device-123',
					channel: 'channel-123',
					property: 'property-123',
					value: 'ON',
				},
			],
		};

		(propertiesService.findOne as jest.Mock).mockResolvedValue(mockProperty);

		const response = await controller.controlDevice(body);

		expect(response).toEqual({
			properties: [
				{
					device: 'device-123',
					channel: 'channel-123',
					property: 'property-123',
					value: 'ON',
					status: ThirdPartyPropertiesUpdateStatus.SUCCESS,
				},
			],
		});

		expect(propertiesService.findOne).toHaveBeenCalledWith('property-123');
		expect(propertiesService.update).not.toHaveBeenCalled();

		jest.advanceTimersByTime(500);

		expect(propertiesService.update).toHaveBeenCalledWith('property-123', {
			type: 'string',
			value: 'ON',
		});
	});

	it('should skip unknown properties', async () => {
		(propertiesService.findOne as jest.Mock).mockResolvedValue(null);

		const body: PropertiesUpdateRequestDto = {
			properties: [
				{
					device: 'device-123',
					channel: 'channel-123',
					property: 'unknown-prop',
					value: '123',
				},
			],
		};

		const response = await controller.controlDevice(body);

		expect(response.properties[0].status).toBe(ThirdPartyPropertiesUpdateStatus.SUCCESS);
		expect(propertiesService.update).not.toHaveBeenCalled();
	});
});
