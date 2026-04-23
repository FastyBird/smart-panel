import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { createExtensionLogger } from '../../../common/logger';
import { LightingIntentDto } from '../../../plugins/spaces-home-control/dto/lighting-intent.dto';
import { LlmToolCall, ToolDefinition, ToolExecutionResult } from '../../tools/platforms/tool-provider.platform';
import { BaseToolProviderService } from '../../tools/services/base-tool-provider.service';
import { ShortIdMappingService } from '../../tools/services/short-id-mapping.service';
import { LightingIntentType, LightingMode, SPACES_MODULE_NAME } from '../spaces.constants';

import { SpacesService } from './spaces.service';

const SPACE_LIGHTING_TOOLS_PROVIDER = 'space-lighting-tools';

/**
 * Tool provider for space lighting control.
 * Allows the AI assistant to set lighting modes for entire spaces.
 *
 * Uses ModuleRef to lazily resolve SpaceIntentService, avoiding a file-level
 * circular import chain (space-intent → lighting-intent → space-context-snapshot → space-intent).
 */
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
			{
				name: 'set_space_lighting',
				description:
					'Set the lighting mode for an entire space (room). ' +
					'Available modes: "off" (all lights off), "on" (all lights on at full brightness), ' +
					'"work" (bright, productive lighting), "relax" (dimmed, comfortable lighting), ' +
					'"night" (very dim night lighting). ' +
					'Use this instead of controlling individual light devices when you want to change the overall room lighting.',
				parameters: {
					type: 'object',
					properties: {
						space_id: {
							type: 'string',
							description: 'Short space ID from the home context (the id=... value)',
						},
						mode: {
							type: 'string',
							enum: ['off', 'on', 'work', 'relax', 'night'],
							description: 'Lighting mode to set',
						},
					},
					required: ['space_id', 'mode'],
				},
			},
		];
	}

	protected async handleToolCall(toolCall: LlmToolCall): Promise<ToolExecutionResult> {
		return this.executeSetSpaceLighting(toolCall.arguments);
	}

	private async executeSetSpaceLighting(args: Record<string, unknown>): Promise<ToolExecutionResult> {
		const rawSpaceId = typeof args.space_id === 'string' ? args.space_id : '';
		const mode = typeof args.mode === 'string' ? args.mode : '';

		if (!rawSpaceId || !mode) {
			return { success: false, message: 'Missing required parameters: space_id, mode' };
		}

		const spaceId = this.shortIdMapping.resolve(rawSpaceId) ?? rawSpaceId;

		if (!this.spaceIntentService) {
			return { success: false, message: 'Space lighting service is not available' };
		}

		// Validate mode
		const validModes = ['off', 'on', 'work', 'relax', 'night'];

		if (!validModes.includes(mode)) {
			return { success: false, message: `Invalid lighting mode "${mode}". Valid modes: ${validModes.join(', ')}` };
		}

		// Map mode to intent type and lighting mode
		let intentType: LightingIntentType;
		let lightingMode: LightingMode | undefined;

		if (mode === 'off') {
			intentType = LightingIntentType.OFF;
		} else if (mode === 'on') {
			intentType = LightingIntentType.ON;
		} else {
			intentType = LightingIntentType.SET_MODE;
			lightingMode = mode as LightingMode;
		}

		const intent: LightingIntentDto = Object.assign(new LightingIntentDto(), {
			type: intentType,
			mode: lightingMode,
		});

		const result = await this.spaceIntentService.executeLightingIntent(spaceId, intent);

		if (!result) {
			return { success: false, message: `Space with ID "${spaceId}" not found` };
		}

		const space = await this.spacesService.findOne(spaceId);
		const spaceName = space?.name ?? spaceId;

		if (result.failedDevices === 0 && result.affectedDevices > 0) {
			return {
				success: true,
				message: `Set ${spaceName} lighting to "${mode}" (${result.affectedDevices} devices updated)`,
			};
		}

		if (result.failedDevices === 0 && result.affectedDevices === 0) {
			return {
				success: false,
				message: `No lighting devices found in ${spaceName}`,
			};
		}

		if (result.affectedDevices > 0) {
			return {
				success: true,
				message: `Partially set ${spaceName} lighting to "${mode}" (${result.affectedDevices} succeeded, ${result.failedDevices} failed)`,
			};
		}

		return {
			success: false,
			message: `Failed to set lighting in ${spaceName}`,
		};
	}
}
