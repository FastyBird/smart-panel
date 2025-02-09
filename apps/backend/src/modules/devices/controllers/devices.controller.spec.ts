/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { DeviceCategoryEnum } from '../devices.constants';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';
import { DevicesTypeMapperService } from '../services/devices-type-mapper.service';
import { DevicesService } from '../services/devices.service';

import { DevicesController } from './devices.controller';

class MockDevice extends DeviceEntity {
	@IsString()
	@Expose({ name: 'mock_value' })
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;
}

class CreateMockDeviceDto extends CreateDeviceDto {
	@Expose({ name: 'mock_value' })
	@IsString()
	mockValue: string;
}

class UpdateMockDeviceDto extends UpdateDeviceDto {
	@Expose({ name: 'mock_value' })
	@IsOptional()
	@IsString()
	mockValue?: string;
}

describe('DevicesController', () => {
	let controller: DevicesController;
	let service: DevicesService;
	let mapper: DevicesTypeMapperService;

	const mockDevice: DeviceEntity = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategoryEnum.GENERIC,
		name: 'Test Device',
		description: null,
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
			const createDto: CreateMockDeviceDto = {
				type: 'mock',
				category: DeviceCategoryEnum.GENERIC,
				name: 'New Device',
				mockValue: 'Some value',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			const result = await controller.create(createDto);

			expect(result).toEqual(mockDevice);
			expect(service.create).toHaveBeenCalledWith(createDto);
		});

		it('should update a device', async () => {
			const updateDto: UpdateMockDeviceDto = {
				name: 'Updated Device',
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			const result = await controller.update(mockDevice.id, updateDto);

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
