/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceCategory } from '../devices.constants';
import { CreateDeviceControlDto } from '../dto/create-device-control.dto';
import { DeviceControlEntity, DeviceEntity } from '../entities/devices.entity';
import { DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesControlsService } from '../services/devices.controls.service';
import { DevicesService } from '../services/devices.service';

import { DevicesControlsController } from './devices.controls.controller';

describe('DevicesControlsController', () => {
	let controller: DevicesControlsController;
	let devicesService: DevicesService;
	let devicesControlsService: DevicesControlsService;
	let mapper: DevicesTypeMapperService;

	const mockDevice: DeviceEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		name: 'Test Device',
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
	};

	const mockDeviceControl: DeviceControlEntity = {
		id: uuid().toString(),
		name: 'Test Control',
		device: mockDevice,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DevicesControlsController],
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
					provide: DevicesControlsService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(DeviceControlEntity, mockDeviceControl)]),
						findOne: jest.fn().mockResolvedValue(toInstance(DeviceControlEntity, mockDeviceControl)),
						findOneByName: jest.fn().mockResolvedValue(toInstance(DeviceControlEntity, mockDeviceControl)),
						create: jest.fn().mockResolvedValue(toInstance(DeviceControlEntity, mockDeviceControl)),
						remove: jest.fn().mockResolvedValue(undefined),
					},
				},
			],
		}).compile();

		controller = module.get<DevicesControlsController>(DevicesControlsController);
		devicesService = module.get<DevicesService>(DevicesService);
		devicesControlsService = module.get<DevicesControlsService>(DevicesControlsService);
		mapper = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(devicesService).toBeDefined();
		expect(devicesControlsService).toBeDefined();
		expect(mapper).toBeDefined();
	});

	describe('Device Controls', () => {
		it('should return all device controls for a device', async () => {
			const result = await controller.findAll(mockDevice.id);

			expect(result).toEqual([toInstance(DeviceControlEntity, mockDeviceControl)]);
			expect(devicesControlsService.findAll).toHaveBeenCalledWith(mockDevice.id);
		});

		it('should return a single device control for a device', async () => {
			const result = await controller.findOneControl(mockDevice.id, mockDeviceControl.id);

			expect(result).toEqual(toInstance(DeviceControlEntity, mockDeviceControl));
			expect(devicesControlsService.findOne).toHaveBeenCalledWith(mockDeviceControl.id, mockDevice.id);
		});

		it('should create a new device control', async () => {
			const createDto: CreateDeviceControlDto = { name: 'New Control' };

			const result = await controller.create(mockDevice.id, { data: createDto });

			expect(result).toEqual(toInstance(DeviceControlEntity, mockDeviceControl));
			expect(devicesControlsService.create).toHaveBeenCalledWith(mockDevice.id, createDto);
		});

		it('should delete a device control', async () => {
			const result = await controller.remove(mockDevice.id, mockDeviceControl.id);

			expect(result).toBeUndefined();
			expect(devicesControlsService.remove).toHaveBeenCalledWith(mockDeviceControl.id, mockDevice.id);
		});
	});
});
