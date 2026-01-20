/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import { Repository, SelectQueryBuilder } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { ClimateState, SpaceClimateStateService } from '../services/space-climate-state.service';
import { ClimateMode, EventType } from '../spaces.constants';

import { SpaceClimateStateListener } from './space-climate-state.listener';

// Debounce delay matches the constant in the listener (100ms)
const DEBOUNCE_DELAY = 100;

describe('SpaceClimateStateListener', () => {
	let listener: SpaceClimateStateListener;
	let channelRepository: jest.Mocked<Repository<ChannelEntity>>;
	let climateStateService: jest.Mocked<SpaceClimateStateService>;
	let eventEmitter: jest.Mocked<EventEmitter2>;

	const mockRoomId = uuid();
	const mockDeviceId = uuid();
	const mockChannelId = uuid();

	const mockDevice: Partial<DeviceEntity> = {
		id: mockDeviceId,
		name: 'Test Thermostat',
		roomId: mockRoomId,
	};

	const mockChannel: Partial<ChannelEntity> = {
		id: mockChannelId,
		name: 'Heater Channel',
		category: ChannelCategory.HEATER,
		device: mockDevice as DeviceEntity,
	};

	const mockClimateState: ClimateState = {
		hasClimate: true,
		mode: ClimateMode.HEAT,
		currentTemperature: 21.5,
		currentHumidity: 45,
		heatingSetpoint: 22.0,
		coolingSetpoint: null,
		minSetpoint: 15,
		maxSetpoint: 30,
		supportsHeating: true,
		supportsCooling: false,
		isHeating: true,
		isCooling: false,
		isMixed: false,
		devicesCount: 1,
		lastAppliedMode: null,
		lastAppliedAt: null,
	};

	beforeEach(async () => {
		// Use fake timers for debounce testing
		jest.useFakeTimers();

		const mockChannelQueryBuilder = {
			innerJoinAndSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getOne: jest.fn().mockResolvedValue(mockChannel),
		} as unknown as SelectQueryBuilder<ChannelEntity>;

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceClimateStateListener,
				{
					provide: getRepositoryToken(ChannelEntity),
					useValue: {
						createQueryBuilder: jest.fn().mockReturnValue(mockChannelQueryBuilder),
					},
				},
				{
					provide: SpaceClimateStateService,
					useValue: {
						getClimateState: jest.fn().mockResolvedValue(mockClimateState),
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

		listener = module.get<SpaceClimateStateListener>(SpaceClimateStateListener);
		channelRepository = module.get(getRepositoryToken(ChannelEntity));
		climateStateService = module.get(SpaceClimateStateService);
		eventEmitter = module.get(EventEmitter2);
	});

	afterEach(() => {
		jest.clearAllMocks();
		jest.useRealTimers();
	});

	/**
	 * Helper to advance timers and flush pending promises.
	 * This is needed because the debounced function is async.
	 */
	const flushDebounce = async (): Promise<void> => {
		// Advance timers to trigger the debounced callback
		jest.advanceTimersByTime(DEBOUNCE_DELAY + 10);
		// Run all pending timers
		jest.runAllTimers();
		// Allow any pending promises to resolve (multiple ticks for nested promises)
		await Promise.resolve();
		await Promise.resolve();
		await Promise.resolve();
	};

	describe('handlePropertyChanged', () => {
		it('should emit CLIMATE_STATE_CHANGED when climate-relevant property changes', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(channelRepository.createQueryBuilder).toHaveBeenCalled();

			// Flush debounce timer to trigger the event emission
			await flushDebounce();

			expect(climateStateService.getClimateState).toHaveBeenCalledWith(mockRoomId);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				EventType.CLIMATE_STATE_CHANGED,
				expect.objectContaining({
					space_id: mockRoomId,
					state: expect.any(Object),
				}),
			);
		});

		it('should not emit event for non-climate property categories', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.BRIGHTNESS, // Not a climate property
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should not emit event when channel is not climate-relevant', async () => {
			const nonClimateChannel: Partial<ChannelEntity> = {
				...mockChannel,
				category: ChannelCategory.LIGHT, // Not a climate channel
			};

			const mockNonClimateQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(nonClimateChannel),
			} as unknown as SelectQueryBuilder<ChannelEntity>;

			channelRepository.createQueryBuilder.mockReturnValue(mockNonClimateQueryBuilder as any);

			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(climateStateService.getClimateState).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should not emit event when getClimateState returns null', async () => {
			climateStateService.getClimateState.mockResolvedValue(null);

			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			// Flush debounce timer
			await flushDebounce();

			expect(climateStateService.getClimateState).toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should not emit event when climate state has no climate devices', async () => {
			const noClimateState: ClimateState = {
				...mockClimateState,
				hasClimate: false,
			};
			climateStateService.getClimateState.mockResolvedValue(noClimateState);

			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			// Flush debounce timer
			await flushDebounce();

			expect(climateStateService.getClimateState).toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should not emit event when channel not found', async () => {
			const mockNullQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(null),
			} as unknown as SelectQueryBuilder<ChannelEntity>;

			channelRepository.createQueryBuilder.mockReturnValue(mockNullQueryBuilder as any);

			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(climateStateService.getClimateState).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should not emit event when device has no roomId', async () => {
			const deviceWithoutRoom: Partial<DeviceEntity> = {
				...mockDevice,
				roomId: null,
			};
			const channelWithoutRoom: Partial<ChannelEntity> = {
				...mockChannel,
				device: deviceWithoutRoom as DeviceEntity,
			};

			const mockQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockResolvedValue(channelWithoutRoom),
			} as unknown as SelectQueryBuilder<ChannelEntity>;

			channelRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(climateStateService.getClimateState).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should handle errors gracefully', async () => {
			const mockErrorQueryBuilder = {
				innerJoinAndSelect: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				getOne: jest.fn().mockRejectedValue(new Error('Database error')),
			} as unknown as SelectQueryBuilder<ChannelEntity>;

			channelRepository.createQueryBuilder.mockReturnValue(mockErrorQueryBuilder as any);

			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			// Should not throw
			await expect(listener.handlePropertyChanged(property as ChannelPropertyEntity)).resolves.not.toThrow();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should extract channel id from channel entity object', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: { id: mockChannelId } as any,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(channelRepository.createQueryBuilder).toHaveBeenCalled();
		});

		it('should not process when property has no channel', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: undefined as any,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(channelRepository.createQueryBuilder).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should process ON property category', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.ON,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			// Flush debounce timer
			await flushDebounce();

			expect(climateStateService.getClimateState).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalled();
		});

		it('should process STATUS property category', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.STATUS,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			// Flush debounce timer
			await flushDebounce();

			expect(climateStateService.getClimateState).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalled();
		});

		it('should process HUMIDITY property category', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.HUMIDITY,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			// Flush debounce timer
			await flushDebounce();

			expect(climateStateService.getClimateState).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalled();
		});

		it('should process LOCKED property category', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.LOCKED,
				channel: mockChannelId,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			// Flush debounce timer
			await flushDebounce();

			expect(climateStateService.getClimateState).toHaveBeenCalled();
			expect(eventEmitter.emit).toHaveBeenCalled();
		});
	});

	describe('onModuleInit', () => {
		it('should initialize without error', () => {
			expect(() => listener.onModuleInit()).not.toThrow();
		});
	});
});
