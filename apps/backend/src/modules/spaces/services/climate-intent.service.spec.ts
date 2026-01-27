/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConnectionState, DeviceCategory } from '../../devices/devices.constants';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTimeseriesService } from '../../intents/services/intent-timeseries.service';
import { IntentsService } from '../../intents/services/intents.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import {
	ClimateIntentType,
	ClimateMode,
	ClimateRole,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
} from '../spaces.constants';
import { IntentSpecLoaderService } from '../spec';

import { ClimateIntentService, ClimateState, PrimaryClimateDevice } from './climate-intent.service';
import { SpaceClimateStateService } from './space-climate-state.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

describe('ClimateIntentService', () => {
	let service: ClimateIntentService;
	let spacesService: jest.Mocked<SpacesService>;
	let climateStateService: jest.Mocked<SpaceClimateStateService>;
	let platformRegistryService: jest.Mocked<PlatformRegistryService>;

	const mockSpaceId = uuid();
	const mockIntentId = uuid();

	const createMockClimateState = (overrides: Partial<ClimateState> = {}): ClimateState => ({
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
		...overrides,
	});

	const createMockPrimaryClimateDevice = (overrides: Partial<PrimaryClimateDevice> = {}): PrimaryClimateDevice => ({
		device: {
			id: uuid(),
			name: 'Test Device',
			category: DeviceCategory.HEATING_UNIT,
			type: 'test-device',
			status: { online: true, status: ConnectionState.CONNECTED },
		} as DeviceEntity,
		deviceCategory: DeviceCategory.HEATING_UNIT,
		role: ClimateRole.AUTO,
		temperatureChannel: null,
		temperatureProperty: null,
		humidityChannel: null,
		humidityProperty: null,
		heaterChannel: { id: uuid() } as any,
		heaterOnProperty: { id: uuid() } as any,
		heaterStatusProperty: null,
		heaterSetpointProperty: { id: uuid() } as any,
		heaterMinSetpoint: 15,
		heaterMaxSetpoint: 30,
		coolerChannel: null,
		coolerOnProperty: null,
		coolerStatusProperty: null,
		coolerSetpointProperty: null,
		coolerMinSetpoint: DEFAULT_MIN_SETPOINT,
		coolerMaxSetpoint: DEFAULT_MAX_SETPOINT,
		thermostatChannel: null,
		thermostatLockedProperty: null,
		fanChannel: null,
		fanOnProperty: null,
		supportsHeating: true,
		supportsCooling: false,
		...overrides,
	});

	const mockPlatform = {
		getType: jest.fn().mockReturnValue('test-device'),
		setPropertyValue: jest.fn().mockResolvedValue(true),
		processBatch: jest.fn().mockResolvedValue(true),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ClimateIntentService,
				{
					provide: SpacesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue({ id: mockSpaceId }),
					},
				},
				{
					provide: PlatformRegistryService,
					useValue: {
						get: jest.fn().mockReturnValue(mockPlatform),
					},
				},
				{
					provide: SpaceClimateStateService,
					useValue: {
						getClimateState: jest.fn().mockResolvedValue(createMockClimateState()),
						getPrimaryClimateDevicesInSpace: jest.fn().mockResolvedValue([createMockPrimaryClimateDevice()]),
					},
				},
				{
					provide: SpaceContextSnapshotService,
					useValue: {
						captureSnapshot: jest.fn().mockResolvedValue(null),
					},
				},
				{
					provide: SpaceUndoHistoryService,
					useValue: {
						pushSnapshot: jest.fn(),
					},
				},
				{
					provide: IntentTimeseriesService,
					useValue: {
						storeClimateModeChange: jest.fn().mockResolvedValue(undefined),
					},
				},
				{
					provide: EventEmitter2,
					useValue: {
						emit: jest.fn(),
					},
				},
				{
					provide: IntentSpecLoaderService,
					useValue: {
						getClimateSpec: jest.fn().mockReturnValue(null),
						getSetpointDeltaStep: jest.fn().mockReturnValue(null),
					},
				},
				{
					provide: IntentsService,
					useValue: {
						createIntent: jest.fn().mockReturnValue({ id: mockIntentId }),
						completeIntent: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<ClimateIntentService>(ClimateIntentService);
		spacesService = module.get(SpacesService);
		climateStateService = module.get(SpaceClimateStateService);
		platformRegistryService = module.get(PlatformRegistryService);

		// Reset mock between tests
		jest.clearAllMocks();
		mockPlatform.setPropertyValue.mockResolvedValue(true);
		mockPlatform.processBatch.mockResolvedValue(true);
	});

	describe('getClimateState', () => {
		it('should delegate to SpaceClimateStateService', async () => {
			const expectedState = createMockClimateState();
			climateStateService.getClimateState.mockResolvedValue(expectedState);

			const result = await service.getClimateState(mockSpaceId);

			expect(climateStateService.getClimateState).toHaveBeenCalledWith(mockSpaceId);
			expect(result).toEqual(expectedState);
		});

		it('should return null when service returns null', async () => {
			climateStateService.getClimateState.mockResolvedValue(null);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).toBeNull();
		});
	});

	describe('executeClimateIntent', () => {
		it('should return null when space does not exist', async () => {
			spacesService.findOne.mockResolvedValue(null);

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(result).toBeNull();
		});

		it('should return success with zero affected when climate state is null', async () => {
			climateStateService.getClimateState.mockResolvedValue(null);

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(0);
		});

		it('should return success with zero affected when space has no climate devices', async () => {
			climateStateService.getClimateState.mockResolvedValue(createMockClimateState({ hasClimate: false }));

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(0);
		});

		it('should return success with zero affected when no controllable devices', async () => {
			climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([]);

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(result).not.toBeNull();
			expect(result?.success).toBe(true);
			expect(result?.affectedDevices).toBe(0);
		});

		describe('SET_MODE intent', () => {
			it('should create intent and call platform for SET_MODE', async () => {
				const device = createMockPrimaryClimateDevice();
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SET_MODE,
					mode: ClimateMode.HEAT,
				};

				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).not.toBeNull();
				expect(result?.mode).toBe(ClimateMode.HEAT);
				// Platform should have been called
				expect(platformRegistryService.get).toHaveBeenCalledWith(device.device);
			});

			it('should handle platform returning null (no platform registered)', async () => {
				const device = createMockPrimaryClimateDevice();
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);
				platformRegistryService.get.mockReturnValue(null);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SET_MODE,
					mode: ClimateMode.HEAT,
				};

				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).not.toBeNull();
				expect(result?.success).toBe(false);
				expect(result?.failedDevices).toBe(1);
			});

			it('should return correct mode in result', async () => {
				const device = createMockPrimaryClimateDevice();
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SET_MODE,
					mode: ClimateMode.OFF,
				};

				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).not.toBeNull();
				expect(result?.mode).toBe(ClimateMode.OFF);
			});
		});

		describe('SETPOINT_SET intent', () => {
			it('should return requested setpoint value', async () => {
				const device = createMockPrimaryClimateDevice();
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_SET,
					heatingSetpoint: 23.5,
				};

				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).not.toBeNull();
				// Result should contain the setpoint that was requested
				expect(result?.heatingSetpoint).toBe(23.5);
			});

			it('should clamp setpoint to device limits', async () => {
				const device = createMockPrimaryClimateDevice({
					heaterMinSetpoint: 15,
					heaterMaxSetpoint: 30,
				});
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);
				climateStateService.getClimateState.mockResolvedValue(
					createMockClimateState({
						minSetpoint: 15,
						maxSetpoint: 30,
					}),
				);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_SET,
					heatingSetpoint: 50.0, // Beyond max
				};

				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).not.toBeNull();
				expect(result?.heatingSetpoint).toBe(30); // Clamped to max
			});
		});

		describe('CLIMATE_SET intent', () => {
			it('should preserve existing mode when only setpoint provided', async () => {
				const existingMode = ClimateMode.HEAT;
				climateStateService.getClimateState.mockResolvedValue(
					createMockClimateState({
						mode: existingMode,
						heatingSetpoint: 22.0,
					}),
				);
				const device = createMockPrimaryClimateDevice();
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.CLIMATE_SET,
					heatingSetpoint: 24.0,
					// mode not provided
				};

				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).not.toBeNull();
				expect(result?.mode).toBe(existingMode);
			});
		});
	});

	describe('getPrimaryThermostatId', () => {
		it('should return first device ID', async () => {
			const deviceId = uuid();
			const device = createMockPrimaryClimateDevice({
				device: { id: deviceId } as DeviceEntity,
				deviceCategory: DeviceCategory.THERMOSTAT,
			});
			climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);

			const result = await service.getPrimaryThermostatId(mockSpaceId);

			expect(result).toBe(deviceId);
		});

		it('should return null when no devices exist', async () => {
			climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([]);

			const result = await service.getPrimaryThermostatId(mockSpaceId);

			expect(result).toBeNull();
		});
	});

	describe('offline device handling', () => {
		it('skips offline devices and reports them in result', async () => {
			const onlineDevice = createMockPrimaryClimateDevice({
				device: {
					id: 'online-device',
					name: 'Online Thermostat',
					category: DeviceCategory.THERMOSTAT,
					type: 'test-device',
					status: { online: true, status: ConnectionState.CONNECTED },
				} as DeviceEntity,
			});
			const offlineDevice = createMockPrimaryClimateDevice({
				device: {
					id: 'offline-device',
					name: 'Offline Thermostat',
					category: DeviceCategory.THERMOSTAT,
					type: 'test-device',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
			});

			climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([onlineDevice, offlineDevice]);

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(result?.success).toBe(true);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-device');
		});

		it('returns early when all devices are offline', async () => {
			const offlineDevice = createMockPrimaryClimateDevice({
				device: {
					id: 'offline-device',
					name: 'Offline Thermostat',
					category: DeviceCategory.THERMOSTAT,
					type: 'test-device',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
			});

			climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([offlineDevice]);

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('offline-device');
		});

		it('treats UNKNOWN status as offline', async () => {
			const unknownStatusDevice = createMockPrimaryClimateDevice({
				device: {
					id: 'unknown-device',
					name: 'Unknown Status Thermostat',
					category: DeviceCategory.THERMOSTAT,
					type: 'test-device',
					status: { online: false, status: ConnectionState.UNKNOWN },
				} as DeviceEntity,
			});

			climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([unknownStatusDevice]);

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			// Device with UNKNOWN status should be treated as offline and skipped
			expect(result?.success).toBe(false);
			expect(result?.affectedDevices).toBe(0);
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toContain('unknown-device');
		});

		it('deduplicates offline device IDs for multi-channel devices', async () => {
			// Simulate a device appearing multiple times (e.g., multi-channel)
			const deviceId = 'multi-channel-device';
			const offlineDevice1 = createMockPrimaryClimateDevice({
				device: {
					id: deviceId,
					name: 'Multi-Channel Thermostat',
					category: DeviceCategory.THERMOSTAT,
					type: 'test-device',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
			});
			const offlineDevice2 = createMockPrimaryClimateDevice({
				device: {
					id: deviceId,
					name: 'Multi-Channel Thermostat',
					category: DeviceCategory.THERMOSTAT,
					type: 'test-device',
					status: { online: false, status: ConnectionState.DISCONNECTED },
				} as DeviceEntity,
			});

			climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([offlineDevice1, offlineDevice2]);

			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SET_MODE,
				mode: ClimateMode.HEAT,
			};

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			// Should only count the device once, not twice
			expect(result?.skippedOfflineDevices).toBe(1);
			expect(result?.offlineDeviceIds).toHaveLength(1);
			expect(result?.offlineDeviceIds).toContain(deviceId);
		});
	});
});
