/*
eslint-disable @typescript-eslint/unbound-method,
@typescript-eslint/no-unsafe-enum-comparison
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { IDevicePlatform } from '../../devices/platforms/device.platform';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { ClimateMode } from '../spaces.constants';

import { CoverStateSnapshot, LightStateSnapshot, SpaceContextSnapshot } from './space-context-snapshot.service';
import { SpaceUndoHistoryService } from './space-undo-history.service';
import { SpacesService } from './spaces.service';

describe('SpaceUndoHistoryService', () => {
	let service: SpaceUndoHistoryService;
	let devicesService: jest.Mocked<DevicesService>;
	let platformRegistryService: jest.Mocked<PlatformRegistryService>;

	const createSnapshot = (
		spaceId: string,
		lights: LightStateSnapshot[] = [],
		covers: CoverStateSnapshot[] = [],
	): SpaceContextSnapshot => ({
		spaceId,
		spaceName: 'Test Space',
		capturedAt: new Date(),
		lighting: {
			summary: {
				totalLights: lights.length,
				lightsOn: lights.filter((l) => l.isOn).length,
				averageBrightness: null,
			},
			lights,
		},
		climate: {
			hasClimate: false,
			mode: ClimateMode.OFF,
			currentTemperature: null,
			currentHumidity: null,
			heatingSetpoint: null,
			coolingSetpoint: null,
			minSetpoint: 5,
			maxSetpoint: 35,
			supportsHeating: false,
			supportsCooling: false,
			isHeating: false,
			isCooling: false,
			isMixed: false,
			devicesCount: 0,
			primaryThermostatId: null,
			lastAppliedMode: null,
			lastAppliedAt: null,
		},
		covers: {
			summary: {
				totalCovers: covers.length,
				averagePosition: null,
			},
			covers,
		},
	});

	const createLightSnapshot = (
		deviceId: string,
		channelId: string,
		isOn: boolean,
		brightness: number | null = null,
	): LightStateSnapshot => ({
		deviceId,
		deviceName: 'Test Light',
		channelId,
		channelName: 'Light',
		role: null,
		isOn,
		brightness,
		colorTemperature: null,
		color: null,
	});

	const createMockDevice = (deviceId: string, channelId: string): DeviceEntity => {
		const channel: ChannelEntity = {
			id: channelId,
			name: 'Light',
			properties: [
				{
					id: uuid(),
					category: PropertyCategory.ON,
					name: 'On',
				} as ChannelPropertyEntity,
				{
					id: uuid(),
					category: PropertyCategory.BRIGHTNESS,
					name: 'Brightness',
				} as ChannelPropertyEntity,
			],
		} as ChannelEntity;

		return {
			id: deviceId,
			name: 'Test Light',
			channels: [channel],
		} as DeviceEntity;
	};

	const createMockThermostat = (deviceId: string, channelId: string): DeviceEntity => {
		const channel: ChannelEntity = {
			id: channelId,
			name: 'Thermostat',
			category: ChannelCategory.THERMOSTAT,
			properties: [
				{
					id: uuid(),
					category: PropertyCategory.TEMPERATURE,
					name: 'Setpoint',
				} as ChannelPropertyEntity,
			],
		} as ChannelEntity;

		return {
			id: deviceId,
			name: 'Test Thermostat',
			channels: [channel],
		} as DeviceEntity;
	};

	const createClimateSnapshot = (
		spaceId: string,
		thermostatId: string | null,
		heatingSetpointValue: number | null,
		lights: LightStateSnapshot[] = [],
	): SpaceContextSnapshot => ({
		spaceId,
		spaceName: 'Test Space',
		capturedAt: new Date(),
		lighting: {
			summary: {
				totalLights: lights.length,
				lightsOn: lights.filter((l) => l.isOn).length,
				averageBrightness: null,
			},
			lights,
		},
		climate: {
			hasClimate: thermostatId !== null,
			mode: thermostatId !== null ? ClimateMode.HEAT : ClimateMode.OFF,
			currentTemperature: 22,
			currentHumidity: null,
			heatingSetpoint: heatingSetpointValue,
			coolingSetpoint: null,
			minSetpoint: 5,
			maxSetpoint: 35,
			supportsHeating: thermostatId !== null,
			supportsCooling: false,
			isHeating: thermostatId !== null,
			isCooling: false,
			isMixed: false,
			devicesCount: thermostatId !== null ? 1 : 0,
			primaryThermostatId: thermostatId,
			lastAppliedMode: null,
			lastAppliedAt: null,
		},
		covers: {
			summary: {
				totalCovers: 0,
				averagePosition: null,
			},
			covers: [],
		},
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceUndoHistoryService,
				{
					provide: SpacesService,
					useValue: {},
				},
				{
					provide: DevicesService,
					useValue: {
						getOneOrThrow: jest.fn(),
					},
				},
				{
					provide: PlatformRegistryService,
					useValue: {
						get: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<SpaceUndoHistoryService>(SpaceUndoHistoryService);
		devicesService = module.get(DevicesService);
		platformRegistryService = module.get(PlatformRegistryService);
	});

	afterEach(() => {
		// Destroy the service to clean up timers
		service.onModuleDestroy();
	});

	describe('pushSnapshot', () => {
		it('should push a snapshot onto the stack', () => {
			const spaceId = uuid();
			const snapshot = createSnapshot(spaceId);

			const entry = service.pushSnapshot(snapshot, 'Turn lights on', 'lighting');

			expect(entry).toBeDefined();
			expect(entry.spaceId).toBe(spaceId);
			expect(entry.actionDescription).toBe('Turn lights on');
			expect(entry.intentCategory).toBe('lighting');
			expect(entry.snapshot).toBe(snapshot);
		});

		it('should return the created entry with an ID', () => {
			const spaceId = uuid();
			const snapshot = createSnapshot(spaceId);

			const entry = service.pushSnapshot(snapshot, 'Test action', 'lighting');

			expect(entry.id).toBeDefined();
			expect(entry.id).toMatch(/^undo-\d+-[a-z0-9]+$/);
		});

		it('should replace old entries when stack is full (max 1 entry per space)', () => {
			const spaceId = uuid();
			const snapshot1 = createSnapshot(spaceId);
			const snapshot2 = createSnapshot(spaceId);

			service.pushSnapshot(snapshot1, 'First action', 'lighting');
			service.pushSnapshot(snapshot2, 'Second action', 'lighting');

			const entry = service.peekUndoEntry(spaceId);

			expect(entry).not.toBeNull();
			expect(entry.actionDescription).toBe('Second action');
		});

		it('should maintain separate stacks for different spaces', () => {
			const spaceId1 = uuid();
			const spaceId2 = uuid();

			service.pushSnapshot(createSnapshot(spaceId1), 'Action for space 1', 'lighting');
			service.pushSnapshot(createSnapshot(spaceId2), 'Action for space 2', 'climate');

			const entry1 = service.peekUndoEntry(spaceId1);
			const entry2 = service.peekUndoEntry(spaceId2);

			expect(entry1).not.toBeNull();
			expect(entry1.actionDescription).toBe('Action for space 1');
			expect(entry1.intentCategory).toBe('lighting');

			expect(entry2).not.toBeNull();
			expect(entry2.actionDescription).toBe('Action for space 2');
			expect(entry2.intentCategory).toBe('climate');
		});
	});

	describe('peekUndoEntry', () => {
		it('should return null for space with no entries', () => {
			const entry = service.peekUndoEntry(uuid());

			expect(entry).toBeNull();
		});

		it('should return the most recent entry without removing it', () => {
			const spaceId = uuid();
			const snapshot = createSnapshot(spaceId);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const entry1 = service.peekUndoEntry(spaceId);
			const entry2 = service.peekUndoEntry(spaceId);

			expect(entry1).not.toBeNull();
			expect(entry2).not.toBeNull();
			expect(entry1.id).toBe(entry2.id);
		});

		it('should return null for expired entries', () => {
			const spaceId = uuid();
			const snapshot = createSnapshot(spaceId);

			// Push an entry
			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			// Manually expire the entry by setting capturedAt to 6 minutes ago
			const entry = service.peekUndoEntry(spaceId);
			if (entry) {
				// Access the internal stack and modify the entry for testing
				// @ts-expect-error - accessing private property for testing
				const stack = service.undoStacks.get(spaceId);
				if (stack && stack[0]) {
					stack[0].capturedAt = new Date(Date.now() - 6 * 60 * 1000);
				}
			}

			// Should return null because the entry is expired
			const expiredEntry = service.peekUndoEntry(spaceId);
			expect(expiredEntry).toBeNull();
		});
	});

	describe('executeUndo', () => {
		it('should return failure when no undo entry is available', async () => {
			const result = await service.executeUndo(uuid());

			expect(result.success).toBe(false);
			expect(result.restoredDevices).toBe(0);
			expect(result.failedDevices).toBe(0);
			expect(result.message).toBe('No undo entry available');
		});

		it('should restore light state successfully', async () => {
			const spaceId = uuid();
			const deviceId = uuid();
			const channelId = uuid();

			const lightSnapshot = createLightSnapshot(deviceId, channelId, true, 80);
			const snapshot = createSnapshot(spaceId, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const mockDevice = createMockDevice(deviceId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockDevice);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			const result = await service.executeUndo(spaceId);

			expect(result.success).toBe(true);
			expect(result.restoredDevices).toBe(1);
			expect(result.failedDevices).toBe(0);
			expect(mockPlatform.processBatch).toHaveBeenCalledTimes(1);
		});

		it('should remove entry after undo is executed', async () => {
			const spaceId = uuid();
			const deviceId = uuid();
			const channelId = uuid();

			const lightSnapshot = createLightSnapshot(deviceId, channelId, false, null);
			const snapshot = createSnapshot(spaceId, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const mockDevice = createMockDevice(deviceId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockDevice);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			await service.executeUndo(spaceId);

			// Entry should be consumed
			const entry = service.peekUndoEntry(spaceId);
			expect(entry).toBeNull();
		});

		it('should handle platform failure gracefully', async () => {
			const spaceId = uuid();
			const deviceId = uuid();
			const channelId = uuid();

			const lightSnapshot = createLightSnapshot(deviceId, channelId, true, 50);
			const snapshot = createSnapshot(spaceId, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const mockDevice = createMockDevice(deviceId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockDevice);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(false),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			const result = await service.executeUndo(spaceId);

			// Still success=true because we attempted, but failedDevices=1
			expect(result.failedDevices).toBe(1);
			expect(result.restoredDevices).toBe(0);
		});

		it('should handle missing device gracefully', async () => {
			const spaceId = uuid();
			const deviceId = uuid();
			const channelId = uuid();

			const lightSnapshot = createLightSnapshot(deviceId, channelId, true, 80);
			const snapshot = createSnapshot(spaceId, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			devicesService.getOneOrThrow.mockRejectedValue(new Error('Device not found'));

			const result = await service.executeUndo(spaceId);

			expect(result.failedDevices).toBe(1);
			expect(result.restoredDevices).toBe(0);
		});

		it('should restore multiple lights', async () => {
			const spaceId = uuid();
			const light1 = { deviceId: uuid(), channelId: uuid() };
			const light2 = { deviceId: uuid(), channelId: uuid() };

			const snapshot = createSnapshot(spaceId, [
				createLightSnapshot(light1.deviceId, light1.channelId, true, 100),
				createLightSnapshot(light2.deviceId, light2.channelId, false, 0),
			]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			devicesService.getOneOrThrow
				.mockResolvedValueOnce(createMockDevice(light1.deviceId, light1.channelId))
				.mockResolvedValueOnce(createMockDevice(light2.deviceId, light2.channelId));

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			const result = await service.executeUndo(spaceId);

			expect(result.success).toBe(true);
			expect(result.restoredDevices).toBe(2);
			expect(result.failedDevices).toBe(0);
		});
	});

	describe('clearSpace', () => {
		it('should clear all entries for a space', () => {
			const spaceId = uuid();
			const snapshot = createSnapshot(spaceId);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			// Verify entry exists
			expect(service.peekUndoEntry(spaceId)).not.toBeNull();

			// Clear
			service.clearSpace(spaceId);

			// Verify entry is gone
			expect(service.peekUndoEntry(spaceId)).toBeNull();
		});

		it('should not affect other spaces', () => {
			const spaceId1 = uuid();
			const spaceId2 = uuid();

			service.pushSnapshot(createSnapshot(spaceId1), 'Action 1', 'lighting');
			service.pushSnapshot(createSnapshot(spaceId2), 'Action 2', 'climate');

			service.clearSpace(spaceId1);

			expect(service.peekUndoEntry(spaceId1)).toBeNull();
			expect(service.peekUndoEntry(spaceId2)).not.toBeNull();
		});
	});

	describe('buildLightRestoreCommands', () => {
		it('should include on/off command', async () => {
			const spaceId = uuid();
			const deviceId = uuid();
			const channelId = uuid();

			const lightSnapshot = createLightSnapshot(deviceId, channelId, true, null);
			const snapshot = createSnapshot(spaceId, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const mockDevice = createMockDevice(deviceId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockDevice);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			await service.executeUndo(spaceId);

			const commands = mockPlatform.processBatch.mock.calls[0][0];

			// Should include on command
			const onCommand = commands.find(
				(c: { property: { category: string } }) => c.property.category === PropertyCategory.ON,
			);
			expect(onCommand).toBeDefined();
			expect(onCommand.value).toBe(true);
		});

		it('should include brightness command when light is on and has brightness', async () => {
			const spaceId = uuid();
			const deviceId = uuid();
			const channelId = uuid();

			const lightSnapshot = createLightSnapshot(deviceId, channelId, true, 75);
			const snapshot = createSnapshot(spaceId, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const mockDevice = createMockDevice(deviceId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockDevice);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			await service.executeUndo(spaceId);

			const commands = mockPlatform.processBatch.mock.calls[0][0];

			// Should include brightness command
			const brightnessCommand = commands.find(
				(c: { property: { category: string } }) => c.property.category === PropertyCategory.BRIGHTNESS,
			);
			expect(brightnessCommand).toBeDefined();
			expect(brightnessCommand.value).toBe(75);
		});

		it('should not include brightness when light is off', async () => {
			const spaceId = uuid();
			const deviceId = uuid();
			const channelId = uuid();

			const lightSnapshot = createLightSnapshot(deviceId, channelId, false, 50);
			const snapshot = createSnapshot(spaceId, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const mockDevice = createMockDevice(deviceId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockDevice);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			await service.executeUndo(spaceId);

			const commands = mockPlatform.processBatch.mock.calls[0][0];

			// Should NOT include brightness command when light is off
			const brightnessCommand = commands.find(
				(c: { property: { category: string } }) => c.property.category === PropertyCategory.BRIGHTNESS,
			);
			expect(brightnessCommand).toBeUndefined();
		});
	});

	describe('restoreClimateState', () => {
		it('should restore thermostat setpoint successfully', async () => {
			const spaceId = uuid();
			const thermostatId = uuid();
			const channelId = uuid();

			const snapshot = createClimateSnapshot(spaceId, thermostatId, 21.5);

			service.pushSnapshot(snapshot, 'Set temperature', 'climate');

			const mockThermostat = createMockThermostat(thermostatId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockThermostat);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			const result = await service.executeUndo(spaceId);

			expect(result.success).toBe(true);
			expect(result.restoredDevices).toBe(1);
			expect(result.failedDevices).toBe(0);
			expect(mockPlatform.processBatch).toHaveBeenCalledTimes(1);

			// Verify the setpoint value was sent
			const commands = mockPlatform.processBatch.mock.calls[0][0];
			expect(commands).toHaveLength(1);
			expect(commands[0].value).toBe(21.5);
			expect(commands[0].property.category).toBe(PropertyCategory.TEMPERATURE);
		});

		it('should skip climate restoration when no thermostat in snapshot', async () => {
			const spaceId = uuid();

			// Create snapshot with no thermostat
			const snapshot = createClimateSnapshot(spaceId, null, null);

			service.pushSnapshot(snapshot, 'Test action', 'lighting');

			const result = await service.executeUndo(spaceId);

			// No devices to restore (no lights, no climate)
			expect(result.success).toBe(true);
			expect(result.restoredDevices).toBe(0);
			expect(result.failedDevices).toBe(0);
			expect(devicesService.getOneOrThrow).not.toHaveBeenCalled();
		});

		it('should skip climate restoration when no target temperature in snapshot', async () => {
			const spaceId = uuid();
			const thermostatId = uuid();

			// Create snapshot with thermostat but no target temperature
			const snapshot = createClimateSnapshot(spaceId, thermostatId, null);

			service.pushSnapshot(snapshot, 'Test action', 'climate');

			const result = await service.executeUndo(spaceId);

			// No devices to restore
			expect(result.success).toBe(true);
			expect(result.restoredDevices).toBe(0);
			expect(result.failedDevices).toBe(0);
			expect(devicesService.getOneOrThrow).not.toHaveBeenCalled();
		});

		it('should handle platform failure for climate restoration', async () => {
			const spaceId = uuid();
			const thermostatId = uuid();
			const channelId = uuid();

			const snapshot = createClimateSnapshot(spaceId, thermostatId, 22);

			service.pushSnapshot(snapshot, 'Set temperature', 'climate');

			const mockThermostat = createMockThermostat(thermostatId, channelId);
			devicesService.getOneOrThrow.mockResolvedValue(mockThermostat);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(false),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			const result = await service.executeUndo(spaceId);

			expect(result.failedDevices).toBe(1);
			expect(result.restoredDevices).toBe(0);
		});

		it('should handle missing thermostat device', async () => {
			const spaceId = uuid();
			const thermostatId = uuid();

			const snapshot = createClimateSnapshot(spaceId, thermostatId, 22);

			service.pushSnapshot(snapshot, 'Set temperature', 'climate');

			devicesService.getOneOrThrow.mockRejectedValue(new Error('Device not found'));

			const result = await service.executeUndo(spaceId);

			expect(result.failedDevices).toBe(1);
			expect(result.restoredDevices).toBe(0);
		});

		it('should restore both lighting and climate state together', async () => {
			const spaceId = uuid();
			const lightDeviceId = uuid();
			const lightChannelId = uuid();
			const thermostatId = uuid();
			const thermostatChannelId = uuid();

			const lightSnapshot = createLightSnapshot(lightDeviceId, lightChannelId, true, 80);
			const snapshot = createClimateSnapshot(spaceId, thermostatId, 20, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Combined action', 'lighting');

			const mockLight = createMockDevice(lightDeviceId, lightChannelId);
			const mockThermostat = createMockThermostat(thermostatId, thermostatChannelId);

			devicesService.getOneOrThrow.mockResolvedValueOnce(mockLight).mockResolvedValueOnce(mockThermostat);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest.fn().mockResolvedValue(true),
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			const result = await service.executeUndo(spaceId);

			expect(result.success).toBe(true);
			expect(result.restoredDevices).toBe(2); // 1 light + 1 thermostat
			expect(result.failedDevices).toBe(0);
			expect(mockPlatform.processBatch).toHaveBeenCalledTimes(2);
		});

		it('should handle partial failure in combined restoration', async () => {
			const spaceId = uuid();
			const lightDeviceId = uuid();
			const lightChannelId = uuid();
			const thermostatId = uuid();
			const thermostatChannelId = uuid();

			const lightSnapshot = createLightSnapshot(lightDeviceId, lightChannelId, true, 80);
			const snapshot = createClimateSnapshot(spaceId, thermostatId, 20, [lightSnapshot]);

			service.pushSnapshot(snapshot, 'Combined action', 'lighting');

			const mockLight = createMockDevice(lightDeviceId, lightChannelId);
			const mockThermostat = createMockThermostat(thermostatId, thermostatChannelId);

			devicesService.getOneOrThrow.mockResolvedValueOnce(mockLight).mockResolvedValueOnce(mockThermostat);

			const mockPlatform: jest.Mocked<IDevicePlatform> = {
				processBatch: jest
					.fn()
					.mockResolvedValueOnce(true) // Light succeeds
					.mockResolvedValueOnce(false), // Thermostat fails
			} as unknown as jest.Mocked<IDevicePlatform>;
			platformRegistryService.get.mockReturnValue(mockPlatform);

			const result = await service.executeUndo(spaceId);

			expect(result.success).toBe(true); // At least one device succeeded
			expect(result.restoredDevices).toBe(1);
			expect(result.failedDevices).toBe(1);
		});
	});
});
