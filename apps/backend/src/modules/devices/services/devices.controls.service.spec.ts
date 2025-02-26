/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Expose, Transform } from 'class-transformer';
import { plainToInstance } from 'class-transformer';
import { IsString } from 'class-validator';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceCategory, EventType } from '../devices.constants';
import { DevicesValidationException } from '../devices.exceptions';
import { CreateDeviceControlDto } from '../dto/create-device-control.dto';
import { DeviceControlEntity, DeviceEntity } from '../entities/devices.entity';

import { DevicesControlsService } from './devices.controls.service';
import { DevicesService } from './devices.service';

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

describe('DevicesControlsService', () => {
	let devicesService: DevicesService;
	let devicesControlsService: DevicesControlsService;
	let repository: Repository<DeviceControlEntity>;
	let eventEmitter: EventEmitter2;

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

	const mockDeviceControl: DeviceControlEntity = {
		id: uuid().toString(),
		name: 'Test Control',
		device: mockDevice.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
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
				DevicesControlsService,
				{ provide: getRepositoryToken(DeviceControlEntity), useFactory: mockRepository },
				{
					provide: DevicesService,
					useValue: {
						getOneOrThrow: jest.fn(() => {}),
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

		devicesService = module.get<DevicesService>(DevicesService);
		devicesControlsService = module.get<DevicesControlsService>(DevicesControlsService);
		repository = module.get<Repository<DeviceControlEntity>>(getRepositoryToken(DeviceControlEntity));
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);
	});

	it('should be defined', () => {
		expect(devicesService).toBeDefined();
		expect(devicesControlsService).toBeDefined();
		expect(repository).toBeDefined();
		expect(eventEmitter).toBeDefined();
	});

	describe('findAllControls', () => {
		it('should return all controls for a device', async () => {
			const mockDeviceControls: DeviceControlEntity[] = [mockDeviceControl];

			jest.spyOn(devicesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(MockDevice, mockDevice));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getMany: jest
					.fn()
					.mockResolvedValue(mockDeviceControls.map((entity) => plainToInstance(DeviceControlEntity, entity))),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await devicesControlsService.findAll(mockDevice.id);

			expect(result).toEqual(mockDeviceControls.map((entity) => plainToInstance(DeviceControlEntity, entity)));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('device.id = :deviceId', { deviceId: mockDevice.id });
			expect(queryBuilderMock.getMany).toHaveBeenCalled();
		});
	});

	describe('findOneControl', () => {
		it('should return a device control if found', async () => {
			jest.spyOn(devicesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(MockDevice, mockDevice));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(plainToInstance(DeviceControlEntity, mockDeviceControl)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await devicesControlsService.findOne(mockDeviceControl.id, mockDevice.id);

			expect(result).toEqual(plainToInstance(DeviceControlEntity, mockDeviceControl));

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.id = :id', { id: mockDeviceControl.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('device.id = :deviceId', { deviceId: mockDevice.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});

		it('should return null if the device control is not found', async () => {
			const controlId = uuid().toString();

			jest.spyOn(devicesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(MockDevice, mockDevice));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await devicesControlsService.findOne(controlId, mockDevice.id);

			expect(result).toEqual(null);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.id = :id', { id: controlId });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('device.id = :deviceId', { deviceId: mockDevice.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('create', () => {
		it('should create and return a new device control', async () => {
			const createDto: CreateDeviceControlDto = { name: 'reboot' };
			const mockCreateControl: Partial<DeviceControlEntity> = {
				name: createDto.name,
				device: mockDevice.id,
			};
			const mockCreatedControl: DeviceControlEntity = {
				id: uuid().toString(),
				name: mockCreateControl.name,
				device: mockCreateControl.id,
				createdAt: new Date(),
				updatedAt: null,
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockReturnValueOnce(null)
					.mockResolvedValueOnce(plainToInstance(DeviceControlEntity, mockCreatedControl)),
			};

			jest.spyOn(devicesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(MockDevice, mockDevice));

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);
			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedControl);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedControl);

			const result = await devicesControlsService.create(mockDevice.id, createDto);

			expect(result).toEqual(plainToInstance(DeviceControlEntity, mockCreatedControl));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(DeviceControlEntity, mockCreateControl, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCreatedControl);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DEVICE_CONTROL_CREATED,
				plainToInstance(DeviceControlEntity, mockCreatedControl),
			);
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.name = :name', { name: createDto.name });
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.id = :id', { id: mockCreatedControl.id });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('device.id = :deviceId', { deviceId: mockDevice.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalledTimes(2);
		});

		it('should throw DevicesValidationException if the device control with same name already exists', async () => {
			const createDto: CreateDeviceControlDto = { name: 'reboot' };
			const mockCreatedControl: DeviceControlEntity = {
				id: uuid().toString(),
				name: 'reboot',
				device: mockDevice.id,
				createdAt: new Date(),
				updatedAt: null,
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValueOnce(mockCreatedControl),
			};

			jest.spyOn(devicesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(MockDevice, mockDevice));

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			await expect(devicesControlsService.create(mockDevice.id, createDto)).rejects.toThrow(DevicesValidationException);

			expect(repository.createQueryBuilder).toHaveBeenCalledWith('control');
			expect(queryBuilderMock.innerJoinAndSelect).toHaveBeenCalledWith('control.device', 'device');
			expect(queryBuilderMock.where).toHaveBeenCalledWith('control.name = :name', { name: createDto.name });
			expect(queryBuilderMock.andWhere).toHaveBeenCalledWith('device.id = :deviceId', { deviceId: mockDevice.id });
			expect(queryBuilderMock.getOne).toHaveBeenCalled();
		});
	});

	describe('remove', () => {
		it('should remove a device control', async () => {
			jest.spyOn(devicesService, 'getOneOrThrow').mockResolvedValue(plainToInstance(MockDevice, mockDevice));
			jest
				.spyOn(devicesControlsService, 'findOne')
				.mockResolvedValue(plainToInstance(DeviceControlEntity, mockDeviceControl));

			jest.spyOn(repository, 'remove').mockResolvedValue(mockDeviceControl);

			await devicesControlsService.remove(mockDeviceControl.id, mockDevice.id);

			expect(repository.remove).toHaveBeenCalledWith(plainToInstance(DeviceControlEntity, mockDeviceControl));
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DEVICE_CONTROL_DELETED,
				plainToInstance(DeviceControlEntity, mockDeviceControl),
			);
		});
	});
});
