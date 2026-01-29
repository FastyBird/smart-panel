import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { PropertyValueState } from '../../devices/models/property-value-state.model';
import { IntentStatus } from '../../intents/intents.constants';
import { IntentTimeseriesService, LastAppliedClimateState } from '../../intents/services/intent-timeseries.service';
import { SpaceClimateRoleEntity } from '../entities/space-climate-role.entity';
import {
	ClimateMode,
	ClimateRole,
	DEFAULT_MAX_SETPOINT,
	DEFAULT_MIN_SETPOINT,
	SETPOINT_CONSENSUS_TOLERANCE,
} from '../spaces.constants';

import { SpaceClimateRoleService } from './space-climate-role.service';
import { SpaceClimateStateService } from './space-climate-state.service';
import { SpacesService } from './spaces.service';

describe('SpaceClimateStateService', () => {
	let service: SpaceClimateStateService;
	let spacesService: jest.Mocked<SpacesService>;
	let climateRoleService: jest.Mocked<SpaceClimateRoleService>;
	let intentTimeseriesService: jest.Mocked<IntentTimeseriesService>;

	const mockSpaceId = uuid();

	// Helper to create mock device with climate channels
	const createMockClimateDevice = (options: {
		id?: string;
		category: DeviceCategory;
		hasHeater?: boolean;
		hasCooler?: boolean;
		heaterOn?: boolean;
		coolerOn?: boolean;
		heaterSetpoint?: number;
		coolerSetpoint?: number;
		temperature?: number;
		humidity?: number;
	}): DeviceEntity => {
		const deviceId = options.id ?? uuid();
		const channels: Partial<ChannelEntity>[] = [];

		// Temperature channel
		if (options.temperature !== undefined) {
			const tempProp: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.TEMPERATURE,
				value: new PropertyValueState(options.temperature),
			};
			channels.push({
				id: uuid(),
				category: ChannelCategory.TEMPERATURE,
				properties: [tempProp as ChannelPropertyEntity],
			});
		}

		// Humidity channel
		if (options.humidity !== undefined) {
			const humidityProp: Partial<ChannelPropertyEntity> = {
				id: uuid(),
				category: PropertyCategory.HUMIDITY,
				value: new PropertyValueState(options.humidity),
			};
			channels.push({
				id: uuid(),
				category: ChannelCategory.HUMIDITY,
				properties: [humidityProp as ChannelPropertyEntity],
			});
		}

		// Heater channel
		if (options.hasHeater) {
			const heaterProps: Partial<ChannelPropertyEntity>[] = [
				{
					id: uuid(),
					category: PropertyCategory.ON,
					value: new PropertyValueState(options.heaterOn ?? false),
				},
				{
					id: uuid(),
					category: PropertyCategory.STATUS,
					value: new PropertyValueState(options.heaterOn ?? false),
				},
			];
			if (options.heaterSetpoint !== undefined) {
				heaterProps.push({
					id: uuid(),
					category: PropertyCategory.TEMPERATURE,
					value: new PropertyValueState(options.heaterSetpoint),
					format: [15, 30], // min, max
				});
			}
			channels.push({
				id: uuid(),
				category: ChannelCategory.HEATER,
				properties: heaterProps as ChannelPropertyEntity[],
			});
		}

		// Cooler channel
		if (options.hasCooler) {
			const coolerProps: Partial<ChannelPropertyEntity>[] = [
				{
					id: uuid(),
					category: PropertyCategory.ON,
					value: new PropertyValueState(options.coolerOn ?? false),
				},
				{
					id: uuid(),
					category: PropertyCategory.STATUS,
					value: new PropertyValueState(options.coolerOn ?? false),
				},
			];
			if (options.coolerSetpoint !== undefined) {
				coolerProps.push({
					id: uuid(),
					category: PropertyCategory.TEMPERATURE,
					value: new PropertyValueState(options.coolerSetpoint),
					format: [18, 35], // min, max
				});
			}
			channels.push({
				id: uuid(),
				category: ChannelCategory.COOLER,
				properties: coolerProps as ChannelPropertyEntity[],
			});
		}

		return {
			id: deviceId,
			name: `Test Device ${deviceId.substring(0, 8)}`,
			category: options.category,
			roomId: mockSpaceId,
			channels: channels as ChannelEntity[],
		} as DeviceEntity;
	};

	// Helper to create role map
	const createRoleMap = (
		entries: Array<{ deviceId: string; role: ClimateRole }>,
	): Map<string, SpaceClimateRoleEntity> => {
		const map = new Map<string, SpaceClimateRoleEntity>();
		for (const entry of entries) {
			map.set(entry.deviceId, {
				id: uuid(),
				spaceId: mockSpaceId,
				deviceId: entry.deviceId,
				channelId: null,
				role: entry.role,
				createdAt: new Date(),
				updatedAt: null,
			} as SpaceClimateRoleEntity);
		}
		return map;
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceClimateStateService,
				{
					provide: SpacesService,
					useValue: {
						findOne: jest.fn().mockResolvedValue({ id: mockSpaceId }),
						findDevicesBySpace: jest.fn().mockResolvedValue([]),
					},
				},
				{
					provide: SpaceClimateRoleService,
					useValue: {
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: IntentTimeseriesService,
					useValue: {
						getLastClimateState: jest.fn().mockResolvedValue(null),
					},
				},
			],
		}).compile();

		service = module.get<SpaceClimateStateService>(SpaceClimateStateService);
		spacesService = module.get(SpacesService);
		climateRoleService = module.get(SpaceClimateRoleService);
		intentTimeseriesService = module.get(IntentTimeseriesService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('getClimateState', () => {
		it('should return null when space does not exist', async () => {
			spacesService.findOne.mockResolvedValue(null);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).toBeNull();
		});

		it('should return default state when no climate devices exist', async () => {
			spacesService.findDevicesBySpace.mockResolvedValue([]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.hasClimate).toBe(false);
			expect(result.mode).toBe(ClimateMode.OFF);
			expect(result.currentTemperature).toBeNull();
			expect(result.heatingSetpoint).toBeNull();
			expect(result.coolingSetpoint).toBeNull();
			expect(result.minSetpoint).toBe(DEFAULT_MIN_SETPOINT);
			expect(result.maxSetpoint).toBe(DEFAULT_MAX_SETPOINT);
		});

		it('should detect HEAT mode when heater is on', async () => {
			const heaterDevice = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterOn: true,
				heaterSetpoint: 22.0,
				temperature: 20.5,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([heaterDevice]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.hasClimate).toBe(true);
			expect(result.mode).toBe(ClimateMode.HEAT);
			expect(result.supportsHeating).toBe(true);
			expect(result.isHeating).toBe(true);
		});

		it('should detect COOL mode when cooler is on', async () => {
			const coolerDevice = createMockClimateDevice({
				category: DeviceCategory.AIR_CONDITIONER,
				hasCooler: true,
				coolerOn: true,
				coolerSetpoint: 24.0,
				temperature: 26.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([coolerDevice]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.hasClimate).toBe(true);
			expect(result.mode).toBe(ClimateMode.COOL);
			expect(result.supportsCooling).toBe(true);
			expect(result.isCooling).toBe(true);
		});

		it('should detect AUTO mode when both heater and cooler are on', async () => {
			const acDevice = createMockClimateDevice({
				category: DeviceCategory.AIR_CONDITIONER,
				hasHeater: true,
				hasCooler: true,
				heaterOn: true,
				coolerOn: true,
				heaterSetpoint: 20.0,
				coolerSetpoint: 24.0,
				temperature: 22.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([acDevice]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.hasClimate).toBe(true);
			expect(result.mode).toBe(ClimateMode.AUTO);
			expect(result.supportsHeating).toBe(true);
			expect(result.supportsCooling).toBe(true);
		});

		it('should detect OFF mode when no heater or cooler is on', async () => {
			const heaterDevice = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterOn: false,
				heaterSetpoint: 22.0,
				temperature: 20.5,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([heaterDevice]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.mode).toBe(ClimateMode.OFF);
			expect(result.isHeating).toBe(false);
		});

		it('should use lastAppliedMode from InfluxDB when available', async () => {
			const heaterDevice = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterOn: true,
				heaterSetpoint: 22.0,
				temperature: 20.5,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([heaterDevice]);

			const lastApplied: LastAppliedClimateState = {
				mode: ClimateMode.HEAT,
				heatingSetpoint: 22.0,
				coolingSetpoint: null,
				intentId: uuid(),
				appliedAt: new Date(),
				status: IntentStatus.COMPLETED_SUCCESS,
			};
			intentTimeseriesService.getLastClimateState.mockResolvedValue(lastApplied);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.lastAppliedMode).toBe(ClimateMode.HEAT);
			expect(result.lastAppliedAt).toEqual(lastApplied.appliedAt);
		});

		it('should calculate average temperature from multiple devices', async () => {
			const device1 = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 22.0,
				temperature: 20.0,
			});
			const device2 = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 22.0,
				temperature: 22.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([device1, device2]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.currentTemperature).toBe(21.0); // Average of 20 and 22
		});

		it('should filter out HIDDEN role devices', async () => {
			const visibleDevice = createMockClimateDevice({
				id: 'visible-device',
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterOn: true,
				heaterSetpoint: 22.0,
				temperature: 20.5,
			});
			const hiddenDevice = createMockClimateDevice({
				id: 'hidden-device',
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterOn: true,
				heaterSetpoint: 25.0,
				temperature: 18.0,
			});

			spacesService.findDevicesBySpace.mockResolvedValue([visibleDevice, hiddenDevice]);
			climateRoleService.getRoleMap.mockResolvedValue(
				createRoleMap([{ deviceId: 'hidden-device', role: ClimateRole.HIDDEN }]),
			);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.devicesCount).toBe(1);
		});

		it('should detect mixed state when devices have different setpoints', async () => {
			const device1 = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 20.0,
				temperature: 19.0,
			});
			const device2 = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 24.0, // Different by more than tolerance
				temperature: 19.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([device1, device2]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.isMixed).toBe(true);
		});

		it('should not detect mixed state when setpoints are within tolerance', async () => {
			const device1 = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 22.0,
				temperature: 19.0,
			});
			const device2 = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 22.0 + SETPOINT_CONSENSUS_TOLERANCE - 0.1, // Within tolerance
				temperature: 19.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([device1, device2]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			expect(result.isMixed).toBe(false);
		});

		it('should calculate min/max setpoint range from device limits', async () => {
			const device = createMockClimateDevice({
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 22.0,
				temperature: 20.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([device]);

			const result = await service.getClimateState(mockSpaceId);

			expect(result).not.toBeNull();
			// Device has minValue: 15, maxValue: 30 on heater setpoint
			expect(result.minSetpoint).toBe(15);
			expect(result.maxSetpoint).toBe(30);
		});
	});

	describe('getPrimaryClimateDevicesInSpace', () => {
		it('should return empty array when no climate devices', async () => {
			const lightDevice = {
				id: uuid(),
				category: DeviceCategory.LIGHTING,
				channels: [],
			} as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([lightDevice]);

			const result = await service.getPrimaryClimateDevicesInSpace(mockSpaceId);

			expect(result).toEqual([]);
		});

		it('should return primary climate devices with extracted properties', async () => {
			const thermostat = createMockClimateDevice({
				category: DeviceCategory.THERMOSTAT,
				hasHeater: true,
				hasCooler: true,
				heaterSetpoint: 22.0,
				coolerSetpoint: 26.0,
				temperature: 23.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([thermostat]);

			const result = await service.getPrimaryClimateDevicesInSpace(mockSpaceId);

			expect(result).toHaveLength(1);
			expect(result[0].deviceCategory).toBe(DeviceCategory.THERMOSTAT);
			expect(result[0].supportsHeating).toBe(true);
			expect(result[0].supportsCooling).toBe(true);
		});

		it('should sort devices alphabetically by name', async () => {
			// Create devices with names that will sort in predictable order
			const heater = {
				...createMockClimateDevice({
					category: DeviceCategory.HEATING_UNIT,
					hasHeater: true,
					heaterSetpoint: 22.0,
				}),
				name: 'Bravo Heater',
			} as DeviceEntity;
			const thermostat = {
				...createMockClimateDevice({
					category: DeviceCategory.THERMOSTAT,
					hasHeater: true,
					heaterSetpoint: 22.0,
				}),
				name: 'Alpha Thermostat',
			} as DeviceEntity;
			const ac = {
				...createMockClimateDevice({
					category: DeviceCategory.AIR_CONDITIONER,
					hasCooler: true,
					coolerSetpoint: 26.0,
				}),
				name: 'Charlie AC',
			} as DeviceEntity;
			spacesService.findDevicesBySpace.mockResolvedValue([heater, ac, thermostat]);

			const result = await service.getPrimaryClimateDevicesInSpace(mockSpaceId);

			expect(result).toHaveLength(3);
			// Sorted alphabetically by name: Alpha < Bravo < Charlie
			expect(result[0].deviceCategory).toBe(DeviceCategory.THERMOSTAT); // Alpha
			expect(result[1].deviceCategory).toBe(DeviceCategory.HEATING_UNIT); // Bravo
			expect(result[2].deviceCategory).toBe(DeviceCategory.AIR_CONDITIONER); // Charlie
		});

		it('should exclude HIDDEN role devices', async () => {
			const visibleDevice = createMockClimateDevice({
				id: 'visible-device',
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 22.0,
			});
			const hiddenDevice = createMockClimateDevice({
				id: 'hidden-device',
				category: DeviceCategory.HEATING_UNIT,
				hasHeater: true,
				heaterSetpoint: 22.0,
			});
			spacesService.findDevicesBySpace.mockResolvedValue([visibleDevice, hiddenDevice]);
			climateRoleService.getRoleMap.mockResolvedValue(
				createRoleMap([{ deviceId: 'hidden-device', role: ClimateRole.HIDDEN }]),
			);

			const result = await service.getPrimaryClimateDevicesInSpace(mockSpaceId);

			expect(result).toHaveLength(1);
		});
	});

	describe('detectClimateModeAndActivity', () => {
		it('should return OFF mode when no devices', () => {
			const result = service.detectClimateModeAndActivity([]);

			expect(result.mode).toBe(ClimateMode.OFF);
			expect(result.isHeating).toBe(false);
			expect(result.isCooling).toBe(false);
		});
	});
});
