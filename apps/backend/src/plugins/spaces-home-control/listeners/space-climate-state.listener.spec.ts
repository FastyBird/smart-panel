/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { PropertyMetadataService } from '../../../modules/devices/services/property-metadata.service';
import { ClimateState, SpaceClimateStateService } from '../services/space-climate-state.service';
import { ClimateMode, EventType } from '../spaces-home-control.constants';

import { SpaceClimateStateListener } from './space-climate-state.listener';

// Debounce delay matches the constant in the listener (100ms)
const DEBOUNCE_DELAY = 100;

describe('SpaceClimateStateListener', () => {
	let listener: SpaceClimateStateListener;
	let metadata: { findOne: jest.Mock };
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

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceClimateStateListener,
				{
					provide: PropertyMetadataService,
					useValue: {
						findOne: jest.fn().mockResolvedValue({ channel: mockChannel }),
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
		metadata = module.get(PropertyMetadataService);
		climateStateService = module.get(SpaceClimateStateService);
		eventEmitter = module.get(EventEmitter2);
	});

	afterEach(() => {
		listener.onModuleDestroy();
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

			expect(metadata.findOne).toHaveBeenCalled();

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

			expect(metadata.findOne).not.toHaveBeenCalled();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('should not emit event when channel is not climate-relevant', async () => {
			const nonClimateChannel: Partial<ChannelEntity> = {
				...mockChannel,
				category: ChannelCategory.LIGHT, // Not a climate channel
			};

			metadata.findOne.mockResolvedValue({ channel: nonClimateChannel });

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
			metadata.findOne.mockResolvedValue(null);

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

			metadata.findOne.mockResolvedValue({ channel: channelWithoutRoom });

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
			metadata.findOne.mockRejectedValue(new Error('Database error'));

			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: mockChannelId,
			};

			// Should not throw
			await expect(listener.handlePropertyChanged(property as ChannelPropertyEntity)).resolves.not.toThrow();
			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});

		it('resolves current metadata by property id even with an event channel object', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				channel: { id: mockChannelId } as any,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(metadata.findOne).toHaveBeenCalled();
		});

		it('should not process when property has no id', async () => {
			const property: Partial<ChannelPropertyEntity> = {
				id: undefined,
				category: PropertyCategory.TEMPERATURE,
				channel: undefined as any,
			};

			await listener.handlePropertyChanged(property as ChannelPropertyEntity);

			expect(metadata.findOne).not.toHaveBeenCalled();
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
