/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import isUndefined from 'lodash.isundefined';
import omitBy from 'lodash.omitby';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayProfileDto } from '../dto/create-display-profile.dto';
import { UpdateDisplayProfileDto } from '../dto/update-display-profile.dto';
import { DisplayProfileEntity } from '../entities/system.entity';
import { EventType } from '../system.constants';
import { SystemNotFoundException, SystemValidationException } from '../system.exceptions';

import { DisplaysProfilesService } from './displays-profiles.service';

describe('DisplaysProfilesService', () => {
	let service: DisplaysProfilesService;
	let repository: Repository<DisplayProfileEntity>;
	let eventEmitter: EventEmitter2;

	const mockDisplayProfile: DisplayProfileEntity = {
		id: uuid().toString(),
		uid: uuid().toString(),
		screenWidth: 1280,
		screenHeight: 720,
		pixelRatio: 2,
		unitSize: 120,
		rows: 6,
		cols: 4,
		primary: true,
		createdAt: new Date(),
		updatedAt: undefined,
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
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				DisplaysProfilesService,
				{ provide: getRepositoryToken(DisplayProfileEntity), useFactory: mockRepository },
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<DisplaysProfilesService>(DisplaysProfilesService);
		repository = module.get<Repository<DisplayProfileEntity>>(getRepositoryToken(DisplayProfileEntity));
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
		it('should return all displays profile', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([toInstance(DisplayProfileEntity, mockDisplayProfile)]);

			const result = await service.findAll();

			expect(result).toEqual([toInstance(DisplayProfileEntity, mockDisplayProfile)]);
			expect(repository.find).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a display profile if found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayProfileEntity, mockDisplayProfile));

			const result = await service.findOne(mockDisplayProfile.id);

			expect(result).toEqual(toInstance(DisplayProfileEntity, mockDisplayProfile));
		});

		it('should return null if the display profile is not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findOne(id);

			expect(result).toBeNull();
		});
	});

	describe('create', () => {
		it('should create and return a new display profile', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([]);

			const createDto: CreateDisplayProfileDto = {
				uid: uuid().toString(),
				screen_width: 1280,
				screen_height: 720,
				pixel_ratio: 2,
				unit_size: 120,
				rows: 6,
				cols: 4,
			};
			const mockCreateDisplay: Partial<DisplayProfileEntity> = {
				uid: createDto.uid,
				screenWidth: createDto.screen_width,
				screenHeight: createDto.screen_height,
				pixelRatio: createDto.pixel_ratio,
				unitSize: createDto.unit_size,
				rows: createDto.rows,
				cols: createDto.cols,
				primary: true,
			};
			const mockCreatedDisplay: DisplayProfileEntity = {
				id: uuid().toString(),
				uid: mockCreateDisplay.uid,
				screenWidth: mockCreateDisplay.screenWidth,
				screenHeight: mockCreateDisplay.screenHeight,
				pixelRatio: mockCreateDisplay.pixelRatio,
				unitSize: mockCreateDisplay.unitSize,
				rows: mockCreateDisplay.rows,
				cols: mockCreateDisplay.cols,
				primary: mockCreateDisplay.primary,
				createdAt: new Date(),
				updatedAt: undefined,
			};

			jest.spyOn(repository, 'create').mockReturnValue(mockCreatedDisplay);
			jest.spyOn(repository, 'save').mockResolvedValue(mockCreatedDisplay);
			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayProfileEntity, mockCreatedDisplay));

			const result = await service.create(createDto);

			expect(result).toEqual(toInstance(DisplayProfileEntity, mockCreatedDisplay));
			expect(repository.create).toHaveBeenCalledWith(toInstance(DisplayProfileEntity, mockCreateDisplay));
			expect(repository.save).toHaveBeenCalledWith(mockCreatedDisplay);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockCreatedDisplay.id },
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DISPLAY_PROFILE_CREATED,
				toInstance(DisplayProfileEntity, mockCreatedDisplay),
			);
		});

		it('should throw validation exception when dto is invalid', async () => {
			const createDto: CreateDisplayProfileDto = {
				uid: uuid().toString(),
				screen_height: 720,
				pixel_ratio: 2,
				rows: 6,
				cols: 4,
			} as CreateDisplayProfileDto;

			await expect(service.create(createDto)).rejects.toThrow(SystemValidationException);
		});
	});

	describe('update', () => {
		it('should update and return the display profile', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([toInstance(DisplayProfileEntity, mockDisplayProfile)]);

			const updateDto: UpdateDisplayProfileDto = { rows: 8 };
			const mockUpdateDisplay: DisplayProfileEntity = {
				id: mockDisplayProfile.id,
				uid: mockDisplayProfile.uid,
				screenWidth: mockDisplayProfile.screenWidth,
				screenHeight: mockDisplayProfile.screenHeight,
				pixelRatio: mockDisplayProfile.pixelRatio,
				unitSize: mockDisplayProfile.unitSize,
				rows: updateDto.rows,
				cols: mockDisplayProfile.cols,
				primary: mockDisplayProfile.primary,
				createdAt: mockDisplayProfile.createdAt,
				updatedAt: mockDisplayProfile.updatedAt,
			};
			const mockUpdatedDisplay: DisplayProfileEntity = {
				id: mockUpdateDisplay.id,
				uid: mockUpdateDisplay.uid,
				screenWidth: mockUpdateDisplay.screenWidth,
				screenHeight: mockUpdateDisplay.screenHeight,
				pixelRatio: mockUpdateDisplay.pixelRatio,
				unitSize: mockUpdateDisplay.unitSize,
				rows: mockUpdateDisplay.rows,
				cols: mockUpdateDisplay.cols,
				primary: mockUpdateDisplay.primary,
				createdAt: mockUpdateDisplay.createdAt,
				updatedAt: new Date(),
			};

			jest
				.spyOn(repository, 'findOne')
				.mockResolvedValueOnce(toInstance(DisplayProfileEntity, mockDisplayProfile))
				.mockResolvedValueOnce(toInstance(DisplayProfileEntity, mockUpdatedDisplay));
			jest.spyOn(repository, 'save').mockResolvedValue(mockUpdatedDisplay);

			const result = await service.update(mockDisplayProfile.id, updateDto);

			expect(result).toEqual(toInstance(DisplayProfileEntity, mockUpdatedDisplay));
			expect(repository.save).toHaveBeenCalledWith(
				Object.assign(mockDisplayProfile, omitBy(toInstance(DisplayProfileEntity, updateDto), isUndefined)),
			);
			expect(repository.findOne).toHaveBeenCalledWith({
				where: { id: mockDisplayProfile.id },
			});
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DISPLAY_PROFILE_UPDATED,
				toInstance(DisplayProfileEntity, mockUpdatedDisplay),
			);
		});

		it('should throw SystemNotFoundException if display profile not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.update(id, { rows: 8 })).rejects.toThrow(SystemNotFoundException);
		});
	});

	describe('remove', () => {
		it('should delete the display profile', async () => {
			jest.spyOn(service, 'findOne').mockResolvedValue(toInstance(DisplayProfileEntity, mockDisplayProfile));
			jest.spyOn(repository, 'delete');

			await service.remove(mockDisplayProfile.id);

			expect(repository.delete).toHaveBeenCalledWith(mockDisplayProfile.id);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.DISPLAY_PROFILE_DELETED,
				toInstance(DisplayProfileEntity, mockDisplayProfile),
			);
		});

		it('should throw SystemNotFoundException if display profile not found', async () => {
			const id = uuid().toString();

			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.remove(id)).rejects.toThrow(SystemNotFoundException);
		});
	});
});
