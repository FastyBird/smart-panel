/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTargetStatus } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { SpaceIntentService } from '../../spaces/services/space-intent.service';
import { SpacesService } from '../../spaces/services/spaces.service';

import { ToolExecutionService } from './tool-execution.service';

describe('ToolExecutionService', () => {
	let service: ToolExecutionService;
	let intentsService: Record<string, jest.Mock>;
	let scenesService: Record<string, jest.Mock>;
	let sceneExecutor: Record<string, jest.Mock>;
	let spacesService: Record<string, jest.Mock>;
	let spaceIntentService: Record<string, jest.Mock>;
	let devicesService: Record<string, jest.Mock>;
	let channelsPropertiesService: Record<string, jest.Mock>;
	let platformRegistry: Record<string, jest.Mock>;

	beforeEach(() => {
		intentsService = {
			createIntent: jest.fn().mockReturnValue({ id: 'intent-1' }),
			completeIntent: jest.fn().mockReturnValue(null),
		};

		scenesService = {
			findOne: jest.fn(),
		};

		sceneExecutor = {
			triggerScene: jest.fn(),
		};

		spacesService = {
			findOne: jest.fn(),
		};

		spaceIntentService = {
			executeLightingIntent: jest.fn(),
		};

		devicesService = {
			findOne: jest.fn(),
		};

		channelsPropertiesService = {
			findOne: jest.fn(),
		};

		platformRegistry = {
			get: jest.fn(),
		};

		service = new ToolExecutionService(
			intentsService as unknown as IntentsService,
			scenesService as unknown as ScenesService,
			sceneExecutor as unknown as SceneExecutorService,
			spacesService as unknown as SpacesService,
			spaceIntentService as unknown as SpaceIntentService,
			devicesService as unknown as DevicesService,
			channelsPropertiesService as unknown as ChannelsPropertiesService,
			platformRegistry as unknown as PlatformRegistryService,
		);
	});

	describe('getToolDefinitions', () => {
		it('should return three tool definitions', () => {
			const tools = service.getToolDefinitions();

			expect(tools).toHaveLength(3);
			expect(tools.map((t) => t.name)).toEqual(['control_device', 'run_scene', 'set_space_lighting']);
		});

		it('should define control_device with required parameters', () => {
			const tools = service.getToolDefinitions();
			const controlDevice = tools.find((t) => t.name === 'control_device');

			expect(controlDevice).toBeDefined();
			expect(controlDevice?.parameters).toEqual(
				expect.objectContaining({
					type: 'object',
					required: ['device_id', 'channel_id', 'property_id', 'value'],
				}),
			);
		});

		it('should define run_scene with required parameters', () => {
			const tools = service.getToolDefinitions();
			const runScene = tools.find((t) => t.name === 'run_scene');

			expect(runScene).toBeDefined();
			expect(runScene?.parameters).toEqual(
				expect.objectContaining({
					type: 'object',
					required: ['scene_id'],
				}),
			);
		});

		it('should define set_space_lighting with required parameters and mode enum', () => {
			const tools = service.getToolDefinitions();
			const setLighting = tools.find((t) => t.name === 'set_space_lighting');

			expect(setLighting).toBeDefined();
			expect(setLighting?.parameters).toEqual(
				expect.objectContaining({
					type: 'object',
					required: ['space_id', 'mode'],
				}),
			);

			const modeParam = (setLighting?.parameters as any).properties.mode;

			expect(modeParam.enum).toEqual(['off', 'on', 'work', 'relax', 'night']);
		});
	});

	describe('executeTool - run_scene', () => {
		it('should execute a scene successfully', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Movie Night' });
			sceneExecutor.triggerScene.mockResolvedValue({
				status: 'completed',
				successfulActions: 3,
				totalActions: 3,
			});

			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: { scene_id: 'scene-1' },
			});

			expect(result.success).toBe(true);
			expect(result.message).toContain('Movie Night');
			expect(result.message).toContain('executed successfully');
			expect(sceneExecutor.triggerScene).toHaveBeenCalledWith('scene-1', 'buddy');
		});

		it('should return failure for non-existent scene', async () => {
			scenesService.findOne.mockResolvedValue(null);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: { scene_id: 'nonexistent' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('not found');
		});

		it('should return failure when missing scene_id', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: {},
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Missing required parameter');
		});

		it('should handle partially completed scene', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Lights' });
			sceneExecutor.triggerScene.mockResolvedValue({
				status: 'partially_completed',
				successfulActions: 2,
				totalActions: 3,
			});

			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: { scene_id: 'scene-1' },
			});

			expect(result.success).toBe(true);
			expect(result.message).toContain('partially completed');
			expect(result.message).toContain('2/3');
		});

		it('should handle failed scene execution', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Lights' });
			sceneExecutor.triggerScene.mockResolvedValue({
				status: 'failed',
				successfulActions: 0,
				totalActions: 3,
				error: 'No platforms registered',
			});

			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: { scene_id: 'scene-1' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('failed');
		});
	});

	describe('executeTool - set_space_lighting', () => {
		it('should set lighting mode to off', async () => {
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 3,
				failedDevices: 0,
			});
			spacesService.findOne.mockResolvedValue({ id: 'space-1', name: 'Living Room' });

			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1', mode: 'off' },
			});

			expect(result.success).toBe(true);
			expect(result.message).toContain('Living Room');
			expect(result.message).toContain('"off"');
			expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(
				'space-1',
				expect.objectContaining({ type: 'off' }),
			);
		});

		it('should set lighting mode to relax', async () => {
			spaceIntentService.executeLightingIntent.mockResolvedValue({
				success: true,
				affectedDevices: 2,
				failedDevices: 0,
			});
			spacesService.findOne.mockResolvedValue({ id: 'space-1', name: 'Bedroom' });

			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1', mode: 'relax' },
			});

			expect(result.success).toBe(true);
			expect(spaceIntentService.executeLightingIntent).toHaveBeenCalledWith(
				'space-1',
				expect.objectContaining({ type: 'set_mode', mode: 'relax' }),
			);
		});

		it('should return failure for non-existent space', async () => {
			spaceIntentService.executeLightingIntent.mockResolvedValue(null);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'nonexistent', mode: 'off' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('not found');
		});

		it('should return failure for invalid mode', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1', mode: 'disco' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Invalid lighting mode');
		});

		it('should return failure when missing parameters', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'set_space_lighting',
				arguments: { space_id: 'space-1' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Missing required parameters');
		});
	});

	describe('executeTool - control_device', () => {
		it('should control a device property successfully', async () => {
			const mockDevice = { id: 'dev-1', name: 'Kitchen Light', type: 'local' };
			const mockChannel = { id: 'chan-1', device: 'dev-1' };
			const mockProperty = { id: 'prop-1', channel: mockChannel };
			const mockPlatform = { process: jest.fn().mockResolvedValue(true) };

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);
			platformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'dev-1',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: true,
				},
			});

			expect(result.success).toBe(true);
			expect(result.message).toContain('Kitchen Light');
			expect(intentsService.createIntent).toHaveBeenCalled();
			expect(intentsService.completeIntent).toHaveBeenCalledWith(
				'intent-1',
				expect.arrayContaining([expect.objectContaining({ status: IntentTargetStatus.SUCCESS })]),
			);
		});

		it('should return failure for non-existent device', async () => {
			devicesService.findOne.mockResolvedValue(null);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'nonexistent',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: true,
				},
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('not found');
		});

		it('should return failure when platform rejects write', async () => {
			const mockDevice = { id: 'dev-1', name: 'Light', type: 'local' };
			const mockChannel = { id: 'chan-1', device: 'dev-1' };
			const mockProperty = { id: 'prop-1', channel: mockChannel };
			const mockPlatform = { process: jest.fn().mockResolvedValue(false) };

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);
			platformRegistry.get.mockReturnValue(mockPlatform);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'dev-1',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: 50,
				},
			});

			expect(result.success).toBe(false);
			expect(intentsService.completeIntent).toHaveBeenCalledWith(
				'intent-1',
				expect.arrayContaining([expect.objectContaining({ status: IntentTargetStatus.FAILED })]),
			);
		});

		it('should return failure when no platform registered', async () => {
			const mockDevice = { id: 'dev-1', name: 'Light', type: 'local' };
			const mockChannel = { id: 'chan-1', device: 'dev-1' };
			const mockProperty = { id: 'prop-1', channel: mockChannel };

			devicesService.findOne.mockResolvedValue(mockDevice);
			channelsPropertiesService.findOne.mockResolvedValue(mockProperty);
			platformRegistry.get.mockReturnValue(null);

			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: {
					device_id: 'dev-1',
					channel_id: 'chan-1',
					property_id: 'prop-1',
					value: true,
				},
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('No platform registered');
		});

		it('should return failure when missing parameters', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'control_device',
				arguments: { device_id: 'dev-1' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Missing required parameters');
		});
	});

	describe('executeTool - unknown tool', () => {
		it('should return null for unknown tool name', async () => {
			const result = await service.executeTool({
				id: 'call-1',
				name: 'unknown_tool',
				arguments: {},
			});

			expect(result).toBeNull();
		});
	});

	describe('executeTool - error handling', () => {
		it('should catch and return errors from scene execution', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Test' });
			sceneExecutor.triggerScene.mockRejectedValue(new Error('Scene is disabled'));

			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: { scene_id: 'scene-1' },
			});

			expect(result.success).toBe(false);
			expect(result.message).toContain('Scene is disabled');
		});
	});
});
