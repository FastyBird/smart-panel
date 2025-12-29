/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Repository, SelectQueryBuilder, UpdateQueryBuilder, UpdateResult } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceType } from '../spaces.constants';

import { SpaceActivityListener } from './space-activity.listener';

describe('SpaceActivityListener', () => {
	let listener: SpaceActivityListener;
	let spaceRepository: jest.Mocked<Repository<SpaceEntity>>;
	let channelRepository: jest.Mocked<Repository<ChannelEntity>>;

	const mockSpace: SpaceEntity = {
		id: uuid(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		category: null,
		icon: 'mdi:sofa',
		displayOrder: 0,
		primaryThermostatId: null,
		primaryTemperatureSensorId: null,
		suggestionsEnabled: true,
		lastActivityAt: null,
		parentId: null,
		parent: null,
		children: [],
		createdAt: new Date(),
		updatedAt: null,
	};

	const mockDevice: Partial<DeviceEntity> = {
		id: uuid(),
		name: 'Test Device',
		roomId: mockSpace.id,
	};

	const mockChannel: Partial<ChannelEntity> = {
		id: uuid(),
		name: 'Test Channel',
		device: mockDevice as DeviceEntity,
	};

	beforeEach(async () => {
		const mockChannelQueryBuilder = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(mockChannel),
		} as unknown as SelectQueryBuilder<ChannelEntity>;

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
					provide: getRepositoryToken(ChannelEntity),
					useValue: {
						createQueryBuilder: jest.fn().mockReturnValue(mockChannelQueryBuilder),
					},
				},
			],
		}).compile();

		listener = module.get<SpaceActivityListener>(SpaceActivityListener);
		spaceRepository = module.get(getRepositoryToken(SpaceEntity));
		channelRepository = module.get(getRepositoryToken(ChannelEntity));
	});

	describe('handlePropertyUpdated', () => {
		it('should update space lastActivityAt when property is updated for device with space', async () => {
			const channelId = uuid();
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: channelId,
			};

			await listener.handlePropertyUpdated(property as ChannelPropertyEntity);

			expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
			expect(spaceRepository.createQueryBuilder).toHaveBeenCalled();
		});

		it('should not update when channel not found or device has no space', async () => {
			const channelId = uuid();
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: channelId,
			};

			// Mock channel not found
			const mockChannelQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			} as unknown as SelectQueryBuilder<ChannelEntity>;

			channelRepository.createQueryBuilder.mockReturnValue(mockChannelQueryBuilder as any);

			await listener.handlePropertyUpdated(property as ChannelPropertyEntity);

			expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
			expect(spaceRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it('should not update when property has no channel', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: undefined as any,
			};

			await listener.handlePropertyUpdated(property as ChannelPropertyEntity);

			expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
			expect(spaceRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const channelId = uuid();
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				channel: channelId,
			};

			// Mock an error
			const mockChannelQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockRejectedValue(new Error('Database error')),
			} as unknown as SelectQueryBuilder<ChannelEntity>;

			channelRepository.createQueryBuilder.mockReturnValue(mockChannelQueryBuilder as any);

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

			expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
		});
	});

	describe('onModuleInit', () => {
		it('should initialize without error', () => {
			expect(() => listener.onModuleInit()).not.toThrow();
		});
	});
});
