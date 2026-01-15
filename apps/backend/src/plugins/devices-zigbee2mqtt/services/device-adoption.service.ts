import { validate } from 'class-validator';

import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import {
	ChannelCategory,
	ConnectionState,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
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

import { Z2mDeviceMapperService } from './device-mapper.service';
import { MappedChannel, Z2mExposesMapperService } from './exposes-mapper.service';
import { Z2mVirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext, getVirtualPropertyDefinition } from './virtual-property.types';
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
		private readonly virtualPropertyService: Z2mVirtualPropertyService,
		private readonly exposesMapper: Z2mExposesMapperService,
		private readonly deviceMapper: Z2mDeviceMapperService,
	) {}

	/**
	 * Adopt a Z2M device into Smart Panel (or re-adopt if already exists)
	 */
	async adoptDevice(request: AdoptDeviceRequestDto): Promise<Zigbee2mqttDeviceEntity> {
		// Validate Z2M device exists
		const registeredDevices = this.zigbee2mqttService.getRegisteredDevices();
		const z2mDevice = registeredDevices.find((d) => d.ieeeAddress === request.ieeeAddress);

		if (!z2mDevice) {
			throw new DevicesZigbee2mqttNotFoundException(
				`Zigbee2MQTT device with IEEE address ${request.ieeeAddress} not found in registry`,
			);
		}

		// Check if device is already adopted and remove it for re-adoption
		const existingDevices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);

		// Check by friendly_name identifier
		const existingByIdentifier = existingDevices.find((d) => d.identifier === z2mDevice.friendlyName);
		if (existingByIdentifier) {
			await this.devicesService.remove(existingByIdentifier.id);
		}

		// Also check by IEEE address in serial_number property to be thorough
		for (const device of existingDevices) {
			// Skip if already removed above
			if (existingByIdentifier && device.id === existingByIdentifier.id) {
				continue;
			}

			const channels = await this.channelsService.findAll(device.id, DEVICES_ZIGBEE2MQTT_TYPE);
			const infoChannel = channels.find((ch) => ch.category === ChannelCategory.DEVICE_INFORMATION);
			if (infoChannel) {
				const properties = await this.channelsPropertiesService.findAll(infoChannel.id, DEVICES_ZIGBEE2MQTT_TYPE);
				const serialProp = properties.find((p) => p.category === PropertyCategory.SERIAL_NUMBER);
				if (serialProp?.value === request.ieeeAddress) {
					await this.devicesService.remove(device.id);
					break; // Only one device should match
				}
			}
		}

		// Pre-validate the device structure
		// Pass z2mDevice to get static properties from YAML mappings
		this.preValidateDeviceStructure(request, z2mDevice);

		// Create device DTO
		const createDeviceDto = toInstance(CreateZigbee2mqttDeviceDto, {
			type: DEVICES_ZIGBEE2MQTT_TYPE,
			identifier: z2mDevice.friendlyName,
			name: request.name,
			category: request.category,
			description: request.description || null, // Convert empty string to null
			enabled: request.enabled ?? true,
		});

		// Validate device DTO
		const deviceErrors = await validate(createDeviceDto);
		if (deviceErrors.length) {
			const errorMessages = deviceErrors.map((e) => {
				const constraints = e.constraints ? Object.values(e.constraints).join(', ') : 'unknown error';
				return `${e.property}: ${constraints}`;
			});
			this.logger.error(`[DEVICE ADOPTION] Device validation failed: ${errorMessages.join('; ')}`);
			throw new DevicesZigbee2mqttValidationException(`Device validation failed: ${errorMessages.join('; ')}`);
		}

		// Create the device
		const device = await this.devicesService.create<Zigbee2mqttDeviceEntity, CreateZigbee2mqttDeviceDto>(
			createDeviceDto,
		);

		try {
			// Create device information channel
			await this.createDeviceInformationChannel(device, z2mDevice);

			// Create user-defined channels from adoption request
			for (const channelDef of request.channels) {
				// Skip device_information as it's created separately
				if (channelDef.category === ChannelCategory.DEVICE_INFORMATION) {
					continue;
				}
				await this.createChannel(device, channelDef, z2mDevice);
			}

			// Set initial connection state
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: z2mDevice.available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			});

			// Request current state from Z2M to populate property values
			// This triggers Z2M to publish the device's current state, which will be processed by updateDeviceState
			const stateRequested = await this.zigbee2mqttService.requestDeviceState(z2mDevice.friendlyName);
			if (stateRequested) {
				// Intentionally empty - state requested successfully
			} else {
				this.logger.warn(
					`[DEVICE ADOPTION] Failed to request state for device: ${z2mDevice.friendlyName} (MQTT may not be connected)`,
				);
			}

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

		// Get link quality from current state (Z2M provides this as 'linkquality')
		const linkQuality = z2mDevice.currentState?.linkquality;
		// Normalize to percentage (Z2M reports 0-255, spec expects 0-100)
		const linkQualityPercent = typeof linkQuality === 'number' ? Math.round((linkQuality / 255) * 100) : null;

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
				identifier: Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
				name: 'Link Quality',
				category: PropertyCategory.LINK_QUALITY,
				value: linkQualityPercent,
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
	}

	/**
	 * Create a channel from adoption request
	 */
	private async createChannel(
		device: Zigbee2mqttDeviceEntity,
		channelDef: AdoptDeviceRequestDto['channels'][0],
		z2mDevice: Z2mRegisteredDevice,
	): Promise<void> {
		// Get channel spec
		const channelSpec = this.getChannelSpec(channelDef.category);

		// Get mapped properties from YAML to access transformer names
		const mappedChannels = z2mDevice.definition?.exposes
			? this.exposesMapper.mapExposes(z2mDevice.definition.exposes, {
					model: z2mDevice.definition.model,
					manufacturer: z2mDevice.definition.vendor,
				})
			: [];
		const mappedChannel = mappedChannels.find((mc) => mc.category === channelDef.category);

		// Helper to find transformer name for a property
		const findTransformerName = (z2mProperty: string, category: PropertyCategory): string | undefined => {
			if (!mappedChannel) return undefined;
			const mappedProp = mappedChannel.properties.find((p) => p.z2mProperty === z2mProperty && p.category === category);
			return mappedProp?.transformerName;
		};

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

		// Build virtual property context for this channel
		const virtualContext: VirtualPropertyContext = {
			state: z2mDevice.currentState,
			friendlyName: z2mDevice.friendlyName,
			ieeeAddress: z2mDevice.ieeeAddress,
		};

		// Track used identifiers to detect duplicates (e.g., multiple properties mapping to same z2mProperty)
		const usedIdentifiers = new Set<string>();

		// Create properties
		for (const propDef of channelDef.properties) {
			const propSpec = channelSpec?.properties?.find((p) => p.category === propDef.category);

			// Check if this is a virtual property (z2mProperty starts with "fb.virtual.")
			const isVirtualProperty = propDef.z2mProperty.startsWith('fb.virtual.');

			// For virtual properties, use a different identifier format and resolve the initial value
			let identifier: string;
			let initialValue: string | number | boolean | null = null;

			if (isVirtualProperty) {
				// Virtual property identifier: fb_virtual_{category}
				identifier = `fb_virtual_${propDef.category.toLowerCase()}`;

				// Get the virtual property definition and resolve its value
				const virtualDef = getVirtualPropertyDefinition(channelDef.category, propDef.category);

				if (virtualDef) {
					initialValue = this.virtualPropertyService.resolveVirtualPropertyValue(virtualDef, virtualContext);
				}
			} else {
				// For properties that share the same z2mProperty (like hue/saturation both mapping to "color",
				// or status/command both mapping to "state"), use category as identifier to avoid conflicts
				const potentialIdentifier = propDef.z2mProperty;

				// If this z2mProperty was already used as an identifier, use category instead
				if (usedIdentifiers.has(potentialIdentifier)) {
					identifier = propDef.category.toLowerCase();
				} else {
					identifier = potentialIdentifier;
				}

				// Get initial value from cached Z2M state (if available)
				// The MQTT adapter caches state messages in deviceRegistry[friendlyName].currentState
				const cachedValue = z2mDevice.currentState?.[propDef.z2mProperty];
				if (cachedValue !== undefined) {
					// Handle color object - extract individual values for hue/saturation
					if (
						propDef.z2mProperty === 'color' &&
						typeof cachedValue === 'object' &&
						cachedValue !== null &&
						!Array.isArray(cachedValue)
					) {
						const colorObj = cachedValue as Record<string, unknown>;

						if (propDef.category === PropertyCategory.HUE) {
							// Extract hue from color object
							if ('hue' in colorObj && typeof colorObj.hue === 'number') {
								initialValue = Math.round(colorObj.hue);
							} else if ('h' in colorObj && typeof colorObj.h === 'number') {
								initialValue = Math.round(colorObj.h);
							}
						} else if (propDef.category === PropertyCategory.SATURATION) {
							// Extract saturation from color object
							if ('saturation' in colorObj && typeof colorObj.saturation === 'number') {
								initialValue = Math.round(colorObj.saturation);
							} else if ('s' in colorObj && typeof colorObj.s === 'number') {
								initialValue = Math.round(colorObj.s);
							}
						}

						if (initialValue !== null) {
							// Intentionally empty - initial value extracted
						}
					} else if (
						propDef.z2mProperty === 'color_temp' &&
						propDef.category === PropertyCategory.COLOR_TEMPERATURE &&
						typeof cachedValue === 'number' &&
						cachedValue > 0
					) {
						// Convert mired to Kelvin for color temperature
						// Device-specific range is already set in property format by exposes-mapper
						initialValue = Math.round(1000000 / cachedValue);
					} else if (
						typeof cachedValue === 'boolean' ||
						typeof cachedValue === 'number' ||
						typeof cachedValue === 'string'
					) {
						// Convert value to appropriate type
						initialValue = cachedValue;
					} else if (cachedValue !== null) {
						// For complex values (objects), stringify them
						initialValue = JSON.stringify(cachedValue);
					}
				}
			}

			// For properties that share z2mProperty (like hue/saturation both using "color"),
			// use the category for the name instead of z2mProperty
			const isColorProperty =
				propDef.z2mProperty === 'color' &&
				(propDef.category === PropertyCategory.HUE || propDef.category === PropertyCategory.SATURATION);
			const propertyName = isVirtualProperty || isColorProperty ? propDef.category : propDef.z2mProperty;

			const createPropertyDto = toInstance(CreateZigbee2mqttChannelPropertyDto, {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name: this.formatPropertyName(propertyName),
				category: propDef.category,
				data_type: propDef.dataType,
				permissions: propDef.permissions,
				unit: propDef.unit ?? propSpec?.unit ?? null,
				format: propDef.format ?? propSpec?.format ?? null,
				invalid: propSpec?.invalid ?? null,
				step: propSpec?.step ?? null,
				value: initialValue,
			});

			const propertyErrors = await validate(createPropertyDto, { skipMissingProperties: true });
			if (propertyErrors.length) {
				this.logger.warn(
					`[DEVICE ADOPTION] Property validation failed for ${propDef.category}: ${JSON.stringify(propertyErrors)}`,
				);
				// Continue with other properties
				continue;
			}

			const createdProperty = await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createPropertyDto);

			// Register transformer for state updates and writes if one is defined in YAML mapping
			const transformerName = findTransformerName(propDef.z2mProperty, propDef.category);
			if (transformerName) {
				this.deviceMapper.registerPropertyTransformer(createdProperty.id, transformerName, propDef.z2mProperty);
			}

			// Track that this identifier was used
			usedIdentifiers.add(identifier);
		}

		// Create static/derived properties from YAML mapping
		// These properties are not sent by the frontend but defined in the YAML configuration
		await this.createStaticPropertiesFromMapping(channel, channelDef.category, z2mDevice, channelSpec, usedIdentifiers);
	}

	/**
	 * Create static and derived properties from YAML mapping
	 * These properties are defined in the YAML but not sent by the frontend
	 */
	private async createStaticPropertiesFromMapping(
		channel: Zigbee2mqttChannelEntity,
		channelCategory: ChannelCategory,
		z2mDevice: Z2mRegisteredDevice,
		channelSpec: ChannelSpecModel | null,
		usedIdentifiers: Set<string>,
	): Promise<void> {
		// Get mapped channels from YAML configuration
		const mappedChannels = z2mDevice.definition?.exposes
			? this.exposesMapper.mapExposes(z2mDevice.definition.exposes, {
					model: z2mDevice.definition.model,
					manufacturer: z2mDevice.definition.vendor,
				})
			: [];

		// Find the mapped channel that matches this category
		const mappedChannel = mappedChannels.find((mc) => mc.category === channelCategory);
		if (!mappedChannel) {
			return;
		}

		// Find static/derived properties (z2mProperty starts with __static_ or __derived_)
		const staticProperties = mappedChannel.properties.filter(
			(p) => p.z2mProperty.startsWith('__static_') || p.z2mProperty.startsWith('__derived_'),
		);

		for (const staticProp of staticProperties) {
			// Use the spec identifier (category) as the property identifier
			const identifier = staticProp.category.toLowerCase();

			// Skip if this identifier was already created (from request properties)
			if (usedIdentifiers.has(identifier)) {
				this.logger.debug(
					`[DEVICE ADOPTION] Skipping static property '${staticProp.category}' - already created from request`,
				);
				continue;
			}

			const propSpec = channelSpec?.properties?.find((p) => p.category === staticProp.category);

			// Get the initial value from staticValue or null for derived properties
			const initialValue = staticProp.staticValue ?? null;

			const createPropertyDto = toInstance(CreateZigbee2mqttChannelPropertyDto, {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name: this.formatPropertyName(staticProp.name),
				category: staticProp.category,
				data_type: staticProp.dataType,
				permissions: staticProp.permissions,
				unit: staticProp.unit ?? propSpec?.unit ?? null,
				format: staticProp.format ?? propSpec?.format ?? null,
				invalid: propSpec?.invalid ?? null,
				step: propSpec?.step ?? null,
				value: initialValue,
			});

			const propertyErrors = await validate(createPropertyDto, { skipMissingProperties: true });
			if (propertyErrors.length) {
				this.logger.warn(
					`[DEVICE ADOPTION] Static property validation failed for ${staticProp.category}: ${JSON.stringify(propertyErrors)}`,
				);
				continue;
			}

			await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createPropertyDto);

			this.logger.debug(`[DEVICE ADOPTION] Created static property '${staticProp.category}' for channel`);
		}
	}

	/**
	 * Pre-validate device structure before creation using the DeviceValidationService
	 */
	private preValidateDeviceStructure(request: AdoptDeviceRequestDto, z2mDevice: Z2mRegisteredDevice): void {
		// Check that at least one channel is provided
		if (!request.channels.length) {
			throw new DevicesZigbee2mqttValidationException('At least one channel must be defined');
		}

		// Get mapped channels from YAML configuration to include static/derived properties
		// These properties are defined in the YAML but not sent by the frontend
		const mappedChannels = z2mDevice.definition?.exposes
			? this.exposesMapper.mapExposes(z2mDevice.definition.exposes, {
					model: z2mDevice.definition.model,
					manufacturer: z2mDevice.definition.vendor,
				})
			: [];

		// Build a map of channel category to ALL properties from YAML mappings
		// This ensures validation sees all properties that will be created, not just what frontend submits
		const mappedPropertiesByChannel = this.buildMappedPropertiesMap(mappedChannels);

		// Build the device data input for validation
		// Include device_information channel that will be auto-created
		const channels: ChannelDataInput[] = [
			{
				category: ChannelCategory.DEVICE_INFORMATION,
				properties: [
					{ category: PropertyCategory.MANUFACTURER },
					{ category: PropertyCategory.MODEL },
					{ category: PropertyCategory.SERIAL_NUMBER },
				],
			},
		];

		// Add user-defined channels (excluding device_information if duplicated)
		for (const channelDef of request.channels) {
			if (channelDef.category === ChannelCategory.DEVICE_INFORMATION) {
				continue;
			}

			// Get properties from request
			const requestProperties = channelDef.properties.map((p) => ({
				category: p.category,
				dataType: p.dataType,
				permissions: p.permissions,
			}));

			// Get ALL properties from YAML mapping for this channel category
			// This includes feature-mapped, static, and derived properties
			const mappedProperties = mappedPropertiesByChannel.get(channelDef.category) ?? [];
			const requestCategories = new Set(requestProperties.map((p) => p.category));

			// Add mapped properties that aren't already in the request
			for (const mappedProp of mappedProperties) {
				if (!requestCategories.has(mappedProp.category)) {
					requestProperties.push(mappedProp);
				}
			}

			channels.push({
				category: channelDef.category,
				properties: requestProperties,
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
	}

	/**
	 * Build a map of channel category to ALL properties from YAML mappings
	 * This includes both regular feature-mapped properties and static/derived properties
	 * Used for validation to ensure all required properties will be created
	 */
	private buildMappedPropertiesMap(
		mappedChannels: MappedChannel[],
	): Map<
		ChannelCategory,
		Array<{ category: PropertyCategory; dataType: DataTypeType; permissions: PermissionType[] }>
	> {
		const result = new Map<
			ChannelCategory,
			Array<{ category: PropertyCategory; dataType: DataTypeType; permissions: PermissionType[] }>
		>();

		for (const channel of mappedChannels) {
			const props: Array<{
				category: PropertyCategory;
				dataType: DataTypeType;
				permissions: PermissionType[];
			}> = [];

			for (const prop of channel.properties) {
				props.push({
					category: prop.category,
					dataType: prop.dataType,
					permissions: prop.permissions,
				});
			}

			if (props.length > 0) {
				const existing = result.get(channel.category) ?? [];
				result.set(channel.category, [...existing, ...props]);
			}
		}

		return result;
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
