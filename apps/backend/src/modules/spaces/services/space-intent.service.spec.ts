/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-assignment,
@typescript-eslint/no-unnecessary-type-assertion
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { Logger } from '@nestjs/common';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePlatform, IDevicePropertyData } from '../../devices/platforms/device.platform';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { SpaceEntity } from '../entities/space.entity';
import {
	BRIGHTNESS_DELTA_STEPS,
	BrightnessDelta,
	ClimateIntentType,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	LIGHTING_MODE_BRIGHTNESS,
	LightingIntentType,
	LightingMode,
	SETPOINT_DELTA_STEPS,
	SetpointDelta,
} from '../spaces.constants';

import { SpaceIntentService } from './space-intent.service';
import { SpacesService } from './spaces.service';

describe('SpaceIntentService', () => {
	let service: SpaceIntentService;
	let mockSpacesService: jest.Mocked<SpacesService>;
	let mockDevicesService: jest.Mocked<DevicesService>;
	let mockPlatformRegistryService: jest.Mocked<PlatformRegistryService>;
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

		service = new SpaceIntentService(mockSpacesService, mockDevicesService, mockPlatformRegistryService);

		jest.spyOn(Logger.prototype, 'log').mockImplementation();
		jest.spyOn(Logger.prototype, 'debug').mockImplementation();
		jest.spyOn(Logger.prototype, 'warn').mockImplementation();
		jest.spyOn(Logger.prototype, 'error').mockImplementation();
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
					primaryThermostatId: null,
					primarySensorId: null,
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
					primaryThermostatId: null,
					primarySensorId: 'sensor-1',
				});
			});

			it('should select first sensor deterministically by name', async () => {
				const sensorA = createMockSensor('sensor-a', 'Bedroom Sensor', 20.0);
				const sensorB = createMockSensor('sensor-b', 'Attic Sensor', 25.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([sensorA, sensorB]);

				const result = await service.getClimateState(mockSpaceId);

				// 'Attic Sensor' comes before 'Bedroom Sensor' alphabetically
				expect(result.primarySensorId).toBe('sensor-b');
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
					primaryThermostatId: 'thermo-1',
					primarySensorId: 'thermo-1', // Uses thermostat for temp reading
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
			it('should use admin override to select sensor for temperature reading', async () => {
				// Thermostat with both temp and setpoint
				const thermostat = createMockThermostat('thermo-1', 'Thermostat', 20.0, 22.0);
				const sensor = createMockSensor('sensor-1', 'Temperature Sensor', 21.5);

				// Configure admin override to use sensor for temperature
				const spaceWithOverride = {
					...mockSpace,
					primaryTemperatureSensorId: 'sensor-1',
				} as SpaceEntity;

				mockSpacesService.findOne.mockResolvedValue(spaceWithOverride);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat, sensor]);

				const result = await service.getClimateState(mockSpaceId);

				expect(result.hasClimate).toBe(true);
				expect(result.canSetSetpoint).toBe(true);
				expect(result.primaryThermostatId).toBe('thermo-1');
				expect(result.primarySensorId).toBe('sensor-1');
				expect(result.targetTemperature).toBe(22.0);
				expect(result.currentTemperature).toBe(21.5);
			});

			it('should prefer thermostat temperature over separate sensor by default', async () => {
				const thermostat = createMockThermostat('thermo-1', 'Thermostat', 21.0, 22.0);
				const sensor = createMockSensor('sensor-1', 'Sensor', 23.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat, sensor]);

				const result = await service.getClimateState(mockSpaceId);

				// Should use thermostat's temperature reading
				expect(result.primarySensorId).toBe('thermo-1');
				expect(result.currentTemperature).toBe(21.0);
			});
		});

		describe('multiple thermostats selection + admin override', () => {
			it('should select first thermostat deterministically by name', async () => {
				const thermoA = createMockThermostat('thermo-a', 'Zone B Thermostat', 20.0, 21.0);
				const thermoB = createMockThermostat('thermo-b', 'Zone A Thermostat', 22.0, 23.0);
				mockSpacesService.findOne.mockResolvedValue(mockSpace);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermoA, thermoB]);

				const result = await service.getClimateState(mockSpaceId);

				// 'Zone A Thermostat' comes before 'Zone B Thermostat' alphabetically
				expect(result.primaryThermostatId).toBe('thermo-b');
				expect(result.targetTemperature).toBe(23.0);
			});

			it('should use admin-configured primary thermostat override', async () => {
				const thermoA = createMockThermostat('thermo-a', 'Zone A Thermostat', 20.0, 21.0);
				const thermoB = createMockThermostat('thermo-b', 'Zone B Thermostat', 22.0, 23.0);

				// Configure admin override for thermoB
				const spaceWithOverride = {
					...mockSpace,
					primaryThermostatId: 'thermo-b',
				} as SpaceEntity;

				mockSpacesService.findOne.mockResolvedValue(spaceWithOverride);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermoA, thermoB]);

				const result = await service.getClimateState(mockSpaceId);

				// Should use admin override even though Zone A comes first alphabetically
				expect(result.primaryThermostatId).toBe('thermo-b');
				expect(result.targetTemperature).toBe(23.0);
			});

			it('should use admin-configured primary temperature sensor override', async () => {
				const thermostat = createMockThermostat('thermo-1', 'Thermostat', 20.0, 21.0);
				const sensor = createMockSensor('sensor-1', 'Separate Sensor', 24.0);

				// Configure admin override to use separate sensor
				const spaceWithOverride = {
					...mockSpace,
					primaryTemperatureSensorId: 'sensor-1',
				} as SpaceEntity;

				mockSpacesService.findOne.mockResolvedValue(spaceWithOverride);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat, sensor]);

				const result = await service.getClimateState(mockSpaceId);

				// Should use sensor for temperature even though thermostat has temp reading
				expect(result.primarySensorId).toBe('sensor-1');
				expect(result.currentTemperature).toBe(24.0);
			});

			it('should fallback to default if admin override device not found', async () => {
				const thermostat = createMockThermostat('thermo-1', 'Thermostat', 20.0, 21.0);

				// Configure admin override for non-existent device
				const spaceWithOverride = {
					...mockSpace,
					primaryThermostatId: 'non-existent-device',
				} as SpaceEntity;

				mockSpacesService.findOne.mockResolvedValue(spaceWithOverride);
				mockSpacesService.findDevicesBySpace.mockResolvedValue([thermostat]);

				const result = await service.getClimateState(mockSpaceId);

				// Should fallback to first thermostat
				expect(result.primaryThermostatId).toBe('thermo-1');
			});
		});
	});

	describe('executeClimateIntent', () => {
		beforeEach(() => {
			mockDevicesService.getOneOrThrow = jest.fn();
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
});
