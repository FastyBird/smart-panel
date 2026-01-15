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
import { ClimateIntentDto } from '../dto/climate-intent.dto';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import {
	ClimateIntentType,
	ClimateMode,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	LIGHTING_MODE_BRIGHTNESS,
	LIGHTING_MODE_ORCHESTRATION,
	LightingIntentType,
	LightingMode,
	LightingRole,
	SetpointDelta,
} from '../spaces.constants';

import { ClimateIntentResult, ClimateIntentService, ClimateState } from './climate-intent.service';
import { LightingIntentService } from './lighting-intent.service';
import { IntentExecutionResult } from './space-intent-base.service';
import { SpaceIntentService, selectLightsForMode } from './space-intent.service';

describe('SpaceIntentService', () => {
	let service: SpaceIntentService;
	let mockLightingIntentService: jest.Mocked<LightingIntentService>;
	let mockClimateIntentService: jest.Mocked<ClimateIntentService>;

	const mockSpaceId = 'space-123';

	beforeEach(() => {
		mockLightingIntentService = {
			executeLightingIntent: jest.fn(),
		} as unknown as jest.Mocked<LightingIntentService>;

		mockClimateIntentService = {
			getClimateState: jest.fn(),
			executeClimateIntent: jest.fn(),
			getPrimaryThermostatId: jest.fn(),
		} as unknown as jest.Mocked<ClimateIntentService>;

		service = new SpaceIntentService(mockLightingIntentService, mockClimateIntentService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// =====================
	// Facade Delegation Tests
	// =====================

	describe('executeLightingIntent', () => {
		it('should delegate to LightingIntentService', async () => {
			const intent: LightingIntentDto = { type: LightingIntentType.ON };
			const expectedResult: IntentExecutionResult = {
				success: true,
				affectedDevices: 3,
				failedDevices: 0,
			};
			mockLightingIntentService.executeLightingIntent.mockResolvedValue(expectedResult);

			const result = await service.executeLightingIntent(mockSpaceId, intent);

			expect(mockLightingIntentService.executeLightingIntent).toHaveBeenCalledWith(mockSpaceId, intent);
			expect(result).toEqual(expectedResult);
		});

		it('should pass through all intent types', async () => {
			const offIntent: LightingIntentDto = { type: LightingIntentType.OFF };
			const modeIntent: LightingIntentDto = { type: LightingIntentType.SET_MODE, mode: LightingMode.WORK };

			mockLightingIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
			});

			await service.executeLightingIntent(mockSpaceId, offIntent);
			await service.executeLightingIntent(mockSpaceId, modeIntent);

			expect(mockLightingIntentService.executeLightingIntent).toHaveBeenCalledTimes(2);
			expect(mockLightingIntentService.executeLightingIntent).toHaveBeenNthCalledWith(1, mockSpaceId, offIntent);
			expect(mockLightingIntentService.executeLightingIntent).toHaveBeenNthCalledWith(2, mockSpaceId, modeIntent);
		});
	});

	describe('getClimateState', () => {
		it('should delegate to ClimateIntentService', async () => {
			const expectedState: ClimateState = {
				hasClimate: true,
				mode: ClimateMode.HEAT,
				currentTemperature: 22.5,
				currentHumidity: 45,
				targetTemperature: 23.0,
				heatingSetpoint: 23.0,
				coolingSetpoint: null,
				minSetpoint: 15,
				maxSetpoint: 30,
				canSetSetpoint: true,
				supportsHeating: true,
				supportsCooling: false,
				isMixed: false,
				devicesCount: 1,
				lastAppliedMode: null,
				lastAppliedAt: null,
			};
			mockClimateIntentService.getClimateState.mockResolvedValue(expectedState);

			const result = await service.getClimateState(mockSpaceId);

			expect(mockClimateIntentService.getClimateState).toHaveBeenCalledWith(mockSpaceId);
			expect(result).toEqual(expectedState);
		});

		it('should return default state when no climate devices', async () => {
			const defaultState: ClimateState = {
				hasClimate: false,
				mode: ClimateMode.OFF,
				currentTemperature: null,
				currentHumidity: null,
				targetTemperature: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
				minSetpoint: DEFAULT_MIN_SETPOINT,
				maxSetpoint: DEFAULT_MAX_SETPOINT,
				canSetSetpoint: false,
				supportsHeating: false,
				supportsCooling: false,
				isMixed: false,
				devicesCount: 0,
				lastAppliedMode: null,
				lastAppliedAt: null,
			};
			mockClimateIntentService.getClimateState.mockResolvedValue(defaultState);

			const result = await service.getClimateState(mockSpaceId);

			expect(result.hasClimate).toBe(false);
			expect(result.canSetSetpoint).toBe(false);
		});
	});

	describe('executeClimateIntent', () => {
		it('should delegate to ClimateIntentService', async () => {
			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SETPOINT_DELTA,
				delta: SetpointDelta.SMALL,
				increase: true,
			};
			const expectedResult: ClimateIntentResult = {
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
				mode: ClimateMode.HEAT,
				newSetpoint: 22.5,
				heatingSetpoint: 22.5,
				coolingSetpoint: null,
			};
			mockClimateIntentService.executeClimateIntent.mockResolvedValue(expectedResult);

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(mockClimateIntentService.executeClimateIntent).toHaveBeenCalledWith(mockSpaceId, intent);
			expect(result).toEqual(expectedResult);
		});

		it('should handle set setpoint intent', async () => {
			const intent: ClimateIntentDto = {
				type: ClimateIntentType.SETPOINT_SET,
				value: 25.0,
			};
			const expectedResult: ClimateIntentResult = {
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
				mode: ClimateMode.HEAT,
				newSetpoint: 25.0,
				heatingSetpoint: 25.0,
				coolingSetpoint: null,
			};
			mockClimateIntentService.executeClimateIntent.mockResolvedValue(expectedResult);

			const result = await service.executeClimateIntent(mockSpaceId, intent);

			expect(mockClimateIntentService.executeClimateIntent).toHaveBeenCalledWith(mockSpaceId, intent);
			expect(result.newSetpoint).toBe(25.0);
		});
	});

	describe('getPrimaryThermostatId', () => {
		it('should delegate to ClimateIntentService', async () => {
			const expectedId = 'thermostat-123';
			mockClimateIntentService.getPrimaryThermostatId.mockResolvedValue(expectedId);

			const result = await service.getPrimaryThermostatId(mockSpaceId);

			expect(mockClimateIntentService.getPrimaryThermostatId).toHaveBeenCalledWith(mockSpaceId);
			expect(result).toBe(expectedId);
		});

		it('should return null when no thermostat exists', async () => {
			mockClimateIntentService.getPrimaryThermostatId.mockResolvedValue(null);

			const result = await service.getPrimaryThermostatId(mockSpaceId);

			expect(result).toBeNull();
		});
	});

	// =====================
	// Pure Function Tests (selectLightsForMode)
	// These test the exported pure function for light selection
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
				colorRedProperty: null,
				colorGreenProperty: null,
				colorBlueProperty: null,
				hueProperty: null,
				saturationProperty: null,
				colorTempProperty: null,
				whiteProperty: null,
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
});
