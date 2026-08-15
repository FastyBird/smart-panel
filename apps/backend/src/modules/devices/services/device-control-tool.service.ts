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
import { DEVICES_MODULE_NAME } from '../devices.constants';

import { PropertyCommandService } from './property-command.service';

const DEVICE_CONTROL_TOOLS_PROVIDER = 'device-control-tools';
const BUDDY_TARGET_NOT_EXPOSED_MESSAGE = 'The requested target is not available in this Buddy conversation.';
const BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE = 'BUDDY_TARGET_NOT_EXPOSED';

const CONTROL_DEVICE_INPUT_SCHEMA = z.object({
	property_id: z.string().min(1).describe('Short property ID from the home context (the p=... value)'),
	value: z
		.union([z.string(), z.number(), z.boolean()])
		.describe('Value matching the property data type and constraints'),
});

const CONTROL_DEVICE_OUTPUT_SCHEMA = z.object({
	device_id: z.string(),
	channel_id: z.string(),
	property_id: z.string(),
	value: z.union([z.string(), z.number(), z.boolean()]),
});

/**
 * Tool provider for device control.
 * Allows agent surfaces to control individual device properties through the shared command service.
 */
@Injectable()
export class DeviceControlToolService extends BaseToolProviderService {
	protected readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceControlToolService');

	constructor(
		private readonly propertyCommandService: PropertyCommandService,
		private readonly shortIdMapping: ShortIdMappingService,
	) {
		super();
	}

	getType(): string {
		return DEVICE_CONTROL_TOOLS_PROVIDER;
	}

	getToolDefinitions(): ToolDefinition[] {
		return [
			createToolDefinition({
				name: 'control_device',
				description:
					'Set a device property value. Use this to control individual devices like lights, switches, thermostats, etc. ' +
					'Use the short property ID (p=...) from the home context. The device and channel are resolved automatically.',
				audiences: [ToolAudience.BUDDY, ToolAudience.MCP],
				access: ToolAccessKind.WRITE,
				inputSchema: CONTROL_DEVICE_INPUT_SCHEMA,
				outputSchema: CONTROL_DEVICE_OUTPUT_SCHEMA,
			}),
		];
	}

	protected async handleToolCall(toolCall: LlmToolCall, context: ToolExecutionContext): Promise<ToolExecutionResult> {
		const parsed = CONTROL_DEVICE_INPUT_SCHEMA.safeParse(toolCall.arguments);

		if (!parsed.success) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: 'Missing or invalid required parameters: property_id, value',
				errorCode: 'INVALID_TOOL_ARGUMENTS',
			};
		}

		const propertyId =
			context.audience === ToolAudience.BUDDY
				? context.conversationId
					? this.shortIdMapping.resolveScoped(
							context.conversationId,
							parsed.data.property_id,
							ScopedShortIdTargetKind.PROPERTY,
						)
					: null
				: (this.shortIdMapping.resolve(parsed.data.property_id) ?? parsed.data.property_id);

		if (propertyId === null) {
			return {
				success: false,
				status: ToolExecutionStatus.DENIED,
				message: BUDDY_TARGET_NOT_EXPOSED_MESSAGE,
				errorCode: BUDDY_TARGET_NOT_EXPOSED_ERROR_CODE,
			};
		}
		const result = await this.propertyCommandService.executePropertyCommandById(propertyId, parsed.data.value, {
			requestId: context.requestId,
			context: {
				origin: 'api',
				extra: {
					source: context.source,
					audience: context.audience,
					actorId: context.actorId,
				},
			},
		});

		if (!result.success || !result.channel || !result.property || result.value === undefined) {
			return {
				success: false,
				status: ToolExecutionStatus.FAILED,
				message: result.reason ?? 'Failed to set device property',
				errorCode: 'DEVICE_PROPERTY_WRITE_FAILED',
			};
		}

		return {
			success: true,
			status: ToolExecutionStatus.COMPLETED,
			message: `Set ${result.deviceName ?? result.device} property to ${String(result.value)}`,
			data: {
				device_id: result.device,
				channel_id: result.channel,
				property_id: result.property,
				value: result.value,
			},
		};
	}
}
