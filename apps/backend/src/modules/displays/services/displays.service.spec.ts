/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { toInstance } from '../../../common/utils/transform.utils';
import { EventType } from '../displays.constants';
import { DisplaysNotFoundException } from '../displays.exceptions';
import { DisplayEntity } from '../entities/displays.entity';

import { DisplaysService } from './displays.service';

describe('DisplaysService', () => {
	let service: DisplaysService;
	let repository: Repository<DisplayEntity>;
	let eventEmitter: EventEmitter2;

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
		audioOutputSupported: false,
		audioInputSupported: false,
		speaker: false,
		speakerVolume: 50,
		microphone: false,
		microphoneVolume: 50,
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
		audioOutputSupported: true,
		audioInputSupported: true,
		speaker: true,
		speakerVolume: 75,
		microphone: true,
		microphoneVolume: 60,
		createdAt: new Date(Date.now() + 1000), // Created later
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
				DisplaysService,
				{ provide: getRepositoryToken(DisplayEntity), useFactory: mockRepository },
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(() => {}),
					},
				},
			],
		}).compile();

		service = module.get<DisplaysService>(DisplaysService);
		repository = module.get<Repository<DisplayEntity>>(getRepositoryToken(DisplayEntity));
		eventEmitter = module.get<EventEmitter2>(EventEmitter2);

		jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
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
		it('should return all displays', async () => {
			const mockDisplays = [mockDisplay, mockDisplayTwo];

			jest.spyOn(repository, 'find').mockResolvedValue(mockDisplays.map((d) => toInstance(DisplayEntity, d)));

			const result = await service.findAll();

			expect(result).toHaveLength(2);
			expect(repository.find).toHaveBeenCalled();
		});

		it('should return empty array when no displays exist', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([]);

			const result = await service.findAll();

			expect(result).toHaveLength(0);
		});
	});

	describe('findOne', () => {
		it('should return a display by ID', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));

			const result = await service.findOne(mockDisplay.id);

			expect(result).toEqual(toInstance(DisplayEntity, mockDisplay));
			expect(repository.findOne).toHaveBeenCalledWith({ where: { id: mockDisplay.id } });
		});

		it('should return null if display not found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findOne('non-existent-id');

			expect(result).toBeNull();
		});
	});

	describe('findByMacAddress', () => {
		it('should return a display by MAC address', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));

			const result = await service.findByMacAddress(mockDisplay.macAddress);

			expect(result).toEqual(toInstance(DisplayEntity, mockDisplay));
			expect(repository.findOne).toHaveBeenCalledWith({ where: { macAddress: mockDisplay.macAddress } });
		});

		it('should return null if display not found by MAC', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			const result = await service.findByMacAddress('XX:XX:XX:XX:XX:XX');

			expect(result).toBeNull();
		});
	});

	describe('findPrimary', () => {
		it('should return the first display by creation date', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([toInstance(DisplayEntity, mockDisplay)]);

			const result = await service.findPrimary();

			expect(result).toEqual(toInstance(DisplayEntity, mockDisplay));
			expect(repository.find).toHaveBeenCalledWith({
				order: { createdAt: 'ASC' },
				take: 1,
			});
		});

		it('should return null if no displays exist', async () => {
			jest.spyOn(repository, 'find').mockResolvedValue([]);

			const result = await service.findPrimary();

			expect(result).toBeNull();
		});
	});

	describe('getOneOrThrow', () => {
		it('should return a display if found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));

			const result = await service.getOneOrThrow(mockDisplay.id);

			expect(result).toEqual(toInstance(DisplayEntity, mockDisplay));
		});

		it('should throw DisplaysNotFoundException if display not found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.getOneOrThrow('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});

	describe('create', () => {
		it('should create and return a new display', async () => {
			const createData: Partial<DisplayEntity> = {
				macAddress: mockDisplay.macAddress,
				version: mockDisplay.version,
				build: mockDisplay.build,
				screenWidth: mockDisplay.screenWidth,
				screenHeight: mockDisplay.screenHeight,
			};

			jest.spyOn(repository, 'create').mockReturnValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));

			const result = await service.create(createData);

			expect(result).toEqual(toInstance(DisplayEntity, mockDisplay));
			expect(repository.create).toHaveBeenCalledWith(createData);
			expect(repository.save).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.DISPLAY_CREATED, toInstance(DisplayEntity, mockDisplay));
		});
	});

	describe('update', () => {
		it('should update and return the display', async () => {
			const updateDto = { brightness: 80 };
			const updatedDisplay = { ...mockDisplay, brightness: 80 };

			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(repository, 'save').mockResolvedValue(toInstance(DisplayEntity, updatedDisplay));

			const result = await service.update(mockDisplay.id, updateDto);

			expect(result.brightness).toBe(80);
			expect(repository.save).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.DISPLAY_UPDATED, expect.any(Object));
		});

		it('should throw DisplaysNotFoundException if display not found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.update('non-existent-id', { brightness: 80 })).rejects.toThrow(DisplaysNotFoundException);
		});
	});

	describe('remove', () => {
		it('should remove a display', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(toInstance(DisplayEntity, mockDisplay));
			jest.spyOn(repository, 'remove').mockResolvedValue(undefined);

			await service.remove(mockDisplay.id);

			expect(repository.remove).toHaveBeenCalledWith(toInstance(DisplayEntity, mockDisplay));
			expect(eventEmitter.emit).toHaveBeenCalledWith(EventType.DISPLAY_DELETED, { id: mockDisplay.id });
		});

		it('should throw DisplaysNotFoundException if display not found', async () => {
			jest.spyOn(repository, 'findOne').mockResolvedValue(null);

			await expect(service.remove('non-existent-id')).rejects.toThrow(DisplaysNotFoundException);
		});
	});
});
