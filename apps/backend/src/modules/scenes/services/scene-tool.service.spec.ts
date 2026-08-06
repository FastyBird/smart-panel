import { ToolAccessKind, ToolAudience, ToolExecutionStatus } from '../../tools/platforms/tool-provider.platform';
import { ShortIdMappingService } from '../../tools/services/short-id-mapping.service';

import { SceneExecutorService } from './scene-executor.service';
import { SceneToolService } from './scene-tool.service';
import { ScenesService } from './scenes.service';

describe('SceneToolService', () => {
	let service: SceneToolService;
	let scenesService: Record<string, jest.Mock>;
	let sceneExecutor: Record<string, jest.Mock>;

	beforeEach(() => {
		scenesService = {
			findOne: jest.fn(),
		};

		sceneExecutor = {
			triggerScene: jest.fn(),
		};

		service = new SceneToolService(
			scenesService as unknown as ScenesService,
			sceneExecutor as unknown as SceneExecutorService,
			new ShortIdMappingService(),
		);
	});

	describe('getToolDefinitions', () => {
		it('should return one tool definition', () => {
			const tools = service.getToolDefinitions();

			expect(tools).toHaveLength(1);
			expect(tools[0].name).toBe('run_scene');
			expect(tools[0].audiences).toEqual([ToolAudience.BUDDY, ToolAudience.MCP]);
			expect(tools[0].access).toBe(ToolAccessKind.TRIGGER);
			expect(tools[0].outputSchema).toBeDefined();
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
	});

	describe('executeTool - run_scene', () => {
		it('should execute a scene successfully', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Movie Night', enabled: true });
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
			expect(result.status).toBe(ToolExecutionStatus.COMPLETED);
			expect(result.message).toContain('Movie Night');
			expect(result.message).toContain('executed successfully');
			expect(sceneExecutor.triggerScene).toHaveBeenCalledWith('scene-1', 'buddy', expect.any(Object));
			const firstCall = sceneExecutor.triggerScene.mock.calls[0] as unknown as [
				string,
				string,
				{ origin?: string; extra?: Record<string, unknown> },
			];

			expect(firstCall[2]).toMatchObject({
				origin: 'api',
				extra: { source: 'buddy', audience: ToolAudience.BUDDY },
			});
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
			expect(result.message).toContain('Missing or invalid required parameter');
		});

		it('should handle partially completed scene', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Lights', enabled: true });
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
			expect(result.status).toBe(ToolExecutionStatus.PARTIAL);
			expect(result.message).toContain('partially completed');
			expect(result.message).toContain('2/3');
		});

		it('should handle failed scene execution', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Lights', enabled: true });
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
			expect(result.status).toBe(ToolExecutionStatus.FAILED);
			expect(result.message).toContain('failed');
		});
	});

	describe('executeTool - error handling', () => {
		it('should return failure when scene is disabled', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Test', enabled: false });

			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: { scene_id: 'scene-1' },
			});

			expect(result.success).toBe(false);
			expect(result.status).toBe(ToolExecutionStatus.DENIED);
			expect(result.message).toContain('disabled');
		});

		it('should catch and return errors from scene execution', async () => {
			scenesService.findOne.mockResolvedValue({ id: 'scene-1', name: 'Test', enabled: true });
			sceneExecutor.triggerScene.mockRejectedValue(new Error('Connection timeout'));

			const result = await service.executeTool({
				id: 'call-1',
				name: 'run_scene',
				arguments: { scene_id: 'scene-1' },
			});

			expect(result.success).toBe(false);
			expect(result.status).toBe(ToolExecutionStatus.FAILED);
			expect(result.message).toBe('Failed to execute tool "run_scene"');
			expect(result.message).not.toContain('Connection timeout');
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
});
