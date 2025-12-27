/*
eslint-disable @typescript-eslint/unbound-method
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { v4 as uuid } from 'uuid';

import { Test, TestingModule } from '@nestjs/testing';

import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceEntity } from '../../devices/entities/devices.entity';
import { DisplayEntity } from '../../displays/entities/displays.entity';
import { SpaceEntity } from '../entities/space.entity';
import { SpaceContextSnapshotService } from '../services/space-context-snapshot.service';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceLightingRoleService } from '../services/space-lighting-role.service';
import { SpaceSuggestionService } from '../services/space-suggestion.service';
import { SpaceUndoHistoryService } from '../services/space-undo-history.service';
import { SpacesService } from '../services/spaces.service';
import {
	IntentCategory,
	LightingIntentType,
	LightingMode,
	LightingRole,
	QuickActionType,
	SpaceType,
} from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';

import { SpacesController } from './spaces.controller';

describe('SpacesController', () => {
	let controller: SpacesController;
	let spacesService: SpacesService;
	let spaceIntentService: SpaceIntentService;

	const mockSpace: SpaceEntity = {
		id: uuid().toString(),
		name: 'Living Room',
		description: 'Main living area',
		type: SpaceType.ROOM,
		icon: 'mdi:sofa',
		displayOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as SpaceEntity;

	const mockDevice: DeviceEntity = {
		id: uuid().toString(),
		name: 'Living Room Light',
		spaceId: mockSpace.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as DeviceEntity;

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		name: 'Living Room Panel',
		spaceId: mockSpace.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as DisplayEntity;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			controllers: [SpacesController],
			providers: [
				{
					provide: SpacesService,
					useValue: {
						findAll: jest.fn().mockResolvedValue([toInstance(SpaceEntity, mockSpace)]),
						findOne: jest.fn().mockResolvedValue(toInstance(SpaceEntity, mockSpace)),
						getOneOrThrow: jest.fn().mockResolvedValue(toInstance(SpaceEntity, mockSpace)),
						create: jest.fn().mockResolvedValue(toInstance(SpaceEntity, mockSpace)),
						update: jest.fn().mockResolvedValue(toInstance(SpaceEntity, mockSpace)),
						remove: jest.fn().mockResolvedValue(undefined),
						findDevicesBySpace: jest.fn().mockResolvedValue([toInstance(DeviceEntity, mockDevice)]),
						findDisplaysBySpace: jest.fn().mockResolvedValue([toInstance(DisplayEntity, mockDisplay)]),
						bulkAssign: jest.fn().mockResolvedValue({ devicesAssigned: 2, displaysAssigned: 1 }),
						proposeSpaces: jest.fn().mockResolvedValue([
							{ name: 'Living Room', deviceIds: [uuid()], deviceCount: 1 },
							{ name: 'Bedroom', deviceIds: [uuid(), uuid()], deviceCount: 2 },
						]),
					},
				},
				{
					provide: SpaceIntentService,
					useValue: {
						executeLightingIntent: jest.fn().mockResolvedValue({
							success: true,
							affectedDevices: 2,
							failedDevices: 0,
						}),
					},
				},
				{
					provide: SpaceLightingRoleService,
					useValue: {
						findBySpace: jest.fn().mockResolvedValue([]),
						findOne: jest.fn().mockResolvedValue(null),
						setRole: jest.fn().mockResolvedValue({}),
						bulkSetRoles: jest.fn().mockResolvedValue(0),
						deleteRole: jest.fn().mockResolvedValue(undefined),
						getLightTargetsInSpace: jest.fn().mockResolvedValue([]),
						inferDefaultLightingRoles: jest.fn().mockResolvedValue([]),
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: SpaceSuggestionService,
					useValue: {
						getSuggestion: jest.fn().mockResolvedValue(null),
						recordFeedback: jest.fn().mockResolvedValue({ success: true }),
					},
				},
				{
					provide: SpaceContextSnapshotService,
					useValue: {
						captureSnapshot: jest.fn().mockResolvedValue({
							spaceId: uuid(),
							spaceName: 'Test Space',
							lighting: {
								summary: { totalLights: 0, lightsOn: 0, averageBrightness: null },
								lights: [],
							},
							climate: { hasClimate: false },
							capturedAt: new Date(),
						}),
					},
				},
				{
					provide: SpaceUndoHistoryService,
					useValue: {
						peekUndoEntry: jest.fn().mockReturnValue(null),
						executeUndo: jest.fn().mockResolvedValue({
							success: true,
							restoredDevices: 0,
							failedDevices: 0,
							message: '',
						}),
					},
				},
			],
		}).compile();

		controller = module.get<SpacesController>(SpacesController);
		spacesService = module.get<SpacesService>(SpacesService);
		spaceIntentService = module.get<SpaceIntentService>(SpaceIntentService);
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
		expect(spacesService).toBeDefined();
		expect(spaceIntentService).toBeDefined();
	});

	describe('findAll', () => {
		it('should return all spaces', async () => {
			const result = await controller.findAll();

			expect(result.data).toEqual([toInstance(SpaceEntity, mockSpace)]);
			expect(spacesService.findAll).toHaveBeenCalled();
		});
	});

	describe('findOne', () => {
		it('should return a single space', async () => {
			const result = await controller.findOne(mockSpace.id);

			expect(result.data).toEqual(toInstance(SpaceEntity, mockSpace));
			expect(spacesService.getOneOrThrow).toHaveBeenCalledWith(mockSpace.id);
		});

		it('should throw NotFoundException when space not found', async () => {
			jest.spyOn(spacesService, 'getOneOrThrow').mockRejectedValue(new SpacesNotFoundException('Not found'));

			await expect(controller.findOne('non-existent-id')).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('create', () => {
		it('should create a new space', async () => {
			const createDto = {
				data: {
					name: 'New Space',
					type: SpaceType.ROOM,
				},
			};

			const result = await controller.create(createDto as any);

			expect(result.data).toEqual(toInstance(SpaceEntity, mockSpace));
			expect(spacesService.create).toHaveBeenCalledWith(createDto.data);
		});

		it('should throw UnprocessableEntityException on validation error', async () => {
			jest.spyOn(spacesService, 'create').mockRejectedValue(new SpacesValidationException('Invalid data'));

			const createDto = {
				data: {
					name: '',
					type: SpaceType.ROOM,
				},
			};

			await expect(controller.create(createDto as any)).rejects.toThrow(SpacesValidationException);
		});
	});

	describe('update', () => {
		it('should update a space', async () => {
			const updateDto = {
				data: {
					name: 'Updated Space',
				},
			};

			const result = await controller.update(mockSpace.id, updateDto as any);

			expect(result.data).toEqual(toInstance(SpaceEntity, mockSpace));
			expect(spacesService.update).toHaveBeenCalledWith(mockSpace.id, updateDto.data);
		});

		it('should throw NotFoundException when space not found', async () => {
			jest.spyOn(spacesService, 'update').mockRejectedValue(new SpacesNotFoundException('Not found'));

			const updateDto = {
				data: {
					name: 'Updated Space',
				},
			};

			await expect(controller.update('non-existent-id', updateDto as any)).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('remove', () => {
		it('should delete a space', async () => {
			const result = await controller.remove(mockSpace.id);

			expect(result).toBeUndefined();
			expect(spacesService.remove).toHaveBeenCalledWith(mockSpace.id);
		});

		it('should throw NotFoundException when space not found', async () => {
			jest.spyOn(spacesService, 'remove').mockRejectedValue(new SpacesNotFoundException('Not found'));

			await expect(controller.remove('non-existent-id')).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('findDevices', () => {
		it('should return devices in a space', async () => {
			const result = await controller.findDevices(mockSpace.id);

			expect(result.data).toEqual([toInstance(DeviceEntity, mockDevice)]);
			expect(spacesService.findDevicesBySpace).toHaveBeenCalledWith(mockSpace.id);
		});

		it('should throw NotFoundException when space not found', async () => {
			jest.spyOn(spacesService, 'findDevicesBySpace').mockRejectedValue(new SpacesNotFoundException('Not found'));

			await expect(controller.findDevices('non-existent-id')).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('findDisplays', () => {
		it('should return displays in a space', async () => {
			const result = await controller.findDisplays(mockSpace.id);

			expect(result.data).toEqual([toInstance(DisplayEntity, mockDisplay)]);
			expect(spacesService.findDisplaysBySpace).toHaveBeenCalledWith(mockSpace.id);
		});

		it('should throw NotFoundException when space not found', async () => {
			jest.spyOn(spacesService, 'findDisplaysBySpace').mockRejectedValue(new SpacesNotFoundException('Not found'));

			await expect(controller.findDisplays('non-existent-id')).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('proposeSpaces', () => {
		it('should return proposed spaces', async () => {
			const result = await controller.proposeSpaces();

			expect(result.data).toHaveLength(2);
			expect(result.data[0].name).toBe('Living Room');
			expect(result.data[0].deviceCount).toBe(1);
			expect(result.data[1].name).toBe('Bedroom');
			expect(result.data[1].deviceCount).toBe(2);
			expect(spacesService.proposeSpaces).toHaveBeenCalled();
		});
	});

	describe('bulkAssign', () => {
		it('should bulk assign devices and displays to a space', async () => {
			const assignDto = {
				data: {
					deviceIds: [uuid(), uuid()],
					displayIds: [uuid()],
				},
			};

			const result = await controller.bulkAssign(mockSpace.id, assignDto as any);

			expect(result.data.success).toBe(true);
			expect(result.data.devicesAssigned).toBe(2);
			expect(result.data.displaysAssigned).toBe(1);
			expect(spacesService.bulkAssign).toHaveBeenCalledWith(mockSpace.id, assignDto.data);
		});

		it('should throw NotFoundException when space not found', async () => {
			jest.spyOn(spacesService, 'bulkAssign').mockRejectedValue(new SpacesNotFoundException('Not found'));

			const assignDto = {
				data: {
					deviceIds: [uuid()],
				},
			};

			await expect(controller.bulkAssign('non-existent-id', assignDto as any)).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('executeLightingIntent', () => {
		it('should execute OFF lighting intent', async () => {
			const intentDto = {
				data: {
					type: LightingIntentType.OFF,
				},
			};

			const result = await controller.executeLightingIntent(mockSpace.id, intentDto as any);

			expect(result.data.success).toBe(true);
			expect(result.data.affectedDevices).toBe(2);
			expect(result.data.failedDevices).toBe(0);
			expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(mockSpace.id, intentDto.data);
		});

		it('should execute ON lighting intent', async () => {
			const intentDto = {
				data: {
					type: LightingIntentType.ON,
				},
			};

			await controller.executeLightingIntent(mockSpace.id, intentDto as any);

			expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(mockSpace.id, intentDto.data);
		});

		it('should execute SET_MODE lighting intent with mode', async () => {
			const intentDto = {
				data: {
					type: LightingIntentType.SET_MODE,
					mode: LightingMode.RELAX,
				},
			};

			await controller.executeLightingIntent(mockSpace.id, intentDto as any);

			expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(mockSpace.id, intentDto.data);
		});

		it('should throw NotFoundException when space not found', async () => {
			jest
				.spyOn(spaceIntentService, 'executeLightingIntent')
				.mockRejectedValue(new SpacesNotFoundException('Not found'));

			const intentDto = {
				data: {
					type: LightingIntentType.OFF,
				},
			};

			await expect(controller.executeLightingIntent('non-existent-id', intentDto as any)).rejects.toThrow(
				SpacesNotFoundException,
			);
		});

		it('should return result with failed devices on partial failure', async () => {
			jest.spyOn(spaceIntentService, 'executeLightingIntent').mockResolvedValue({
				success: true,
				affectedDevices: 1,
				failedDevices: 1,
			});

			const intentDto = {
				data: {
					type: LightingIntentType.ON,
				},
			};

			const result = await controller.executeLightingIntent(mockSpace.id, intentDto as any);

			expect(result.data.affectedDevices).toBe(1);
			expect(result.data.failedDevices).toBe(1);
		});
	});

	describe('getIntentCatalog', () => {
		it('should return the complete intent catalog', () => {
			const result = controller.getIntentCatalog();

			expect(result.data).toBeDefined();
			expect(result.data.categories).toBeDefined();
			expect(result.data.quickActions).toBeDefined();
			expect(result.data.lightingRoles).toBeDefined();
		});

		it('should include lighting and climate categories', () => {
			const result = controller.getIntentCatalog();

			const categoryValues = result.data.categories.map((c) => c.category);
			expect(categoryValues).toContain(IntentCategory.LIGHTING);
			expect(categoryValues).toContain(IntentCategory.CLIMATE);
		});

		it('should include lighting intents with proper structure', () => {
			const result = controller.getIntentCatalog();

			const lightingCategory = result.data.categories.find((c) => c.category === IntentCategory.LIGHTING);

			if (!lightingCategory) {
				throw new Error('Lighting category not found');
			}

			expect(lightingCategory.intents.length).toBeGreaterThan(0);

			// Check that off intent exists and has no params
			const offIntent = lightingCategory.intents.find((i) => i.type === 'off');

			if (!offIntent) {
				throw new Error('Off intent not found');
			}

			expect(offIntent.label).toBe('Turn Off');
			expect(offIntent.params).toEqual([]);

			// Check that set_mode intent has mode param with enum values
			const setModeIntent = lightingCategory.intents.find((i) => i.type === 'set_mode');

			if (!setModeIntent) {
				throw new Error('Set mode intent not found');
			}

			expect(setModeIntent.params.length).toBe(1);
			expect(setModeIntent.params[0].name).toBe('mode');
			expect(setModeIntent.params[0].type).toBe('enum');
			expect(setModeIntent.params[0].enumValues).toBeDefined();
			expect(setModeIntent.params[0].enumValues?.length).toBe(3); // work, relax, night
		});

		it('should include climate intents with proper structure', () => {
			const result = controller.getIntentCatalog();

			const climateCategory = result.data.categories.find((c) => c.category === IntentCategory.CLIMATE);

			if (!climateCategory) {
				throw new Error('Climate category not found');
			}

			expect(climateCategory.intents.length).toBeGreaterThan(0);

			// Check that setpoint_set intent has value param with min/max
			const setpointSetIntent = climateCategory.intents.find((i) => i.type === 'setpoint_set');

			if (!setpointSetIntent) {
				throw new Error('Setpoint set intent not found');
			}

			expect(setpointSetIntent.params.length).toBe(1);
			expect(setpointSetIntent.params[0].name).toBe('value');
			expect(setpointSetIntent.params[0].type).toBe('number');
			expect(setpointSetIntent.params[0].minValue).toBeDefined();
			expect(setpointSetIntent.params[0].maxValue).toBeDefined();
		});

		it('should include all quick action types', () => {
			const result = controller.getIntentCatalog();

			const quickActionTypes = result.data.quickActions.map((qa) => qa.type);
			expect(quickActionTypes).toContain(QuickActionType.LIGHTING_OFF);
			expect(quickActionTypes).toContain(QuickActionType.LIGHTING_WORK);
			expect(quickActionTypes).toContain(QuickActionType.LIGHTING_RELAX);
			expect(quickActionTypes).toContain(QuickActionType.LIGHTING_NIGHT);
			expect(quickActionTypes).toContain(QuickActionType.BRIGHTNESS_UP);
			expect(quickActionTypes).toContain(QuickActionType.BRIGHTNESS_DOWN);
			expect(quickActionTypes).toContain(QuickActionType.CLIMATE_UP);
			expect(quickActionTypes).toContain(QuickActionType.CLIMATE_DOWN);
		});

		it('should include all lighting roles', () => {
			const result = controller.getIntentCatalog();

			const roleValues = result.data.lightingRoles.map((r) => r.value);
			expect(roleValues).toContain(LightingRole.MAIN);
			expect(roleValues).toContain(LightingRole.TASK);
			expect(roleValues).toContain(LightingRole.AMBIENT);
			expect(roleValues).toContain(LightingRole.ACCENT);
			expect(roleValues).toContain(LightingRole.NIGHT);
			expect(roleValues).toContain(LightingRole.OTHER);
		});

		it('should include labels and icons for all items', () => {
			const result = controller.getIntentCatalog();

			// Check categories have labels and icons
			result.data.categories.forEach((cat) => {
				expect(cat.label).toBeDefined();
				expect(cat.label.length).toBeGreaterThan(0);
				expect(cat.icon).toBeDefined();
				expect(cat.icon.length).toBeGreaterThan(0);
			});

			// Check quick actions have labels and icons
			result.data.quickActions.forEach((qa) => {
				expect(qa.label).toBeDefined();
				expect(qa.label.length).toBeGreaterThan(0);
				expect(qa.icon).toBeDefined();
				expect(qa.icon.length).toBeGreaterThan(0);
			});

			// Check lighting roles have labels
			result.data.lightingRoles.forEach((role) => {
				expect(role.label).toBeDefined();
				expect(role.label.length).toBeGreaterThan(0);
			});
		});
	});
});
