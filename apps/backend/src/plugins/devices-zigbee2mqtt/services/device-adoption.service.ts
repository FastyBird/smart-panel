import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { ChannelCategory, ConnectionState, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelSpecModel } from '../../../modules/devices/models/devices.model';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import {
	type ChannelDataInput,
	DeviceValidationService,
	ValidationIssueSeverity,
} from '../../../modules/devices/services/device-validation.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { channelsSchema } from '../../../spec/channels';
import {
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	DEVICES_ZIGBEE2MQTT_TYPE,
	Z2M_CHANNEL_IDENTIFIERS,
	Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS,
} from '../devices-zigbee2mqtt.constants';
import {
	DevicesZigbee2mqttNotFoundException,
	DevicesZigbee2mqttValidationException,
} from '../devices-zigbee2mqtt.exceptions';
import { CreateZigbee2mqttChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateZigbee2mqttChannelDto } from '../dto/create-channel.dto';
import { CreateZigbee2mqttDeviceDto } from '../dto/create-device.dto';
import { AdoptDeviceRequestDto } from '../dto/mapping-preview.dto';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';

import { Zigbee2mqttService } from './zigbee2mqtt.service';

/**
 * Device Adoption Service
 *
 * Creates Smart Panel devices from Z2M devices based on user-confirmed mapping.
 */
