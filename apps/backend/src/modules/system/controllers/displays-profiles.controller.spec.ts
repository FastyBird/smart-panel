/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { FastifyRequest as Request, FastifyReply as Response } from 'fastify';
import { v4 as uuid } from 'uuid';

import { Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { CreateDisplayProfileDto } from '../dto/create-display-profile.dto';
import { UpdateDisplayProfileDto } from '../dto/update-display-profile.dto';
import { DisplayProfileEntity } from '../entities/system.entity';
import { DisplaysProfilesService } from '../services/displays-profiles.service';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

import { DisplaysProfilesController } from './displays-profiles.controller';

describe('DisplaysProfilesController', () => {
	let controller: DisplaysProfilesController;
	let service: DisplaysProfilesService;

	const mockDisplay: DisplayProfileEntity = {
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
		updatedAt: null,
	};

	const mockDisplayService = {
		findAll: jest.fn().mockResolvedValue([toInstance(DisplayProfileEntity, mockDisplay)]),
		findOne: jest.fn().mockResolvedValue(toInstance(DisplayProfileEntity, mockDisplay)),
		findByUid: jest.fn().mockResolvedValue(toInstance(DisplayProfileEntity, mockDisplay)),
		create: jest.fn().mockResolvedValue(toInstance(DisplayProfileEntity, mockDisplay)),
		update: jest.fn().mockResolvedValue(toInstance(DisplayProfileEntity, { ...mockDisplay, rows: 3 })),
		remove: jest.fn().mockResolvedValue(undefined),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DisplaysProfilesController],
			providers: [
				{
					provide: DisplaysProfilesService,
					useValue: mockDisplayService,
				},
			],
		}).compile();

		controller = module.get<DisplaysProfilesController>(DisplaysProfilesController);
		service = module.get<DisplaysProfilesService>(DisplaysProfilesService);

		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all displays profiles', async () => {
			const result = await controller.findAll();

			expect(result.data).toEqual([toInstance(DisplayProfileEntity, mockDisplay)]);
			expect(service.findAll).toHaveBeenCalledTimes(1);
		});
	});

	describe('findOne', () => {
		it('should return a display profile by id', async () => {
			const result = await controller.findOne(mockDisplay.id);

			expect(result.data).toEqual(toInstance(DisplayProfileEntity, mockDisplay));
			expect(service.findOne).toHaveBeenCalledWith(mockDisplay.id);
		});

		it('should throw NotFoundException if not found', async () => {
			mockDisplayService.findOne.mockResolvedValueOnce(null);

			await expect(controller.findOne('invalid-id')).rejects.toThrow(NotFoundException);
		});
	});

	describe('create', () => {
		it('should successfully create a display profile', async () => {
			mockDisplayService.findByUid.mockResolvedValue(null);

			const createDto: CreateDisplayProfileDto = {
				uid: uuid().toString(),
				screen_width: 1280,
				screen_height: 720,
				pixel_ratio: 2,
				unit_size: 120,
				rows: 6,
				cols: 4,
			};

			const mockRequest = {
				url: '/api/v1/system/displays-profiles',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			const result = await controller.create({ data: createDto }, mockResponse, mockRequest);

			expect(result.data).toEqual(toInstance(DisplayProfileEntity, mockDisplay));
			expect(service.create).toHaveBeenCalledWith(createDto);
			expect(mockResponse.header).toHaveBeenCalledWith(
				'Location',
				expect.stringContaining(`/api/v1/${SYSTEM_MODULE_PREFIX}/displays/${mockDisplay.id}`),
			);
		});

		it('should throw UnprocessableEntityException if uid is reused', async () => {
			mockDisplayService.findByUid.mockResolvedValue(toInstance(DisplayProfileEntity, mockDisplay));

			const createDto: CreateDisplayProfileDto = {
				uid: uuid().toString(),
				screen_width: 1280,
				screen_height: 720,
				pixel_ratio: 2,
				unit_size: 120,
				rows: 6,
				cols: 4,
			};

			const mockRequest = {
				url: '/api/v1/system/displays-profiles',
				protocol: 'http',
				hostname: 'localhost',
				headers: { host: 'localhost:3000' },
				socket: { localPort: 3000 },
			} as unknown as Request;

			const mockResponse = {
				header: jest.fn().mockReturnThis(),
			} as unknown as Response;

			await expect(controller.create({ data: createDto }, mockResponse, mockRequest)).rejects.toThrow(
				UnprocessableEntityException,
			);
		});
	});

	describe('update', () => {
		it('should update and return the display profile', async () => {
			const updateDto: UpdateDisplayProfileDto = {
				rows: 3,
			};

			const updatedDisplay = await controller.update(mockDisplay.id, { data: updateDto });

			expect(updatedDisplay.data.rows).toBe(3);
			expect(service.update).toHaveBeenCalledWith(mockDisplay.id, updateDto);
		});

		it('should throw NotFoundException if display profile does not found', async () => {
			mockDisplayService.findOne.mockResolvedValueOnce(null);

			await expect(
				controller.update('invalid-id', {
					data: {
						rows: 8,
						cols: 5,
					},
				}),
			).rejects.toThrow(NotFoundException);
		});
	});

	describe('remove', () => {
		it('should delete the display profile', async () => {
			await controller.remove(mockDisplay.id);

			expect(service.remove).toHaveBeenCalledWith(mockDisplay.id);
		});

		it('should throw NotFoundException if not found', async () => {
			mockDisplayService.findOne.mockResolvedValueOnce(null);

			await expect(controller.remove('invalid-id')).rejects.toThrow(NotFoundException);
		});
	});
});
