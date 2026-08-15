import { z } from 'zod';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import {
	LlmToolCall,
	ToolAccessKind,
	ToolAudience,
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionResult,
	ToolExecutionStatus,
	createToolDefinition,
} from '../../tools/platforms/tool-provider.platform';
import { BaseToolProviderService } from '../../tools/services/base-tool-provider.service';
import { ScopedShortIdTargetKind, ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { SCENES_MODULE_NAME, SceneExecutionStatus } from '../scenes.constants';

import { SceneExecutorService } from './scene-executor.service';
import { ScenesService } from './scenes.service';

const SCENE_TOOLS_PROVIDER = 'scene-tools';
const BUDDY_TARGET_NOT_EXPOSED_MESSAGE = 'The requested target is not available in this Buddy conversation.';
const BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE = 'BUDDY_TARGET_NOT_EXPOSED';

const RUN_SCENE_INPUT_SCHEMA = z.object({
	scene_id: z.string().min(1).describe('Short scene ID from the home context (the id=... value)'),
});

const RUN_SCENE_OUTPUT_SCHEMA = z.object({
	scene_id: z.string(),
	status: z.enum(['completed', 'partially_completed', 'failed']),
	successful_actions: z.number().int().nonnegative(),
	total_actions: z.number().int().nonnegative(),
});

/** Tool provider for scene execution. */
@Injectable()
export class SceneToolService extends BaseToolProviderService {
	protected readonly logger = createExtensionLogger(SCENES_MODULE_NAME, 'SceneToolService');

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
			createToolDefinition({
				name: 'run_scene',
				description:
					'Execute a scene by its ID. Scenes are pre-configured automations that control multiple devices at once. ' +
					'Available scenes are listed in the home context.',
				audiences: [ToolAudience.BUDDY, ToolAudience.MCP],
				access: ToolAccessKind.TRIGGER,
				inputSchema: RUN_SCENE_INPUT_SCHEMA,
				outputSchema: RUN_SCENE_OUTPUT_SCHEMA,
			}),
		];
	}

	protected async handleToolCall(toolCall: LlmToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
		const parsed = RUN_SCENE_INPUT_SCHEMA.safeParse(toolCall.arguments);

		if (!parsed.success) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Missing or invalid required parameter: scene_id',
				errorCode: 'INVALID_TOOL_ARGUMENTS',
			};
		}

		const sceneId =
			context.audience === ToolAudience.BUDDY
				? context.conversationId
					? this.shortIdMapping.resolveScoped(
							context.conversationId,
							parsed.data.scene_id,
							ScopedShortIdTargetKind.SCENE,
						)
					: null
				: (this.shortIdMapping.resolve(parsed.data.scene_id) ?? parsed.data.scene_id);

		if (sceneId === null) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: BUDDY_TARGET_NOT_EXPOSED_MESSAGE,
				errorCode: BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE,
			};
		}
		const scene = await this.scenesService.findOne(sceneId);

		if (!scene) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `Scene with ID "${sceneId}" not found`,
				errorCode: 'SCENE_NOT_FOUND',
			};
		}

		if (!scene.enabled) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: `Scene "${scene.name}" is disabled`,
				errorCode: 'SCENE_DISABLED',
			};
		}

		const result = await this.sceneExecutor.triggerScene(sceneId, context.source, {
			origin: 'api',
			extra: {
				source: context.source,
				audience: context.audience,
				actorId: context.actorId,
				requestId: context.requestId,
			},
		});
		const terminalSceneStatus =
			result.status === SceneExecutionStatus.COMPLETED || result.status === SceneExecutionStatus.PARTIALLY_COMPLETED
				? result.status
				: SceneExecutionStatus.FAILED;
		const data = {
			scene_id: sceneId,
			status: terminalSceneStatus,
			successful_actions: result.successfulActions,
			total_actions: result.totalActions,
		};

		if (result.status === SceneExecutionStatus.COMPLETED) {
			return {
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: `Scene "${scene.name}" executed successfully`,
				data,
			};
		}

		if (result.status === SceneExecutionStatus.PARTIALLY_COMPLETED) {
			return {
				success: true,
				status: ToolExecutionStatus.PARTIAL,
				message: `Scene "${scene.name}" partially completed (${result.successfulActions}/${result.totalActions} actions succeeded)`,
				data,
			};
		}

		this.logger.warn(`[EXECUTE] Scene with id=${sceneId} failed: ${result.error ?? 'Unknown scene execution failure'}`);

		return {
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: `Scene "${scene.name}" failed to execute`,
			data,
			errorCode: 'SCENE_EXECUTION_FAILED',
		};
	}
}
