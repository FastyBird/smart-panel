import { Injectable, Logger } from '@nestjs/common';

import { ChannelsPropertiesService } from '../../devices/services/channels.properties.service';
import { DevicesService } from '../../devices/services/devices.service';
import { PlatformRegistryService } from '../../devices/services/platform.registry.service';
import { IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';
import { SceneExecutionStatus } from '../../scenes/scenes.constants';
import { SceneExecutorService } from '../../scenes/services/scene-executor.service';
import { ScenesService } from '../../scenes/services/scenes.service';
import { LightingIntentDto } from '../../spaces/dto/lighting-intent.dto';
import { SpaceIntentService } from '../../spaces/services/space-intent.service';
import { SpacesService } from '../../spaces/services/spaces.service';
import { LightingIntentType, LightingMode } from '../../spaces/spaces.constants';
import { ToolDefinition } from '../platforms/llm-provider.platform';

export { ToolDefinition } from '../platforms/llm-provider.platform';

const TOOL_EXECUTION_TIMEOUT_MS = 5_000;

/**
 * Result of a tool execution, containing success status and a human-readable description.
 */
export interface ToolExecutionResult {
	success: boolean;
	message: string;
}

/**
 * A tool call request from the LLM, containing the tool name and arguments.
 */
export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

/**
 * Service responsible for executing LLM tool calls by mapping them
 * to the appropriate home automation actions (intents, scenes, lighting modes).
 */
@Injectable()
export class ToolExecutionService {
	private readonly logger = new Logger(ToolExecutionService.name);

	constructor(
		private readonly intentsService: IntentsService,
		private readonly scenesService: ScenesService,
		private readonly sceneExecutor: SceneExecutorService,
		private readonly spacesService: SpacesService,
		private readonly spaceIntentService: SpaceIntentService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistry: PlatformRegistryService,
	) {}

	/**
	 * Returns the list of tool definitions for the LLM system prompt.
	 * These are provider-agnostic; the LLM provider adapter converts them
	 * to the provider-specific format (Claude tools, OpenAI functions, etc.).
	 */
	getToolDefinitions(): ToolDefinition[] {
		return [
			{
				name: 'control_device',
				description:
					'Set a device property value. Use this to control individual devices like lights, switches, thermostats, etc. ' +
					'You need the device ID, channel ID, property ID, and the value to set. ' +
					'These IDs are available in the home context provided to you.',
				parameters: {
					type: 'object',
					properties: {
						device_id: {
							type: 'string',
							description: 'UUID of the device to control',
						},
						channel_id: {
							type: 'string',
							description: 'UUID of the channel on the device',
						},
						property_id: {
							type: 'string',
							description: 'UUID of the property to set',
						},
						value: {
							description: 'The value to set (string, number, or boolean depending on the property)',
						},
					},
					required: ['device_id', 'channel_id', 'property_id', 'value'],
				},
			},
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

	/**
	 * Execute a tool call and return the result.
	 * Maps the LLM tool call to the appropriate home automation action.
	 */
	async executeTool(toolCall: ToolCall): Promise<ToolExecutionResult> {
		this.logger.debug(`Executing tool: ${toolCall.name} (id=${toolCall.id})`);

		try {
			const result = await this.executeWithTimeout(toolCall);

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

	private async executeWithTimeout(toolCall: ToolCall): Promise<ToolExecutionResult> {
		let timer: ReturnType<typeof setTimeout> | undefined;

		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error('Tool execution timed out')), TOOL_EXECUTION_TIMEOUT_MS);
		});

		try {
			return await Promise.race([this.routeToolCall(toolCall), timeoutPromise]);
		} finally {
			clearTimeout(timer);
		}
	}

	private async routeToolCall(toolCall: ToolCall): Promise<ToolExecutionResult> {
		switch (toolCall.name) {
			case 'control_device':
				return this.executeControlDevice(toolCall.arguments);
			case 'run_scene':
				return this.executeRunScene(toolCall.arguments);
			case 'set_space_lighting':
				return this.executeSetSpaceLighting(toolCall.arguments);
			default:
				return {
					success: false,
					message: `Unknown tool: ${toolCall.name}`,
				};
		}
	}

	private async executeControlDevice(args: Record<string, unknown>): Promise<ToolExecutionResult> {
		const deviceId = args.device_id as string;
		const channelId = args.channel_id as string;
		const propertyId = args.property_id as string;
		const value = args.value;

		if (!deviceId || !channelId || !propertyId || value === undefined) {
			return { success: false, message: 'Missing required parameters: device_id, channel_id, property_id, value' };
		}

		// Verify device exists
		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			return { success: false, message: `Device with ID "${deviceId}" not found` };
		}

		// Find the property (findOne joins channel and device relations)
		const property = await this.channelsPropertiesService.findOne(propertyId);
		const propertyChannel = property?.channel;
		const channelEntity = propertyChannel && typeof propertyChannel !== 'string' ? propertyChannel : null;

		if (!property || !channelEntity || channelEntity.id !== channelId) {
			return { success: false, message: `Property with ID "${propertyId}" not found on channel "${channelId}"` };
		}

		// Get the platform for this device
		const platform = this.platformRegistry.get(device);

		if (!platform) {
			return { success: false, message: `No platform registered for device "${device.name}"` };
		}

		// Coerce value to a type the platform accepts
		let coercedValue: string | number | boolean;

		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			coercedValue = value;
		} else {
			coercedValue = JSON.stringify(value) ?? 'null';
		}

		// Create an intent for tracking
		const intent = this.intentsService.createIntent({
			type: IntentType.DEVICE_SET_PROPERTY,
			context: {
				origin: 'api',
				extra: { source: 'buddy' },
			},
			targets: [{ deviceId, channelId, propertyId }],
			value: coercedValue,
		});

		// Execute the property write through the platform
		const success = await platform.process({
			device,
			channel: channelEntity,
			property,
			value: coercedValue,
		});

		// Complete the intent
		this.intentsService.completeIntent(intent.id, [
			{
				deviceId,
				channelId,
				propertyId,
				status: success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
				error: success ? undefined : 'Platform rejected the property write',
			},
		]);

		if (success) {
			return { success: true, message: `Set ${device.name} property to ${coercedValue}` };
		}

		return { success: false, message: `Failed to set property on device "${device.name}"` };
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

		if (result.failedDevices === 0) {
			return {
				success: true,
				message: `Set ${spaceName} lighting to "${mode}" (${result.affectedDevices} devices updated)`,
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
