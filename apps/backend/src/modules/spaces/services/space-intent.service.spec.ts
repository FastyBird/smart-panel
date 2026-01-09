/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unnecessary-type-assertion
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../devices/platforms/device.platform';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceEntity } from '../entities/space.entity';
import {
	BRIGHTNESS_DELTA_STEPS,
	BrightnessDelta,
	ClimateIntentType,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	LIGHTING_MODE_BRIGHTNESS,
	LIGHTING_MODE_ORCHESTRATION,
	LightingIntentType,
	LightingMode,
	LightingRole,
	SETPOINT_DELTA_STEPS,
	SetpointDelta,
} from '../spaces.constants';

import { SpaceClimateRoleService } from './space-climate-role.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { SpaceIntentService, selectLightsForMode } from './space-intent.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

describe('SpaceIntentService', () => {
	let service: SpaceIntentService;
	let mockSpacesService: jest.Mocked<SpacesService>;
	let mockDevicesService: jest.Mocked<DevicesService>;
	let mockPlatformRegistryService: jest.Mocked<PlatformRegistryService>;
	let mockLightingRoleService: jest.Mocked<SpaceLightingRoleService>;
	let mockClimateRoleService: jest.Mocked<SpaceClimateRoleService>;
	let mockContextSnapshotService: jest.Mocked<SpaceContextSnapshotService>;
	let mockUndoHistoryService: jest.Mocked<SpaceUndoHistoryService>;
	let mockPlatform: jest.Mocked<IDevicePlatform>;

	const mockSpaceId = 'space-123';
	const mockSpace: SpaceEntity = {
		id: mockSpaceId,
		name: 'Living Room',
	} as SpaceEntity;

	beforeEach(() => {
		mockPlatform = {
			getType: jest.fn().mockReturnValue('mock-platform'),
			process: jest.fn().mockResolvedValue(true),
			processBatch: jest.fn().mockResolvedValue(true),
		};

		mockSpacesService = {
			findOne: jest.fn(),
			findDevicesBySpace: jest.fn(),
		} as unknown as jest.Mocked<SpacesService>;

		mockDevicesService = {} as jest.Mocked<DevicesService>;

		mockPlatformRegistryService = {
			get: jest.fn().mockReturnValue(mockPlatform),
		} as unknown as jest.Mocked<PlatformRegistryService>;

		// Default: no roles configured (empty map)
		mockLightingRoleService = {
			getRoleMap: jest.fn().mockResolvedValue(new Map<string, SpaceLightingRoleEntity>()),
		} as unknown as jest.Mocked<SpaceLightingRoleService>;

		mockClimateRoleService = {
			getRoleMap: jest.fn().mockResolvedValue(new Map()),
		} as unknown as jest.Mocked<SpaceClimateRoleService>;

		mockContextSnapshotService = {
			captureSnapshot: jest.fn().mockResolvedValue({
				spaceId: mockSpaceId,
				spaceName: 'Test Space',
				lighting: { summary: { totalLights: 0, lightsOn: 0, averageBrightness: null }, lights: [] },
				climate: { hasClimate: false },
				capturedAt: new Date(),
			}),
		} as unknown as jest.Mocked<SpaceContextSnapshotService>;

		mockUndoHistoryService = {
			pushSnapshot: jest.fn().mockReturnValue({
				id: 'undo-123',
				spaceId: mockSpaceId,
				capturedAt: new Date(),
				snapshot: {},
				actionDescription: 'Test action',
				intentCategory: 'lighting',
			}),
		} as unknown as jest.Mocked<SpaceUndoHistoryService>;

		service = new SpaceIntentService(
			mockSpacesService,
			mockDevicesService,
			mockPlatformRegistryService,
			mockLightingRoleService,
			mockClimateRoleService,
			mockContextSnapshotService,
			mockUndoHistoryService,
		);

		// Extend mock to include custom logger methods
		const mockLogger = {
			info: jest.fn(),
		};
		jest.spyOn(console, 'info').mockImplementation(mockLogger.info);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	const createMockLight = (deviceId: string, hasBrightness: boolean, currentBrightness: number = 50): DeviceEntity => {
		const onProperty: ChannelPropertyEntity = {
			id: `${deviceId}-on-prop`,
			category: PropertyCategory.ON,
			value: true,
		} as ChannelPropertyEntity;

		const properties: ChannelPropertyEntity[] = [onProperty];

		if (hasBrightness) {
			const brightnessProperty: ChannelPropertyEntity = {
				id: `${deviceId}-brightness-prop`,
				category: PropertyCategory.BRIGHTNESS,
				value: currentBrightness,
			} as ChannelPropertyEntity;

			properties.push(brightnessProperty);
		}

		const lightChannel: ChannelEntity = {
			id: `${deviceId}-light-channel`,
			category: ChannelCategory.LIGHT,
			properties,
		} as ChannelEntity;

		return {
			id: deviceId,
			type: 'mock-platform',
			category: DeviceCategory.LIGHTING,
			channels: [lightChannel],
		} as DeviceEntity;
	};

	const createNonLightDevice = (deviceId: string): DeviceEntity => {
		return {
			id: deviceId,
			type: 'mock-platform',
			category: DeviceCategory.GENERIC,
			channels: [],
		} as DeviceEntity;
	};

	describe('executeLightingIntent', () => {
		describe('when space does not exist', () => {
			it('should return failure result', async () => {
				mockSpacesService.findOne.mockResolvedValue(null);

				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: false, affectedDevices: 0, failedDevices: 0 });
				expect(mockSpacesService.findDevicesBySpace).not.toHaveBeenCalled();
			});
		});

		describe('when space has no lights', () => {
			it('should return success with zero affected devices', async () => {
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([]);

				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 0, failedDevices: 0 });
			});

			it('should return success when space has only non-lighting devices', async () => {
				const genericDevice = createNonLightDevice('device-1');
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([genericDevice]);

				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 0, failedDevices: 0 });
				expect(mockPlatform.processBatch).not.toHaveBeenCalled();
			});
		});

		describe('with on/off only lights (no brightness control)', () => {
			let onOffLight: DeviceEntity;

			beforeEach(() => {
				onOffLight = createMockLight('light-1', false);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([onOffLight]);
			});

			it('should turn light OFF', async () => {
				const intent: LightingIntentDto = { type: LightingIntentType.OFF };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });
				expect(mockPlatform.processBatch).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							device: onOffLight,
							property: expect.objectContaining({ category: PropertyCategory.ON }),
							value: false,
						}),
					]),
				);
			});

			it('should turn light ON', async () => {
				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });
				expect(mockPlatform.processBatch).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							device: onOffLight,
							property: expect.objectContaining({ category: PropertyCategory.ON }),
							value: true,
						}),
					]),
				);
			});

			it('should turn on and ignore brightness for SET_MODE intent', async () => {
				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.WORK };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });
				expect(mockPlatform.processBatch).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							property: expect.objectContaining({ category: PropertyCategory.ON }),
							value: true,
						}),
					]),
				);
				// Should only have one command (ON), not brightness
				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];
				expect(calls).toHaveLength(1);
			});

			it('should do nothing for BRIGHTNESS_DELTA intent', async () => {
				const intent: LightingIntentDto = {
					type: LightingIntentType.BRIGHTNESS_DELTA,
					delta: BrightnessDelta.MEDIUM,
					increase: true,
				};
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });
				// No commands because light doesn't support brightness
				expect(mockPlatform.processBatch).not.toHaveBeenCalled();
			});
		});

		describe('with dimmable lights (brightness control)', () => {
			let dimmableLight: DeviceEntity;

			beforeEach(() => {
				dimmableLight = createMockLight('light-2', true, 50);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([dimmableLight]);
			});

			it('should turn light OFF', async () => {
				const intent: LightingIntentDto = { type: LightingIntentType.OFF };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });
				expect(mockPlatform.processBatch).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							property: expect.objectContaining({ category: PropertyCategory.ON }),
							value: false,
						}),
					]),
				);
			});

			it('should set WORK mode (100% brightness)', async () => {
				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.WORK };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];

				expect(calls).toHaveLength(2);
				expect(calls).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							property: expect.objectContaining({ category: PropertyCategory.ON }),
							value: true,
						}),
						expect.objectContaining({
							property: expect.objectContaining({ category: PropertyCategory.BRIGHTNESS }),
							value: LIGHTING_MODE_BRIGHTNESS[LightingMode.WORK],
						}),
					]),
				);
			});

			it('should set RELAX mode (50% brightness)', async () => {
				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.RELAX };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];
				const brightnessCmd = calls.find(
					(c) => c.property.category === PropertyCategory.BRIGHTNESS,
				) as IDevicePropertyData;

				expect(brightnessCmd.value).toBe(LIGHTING_MODE_BRIGHTNESS[LightingMode.RELAX]);
			});

			it('should set NIGHT mode (20% brightness)', async () => {
				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.NIGHT };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];
				const brightnessCmd = calls.find(
					(c) => c.property.category === PropertyCategory.BRIGHTNESS,
				) as IDevicePropertyData;

				expect(brightnessCmd.value).toBe(LIGHTING_MODE_BRIGHTNESS[LightingMode.NIGHT]);
			});

			it('should increase brightness by SMALL delta (10%)', async () => {
				const intent: LightingIntentDto = {
					type: LightingIntentType.BRIGHTNESS_DELTA,
					delta: BrightnessDelta.SMALL,
					increase: true,
				};
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];

				expect(calls).toHaveLength(1);
				expect(calls[0].value).toBe(50 + BRIGHTNESS_DELTA_STEPS[BrightnessDelta.SMALL]);
			});

			it('should decrease brightness by MEDIUM delta (25%)', async () => {
				const intent: LightingIntentDto = {
					type: LightingIntentType.BRIGHTNESS_DELTA,
					delta: BrightnessDelta.MEDIUM,
					increase: false,
				};
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];

				expect(calls[0].value).toBe(50 - BRIGHTNESS_DELTA_STEPS[BrightnessDelta.MEDIUM]);
			});

			it('should clamp brightness to 100 when increasing', async () => {
				const brightLight = createMockLight('light-bright', true, 90);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([brightLight]);

				const intent: LightingIntentDto = {
					type: LightingIntentType.BRIGHTNESS_DELTA,
					delta: BrightnessDelta.LARGE, // +50
					increase: true,
				};
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];

				expect(calls[0].value).toBe(100); // Clamped to max
			});

			it('should clamp brightness to 0 when decreasing', async () => {
				const dimLight = createMockLight('light-dim', true, 10);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([dimLight]);

				const intent: LightingIntentDto = {
					type: LightingIntentType.BRIGHTNESS_DELTA,
					delta: BrightnessDelta.LARGE, // -50
					increase: false,
				};
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];

				expect(calls[0].value).toBe(0); // Clamped to min
			});
		});

		describe('with multiple lights', () => {
			it('should control all lights in the space', async () => {
				const light1 = createMockLight('light-1', false);
				const light2 = createMockLight('light-2', true);
				const light3 = createMockLight('light-3', true, 80);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light1, light2, light3]);

				const intent: LightingIntentDto = { type: LightingIntentType.OFF };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 3, failedDevices: 0 });
				expect(mockPlatform.processBatch).toHaveBeenCalledTimes(3);
			});

			it('should count partial failures correctly', async () => {
				const light1 = createMockLight('light-1', false);
				const light2 = createMockLight('light-2', false);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light1, light2]);

				// First call succeeds, second fails
				mockPlatform.processBatch.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 1 });
			});

			it('should return overall success when at least one light succeeds', async () => {
				const light1 = createMockLight('light-1', false);
				const light2 = createMockLight('light-2', false);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light1, light2]);

				mockPlatform.processBatch.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
			});
		});

		describe('error handling', () => {
			it('should handle platform not found', async () => {
				const light = createMockLight('light-1', false);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light]);
				mockPlatformRegistryService.get.mockReturnValue(null);

				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: false, affectedDevices: 0, failedDevices: 1 });
			});

			it('should handle platform execution error', async () => {
				const light = createMockLight('light-1', false);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light]);
				mockPlatform.processBatch.mockRejectedValue(new Error('Platform error'));

				const intent: LightingIntentDto = { type: LightingIntentType.ON };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: false, affectedDevices: 0, failedDevices: 1 });
			});

			it('should return failure for SET_MODE without mode parameter', async () => {
				const light = createMockLight('light-1', true);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light]);

				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE } as LightingIntentDto;
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: false, affectedDevices: 0, failedDevices: 1 });
			});

			it('should return failure for BRIGHTNESS_DELTA without delta parameter', async () => {
				const light = createMockLight('light-1', true);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light]);

				const intent: LightingIntentDto = { type: LightingIntentType.BRIGHTNESS_DELTA } as LightingIntentDto;
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: false, affectedDevices: 0, failedDevices: 1 });
			});
		});

		describe('brightness value parsing', () => {
			it('should handle string brightness value', async () => {
				const light = createMockLight('light-1', true, 0);
				// Override with string value
				const channel = light.channels![0];
				const brightnessProp = channel.properties!.find((p) => p.category === PropertyCategory.BRIGHTNESS);

				if (brightnessProp) {
					(brightnessProp as { value: unknown }).value = '75';
				}

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light]);

				const intent: LightingIntentDto = {
					type: LightingIntentType.BRIGHTNESS_DELTA,
					delta: BrightnessDelta.SMALL,
					increase: true,
				};
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];

				expect(calls[0].value).toBe(75 + BRIGHTNESS_DELTA_STEPS[BrightnessDelta.SMALL]);
			});

			it('should use default brightness when value is undefined', async () => {
				const light = createMockLight('light-1', true, 0);
				const channel = light.channels![0];
				const brightnessProp = channel.properties!.find((p) => p.category === PropertyCategory.BRIGHTNESS);

				if (brightnessProp) {
					(brightnessProp as { value: unknown }).value = undefined;
				}

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light]);

				const intent: LightingIntentDto = {
					type: LightingIntentType.BRIGHTNESS_DELTA,
					delta: BrightnessDelta.SMALL,
					increase: true,
				};
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result).toEqual({ success: true, affectedDevices: 1, failedDevices: 0 });

				const calls = mockPlatform.processBatch.mock.calls[0][0] as IDevicePropertyData[];
				// Default is 50, +10 = 60
				expect(calls[0].value).toBe(50 + BRIGHTNESS_DELTA_STEPS[BrightnessDelta.SMALL]);
			});
		});
	});

	// =====================
	// Climate Intent Tests
	// =====================

	const createMockThermostat = (
		deviceId: string,
		name: string,
		currentTemp: number,
		setpoint: number | null,
		format?: [number, number],
	): DeviceEntity => {
		// Temperature reading property (from TEMPERATURE channel)
		const temperatureProperty = {
			id: `${deviceId}-temp-prop`,
			category: PropertyCategory.TEMPERATURE,
			value: currentTemp,
		} as ChannelPropertyEntity;

		// Heater channel with setpoint property
		const heaterProperties: ChannelPropertyEntity[] = [];

		if (setpoint !== null) {
			const setpointProperty = {
				id: `${deviceId}-setpoint-prop`,
				category: PropertyCategory.TEMPERATURE,
				value: setpoint,
				format: format as unknown,
			} as ChannelPropertyEntity;

			heaterProperties.push(setpointProperty);
		}

		const temperatureChannel = {
			id: `${deviceId}-temp-channel`,
			category: ChannelCategory.TEMPERATURE,
			properties: [temperatureProperty],
		} as ChannelEntity;

		const heaterChannel = {
			id: `${deviceId}-heater-channel`,
			category: ChannelCategory.HEATER,
			properties: heaterProperties,
		} as ChannelEntity;

		return {
			id: deviceId,
			name,
			type: 'mock-platform',
			category: DeviceCategory.THERMOSTAT,
			channels: [temperatureChannel, heaterChannel],
		} as DeviceEntity;
	};

	const createMockSensor = (deviceId: string, name: string, currentTemp: number): DeviceEntity => {
		const temperatureProperty: ChannelPropertyEntity = {
			id: `${deviceId}-temp-prop`,
			category: PropertyCategory.TEMPERATURE,
			value: currentTemp,
		} as ChannelPropertyEntity;

		const temperatureChannel: ChannelEntity = {
			id: `${deviceId}-temp-channel`,
			category: ChannelCategory.TEMPERATURE,
			properties: [temperatureProperty],
		} as ChannelEntity;

		return {
			id: deviceId,
			name,
			type: 'mock-platform',
			category: DeviceCategory.SENSOR,
			channels: [temperatureChannel],
		} as DeviceEntity;
	};

	describe('getClimateState', () => {
		describe('when space does not exist', () => {
			it('should return default state with hasClimate=false', async () => {
				mockSpacesService.findOne.mockResolvedValue(null);

				const result = await service.getClimateState(mockSpaceId);

				expect(result).toEqual({
					hasClimate: false,
					currentTemperature: null,
					targetTemperature: null,
					minSetpoint: DEFAULT_MIN_SETPOINT,
					maxSetpoint: DEFAULT_MAX_SETPOINT,
					canSetSetpoint: false,
				});
			});
		});

		describe('when space has no climate devices', () => {
			it('should return hasClimate=false', async () => {
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([]);

				const result = await service.getClimateState(mockSpaceId);

				expect(result.hasClimate).toBe(false);
				expect(result.canSetSetpoint).toBe(false);
			});

			it('should return hasClimate=false for non-climate devices', async () => {
				const genericDevice = createNonLightDevice('device-1');
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([genericDevice]);

				const result = await service.getClimateState(mockSpaceId);

				expect(result.hasClimate).toBe(false);
			});
		});

		describe('space with sensor only (read-only)', () => {
			it('should return current temperature but no setpoint capability', async () => {
				const sensor = createMockSensor('sensor-1', 'Living Room Sensor', 22.5);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([sensor]);

				const result = await service.getClimateState(mockSpaceId);

				expect(result).toEqual({
					hasClimate: true,
					currentTemperature: 22.5,
					targetTemperature: null,
					minSetpoint: DEFAULT_MIN_SETPOINT,
					maxSetpoint: DEFAULT_MAX_SETPOINT,
					canSetSetpoint: false,
				});
			});

			it('should select first sensor deterministically by name', async () => {
				const sensorA = createMockSensor('sensor-a', 'Bedroom Sensor', 20.0);
				const sensorB = createMockSensor('sensor-b', 'Attic Sensor', 25.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([sensorA, sensorB]);

				const result = await service.getClimateState(mockSpaceId);

				// 'Attic Sensor' comes before 'Bedroom Sensor' alphabetically
				expect(result.currentTemperature).toBe(25.0);
			});
		});

		describe('space with thermostat only', () => {
			it('should return both current and target temperature with setpoint capability', async () => {
				const thermostat = createMockThermostat('thermo-1', 'Living Room Thermostat', 21.0, 22.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat]);

				const result = await service.getClimateState(mockSpaceId);

				expect(result).toEqual({
					hasClimate: true,
					currentTemperature: 21.0,
					targetTemperature: 22.0,
					minSetpoint: DEFAULT_MIN_SETPOINT,
					maxSetpoint: DEFAULT_MAX_SETPOINT,
					canSetSetpoint: true,
				});
			});

			it('should use property format for min/max setpoint', async () => {
				const thermostat = createMockThermostat('thermo-1', 'Thermostat', 21.0, 22.0, [10, 30]);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat]);

				const result = await service.getClimateState(mockSpaceId);

				expect(result.minSetpoint).toBe(10);
				expect(result.maxSetpoint).toBe(30);
			});
		});

		describe('space with both sensor and thermostat', () => {
			it('should prefer thermostat temperature over separate sensor by default', async () => {
				const thermostat = createMockThermostat('thermo-1', 'Thermostat', 21.0, 22.0);
				const sensor = createMockSensor('sensor-1', 'Sensor', 23.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat, sensor]);

				const result = await service.getClimateState(mockSpaceId);

				// Should use thermostat's temperature reading
				expect(result.currentTemperature).toBe(21.0);
			});
		});

		describe('multiple thermostats selection', () => {
			it('should select first thermostat deterministically by name', async () => {
				const thermoA = createMockThermostat('thermo-a', 'Zone B Thermostat', 20.0, 21.0);
				const thermoB = createMockThermostat('thermo-b', 'Zone A Thermostat', 22.0, 23.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermoA, thermoB]);

				const result = await service.getClimateState(mockSpaceId);

				// 'Zone A Thermostat' comes before 'Zone B Thermostat' alphabetically
				expect(result.targetTemperature).toBe(23.0);
			});
		});
	});

	describe('executeClimateIntent', () => {
		beforeEach(() => {
			mockDevicesService.getOneOrThrow = jest.fn();
		});

		describe('when space does not exist', () => {
			it('should return failure result', async () => {
				mockSpacesService.findOne.mockResolvedValue(null);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).toEqual({
					success: false,
					affectedDevices: 0,
					failedDevices: 0,
					newSetpoint: null,
				});
				expect(mockSpacesService.findDevicesBySpace).not.toHaveBeenCalled();
			});
		});

		describe('when space has no climate devices', () => {
			it('should return success with zero affected devices', async () => {
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([]);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).toEqual({
					success: true,
					affectedDevices: 0,
					failedDevices: 0,
					newSetpoint: null,
				});
			});
		});

		describe('setpoint delta intents', () => {
			let thermostat: DeviceEntity;

			beforeEach(() => {
				thermostat = createMockThermostat('thermo-1', 'Thermostat', 20.0, 21.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat]);
				(mockDevicesService.getOneOrThrow as jest.Mock).mockResolvedValue(thermostat);
			});

			it('should increase setpoint by SMALL delta (0.5°C)', async () => {
				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.newSetpoint).toBe(21.0 + SETPOINT_DELTA_STEPS[SetpointDelta.SMALL]);
				expect(mockPlatform.processBatch).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							value: 21.5,
						}),
					]),
				);
			});

			it('should decrease setpoint by MEDIUM delta (1.0°C)', async () => {
				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.MEDIUM,
					increase: false,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.newSetpoint).toBe(21.0 - SETPOINT_DELTA_STEPS[SetpointDelta.MEDIUM]);
			});

			it('should clamp setpoint to max value', async () => {
				const hotThermostat = createMockThermostat('thermo-1', 'Thermostat', 30.0, 34.0, [5, 35]);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([hotThermostat]);
				(mockDevicesService.getOneOrThrow as jest.Mock).mockResolvedValue(hotThermostat);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.LARGE,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.newSetpoint).toBe(35); // Clamped to max
			});

			it('should clamp setpoint to min value', async () => {
				const coldThermostat = createMockThermostat('thermo-1', 'Thermostat', 10.0, 6.0, [5, 35]);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([coldThermostat]);
				(mockDevicesService.getOneOrThrow as jest.Mock).mockResolvedValue(coldThermostat);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.LARGE,
					increase: false,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.newSetpoint).toBe(5); // Clamped to min
			});

			it('should round setpoint to 0.5 degree precision', async () => {
				// Create thermostat with setpoint that when modified gives a non-.5 value
				const thermostatWith22 = createMockThermostat('thermo-1', 'Thermostat', 20.0, 22.3);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostatWith22]);
				(mockDevicesService.getOneOrThrow as jest.Mock).mockResolvedValue(thermostatWith22);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL, // +0.5
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				// 22.3 + 0.5 = 22.8, rounded to 23.0
				expect(result.newSetpoint).toBe(23.0);
			});
		});

		describe('setpoint set intents', () => {
			let thermostat: DeviceEntity;

			beforeEach(() => {
				thermostat = createMockThermostat('thermo-1', 'Thermostat', 20.0, 21.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat]);
				(mockDevicesService.getOneOrThrow as jest.Mock).mockResolvedValue(thermostat);
			});

			it('should set exact setpoint value', async () => {
				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_SET,
					value: 23.0,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.newSetpoint).toBe(23.0);
				expect(mockPlatform.processBatch).toHaveBeenCalledWith(
					expect.arrayContaining([
						expect.objectContaining({
							value: 23.0,
						}),
					]),
				);
			});

			it('should clamp set value to min/max', async () => {
				const thermostatWithLimits = createMockThermostat('thermo-1', 'Thermostat', 20.0, 21.0, [15, 25]);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostatWithLimits]);
				(mockDevicesService.getOneOrThrow as jest.Mock).mockResolvedValue(thermostatWithLimits);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_SET,
					value: 30.0, // Above max
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.newSetpoint).toBe(25.0); // Clamped to max
			});
		});

		describe('error handling', () => {
			let thermostat: DeviceEntity;

			beforeEach(() => {
				thermostat = createMockThermostat('thermo-1', 'Thermostat', 20.0, 21.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat]);
				(mockDevicesService.getOneOrThrow as jest.Mock).mockResolvedValue(thermostat);
			});

			it('should handle platform not found', async () => {
				mockPlatformRegistryService.get.mockReturnValue(null);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).toEqual({
					success: false,
					affectedDevices: 0,
					failedDevices: 0,
					newSetpoint: null,
				});
			});

			it('should handle platform execution failure', async () => {
				mockPlatform.processBatch.mockResolvedValue(false);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).toEqual({
					success: false,
					affectedDevices: 0,
					failedDevices: 1,
					newSetpoint: null,
				});
			});

			it('should handle platform execution error', async () => {
				mockPlatform.processBatch.mockRejectedValue(new Error('Platform error'));

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).toEqual({
					success: false,
					affectedDevices: 0,
					failedDevices: 1,
					newSetpoint: null,
				});
			});

			it('should return failure for SETPOINT_DELTA without delta parameter', async () => {
				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					increase: true,
				} as ClimateIntentDto;
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(false);
			});

			it('should return failure for SETPOINT_SET without value parameter', async () => {
				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_SET,
				} as ClimateIntentDto;
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result.success).toBe(false);
			});
		});

		describe('sensor-only space', () => {
			it('should return success but not set setpoint (read-only)', async () => {
				const sensor = createMockSensor('sensor-1', 'Temperature Sensor', 22.5);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([sensor]);

				const intent: ClimateIntentDto = {
					type: ClimateIntentType.SETPOINT_DELTA,
					delta: SetpointDelta.SMALL,
					increase: true,
				};
				const result = await service.executeClimateIntent(mockSpaceId, intent);

				expect(result).toEqual({
					success: true,
					affectedDevices: 0,
					failedDevices: 0,
					newSetpoint: null,
				});
				expect(mockPlatform.processBatch).not.toHaveBeenCalled();
			});
		});
	});

	// =====================
	// Role-Based Orchestration Tests
	// =====================

	describe('selectLightsForMode (pure function)', () => {
		// Helper to create mock light device structure for pure function testing
		interface MockLightInput {
			deviceId: string;
			hasBrightness: boolean;
			role: LightingRole | null;
		}

		const createMockLightDeviceForSelection = (input: MockLightInput) => {
			const onProperty = {
				id: `${input.deviceId}-on-prop`,
				category: PropertyCategory.ON,
				value: true,
			} as ChannelPropertyEntity;

			const brightnessProperty = input.hasBrightness
				? ({
						id: `${input.deviceId}-brightness-prop`,
						category: PropertyCategory.BRIGHTNESS,
						value: 50,
					} as ChannelPropertyEntity)
				: null;

			const lightChannel = {
				id: `${input.deviceId}-channel`,
				category: ChannelCategory.LIGHT,
				properties: input.hasBrightness ? [onProperty, brightnessProperty] : [onProperty],
			} as ChannelEntity;

			const device = {
				id: input.deviceId,
				name: input.deviceId,
				type: 'mock-platform',
				category: DeviceCategory.LIGHTING,
				channels: [lightChannel],
			} as DeviceEntity;

			return {
				device,
				lightChannel,
				onProperty,
				brightnessProperty,
				role: input.role,
			};
		};

		describe('no roles configured (MVP fallback)', () => {
			it('should turn all lights ON with mode brightness for WORK', () => {
				const lights = [
					createMockLightDeviceForSelection({ deviceId: 'light-1', hasBrightness: true, role: null }),
					createMockLightDeviceForSelection({ deviceId: 'light-2', hasBrightness: true, role: null }),
				];

				const selections = selectLightsForMode(lights, LightingMode.WORK);

				expect(selections).toHaveLength(2);
				expect(selections.every((s) => s.rule.on === true)).toBe(true);
				expect(selections.every((s) => s.rule.brightness === LIGHTING_MODE_BRIGHTNESS[LightingMode.WORK])).toBe(true);
				expect(selections.every((s) => s.isFallback === true)).toBe(true);
			});

			it('should turn all lights ON with mode brightness for RELAX', () => {
				const lights = [createMockLightDeviceForSelection({ deviceId: 'light-1', hasBrightness: true, role: null })];

				const selections = selectLightsForMode(lights, LightingMode.RELAX);

				expect(selections).toHaveLength(1);
				expect(selections[0].rule.on).toBe(true);
				expect(selections[0].rule.brightness).toBe(LIGHTING_MODE_BRIGHTNESS[LightingMode.RELAX]);
				expect(selections[0].isFallback).toBe(true);
			});

			it('should turn all lights ON with mode brightness for NIGHT', () => {
				const lights = [createMockLightDeviceForSelection({ deviceId: 'light-1', hasBrightness: true, role: null })];

				const selections = selectLightsForMode(lights, LightingMode.NIGHT);

				expect(selections).toHaveLength(1);
				expect(selections[0].rule.on).toBe(true);
				expect(selections[0].rule.brightness).toBe(LIGHTING_MODE_BRIGHTNESS[LightingMode.NIGHT]);
				expect(selections[0].isFallback).toBe(true);
			});
		});

		describe('full role configuration', () => {
			it('WORK mode: main/task ON high, ambient/accent OFF', () => {
				const lights = [
					createMockLightDeviceForSelection({ deviceId: 'main-light', hasBrightness: true, role: LightingRole.MAIN }),
					createMockLightDeviceForSelection({ deviceId: 'task-light', hasBrightness: true, role: LightingRole.TASK }),
					createMockLightDeviceForSelection({
						deviceId: 'ambient-light',
						hasBrightness: true,
						role: LightingRole.AMBIENT,
					}),
					createMockLightDeviceForSelection({
						deviceId: 'accent-light',
						hasBrightness: true,
						role: LightingRole.ACCENT,
					}),
				];

				const selections = selectLightsForMode(lights, LightingMode.WORK);

				const mainSelection = selections.find((s) => s.light.device.id === 'main-light')!;
				const taskSelection = selections.find((s) => s.light.device.id === 'task-light')!;
				const ambientSelection = selections.find((s) => s.light.device.id === 'ambient-light')!;
				const accentSelection = selections.find((s) => s.light.device.id === 'accent-light')!;

				expect(mainSelection.rule.on).toBe(true);
				expect(mainSelection.rule.brightness).toBe(100);
				expect(taskSelection.rule.on).toBe(true);
				expect(taskSelection.rule.brightness).toBe(100);
				expect(ambientSelection.rule.on).toBe(false);
				expect(accentSelection.rule.on).toBe(false);
			});

			it('RELAX mode: main/ambient ON medium, task OFF', () => {
				const lights = [
					createMockLightDeviceForSelection({ deviceId: 'main-light', hasBrightness: true, role: LightingRole.MAIN }),
					createMockLightDeviceForSelection({ deviceId: 'task-light', hasBrightness: true, role: LightingRole.TASK }),
					createMockLightDeviceForSelection({
						deviceId: 'ambient-light',
						hasBrightness: true,
						role: LightingRole.AMBIENT,
					}),
				];

				const selections = selectLightsForMode(lights, LightingMode.RELAX);

				const mainSelection = selections.find((s) => s.light.device.id === 'main-light')!;
				const taskSelection = selections.find((s) => s.light.device.id === 'task-light')!;
				const ambientSelection = selections.find((s) => s.light.device.id === 'ambient-light')!;

				expect(mainSelection.rule.on).toBe(true);
				expect(mainSelection.rule.brightness).toBe(50);
				expect(taskSelection.rule.on).toBe(false);
				expect(ambientSelection.rule.on).toBe(true);
				expect(ambientSelection.rule.brightness).toBe(50);
			});

			it('NIGHT mode: night lights ON low, others OFF', () => {
				const lights = [
					createMockLightDeviceForSelection({ deviceId: 'main-light', hasBrightness: true, role: LightingRole.MAIN }),
					createMockLightDeviceForSelection({
						deviceId: 'night-light',
						hasBrightness: true,
						role: LightingRole.NIGHT,
					}),
					createMockLightDeviceForSelection({
						deviceId: 'ambient-light',
						hasBrightness: true,
						role: LightingRole.AMBIENT,
					}),
				];

				const selections = selectLightsForMode(lights, LightingMode.NIGHT);

				const mainSelection = selections.find((s) => s.light.device.id === 'main-light')!;
				const nightSelection = selections.find((s) => s.light.device.id === 'night-light')!;
				const ambientSelection = selections.find((s) => s.light.device.id === 'ambient-light')!;

				expect(mainSelection.rule.on).toBe(false);
				expect(nightSelection.rule.on).toBe(true);
				expect(nightSelection.rule.brightness).toBe(20);
				expect(ambientSelection.rule.on).toBe(false);
			});

			it('NIGHT mode fallback: uses main at low brightness when no night lights exist', () => {
				const lights = [
					createMockLightDeviceForSelection({ deviceId: 'main-light', hasBrightness: true, role: LightingRole.MAIN }),
					createMockLightDeviceForSelection({ deviceId: 'task-light', hasBrightness: true, role: LightingRole.TASK }),
					createMockLightDeviceForSelection({
						deviceId: 'ambient-light',
						hasBrightness: true,
						role: LightingRole.AMBIENT,
					}),
				];

				const selections = selectLightsForMode(lights, LightingMode.NIGHT);

				const mainSelection = selections.find((s) => s.light.device.id === 'main-light')!;
				const taskSelection = selections.find((s) => s.light.device.id === 'task-light')!;
				const ambientSelection = selections.find((s) => s.light.device.id === 'ambient-light')!;

				// Main light should be ON at fallback brightness
				expect(mainSelection.rule.on).toBe(true);
				expect(mainSelection.rule.brightness).toBe(LIGHTING_MODE_ORCHESTRATION[LightingMode.NIGHT].fallbackBrightness);
				expect(mainSelection.isFallback).toBe(true);

				// Others should be OFF
				expect(taskSelection.rule.on).toBe(false);
				expect(ambientSelection.rule.on).toBe(false);
			});
		});

		describe('partial role configuration', () => {
			it('should treat unassigned lights as OTHER role', () => {
				const lights = [
					createMockLightDeviceForSelection({ deviceId: 'main-light', hasBrightness: true, role: LightingRole.MAIN }),
					createMockLightDeviceForSelection({ deviceId: 'unassigned-light', hasBrightness: true, role: null }),
				];

				// In WORK mode, OTHER lights are OFF
				const workSelections = selectLightsForMode(lights, LightingMode.WORK);
				const unassignedWork = workSelections.find((s) => s.light.device.id === 'unassigned-light')!;

				expect(unassignedWork.rule.on).toBe(false);

				// In RELAX mode, OTHER lights are ON at 50%
				const relaxSelections = selectLightsForMode(lights, LightingMode.RELAX);
				const unassignedRelax = relaxSelections.find((s) => s.light.device.id === 'unassigned-light')!;

				expect(unassignedRelax.rule.on).toBe(true);
				expect(unassignedRelax.rule.brightness).toBe(50);
			});

			it('should apply roles to configured lights while treating others as OTHER', () => {
				const lights = [
					createMockLightDeviceForSelection({ deviceId: 'main-light', hasBrightness: true, role: LightingRole.MAIN }),
					createMockLightDeviceForSelection({ deviceId: 'unknown-light', hasBrightness: true, role: null }),
				];

				const selections = selectLightsForMode(lights, LightingMode.WORK);

				const mainSelection = selections.find((s) => s.light.device.id === 'main-light')!;
				const unknownSelection = selections.find((s) => s.light.device.id === 'unknown-light')!;

				expect(mainSelection.rule.on).toBe(true);
				expect(mainSelection.rule.brightness).toBe(100);
				expect(unknownSelection.rule.on).toBe(false); // OTHER is OFF in WORK mode
			});
		});
	});

	describe('role-based mode execution (integration)', () => {
		const createMockLightWithRole = (
			deviceId: string,
			hasBrightness: boolean,
			currentBrightness: number = 50,
		): DeviceEntity => {
			const onProperty: ChannelPropertyEntity = {
				id: `${deviceId}-on-prop`,
				category: PropertyCategory.ON,
				value: true,
			} as ChannelPropertyEntity;

			const properties: ChannelPropertyEntity[] = [onProperty];

			if (hasBrightness) {
				const brightnessProperty: ChannelPropertyEntity = {
					id: `${deviceId}-brightness-prop`,
					category: PropertyCategory.BRIGHTNESS,
					value: currentBrightness,
				} as ChannelPropertyEntity;

				properties.push(brightnessProperty);
			}

			const lightChannel: ChannelEntity = {
				id: `${deviceId}-light-channel`,
				category: ChannelCategory.LIGHT,
				properties,
			} as ChannelEntity;

			return {
				id: deviceId,
				name: deviceId,
				type: 'mock-platform',
				category: DeviceCategory.LIGHTING,
				channels: [lightChannel],
			} as DeviceEntity;
		};

		const createRoleMap = (
			roles: Array<{ deviceId: string; channelId: string; role: LightingRole }>,
		): Map<string, SpaceLightingRoleEntity> => {
			const map = new Map<string, SpaceLightingRoleEntity>();

			for (const r of roles) {
				const entity = {
					spaceId: mockSpaceId,
					deviceId: r.deviceId,
					channelId: r.channelId,
					role: r.role,
					priority: 0,
				} as SpaceLightingRoleEntity;

				map.set(`${r.deviceId}:${r.channelId}`, entity);
			}

			return map;
		};

		describe('with full role configuration', () => {
			it('WORK mode should turn on main/task and turn off ambient', async () => {
				const mainLight = createMockLightWithRole('main-light', true);
				const taskLight = createMockLightWithRole('task-light', true);
				const ambientLight = createMockLightWithRole('ambient-light', true);

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([mainLight, taskLight, ambientLight]);

				const roleMap = createRoleMap([
					{ deviceId: 'main-light', channelId: 'main-light-light-channel', role: LightingRole.MAIN },
					{ deviceId: 'task-light', channelId: 'task-light-light-channel', role: LightingRole.TASK },
					{ deviceId: 'ambient-light', channelId: 'ambient-light-light-channel', role: LightingRole.AMBIENT },
				]);
				mockLightingRoleService.getRoleMap.mockResolvedValue(roleMap);

				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.WORK };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.affectedDevices).toBe(3);

				// Find calls for each light
				const calls = mockPlatform.processBatch.mock.calls;

				// Main light should be ON with brightness 100
				const mainCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'main-light');

				expect(mainCall).toBeDefined();

				const mainCommands = mainCall![0] as IDevicePropertyData[];
				const mainOnCmd = mainCommands.find((cmd) => cmd.property.category === PropertyCategory.ON);
				const mainBrightnessCmd = mainCommands.find((cmd) => cmd.property.category === PropertyCategory.BRIGHTNESS);

				expect(mainOnCmd?.value).toBe(true);
				expect(mainBrightnessCmd?.value).toBe(100);

				// Ambient light should be OFF
				const ambientCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'ambient-light');

				expect(ambientCall).toBeDefined();

				const ambientCommands = ambientCall![0] as IDevicePropertyData[];
				const ambientOnCmd = ambientCommands.find((cmd) => cmd.property.category === PropertyCategory.ON);

				expect(ambientOnCmd?.value).toBe(false);
			});

			it('RELAX mode should set different brightness levels per role', async () => {
				const mainLight = createMockLightWithRole('main-light', true);
				const ambientLight = createMockLightWithRole('ambient-light', true);

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([mainLight, ambientLight]);

				const roleMap = createRoleMap([
					{ deviceId: 'main-light', channelId: 'main-light-light-channel', role: LightingRole.MAIN },
					{ deviceId: 'ambient-light', channelId: 'ambient-light-light-channel', role: LightingRole.AMBIENT },
				]);
				mockLightingRoleService.getRoleMap.mockResolvedValue(roleMap);

				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.RELAX };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);

				const calls = mockPlatform.processBatch.mock.calls;

				// Both should be ON with appropriate brightness
				const mainCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'main-light');
				const ambientCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'ambient-light');

				const mainBrightness = (mainCall![0] as IDevicePropertyData[]).find(
					(cmd) => cmd.property.category === PropertyCategory.BRIGHTNESS,
				);
				const ambientBrightness = (ambientCall![0] as IDevicePropertyData[]).find(
					(cmd) => cmd.property.category === PropertyCategory.BRIGHTNESS,
				);

				expect(mainBrightness?.value).toBe(50);
				expect(ambientBrightness?.value).toBe(50);
			});
		});

		describe('with no role configuration (MVP fallback)', () => {
			it('should turn all lights ON with mode brightness', async () => {
				const light1 = createMockLightWithRole('light-1', true);
				const light2 = createMockLightWithRole('light-2', true);

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([light1, light2]);
				// Empty role map (default from beforeEach)

				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.WORK };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);
				expect(result.affectedDevices).toBe(2);

				// All lights should be ON with WORK brightness (100)
				const calls = mockPlatform.processBatch.mock.calls;

				for (const call of calls) {
					const commands = call[0] as IDevicePropertyData[];
					const onCmd = commands.find((cmd) => cmd.property.category === PropertyCategory.ON);
					const brightnessCmd = commands.find((cmd) => cmd.property.category === PropertyCategory.BRIGHTNESS);

					expect(onCmd?.value).toBe(true);
					expect(brightnessCmd?.value).toBe(LIGHTING_MODE_BRIGHTNESS[LightingMode.WORK]);
				}
			});
		});

		describe('with partial role configuration', () => {
			it('should apply roles to configured lights and treat others as OTHER', async () => {
				const mainLight = createMockLightWithRole('main-light', true);
				const unassignedLight = createMockLightWithRole('unassigned-light', true);

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([mainLight, unassignedLight]);

				// Only main light has a role
				const roleMap = createRoleMap([
					{ deviceId: 'main-light', channelId: 'main-light-light-channel', role: LightingRole.MAIN },
				]);
				mockLightingRoleService.getRoleMap.mockResolvedValue(roleMap);

				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.WORK };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);

				const calls = mockPlatform.processBatch.mock.calls;

				// Main light should be ON with 100%
				const mainCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'main-light');
				const mainOnCmd = (mainCall![0] as IDevicePropertyData[]).find(
					(cmd) => cmd.property.category === PropertyCategory.ON,
				);

				expect(mainOnCmd?.value).toBe(true);

				// Unassigned light (OTHER) should be OFF in WORK mode
				const unassignedCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'unassigned-light');
				const unassignedOnCmd = (unassignedCall![0] as IDevicePropertyData[]).find(
					(cmd) => cmd.property.category === PropertyCategory.ON,
				);

				expect(unassignedOnCmd?.value).toBe(false);
			});
		});

		describe('NIGHT mode fallback behavior', () => {
			it('should use main lights when no night lights exist', async () => {
				const mainLight = createMockLightWithRole('main-light', true);
				const taskLight = createMockLightWithRole('task-light', true);

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([mainLight, taskLight]);

				const roleMap = createRoleMap([
					{ deviceId: 'main-light', channelId: 'main-light-light-channel', role: LightingRole.MAIN },
					{ deviceId: 'task-light', channelId: 'task-light-light-channel', role: LightingRole.TASK },
				]);
				mockLightingRoleService.getRoleMap.mockResolvedValue(roleMap);

				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.NIGHT };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);

				const calls = mockPlatform.processBatch.mock.calls;

				// Main light should be ON at fallback brightness (20%)
				const mainCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'main-light');
				const mainCommands = mainCall![0] as IDevicePropertyData[];
				const mainOnCmd = mainCommands.find((cmd) => cmd.property.category === PropertyCategory.ON);
				const mainBrightness = mainCommands.find((cmd) => cmd.property.category === PropertyCategory.BRIGHTNESS);

				expect(mainOnCmd?.value).toBe(true);
				expect(mainBrightness?.value).toBe(20);

				// Task light should be OFF
				const taskCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'task-light');
				const taskOnCmd = (taskCall![0] as IDevicePropertyData[]).find(
					(cmd) => cmd.property.category === PropertyCategory.ON,
				);

				expect(taskOnCmd?.value).toBe(false);
			});

			it('should use night lights when they exist', async () => {
				const mainLight = createMockLightWithRole('main-light', true);
				const nightLight = createMockLightWithRole('night-light', true);

				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([mainLight, nightLight]);

				const roleMap = createRoleMap([
					{ deviceId: 'main-light', channelId: 'main-light-light-channel', role: LightingRole.MAIN },
					{ deviceId: 'night-light', channelId: 'night-light-light-channel', role: LightingRole.NIGHT },
				]);
				mockLightingRoleService.getRoleMap.mockResolvedValue(roleMap);

				const intent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.NIGHT };
				const result = await service.executeLightingIntent(mockSpaceId, intent);

				expect(result.success).toBe(true);

				const calls = mockPlatform.processBatch.mock.calls;

				// Night light should be ON at 20%
				const nightCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'night-light');
				const nightCommands = nightCall![0] as IDevicePropertyData[];
				const nightOnCmd = nightCommands.find((cmd) => cmd.property.category === PropertyCategory.ON);
				const nightBrightness = nightCommands.find((cmd) => cmd.property.category === PropertyCategory.BRIGHTNESS);

				expect(nightOnCmd?.value).toBe(true);
				expect(nightBrightness?.value).toBe(20);

				// Main light should be OFF
				const mainCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'main-light');
				const mainOnCmd = (mainCall![0] as IDevicePropertyData[]).find(
					(cmd) => cmd.property.category === PropertyCategory.ON,
				);

				expect(mainOnCmd?.value).toBe(false);
			});
		});
	});

	describe('brightness delta for ON lights only', () => {
		it('should only adjust brightness for lights that are currently ON', async () => {
			// Light that is ON
			const onLight = createMockLight('on-light', true, 50);

			// Light that is OFF
			const offLight = createMockLight('off-light', true, 50);
			const offLightChannel = offLight.channels![0];
			const offLightOnProp = offLightChannel.properties!.find((p) => p.category === PropertyCategory.ON);

			if (offLightOnProp) {
				(offLightOnProp as { value: unknown }).value = false;
			}

			mockSpacesService.findOne.mockResolvedValue(mockSpace);
			mockSpacesService.findDevicesBySpace.mockResolvedValue([onLight, offLight]);

			const intent: LightingIntentDto = {
				type: LightingIntentType.BRIGHTNESS_DELTA,
				delta: BrightnessDelta.MEDIUM,
				increase: true,
			};
			const result = await service.executeLightingIntent(mockSpaceId, intent);

			expect(result.success).toBe(true);
			expect(result.affectedDevices).toBe(2);

			// Only the ON light should have a brightness command
			const calls = mockPlatform.processBatch.mock.calls;

			// ON light should have brightness adjusted
			const onLightCall = calls.find((c) => (c[0] as IDevicePropertyData[])[0]?.device.id === 'on-light');

			expect(onLightCall).toBeDefined();

			const onLightCommands = onLightCall![0] as IDevicePropertyData[];

			expect(onLightCommands).toHaveLength(1);
			expect(onLightCommands[0].value).toBe(50 + BRIGHTNESS_DELTA_STEPS[BrightnessDelta.MEDIUM]);

			// OFF light should not have been processed (no brightness command)
			// Note: The processBatch was called but with no commands, so it returns success
			// but doesn't actually execute any brightness adjustment
		});
	});
});
