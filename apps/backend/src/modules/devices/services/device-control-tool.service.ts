import { Injectable, Logger } from '@nestjs/common';

import { IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';
import { IToolProvider, LlmToolCall, ToolDefinition, ToolExecutionResult } from '../../tools/platforms/tool-provider.platform';

import { ChannelsPropertiesService } from './channels.properties.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';

const TOOL_EXECUTION_TIMEOUT_MS = 5_000;

const DEVICE_CONTROL_TOOLS_PROVIDER = 'device-control-tools';

/**
 * Tool provider for device control.
 * Allows the AI assistant to control individual device properties.
 */
@Injectable()
export class DeviceControlToolService implements IToolProvider {
	private readonly logger = new Logger(DeviceControlToolService.name);

	constructor(
		private readonly intentsService: IntentsService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistry: PlatformRegistryService,
	) {}

	getType(): string {
		return DEVICE_CONTROL_TOOLS_PROVIDER;
	}

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
		];
	}

	async executeTool(toolCall: LlmToolCall): Promise<ToolExecutionResult | null> {
		if (toolCall.name !== 'control_device') {
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
			return await Promise.race([this.executeControlDevice(args), timeoutPromise]);
		} finally {
			clearTimeout(timer);
		}
	}

	private async executeControlDevice(args: Record<string, unknown>): Promise<ToolExecutionResult> {
		const deviceId = args.device_id as string;
		const channelId = args.channel_id as string;
		const propertyId = args.property_id as string;
		const value = args.value;

		if (!deviceId || !channelId || !propertyId || value === undefined || value === null) {
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

		// Verify the channel belongs to the specified device
		const channelDevice = channelEntity.device;
		const channelDeviceId = typeof channelDevice === 'string' ? channelDevice : channelDevice?.id;

		if (channelDeviceId !== deviceId) {
			return { success: false, message: `Channel "${channelId}" does not belong to device "${deviceId}"` };
		}

		// Get the platform for this device
		const platform = this.platformRegistry.get(device);

		if (!platform) {
			return { success: false, message: `No platform registered for device "${device.name}"` };
		}

		// Coerce value to a type the platform accepts.
		const coercedValue = this.coerceValue(value);

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
		let success: boolean;

		try {
			success = await platform.process({
				device,
				channel: channelEntity,
				property,
				value: coercedValue,
			});
		} catch (error) {
			const err = error as Error;

			// Ensure the intent is always resolved, even on unexpected errors
			this.intentsService.completeIntent(intent.id, [
				{
					deviceId,
					channelId,
					propertyId,
					status: IntentTargetStatus.FAILED,
					error: err.message,
				},
			]);

			return { success: false, message: `Failed to set property on device "${device.name}": ${err.message}` };
		}

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

	private coerceValue(value: unknown): string | number | boolean {
		if (typeof value === 'boolean') {
			return value;
		}

		if (typeof value === 'number') {
			return value;
		}

		if (typeof value === 'string') {
			// Parse string representations of booleans
			if (value.toLowerCase() === 'true') return true;
			if (value.toLowerCase() === 'false') return false;

			// Parse string representations of numbers
			const num = Number(value);

			if (value.trim() !== '' && !Number.isNaN(num) && Number.isFinite(num)) {
				return num;
			}

			return value;
		}

		// Fallback for objects or other types
		return JSON.stringify(value);
	}
}
