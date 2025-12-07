/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { DisplaysNotFoundException } from '../displays.exceptions';
import { DisplayEntity } from '../entities/displays.entity';
import { DisplaysService } from '../services/displays.service';

import { DisplaysController } from './displays.controller';

describe('DisplaysController', () => {
	let controller: DisplaysController;
	let service: DisplaysService;

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		macAddress: 'AA:BB:CC:DD:EE:FF',
		name: 'Test Display',
		version: '1.0.0',
		build: '42',
		screenWidth: 1920,
		screenHeight: 1080,
		pixelRatio: 1.5,
		unitSize: 8,
		rows: 12,
		cols: 24,
		darkMode: false,
		brightness: 100,
		screenLockDuration: 30,
		screenSaver: true,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockDisplayTwo: DisplayEntity = {
		id: uuid().toString(),
		macAddress: '11:22:33:44:55:66',
		name: 'Second Display',
		version: '1.0.0',
		build: '42',
		screenWidth: 1280,
		screenHeight: 720,
		pixelRatio: 1,
		unitSize: 8,
		rows: 6,
		cols: 12,
		darkMode: true,
		brightness: 80,
		screenLockDuration: 60,
		screenSaver: false,
		createdAt: new Date(),
		updatedAt: null,
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [DisplaysController],
			providers: [
				{
					provide: DisplaysService,
					useValue: {
						findAll: jest.fn(),
						findOne: jest.fn(),
						getOneOrThrow: jest.fn(),
						update: jest.fn(),
						remove: jest.fn(),
					},
				},
			],
		}).compile();

		controller = module.get<DisplaysController>(DisplaysController);
		service = module.get<DisplaysService>(DisplaysService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(service).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all displays', async () => {
			const mockDisplays = [mockDisplay, mockDisplayTwo];

			jest.spyOn(service, 'findAll').mockResolvedValue(mockDisplays.map((d) => toInstance(DisplayEntity, d)));

			const result = await controller.findAll();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(2);
			expect(service.findAll).toHaveBeenCalled();
		});

		it('should return empty array when no displays exist', async () => {
			jest.spyOn(service, 'findAll').mockResolvedValue([]);

			const result = await controller.findAll();

			expect(result.success).toBe(true);
			expect(result.data).toHaveLength(0);
		});
	});

	describe('findOne', () => {
		it('should return a display by ID', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));

			const result = await controller.findOne(mockDisplay.id);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(toInstance(DisplayEntity, mockDisplay));
			expect(service.getOneOrThrow).toHaveBeenCalledWith(mockDisplay.id);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'getOneOrThrow').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.findOne('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});

	describe('update', () => {
		it('should update and return the display', async () => {
			const updateDto = { brightness: 80 };
			const updatedDisplay = { ...mockDisplay, brightness: 80 };

			jest.spyOn(service, 'update').mockResolvedValue(toInstance(DisplayEntity, updatedDisplay));

			const result = await controller.update(mockDisplay.id, { data: updateDto });

			expect(result.success).toBe(true);
			expect(result.data.brightness).toBe(80);
			expect(service.update).toHaveBeenCalledWith(mockDisplay.id, updateDto);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'update').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.update('non-existent-id', { data: { brightness: 80 } })).rejects.toThrow(
				DisplaysNotFoundException,
			);
		});
	});

	describe('remove', () => {
		it('should remove a display', async () => {
			jest.spyOn(service, 'remove').mockResolvedValue(undefined);

			await controller.remove(mockDisplay.id);

			expect(service.remove).toHaveBeenCalledWith(mockDisplay.id);
		});

		it('should throw DisplaysNotFoundException when display not found', async () => {
			jest.spyOn(service, 'remove').mockRejectedValue(new DisplaysNotFoundException('Display not found'));

			await expect(controller.remove('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});
});
