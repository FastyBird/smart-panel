/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { AuthenticatedRequest } from '../../auth/guards/auth.guard';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { UsersService } from '../services/users.service';
import { USERS_MODULE_PREFIX, UserRole } from '../users.constants';

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
		findAll: jest.fn().mockResolvedValue([toInstance(UserEntity, mockUser)]),
		findOne: jest.fn().mockResolvedValue(toInstance(UserEntity, mockUser)),
		create: jest.fn().mockResolvedValue(toInstance(UserEntity, mockUser)),
		update: jest.fn().mockResolvedValue(toInstance(UserEntity, { ...mockUser, firstName: 'UpdatedName' })),
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

			expect(users.data).toEqual([toInstance(UserEntity, mockUser)]);
			expect(service.findAll).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a user when found', async () => {
			const user = await controller.findOne(mockUser.id);

			expect(user.data).toEqual(toInstance(UserEntity, mockUser));
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

			const mockRequest = {
				url: '/api/v1/users',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			const result = await controller.create({ data: createDto }, mockResponse, mockRequest);

			expect(result.data).toEqual(toInstance(UserEntity, mockUser));
			expect(service.create).toHaveBeenCalledWith(createDto);
			expect(mockResponse.header).toHaveBeenCalledWith(
				'Location',
				expect.stringContaining(`/api/v1/${USERS_MODULE_PREFIX}/users/${mockUser.id}`),
			);
		});
	});

	describe('update', () => {
		it('should update and return the user', async () => {
			const updateDto: UpdateUserDto = { first_name: 'UpdatedName' };

			const updatedUser = await controller.update(mockUser.id, { data: updateDto });

			expect(updatedUser.data.firstName).toBe('UpdatedName');
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
			const auth = { type: 'user', id: '123', role: UserRole.USER };
			const requestMock = { auth };

			await controller.remove(mockUser.id, requestMock as unknown as AuthenticatedRequest);

			expect(service.remove).toHaveBeenCalledWith(mockUser.id);
		});

		it('should throw NotFoundException if user does not exist', async () => {
			const auth = { type: 'user', id: '123', role: UserRole.USER };
			const requestMock = { auth };

			mockUserService.findOne.mockResolvedValueOnce(null);

			await expect(controller.remove('invalid-id', requestMock as unknown as AuthenticatedRequest)).rejects.toThrow(
				NotFoundException,
			);
		});
	});
});
