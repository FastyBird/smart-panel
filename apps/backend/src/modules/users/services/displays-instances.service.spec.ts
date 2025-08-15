/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-argument,
@typescript-eslint/no-unsafe-member-access
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { useContainer } from 'class-validator';
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayInstanceDto } from '../dto/create-display-instance.dto';
import { UpdateDisplayInstanceDto } from '../dto/update-display-instance.dto';
import { DisplayInstanceEntity, UserEntity } from '../entities/users.entity';
import { EventType, UserRole } from '../users.constants';
import { UsersNotFoundException, UsersValidationException } from '../users.exceptions';
import { UserExistsConstraintValidator } from '../validators/user-exists-constraint.validator';

import { DisplaysInstancesService } from './displays-instances.service';
import { UsersService } from './users.service';

describe('DisplaysInstancesService', () => {
	let service: DisplaysInstancesService;
	let repository: Repository<DisplayInstanceEntity>;
	let eventEmitter: EventEmitter2;

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
		updatedAt: undefined,
	};

	const mockUsersService = {
		findAll: jest.fn().mockResolvedValue([toInstance(UserEntity, mockUser)]),
		findOne: jest.fn().mockResolvedValue(toInstance(UserEntity, mockUser)),
		findByUid: jest.fn().mockResolvedValue(toInstance(UserEntity, mockUser)),
		getOneOrThrow: jest.fn().mockResolvedValue(toInstance(UserEntity, mockUser)),
	};

	beforeEach(async () => {
		const mockRepository = () => ({
			find: jest.fn(),
			findOne: jest.fn(),
			findByUid: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
			remove: jest.fn(),
			delete: jest.fn(),
			createQueryBuilder: jest.fn(() => ({
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getMany: jest.fn(),
				getOne: jest.fn(),
			})),
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DisplaysInstancesService,
				UserExistsConstraintValidator,
				{
					provide: UsersService,
					useValue: mockUsersService,
				},
				{ provide: getRepositoryToken(DisplayInstanceEntity), useFactory: mockRepository },
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		useContainer(module, { fallbackOnErrors: true });

		service = module.get<DisplaysInstancesService>(DisplaysInstancesService);
		repository = module.get<Repository<DisplayInstanceEntity>>(getRepositoryToken(DisplayInstanceEntity));
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
		expect(repository).toBeDefined();
		expect(eventEmitter).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all displays instances', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([toInstance(DisplayInstanceEntity, mockDisplayInstance)]);

			const result = await service.findAll();

			expect(result).toEqual([toInstance(DisplayInstanceEntity, mockDisplayInstance)]);
			expect(repository.find).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a display instance if found', async () => {
			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(DisplayInstanceEntity, mockDisplayInstance)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findOne(mockDisplayInstance.id);

			expect(result).toEqual(toInstance(DisplayInstanceEntity, mockDisplayInstance));
		});

		it('should return null if the display instance is not found', async () => {
			const id = uuid().toString();

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.findOne(id);

			expect(result).toBeNull();
		});
	});

	describe('create', () => {
		it('should create and return a new display instance', async () => {
			const createDto: CreateDisplayInstanceDto = {
				uid: uuid().toString(),
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
				user: mockUser.id,
			};
			const mockCreateDisplay: Partial<DisplayInstanceEntity> = {
				uid: createDto.uid,
				mac: createDto.mac,
				version: createDto.version,
				build: createDto.build,
				user: createDto.user,
			};
			const mockCreatedDisplay: DisplayInstanceEntity = {
				id: uuid().toString(),
				uid: mockCreateDisplay.uid,
				mac: mockCreateDisplay.mac,
				version: mockCreateDisplay.version,
				build: mockCreateDisplay.build,
				user: mockCreateDisplay.user,
				displayProfile: mockCreateDisplay.displayProfile,
				createdAt: new Date(),
				updatedAt: undefined,
			};

			jest.spyOn(repository, 'create').mockReturnValue(toInstance(DisplayInstanceEntity, mockCreatedDisplay));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(DisplayInstanceEntity, mockCreatedDisplay));

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(toInstance(DisplayInstanceEntity, mockCreatedDisplay)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			const result = await service.create(mockUser.id, createDto);

			expect(result).toEqual(toInstance(DisplayInstanceEntity, mockCreatedDisplay));
			expect(repository.create).toHaveBeenCalledWith(toInstance(DisplayInstanceEntity, mockCreateDisplay));
			expect(repository.save).toHaveBeenCalledWith(mockCreatedDisplay);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('display.id = :id', { id: mockCreatedDisplay.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DISPLAY_INSTANCE_CREATED,
				toInstance(DisplayInstanceEntity, mockCreatedDisplay),
			);
		});

		it('should throw validation exception when dto is invalid', async () => {
			const createDto: CreateDisplayInstanceDto = {
				uid: uuid().toString(),
				mac: '00:1A:2B:3C:4D:5E',
				version: '1.0.0',
				build: '42',
			} as CreateDisplayInstanceDto;

			await expect(service.create(mockUser.id, createDto)).rejects.toThrow(UsersValidationException);
		});
	});

	describe('update', () => {
		it('should update and return the display instance', async () => {
			const updateDto: UpdateDisplayInstanceDto = { version: '2.0.0' };
			const mockUpdateDisplay: DisplayInstanceEntity = {
				id: mockDisplayInstance.id,
				uid: mockDisplayInstance.uid,
				mac: mockDisplayInstance.mac,
				version: updateDto.version,
				build: mockDisplayInstance.build,
				user: mockDisplayInstance.user,
				displayProfile: mockDisplayInstance.displayProfile,
				createdAt: mockDisplayInstance.createdAt,
				updatedAt: mockDisplayInstance.updatedAt,
			};
			const mockUpdatedDisplay: DisplayInstanceEntity = {
				id: mockUpdateDisplay.id,
				uid: mockUpdateDisplay.uid,
				mac: mockUpdateDisplay.mac,
				version: mockUpdateDisplay.version,
				build: mockUpdateDisplay.build,
				user: mockUpdateDisplay.user,
				displayProfile: mockUpdateDisplay.displayProfile,
				createdAt: mockUpdateDisplay.createdAt,
				updatedAt: new Date(),
			};

			const queryBuilderMock: any = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getOne: jest
					.fn()
					.mockResolvedValueOnce(toInstance(DisplayInstanceEntity, mockDisplayInstance))
					.mockResolvedValueOnce(toInstance(DisplayInstanceEntity, mockUpdatedDisplay)),
			};

			jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilderMock);

			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(DisplayInstanceEntity, mockUpdatedDisplay));

			const result = await service.update(mockDisplayInstance.id, updateDto);

			expect(result).toEqual(toInstance(DisplayInstanceEntity, mockUpdatedDisplay));
			expect(repository.save).toHaveBeenCalledWith(
				Object.assign(mockDisplayInstance, omitBy(toInstance(DisplayInstanceEntity, updateDto), isUndefined)),
			);
			expect(queryBuilderMock.where).toHaveBeenCalledWith('display.id = :id', { id: mockDisplayInstance.id });
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DISPLAY_INSTANCE_UPDATED,
				toInstance(DisplayInstanceEntity, mockUpdatedDisplay),
			);
		});

		it('should throw UsersNotFoundException if display instance not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.update(id, { version: '2.0.0' })).rejects.toThrow(UsersNotFoundException);
		});
	});

	describe('remove', () => {
		it('should delete the display instance', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(toInstance(DisplayInstanceEntity, mockDisplayInstance));
			jest.spyOn(repository, 'delete');

			await service.remove(mockDisplayInstance.id);

			expect(repository.delete).toHaveBeenCalledWith(mockDisplayInstance.id);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DISPLAY_INSTANCE_DELETED,
				toInstance(DisplayInstanceEntity, mockDisplayInstance),
			);
		});

		it('should throw UsersNotFoundException if display instance not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.remove(id)).rejects.toThrow(UsersNotFoundException);
		});
	});
});
