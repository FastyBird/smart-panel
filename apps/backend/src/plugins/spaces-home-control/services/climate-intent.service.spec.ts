/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { v4 as uuid } from 'uuid';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConnectionState, DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../../modules/devices/entities/devices.entity';
import { type IDevicePropertyData } from '../../../modules/devices/platforms/device.platform';
import { PlatformRegistryService } from '../../../modules/devices/services/platform.registry.service';
import { DEFAULT_TTL_SPACE_COMMAND } from '../../../modules/intents/intents.constants';
import { IntentTimeseriesService } from '../../../modules/intents/services/intent-timeseries.service';
import { IntentsService } from '../../../modules/intents/services/intents.service';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import {
	ClimateIntentType,
	ClimateMode,
	ClimateRole,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
} from '../spaces-home-control.constants';
import { IntentSpecLoaderService } from '../spec';

import { ClimateIntentService, ClimateState, PrimaryClimateDevice } from './climate-intent.service';
import { SpaceClimateStateService } from './space-climate-state.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';

describe('ClimateIntentService', () => {
	let service: ClimateIntentService;
	let spacesService: jest.Mocked<SpacesService>;
	let climateStateService: jest.Mocked<SpaceClimateStateService>;
	let platformRegistryService: jest.Mocked<PlatformRegistryService>;
	let intentTimeseriesService: jest.Mocked<IntentTimeseriesService>;

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
		prepareBatch: jest.fn(),
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
						getCommandTtlMs: jest.fn().mockReturnValue(DEFAULT_TTL_SPACE_COMMAND),
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
		intentTimeseriesService = module.get(IntentTimeseriesService);

		// Reset mock between tests
		jest.clearAllMocks();
		mockPlatform.setPropertyValue.mockResolvedValue(true);
		mockPlatform.prepareBatch.mockImplementation((updates: IDevicePropertyData[]) => updates);
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
			it.each([ClimateIntentType.SETPOINT_SET, ClimateIntentType.CLIMATE_SET])(
				'returns and persists the exact setpoints prepared by the device platform for %s',
				async (type) => {
					const heaterSetpointPropertyId = uuid();
					const coolerSetpointPropertyId = uuid();
					const heaterSetpointProperty = { id: heaterSetpointPropertyId } as any;
					const coolerSetpointProperty = { id: coolerSetpointPropertyId } as any;
					const device = createMockPrimaryClimateDevice({
						deviceCategory: DeviceCategory.THERMOSTAT,
						coolerChannel: { id: uuid() } as any,
						coolerOnProperty: { id: uuid() } as any,
						coolerSetpointProperty,
						heaterSetpointProperty,
						supportsCooling: true,
					});
					climateStateService.getClimateState.mockResolvedValue(
						createMockClimateState({
							mode: ClimateMode.AUTO,
							heatingSetpoint: 21,
							coolingSetpoint: 25,
							supportsCooling: true,
						}),
					);
					climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);
					mockPlatform.prepareBatch.mockImplementation((updates: IDevicePropertyData[]) =>
						updates.map((update) =>
							[heaterSetpointPropertyId, coolerSetpointPropertyId].includes(update.property.id)
								? { ...update, value: 23 }
								: update,
						),
					);

					const result = await service.executeClimateIntent(mockSpaceId, {
						type,
						...(type === ClimateIntentType.CLIMATE_SET ? { mode: ClimateMode.AUTO } : {}),
						heatingSetpoint: 21,
						coolingSetpoint: 25,
					});

					expect(result).toMatchObject({ success: true, heatingSetpoint: 23, coolingSetpoint: 23 });
					expect(intentTimeseriesService.storeClimateModeChange).toHaveBeenCalledWith(
						mockSpaceId,
						ClimateMode.AUTO,
						23,
						23,
						1,
						1,
						0,
					);
				},
			);

			it.each([
				{
					label: 'heating',
					intent: { heatingSetpoint: 22.5 },
					projected: 23,
					expectedResult: { heatingSetpoint: 23, coolingSetpoint: null },
				},
				{
					label: 'cooling',
					intent: { coolingSetpoint: 24.5 },
					projected: 25,
					expectedResult: { heatingSetpoint: null, coolingSetpoint: 25 },
				},
			])('persists both shared-target projections after a one-sided $label update', async (testCase) => {
				const heaterChannel = Object.assign(new ChannelEntity(), { id: uuid() });
				const coolerChannel = Object.assign(new ChannelEntity(), { id: uuid() });
				const heaterSetpointProperty = Object.assign(new ChannelPropertyEntity(), { id: uuid() });
				const coolerSetpointProperty = Object.assign(new ChannelPropertyEntity(), { id: uuid() });
				const device = createMockPrimaryClimateDevice({
					deviceCategory: DeviceCategory.THERMOSTAT,
					heaterChannel,
					coolerChannel,
					coolerOnProperty: { id: uuid() } as any,
					coolerSetpointProperty,
					heaterSetpointProperty,
					supportsCooling: true,
				});
				climateStateService.getClimateState.mockResolvedValue(
					createMockClimateState({
						mode: ClimateMode.AUTO,
						heatingSetpoint: 21,
						coolingSetpoint: 25,
						supportsCooling: true,
					}),
				);
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);
				mockPlatform.prepareBatch.mockImplementation((updates: IDevicePropertyData[]) => {
					const update = updates[0];

					return [
						{ ...update, value: testCase.projected },
						{
							device: update.device,
							channel: update.property.id === heaterSetpointProperty.id ? coolerChannel : heaterChannel,
							property:
								update.property.id === heaterSetpointProperty.id ? coolerSetpointProperty : heaterSetpointProperty,
							value: testCase.projected,
						},
					];
				});

				const result = await service.executeClimateIntent(mockSpaceId, {
					type: ClimateIntentType.SETPOINT_SET,
					...testCase.intent,
				});

				expect(result).toMatchObject({ success: true, ...testCase.expectedResult });
				expect(intentTimeseriesService.storeClimateModeChange).toHaveBeenCalledWith(
					mockSpaceId,
					ClimateMode.AUTO,
					testCase.projected,
					testCase.projected,
					1,
					1,
					0,
				);
			});

			it.each([
				{
					label: 'heating-only',
					intent: { heatingSetpoint: 22.5 },
					projected: 23,
					supportsHeating: true,
					supportsCooling: false,
					expectedHeating: 23,
					expectedCooling: 25,
				},
				{
					label: 'cooling-only',
					intent: { coolingSetpoint: 23.5 },
					projected: 24,
					supportsHeating: false,
					supportsCooling: true,
					expectedHeating: 21,
					expectedCooling: 24,
				},
			])('does not persist a role-disabled sibling after a $label update', async (testCase) => {
				const heaterChannel = Object.assign(new ChannelEntity(), { id: uuid() });
				const coolerChannel = Object.assign(new ChannelEntity(), { id: uuid() });
				const heaterSetpointProperty = Object.assign(new ChannelPropertyEntity(), { id: uuid() });
				const coolerSetpointProperty = Object.assign(new ChannelPropertyEntity(), { id: uuid() });
				const device = createMockPrimaryClimateDevice({
					deviceCategory: DeviceCategory.THERMOSTAT,
					heaterChannel,
					coolerChannel,
					coolerOnProperty: { id: uuid() } as any,
					coolerSetpointProperty,
					heaterSetpointProperty,
					supportsHeating: testCase.supportsHeating,
					supportsCooling: testCase.supportsCooling,
				});
				climateStateService.getClimateState.mockResolvedValue(
					createMockClimateState({
						mode: ClimateMode.AUTO,
						heatingSetpoint: 21,
						coolingSetpoint: 25,
						supportsCooling: true,
					}),
				);
				climateStateService.getPrimaryClimateDevicesInSpace.mockResolvedValue([device]);
				mockPlatform.prepareBatch.mockImplementation((updates: IDevicePropertyData[]) => {
					const update = updates[0];

					return [
						{ ...update, value: testCase.projected },
						{
							device: update.device,
							channel: update.property.id === heaterSetpointProperty.id ? coolerChannel : heaterChannel,
							property:
								update.property.id === heaterSetpointProperty.id ? coolerSetpointProperty : heaterSetpointProperty,
							value: testCase.projected,
						},
					];
				});

				await service.executeClimateIntent(mockSpaceId, {
					type: ClimateIntentType.SETPOINT_SET,
					...testCase.intent,
				});

				expect(intentTimeseriesService.storeClimateModeChange).toHaveBeenCalledWith(
					mockSpaceId,
					ClimateMode.AUTO,
					testCase.expectedHeating,
					testCase.expectedCooling,
					1,
					1,
					0,
				);
			});

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
