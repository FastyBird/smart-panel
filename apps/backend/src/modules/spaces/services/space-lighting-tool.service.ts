import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { LlmToolCall, ToolDefinition, ToolExecutionResult } from '../../tools/platforms/tool-provider.platform';
import { BaseToolProviderService } from '../../tools/services/base-tool-provider.service';

import { LightingIntentDto } from '../dto/lighting-intent.dto';
import { LightingIntentType, LightingMode } from '../spaces.constants';

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
	protected readonly logger = new Logger(SpaceLightingToolService.name);

	private spaceIntentService!: import('./space-intent.service').SpaceIntentService;

	constructor(
		private readonly spacesService: SpacesService,
		private readonly moduleRef: ModuleRef,
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
							description: 'UUID of the space to control lighting for',
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
		const spaceId = args.space_id as string;
		const mode = args.mode as string;

		if (!spaceId || !mode) {
			return { success: false, message: 'Missing required parameters: space_id, mode' };
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
