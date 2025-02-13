/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategory } from '../devices.constants';
import { CreateThirdPartyDeviceDto } from '../dto/create-device.dto';
import { UpdateThirdPartyDeviceDto } from '../dto/update-device.dto';
import { ThirdPartyDeviceEntity } from '../entities/devices.entity';
import { DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

import { DevicesController } from './devices.controller';

describe('DevicesController', () => {
	let controller: DevicesController;
	let service: DevicesService;
	let mapper: DevicesTypeMapperService;

	const mockDevice: ThirdPartyDeviceEntity = {
		id: uuid().toString(),
		type: 'third-party',
		category: DeviceCategory.GENERIC,
		name: 'Test Device',
		description: null,
		serviceAddress: 'http://127.0.0.1',
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
						findAll: jest.fn().mockResolvedValue([mockDevice]),
						findOne: jest.fn().mockResolvedValue(mockDevice),
						create: jest.fn().mockResolvedValue(mockDevice),
						update: jest.fn().mockResolvedValue(mockDevice),
						remove: jest.fn().mockResolvedValue(undefined),
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

			expect(result).toEqual([mockDevice]);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return a single device', async () => {
			const result = await controller.findOne(mockDevice.id);

			expect(result).toEqual(mockDevice);
			expect(service.findOne).toHaveBeenCalledWith(mockDevice.id);
		});

		it('should create a new device', async () => {
			const createDto: CreateThirdPartyDeviceDto = {
				type: 'third-party',
				category: DeviceCategory.GENERIC,
				name: 'New Device',
				service_address: 'http://127.0.0.1',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'third-party',
				class: ThirdPartyDeviceEntity,
				createDto: CreateThirdPartyDeviceDto,
				updateDto: UpdateThirdPartyDeviceDto,
			});

			const result = await controller.create({ data: createDto });

			expect(result).toEqual(mockDevice);
			expect(service.create).toHaveBeenCalledWith(createDto);
		});

		it('should update a device', async () => {
			const updateDto: UpdateThirdPartyDeviceDto = {
				type: 'third-party',
				name: 'Updated Device',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'third-party',
				class: ThirdPartyDeviceEntity,
				createDto: CreateThirdPartyDeviceDto,
				updateDto: UpdateThirdPartyDeviceDto,
			});

			const result = await controller.update(mockDevice.id, { data: updateDto });

			expect(result).toEqual(mockDevice);
			expect(service.update).toHaveBeenCalledWith(mockDevice.id, updateDto);
		});

		it('should delete a device', async () => {
			const result = await controller.remove(mockDevice.id);

			expect(result).toBeUndefined();
			expect(service.remove).toHaveBeenCalledWith(mockDevice.id);
		});
	});
});
