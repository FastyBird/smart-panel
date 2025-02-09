/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { plainToInstance } from 'class-transformer';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { WebsocketGateway } from '../../websocket/gateway/websocket.gateway';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/users.entity';
import { EventType, UserRole } from '../users.constants';
import { UsersNotFoundException, UsersValidationException } from '../users.exceptions';

import { UsersService } from './users.service';

describe('UsersService', () => {
	let service: UsersService;
	let repository: Repository<UserEntity>;
	let gateway: WebsocketGateway;

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

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				UsersService,
				{ provide: getRepositoryToken(UserEntity), useFactory: mockRepository },
				{
					provide: WebsocketGateway,
					useValue: {
						sendMessage: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<UsersService>(UsersService);
		repository = module.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
		gateway = module.get<WebsocketGateway>(WebsocketGateway);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(gateway).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all users', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([plainToInstance(UserEntity, mockUser)]);

			const result = await service.findAll();

			expect(result).toEqual([plainToInstance(UserEntity, mockUser)]);
			expect(repository.find).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a user if found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(UserEntity, mockUser));

			const result = await service.findOne(mockUser.id);

			expect(result).toEqual(plainToInstance(UserEntity, mockUser));
		});

		it('should return null if the user is not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findOne(id);

			expect(result).toBeNull();
		});
	});

	describe('create', () => {
		it('should create and return a new user', async () => {
			const createDto: CreateUserDto = {
				username: 'newuser',
				password: 'securepassword',
				email: 'new@example.com',
			};
			const mockCreateUser: Partial<UserEntity> = {
				username: createDto.username,
				password: createDto.password,
				email: createDto.email,
			};
			const mockCreatedUser: UserEntity = {
				id: uuid().toString(),
				isHidden: false,
				username: mockCreateUser.username,
				password: mockCreateUser.password,
				email: mockCreateUser.email,
				role: UserRole.USER,
				firstName: null,
				lastName: null,
				createdAt: new Date(),
				updatedAt: null,
			};

			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedUser);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedUser);
			jest.spyOn(repository, 'findOne').mockResolvedValue(plainToInstance(UserEntity, mockCreatedUser));

			const result = await service.create(createDto);

			expect(result).toEqual(plainToInstance(UserEntity, mockCreatedUser));
			expect(repository.create).toHaveBeenCalledWith(
				plainToInstance(UserEntity, mockCreateUser, {
					enableImplicitConversion: true,
					excludeExtraneousValues: true,
					exposeUnsetFields: false,
					groups: ['internal'],
				}),
			);
			expect(repository.save).toHaveBeenCalledWith(mockCreatedUser);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockCreatedUser.id },
			});
			expect(gateway.sendMessage).toHaveBeenCalledWith(
				EventType.USER_CREATED,
				plainToInstance(UserEntity, mockCreatedUser),
			);
		});

		it('should throw validation exception when dto is invalid', async () => {
			const createDto: CreateUserDto = { username: '', password: 'short' };

			await expect(service.create(createDto)).rejects.toThrow(UsersValidationException);
		});
	});

	describe('update', () => {
		it('should update and return the user', async () => {
			const updateDto: UpdateUserDto = { first_name: 'UpdatedName' };
			const mockUpdateUser: UserEntity = {
				id: mockUser.id,
				isHidden: mockUser.isHidden,
				username: mockUser.username,
				password: updateDto.password,
				firstName: updateDto.first_name,
				lastName: mockUser.lastName,
				email: mockUser.email,
				role: mockUser.role,
				createdAt: mockUser.createdAt,
				updatedAt: mockUser.updatedAt,
			};
			const mockUpdatedUser: UserEntity = {
				id: mockUpdateUser.id,
				isHidden: mockUpdateUser.isHidden,
				username: mockUpdateUser.username,
				password: mockUpdateUser.password,
				firstName: mockUser.firstName,
				lastName: mockUpdateUser.lastName,
				email: mockUpdateUser.email,
				role: mockUpdateUser.role,
				createdAt: mockUpdateUser.createdAt,
				updatedAt: new Date(),
			};

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(plainToInstance(UserEntity, mockUser))
				.mockResolvedValueOnce(plainToInstance(UserEntity, mockUpdatedUser));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedUser);

			const result = await service.update(mockUser.id, updateDto);

			expect(result).toEqual(plainToInstance(UserEntity, mockUpdatedUser));
			expect(repository.save).toHaveBeenCalledWith(plainToInstance(UserEntity, mockUpdateUser));
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockUser.id },
			});
			expect(gateway.sendMessage).toHaveBeenCalledWith(
				EventType.USER_UPDATED,
				plainToInstance(UserEntity, mockUpdatedUser),
			);
		});

		it('should throw UsersNotFoundException if user not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.update(id, { first_name: 'UpdatedName' })).rejects.toThrow(UsersNotFoundException);
		});
	});

	describe('remove', () => {
		it('should delete the user', async () => {
			delete mockUser.password;

			jest.spyOn(service, 'findOne').mockResolvedValue(plainToInstance(UserEntity, mockUser));
			jest.spyOn(repository, 'remove').mockResolvedValue(mockUser);

			await service.remove(mockUser.id);

			expect(repository.remove).toHaveBeenCalledWith(mockUser);
			expect(gateway.sendMessage).toHaveBeenCalledWith(EventType.USER_DELETED, plainToInstance(UserEntity, mockUser));
		});

		it('should throw UsersNotFoundException if user not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.remove(id)).rejects.toThrow(UsersNotFoundException);
		});
	});
});
