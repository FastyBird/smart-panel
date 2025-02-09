import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Injectable, Logger } from '@nestjs/common';

import { DataTypeEnum } from '../devices.constants';
import { PropertyCommandDto, PropertyCommandValueDto } from '../dto/property-command.dto';
import { IDevicePropertyData } from '../platforms/device.platform';

import { ChannelsPropertiesService } from './channels.properties.service';
import { ChannelsService } from './channels.service';
import { DevicesService } from './devices.service';
import { PlatformRegistryService } from './platform.registry.service';

@Injectable()
export class PropertyCommandService {
	private readonly logger = new Logger(PropertyCommandService.name);

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly platformRegistryService: PlatformRegistryService,
	) {}

	async handle(
		payload?: object,
	): Promise<{ success: boolean; results: Array<{ device: string; success: boolean; reason?: string }> | string }> {
		const dtoInstance = plainToInstance(PropertyCommandDto, payload, {
			enableImplicitConversion: true,
			excludeExtraneousValues: true,
			exposeUnsetFields: false,
		});

		const errors = await validate(dtoInstance, {
			whitelist: true,
			forbidNonWhitelisted: true,
		});

		if (errors.length > 0) {
			this.logger.error(`[VALIDATION] Command validation failed error=${JSON.stringify(errors)}`);

			return { success: false, results: 'Invalid payload' };
		}

		// Group properties by device ID
		const groupedProperties: Record<string, PropertyCommandValueDto[]> = {};

		dtoInstance.properties.forEach((prop) => {
			if (!groupedProperties[prop.device]) {
				groupedProperties[prop.device] = [];
			}

			groupedProperties[prop.device].push(prop);
		});

		const results: Array<{ device: string; success: boolean; reason?: string }> = [];

		// Process commands per device
		for (const deviceId of Object.keys(groupedProperties)) {
			const result = await this.processDeviceCommands(deviceId, groupedProperties[deviceId]);

			results.push(result);
		}

		// Determine overall success
		const overallSuccess = results.every((r) => r.success);

		return { success: overallSuccess, results };
	}

	private async processDeviceCommands(
		deviceId: string,
		commands: PropertyCommandValueDto[],
	): Promise<{ device: string; success: boolean; reason?: string }> {
		const device = await this.devicesService.findOne(deviceId);

		if (!device) {
			this.logger.warn(`[COMMAND] Device not found id=${deviceId}`);

			return { device: deviceId, success: false, reason: 'Device not found' };
		}

		const platform = this.platformRegistryService.get(device);

		if (!platform) {
			this.logger.warn(`[COMMAND] No platform registered for device id=${device.id} type=${device.type}`);

			return { device: deviceId, success: false, reason: 'Unsupported device type' };
		}

		const propertyUpdates: Array<IDevicePropertyData> = [];

		for (const command of commands) {
			const channel = await this.channelsService.findOne(command.channel, device.id);

			if (!channel) {
				this.logger.warn(`[COMMAND] Channel not found id=${command.channel} for deviceId=${device.id}`);

				return { device: deviceId, success: false, reason: 'Channel not found' };
			}

			const property = await this.channelsPropertiesService.findOne(command.property, channel.id);

			if (!property) {
				this.logger.warn(`[COMMAND] Property not found id=${command.property} for channelId=${channel.id}`);

				return { device: deviceId, success: false, reason: 'Property not found' };
			}

			if (!this.validateValueType(property.dataType, command.value)) {
				this.logger.warn(`[COMMAND] Invalid value type for property id=${property.id} expected=${property.dataType}`);

				return { device: deviceId, success: false, reason: 'Invalid value type' };
			}

			this.logger.log(`[COMMAND] Adding command for propertyId=${property.id} value=${command.value}`);

			propertyUpdates.push({ device, channel, property, value: command.value });
		}

		// Process the batch of commands in one request
		this.logger.log(`[COMMAND] Processing batch of ${propertyUpdates.length} commands for deviceId=${device.id}`);

		const success = await platform.processBatch(propertyUpdates);

		if (!success) {
			this.logger.error(`[COMMAND] Batch command execution failed for deviceId=${device.id}`);

			return { device: deviceId, success: false, reason: 'Execution failed' };
		}

		this.logger.log(`[COMMAND] Successfully executed batch command for deviceId=${device.id}`);

		return { device: deviceId, success: true };
	}

	private validateValueType(dataType: DataTypeEnum, value: unknown): boolean {
		switch (dataType) {
			case DataTypeEnum.STRING:
			case DataTypeEnum.ENUM:
				return typeof value === 'string';
			case DataTypeEnum.BOOL:
				return typeof value === 'boolean';
			case DataTypeEnum.CHAR:
			case DataTypeEnum.UCHAR:
			case DataTypeEnum.SHORT:
			case DataTypeEnum.USHORT:
			case DataTypeEnum.INT:
			case DataTypeEnum.UINT:
			case DataTypeEnum.FLOAT:
				return typeof value === 'number';
			default:
				return false;
		}
	}
}
