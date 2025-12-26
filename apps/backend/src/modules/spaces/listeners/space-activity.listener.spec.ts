/* eslint-disable @typescript-eslint/unbound-method */
import { Repository, SelectQueryBuilder, UpdateQueryBuilder, UpdateResult } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceType } from '../spaces.constants';

import { SpaceActivityListener } from './space-activity.listener';

describe('SpaceActivityListener', () => {
	let listener: SpaceActivityListener;
	let spaceRepository: jest.Mocked<Repository<SpaceEntity>>;
	let deviceRepository: jest.Mocked<Repository<DeviceEntity>>;

	const mockSpace: SpaceEntity = {
		id: uuid(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		icon: 'mdi:sofa',
		displayOrder: 0,
		primaryThermostatId: null,
		primaryTemperatureSensorId: null,
		suggestionsEnabled: true,
		lastActivityAt: null,
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockDevice: Partial<DeviceEntity> = {
		id: uuid(),
		name: 'Test Device',
		spaceId: mockSpace.id,
	};

	beforeEach(async () => {
		const mockDeviceQueryBuilder = {
			innerJoin: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(mockDevice),
		} as unknown as SelectQueryBuilder<DeviceEntity>;

		const mockSpaceUpdateQueryBuilder = {
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({ affected: 1 } as UpdateResult),
		} as unknown as UpdateQueryBuilder<SpaceEntity>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceActivityListener,
				{
					provide: getRepositoryToken(SpaceEntity),
					useValue: {
						createQueryBuilder: jest.fn().mockReturnValue(mockSpaceUpdateQueryBuilder),
					},
				},
				{
					provide: getRepositoryToken(DeviceEntity),
					useValue: {
						createQueryBuilder: jest.fn().mockReturnValue(mockDeviceQueryBuilder),
					},
				},
			],
		}).compile();

		listener = module.get<SpaceActivityListener>(SpaceActivityListener);
		spaceRepository = module.get(getRepositoryToken(SpaceEntity));
		deviceRepository = module.get(getRepositoryToken(DeviceEntity));
	});

	describe('handlePropertyUpdated', () => {
		it('should update space lastActivityAt when property is updated for device with space', async () => {
			const channelId = uuid();
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: channelId,
			};

			await listener.handlePropertyUpdated(property as ChannelPropertyEntity);

			expect(deviceRepository.createQueryBuilder).toHaveBeenCalled();
			expect(spaceRepository.createQueryBuilder).toHaveBeenCalled();
		});

		it('should not update when device has no space', async () => {
			const channelId = uuid();
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: channelId,
			};

			// Mock device without space
			const mockDeviceQueryBuilder = {
				innerJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			} as unknown as SelectQueryBuilder<DeviceEntity>;

			deviceRepository.createQueryBuilder.mockReturnValue(mockDeviceQueryBuilder as any);

			await listener.handlePropertyUpdated(property as ChannelPropertyEntity);

			expect(deviceRepository.createQueryBuilder).toHaveBeenCalled();
			expect(spaceRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it('should not update when property has no channel', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: undefined as any,
			};

			await listener.handlePropertyUpdated(property as ChannelPropertyEntity);

			expect(deviceRepository.createQueryBuilder).not.toHaveBeenCalled();
			expect(spaceRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const channelId = uuid();
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: channelId,
			};

			// Mock an error
			const mockDeviceQueryBuilder = {
				innerJoin: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockRejectedValue(new Error('Database error')),
			} as unknown as SelectQueryBuilder<DeviceEntity>;

			deviceRepository.createQueryBuilder.mockReturnValue(mockDeviceQueryBuilder as any);

			// Should not throw
			await expect(listener.handlePropertyUpdated(property as ChannelPropertyEntity)).resolves.not.toThrow();
		});

		it('should extract channel id from channel entity object', async () => {
			const channelId = uuid();
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: { id: channelId } as any,
			};

			await listener.handlePropertyUpdated(property as ChannelPropertyEntity);

			expect(deviceRepository.createQueryBuilder).toHaveBeenCalled();
		});
	});

	describe('onModuleInit', () => {
		it('should initialize without error', () => {
			expect(() => listener.onModuleInit()).not.toThrow();
		});
	});
});
