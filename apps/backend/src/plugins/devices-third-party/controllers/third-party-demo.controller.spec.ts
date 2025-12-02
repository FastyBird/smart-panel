/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { FastifyReply } from 'fastify';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ThirdPartyPropertiesUpdateStatus } from '../devices-third-party.constants';
import { ReqUpdatePropertiesDto } from '../dto/third-party-property-update-request.dto';

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

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should return 204 No Content when all properties succeed and queue property update', async () => {
		const mockProperty = {
			id: 'property-123',
			type: 'string',
		};

		const body: ReqUpdatePropertiesDto = {
			properties: [
				{
					device: 'device-123',
					channel: 'channel-123',
					property: 'property-123',
					value: 'ON',
				},
			],
		};

		const mockReply = {
			status: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
		} as unknown as FastifyReply;

		(propertiesService.findOne as jest.Mock).mockResolvedValue(mockProperty);

		await controller.controlDevice(body, mockReply);

		expect(mockReply.status).toHaveBeenCalledWith(204);
		expect(mockReply.send).toHaveBeenCalled();
		expect(propertiesService.findOne).toHaveBeenCalledWith('property-123');
		expect(propertiesService.update).not.toHaveBeenCalled();

		jest.advanceTimersByTime(500);

		expect(propertiesService.update).toHaveBeenCalledWith('property-123', {
			type: 'string',
			value: 'ON',
		});
	});

	it('should return 207 Multi-Status when properties are not found', async () => {
		(propertiesService.findOne as jest.Mock).mockResolvedValue(null);

		const body: ReqUpdatePropertiesDto = {
			properties: [
				{
					device: 'device-123',
					channel: 'channel-123',
					property: 'unknown-prop',
					value: '123',
				},
			],
		};

		const mockReply = {
			status: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
		} as unknown as FastifyReply;

		await controller.controlDevice(body, mockReply);

		expect(mockReply.status).toHaveBeenCalledWith(207);
		expect(mockReply.send).toHaveBeenCalledWith({
			properties: [
				{
					device: 'device-123',
					channel: 'channel-123',
					property: 'unknown-prop',
					status: ThirdPartyPropertiesUpdateStatus.RESOURCE_NOT_FOUND,
				},
			],
		});
		expect(propertiesService.update).not.toHaveBeenCalled();
	});
});
