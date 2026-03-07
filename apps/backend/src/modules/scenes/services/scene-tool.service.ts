import { Injectable, Logger } from '@nestjs/common';

import { ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
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
		private readonly shortIdMapping: ShortIdMappingService,
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
							description: 'Short scene ID from the home context (the id=... value)',
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
		const rawSceneId = typeof args.scene_id === 'string' ? args.scene_id : '';

		if (!rawSceneId) {
			return { success: false, message: 'Missing required parameter: scene_id' };
		}

		const sceneId = this.shortIdMapping.resolve(rawSceneId) ?? rawSceneId;

		// Verify scene exists
		const scene = await this.scenesService.findOne(sceneId);

		if (!scene) {
			return { success: false, message: `Scene with ID "${sceneId}" not found` };
		}

		if (!scene.enabled) {
			return { success: false, message: `Scene "${scene.name}" is disabled` };
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
