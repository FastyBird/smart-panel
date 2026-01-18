/*
eslint-disable @typescript-eslint/unbound-method,@typescript-eslint/no-unsafe-assignment
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
import { SpaceClimateRoleService } from '../services/space-climate-role.service';
import { SpaceContextSnapshotService } from '../services/space-context-snapshot.service';
import { SpaceCoversRoleService } from '../services/space-covers-role.service';
import { SpaceIntentService } from '../services/space-intent.service';
import { SpaceLightingRoleService } from '../services/space-lighting-role.service';
import { SpaceLightingStateService } from '../services/space-lighting-state.service';
import { SpaceMediaRoleService } from '../services/space-media-role.service';
import { SpaceMediaStateService } from '../services/space-media-state.service';
import { SpaceSensorRoleService } from '../services/space-sensor-role.service';
import { SpaceSensorStateService } from '../services/space-sensor-state.service';
import { SpaceSuggestionService } from '../services/space-suggestion.service';
import { SpaceUndoHistoryService } from '../services/space-undo-history.service';
import { SpacesService } from '../services/spaces.service';
import {
	ClimateMode,
	IntentCategory,
	LightingIntentType,
	LightingMode,
	LightingRole,
	QuickActionType,
	SpaceType,
	SuggestionType,
} from '../spaces.constants';
import { SpacesNotFoundException, SpacesValidationException } from '../spaces.exceptions';
import { IntentSpecLoaderService } from '../spec';

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
		roomId: mockSpace.id,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as DeviceEntity;

	const mockDisplay: DisplayEntity = {
		id: uuid().toString(),
		name: 'Living Room Panel',
		roomId: mockSpace.id,
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
						getChildRooms: jest.fn().mockResolvedValue([]),
						getParentZone: jest.fn().mockResolvedValue(null),
						findAllZones: jest.fn().mockResolvedValue([]),
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
						getClimateState: jest.fn().mockResolvedValue({
							hasClimate: false,
							mode: ClimateMode.OFF,
							currentTemperature: null,
							currentHumidity: null,
							heatingSetpoint: null,
							coolingSetpoint: null,
							minSetpoint: 15,
							maxSetpoint: 30,
							supportsHeating: false,
							supportsCooling: false,
							isHeating: false,
							isCooling: false,
							isMixed: false,
							devicesCount: 0,
							lastAppliedMode: null,
							lastAppliedAt: null,
						}),
						executeClimateIntent: jest.fn().mockResolvedValue({
							success: true,
							affectedDevices: 1,
							failedDevices: 0,
							mode: ClimateMode.HEAT,
							heatingSetpoint: 22.0,
							coolingSetpoint: null,
						}),
					},
				},
				{
					provide: SpaceLightingRoleService,
					useValue: {
						findBySpace: jest.fn().mockResolvedValue([]),
						findOne: jest.fn().mockResolvedValue(null),
						setRole: jest.fn().mockResolvedValue({}),
						bulkSetRoles: jest.fn().mockResolvedValue({
							success: true,
							totalCount: 0,
							successCount: 0,
							failureCount: 0,
							results: [],
						}),
						deleteRole: jest.fn().mockResolvedValue(undefined),
						getLightTargetsInSpace: jest.fn().mockResolvedValue([]),
						inferDefaultLightingRoles: jest.fn().mockResolvedValue([]),
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: SpaceLightingStateService,
					useValue: {
						getLightingState: jest.fn().mockResolvedValue({
							detectedMode: null,
							modeConfidence: 'none',
							modeMatchPercentage: null,
							lastAppliedMode: null,
							lastAppliedAt: null,
							totalLights: 0,
							lightsOn: 0,
							averageBrightness: null,
							roles: {},
							other: {
								isOn: false,
								brightness: null,
								isMixed: false,
								devicesCount: 0,
								devicesOn: 0,
							},
						}),
					},
				},
				{
					provide: SpaceClimateRoleService,
					useValue: {
						findBySpace: jest.fn().mockResolvedValue([]),
						findOne: jest.fn().mockResolvedValue(null),
						setRole: jest.fn().mockResolvedValue({}),
						bulkSetRoles: jest.fn().mockResolvedValue({
							success: true,
							totalCount: 0,
							successCount: 0,
							failureCount: 0,
							results: [],
						}),
						deleteRole: jest.fn().mockResolvedValue(undefined),
						getClimateTargetsInSpace: jest.fn().mockResolvedValue([]),
						inferDefaultClimateRoles: jest.fn().mockResolvedValue([]),
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: SpaceCoversRoleService,
					useValue: {
						findBySpace: jest.fn().mockResolvedValue([]),
						findOne: jest.fn().mockResolvedValue(null),
						setRole: jest.fn().mockResolvedValue({}),
						bulkSetRoles: jest.fn().mockResolvedValue({
							success: true,
							totalCount: 0,
							successCount: 0,
							failureCount: 0,
							results: [],
						}),
						deleteRole: jest.fn().mockResolvedValue(undefined),
						getCoversTargetsInSpace: jest.fn().mockResolvedValue([]),
						inferDefaultCoversRoles: jest.fn().mockResolvedValue([]),
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: SpaceMediaRoleService,
					useValue: {
						findBySpace: jest.fn().mockResolvedValue([]),
						findOne: jest.fn().mockResolvedValue(null),
						setRole: jest.fn().mockResolvedValue({}),
						bulkSetRoles: jest.fn().mockResolvedValue({
							success: true,
							totalCount: 0,
							successCount: 0,
							failureCount: 0,
							results: [],
						}),
						deleteRole: jest.fn().mockResolvedValue(undefined),
						getMediaTargetsInSpace: jest.fn().mockResolvedValue([]),
						inferDefaultMediaRoles: jest.fn().mockResolvedValue([]),
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: SpaceMediaStateService,
					useValue: {
						getMediaState: jest.fn().mockResolvedValue(null),
					},
				},
				{
					provide: SpaceSensorRoleService,
					useValue: {
						findBySpace: jest.fn().mockResolvedValue([]),
						findOne: jest.fn().mockResolvedValue(null),
						setRole: jest.fn().mockResolvedValue({}),
						bulkSetRoles: jest.fn().mockResolvedValue({
							success: true,
							totalCount: 0,
							successCount: 0,
							failureCount: 0,
							results: [],
						}),
						deleteRole: jest.fn().mockResolvedValue(undefined),
						getSensorTargetsInSpace: jest.fn().mockResolvedValue([]),
						inferDefaultSensorRoles: jest.fn().mockResolvedValue([]),
						getRoleMap: jest.fn().mockResolvedValue(new Map()),
					},
				},
				{
					provide: SpaceSensorStateService,
					useValue: {
						getSensorState: jest.fn().mockResolvedValue({
							hasSensors: false,
							totalSensors: 0,
							sensorsByRole: {},
							environment: null,
							safetyAlerts: [],
							hasSafetyAlert: false,
							motionDetected: false,
							occupancyDetected: false,
							readings: [],
						}),
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
							roomId: uuid(),
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
						getEntryTtlMs: jest.fn().mockReturnValue(5 * 60 * 1000),
					},
				},
				{
					provide: IntentSpecLoaderService,
					useValue: {
						getIntentCatalog: jest.fn().mockReturnValue([
							{
								category: 'lighting',
								label: 'Lighting',
								description: 'Control lights',
								icon: 'mdi:lightbulb-group',
								intents: [
									{
										type: 'off',
										label: 'Turn Off',
										description: 'Turn off all lights',
										icon: 'mdi:lightbulb-off',
										params: [],
									},
									{
										type: 'on',
										label: 'Turn On',
										description: 'Turn on all lights',
										icon: 'mdi:lightbulb-on',
										params: [],
									},
									{
										type: 'set_mode',
										label: 'Set Mode',
										description: 'Set lighting mode',
										icon: 'mdi:lightbulb-group',
										params: [
											{
												name: 'mode',
												type: 'enum',
												required: true,
												description: 'The lighting mode',
												enumValues: [
													{ value: 'work', label: 'Work' },
													{ value: 'relax', label: 'Relax' },
													{ value: 'night', label: 'Night' },
												],
											},
										],
									},
									{
										type: 'brightness_delta',
										label: 'Adjust Brightness',
										description: 'Adjust brightness',
										icon: 'mdi:brightness-6',
										params: [
											{
												name: 'delta',
												type: 'enum',
												required: true,
												description: 'The step size',
												enumValues: [
													{ value: 'small', label: 'Small' },
													{ value: 'medium', label: 'Medium' },
													{ value: 'large', label: 'Large' },
												],
											},
											{ name: 'increase', type: 'boolean', required: true, description: 'Increase direction' },
										],
									},
									{
										type: 'role_on',
										label: 'Turn Role On',
										description: 'Turn on lights with role',
										icon: 'mdi:lightbulb-on',
										params: [
											{
												name: 'role',
												type: 'enum',
												required: true,
												description: 'The lighting role',
												enumValues: [
													{ value: 'main', label: 'Main', description: 'Primary lights', icon: 'mdi:ceiling-light' },
													{ value: 'task', label: 'Task', description: 'Task lights', icon: 'mdi:desk-lamp' },
													{
														value: 'ambient',
														label: 'Ambient',
														description: 'Ambient lights',
														icon: 'mdi:led-strip-variant',
													},
													{ value: 'accent', label: 'Accent', description: 'Accent lights', icon: 'mdi:wall-sconce' },
													{ value: 'night', label: 'Night', description: 'Night lights', icon: 'mdi:lightbulb-night' },
													{ value: 'other', label: 'Other', description: 'Unclassified lights', icon: 'mdi:lightbulb' },
												],
											},
										],
									},
								],
							},
							{
								category: 'climate',
								label: 'Climate',
								description: 'Control climate',
								icon: 'mdi:thermostat',
								intents: [
									{
										type: 'setpoint_delta',
										label: 'Adjust Temperature',
										description: 'Adjust temperature',
										icon: 'mdi:thermometer',
										params: [
											{
												name: 'delta',
												type: 'enum',
												required: true,
												description: 'The step size',
												enumValues: [
													{ value: 'small', label: 'Small' },
													{ value: 'medium', label: 'Medium' },
													{ value: 'large', label: 'Large' },
												],
											},
											{ name: 'increase', type: 'boolean', required: true, description: 'Increase direction' },
										],
									},
									{
										type: 'setpoint_set',
										label: 'Set Temperature',
										description: 'Set temperature',
										icon: 'mdi:thermometer-check',
										params: [
											{
												name: 'value',
												type: 'number',
												required: true,
												description: 'Target temperature',
												minValue: -10,
												maxValue: 50,
											},
										],
									},
									{
										type: 'set_mode',
										label: 'Set Climate Mode',
										description: 'Set climate mode',
										icon: 'mdi:thermostat',
										params: [
											{
												name: 'mode',
												type: 'enum',
												required: true,
												description: 'The climate mode',
												enumValues: [
													{ value: 'heat', label: 'Heat' },
													{ value: 'cool', label: 'Cool' },
													{ value: 'auto', label: 'Auto' },
													{ value: 'off', label: 'Off' },
												],
											},
										],
									},
								],
							},
						]),
						getLightingModeOrchestration: jest.fn().mockReturnValue(null),
						getBrightnessDeltaStep: jest.fn().mockReturnValue(25),
						getSetpointDeltaStep: jest.fn().mockReturnValue(1.0),
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

		it('should throw NotFoundException when space not found (service rejects)', async () => {
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

		it('should throw NotFoundException when space not found (null return)', async () => {
			jest.spyOn(spaceIntentService, 'executeLightingIntent').mockResolvedValue(null);

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

	describe('getCategoryTemplates', () => {
		it('should return category templates', () => {
			const result = controller.getCategoryTemplates();

			expect(result.data).toBeDefined();
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data.length).toBeGreaterThan(0);

			// Each template should have category, icon, and description
			result.data.forEach((template) => {
				expect(template.category).toBeDefined();
				expect(template.icon).toBeDefined();
				expect(template.description).toBeDefined();
			});
		});
	});

	describe('findChildren', () => {
		it('should return child rooms of a zone', async () => {
			jest.spyOn(spacesService, 'getChildRooms').mockResolvedValue([toInstance(SpaceEntity, mockSpace)]);

			const result = await controller.findChildren(mockSpace.id);

			expect(result.data).toEqual([toInstance(SpaceEntity, mockSpace)]);
			expect(spacesService.getChildRooms).toHaveBeenCalledWith(mockSpace.id);
		});

		it('should return empty array for room without children', async () => {
			jest.spyOn(spacesService, 'getChildRooms').mockResolvedValue([]);

			const result = await controller.findChildren(mockSpace.id);

			expect(result.data).toEqual([]);
		});
	});

	describe('findParent', () => {
		it('should return parent zone of a room', async () => {
			const parentZone = { ...mockSpace, type: SpaceType.ZONE, name: 'Ground Floor' };
			jest.spyOn(spacesService, 'getParentZone').mockResolvedValue(toInstance(SpaceEntity, parentZone));

			const result = await controller.findParent(mockSpace.id);

			expect(result.data).toEqual(toInstance(SpaceEntity, parentZone));
			expect(spacesService.getParentZone).toHaveBeenCalledWith(mockSpace.id);
		});

		it('should return null for room without parent', async () => {
			jest.spyOn(spacesService, 'getParentZone').mockResolvedValue(null);

			const result = await controller.findParent(mockSpace.id);

			expect(result.data).toBeNull();
		});
	});

	describe('findAllZones', () => {
		it('should return all zones', async () => {
			const zone = { ...mockSpace, type: SpaceType.ZONE, name: 'Ground Floor' };
			jest.spyOn(spacesService, 'findAllZones').mockResolvedValue([toInstance(SpaceEntity, zone)]);

			const result = await controller.findAllZones();

			expect(result.data).toHaveLength(1);
			expect(spacesService.findAllZones).toHaveBeenCalled();
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

			expect(setpointSetIntent.params.length).toBeGreaterThanOrEqual(1);

			// Check 'value' param exists with min/max
			const valueParam = setpointSetIntent.params.find((p) => p.name === 'value');
			expect(valueParam).toBeDefined();
			expect(valueParam?.type).toBe('number');
			expect(valueParam?.minValue).toBeDefined();
			expect(valueParam?.maxValue).toBeDefined();
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

	describe('getClimateState', () => {
		it('should return climate state for a space', async () => {
			const climateState = {
				hasClimate: true,
				mode: ClimateMode.HEAT,
				currentTemperature: 22.5,
				currentHumidity: 45,
				heatingSetpoint: 21.0,
				coolingSetpoint: null,
				minSetpoint: 16,
				maxSetpoint: 30,
				supportsHeating: true,
				supportsCooling: false,
				isHeating: true,
				isCooling: false,
				isMixed: false,
				devicesCount: 1,
				lastAppliedMode: null,
				lastAppliedAt: null,
			};
			jest.spyOn(spaceIntentService, 'getClimateState').mockResolvedValue(climateState);

			const result = await controller.getClimateState(mockSpace.id);

			expect(result.data.hasClimate).toBe(true);
			expect(result.data.currentTemperature).toBe(22.5);
			expect(result.data.heatingSetpoint).toBe(21.0);
			expect(spaceIntentService.getClimateState).toHaveBeenCalledWith(mockSpace.id);
		});

		it('should return hasClimate false when no climate devices', async () => {
			jest.spyOn(spaceIntentService, 'getClimateState').mockResolvedValue({
				hasClimate: false,
				mode: ClimateMode.OFF,
				currentTemperature: null,
				currentHumidity: null,
				heatingSetpoint: null,
				coolingSetpoint: null,
				minSetpoint: 15,
				maxSetpoint: 30,
				supportsHeating: false,
				supportsCooling: false,
				isHeating: false,
				isCooling: false,
				isMixed: false,
				devicesCount: 0,
				lastAppliedMode: null,
				lastAppliedAt: null,
			});

			const result = await controller.getClimateState(mockSpace.id);

			expect(result.data.hasClimate).toBe(false);
		});

		it('should throw NotFoundException when space not found (null return)', async () => {
			jest.spyOn(spaceIntentService, 'getClimateState').mockResolvedValue(null);

			await expect(controller.getClimateState('non-existent-id')).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('executeClimateIntent', () => {
		it('should execute climate intent', async () => {
			jest.spyOn(spaceIntentService, 'executeClimateIntent').mockResolvedValue({
				success: true,
				affectedDevices: 1,
				failedDevices: 0,
				mode: ClimateMode.HEAT,
				heatingSetpoint: 22.0,
				coolingSetpoint: null,
			});

			const intentDto = {
				data: {
					type: 'setpoint_set',
					heating_setpoint: 22.0,
				},
			};

			const result = await controller.executeClimateIntent(mockSpace.id, intentDto as any);

			expect(result.data.success).toBe(true);
			expect(result.data.heatingSetpoint).toBe(22.0);
			expect(spaceIntentService.executeClimateIntent).toHaveBeenCalledWith(mockSpace.id, intentDto.data);
		});

		it('should throw NotFoundException when space not found (null return)', async () => {
			jest.spyOn(spaceIntentService, 'executeClimateIntent').mockResolvedValue(null);

			const intentDto = {
				data: {
					type: 'setpoint_set',
					heating_setpoint: 22.0,
				},
			};

			await expect(controller.executeClimateIntent('non-existent-id', intentDto as any)).rejects.toThrow(
				SpacesNotFoundException,
			);
		});
	});

	describe('getLightTargets', () => {
		let spaceLightingRoleService: SpaceLightingRoleService;

		beforeEach(() => {
			spaceLightingRoleService = controller['spaceLightingRoleService'];
		});

		it('should return light targets in a space', async () => {
			const mockTargets = [
				{
					deviceId: uuid(),
					deviceName: 'Living Room Light',
					channelId: uuid(),
					channelName: 'light',
					role: LightingRole.MAIN,
					priority: 1,
					hasBrightness: true,
					hasColorTemp: false,
					hasColor: false,
				},
			];
			jest.spyOn(spaceLightingRoleService, 'getLightTargetsInSpace').mockResolvedValue(mockTargets);

			const result = await controller.getLightTargets(mockSpace.id);

			expect(result.data).toHaveLength(1);
			expect(result.data[0].deviceName).toBe('Living Room Light');
			expect(result.data[0].role).toBe(LightingRole.MAIN);
		});
	});

	describe('setLightingRole', () => {
		let spaceLightingRoleService: SpaceLightingRoleService;

		beforeEach(() => {
			spaceLightingRoleService = controller['spaceLightingRoleService'];
		});

		it('should set lighting role for a light target', async () => {
			const mockRole = {
				id: uuid(),
				spaceId: mockSpace.id,
				deviceId: uuid(),
				channelId: uuid(),
				role: LightingRole.AMBIENT,
				priority: 2,
				space: null as any,
				device: null as any,
				channel: null as any,
				createdAt: new Date(),
				updatedAt: null,
			};
			jest.spyOn(spaceLightingRoleService, 'setRole').mockResolvedValue(mockRole as any);

			const roleDto = {
				data: {
					deviceId: mockRole.deviceId,
					channelId: mockRole.channelId,
					role: LightingRole.AMBIENT,
				},
			};

			const result = await controller.setLightingRole(mockSpace.id, roleDto as any);

			expect(result.data).toEqual(mockRole);
			expect(spaceLightingRoleService.setRole).toHaveBeenCalledWith(mockSpace.id, roleDto.data);
		});
	});

	describe('bulkSetLightingRoles', () => {
		let spaceLightingRoleService: SpaceLightingRoleService;

		beforeEach(() => {
			spaceLightingRoleService = controller['spaceLightingRoleService'];
		});

		it('should bulk set lighting roles', async () => {
			const mockDeviceId1 = uuid();
			const mockChannelId1 = uuid();
			const mockDeviceId2 = uuid();
			const mockChannelId2 = uuid();
			const mockDeviceId3 = uuid();
			const mockChannelId3 = uuid();

			jest.spyOn(spaceLightingRoleService, 'bulkSetRoles').mockResolvedValue({
				success: true,
				totalCount: 3,
				successCount: 3,
				failureCount: 0,
				results: [
					{ deviceId: mockDeviceId1, channelId: mockChannelId1, success: true, role: LightingRole.MAIN, error: null },
					{
						deviceId: mockDeviceId2,
						channelId: mockChannelId2,
						success: true,
						role: LightingRole.AMBIENT,
						error: null,
					},
					{
						deviceId: mockDeviceId3,
						channelId: mockChannelId3,
						success: true,
						role: LightingRole.ACCENT,
						error: null,
					},
				],
			});

			const rolesDto = {
				data: {
					roles: [
						{ deviceId: mockDeviceId1, channelId: mockChannelId1, role: LightingRole.MAIN },
						{ deviceId: mockDeviceId2, channelId: mockChannelId2, role: LightingRole.AMBIENT },
						{ deviceId: mockDeviceId3, channelId: mockChannelId3, role: LightingRole.ACCENT },
					],
				},
			};

			const result = await controller.bulkSetLightingRoles(mockSpace.id, rolesDto as any);

			expect(result.data.success).toBe(true);
			expect(result.data.totalCount).toBe(3);
			expect(result.data.successCount).toBe(3);
			expect(result.data.failureCount).toBe(0);
			expect(result.data.results).toHaveLength(3);
		});
	});

	describe('applyDefaultLightingRoles', () => {
		let spaceLightingRoleService: SpaceLightingRoleService;

		beforeEach(() => {
			spaceLightingRoleService = controller['spaceLightingRoleService'];
		});

		it('should apply default lighting roles', async () => {
			const mockDeviceId1 = uuid();
			const mockChannelId1 = uuid();
			const mockDeviceId2 = uuid();
			const mockChannelId2 = uuid();

			const defaultRoles = [
				{ deviceId: mockDeviceId1, channelId: mockChannelId1, role: LightingRole.MAIN },
				{ deviceId: mockDeviceId2, channelId: mockChannelId2, role: LightingRole.AMBIENT },
			];
			jest.spyOn(spaceLightingRoleService, 'inferDefaultLightingRoles').mockResolvedValue(defaultRoles);
			jest.spyOn(spaceLightingRoleService, 'bulkSetRoles').mockResolvedValue({
				success: true,
				totalCount: 2,
				successCount: 2,
				failureCount: 0,
				results: [
					{ deviceId: mockDeviceId1, channelId: mockChannelId1, success: true, role: LightingRole.MAIN, error: null },
					{
						deviceId: mockDeviceId2,
						channelId: mockChannelId2,
						success: true,
						role: LightingRole.AMBIENT,
						error: null,
					},
				],
			});

			const result = await controller.applyDefaultLightingRoles(mockSpace.id);

			expect(result.data.success).toBe(true);
			expect(result.data.totalCount).toBe(2);
			expect(result.data.successCount).toBe(2);
			expect(result.data.failureCount).toBe(0);
			expect(result.data.results).toHaveLength(2);
			expect(spaceLightingRoleService.inferDefaultLightingRoles).toHaveBeenCalledWith(mockSpace.id);
		});
	});

	describe('deleteLightingRole', () => {
		let spaceLightingRoleService: SpaceLightingRoleService;

		beforeEach(() => {
			spaceLightingRoleService = controller['spaceLightingRoleService'];
		});

		it('should delete lighting role', async () => {
			const deviceId = uuid();
			const channelId = uuid();
			jest.spyOn(spaceLightingRoleService, 'deleteRole').mockResolvedValue(undefined);

			await controller.deleteLightingRole(mockSpace.id, deviceId, channelId);

			expect(spaceLightingRoleService.deleteRole).toHaveBeenCalledWith(mockSpace.id, deviceId, channelId);
		});
	});

	describe('getSuggestion', () => {
		let spaceSuggestionService: SpaceSuggestionService;

		beforeEach(() => {
			spaceSuggestionService = controller['spaceSuggestionService'];
		});

		it('should return suggestion for a space', async () => {
			const suggestion = {
				type: SuggestionType.LIGHTING_RELAX,
				title: 'Relax Mode',
				reason: 'Evening time detected',
				lightingMode: LightingMode.RELAX,
			};
			jest.spyOn(spaceSuggestionService, 'getSuggestion').mockResolvedValue(suggestion);

			const result = await controller.getSuggestion(mockSpace.id);

			expect(result.data).toBeDefined();
			expect(result.data?.title).toBe('Relax Mode');
		});

		it('should return null when no suggestion available', async () => {
			jest.spyOn(spaceSuggestionService, 'getSuggestion').mockResolvedValue(null);

			const result = await controller.getSuggestion(mockSpace.id);

			expect(result.data).toBeNull();
		});
	});

	describe('submitSuggestionFeedback', () => {
		let spaceSuggestionService: SpaceSuggestionService;

		beforeEach(() => {
			spaceSuggestionService = controller['spaceSuggestionService'];
		});

		it('should submit suggestion feedback', async () => {
			jest.spyOn(spaceSuggestionService, 'recordFeedback').mockResolvedValue({
				success: true,
				intentExecuted: true,
			});

			const feedbackDto = {
				data: {
					suggestionType: 'lighting_mode',
					feedback: 'applied',
				},
			};

			const result = await controller.submitSuggestionFeedback(mockSpace.id, feedbackDto as any);

			expect(result.data.success).toBe(true);
			expect(result.data.intentExecuted).toBe(true);
		});
	});

	describe('captureContextSnapshot', () => {
		let spaceContextSnapshotService: SpaceContextSnapshotService;

		beforeEach(() => {
			spaceContextSnapshotService = controller['spaceContextSnapshotService'];
		});

		it('should capture context snapshot', async () => {
			const snapshot = {
				spaceId: mockSpace.id,
				spaceName: 'Living Room',
				capturedAt: new Date(),
				lighting: {
					summary: { totalLights: 2, lightsOn: 1, averageBrightness: 80 },
					lights: [
						{
							deviceId: uuid(),
							deviceName: 'Light 1',
							channelId: uuid(),
							channelName: 'light',
							role: LightingRole.MAIN,
							isOn: true,
							brightness: 80,
							colorTemperature: null,
							color: null,
						},
					],
				},
				climate: {
					hasClimate: false,
					mode: ClimateMode.OFF,
					currentTemperature: null,
					currentHumidity: null,
					heatingSetpoint: null,
					coolingSetpoint: null,
					minSetpoint: 15,
					maxSetpoint: 30,
					supportsHeating: false,
					supportsCooling: false,
					isHeating: false,
					isCooling: false,
					isMixed: false,
					devicesCount: 0,
					lastAppliedMode: null,
					lastAppliedAt: null,
					primaryThermostatId: null,
				},
				covers: {
					summary: { totalCovers: 0, averagePosition: null },
					covers: [],
				},
			};
			jest.spyOn(spaceContextSnapshotService, 'captureSnapshot').mockResolvedValue(snapshot);

			const result = await controller.captureContextSnapshot(mockSpace.id);

			expect(result.data.spaceId).toBe(mockSpace.id);
			expect(result.data.lighting.summary.totalLights).toBe(2);
		});

		it('should throw when space not found', async () => {
			jest.spyOn(spaceContextSnapshotService, 'captureSnapshot').mockResolvedValue(null);

			await expect(controller.captureContextSnapshot('non-existent')).rejects.toThrow(SpacesNotFoundException);
		});
	});

	describe('getUndoState', () => {
		let spaceUndoHistoryService: SpaceUndoHistoryService;

		beforeEach(() => {
			spaceUndoHistoryService = controller['spaceUndoHistoryService'];
		});

		it('should return undo state when entry exists', async () => {
			const undoEntry = {
				id: uuid(),
				spaceId: mockSpace.id,
				actionDescription: 'Set lighting to relax mode',
				intentCategory: IntentCategory.LIGHTING,
				capturedAt: new Date(),
				snapshot: {} as any,
			};
			jest.spyOn(spaceUndoHistoryService, 'peekUndoEntry').mockReturnValue(undoEntry);

			const result = await controller.getUndoState(mockSpace.id);

			expect(result.data.canUndo).toBe(true);
			expect(result.data.actionDescription).toBe('Set lighting to relax mode');
		});

		it('should return canUndo false when no entry', async () => {
			jest.spyOn(spaceUndoHistoryService, 'peekUndoEntry').mockReturnValue(null);

			const result = await controller.getUndoState(mockSpace.id);

			expect(result.data.canUndo).toBe(false);
			expect(result.data.actionDescription).toBeNull();
		});
	});

	describe('executeUndo', () => {
		let spaceUndoHistoryService: SpaceUndoHistoryService;

		beforeEach(() => {
			spaceUndoHistoryService = controller['spaceUndoHistoryService'];
		});

		it('should execute undo successfully', async () => {
			jest.spyOn(spaceUndoHistoryService, 'executeUndo').mockResolvedValue({
				success: true,
				restoredDevices: 3,
				failedDevices: 0,
				message: 'Restored 3 devices',
			});

			const result = await controller.executeUndo(mockSpace.id);

			expect(result.data.success).toBe(true);
			expect(result.data.restoredDevices).toBe(3);
		});

		it('should handle partial failure', async () => {
			jest.spyOn(spaceUndoHistoryService, 'executeUndo').mockResolvedValue({
				success: false,
				restoredDevices: 1,
				failedDevices: 2,
				message: 'Partial restore',
			});

			const result = await controller.executeUndo(mockSpace.id);

			expect(result.data.success).toBe(false);
			expect(result.data.failedDevices).toBe(2);
		});
	});
});
