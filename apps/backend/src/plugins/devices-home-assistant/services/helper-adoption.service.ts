import { instanceToPlain } from 'class-transformer';
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
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	DEVICES_HOME_ASSISTANT_TYPE,
	ENTITY_MAIN_STATE_ATTRIBUTE,
} from '../devices-home-assistant.constants';
import {
	DevicesHomeAssistantNotFoundException,
	DevicesHomeAssistantValidationException,
} from '../devices-home-assistant.exceptions';
import { CreateHomeAssistantChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateHomeAssistantChannelDto } from '../dto/create-channel.dto';
import { CreateHomeAssistantDeviceDto } from '../dto/create-device.dto';
import { AdoptHelperRequestDto } from '../dto/helper-mapping-preview.dto';
import { UpdateHomeAssistantChannelPropertyDto } from '../dto/update-channel-property.dto';
import {
	HomeAssistantChannelEntity,
	HomeAssistantChannelPropertyEntity,
	HomeAssistantDeviceEntity,
} from '../entities/devices-home-assistant.entity';

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
		private readonly deviceConnectivityService: DeviceConnectivityService,
	) {}

	/**
	 * Adopt a Home Assistant helper into the Smart Panel system
	 */
	async adoptHelper(request: AdoptHelperRequestDto): Promise<HomeAssistantDeviceEntity> {
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

		// Also check if this entity is already mapped as part of another device
		// This prevents climate entities from being adopted both as part of a device and as a standalone helper
		const allProperties = await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
			undefined,
			DEVICES_HOME_ASSISTANT_TYPE,
		);
		const existingPropertyMapping = allProperties.find((p) => p.haEntityId === request.entityId);

		if (existingPropertyMapping) {
			const channel = existingPropertyMapping.channel;
			const deviceId =
				channel instanceof HomeAssistantChannelEntity && channel.device instanceof HomeAssistantDeviceEntity
					? channel.device.id
					: 'unknown';

			throw new DevicesHomeAssistantValidationException(
				`Home Assistant entity ${request.entityId} is already mapped in device ${deviceId}`,
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

		try {
			// Create device information channel
			await this.createDeviceInformationChannel(device, helper);

			// Create user-defined channels from the adoption request
			for (const channelDef of request.channels) {
				await this.createChannel(device, channelDef, request.entityId);
			}

			// Sync initial state
			await this.syncHelperState(device.id, request.entityId);

			// Set device connection state to connected (helper is available if we got here)
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: ConnectionState.CONNECTED,
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
				type: DEVICES_HOME_ASSISTANT_TYPE,
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
				type: DEVICES_HOME_ASSISTANT_TYPE,
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
	 * This method fetches the helper's state and updates all matching property values
	 */
	private async syncHelperState(deviceId: string, entityId: string): Promise<void> {
		try {
			const state = await this.homeAssistantHttpService.getState(entityId);

			// Load all properties for this device's channels
			const allProperties = await this.channelsPropertiesService.findAll<HomeAssistantChannelPropertyEntity>(
				undefined,
				DEVICES_HOME_ASSISTANT_TYPE,
			);

			// Filter to properties belonging to this device
			const deviceProperties = allProperties.filter(
				(p) =>
					p.channel instanceof HomeAssistantChannelEntity &&
					p.channel.device instanceof HomeAssistantDeviceEntity &&
					p.channel.device.id === deviceId &&
					p.haEntityId === entityId,
			);

			if (deviceProperties.length === 0) {
				return;
			}

			// Update each property based on its ha_attribute mapping
			for (const property of deviceProperties) {
				let newValue: string | number | boolean | null = null;

				if (property.haAttribute === ENTITY_MAIN_STATE_ATTRIBUTE || property.haAttribute === 'fb.main_state') {
					// Map the main state value
					newValue = state.state;
				} else if (state.attributes && property.haAttribute) {
					// Map from a specific attribute
					const attrValue = state.attributes[property.haAttribute];
					if (attrValue !== undefined) {
						newValue = attrValue as string | number | boolean;
					}
				}

				// Convert value based on property data type
				if (newValue !== null) {
					newValue = this.convertValueForProperty(property, newValue, String(state.state));
				}

				if (newValue !== null) {
					try {
						await this.channelsPropertiesService.update(
							property.id,
							toInstance(UpdateHomeAssistantChannelPropertyDto, {
								...instanceToPlain(property),
								value: newValue,
							}),
						);
					} catch (updateError) {
						const updateErr = updateError as Error;

						this.logger.warn(`[HELPER ADOPTION] Failed to update property ${property.category}`, {
							resource: deviceId,
							message: updateErr.message,
						});
					}
				}
			}
		} catch (error) {
			const err = error as Error;

			this.logger.warn(`[HELPER ADOPTION] Failed to sync initial state for helper ${entityId}`, {
				resource: deviceId,
				message: err.message,
			});
		}
	}

	/**
	 * Convert HA value to match property data type
	 * Handles conversions like hvac_action (string) -> active (bool)
	 */
	private convertValueForProperty(
		property: HomeAssistantChannelPropertyEntity,
		value: string | number | boolean,
		entityState: string,
	): string | number | boolean {
		const dataType = property.dataType;

		// If property expects boolean but value is string, convert it
		if (dataType === DataTypeType.BOOL) {
			if (typeof value === 'boolean') {
				return value;
			}

			if (typeof value === 'string') {
				// hvac_action conversions: heating/cooling/drying/fan = true, idle/off = false
				if (property.haAttribute === 'hvac_action') {
					return ['heating', 'cooling', 'drying', 'fan'].includes(value);
				}

				// Main state conversions: anything except 'off' = true
				if (property.haAttribute === ENTITY_MAIN_STATE_ATTRIBUTE || property.haAttribute === 'fb.main_state') {
					return entityState !== 'off';
				}

				// Generic string to boolean: common truthy values
				return ['on', 'true', 'yes', '1', 'heating', 'cooling'].includes(value.toLowerCase());
			}

			if (typeof value === 'number') {
				return value !== 0;
			}
		}

		// If property expects number but value is string, try to parse it
		if (
			(dataType === DataTypeType.FLOAT ||
				dataType === DataTypeType.INT ||
				dataType === DataTypeType.UINT ||
				dataType === DataTypeType.CHAR ||
				dataType === DataTypeType.UCHAR ||
				dataType === DataTypeType.SHORT ||
				dataType === DataTypeType.USHORT) &&
			typeof value === 'string'
		) {
			const parsed = parseFloat(value);
			if (!isNaN(parsed)) {
				return parsed;
			}
		}

		return value;
	}
}
