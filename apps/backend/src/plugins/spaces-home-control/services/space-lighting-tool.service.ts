import { z } from 'zod';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { createExtensionLogger } from '../../../common/logger';
import { SpacesService } from '../../../modules/spaces/services/spaces.service';
import { SPACES_MODULE_NAME } from '../../../modules/spaces/spaces.constants';
import {
	LlmToolCall,
	ToolAccessKind,
	ToolAudience,
	ToolDefinition,
	ToolExecutionContext,
	ToolExecutionResult,
	ToolExecutionStatus,
	createToolDefinition,
} from '../../../modules/tools/platforms/tool-provider.platform';
import { BaseToolProviderService } from '../../../modules/tools/services/base-tool-provider.service';
import {
	ScopedShortIdTargetKind,
	ShortIdMappingService,
} from '../../../modules/tools/services/short-id-mapping.service';
import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { LightingIntentType, LightingMode } from '../spaces-home-control.constants';

const SPACE_LIGHTING_TOOLS_PROVIDER = 'space-lighting-tools';
const BUDDY_TARGET_NOT_EXPOSED_MESSAGE = 'The requested target is not available in this Buddy conversation.';
const BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE = 'BUDDY_TARGET_NOT_EXPOSED';
const LIGHTING_MODES = ['off', 'on', 'work', 'relax', 'night'] as const;

const SET_SPACE_LIGHTING_INPUT_SCHEMA = z.object({
	space_id: z.string().min(1).describe('Short space ID from the home context (the id=... value)'),
	mode: z.enum(LIGHTING_MODES).describe('Lighting mode to set'),
});

const SET_SPACE_LIGHTING_OUTPUT_SCHEMA = z.object({
	space_id: z.string(),
	mode: z.enum(LIGHTING_MODES),
	affected_devices: z.number().int().nonnegative(),
	failed_devices: z.number().int().nonnegative(),
	skipped_offline_devices: z.number().int().nonnegative(),
});

/** Tool provider for space-level lighting control. */
@Injectable()
export class SpaceLightingToolService extends BaseToolProviderService implements OnModuleInit {
	protected readonly logger = createExtensionLogger(SPACES_MODULE_NAME, 'SpaceLightingToolService');

	private spaceIntentService: import('./space-intent.service').SpaceIntentService | undefined;

	constructor(
		private readonly spacesService: SpacesService,
		private readonly moduleRef: ModuleRef,
		private readonly shortIdMapping: ShortIdMappingService,
	) {
		super();
	}

	async onModuleInit(): Promise<void> {
		const { SpaceIntentService } = await import('./space-intent.service');

		this.spaceIntentService = this.moduleRef.get(SpaceIntentService, { strict: false });
	}

	getType(): string {
		return SPACE_LIGHTING_TOOLS_PROVIDER;
	}

	getToolDefinitions(): ToolDefinition[] {
		return [
			createToolDefinition({
				name: 'set_space_lighting',
				description:
					'Set the lighting mode for an entire space (room). ' +
					'Available modes: "off" (all lights off), "on" (all lights on at full brightness), ' +
					'"work" (bright, productive lighting), "relax" (dimmed, comfortable lighting), ' +
					'"night" (very dim night lighting). ' +
					'Use this instead of controlling individual light devices when changing the overall room lighting.',
				audiences: [ToolAudience.BUDDY, ToolAudience.MCP],
				access: ToolAccessKind.TRIGGER,
				inputSchema: SET_SPACE_LIGHTING_INPUT_SCHEMA,
				outputSchema: SET_SPACE_LIGHTING_OUTPUT_SCHEMA,
			}),
		];
	}

	protected async handleToolCall(toolCall: LlmToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
		const parsed = SET_SPACE_LIGHTING_INPUT_SCHEMA.safeParse(toolCall.arguments);

		if (!parsed.success) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Missing or invalid required parameters: space_id, mode',
				errorCode: 'INVALID_TOOL_ARGUMENTS',
			};
		}

		const spaceId =
			context.audience === ToolAudience.BUDDY
				? context.conversationId
					? this.shortIdMapping.resolveScoped(
							context.conversationId,
							parsed.data.space_id,
							ScopedShortIdTargetKind.SPACE,
						)
					: null
				: (this.shortIdMapping.resolve(parsed.data.space_id) ?? parsed.data.space_id);

		if (spaceId === null) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: BUDDY_TARGET_NOT_EXPOSED_MESSAGE,
				errorCode: BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE,
			};
		}

		if (!this.spaceIntentService) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Space lighting service is not available',
				errorCode: 'SPACE_LIGHTING_UNAVAILABLE',
			};
		}

		let intentType: LightingIntentType;
		let lightingMode: LightingMode | undefined;

		if (parsed.data.mode === 'off') {
			intentType = LightingIntentType.OFF;
		} else if (parsed.data.mode === 'on') {
			intentType = LightingIntentType.ON;
		} else {
			intentType = LightingIntentType.SET_MODE;
			lightingMode = parsed.data.mode as LightingMode;
		}

		const intent: LightingIntentDto = Object.assign(new LightingIntentDto(), {
			type: intentType,
			mode: lightingMode,
		});
		const result = await this.spaceIntentService.executeLightingIntent(spaceId, intent, {
			origin: 'api',
			extra: {
				source: context.source,
				audience: context.audience,
				actorId: context.actorId,
				requestId: context.requestId,
			},
		});

		if (!result) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `Space with ID "${spaceId}" not found`,
				errorCode: 'SPACE_NOT_FOUND',
			};
		}

		const space = await this.spacesService.findOne(spaceId);
		const spaceName = space?.name ?? spaceId;
		const skippedOfflineDevices = result.skippedOfflineDevices ?? 0;
		const data = {
			space_id: spaceId,
			mode: parsed.data.mode,
			affected_devices: result.affectedDevices,
			failed_devices: result.failedDevices,
			skipped_offline_devices: skippedOfflineDevices,
		};

		if (result.failedDevices === 0 && skippedOfflineDevices === 0 && result.affectedDevices > 0) {
			return {
				success: true,
				status: ToolExecutionStatus.COMPLETED,
				message: `Set ${spaceName} lighting to "${parsed.data.mode}" (${result.affectedDevices} devices updated)`,
				data,
			};
		}

		if (result.failedDevices === 0 && result.affectedDevices === 0) {
			if (skippedOfflineDevices > 0) {
				return {
					success: false,
					status: ToolExecutionStatus.FAILED,
					message: `No online lighting devices available in ${spaceName} (${skippedOfflineDevices} offline)`,
					data,
					errorCode: 'NO_ONLINE_LIGHTING_DEVICES',
				};
			}

			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: `No lighting devices found in ${spaceName}`,
				data,
				errorCode: 'NO_LIGHTING_DEVICES',
			};
		}

		if (result.affectedDevices > 0) {
			return {
				success: true,
				status: ToolExecutionStatus.PARTIAL,
				message: `Partially set ${spaceName} lighting to "${parsed.data.mode}" (${result.affectedDevices} succeeded, ${result.failedDevices} failed, ${skippedOfflineDevices} offline)`,
				data,
			};
		}

		return {
			success: false,
			status: ToolExecutionStatus.FAILED,
			message: `Failed to set lighting in ${spaceName}`,
			data,
			errorCode: 'SPACE_LIGHTING_FAILED',
		};
	}
}
