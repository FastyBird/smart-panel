import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger';
import { IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentsService } from '../../intents/services/intents.service';
import { LlmToolCall, ToolDefinition, ToolExecutionResult } from '../../tools/platforms/tool-provider.platform';
import { BaseToolProviderService } from '../../tools/services/base-tool-provider.service';
import { ShortIdMappingService } from '../../tools/services/short-id-mapping.service';

import { DEVICES_MODULE_NAME } from '../devices.constants';

import { ChannelsPropertiesService } from './channels.properties.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';

const DEVICE_CONTROL_TOOLS_PROVIDER = 'device-control-tools';

/**
 * Tool provider for device control.
 * Allows the AI assistant to control individual device properties.
 */
@Injectable()
export class DeviceControlToolService extends BaseToolProviderService {
	protected readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceControlToolService');

	constructor(
		private readonly intentsService: IntentsService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistry: PlatformRegistryService,
		private readonly shortIdMapping: ShortIdMappingService,
	) {
		super();
	}

	getType(): string {
		return DEVICE_CONTROL_TOOLS_PROVIDER;
	}

	getToolDefinitions(): ToolDefinition[] {
		return [
			{
				name: 'control_device',
				description:
					'Set a device property value. Use this to control individual devices like lights, switches, thermostats, etc. ' +
					'Use the short property ID (p=...) from the home context. The device and channel are resolved automatically.',
				parameters: {
					type: 'object',
					properties: {
						property_id: {
							type: 'string',
							description: 'Short property ID from the home context (the p=... value)',
						},
						value: {
							description: 'The value to set (string, number, or boolean depending on the property)',
						},
					},
					required: ['property_id', 'value'],
				},
			},
		];
	}

	protected async handleToolCall(toolCall: LlmToolCall): Promise<ToolExecutionResult> {
		return this.executeControlDevice(toolCall.arguments);
	}

	private async executeControlDevice(args: Record<string, unknown>): Promise<ToolExecutionResult> {
		const rawPropertyId = typeof args.property_id === 'string' ? args.property_id : '';
		const value = args.value;

		if (!rawPropertyId || value === undefined || value === null) {
			return { success: false, message: 'Missing required parameters: property_id, value' };
		}

		// Resolve short ID to full UUID (falls back to raw value if not found — may already be a UUID)
		const propertyId = this.shortIdMapping.resolve(rawPropertyId) ?? rawPropertyId;

		// Find the property (findOne joins channel and device relations)
		const property = await this.channelsPropertiesService.findOne(propertyId);
		const propertyChannel = property?.channel;
		const channelEntity = propertyChannel && typeof propertyChannel !== 'string' ? propertyChannel : null;

		if (!property || !channelEntity) {
			return { success: false, message: `Property "${rawPropertyId}" not found` };
		}

		// Resolve device from channel
		const channelDevice = channelEntity.device;
		const device =
			channelDevice && typeof channelDevice !== 'string'
				? channelDevice
				: await this.devicesService.findOne(typeof channelDevice === 'string' ? channelDevice : '');

		if (!device) {
			return { success: false, message: `Device for property "${rawPropertyId}" not found` };
		}

		const deviceId = device.id;
		const channelId = channelEntity.id;

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
