/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { useContainer } from 'class-validator';
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DEVICES_MODULE_PREFIX,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../devices.constants';
import { CreateChannelPropertyDto } from '../dto/create-channel-property.dto';
import { UpdateChannelPropertyDto } from '../dto/update-channel-property.dto';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';
import { ChannelsPropertiesTypeMapperService } from '../services/channels.properties-type-mapper.service';
import { ChannelsPropertiesService } from '../services/channels.properties.service';
import { ChannelsService } from '../services/channels.service';
import { DevicesService } from '../services/devices.service';
import { PropertyTimeseriesService } from '../services/property-timeseries.service';

import { DevicesChannelsPropertiesController } from './devices.channels.properties.controller';

describe('DevicesChannelsPropertiesController', () => {
	let controller: DevicesChannelsPropertiesController;
	let devicesService: DevicesService;
	let channelsService: ChannelsService;
	let channelsPropertiesService: ChannelsPropertiesService;
	let mapper: ChannelsPropertiesTypeMapperService;
	let propertyTimeseriesService: PropertyTimeseriesService;

	const mockDevice: DeviceEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		identifier: null,
		name: 'Test Device',
		description: null,
		enabled: true,
		status: {
			online: false,
			status: ConnectionState.UNKNOWN,
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
	};

	const mockChannel: ChannelEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: ChannelCategory.GENERIC,
		identifier: null,
		name: 'Test Channel',
		description: 'Test description',
		createdAt: new Date(),
		updatedAt: new Date(),
		device: mockDevice,
		controls: [],
		properties: [],
	};

	const mockChannelProperty: ChannelPropertyEntity = {
		id: uuid().toString(),
		type: 'mock',
		name: 'Test Property',
		category: PropertyCategory.GENERIC,
		identifier: null,
		permissions: [PermissionType.READ_ONLY],
		dataType: DataTypeType.STRING,
		unit: '°C',
		format: null,
		invalid: null,
		step: 0.5,
		value: '22.5',
		channel: mockChannel,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DevicesChannelsPropertiesController],
			providers: [
				{
					provide: ChannelsPropertiesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => {}),
					},
				},
				{
					provide: DevicesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(DeviceEntity, mockDevice)]),
						findOne: jest.fn().mockResolvedValue(toInstance(DeviceEntity, mockDevice)),
						create: jest.fn().mockResolvedValue(toInstance(DeviceEntity, mockDevice)),
						update: jest.fn().mockResolvedValue(toInstance(DeviceEntity, mockDevice)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(ChannelEntity, mockChannel)]),
						findOne: jest.fn().mockResolvedValue(toInstance(ChannelEntity, mockChannel)),
						create: jest.fn().mockResolvedValue(toInstance(ChannelEntity, mockChannel)),
						update: jest.fn().mockResolvedValue(toInstance(ChannelEntity, mockChannel)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: ChannelsPropertiesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(ChannelPropertyEntity, mockChannelProperty)]),
						findOne: jest.fn().mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty)),
						create: jest.fn().mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty)),
						update: jest.fn().mockResolvedValue(toInstance(ChannelPropertyEntity, mockChannelProperty)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: PropertyTimeseriesService,
					useValue: {
						queryTimeseries: jest.fn(),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		controller = module.get<DevicesChannelsPropertiesController>(DevicesChannelsPropertiesController);
		devicesService = module.get<DevicesService>(DevicesService);
		channelsService = module.get<ChannelsService>(ChannelsService);
		channelsPropertiesService = module.get<ChannelsPropertiesService>(ChannelsPropertiesService);
		mapper = module.get<ChannelsPropertiesTypeMapperService>(ChannelsPropertiesTypeMapperService);
		propertyTimeseriesService = module.get<PropertyTimeseriesService>(PropertyTimeseriesService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(devicesService).toBeDefined();
		expect(channelsService).toBeDefined();
		expect(channelsPropertiesService).toBeDefined();
		expect(mapper).toBeDefined();
		expect(propertyTimeseriesService).toBeDefined();
	});

	describe('Channel properties', () => {
		it('should return all properties for a channel', async () => {
			const result = await controller.findAll(mockDevice.id, mockChannel.id);

			expect(result.data).toEqual([toInstance(ChannelPropertyEntity, mockChannelProperty)]);
			expect(channelsPropertiesService.findAll).toHaveBeenCalledWith(mockChannel.id);
		});

		it('should return a single property for a channel', async () => {
			const result = await controller.findOne(mockDevice.id, mockChannel.id, mockChannelProperty.id);

			expect(result.data).toEqual(toInstance(ChannelPropertyEntity, mockChannelProperty));
			expect(channelsPropertiesService.findOne).toHaveBeenCalledWith(mockChannelProperty.id, mockChannel.id);
		});

		it('should create a new property', async () => {
			const createDto: CreateChannelPropertyDto = {
				type: 'mock',
				category: PropertyCategory.GENERIC,
				name: 'New Property',
				permissions: [PermissionType.READ_ONLY],
				data_type: DataTypeType.UNKNOWN,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: ChannelPropertyEntity,
				createDto: CreateChannelPropertyDto,
				updateDto: UpdateChannelPropertyDto,
			});

			const mockRequest = {
				url: '/api/v1/devices/test-device-id/channels/test-channel-id/properties',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			const result = await controller.create(
				mockDevice.id,
				mockChannel.id,
				{ data: createDto },
				mockResponse,
				mockRequest,
			);

			expect(result.data).toEqual(toInstance(ChannelPropertyEntity, mockChannelProperty));
			expect(channelsPropertiesService.create).toHaveBeenCalledWith(mockChannel.id, createDto);
			expect(mockResponse.header).toHaveBeenCalledWith(
				'Location',
				expect.stringContaining(
					`/api/v1/${DEVICES_MODULE_PREFIX}/devices/${mockDevice.id}/channels/${mockChannel.id}/properties/${mockChannelProperty.id}`,
				),
			);
		});

		it('should update a property', async () => {
			const updateDto: UpdateChannelPropertyDto = {
				type: 'mock',
				name: 'Updated Property',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: ChannelPropertyEntity,
				createDto: CreateChannelPropertyDto,
				updateDto: UpdateChannelPropertyDto,
			});

			const result = await controller.update(mockDevice.id, mockChannel.id, mockChannelProperty.id, {
				data: updateDto,
			});

			expect(result.data).toEqual(toInstance(ChannelPropertyEntity, mockChannelProperty));
			expect(channelsPropertiesService.update).toHaveBeenCalledWith(mockChannelProperty.id, updateDto);
		});

		it('should delete a property', async () => {
			const result = await controller.remove(mockDevice.id, mockChannel.id, mockChannelProperty.id);

			expect(result).toBeUndefined();
			expect(channelsPropertiesService.remove).toHaveBeenCalledWith(mockChannelProperty.id);
		});
	});

	describe('Property timeseries', () => {
		it('should return timeseries data with HTTP 200', async () => {
			const mockTimeseriesResult = {
				property: mockChannelProperty.id,
				from: '2025-01-01T10:00:00.000Z',
				to: '2025-01-01T22:00:00.000Z',
				bucket: '5m',
				points: [
					{ time: '2025-01-01T10:00:00Z', value: 21.4 },
					{ time: '2025-01-01T10:05:00Z', value: 21.6 },
				],
			};

			jest.spyOn(propertyTimeseriesService, 'queryTimeseries').mockResolvedValue(mockTimeseriesResult);

			const query = {
				from: '2025-01-01T10:00:00Z',
				to: '2025-01-01T22:00:00Z',
				bucket: '5m' as const,
			};

			const result = await controller.getTimeseries(mockDevice.id, mockChannel.id, mockChannelProperty.id, query);

			expect(result.data).toEqual(mockTimeseriesResult);
			expect(propertyTimeseriesService.queryTimeseries).toHaveBeenCalledWith(
				expect.objectContaining({ id: mockChannelProperty.id }),
				expect.any(Date),
				expect.any(Date),
				'5m',
			);
		});

		it('should return empty points array when no data exists', async () => {
			const mockEmptyResult = {
				property: mockChannelProperty.id,
				from: '2025-01-01T10:00:00.000Z',
				to: '2025-01-01T22:00:00.000Z',
				bucket: '5m',
				points: [],
			};

			jest.spyOn(propertyTimeseriesService, 'queryTimeseries').mockResolvedValue(mockEmptyResult);

			const query = {
				from: '2025-01-01T10:00:00Z',
				to: '2025-01-01T22:00:00Z',
			};

			const result = await controller.getTimeseries(mockDevice.id, mockChannel.id, mockChannelProperty.id, query);

			expect(result).toHaveProperty('data');
			expect(result.data.points).toEqual([]);
			expect(result.data.property).toBe(mockChannelProperty.id);
		});

		it('should use default time range (last 24 hours) when not provided', async () => {
			const mockTimeseriesResult = {
				property: mockChannelProperty.id,
				from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
				to: new Date().toISOString(),
				bucket: '5m',
				points: [],
			};

			jest.spyOn(propertyTimeseriesService, 'queryTimeseries').mockResolvedValue(mockTimeseriesResult);

			const result = await controller.getTimeseries(mockDevice.id, mockChannel.id, mockChannelProperty.id, {});

			expect(result.data).toEqual(mockTimeseriesResult);
			expect(propertyTimeseriesService.queryTimeseries).toHaveBeenCalled();
		});

		it('should throw NotFoundException when device does not exist', async () => {
			jest.spyOn(devicesService, 'findOne').mockResolvedValue(null);

			const query = {
				from: '2025-01-01T10:00:00Z',
				to: '2025-01-01T22:00:00Z',
			};

			await expect(
				controller.getTimeseries('non-existent-device', mockChannel.id, mockChannelProperty.id, query),
			).rejects.toThrow();
		});

		it('should throw NotFoundException when channel does not exist', async () => {
			jest.spyOn(channelsService, 'findOne').mockResolvedValue(null);

			const query = {
				from: '2025-01-01T10:00:00Z',
				to: '2025-01-01T22:00:00Z',
			};

			await expect(
				controller.getTimeseries(mockDevice.id, 'non-existent-channel', mockChannelProperty.id, query),
			).rejects.toThrow();
		});

		it('should throw NotFoundException when property does not exist', async () => {
			jest.spyOn(channelsPropertiesService, 'findOne').mockResolvedValue(null);

			const query = {
				from: '2025-01-01T10:00:00Z',
				to: '2025-01-01T22:00:00Z',
			};

			await expect(
				controller.getTimeseries(mockDevice.id, mockChannel.id, 'non-existent-property', query),
			).rejects.toThrow();
		});
	});
});
