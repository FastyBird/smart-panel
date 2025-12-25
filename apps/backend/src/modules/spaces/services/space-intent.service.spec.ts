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
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { SpaceEntity } from '../entities/space.entity';
import {
	BRIGHTNESS_DELTA_STEPS,
	BrightnessDelta,
	LIGHTING_MODE_BRIGHTNESS,
	LightingIntentType,
	LightingMode,
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
});
