import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import { TokenOwnerType } from '../../auth/auth.constants';
import { DEFAULT_TTL_DEVICE_COMMAND, IntentTargetStatus, IntentType } from '../../intents/intents.constants';
import { IntentTarget, IntentTargetResult } from '../../intents/models/intent.model';
import { IntentsService } from '../../intents/services/intents.service';
import { UserRole } from '../../users/users.constants';
import { ClientUserDto } from '../../websocket/dto/client-user.dto';
import { WebsocketNotAllowedException } from '../../websocket/websocket.exceptions';
import { DEVICES_MODULE_NAME, DataTypeType } from '../devices.constants';
import { PropertyCommandDto, PropertyCommandValueDto } from '../dto/property-command.dto';
import { IDevicePropertyData } from '../platforms/device.platform';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';

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

		// First, resolve property identifiers for all targets
		// This is needed because the panel uses property identifiers (e.g., "brightness", "on")
		// for the overlay index, not UUIDs
		const propertyKeyMap = new Map<string, string>(); // property UUID -> property identifier

		for (const prop of dtoInstance.properties) {
			const channel = await this.channelsService.findOne(prop.channel, prop.device);

			if (channel) {
				const property = await this.channelsPropertiesService.findOne(prop.property, channel.id);

				if (property) {
					// Use identifier if available, otherwise fall back to name or id
					propertyKeyMap.set(prop.property, property.identifier || property.name || prop.property);
				}
			}
		}

		// Build intent targets with resolved property keys
		const targets: IntentTarget[] = dtoInstance.properties.map((prop) => ({
			deviceId: prop.device,
			channelId: prop.channel,
			propertyKey: propertyKeyMap.get(prop.property) || prop.property,
		}));

		// Determine intent type based on the first property (could be enhanced to detect property type)
		const intentType = IntentType.DEVICE_SET_PROPERTY;

		// Build a map of "deviceId:propertyKey" -> value for multi-property support
		// Using composite key to avoid collisions when multiple devices have same property name
		const valueMap: Record<string, unknown> = {};

		for (const prop of dtoInstance.properties) {
			const propertyKey = propertyKeyMap.get(prop.property) || prop.property;
			const compositeKey = `${prop.device}:${propertyKey}`;
			valueMap[compositeKey] = prop.value;
		}

		// Create the intent with the value map
		const intent = this.intentsService.createIntent({
			type: intentType,
			targets,
			value: valueMap,
			ttlMs: DEFAULT_TTL_DEVICE_COMMAND,
		});

		this.logger.log(`Created intent ${intent.id} for ${targets.length} target(s)`);

		// Group properties by device ID
		const groupedProperties: Record<string, PropertyCommandValueDto[]> = {};

		dtoInstance.properties.forEach((prop) => {
			if (!groupedProperties[prop.device]) {
				groupedProperties[prop.device] = [];
			}

			groupedProperties[prop.device].push(prop);
		});

		const results: Array<{ device: string; success: boolean; reason?: string }> = [];

		try {
			// Process commands per device
			for (const deviceId of Object.keys(groupedProperties)) {
				const result = await this.processDeviceCommands(deviceId, groupedProperties[deviceId]);

				results.push(result);
			}

			// Map results to IntentTargetResult format
			const intentResults: IntentTargetResult[] = results.map((r) => ({
				deviceId: r.device,
				status: r.success ? IntentTargetStatus.SUCCESS : IntentTargetStatus.FAILED,
				error: r.reason,
			}));

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

			// Build failure results for all targeted devices
			const failedResults: IntentTargetResult[] = Object.keys(groupedProperties).map((deviceId) => ({
				deviceId,
				status: IntentTargetStatus.FAILED,
				error: 'Internal error',
			}));

			// Complete the intent with failure status
			this.intentsService.completeIntent(intent.id, failedResults);

			this.logger.log(`Completed intent ${intent.id} with failure due to exception`);

			return { success: false, results: 'Internal error' };
		}
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

			if (!this.validateValueType(property.dataType, command.value)) {
				this.logger.warn(`Invalid value type for property id=${property.id} expected=${property.dataType}`);

				return { device: deviceId, success: false, reason: 'Invalid value type' };
			}

			this.logger.log(`Adding command for propertyId=${property.id} value=${command.value}`);

			propertyUpdates.push({ device, channel, property, value: command.value });
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

	private validateValueType(dataType: DataTypeType, value: unknown): boolean {
		switch (dataType) {
			case DataTypeType.STRING:
			case DataTypeType.ENUM:
				return typeof value === 'string';
			case DataTypeType.BOOL:
				return typeof value === 'boolean';
			case DataTypeType.CHAR:
			case DataTypeType.UCHAR:
			case DataTypeType.SHORT:
			case DataTypeType.USHORT:
			case DataTypeType.INT:
			case DataTypeType.UINT:
			case DataTypeType.FLOAT:
				return typeof value === 'number';
			default:
				return false;
		}
	}
}
