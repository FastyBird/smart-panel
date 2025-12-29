/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { DEVICES_MODULE_PREFIX } from '../devices.constants';
import { ConnectionState, DeviceCategory } from '../devices.constants';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';
import { DeviceValidationService } from '../services/device-validation.service';
import { DeviceZonesService } from '../services/device-zones.service';
import { DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

import { DevicesController } from './devices.controller';

describe('DevicesController', () => {
	let controller: DevicesController;
	let service: DevicesService;
	let mapper: DevicesTypeMapperService;

	const mockDevice: DeviceEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		identifier: null,
		name: 'Test Device',
		description: null,
		enabled: true,
		roomId: null,
		room: null,
		deviceZones: [],
		status: {
			online: false,
			status: ConnectionState.UNKNOWN,
		},
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DevicesController],
			providers: [
				{
					provide: DevicesTypeMapperService,
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
					provide: DeviceValidationService,
					useValue: {
						validateAllDevices: jest.fn().mockResolvedValue({
							summary: {
								totalDevices: 0,
								validDevices: 0,
								invalidDevices: 0,
								totalIssues: 0,
								errorCount: 0,
								warningCount: 0,
							},
							devices: [],
						}),
						validateDeviceById: jest.fn().mockResolvedValue(null),
					},
				},
				{
					provide: DeviceZonesService,
					useValue: {
						addDeviceToZone: jest.fn().mockResolvedValue({}),
						removeDeviceFromZone: jest.fn().mockResolvedValue(undefined),
						getDeviceZones: jest.fn().mockResolvedValue([]),
					},
				},
			],
		}).compile();

		controller = module.get<DevicesController>(DevicesController);
		service = module.get<DevicesService>(DevicesService);
		mapper = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('Devices', () => {
		it('should return all devices', async () => {
			const result = await controller.findAll();

			expect(result.data).toEqual([toInstance(DeviceEntity, mockDevice)]);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return a single device', async () => {
			const result = await controller.findOne(mockDevice.id);

			expect(result.data).toEqual(toInstance(DeviceEntity, mockDevice));
			expect(service.findOne).toHaveBeenCalledWith(mockDevice.id);
		});

		it('should create a new device', async () => {
			const createDto: CreateDeviceDto = {
				type: 'mock',
				category: DeviceCategory.GENERIC,
				name: 'New Device',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: DeviceEntity,
				createDto: CreateDeviceDto,
				updateDto: UpdateDeviceDto,
			});

			const mockRequest = {
				url: '/api/v1/devices',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			const result = await controller.create({ data: createDto }, mockResponse, mockRequest);

			expect(result.data).toEqual(toInstance(DeviceEntity, mockDevice));
			expect(service.create).toHaveBeenCalledWith(createDto);
			expect(mockResponse.header).toHaveBeenCalledWith(
				'Location',
				expect.stringContaining(`/api/v1/${DEVICES_MODULE_PREFIX}/devices/${mockDevice.id}`),
			);
		});

		it('should update a device', async () => {
			const updateDto: UpdateDeviceDto = {
				type: 'mock',
				name: 'Updated Device',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: DeviceEntity,
				createDto: CreateDeviceDto,
				updateDto: UpdateDeviceDto,
			});

			const result = await controller.update(mockDevice.id, { data: updateDto });

			expect(result.data).toEqual(toInstance(DeviceEntity, mockDevice));
			expect(service.update).toHaveBeenCalledWith(mockDevice.id, updateDto);
		});

		it('should delete a device', async () => {
			const result = await controller.remove(mockDevice.id);

			expect(result).toBeUndefined();
			expect(service.remove).toHaveBeenCalledWith(mockDevice.id);
		});
	});
});
