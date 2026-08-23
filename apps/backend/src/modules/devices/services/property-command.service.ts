import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { DEFAULT_TTL_DEVICE_COMMAND, IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentContext, IntentTarget, IntentTargetResult } from '../../intents/models/intent.model';
import { IntentsService } from '../../intents/services/intents.service';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { WebsocketNotAllowedException } from '../../websocket/websocket.exceptions';
import { ConnectionState, DEVICES_MODULE_NAME, PermissionType } from '../devices.constants';
import { PropertyCommandDto, PropertyCommandValueDto } from '../dto/property-command.dto';
import { IDevicePropertyData } from '../platforms/device.platform';
import { PropertyCommandValue, validatePropertyCommandValue } from '../utils/property-command-value.utils';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';

export interface PropertyCommandExecutionOptions {
	requestId?: string;
	context?: IntentContext;
}

export interface DevicePropertyCommandResult {
	device: string;
	success: boolean;
	reason?: string;
}

export interface SinglePropertyCommandResult extends DevicePropertyCommandResult {
	deviceName?: string;
	channel?: string;
	property?: string;
	value?: PropertyCommandValue;
}

@Injectable()
export class PropertyCommandService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyCommandService');

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistryService: PlatformRegistryService,
		private readonly intentsService: IntentsService,
	) {}

	async handleInternal(
		user: ClientUserDto,
		payload?: object,
	): Promise<{ success: boolean; results: Array<{ device: string; success: boolean; reason?: string }> | string }> {
		// Allow display clients to control device properties via WebSocket
		const isDisplayClient = user.type === 'token' && user.ownerType === TokenOwnerType.DISPLAY;

		// Allow admin/owner users to control device properties via WebSocket
		const isAdminUser = user.type === 'user' && (user.role === UserRole.ADMIN || user.role === UserRole.OWNER);

		if (!isDisplayClient && !isAdminUser) {
			throw new WebsocketNotAllowedException('This action is not allowed for this user');
		}

		const dtoInstance = toInstance(PropertyCommandDto, payload, {
			excludeExtraneousValues: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
			stopAtFirstError: false,
		});

		if (errors.length > 0) {
			this.logger.error(`Command validation failed error=${JSON.stringify(errors)}`);

			return { success: false, results: 'Invalid payload' };
		}

		// Transform context from DTO (snake_case) to IntentContext (camelCase)
		let intentContext: IntentContext | undefined;

		if (dtoInstance.context) {
			intentContext = {
				origin: dtoInstance.context.origin,
				displayId: dtoInstance.context.display_id,
				spaceId: dtoInstance.context.space_id,
				roleKey: dtoInstance.context.role_key,
				extra: dtoInstance.context.extra,
			};
		}

		return this.executeCommands(dtoInstance.properties, {
			requestId: dtoInstance.request_id,
			context: intentContext,
		});
	}

	async executePropertyCommandById(
		propertyId: string,
		rawValue: unknown,
		options: PropertyCommandExecutionOptions = {},
	): Promise<SinglePropertyCommandResult> {
		const property = await this.channelsPropertiesService.findOne(propertyId);

		if (!property) {
			return { device: '', success: false, reason: 'Property not found' };
		}

		const propertyChannel = property.channel;
		const channel =
			typeof propertyChannel === 'string' ? await this.channelsService.findOne(propertyChannel) : propertyChannel;

		if (!channel) {
			return { device: '', success: false, property: property.id, reason: 'Channel not found' };
		}

		const channelDevice = channel.device;
		const device = typeof channelDevice === 'string' ? await this.devicesService.findOne(channelDevice) : channelDevice;

		if (!device) {
			return {
				device: '',
				success: false,
				channel: channel.id,
				property: property.id,
				reason: 'Device not found',
			};
		}

		if (
			!property.permissions.some((permission) =>
				[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
			)
		) {
			return {
				device: device.id,
				deviceName: device.name,
				channel: channel.id,
				property: property.id,
				success: false,
				reason: 'Property is not writable',
			};
		}

		const validation = validatePropertyCommandValue(property, rawValue);

		if (!validation.valid || validation.value === undefined) {
			return {
				device: device.id,
				deviceName: device.name,
				channel: channel.id,
				property: property.id,
				success: false,
				reason: validation.reason ?? 'Invalid property value',
			};
		}

		const execution = await this.executeCommands(
			[
				{
					device: device.id,
					channel: channel.id,
					property: property.id,
					value: validation.value,
				},
			],
			options,
		);
		const result = Array.isArray(execution.results) ? execution.results[0] : undefined;

		return {
			device: device.id,
			deviceName: device.name,
			channel: channel.id,
			property: property.id,
			value: validation.value,
			success: result?.success ?? false,
			reason: result?.reason ?? (typeof execution.results === 'string' ? execution.results : undefined),
		};
	}

	private async executeCommands(
		commands: PropertyCommandValueDto[],
		options: PropertyCommandExecutionOptions,
	): Promise<{ success: boolean; results: DevicePropertyCommandResult[] | string }> {
		const targets: IntentTarget[] = commands.map((command) => ({
			deviceId: command.device,
			channelId: command.channel,
			propertyId: command.property,
		}));
		const valueMap: Record<string, unknown> = {};

		for (const command of commands) {
			valueMap[`device:${command.device}:${command.channel}:${command.property}`] = command.value;
		}
		const groupedProperties: Record<string, PropertyCommandValueDto[]> = {};

		commands.forEach((prop) => {
			if (!groupedProperties[prop.device]) {
				groupedProperties[prop.device] = [];
			}

			groupedProperties[prop.device].push(prop);
		});

		// Create the intent with the value map and optional requestId for tracking
		const intent = this.intentsService.createIntent({
			requestId: options.requestId,
			type: IntentType.DEVICE_SET_PROPERTY,
			context: options.context,
			targets,
			value: valueMap,
			ttlMs: await this.resolveCommandIntentTtlMs(groupedProperties),
		});

		this.logger.log(
			`Created intent ${intent.id} for ${targets.length} target(s)${options.requestId ? ` requestId=${options.requestId}` : ''}`,
		);

		const results: DevicePropertyCommandResult[] = [];

		try {
			// Process commands per device
			for (const deviceId of Object.keys(groupedProperties)) {
				const result = await this.processDeviceCommands(deviceId, groupedProperties[deviceId]);

				results.push(result);
			}

			// Map results to IntentTargetResult format - create a result for each property
			const intentResults: IntentTargetResult[] = [];

			for (const prop of commands) {
				const deviceResult = results.find((r) => r.device === prop.device);

				intentResults.push({
					deviceId: prop.device,
					channelId: prop.channel,
					propertyId: prop.property,
					status: deviceResult?.success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
					error: deviceResult?.reason,
				});
			}

			// Complete the intent with results
			this.intentsService.completeIntent(intent.id, intentResults);

			this.logger.log(`Completed intent ${intent.id} with ${intentResults.length} result(s)`);

			// Determine overall success
			const overallSuccess = results.every((r) => r.success);

			return { success: overallSuccess, results };
		} catch (error) {
			// Handle unexpected exceptions by completing the intent with failure
			this.logger.error(
				`Unexpected error processing commands: ${error instanceof Error ? error.message : String(error)}`,
			);

			// Build failure results for all targeted properties
			const failedResults: IntentTargetResult[] = commands.map((prop) => ({
				deviceId: prop.device,
				channelId: prop.channel,
				propertyId: prop.property,
				status: IntentTargetStatus.FAILED,
				error: 'Internal error',
			}));

			// Complete the intent with failure status
			this.intentsService.completeIntent(intent.id, failedResults);

			this.logger.log(`Completed intent ${intent.id} with failure due to exception`);

			return { success: false, results: 'Internal error' };
		}
	}

	private async resolveCommandIntentTtlMs(
		groupedProperties: Readonly<Record<string, readonly PropertyCommandValueDto[]>>,
	): Promise<number> {
		const executions = [];

		for (const [deviceId, commands] of Object.entries(groupedProperties)) {
			try {
				const device = await this.devicesService.findOne(deviceId);

				if (device !== null) {
					executions.push({ device, commandCount: commands.length });
				}
			} catch {
				return DEFAULT_TTL_DEVICE_COMMAND;
			}
		}

		return this.platformRegistryService.getCommandTtlMs(executions, DEFAULT_TTL_DEVICE_COMMAND);
	}

	private async processDeviceCommands(
		deviceId: string,
		commands: PropertyCommandValueDto[],
	): Promise<{ device: string; success: boolean; reason?: string }> {
		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			this.logger.warn(`Device not found id=${deviceId}`);

			return { device: deviceId, success: false, reason: 'Device not found' };
		}

		// Check device online status before processing commands
		// Allow commands through if status is UNKNOWN (e.g., storage unavailable or no data)
		// Only reject when device is definitively offline
		if (!device.status.online && device.status.status !== ConnectionState.UNKNOWN) {
			this.logger.warn(`Device is offline id=${deviceId} status=${device.status.status}`);

			return { device: deviceId, success: false, reason: 'Device is offline' };
		}

		const platform = this.platformRegistryService.get(device);

		if (!platform) {
			this.logger.warn(`No platform registered for device id=${device.id} type=${device.type}`);

			return { device: deviceId, success: false, reason: 'Unsupported device type' };
		}

		const propertyUpdates: Array<IDevicePropertyData> = [];

		for (const command of commands) {
			const channel = await this.channelsService.findOne(command.channel, device.id);

			if (!channel) {
				this.logger.warn(`Channel not found id=${command.channel} for deviceId=${device.id}`);

				return { device: deviceId, success: false, reason: 'Channel not found' };
			}

			const property = await this.channelsPropertiesService.findOne(command.property, channel.id);

			if (!property) {
				this.logger.warn(`Property not found id=${command.property} for channelId=${channel.id}`);

				return { device: deviceId, success: false, reason: 'Property not found' };
			}

			if (
				!property.permissions.some((permission) =>
					[PermissionType.READ_WRITE, PermissionType.WRITE_ONLY].includes(permission),
				)
			) {
				this.logger.warn(`Property is not writable id=${property.id}`);

				return { device: deviceId, success: false, reason: 'Property is not writable' };
			}

			const validation = validatePropertyCommandValue(property, command.value);

			if (!validation.valid || validation.value === undefined) {
				this.logger.warn(
					`Invalid value for property id=${property.id} dataType=${property.dataType} reason=${validation.reason}`,
				);

				return { device: deviceId, success: false, reason: validation.reason ?? 'Invalid property value' };
			}

			this.logger.log(`Adding command for propertyId=${property.id} value=${validation.value}`);

			propertyUpdates.push({ device, channel, property, value: validation.value });
		}

		// Process the batch of commands in one request
		this.logger.log(`Processing batch of ${propertyUpdates.length} commands for deviceId=${device.id}`);

		const success = await platform.processBatch(propertyUpdates);

		if (!success) {
			this.logger.error(`Batch command execution failed for deviceId=${device.id}`);

			return { device: deviceId, success: false, reason: 'Execution failed' };
		}

		this.logger.log(`Successfully executed batch command for deviceId=${device.id}`);

		return { device: deviceId, success: true };
	}

	/**
	 * Process a device command triggered by an API PATCH request.
	 * This sends the value through the same validation, intent, and platform path as WebSocket and agent commands.
	 */
	async processApiPropertyCommand(
		deviceId: string,
		channelId: string,
		propertyId: string,
		value: string | number | boolean,
	): Promise<void> {
		const execution = await this.executeCommands(
			[{ device: deviceId, channel: channelId, property: propertyId, value }],
			{ context: { origin: 'api' } },
		);
		const result = Array.isArray(execution.results) ? execution.results[0] : undefined;

		if (!execution.success) {
			const reason = result?.reason ?? (typeof execution.results === 'string' ? execution.results : 'Execution failed');

			this.logger.warn(`[API Command] Failed for deviceId=${deviceId}: ${reason}`);
		}
	}
}
