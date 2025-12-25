/* eslint-disable @typescript-eslint/unbound-method */
import { DataSource, Repository, UpdateQueryBuilder, UpdateResult } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceType } from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';

import { SpacesService } from './spaces.service';

describe('SpacesService', () => {
	let service: SpacesService;
	let spaceRepository: jest.Mocked<Repository<SpaceEntity>>;
	let deviceRepository: jest.Mocked<Repository<DeviceEntity>>;
	let displayRepository: jest.Mocked<Repository<DisplayEntity>>;

	const mockSpace: SpaceEntity = {
		id: uuid(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		icon: 'mdi:sofa',
		displayOrder: 0,
		primaryThermostatId: null,
		primaryTemperatureSensorId: null,
		createdAt: new Date(),
		updatedAt: null,
	};

	beforeEach(async () => {
		const mockQueryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ affected: 0 } as UpdateResult),
		} as unknown as UpdateQueryBuilder<any>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpacesService,
				{
					provide: getRepositoryToken(SpaceEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([mockSpace]),
						findOne: jest.fn().mockResolvedValue(mockSpace),
						save: jest.fn().mockResolvedValue(mockSpace),
						delete: jest.fn().mockResolvedValue({ affected: 1 }),
						createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
					},
				},
				{
					provide: getRepositoryToken(DeviceEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([]),
						createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
					},
				},
				{
					provide: getRepositoryToken(DisplayEntity),
					useValue: {
						find: jest.fn().mockResolvedValue([]),
						createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
					},
				},
				{
					provide: DataSource,
					useValue: {
						createQueryRunner: jest.fn().mockReturnValue({
							connect: jest.fn(),
							startTransaction: jest.fn(),
							commitTransaction: jest.fn(),
							rollbackTransaction: jest.fn(),
							release: jest.fn(),
							manager: {
								save: jest.fn().mockResolvedValue(mockSpace),
								update: jest.fn().mockResolvedValue({ affected: 1 }),
							},
						}),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<SpacesService>(SpacesService);
		spaceRepository = module.get(getRepositoryToken(SpaceEntity));
		deviceRepository = module.get(getRepositoryToken(DeviceEntity));
		displayRepository = module.get(getRepositoryToken(DisplayEntity));
	});

	describe('proposeSpaces', () => {
		it('should return empty array when no devices exist', async () => {
			deviceRepository.find.mockResolvedValue([]);

			const result = await service.proposeSpaces();

			expect(result).toEqual([]);
			expect(deviceRepository.find).toHaveBeenCalledWith({ select: ['id', 'name'] });
		});

		it('should propose spaces based on device names', async () => {
			const devices = [
				{ id: uuid(), name: 'Living Room Ceiling Light' },
				{ id: uuid(), name: 'Living Room Lamp' },
				{ id: uuid(), name: 'Kitchen Light' },
				{ id: uuid(), name: 'Bedroom Thermostat' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(3);

			const livingRoom = result.find((s) => s.name === 'Living Room');
			expect(livingRoom).toBeDefined();
			expect(livingRoom?.deviceCount).toBe(2);
			expect(livingRoom?.deviceIds).toContain(devices[0].id);
			expect(livingRoom?.deviceIds).toContain(devices[1].id);

			const kitchen = result.find((s) => s.name === 'Kitchen');
			expect(kitchen).toBeDefined();
			expect(kitchen?.deviceCount).toBe(1);

			const bedroom = result.find((s) => s.name === 'Bedroom');
			expect(bedroom).toBeDefined();
			expect(bedroom?.deviceCount).toBe(1);
		});

		it('should not propose spaces for devices without room tokens', async () => {
			const devices = [
				{ id: uuid(), name: 'Main Switch' },
				{ id: uuid(), name: 'Temperature Sensor' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toEqual([]);
		});

		it('should match longest room token when multiple match', async () => {
			const devices = [{ id: uuid(), name: 'Master Bedroom Light' }] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Master Bedroom');
		});

		it('should handle case-insensitive matching', async () => {
			const devices = [
				{ id: uuid(), name: 'LIVING ROOM Lamp' },
				{ id: uuid(), name: 'living room light' },
			] as DeviceEntity[];

			deviceRepository.find.mockResolvedValue(devices);

			const result = await service.proposeSpaces();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe('Living Room');
			expect(result[0].deviceCount).toBe(2);
		});
	});

	describe('bulkAssign', () => {
		const spaceId = mockSpace.id;

		beforeEach(() => {
			spaceRepository.findOne.mockResolvedValue(mockSpace);
		});

		it('should assign devices and displays to a space', async () => {
			const deviceIds = [uuid(), uuid()];
			const displayIds = [uuid()];

			const deviceQueryBuilder = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 2 } as UpdateResult),
			};

			const displayQueryBuilder = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 1 } as UpdateResult),
			};

			deviceRepository.createQueryBuilder.mockReturnValue(deviceQueryBuilder as any);
			displayRepository.createQueryBuilder.mockReturnValue(displayQueryBuilder as any);

			const result = await service.bulkAssign(spaceId, {
				deviceIds,
				displayIds,
			});

			expect(result.devicesAssigned).toBe(2);
			expect(result.displaysAssigned).toBe(1);
			expect(deviceQueryBuilder.set).toHaveBeenCalledWith({ spaceId });
			expect(displayQueryBuilder.set).toHaveBeenCalledWith({ spaceId });
		});

		it('should handle empty device and display arrays', async () => {
			const result = await service.bulkAssign(spaceId, {
				deviceIds: [],
				displayIds: [],
			});

			expect(result.devicesAssigned).toBe(0);
			expect(result.displaysAssigned).toBe(0);
		});

		it('should assign only devices when no displays provided', async () => {
			const deviceIds = [uuid(), uuid(), uuid()];

			const deviceQueryBuilder = {
				update: jest.fn().mockReturnThis(),
				set: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				execute: jest.fn().mockResolvedValue({ affected: 3 } as UpdateResult),
			};

			deviceRepository.createQueryBuilder.mockReturnValue(deviceQueryBuilder as any);

			const result = await service.bulkAssign(spaceId, {
				deviceIds,
				displayIds: [],
			});

			expect(result.devicesAssigned).toBe(3);
			expect(result.displaysAssigned).toBe(0);
		});

		it('should throw SpacesNotFoundException when space does not exist', async () => {
			spaceRepository.findOne.mockResolvedValue(null);

			await expect(
				service.bulkAssign('non-existent-id', {
					deviceIds: [uuid()],
					displayIds: [],
				}),
			).rejects.toThrow(SpacesNotFoundException);
		});

		it('should throw SpacesValidationException for invalid device IDs', async () => {
			await expect(
				service.bulkAssign(spaceId, {
					deviceIds: ['not-a-uuid'],
					displayIds: [],
				}),
			).rejects.toThrow(SpacesValidationException);
		});
	});

	describe('findAll', () => {
		it('should return all spaces ordered by displayOrder and name', async () => {
			const spaces = [mockSpace];
			spaceRepository.find.mockResolvedValue(spaces);

			const result = await service.findAll();

			expect(result).toEqual(spaces);
			expect(spaceRepository.find).toHaveBeenCalledWith({
				order: { displayOrder: 'ASC', name: 'ASC' },
			});
		});
	});

	describe('getOneOrThrow', () => {
		it('should return space when found', async () => {
			spaceRepository.findOne.mockResolvedValue(mockSpace);

			const result = await service.getOneOrThrow(mockSpace.id);

			expect(result).toEqual(mockSpace);
		});

		it('should throw SpacesNotFoundException when space not found', async () => {
			spaceRepository.findOne.mockResolvedValue(null);

			await expect(service.getOneOrThrow('non-existent')).rejects.toThrow(SpacesNotFoundException);
		});
	});
});
