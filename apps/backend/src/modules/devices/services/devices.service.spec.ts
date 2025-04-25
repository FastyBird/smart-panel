/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceCategory, EventType } from '../devices.constants';
import { DevicesException } from '../devices.exceptions';
import { CreateDeviceDto } from '../dto/create-device.dto';
import { UpdateDeviceDto } from '../dto/update-device.dto';
import { DeviceEntity } from '../entities/devices.entity';

import { DevicesTypeMapperService } from './devices-type-mapper.service';
import { DevicesService } from './devices.service';
import { PropertyValueService } from './property-value.service';

class MockDevice extends DeviceEntity {
	@Expose({ name: 'mock_value' })
	@IsString()
	@Transform(({ obj }: { obj: { mock_value?: string; mockValue?: string } }) => obj.mock_value || obj.mockValue, {
		toClassOnly: true,
	})
	mockValue: string;

	@Expose()
	get type(): string {
		return 'mock';
	}
}

class CreateMockDeviceDto extends CreateDeviceDto {
	@Expose()
	@IsString()
	mock_value: string;
}

class UpdateMockDeviceDto extends UpdateDeviceDto {
	@Expose()
	@IsOptional()
	@IsString()
	mock_value?: string;
}

describe('DevicesService', () => {
	let service: DevicesService;
	let repository: Repository<DeviceEntity>;
	let mapper: DevicesTypeMapperService;
	let eventEmitter: EventEmitter2;
	let dataSource: DataSource;

	const mockDevice: MockDevice = {
		id: uuid().toString(),
		type: 'mock',
		category: DeviceCategory.GENERIC,
		name: 'Test Device',
		description: null,
		createdAt: new Date(),
		updatedAt: new Date(),
		controls: [],
		channels: [],
		mockValue: 'Some value',
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DevicesService,
				{ provide: getRepositoryToken(DeviceEntity), useFactory: mockRepository },
				{
					provide: DevicesTypeMapperService,
					useValue: {
						registerMapping: jest.fn(() => {}),
						getMapping: jest.fn(() => ({
							type: 'mock',
							class: MockDevice,
							createDto: CreateMockDeviceDto,
							updateDto: UpdateMockDeviceDto,
						})),
					},
				},
				{
					provide: PropertyValueService,
					useValue: {
						write: jest.fn(() => {}),
					},
				},
				{
					provide: DataSource,
					useValue: {
						getRepository: jest.fn(() => {}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<DevicesService>(DevicesService);
		repository = module.get<Repository<DeviceEntity>>(getRepositoryToken(DeviceEntity));
		mapper = module.get<DevicesTypeMapperService>(DevicesTypeMapperService);
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
		dataSource = module.get<DataSource>(DataSource);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(mapper).toBeDefined();
		expect(eventEmitter).toBeDefined();
		expect(dataSource).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all devices', async () => {
			const mockDevices: DeviceEntity[] = [mockDevice];
			jest
				.spyOn(repository, 'find')
				.mockResolvedValue(mockDevices.map((entity) => plainToInstance(MockDevice, entity)));

			const result = await service.findAll();

			expect(result).toEqual(mockDevices.map((entity) => plainToInstance(MockDevice, entity)));
			expect(repository.find).toHaveBeenCalledWith({
				relations: [
					'controls',
					'controls.device',
					'channels',
					'channels.device',
					'channels.controls',
					'channels.controls.channel',
					'channels.properties',
					'channels.properties.channel',
				],
			});
		});
	});

	describe('findOne', () => {
		it('should return a device if found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(MockDevice, mockDevice));

			const result = await service.findOne(mockDevice.id);

			expect(result).toEqual(plainToInstance(MockDevice, mockDevice));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockDevice.id },
				relations: [
					'controls',
					'controls.device',
					'channels',
					'channels.device',
					'channels.controls',
					'channels.controls.channel',
					'channels.properties',
					'channels.properties.channel',
				],
			});
		});

		it('should return null if the device is not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findOne(id);

			expect(result).toEqual(null);
		});
	});

	describe('create', () => {
		it('should create and return a new device', async () => {
			const createDto: CreateMockDeviceDto = {
				type: 'mock',
				category: DeviceCategory.GENERIC,
				name: 'New device',
				mock_value: 'Random text',
			};
			const mockCrateDevice: Partial<MockDevice> = {
				type: createDto.type,
				category: createDto.category,
				name: createDto.name,
				description: null,
				mockValue: createDto.mock_value,
			};
			const mockCratedDevice: MockDevice = {
				id: uuid().toString(),
				type: mockCrateDevice.type,
				category: mockCrateDevice.category,
				name: mockCrateDevice.name,
				description: mockCrateDevice.description,
				createdAt: new Date(),
				updatedAt: null,
				controls: [],
				channels: [],
				mockValue: mockCrateDevice.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest.spyOn(repository, 'save').mockResolvedValue(mockCratedDevice);
			jest.spyOn(repository, 'create').mockReturnValue(mockCratedDevice);
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(MockDevice, mockCratedDevice));

			const result = await service.create(createDto);

			expect(result).toEqual(plainToInstance(MockDevice, mockCratedDevice));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(MockDevice, mockCrateDevice, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCratedDevice);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockCratedDevice.id },
				relations: [
					'controls',
					'controls.device',
					'channels',
					'channels.device',
					'channels.controls',
					'channels.controls.channel',
					'channels.properties',
					'channels.properties.channel',
				],
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DEVICE_CREATED,
				plainToInstance(MockDevice, mockCratedDevice),
			);
		});

		it('should throw DevicesException if the device type is not provided', async () => {
			const createDto: Partial<CreateDeviceDto> = {
				category: DeviceCategory.GENERIC,
				name: 'New device',
			};

			await expect(service.create(createDto as CreateMockDeviceDto)).rejects.toThrow(DevicesException);
		});
	});

	describe('update', () => {
		it('should update and return the device', async () => {
			const updateDto: UpdateMockDeviceDto = {
				type: 'device',
				name: 'Updated device',
				mock_value: 'Changed text',
			};
			const mockUpdateDevice: MockDevice = {
				id: mockDevice.id,
				type: mockDevice.type,
				category: mockDevice.category,
				name: updateDto.name,
				description: mockDevice.description,
				controls: mockDevice.controls,
				channels: mockDevice.channels,
				createdAt: mockDevice.createdAt,
				updatedAt: mockDevice.updatedAt,
				mockValue: updateDto.mock_value,
			};
			const mockUpdatedDevice: MockDevice = {
				id: mockUpdateDevice.id,
				type: mockUpdateDevice.type,
				category: mockUpdateDevice.category,
				name: mockUpdateDevice.name,
				description: mockUpdateDevice.description,
				createdAt: mockUpdateDevice.createdAt,
				updatedAt: new Date(),
				controls: mockUpdateDevice.controls,
				channels: mockUpdateDevice.channels,
				mockValue: mockUpdateDevice.mockValue,
			};

			jest.spyOn(mapper, 'getMapping').mockReturnValue({
				type: 'mock',
				class: MockDevice,
				createDto: CreateMockDeviceDto,
				updateDto: UpdateMockDeviceDto,
			});

			jest.spyOn(dataSource, 'getRepository').mockReturnValue(repository);

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(MockDevice, mockDevice))
				.mockResolvedValueOnce(plainToInstance(MockDevice, mockUpdatedDevice));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedDevice);

			const result = await service.update(mockDevice.id, updateDto);

			expect(result).toEqual(plainToInstance(MockDevice, mockUpdatedDevice));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(MockDevice, mockUpdateDevice));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockDevice.id },
				relations: [
					'controls',
					'controls.device',
					'channels',
					'channels.device',
					'channels.controls',
					'channels.controls.channel',
					'channels.properties',
					'channels.properties.channel',
				],
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DEVICE_UPDATED,
				plainToInstance(MockDevice, mockUpdatedDevice),
			);
		});
	});

	describe('remove', () => {
		it('should remove a device', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(plainToInstance(MockDevice, mockDevice));
			jest.spyOn(repository, 'delete');

			await service.remove(mockDevice.id);

			expect(repository.delete).toHaveBeenCalledWith(mockDevice.id);
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.DEVICE_DELETED, plainToInstance(MockDevice, mockDevice));
		});
	});
});
