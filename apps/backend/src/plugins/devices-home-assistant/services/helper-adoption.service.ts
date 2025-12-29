import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME, DEVICES_HOME_ASSISTANT_TYPE } from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { CreateHomeAssistantChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateHomeAssistantChannelDto } from '../dto/create-channel.dto';
import { CreateHomeAssistantDeviceDto } from '../dto/create-device.dto';
import { AdoptHelperRequestDto } from '../dto/helper-mapping-preview.dto';
import { HomeAssistantDeviceEntity } from '../entities/devices-home-assistant.entity';

import { HomeAssistantHttpService } from './home-assistant.http.service';

/**
 * Service for adopting (creating) Smart Panel devices from Home Assistant helpers
 */
@Injectable()
export class HelperAdoptionService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HelperAdoptionService',
	);

	constructor(
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {}

	/**
	 * Adopt a Home Assistant helper into the Smart Panel system
	 */
	async adoptHelper(request: AdoptHelperRequestDto): Promise<HomeAssistantDeviceEntity> {
		this.logger.debug(`[HELPER ADOPTION] Adopting helper: ${request.entityId}`);

		// Validate helper exists
		const helper = await this.homeAssistantHttpService.getDiscoveredHelper(request.entityId);

		if (!helper) {
			throw new DevicesHomeAssistantNotFoundException(
				`Home Assistant helper with entity_id ${request.entityId} not found`,
			);
		}

		// Check if helper is already adopted (using entityId as haDeviceId)
		const existingDevices = await this.devicesService.findAll<HomeAssistantDeviceEntity>(DEVICES_HOME_ASSISTANT_TYPE);
		const existingDevice = existingDevices.find((d) => d.haDeviceId === request.entityId);

		if (existingDevice) {
			throw new DevicesHomeAssistantValidationException(
				`Home Assistant helper ${request.entityId} is already adopted as device ${existingDevice.id}`,
			);
		}

		// Validate device DTO
		const createDeviceDto = toInstance(CreateHomeAssistantDeviceDto, {
			type: DEVICES_HOME_ASSISTANT_TYPE,
			category: request.category,
			name: request.name,
			description: request.description ?? null,
			enabled: request.enabled ?? true,
			// Use entityId as haDeviceId for helpers
			ha_device_id: request.entityId,
		});

		const errors = await validate(createDeviceDto);
		if (errors.length) {
			this.logger.error(`[HELPER ADOPTION] Device validation failed: ${JSON.stringify(errors)}`);
			throw new DevicesHomeAssistantValidationException('Device validation failed');
		}

		// Create the device
		const device = await this.devicesService.create<HomeAssistantDeviceEntity, CreateHomeAssistantDeviceDto>(
			createDeviceDto,
		);

		this.logger.debug(`[HELPER ADOPTION] Created device: ${device.id}`, { resource: device.id });

		try {
			// Create device information channel
			await this.createDeviceInformationChannel(device, helper);

			// Create user-defined channels from the adoption request
			for (const channelDef of request.channels) {
				await this.createChannel(device, channelDef, request.entityId);
			}

			// Sync initial state
			await this.syncHelperState(device.id, request.entityId);

			this.logger.debug(`[HELPER ADOPTION] Helper ${request.entityId} adopted successfully as device ${device.id}`, {
				resource: device.id,
			});

			// Return the fully loaded device
			return await this.devicesService.findOne<HomeAssistantDeviceEntity>(device.id, DEVICES_HOME_ASSISTANT_TYPE);
		} catch (error) {
			// If channel creation fails, clean up the device
			const err = error as Error;

			this.logger.error(`[HELPER ADOPTION] Failed to create channels, cleaning up device: ${device.id}`, {
				resource: device.id,
				message: err.message,
				stack: err.stack,
			});

			try {
				await this.devicesService.remove(device.id);
			} catch (cleanupError) {
				const cleanupErr = cleanupError as Error;

				this.logger.error(`[HELPER ADOPTION] Failed to cleanup device: ${device.id}`, {
					resource: device.id,
					message: cleanupErr.message,
					stack: cleanupErr.stack,
				});
			}
			throw error;
		}
	}

	/**
	 * Create the device information channel for a helper
	 */
	private async createDeviceInformationChannel(
		device: HomeAssistantDeviceEntity,
		helper: { entityId: string; name: string; domain: string },
	): Promise<void> {
		const createChannelDto = toInstance(CreateHomeAssistantChannelDto, {
			type: DEVICES_HOME_ASSISTANT_TYPE,
			device: device.id,
			category: ChannelCategory.DEVICE_INFORMATION,
			name: 'Device Information',
		});

		const channel = await this.channelsService.create(createChannelDto);

		// Create standard device information properties
		const properties = [
			{
				category: PropertyCategory.MANUFACTURER,
				name: 'Manufacturer',
				value: 'Home Assistant',
				dataType: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
			},
			{
				category: PropertyCategory.MODEL,
				name: 'Model',
				value: `Helper (${helper.domain})`,
				dataType: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
			},
			{
				category: PropertyCategory.SERIAL_NUMBER,
				name: 'Serial Number',
				value: helper.entityId,
				dataType: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
			},
			{
				category: PropertyCategory.FIRMWARE_REVISION,
				name: 'Firmware Revision',
				value: 'N/A',
				dataType: DataTypeType.STRING,
				permissions: [PermissionType.READ_ONLY],
			},
			{
				category: PropertyCategory.STATUS,
				name: 'Status',
				value: ConnectionState.CONNECTED,
				dataType: DataTypeType.ENUM,
				permissions: [PermissionType.READ_ONLY],
				format: [ConnectionState.CONNECTED, ConnectionState.DISCONNECTED, ConnectionState.UNKNOWN],
			},
		];

		for (const prop of properties) {
			const createPropertyDto = toInstance(CreateHomeAssistantChannelPropertyDto, {
				category: prop.category,
				name: prop.name,
				data_type: prop.dataType,
				permissions: prop.permissions,
				value: prop.value,
				format: prop.format ?? null,
				ha_entity_id: null,
				ha_attribute: null,
			});

			await this.channelsPropertiesService.create(channel.id, createPropertyDto);
		}

		this.logger.debug(`[HELPER ADOPTION] Created device_information channel with ${properties.length} properties`, {
			resource: device.id,
		});
	}

	/**
	 * Create a channel from the adoption request
	 */
	private async createChannel(
		device: HomeAssistantDeviceEntity,
		channelDef: AdoptHelperRequestDto['channels'][0],
		entityId: string,
	): Promise<void> {
		const createChannelDto = toInstance(CreateHomeAssistantChannelDto, {
			type: DEVICES_HOME_ASSISTANT_TYPE,
			device: device.id,
			category: channelDef.category,
			name: channelDef.name,
		});

		const channel = await this.channelsService.create(createChannelDto);

		this.logger.debug(
			`[HELPER ADOPTION] Created channel: ${channel.id} (${channelDef.category}) with ${channelDef.properties.length} properties`,
			{ resource: device.id },
		);

		// Create properties
		for (const propDef of channelDef.properties) {
			const createPropertyDto = toInstance(CreateHomeAssistantChannelPropertyDto, {
				category: propDef.category,
				name: propDef.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
				data_type: propDef.dataType,
				permissions: propDef.permissions,
				unit: propDef.unit ?? null,
				format: propDef.format ?? null,
				value: null,
				ha_entity_id: entityId,
				ha_attribute: propDef.haAttribute,
			});

			await this.channelsPropertiesService.create(channel.id, createPropertyDto);
		}
	}

	/**
	 * Sync the initial state from Home Assistant
	 */
	private async syncHelperState(deviceId: string, entityId: string): Promise<void> {
		try {
			const state = await this.homeAssistantHttpService.getState(entityId);

			this.logger.debug(`[HELPER ADOPTION] Synced initial state for helper ${entityId}: ${state.state}`, {
				resource: deviceId,
			});
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`[HELPER ADOPTION] Failed to sync initial state for helper ${entityId}`, {
				resource: deviceId,
				message: err.message,
			});
		}
	}
}