@Injectable()
export class Z2mDeviceAdoptionService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'DeviceAdoptionService',
	);

	constructor(
		private readonly zigbee2mqttService: Zigbee2mqttService,
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly deviceValidationService: DeviceValidationService,
	) {}

	/**
	 * Adopt a Z2M device into Smart Panel
	 */
	async adoptDevice(request: AdoptDeviceRequestDto): Promise<Zigbee2mqttDeviceEntity> {
		this.logger.debug(`[DEVICE ADOPTION] Adopting Z2M device: ${request.ieeeAddress}`);

		// Validate Z2M device exists
		const registeredDevices = this.zigbee2mqttService.getRegisteredDevices();
		const z2mDevice = registeredDevices.find((d) => d.ieeeAddress === request.ieeeAddress);

		if (!z2mDevice) {
			throw new DevicesZigbee2mqttNotFoundException(
				`Zigbee2MQTT device with IEEE address ${request.ieeeAddress} not found in registry`,
			);
		}

		// Check if device is already adopted (by friendly_name identifier)
		const existingDevices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
		const existingDevice = existingDevices.find((d) => d.identifier === z2mDevice.friendlyName);

		if (existingDevice) {
			throw new DevicesZigbee2mqttValidationException(
				`Zigbee2MQTT device "${z2mDevice.friendlyName}" is already adopted as device ${existingDevice.id}`,
			);
		}

		// Also check by IEEE address in serial_number property to be thorough
		for (const device of existingDevices) {
			const channels = await this.channelsService.findAll(device.id, DEVICES_ZIGBEE2MQTT_TYPE);
			const infoChannel = channels.find((ch) => ch.category === ChannelCategory.DEVICE_INFORMATION);
			if (infoChannel) {
				const properties = await this.channelsPropertiesService.findAll(infoChannel.id, DEVICES_ZIGBEE2MQTT_TYPE);
				const serialProp = properties.find((p) => p.category === PropertyCategory.SERIAL_NUMBER);
				if (serialProp?.value === request.ieeeAddress) {
					throw new DevicesZigbee2mqttValidationException(
						`Zigbee2MQTT device with IEEE address ${request.ieeeAddress} is already adopted as device ${device.id}`,
					);
				}
			}
		}

		// Pre-validate the device structure
		this.preValidateDeviceStructure(request);

		// Create device DTO
		const createDeviceDto = toInstance(CreateZigbee2mqttDeviceDto, {
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			identifier: z2mDevice.friendlyName,
			name: request.name,
			category: request.category,
			description: request.description ?? null,
			enabled: request.enabled ?? true,
		});

		// Validate device DTO
		const deviceErrors = await validate(createDeviceDto);
		if (deviceErrors.length) {
			this.logger.error(`[DEVICE ADOPTION] Device validation failed: ${JSON.stringify(deviceErrors)}`);
			throw new DevicesZigbee2mqttValidationException('Device validation failed');
		}

		// Create the device
		const device = await this.devicesService.create<Zigbee2mqttDeviceEntity, CreateZigbee2mqttDeviceDto>(
			createDeviceDto,
		);

		this.logger.debug(`[DEVICE ADOPTION] Created device: ${device.id}`);

		try {
			// Create device information channel
			await this.createDeviceInformationChannel(device, z2mDevice);

			// Create user-defined channels from adoption request
			for (const channelDef of request.channels) {
				// Skip device_information as it's created separately
				if (channelDef.category === ChannelCategory.DEVICE_INFORMATION) {
					continue;
				}
				await this.createChannel(device, channelDef);
			}

			// Set initial connection state
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: z2mDevice.available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			});

			// Return the fully loaded device
			return await this.devicesService.findOne<Zigbee2mqttDeviceEntity>(device.id, DEVICES_ZIGBEE2MQTT_TYPE);
		} catch (error) {
			// Cleanup on failure
			this.logger.error(`[DEVICE ADOPTION] Failed to create channels, cleaning up device: ${device.id}`, error);
			try {
				await this.devicesService.remove(device.id);
			} catch (cleanupError) {
				this.logger.error(`[DEVICE ADOPTION] Failed to cleanup device: ${device.id}`, cleanupError);
			}
			throw error;
		}
	}

	/**
	 * Create device information channel
	 */
	private async createDeviceInformationChannel(
		device: Zigbee2mqttDeviceEntity,
		z2mDevice: Z2mRegisteredDevice,
	): Promise<void> {
		const channelIdentifier = Z2M_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION;
		const definition = z2mDevice.definition;

		// Create channel
		const createChannelDto = toInstance(CreateZigbee2mqttChannelDto, {
			device: device.id,
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			identifier: channelIdentifier,
			name: 'Device Information',
			category: ChannelCategory.DEVICE_INFORMATION,
		});

		const channelErrors = await validate(createChannelDto, { skipMissingProperties: true });
		if (channelErrors.length) {
			this.logger.error(`[DEVICE ADOPTION] Device info channel validation failed: ${JSON.stringify(channelErrors)}`);
			throw new DevicesZigbee2mqttValidationException('Device information channel validation failed');
		}

		const channel = await this.channelsService.create<Zigbee2mqttChannelEntity, CreateZigbee2mqttChannelDto>(
			createChannelDto,
		);

		// Create device info properties
		const infoProperties = [
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
				name: 'Manufacturer',
				category: PropertyCategory.MANUFACTURER,
				value: definition?.vendor ?? 'Unknown',
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
				name: 'Model',
				category: PropertyCategory.MODEL,
				value: definition?.model ?? 'Unknown',
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
				name: 'Serial Number',
				category: PropertyCategory.SERIAL_NUMBER,
				value: z2mDevice.ieeeAddress,
			},
			{
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.FIRMWARE_REVISION,
				name: 'Firmware Revision',
				category: PropertyCategory.FIRMWARE_REVISION,
				value: 'Unknown',
			},
		];

		// Get channel spec for property types
		const channelSpec = this.getChannelSpec(ChannelCategory.DEVICE_INFORMATION);

		for (const info of infoProperties) {
			const propSpec = channelSpec?.properties?.find((p) => p.category === info.category);

			const createPropertyDto = toInstance(CreateZigbee2mqttChannelPropertyDto, {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: info.identifier,
				name: info.name,
				category: info.category,
				data_type: propSpec?.data_type ?? 'string',
				permissions: propSpec?.permissions ?? ['ro'],
				unit: propSpec?.unit ?? null,
				format: propSpec?.format ?? null,
				invalid: propSpec?.invalid ?? null,
				step: propSpec?.step ?? null,
				value: info.value,
			});

			await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createPropertyDto);
		}

		this.logger.debug(`[DEVICE ADOPTION] Created device information channel for device: ${device.id}`);
	}

	/**
	 * Create a channel from adoption request
	 */
	private async createChannel(
		device: Zigbee2mqttDeviceEntity,
		channelDef: AdoptDeviceRequestDto['channels'][0],
	): Promise<void> {
		// Get channel spec
		const channelSpec = this.getChannelSpec(channelDef.category);

		// Create channel
		const channelIdentifier = channelDef.identifier ?? channelDef.category;
		const createChannelDto = toInstance(CreateZigbee2mqttChannelDto, {
			device: device.id,
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			identifier: channelIdentifier,
			name: channelDef.name,
			category: channelDef.category,
		});

		const channelErrors = await validate(createChannelDto, { skipMissingProperties: true });
		if (channelErrors.length) {
			this.logger.error(
				`[DEVICE ADOPTION] Channel validation failed for ${channelDef.category}: ${JSON.stringify(channelErrors)}`,
			);
			throw new DevicesZigbee2mqttValidationException(`Channel validation failed for ${channelDef.category}`);
		}

		const channel = await this.channelsService.create<Zigbee2mqttChannelEntity, CreateZigbee2mqttChannelDto>(
			createChannelDto,
		);

		// Create properties
		for (const propDef of channelDef.properties) {
			const propSpec = channelSpec?.properties?.find((p) => p.category === propDef.category);

			// Use z2mProperty as identifier for state matching
			const createPropertyDto = toInstance(CreateZigbee2mqttChannelPropertyDto, {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: propDef.z2mProperty,
				name: this.formatPropertyName(propDef.z2mProperty),
				category: propDef.category,
				data_type: propDef.dataType,
				permissions: propDef.permissions,
				unit: propDef.unit ?? propSpec?.unit ?? null,
				format: propDef.format ?? propSpec?.format ?? null,
				invalid: propSpec?.invalid ?? null,
				step: propSpec?.step ?? null,
				value: null,
			});

			const propertyErrors = await validate(createPropertyDto, { skipMissingProperties: true });
			if (propertyErrors.length) {
				this.logger.warn(
					`[DEVICE ADOPTION] Property validation failed for ${propDef.category}: ${JSON.stringify(propertyErrors)}`,
				);
				// Continue with other properties
				continue;
			}

			await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createPropertyDto);
		}

		this.logger.debug(`[DEVICE ADOPTION] Created channel ${channelDef.category} for device: ${device.id}`);
	}

	/**
	 * Pre-validate device structure before creation using the DeviceValidationService
	 */
	private preValidateDeviceStructure(request: AdoptDeviceRequestDto): void {
		this.logger.debug(`[DEVICE ADOPTION] Pre-validating device structure using DeviceValidationService`);

		// Check that at least one channel is provided
		if (!request.channels.length) {
			throw new DevicesZigbee2mqttValidationException('At least one channel must be defined');
		}

		// Build the device data input for validation
		// Include device_information channel that will be auto-created
		const channels: ChannelDataInput[] = [
			{
				category: ChannelCategory.DEVICE_INFORMATION,
				properties: [
					{ category: PropertyCategory.MANUFACTURER },
					{ category: PropertyCategory.MODEL },
					{ category: PropertyCategory.SERIAL_NUMBER },
					{ category: PropertyCategory.FIRMWARE_REVISION },
				],
			},
		];

		// Add user-defined channels (excluding device_information if duplicated)
		for (const channelDef of request.channels) {
			if (channelDef.category === ChannelCategory.DEVICE_INFORMATION) {
				continue;
			}

			channels.push({
				category: channelDef.category,
				properties: channelDef.properties.map((p) => ({
					category: p.category,
					dataType: p.dataType,
					permissions: p.permissions,
				})),
			});
		}

		// Use the DeviceValidationService to validate the structure
		const validationResult = this.deviceValidationService.validateDeviceStructure({
			category: request.category,
			channels,
		});

		if (!validationResult.isValid) {
			// Filter to only show errors (not warnings)
			const errors = validationResult.issues.filter((i) => i.severity === ValidationIssueSeverity.ERROR);

			if (errors.length > 0) {
				const errorMessages = errors.map((issue) => issue.message);
				this.logger.error(`[DEVICE ADOPTION] Pre-validation failed: ${errorMessages.join(', ')}`);
				throw new DevicesZigbee2mqttValidationException(
					`Device structure validation failed:\n${errorMessages.join('\n')}`,
				);
			}
		}

		// Log warnings but don't fail
		const warnings = validationResult.issues.filter((i) => i.severity === ValidationIssueSeverity.WARNING);
		if (warnings.length > 0) {
			this.logger.warn(`[DEVICE ADOPTION] Pre-validation warnings: ${warnings.map((w) => w.message).join(', ')}`);
		}

		this.logger.debug(`[DEVICE ADOPTION] Pre-validation passed`);
	}

	/**
	 * Get channel specification
	 */
	private getChannelSpec(category: ChannelCategory): ChannelSpecModel | null {
		const rawSchema = channelsSchema[category as keyof typeof channelsSchema] as object | undefined;
		if (!rawSchema) {
			return null;
		}

		return toInstance(
			ChannelSpecModel,
			{
				...rawSchema,
				properties: 'properties' in rawSchema && rawSchema.properties ? Object.values(rawSchema.properties) : [],
			},
			{ excludeExtraneousValues: false },
		);
	}

	/**
	 * Format property name for display
	 */
	private formatPropertyName(z2mProperty: string): string {
		return z2mProperty
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}
}
