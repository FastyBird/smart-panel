import { Injectable, Logger } from '@nestjs/common';

import { IToolProvider, LlmToolCall, ToolDefinition, ToolExecutionResult } from '../../tools/platforms/tool-provider.platform';

import { SceneExecutionStatus } from '../scenes.constants';

import { SceneExecutorService } from './scene-executor.service';
import { ScenesService } from './scenes.service';

const TOOL_EXECUTION_TIMEOUT_MS = 5_000;

const SCENE_TOOLS_PROVIDER = 'scene-tools';

/**
 * Tool provider for scene execution.
 * Allows the AI assistant to trigger pre-configured automation scenes.
 */
@Injectable()
export class SceneToolService implements IToolProvider {
	private readonly logger = new Logger(SceneToolService.name);

	constructor(
		private readonly scenesService: ScenesService,
		private readonly sceneExecutor: SceneExecutorService,
	) {}

	getType(): string {
		return SCENE_TOOLS_PROVIDER;
	}

	getToolDefinitions(): ToolDefinition[] {
		return [
			{
				name: 'run_scene',
				description:
					'Execute a scene by its ID. Scenes are pre-configured automations that control multiple devices at once. ' +
					'Available scenes are listed in the home context.',
				parameters: {
					type: 'object',
					properties: {
						scene_id: {
							type: 'string',
							description: 'UUID of the scene to run',
						},
					},
					required: ['scene_id'],
				},
			},
		];
	}

	async executeTool(toolCall: LlmToolCall): Promise<ToolExecutionResult | null> {
		if (toolCall.name !== 'run_scene') {
			return null;
		}

		this.logger.debug(`Executing tool: ${toolCall.name} (id=${toolCall.id})`);

		try {
			const result = await this.executeWithTimeout(toolCall.arguments);

			this.logger.debug(`Tool ${toolCall.name} completed: ${result.success ? 'success' : 'failure'}`);

			return result;
		} catch (error) {
			const err = error as Error;

			this.logger.error(`Tool ${toolCall.name} failed: ${err.message}`);

			return {
				success: false,
				message: `Failed to execute ${toolCall.name}: ${err.message}`,
			};
		}
	}

	private async executeWithTimeout(args: Record<string, unknown>): Promise<ToolExecutionResult> {
		let timer: ReturnType<typeof setTimeout> | undefined;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('Tool execution timed out')), TOOL_EXECUTION_TIMEOUT_MS);
		});

		try {
			return await Promise.race([this.executeRunScene(args), timeoutPromise]);
		} finally {
			clearTimeout(timer);
		}
	}

	private async executeRunScene(args: Record<string, unknown>): Promise<ToolExecutionResult> {
		const sceneId = args.scene_id as string;

		if (!sceneId) {
			return { success: false, message: 'Missing required parameter: scene_id' };
		}

		// Verify scene exists
		const scene = await this.scenesService.findOne(sceneId);

		if (!scene) {
			return { success: false, message: `Scene with ID "${sceneId}" not found` };
		}

		const result = await this.sceneExecutor.triggerScene(sceneId, 'buddy');

		if (result.status === SceneExecutionStatus.COMPLETED) {
			return { success: true, message: `Scene "${scene.name}" executed successfully` };
		}

		if (result.status === SceneExecutionStatus.PARTIALLY_COMPLETED) {
			return {
				success: true,
				message: `Scene "${scene.name}" partially completed (${result.successfulActions}/${result.totalActions} actions succeeded)`,
			};
		}

		return {
			success: false,
			message: `Scene "${scene.name}" failed: ${result.error ?? 'unknown error'}`,
		};
	}
}
