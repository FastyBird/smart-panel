import { Injectable, Logger } from '@nestjs/common';

import { LlmToolCall, ToolDefinition, ToolExecutionResult } from '../../tools/platforms/tool-provider.platform';
import { BaseToolProviderService } from '../../tools/services/base-tool-provider.service';
import { SceneExecutionStatus } from '../scenes.constants';

import { SceneExecutorService } from './scene-executor.service';
import { ScenesService } from './scenes.service';

const SCENE_TOOLS_PROVIDER = 'scene-tools';

/**
 * Tool provider for scene execution.
 * Allows the AI assistant to trigger pre-configured automation scenes.
 */
@Injectable()
export class SceneToolService extends BaseToolProviderService {
	protected readonly logger = new Logger(SceneToolService.name);

	constructor(
		private readonly scenesService: ScenesService,
		private readonly sceneExecutor: SceneExecutorService,
	) {
		super();
	}

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

	protected async handleToolCall(toolCall: LlmToolCall): Promise<ToolExecutionResult> {
		return this.executeRunScene(toolCall.arguments);
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
