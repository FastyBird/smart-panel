import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../devices/devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../../devices/entities/devices.entity';
import { SpaceLightingRoleEntity } from '../entities/space-lighting-role.entity';
import { SpaceEntity } from '../entities/space.entity';
import { LightingRole, SpaceType } from '../spaces.constants';

import { SpaceClimateRoleService } from './space-climate-role.service';
import { SpaceContextSnapshotService } from './space-context-snapshot.service';
import { ClimateState, SpaceIntentService } from './space-intent.service';
import { SpaceLightingRoleService } from './space-lighting-role.service';
import { SpacesService } from './spaces.service';

describe('SpaceContextSnapshotService', () => {
	let service: SpaceContextSnapshotService;
	let spacesService: jest.Mocked<SpacesService>;
	let spaceIntentService: jest.Mocked<SpaceIntentService>;
	let lightingRoleService: jest.Mocked<SpaceLightingRoleService>;

	const createSpace = (id: string, name: string): SpaceEntity => ({
		id,
		name,
		description: null,
		type: SpaceType.ROOM,
		category: null,
		icon: null,
		displayOrder: 0,
		suggestionsEnabled: true,
		lastActivityAt: null,
		parentId: null,
		parent: null,
		children: [],
		createdAt: new Date(),
		updatedAt: null,
	});

	const createLightDevice = (
		id: string,
		name: string,
		isOn: boolean,
		brightness: number | null = null,
		colorTemp: number | null = null,
		color: string | null = null,
	): DeviceEntity => {
		const channelId = uuid();

		const properties: ChannelPropertyEntity[] = [
			{
				id: uuid(),
				category: PropertyCategory.ON,
				name: 'On',
				dataType: 'boolean',
				value: isOn,
			} as unknown as ChannelPropertyEntity,
		];

		if (brightness !== null) {
			properties.push({
				id: uuid(),
				category: PropertyCategory.BRIGHTNESS,
				name: 'Brightness',
				dataType: 'number',
				value: brightness,
			} as unknown as ChannelPropertyEntity);
		}

		if (colorTemp !== null) {
			properties.push({
				id: uuid(),
				category: PropertyCategory.COLOR_TEMPERATURE,
				name: 'Color Temperature',
				dataType: 'number',
				value: colorTemp,
			} as unknown as ChannelPropertyEntity);
		}

		// For color, we need to use RGB components to build a hex color
		if (color !== null) {
			// Parse hex color to RGB (e.g., #ff6b35 -> R=255, G=107, B=53)
			const hex = color.replace('#', '');
			const r = parseInt(hex.substring(0, 2), 16);
			const g = parseInt(hex.substring(2, 4), 16);
			const b = parseInt(hex.substring(4, 6), 16);

			properties.push(
				{
					id: uuid(),
					category: PropertyCategory.COLOR_RED,
					name: 'Color Red',
					dataType: 'number',
					value: r,
				} as unknown as ChannelPropertyEntity,
				{
					id: uuid(),
					category: PropertyCategory.COLOR_GREEN,
					name: 'Color Green',
					dataType: 'number',
					value: g,
				} as unknown as ChannelPropertyEntity,
				{
					id: uuid(),
					category: PropertyCategory.COLOR_BLUE,
					name: 'Color Blue',
					dataType: 'number',
					value: b,
				} as unknown as ChannelPropertyEntity,
			);
		}

		const channel: ChannelEntity = {
			id: channelId,
			category: ChannelCategory.LIGHT,
			name: 'Light',
			properties,
		} as unknown as ChannelEntity;

		return {
			id,
			name,
			category: DeviceCategory.LIGHTING,
			channels: [channel],
		} as unknown as DeviceEntity;
	};

	const createDefaultClimateState = (): ClimateState => ({
		hasClimate: false,
		currentTemperature: null,
		targetTemperature: null,
		minSetpoint: 5,
		maxSetpoint: 35,
		canSetSetpoint: false,
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SpaceContextSnapshotService,
				{
					provide: SpacesService,
					useValue: {
						findOne: jest.fn(),
						findDevicesBySpace: jest.fn(),
					},
				},
				{
					provide: SpaceIntentService,
					useValue: {
						getClimateState: jest.fn(),
					},
				},
				{
					provide: SpaceLightingRoleService,
					useValue: {
						getRoleMap: jest.fn(),
					},
				},
				{
					provide: SpaceClimateRoleService,
					useValue: {
						getRoleMap: jest.fn(),
					},
				},
			],
		}).compile();

		service = module.get<SpaceContextSnapshotService>(SpaceContextSnapshotService);
		spacesService = module.get(SpacesService);
		spaceIntentService = module.get(SpaceIntentService);
		lightingRoleService = module.get(SpaceLightingRoleService);
	});

	describe('captureSnapshot', () => {
		it('should return null for non-existent space', async () => {
			spacesService.findOne.mockResolvedValue(null);

			const result = await service.captureSnapshot('non-existent');

			expect(result).toBeNull();
		});

		it('should capture snapshot for empty space', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Living Room');

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.spaceId).toBe(spaceId);
			expect(result.spaceName).toBe('Living Room');
			expect(result.lighting.summary.totalLights).toBe(0);
			expect(result.lighting.summary.lightsOn).toBe(0);
			expect(result.lighting.summary.averageBrightness).toBeNull();
			expect(result.lighting.lights).toHaveLength(0);
		});

		it('should capture lighting state for lights', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Bedroom');
			const light1 = createLightDevice(uuid(), 'Ceiling Light', true, 80);
			const light2 = createLightDevice(uuid(), 'Desk Lamp', false, 50);

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([light1, light2]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.lighting.summary.totalLights).toBe(2);
			expect(result.lighting.summary.lightsOn).toBe(1);
			expect(result.lighting.summary.averageBrightness).toBe(80);
			expect(result.lighting.lights).toHaveLength(2);

			// Check first light
			const lightState1 = result.lighting.lights.find((l) => l.deviceId === light1.id);
			expect(lightState1).toBeDefined();
			expect(lightState1.isOn).toBe(true);
			expect(lightState1.brightness).toBe(80);
			expect(lightState1.deviceName).toBe('Ceiling Light');

			// Check second light
			const lightState2 = result.lighting.lights.find((l) => l.deviceId === light2.id);
			expect(lightState2).toBeDefined();
			expect(lightState2.isOn).toBe(false);
			expect(lightState2.brightness).toBe(50);
		});

		it('should capture lighting roles', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Office');
			const light = createLightDevice(uuid(), 'Main Light', true, 100);
			const channelId = light.channels[0].id;

			const roleMap = new Map<string, SpaceLightingRoleEntity>();
			roleMap.set(`${light.id}:${channelId}`, {
				spaceId,
				deviceId: light.id,
				channelId,
				role: LightingRole.MAIN,
				priority: 0,
			} as SpaceLightingRoleEntity);

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([light]);
			lightingRoleService.getRoleMap.mockResolvedValue(roleMap);
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.lighting.lights[0].role).toBe(LightingRole.MAIN);
		});

		it('should capture color temperature and color', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Lounge');
			const light = createLightDevice(uuid(), 'RGB Light', true, 75, 4000, '#ff6b35');

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([light]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			const lightState = result.lighting.lights[0];
			expect(lightState.colorTemperature).toBe(4000);
			expect(lightState.color).toBe('#ff6b35');
		});

		it('should capture climate state', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Living Room');

			const climateState: ClimateState = {
				hasClimate: true,
				currentTemperature: 22.5,
				targetTemperature: 21.0,
				minSetpoint: 5,
				maxSetpoint: 35,
				canSetSetpoint: true,
			};

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(climateState);

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.climate.hasClimate).toBe(true);
			expect(result.climate.currentTemperature).toBe(22.5);
			expect(result.climate.targetTemperature).toBe(21.0);
			expect(result.climate.canSetSetpoint).toBe(true);
		});

		it('should calculate average brightness correctly for multiple lights', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Kitchen');
			const light1 = createLightDevice(uuid(), 'Light 1', true, 100);
			const light2 = createLightDevice(uuid(), 'Light 2', true, 60);
			const light3 = createLightDevice(uuid(), 'Light 3', false, 40); // Off, not included in average

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([light1, light2, light3]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.lighting.summary.totalLights).toBe(3);
			expect(result.lighting.summary.lightsOn).toBe(2);
			// Average of 100 and 60 = 80
			expect(result.lighting.summary.averageBrightness).toBe(80);
		});

		it('should handle lights without brightness property', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Hallway');
			const light = createLightDevice(uuid(), 'Simple Switch', true, null);

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([light]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.lighting.summary.totalLights).toBe(1);
			expect(result.lighting.summary.lightsOn).toBe(1);
			expect(result.lighting.summary.averageBrightness).toBeNull();
			expect(result.lighting.lights[0].brightness).toBeNull();
		});

		it('should include timestamp in snapshot', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Test Room');
			const beforeTime = new Date();

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			const afterTime = new Date();

			expect(result).not.toBeNull();
			expect(result.capturedAt).toBeInstanceOf(Date);
			expect(result.capturedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
			expect(result.capturedAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
		});

		it('should handle string boolean values for on property', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Test Room');

			// Create a light with string 'true' value
			const channelId = uuid();
			const channel: ChannelEntity = {
				id: channelId,
				category: ChannelCategory.LIGHT,
				name: 'Light',
				properties: [
					{
						id: uuid(),
						category: PropertyCategory.ON,
						name: 'On',
						dataType: 'boolean',
						value: 'true', // String instead of boolean
					} as unknown as ChannelPropertyEntity,
				],
			} as unknown as ChannelEntity;

			const light: DeviceEntity = {
				id: uuid(),
				name: 'String Value Light',
				category: DeviceCategory.LIGHTING,
				channels: [channel],
			} as unknown as DeviceEntity;

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([light]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.lighting.lights[0].isOn).toBe(true);
		});

		it('should handle numeric string brightness values', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Test Room');

			// Create a light with string brightness value
			const channelId = uuid();
			const channel: ChannelEntity = {
				id: channelId,
				category: ChannelCategory.LIGHT,
				name: 'Light',
				properties: [
					{
						id: uuid(),
						category: PropertyCategory.ON,
						name: 'On',
						dataType: 'boolean',
						value: true,
					} as unknown as ChannelPropertyEntity,
					{
						id: uuid(),
						category: PropertyCategory.BRIGHTNESS,
						name: 'Brightness',
						dataType: 'number',
						value: '75', // String instead of number
					} as unknown as ChannelPropertyEntity,
				],
			} as unknown as ChannelEntity;

			const light: DeviceEntity = {
				id: uuid(),
				name: 'String Brightness Light',
				category: DeviceCategory.LIGHTING,
				channels: [channel],
			} as unknown as DeviceEntity;

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([light]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			expect(result.lighting.lights[0].brightness).toBe(75);
		});

		it('should capture all light channels from multi-channel devices', async () => {
			const spaceId = uuid();
			const space = createSpace(spaceId, 'Living Room');

			// Create a device with multiple light channels (e.g., RGB+CCT light fixture)
			const channel1Id = uuid();
			const channel2Id = uuid();
			const channel1: ChannelEntity = {
				id: channel1Id,
				category: ChannelCategory.LIGHT,
				name: 'Main Light',
				properties: [
					{
						id: uuid(),
						category: PropertyCategory.ON,
						name: 'On',
						dataType: 'boolean',
						value: true,
					} as unknown as ChannelPropertyEntity,
					{
						id: uuid(),
						category: PropertyCategory.BRIGHTNESS,
						name: 'Brightness',
						dataType: 'number',
						value: 100,
					} as unknown as ChannelPropertyEntity,
				],
			} as unknown as ChannelEntity;

			const channel2: ChannelEntity = {
				id: channel2Id,
				category: ChannelCategory.LIGHT,
				name: 'Accent Light',
				properties: [
					{
						id: uuid(),
						category: PropertyCategory.ON,
						name: 'On',
						dataType: 'boolean',
						value: true,
					} as unknown as ChannelPropertyEntity,
					{
						id: uuid(),
						category: PropertyCategory.BRIGHTNESS,
						name: 'Brightness',
						dataType: 'number',
						value: 50,
					} as unknown as ChannelPropertyEntity,
				],
			} as unknown as ChannelEntity;

			const multiChannelDevice: DeviceEntity = {
				id: uuid(),
				name: 'Multi-Channel Light Fixture',
				category: DeviceCategory.LIGHTING,
				channels: [channel1, channel2],
			} as unknown as DeviceEntity;

			spacesService.findOne.mockResolvedValue(space);
			spacesService.findDevicesBySpace.mockResolvedValue([multiChannelDevice]);
			lightingRoleService.getRoleMap.mockResolvedValue(new Map());
			spaceIntentService.getClimateState.mockResolvedValue(createDefaultClimateState());

			const result = await service.captureSnapshot(spaceId);

			expect(result).not.toBeNull();
			// Should capture both light channels
			expect(result.lighting.summary.totalLights).toBe(2);
			expect(result.lighting.summary.lightsOn).toBe(2);
			// Average brightness should be (100 + 50) / 2 = 75
			expect(result.lighting.summary.averageBrightness).toBe(75);
			expect(result.lighting.lights).toHaveLength(2);
			expect(result.lighting.lights[0].channelName).toBe('Main Light');
			expect(result.lighting.lights[0].brightness).toBe(100);
			expect(result.lighting.lights[1].channelName).toBe('Accent Light');
			expect(result.lighting.lights[1].brightness).toBe(50);
		});
	});
});
