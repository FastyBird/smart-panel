/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayInstanceDto } from '../dto/create-display-instance.dto';
import { UpdateDisplayInstanceDto } from '../dto/update-display-instance.dto';
import { DisplayInstanceEntity, UserEntity } from '../entities/users.entity';
import { DisplaysInstancesService } from '../services/displays-instances.service';
import { UsersService } from '../services/users.service';
import { UserRole } from '../users.constants';

import { DisplaysInstancesController } from './displays-instances.controller';

describe('DisplaysInstancesController', () => {
	let controller: DisplaysInstancesController;
	let service: DisplaysInstancesService;

	const mockUser: UserEntity = {
		id: uuid().toString(),
		isHidden: false,
		username: 'display',
		password: 'hashedpassword',
		email: 'test@example.com',
		firstName: null,
		lastName: null,
		role: UserRole.DISPLAY,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockDisplayInstance: DisplayInstanceEntity = {
		id: uuid().toString(),
		uid: uuid().toString(),
		mac: '00:1A:2B:3C:4D:5E',
		version: '1.0.0',
		build: '42',
		user: mockUser.id,
		displayProfile: null,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockDisplayService = {
		findAll: jest.fn().mockResolvedValue([toInstance(DisplayInstanceEntity, mockDisplayInstance)]),
		findOne: jest.fn().mockResolvedValue(toInstance(DisplayInstanceEntity, mockDisplayInstance)),
		findByUid: jest.fn().mockResolvedValue(toInstance(DisplayInstanceEntity, mockDisplayInstance)),
		create: jest.fn().mockResolvedValue(toInstance(DisplayInstanceEntity, mockDisplayInstance)),
		update: jest
			.fn()
			.mockResolvedValue(toInstance(DisplayInstanceEntity, { ...mockDisplayInstance, version: '2.0.0' })),
		remove: jest.fn().mockResolvedValue(undefined),
	};

	const mockUsersService = {
		findAll: jest.fn().mockResolvedValue([toInstance(UserEntity, mockUser)]),
		findOne: jest.fn().mockResolvedValue(toInstance(UserEntity, mockUser)),
		findByUid: jest.fn().mockResolvedValue(toInstance(UserEntity, mockUser)),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DisplaysInstancesController],
			providers: [
				{
					provide: DisplaysInstancesService,
					useValue: mockDisplayService,
				},
				{
					provide: UsersService,
					useValue: mockUsersService,
				},
			],
		}).compile();

		controller = module.get<DisplaysInstancesController>(DisplaysInstancesController);
		service = module.get<DisplaysInstancesService>(DisplaysInstancesService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all displays instances', async () => {
			const result = await controller.findAll();

			expect(result).toEqual([toInstance(DisplayInstanceEntity, mockDisplayInstance)]);
			expect(service.findAll).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a display instance by id', async () => {
			const result = await controller.findOne(mockDisplayInstance.id);

			expect(result).toEqual(toInstance(DisplayInstanceEntity, mockDisplayInstance));
			expect(service.findOne).toHaveBeenCalledWith(mockDisplayInstance.id);
		});

		it('should throw NotFoundException if not found', async () => {
			mockDisplayService.findOne.mockResolvedValueOnce(null);

			await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('create', () => {
		it('should successfully create a display instance', async () => {
			mockDisplayService.findByUid.mockResolvedValue(null);

			const createDto: CreateDisplayInstanceDto = {
				uid: uuid().toString(),
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: mockUser.id,
			};

			const result = await controller.create({ data: createDto });

			expect(result).toEqual(toInstance(DisplayInstanceEntity, mockDisplayInstance));
			expect(service.create).toHaveBeenCalledWith(mockUser.id, createDto);
		});

		it('should throw UnprocessableEntityException if uid is reused', async () => {
			mockDisplayService.findByUid.mockResolvedValue(toInstance(DisplayInstanceEntity, mockDisplayInstance));

			const createDto: CreateDisplayInstanceDto = {
				uid: uuid().toString(),
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: mockUser.id,
			};

			await expect(controller.create({ data: createDto })).rejects.toThrow(UnprocessableEntityException);
		});
	});

	describe('update', () => {
		it('should update and return the display instance', async () => {
			const updateDto: UpdateDisplayInstanceDto = {
				version: '2.0.0',
			};

			const updatedDisplay = await controller.update(mockDisplayInstance.id, { data: updateDto });

			expect(updatedDisplay.version).toBe('2.0.0');
			expect(service.update).toHaveBeenCalledWith(mockDisplayInstance.id, updateDto);
		});

		it('should throw NotFoundException if display instance does not found', async () => {
			mockDisplayService.findOne.mockResolvedValueOnce(null);

			await expect(
				controller.update('invalid-id', {
					data: {
						version: '2.0.0',
					},
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe('remove', () => {
		it('should delete the display instance', async () => {
			await controller.remove(mockDisplayInstance.id);

			expect(service.remove).toHaveBeenCalledWith(mockDisplayInstance.id);
		});

		it('should throw NotFoundException if not found', async () => {
			mockDisplayService.findOne.mockResolvedValueOnce(null);

			await expect(controller.remove('invalid-id')).rejects.toThrow(NotFoundException);
		});
	});
});
