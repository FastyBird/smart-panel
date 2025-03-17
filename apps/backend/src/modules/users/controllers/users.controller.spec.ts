/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthenticatedRequest } from '../../auth/auth.constants';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { UsersService } from '../services/users.service';
import { UserRole } from '../users.constants';

import { UsersController } from './users.controller';

describe('UsersController', () => {
	let controller: UsersController;
	let service: UsersService;

	const mockUser: UserEntity = {
		id: uuid().toString(),
		isHidden: false,
		username: 'testuser',
		password: 'hashedpassword',
		email: 'test@example.com',
		firstName: 'John',
		lastName: 'Doe',
		role: UserRole.USER,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockUserService = {
		findAll: jest.fn().mockResolvedValue([mockUser]),
		findOne: jest.fn().mockResolvedValue(mockUser),
		create: jest.fn().mockResolvedValue(mockUser),
		update: jest.fn().mockResolvedValue({ ...mockUser, firstName: 'UpdatedName' }),
		remove: jest.fn().mockResolvedValue(undefined),
		findByUsername: jest.fn().mockResolvedValue(null),
		findByEmail: jest.fn().mockResolvedValue(null),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [UsersController],
			providers: [
				{
					provide: UsersService,
					useValue: mockUserService,
				},
			],
		}).compile();

		controller = module.get<UsersController>(UsersController);
		service = module.get<UsersService>(UsersService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('findAll', () => {
		it('should return an array of users', async () => {
			const users = await controller.findAll();

			expect(users).toEqual([mockUser]);
			expect(service.findAll).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a user when found', async () => {
			const user = await controller.findOne(mockUser.id);

			expect(user).toEqual(mockUser);
			expect(service.findOne).toHaveBeenCalledWith(mockUser.id);
		});

		it('should throw NotFoundException if user is not found', async () => {
			mockUserService.findOne.mockResolvedValueOnce(null);

			await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('create', () => {
		it('should successfully create a user', async () => {
			const createDto: CreateUserDto = {
				username: 'newuser',
				password: 'securepassword',
				email: 'new@example.com',
			};

			const result = await controller.create({ data: createDto });

			expect(result).toEqual(mockUser);
			expect(service.create).toHaveBeenCalledWith(createDto);
		});
	});

	describe('update', () => {
		it('should update and return the user', async () => {
			const updateDto: UpdateUserDto = { first_name: 'UpdatedName' };

			const updatedUser = await controller.update(mockUser.id, { data: updateDto });

			expect(updatedUser.firstName).toBe('UpdatedName');
			expect(service.update).toHaveBeenCalledWith(mockUser.id, updateDto);
		});

		it('should throw NotFoundException if user does not exist', async () => {
			mockUserService.findOne.mockResolvedValueOnce(null);

			await expect(controller.update('invalid-id', { data: { first_name: 'UpdatedName' } })).rejects.toThrow(
				NotFoundException,
			);
		});
	});

	describe('remove', () => {
		it('should delete the user', async () => {
			const user = { id: '123', role: UserRole.USER };
			const requestMock = { user };

			await controller.remove(mockUser.id, requestMock as AuthenticatedRequest);

			expect(service.remove).toHaveBeenCalledWith(mockUser.id);
		});

		it('should throw NotFoundException if user does not exist', async () => {
			const user = { id: '123', role: UserRole.USER };
			const requestMock = { user };

			mockUserService.findOne.mockResolvedValueOnce(null);

			await expect(controller.remove('invalid-id', requestMock as AuthenticatedRequest)).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
