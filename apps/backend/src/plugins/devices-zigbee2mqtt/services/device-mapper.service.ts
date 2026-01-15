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
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { ChannelsService } from '../../../modules/devices/services/channels.service';
import { DeviceConnectivityService } from '../../../modules/devices/services/device-connectivity.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import {
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	DEVICES_ZIGBEE2MQTT_TYPE,
	Z2M_CHANNEL_IDENTIFIERS,
	Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS,
	mapZ2mCategoryToDeviceCategory,
} from '../devices-zigbee2mqtt.constants';
import { CreateZigbee2mqttChannelPropertyDto } from '../dto/create-channel-property.dto';
import { CreateZigbee2mqttChannelDto } from '../dto/create-channel.dto';
import { CreateZigbee2mqttDeviceDto } from '../dto/create-device.dto';
import { UpdateZigbee2mqttChannelPropertyDto } from '../dto/update-channel-property.dto';
import { UpdateZigbee2mqttChannelDto } from '../dto/update-channel.dto';
import {
	Zigbee2mqttChannelEntity,
	Zigbee2mqttChannelPropertyEntity,
	Zigbee2mqttDeviceEntity,
} from '../entities/devices-zigbee2mqtt.entity';
import { Z2mDevice, Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';
import { MappingLoaderService } from '../mappings/mapping-loader.service';
import { TransformerRegistry } from '../mappings/transformers';

import { MappedChannel, MappedProperty, Z2mExposesMapperService } from './exposes-mapper.service';
import { Z2mVirtualPropertyService } from './virtual-property.service';
import {
	VirtualPropertyContext,
	getVirtualPropertiesForChannel,
	getVirtualPropertyDefinition,
} from './virtual-property.types';

/**
 * Device Mapper Service
 *
 * Maps Zigbee2MQTT devices to Smart Panel entities (devices, channels, properties).
 *
 * Identifier mapping:
 * - Device identifier = friendly_name (for lookup by MQTT topic)
 * - Channel identifier = channel category or type_endpoint
 * - Property identifier = z2m property name (for matching MQTT state keys)
 */
@Injectable()
export class Z2mDeviceMapperService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'DeviceMapper',
	);

	// Per-device locks to prevent concurrent mapping of the same device
	private readonly deviceLocks = new Map<string, Promise<Zigbee2mqttDeviceEntity | null>>();

	// Property ID → transformer info mapping for applying transformers during state updates and writes
	private readonly propertyTransformers = new Map<string, { transformerName: string; z2mProperty: string }>();

	constructor(
		private readonly devicesService: DevicesService,
		private readonly channelsService: ChannelsService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
		private readonly deviceConnectivityService: DeviceConnectivityService,
		private readonly exposesMapper: Z2mExposesMapperService,
		private readonly virtualPropertyService: Z2mVirtualPropertyService,
		private readonly mappingLoader: MappingLoaderService,
		private readonly configDrivenConverter: ConfigDrivenConverter,
		private readonly transformerRegistry: TransformerRegistry,
	) {}

	/**
	 * Register a transformer for a property
	 * @param propertyId - The property ID
	 * @param transformerName - The name of the transformer
	 * @param z2mProperty - The Z2M property name for write operations
	 */
	registerPropertyTransformer(propertyId: string, transformerName: string, z2mProperty: string): void {
		this.propertyTransformers.set(propertyId, { transformerName, z2mProperty });
	}

	/**
	 * Restore transformers for all existing devices from YAML mappings
	 * Called on startup to ensure transformers are available after backend restart
	 */
	async restoreTransformersForExistingDevices(registeredDevices: Z2mRegisteredDevice[]): Promise<void> {
		// Build a map for quick lookup by friendly name
		const deviceRegistry = new Map<string, Z2mRegisteredDevice>();
		for (const device of registeredDevices) {
			deviceRegistry.set(device.friendlyName, device);
		}

		const devices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);

		for (const device of devices) {
			// Get Z2M device info from registry
			const z2mDevice = deviceRegistry.get(device.identifier);
			if (!z2mDevice?.definition) {
				continue;
			}

			// Get YAML mappings for this device
			const mappedChannels = this.exposesMapper.mapExposes(z2mDevice.definition.exposes, {
				model: z2mDevice.definition.model,
				manufacturer: z2mDevice.definition.vendor,
			});

			// Get all channels for this device
			const channels = await this.channelsService.findAll<Zigbee2mqttChannelEntity>(device.id, DEVICES_ZIGBEE2MQTT_TYPE);

			for (const channel of channels) {
				// Find the YAML mapping for this channel by category
				const mappedChannel = mappedChannels.find((mc) => mc.category === channel.category);
				if (!mappedChannel) {
					continue;
				}

				// Get all properties for this channel
				const properties = await this.channelsPropertiesService.findAll<Zigbee2mqttChannelPropertyEntity>(
					channel.id,
					DEVICES_ZIGBEE2MQTT_TYPE,
				);

				for (const property of properties) {
					// Find the YAML mapping for this property by category
					const mappedProperty = mappedChannel.properties.find((mp) => mp.category === property.category);
					if (!mappedProperty?.transformerName) {
						continue;
					}

					// Register the transformer
					this.logger.debug(
						`Restoring transformer for property: ${property.id} (${property.category}) -> ${mappedProperty.transformerName}`,
					);
					this.registerPropertyTransformer(property.id, mappedProperty.transformerName, mappedProperty.z2mProperty);
				}
			}
		}

		this.logger.log(`Restored transformers for ${this.propertyTransformers.size} properties`);
	}

	/**
	 * Apply transformer to read a value from Z2M
	 */
	transformReadValue(propertyId: string, value: unknown): unknown {
		const transformerInfo = this.propertyTransformers.get(propertyId);
		if (!transformerInfo) {
			return value;
		}

		const transformer = this.transformerRegistry.get(transformerInfo.transformerName);
		if (!transformer) {
			return value;
		}

		try {
			return transformer.read(value);
		} catch (error) {
			this.logger.warn(`Failed to transform value with ${transformerInfo.transformerName}: ${error}`);
			return value;
		}
	}

	/**
	 * Apply transformer to write a value to Z2M
	 * Returns the transformed value and z2mProperty, or null if no transformer is registered
	 */
	transformWriteValue(propertyId: string, value: unknown): { z2mProperty: string; transformedValue: unknown } | null {
		const transformerInfo = this.propertyTransformers.get(propertyId);
		if (!transformerInfo) {
			return null;
		}

		const transformer = this.transformerRegistry.get(transformerInfo.transformerName);
		if (!transformer) {
			return null;
		}

		try {
			const transformedValue = transformer.write(value);
			return { z2mProperty: transformerInfo.z2mProperty, transformedValue };
		} catch (error) {
			this.logger.warn(`Failed to transform write value with ${transformerInfo.transformerName}: ${error}`);
			return null;
		}
	}

	/**
	 * Get the z2mProperty for a property if a transformer is registered
	 * Used to determine which Z2M state key to read for this property
	 */
	getZ2mPropertyForProperty(propertyId: string): string | null {
		const transformerInfo = this.propertyTransformers.get(propertyId);
		return transformerInfo?.z2mProperty ?? null;
	}

	/**
	 * Map and create or update a device from Z2M registry
	 * @param z2mDevice The Z2M device to map
	 * @param createIfNotExists If true, creates new devices; if false, only updates existing devices
	 */
	async mapDevice(
		z2mDevice: Z2mDevice | Z2mRegisteredDevice,
		createIfNotExists: boolean = true,
	): Promise<Zigbee2mqttDeviceEntity | null> {
		const friendlyName = 'friendly_name' in z2mDevice ? z2mDevice.friendly_name : z2mDevice.friendlyName;

		// Use per-device lock to prevent concurrent mapping of the same device
		const existingLock = this.deviceLocks.get(friendlyName);
		if (existingLock !== undefined) {
			return existingLock;
		}

		const mappingPromise = this.doMapDevice(z2mDevice, createIfNotExists);
		this.deviceLocks.set(friendlyName, mappingPromise);

		try {
			return await mappingPromise;
		} finally {
			this.deviceLocks.delete(friendlyName);
		}
	}

	/**
	 * Internal device mapping logic
	 */
	private async doMapDevice(
		z2mDevice: Z2mDevice | Z2mRegisteredDevice,
		createIfNotExists: boolean,
	): Promise<Zigbee2mqttDeviceEntity | null> {
		const friendlyName = 'friendly_name' in z2mDevice ? z2mDevice.friendly_name : z2mDevice.friendlyName;
		const definition = z2mDevice.definition;

		if (!definition) {
			return null;
		}

		// Device identifier = friendly_name (used for MQTT topic matching)
		const identifier = friendlyName;

		this.logger.log(`Mapping device: ${friendlyName}`);

		// Determine device category from YAML mapping (with fallback to hardcoded function)
		const exposeTypes = definition.exposes.map((e) => e.type);
		const propertyNames = definition.exposes.map((e) => e.name ?? e.property).filter((n): n is string => !!n);

		// First try to get category from YAML mapping (supports device-specific mappings)
		const yamlCategory = this.exposesMapper
			.getConfigDrivenConverter()
			.getSuggestedDeviceCategory(definition.exposes, { model: definition.model, manufacturer: definition.vendor });

		// Use YAML category if found, otherwise fall back to hardcoded function
		const deviceCategory = yamlCategory ?? mapZ2mCategoryToDeviceCategory(exposeTypes, propertyNames);

		// Create or update device
		let device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			identifier,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!device) {
			if (!createIfNotExists) {
				return null;
			}

			this.logger.log(`Creating new device: ${identifier}`);

			// Use user-defined description if available, otherwise format friendlyName
			const userDescription = 'description' in z2mDevice ? z2mDevice.description : undefined;
			const deviceName = userDescription || friendlyName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

			const createDto: CreateZigbee2mqttDeviceDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name: deviceName,
				category: deviceCategory,
				enabled: true,
			};

			device = await this.devicesService.create<Zigbee2mqttDeviceEntity, CreateZigbee2mqttDeviceDto>(createDto);
		}

		// Skip channel/property creation if device is disabled
		if (!device.enabled) {
			return device;
		}

		// Create device information channel
		await this.createDeviceInfoChannel(device, z2mDevice);

		// Map exposes to channels and properties
		const mappedChannels = this.exposesMapper.mapExposes(definition.exposes, {
			model: definition.model,
			manufacturer: definition.vendor,
		});

		// Build virtual property context
		const ieeeAddress = 'ieee_address' in z2mDevice ? z2mDevice.ieee_address : z2mDevice.ieeeAddress;
		const currentState = 'currentState' in z2mDevice ? z2mDevice.currentState : {};
		const virtualContext: VirtualPropertyContext = {
			state: currentState,
			friendlyName,
			ieeeAddress,
		};

		await this.createChannelsAndProperties(device, mappedChannels, virtualContext);

		return device;
	}

	/**
	 * Update device state from MQTT state message
	 * Device is found by identifier (which equals friendly_name)
	 * Properties are matched by identifier (which equals z2m property name)
	 */
	async updateDeviceState(friendlyName: string, state: Record<string, unknown>): Promise<void> {
		// Find device by identifier (= friendly_name)
		const device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			friendlyName,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!device) {
			return;
		}

		if (!device.enabled) {
			return;
		}

		this.logger.debug(`Updating state for ${friendlyName}: ${JSON.stringify(state)}`, { resource: device.id });

		// Get all channels for this device
		const channels = await this.channelsService.findAll<Zigbee2mqttChannelEntity>(device.id, DEVICES_ZIGBEE2MQTT_TYPE);

		this.logger.debug(`Found ${channels.length} channels for device ${friendlyName}`, { resource: device.id });

		// Build virtual property context
		const virtualContext: VirtualPropertyContext = {
			state,
			friendlyName,
			ieeeAddress: '', // Not available in state update context
		};

		for (const channel of channels) {
			// Get all properties for this channel
			const properties = await this.channelsPropertiesService.findAll<Zigbee2mqttChannelPropertyEntity>(
				channel.id,
				DEVICES_ZIGBEE2MQTT_TYPE,
			);

			for (const property of properties) {
				const propertyIdentifier = property.identifier;

				// Skip properties without identifier
				if (!propertyIdentifier) {
					this.logger.warn(`Property ${property.id} has no identifier, skipping`, { resource: device.id });
					continue;
				}

				// Check if this is a virtual property (identifier starts with "fb_virtual_")
				if (propertyIdentifier.startsWith('fb_virtual_')) {
					// Virtual property - recalculate value from Z2M state
					const virtualDef = getVirtualPropertyDefinition(channel.category, property.category);

					if (virtualDef) {
						const newValue = this.virtualPropertyService.resolveVirtualPropertyValue(virtualDef, virtualContext);

						this.logger.debug(
							`Updating virtual property ${propertyIdentifier} = ${newValue} (channel: ${channel.category})`,
							{ resource: device.id },
						);

						await this.channelsPropertiesService.update<
							Zigbee2mqttChannelPropertyEntity,
							UpdateZigbee2mqttChannelPropertyDto
						>(
							property.id,
							toInstance(UpdateZigbee2mqttChannelPropertyDto, {
								type: DEVICES_ZIGBEE2MQTT_TYPE,
								value: newValue,
							}),
						);
					}
					continue;
				}

				// Determine which Z2M property to read from
				// Properties with registered transformers may have different z2mProperty than identifier
				// (e.g., SPEED property has identifier "speed" but z2mProperty "mode")
				const registeredZ2mProperty = this.getZ2mPropertyForProperty(property.id);
				const z2mPropertyKey = registeredZ2mProperty ?? propertyIdentifier;

				// Regular property - update from Z2M state if present
				if (!(z2mPropertyKey in state)) {
					continue;
				}

				// Skip window_covering status - handled separately with value normalization
				if (
					channel.category === ChannelCategory.WINDOW_COVERING &&
					property.category === PropertyCategory.STATUS &&
					z2mPropertyKey === 'state'
				) {
					continue;
				}

				// Skip brightness - handled separately with range normalization (Z2M 0-254 -> spec 0-100%)
				if (channel.category === ChannelCategory.LIGHT && property.category === PropertyCategory.BRIGHTNESS) {
					continue;
				}

				// Skip hue/saturation - handled separately from color object
				if (
					channel.category === ChannelCategory.LIGHT &&
					(property.category === PropertyCategory.HUE || property.category === PropertyCategory.SATURATION)
				) {
					continue;
				}

				// Skip color_temp - handled separately with mired to Kelvin conversion
				if (channel.category === ChannelCategory.LIGHT && property.category === PropertyCategory.COLOR_TEMPERATURE) {
					continue;
				}

				// Skip link_quality - handled separately with range normalization (Z2M 0-255 -> spec 0-100%)
				if (
					channel.category === ChannelCategory.DEVICE_INFORMATION &&
					property.category === PropertyCategory.LINK_QUALITY
				) {
					continue;
				}

				const rawValue = state[z2mPropertyKey];

				// Apply transformer if one is registered for this property
				const transformedValue = this.transformReadValue(property.id, rawValue);

				// Convert value to appropriate type based on property's data type
				const convertedValue = this.convertValue(transformedValue, property.dataType);

				this.logger.debug(
					`Updating property ${propertyIdentifier} from z2m[${z2mPropertyKey}] (${property.dataType}) = ${JSON.stringify(rawValue)} -> ${JSON.stringify(transformedValue)} -> ${convertedValue}`,
				);

				// Update property value
				await this.channelsPropertiesService.update<
					Zigbee2mqttChannelPropertyEntity,
					UpdateZigbee2mqttChannelPropertyDto
				>(
					property.id,
					toInstance(UpdateZigbee2mqttChannelPropertyDto, {
						type: DEVICES_ZIGBEE2MQTT_TYPE,
						value: convertedValue,
					}),
				);
			}

			// Handle window_covering status from Z2M 'state' property
			// Z2M sends: state: "OPEN" | "CLOSE" | "STOP"
			// We normalize to: status = "opened" | "closed" | "stopped"
			// Note: Property identifier is 'state' (z2m property), category is STATUS
			if (channel.category === ChannelCategory.WINDOW_COVERING && 'state' in state) {
				const statusProp = properties.find((p) => p.category === PropertyCategory.STATUS);

				if (statusProp) {
					const z2mState = state.state;
					const normalizedStatus = this.normalizeCoverState(z2mState);

					if (normalizedStatus) {
						this.logger.debug(`Updating window covering status: ${JSON.stringify(z2mState)} -> ${normalizedStatus}`);

						await this.channelsPropertiesService.update<
							Zigbee2mqttChannelPropertyEntity,
							UpdateZigbee2mqttChannelPropertyDto
						>(
							statusProp.id,
							toInstance(UpdateZigbee2mqttChannelPropertyDto, {
								type: DEVICES_ZIGBEE2MQTT_TYPE,
								value: normalizedStatus,
							}),
						);
					}
				}
			}

			// Also update link_quality in device_information channel
			if (channel.category === ChannelCategory.DEVICE_INFORMATION && 'linkquality' in state) {
				const linkQualityProp = properties.find(
					(p) => p.identifier === Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
				);

				if (linkQualityProp) {
					const linkQuality = state.linkquality;
					// Normalize to percentage (Z2M reports 0-255, spec expects 0-100)
					const linkQualityPercent = typeof linkQuality === 'number' ? Math.round((linkQuality / 255) * 100) : null;

					this.logger.debug(`Updating link_quality = ${linkQualityPercent}%`);

					await this.channelsPropertiesService.update<
						Zigbee2mqttChannelPropertyEntity,
						UpdateZigbee2mqttChannelPropertyDto
					>(
						linkQualityProp.id,
						toInstance(UpdateZigbee2mqttChannelPropertyDto, {
							type: DEVICES_ZIGBEE2MQTT_TYPE,
							value: linkQualityPercent,
						}),
					);
				}
			}

			// Handle brightness normalization for light channels
			// Z2M uses 0-254, spec uses 0-100%
			if (channel.category === ChannelCategory.LIGHT && 'brightness' in state) {
				const brightnessProp = properties.find((p) => p.category === PropertyCategory.BRIGHTNESS);

				if (brightnessProp) {
					const z2mBrightness = state.brightness;
					// Convert Z2M range (0-254) to spec range (0-100%)
					const brightnessPercent = typeof z2mBrightness === 'number' ? Math.round((z2mBrightness / 254) * 100) : null;

					this.logger.debug(`Updating brightness: ${JSON.stringify(z2mBrightness)} -> ${brightnessPercent}%`);

					await this.channelsPropertiesService.update<
						Zigbee2mqttChannelPropertyEntity,
						UpdateZigbee2mqttChannelPropertyDto
					>(
						brightnessProp.id,
						toInstance(UpdateZigbee2mqttChannelPropertyDto, {
							type: DEVICES_ZIGBEE2MQTT_TYPE,
							value: brightnessPercent,
						}),
					);
				}
			}

			// Handle color state updates for light channels
			// Z2M sends: color: { hue: 0-360, saturation: 0-100 } or { x: 0-1, y: 0-1 }
			if (channel.category === ChannelCategory.LIGHT && 'color' in state) {
				const colorState = state.color as Record<string, unknown> | undefined;

				if (colorState && typeof colorState === 'object') {
					// Handle hue - only update if we have a valid number
					if ('hue' in colorState && typeof colorState.hue === 'number') {
						const hueProp = properties.find((p) => p.category === PropertyCategory.HUE);
						if (hueProp) {
							const hueValue = Math.round(colorState.hue);
							this.logger.debug(`Updating hue: ${colorState.hue} -> ${hueValue}`);

							await this.channelsPropertiesService.update<
								Zigbee2mqttChannelPropertyEntity,
								UpdateZigbee2mqttChannelPropertyDto
							>(
								hueProp.id,
								toInstance(UpdateZigbee2mqttChannelPropertyDto, {
									type: DEVICES_ZIGBEE2MQTT_TYPE,
									value: hueValue,
								}),
							);
						}
					}

					// Handle saturation - only update if we have a valid number
					if ('saturation' in colorState && typeof colorState.saturation === 'number') {
						const saturationProp = properties.find((p) => p.category === PropertyCategory.SATURATION);
						if (saturationProp) {
							const satValue = Math.round(colorState.saturation);
							this.logger.debug(`Updating saturation: ${colorState.saturation} -> ${satValue}%`);

							await this.channelsPropertiesService.update<
								Zigbee2mqttChannelPropertyEntity,
								UpdateZigbee2mqttChannelPropertyDto
							>(
								saturationProp.id,
								toInstance(UpdateZigbee2mqttChannelPropertyDto, {
									type: DEVICES_ZIGBEE2MQTT_TYPE,
									value: satValue,
								}),
							);
						}
					}
				}
			}

			// Handle color temperature conversion for light channels
			// Z2M uses mired, spec uses Kelvin
			// Conversion: Kelvin = 1,000,000 / mired
			if (channel.category === ChannelCategory.LIGHT && 'color_temp' in state) {
				const colorTempProp = properties.find((p) => p.category === PropertyCategory.COLOR_TEMPERATURE);

				if (colorTempProp) {
					const z2mColorTemp = state.color_temp;
					if (typeof z2mColorTemp === 'number' && z2mColorTemp > 0) {
						// Convert mired to Kelvin
						const kelvin = Math.round(1000000 / z2mColorTemp);

						// Clamp to property's format (device-specific Kelvin range)
						const propFormat = colorTempProp.format;
						const minKelvin = Array.isArray(propFormat) && typeof propFormat[0] === 'number' ? propFormat[0] : 2000;
						const maxKelvin = Array.isArray(propFormat) && typeof propFormat[1] === 'number' ? propFormat[1] : 6500;
						const clampedKelvin = Math.max(minKelvin, Math.min(maxKelvin, kelvin));

						this.logger.debug(
							`Updating color_temp: ${z2mColorTemp} mired -> ${clampedKelvin} K (range: ${minKelvin}-${maxKelvin})`,
						);

						await this.channelsPropertiesService.update<
							Zigbee2mqttChannelPropertyEntity,
							UpdateZigbee2mqttChannelPropertyDto
						>(
							colorTempProp.id,
							toInstance(UpdateZigbee2mqttChannelPropertyDto, {
								type: DEVICES_ZIGBEE2MQTT_TYPE,
								value: clampedKelvin,
							}),
						);
					}
				}
			}

			// Handle derived properties (calculated from source properties)
			await this.updateDerivedProperties(channel, properties, state, device.id);
		}
	}

	/**
	 * Update derived properties for a channel based on source property values
	 */
	private async updateDerivedProperties(
		channel: Zigbee2mqttChannelEntity,
		properties: Zigbee2mqttChannelPropertyEntity[],
		state: Record<string, unknown>,
		deviceId: string,
	): Promise<void> {
		// Get derived property definitions for this channel category
		const derivedDefs = this.mappingLoader.getDerivedPropertiesForChannel(channel.category);

		if (derivedDefs.length === 0) {
			return;
		}

		for (const derivedDef of derivedDefs) {
			// Find the derived property in this channel
			const derivedProp = properties.find((p) => p.category.toLowerCase() === derivedDef.identifier);

			if (!derivedProp) {
				continue;
			}

			// Find the source property in this channel
			const sourceProp = properties.find((p) => p.category.toLowerCase() === derivedDef.sourceProperty);

			if (!sourceProp) {
				this.logger.debug(
					`Source property '${derivedDef.sourceProperty}' not found for derived property '${derivedDef.identifier}'`,
					{ resource: deviceId },
				);
				continue;
			}

			// Get source value from incoming state (preferred) or from stored property value
			let sourceValue: unknown = undefined;

			// Try to get value from state using source property identifier
			if (sourceProp.identifier && sourceProp.identifier in state) {
				sourceValue = state[sourceProp.identifier];
			}

			// Fall back to stored property value if not in state
			if (sourceValue === undefined) {
				sourceValue = sourceProp.value;
			}

			// Skip if no source value available
			if (sourceValue === null || sourceValue === undefined) {
				continue;
			}

			// Apply derivation to compute the derived value
			const derivedValue = this.configDrivenConverter.applyDerivation(derivedDef.derivation, sourceValue);

			if (derivedValue === null) {
				continue;
			}

			this.logger.debug(
				`Updating derived property ${derivedProp.identifier} = ${derivedValue} (from ${sourceProp.identifier} = ${JSON.stringify(sourceValue)})`,
				{ resource: deviceId },
			);

			await this.channelsPropertiesService.update<
				Zigbee2mqttChannelPropertyEntity,
				UpdateZigbee2mqttChannelPropertyDto
			>(
				derivedProp.id,
				toInstance(UpdateZigbee2mqttChannelPropertyDto, {
					type: DEVICES_ZIGBEE2MQTT_TYPE,
					value: derivedValue,
				}),
			);
		}
	}

	/**
	 * Set device availability state
	 * Device is found by identifier (which equals friendly_name)
	 */
	async setDeviceAvailability(friendlyName: string, available: boolean): Promise<void> {
		const device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			friendlyName,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (device) {
			await this.deviceConnectivityService.setConnectionState(device.id, {
				state: available ? ConnectionState.CONNECTED : ConnectionState.DISCONNECTED,
			});
		} else {
			// Use debug level - device may not exist yet if availability arrives before mapping
			// This is normal during startup when Z2M sends availability before bridge/devices
		}
	}

	/**
	 * Set device connection state by identifier
	 */
	async setDeviceConnectionState(identifier: string, state: ConnectionState): Promise<void> {
		const device = await this.devicesService.findOneBy<Zigbee2mqttDeviceEntity>(
			'identifier',
			identifier,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (device) {
			await this.deviceConnectivityService.setConnectionState(device.id, { state });
		}
	}

	/**
	 * Get all devices
	 */
	async getAllDevices(): Promise<Zigbee2mqttDeviceEntity[]> {
		return this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
	}

	/**
	 * Create device information channel
	 */
	private async createDeviceInfoChannel(
		device: Zigbee2mqttDeviceEntity,
		z2mDevice: Z2mDevice | Z2mRegisteredDevice,
	): Promise<void> {
		const channelIdentifier = Z2M_CHANNEL_IDENTIFIERS.DEVICE_INFORMATION;
		const definition = z2mDevice.definition;
		const ieeeAddress = 'ieee_address' in z2mDevice ? z2mDevice.ieee_address : z2mDevice.ieeeAddress;

		// Get current state if available (Z2mRegisteredDevice has it)
		const currentState = 'currentState' in z2mDevice ? z2mDevice.currentState : {};

		// Get link quality from current state (Z2M provides this as 'linkquality')
		const linkQuality = currentState?.linkquality;
		// Normalize to percentage (Z2M reports 0-255, spec expects 0-100)
		const linkQualityPercent = typeof linkQuality === 'number' ? Math.round((linkQuality / 255) * 100) : null;

		// Find or create channel
		let channel = await this.channelsService.findOneBy<Zigbee2mqttChannelEntity>(
			'identifier',
			channelIdentifier,
			device.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!channel) {
			const createChannelDto: CreateZigbee2mqttChannelDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: channelIdentifier,
				name: 'Device Information',
				category: ChannelCategory.DEVICE_INFORMATION,
				device: device.id,
			};

			channel = await this.channelsService.create<Zigbee2mqttChannelEntity, CreateZigbee2mqttChannelDto>(
				createChannelDto,
			);
		}

		// Create/update device info properties
		// Properties must match the device_information channel spec
		await this.createOrUpdateInfoProperty(
			channel,
			Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MANUFACTURER,
			'Manufacturer',
			PropertyCategory.MANUFACTURER,
			definition?.vendor ?? 'Unknown',
		);
		await this.createOrUpdateInfoProperty(
			channel,
			Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.MODEL,
			'Model',
			PropertyCategory.MODEL,
			definition?.model ?? 'Unknown',
		);
		await this.createOrUpdateInfoProperty(
			channel,
			Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.SERIAL_NUMBER,
			'Serial Number',
			PropertyCategory.SERIAL_NUMBER,
			ieeeAddress,
		);
		await this.createOrUpdateInfoProperty(
			channel,
			Z2M_DEVICE_INFO_PROPERTY_IDENTIFIERS.LINK_QUALITY,
			'Link Quality',
			PropertyCategory.LINK_QUALITY,
			linkQualityPercent,
			DataTypeType.UCHAR,
			'%',
			[0, 100],
		);
	}

	/**
	 * Create or update an info property
	 */
	private async createOrUpdateInfoProperty(
		channel: Zigbee2mqttChannelEntity,
		identifier: string,
		name: string,
		category: PropertyCategory,
		value: string | number | null,
		dataType: DataTypeType = DataTypeType.STRING,
		unit: string | null = null,
		format: string[] | number[] | null = null,
	): Promise<void> {
		const property = await this.channelsPropertiesService.findOneBy<Zigbee2mqttChannelPropertyEntity>(
			'identifier',
			identifier,
			channel.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!property) {
			const createDto: CreateZigbee2mqttChannelPropertyDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name,
				category,
				data_type: dataType,
				permissions: [PermissionType.READ_ONLY],
				unit,
				format,
				value,
			};

			await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createDto);
		} else {
			await this.channelsPropertiesService.update<
				Zigbee2mqttChannelPropertyEntity,
				UpdateZigbee2mqttChannelPropertyDto
			>(
				property.id,
				toInstance(UpdateZigbee2mqttChannelPropertyDto, {
					type: DEVICES_ZIGBEE2MQTT_TYPE,
					value,
				}),
			);
		}
	}

	/**
	 * Create channels and properties from mapped structure
	 */
	private async createChannelsAndProperties(
		device: Zigbee2mqttDeviceEntity,
		mappedChannels: MappedChannel[],
		virtualContext: VirtualPropertyContext,
	): Promise<void> {
		// Group properties by channel to merge sensor channels
		const channelMap = new Map<string, MappedChannel>();

		for (const mappedChannel of mappedChannels) {
			const existing = channelMap.get(mappedChannel.identifier);
			if (existing) {
				// Merge properties into existing channel
				// Use z2mProperty for deduplication since multiple Z2M properties can map to the same
				// spec identifier (e.g., local_temperature and current_heating_setpoint both map to 'temperature')
				for (const prop of mappedChannel.properties) {
					if (!existing.properties.find((p) => p.z2mProperty === prop.z2mProperty)) {
						existing.properties.push(prop);
					}
				}
				// Preserve parentIdentifier if not already set
				if (mappedChannel.parentIdentifier && !existing.parentIdentifier) {
					existing.parentIdentifier = mappedChannel.parentIdentifier;
				}
			} else {
				channelMap.set(mappedChannel.identifier, { ...mappedChannel });
			}
		}

		// Sort channels so parent channels are created before children
		// Channels without parentIdentifier should be created first
		const sortedChannels = Array.from(channelMap.values()).sort((a, b) => {
			if (a.parentIdentifier && !b.parentIdentifier) return 1;
			if (!a.parentIdentifier && b.parentIdentifier) return -1;
			return 0;
		});

		// Map to store created channel identifiers -> channel IDs
		const channelIdMap = new Map<string, string>();

		// Create each channel
		for (const mappedChannel of sortedChannels) {
			// Resolve parent ID from identifier
			const parentId = mappedChannel.parentIdentifier ? channelIdMap.get(mappedChannel.parentIdentifier) : undefined;

			const channel = await this.createChannel(device, mappedChannel, virtualContext, parentId);
			if (channel) {
				channelIdMap.set(mappedChannel.identifier, channel.id);
			}
		}
	}

	/**
	 * Create a single channel with its properties
	 */
	private async createChannel(
		device: Zigbee2mqttDeviceEntity,
		mappedChannel: MappedChannel,
		virtualContext: VirtualPropertyContext,
		parentId?: string,
	): Promise<Zigbee2mqttChannelEntity | null> {
		// Find or create channel
		let channel = await this.channelsService.findOneBy<Zigbee2mqttChannelEntity>(
			'identifier',
			mappedChannel.identifier,
			device.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!channel) {
			const createChannelDto: CreateZigbee2mqttChannelDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: mappedChannel.identifier,
				name: mappedChannel.name,
				category: mappedChannel.category,
				device: device.id,
				parent: parentId ?? null,
			};

			channel = await this.channelsService.create<Zigbee2mqttChannelEntity, CreateZigbee2mqttChannelDto>(
				createChannelDto,
			);
		} else {
			// Update existing channel with parent if needed
			channel = await this.channelsService.update<Zigbee2mqttChannelEntity, UpdateZigbee2mqttChannelDto>(channel.id, {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				parent: parentId ?? null,
			});
		}

		// Create regular properties
		for (const mappedProperty of mappedChannel.properties) {
			await this.createProperty(channel, mappedProperty);
		}

		// Add virtual properties for missing required properties
		await this.createVirtualProperties(channel, mappedChannel, virtualContext);

		return channel;
	}

	/**
	 * Create virtual properties for a channel
	 */
	private async createVirtualProperties(
		channel: Zigbee2mqttChannelEntity,
		mappedChannel: MappedChannel,
		virtualContext: VirtualPropertyContext,
	): Promise<void> {
		// Get virtual property definitions for this channel category
		const virtualDefs = getVirtualPropertiesForChannel(mappedChannel.category);
		if (virtualDefs.length === 0) {
			return;
		}

		// Get existing property categories from mapped properties
		const mappedCategories = new Set(mappedChannel.properties.map((p) => p.category));

		// Also get existing properties from database to avoid UNIQUE constraint violations
		const existingDbProperties = await this.channelsPropertiesService.findAll<Zigbee2mqttChannelPropertyEntity>(
			channel.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);
		const existingDbIdentifiers = new Set(existingDbProperties.map((p) => p.identifier));

		for (const virtualDef of virtualDefs) {
			// Skip if this property category already exists in mapped properties
			if (mappedCategories.has(virtualDef.property_category)) {
				continue;
			}

			// Create virtual property
			const identifier = `fb_virtual_${virtualDef.property_category.toLowerCase()}`;

			// Skip if this property already exists in database (prevents UNIQUE constraint violation)
			if (existingDbIdentifiers.has(identifier)) {
				continue;
			}

			const value = this.virtualPropertyService.resolveVirtualPropertyValue(virtualDef, virtualContext);

			const format =
				virtualDef.format && virtualDef.format.length > 0
					? Array.isArray(virtualDef.format) &&
						virtualDef.format.length === 2 &&
						typeof virtualDef.format[0] === 'number'
						? (virtualDef.format as [number, number])
						: (virtualDef.format as string[])
					: null;

			const createDto: CreateZigbee2mqttChannelPropertyDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier,
				name: this.formatPropertyName(virtualDef.property_category),
				category: virtualDef.property_category,
				data_type: virtualDef.data_type,
				permissions: virtualDef.permissions,
				unit: virtualDef.unit ?? null,
				format,
				value,
			};

			await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createDto);
		}
	}

	/**
	 * Format property name from category
	 */
	private formatPropertyName(category: PropertyCategory | string): string {
		return category
			.toString()
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * Normalize Z2M cover state to spec format
	 * Z2M uses: OPEN, CLOSE, STOP (uppercase, imperative)
	 * Spec uses: opened, closed, stopped (lowercase, past tense)
	 */
	private normalizeCoverState(z2mState: unknown): string | null {
		if (typeof z2mState !== 'string') {
			return null;
		}

		const lower = z2mState.toLowerCase();

		switch (lower) {
			case 'open':
				return 'opened';
			case 'close':
				return 'closed';
			case 'stop':
				return 'stopped';
			default:
				// For other values, return as-is (lowercase)
				return lower;
		}
	}

	/**
	 * Create a single property
	 * Property identifier = z2mProperty for regular properties, but for composite properties
	 * like color (where multiple properties share the same z2mProperty), we use the spec identifier
	 */
	private async createProperty(channel: Zigbee2mqttChannelEntity, mappedProperty: MappedProperty): Promise<void> {
		// For properties that share the same z2mProperty (like hue and saturation both mapping to "color"),
		// we need to use the spec identifier to avoid conflicts
		// Check if this is a color-related property that shares z2mProperty="color"
		const isSharedZ2mProperty =
			mappedProperty.z2mProperty === 'color' &&
			(mappedProperty.category === PropertyCategory.HUE || mappedProperty.category === PropertyCategory.SATURATION);

		// Static properties use their spec identifier since they don't come from Z2M state
		const isStaticProperty = mappedProperty.z2mProperty.startsWith('__static_');

		// Derived properties use their spec identifier since they are computed from other properties
		const isDerivedProperty = mappedProperty.z2mProperty.startsWith('__derived_');

		// Use spec identifier for shared, static, and derived properties; z2mProperty for regular properties
		const propertyIdentifier =
			isSharedZ2mProperty || isStaticProperty || isDerivedProperty
				? mappedProperty.identifier
				: mappedProperty.z2mProperty;

		let property = await this.channelsPropertiesService.findOneBy<Zigbee2mqttChannelPropertyEntity>(
			'identifier',
			propertyIdentifier,
			channel.id,
			DEVICES_ZIGBEE2MQTT_TYPE,
		);

		if (!property) {
			const format =
				mappedProperty.format && mappedProperty.format.length > 0
					? Array.isArray(mappedProperty.format) &&
						mappedProperty.format.length === 2 &&
						typeof mappedProperty.format[0] === 'number'
						? (mappedProperty.format as [number, number])
						: (mappedProperty.format as string[])
					: null;

			const createDto: CreateZigbee2mqttChannelPropertyDto = {
				type: DEVICES_ZIGBEE2MQTT_TYPE,
				identifier: propertyIdentifier,
				name: mappedProperty.name,
				category: mappedProperty.category,
				data_type: mappedProperty.dataType,
				permissions: mappedProperty.permissions,
				unit: mappedProperty.unit ?? null,
				format,
				step: mappedProperty.step ?? null,
				// Static properties have a fixed value that doesn't change
				value: mappedProperty.staticValue ?? null,
			};

			property = await this.channelsPropertiesService.create<
				Zigbee2mqttChannelPropertyEntity,
				CreateZigbee2mqttChannelPropertyDto
			>(channel.id, createDto);
		}

		// Register transformer for state updates and writes (for both new and existing properties)
		// This ensures transformers are restored after backend restart
		if (mappedProperty.transformerName) {
			this.registerPropertyTransformer(property.id, mappedProperty.transformerName, mappedProperty.z2mProperty);
		}
	}

	/**
	 * Convert value to appropriate type based on property data type
	 * Z2M may send floats for integer properties, so we need to round them
	 */
	private convertValue(value: unknown, dataType?: DataTypeType): string | number | boolean | null {
		if (value === null || value === undefined) {
			return null;
		}

		if (typeof value === 'boolean') {
			return value;
		}

		if (typeof value === 'number') {
			// Transform numeric values based on expected data type
			switch (dataType) {
				case DataTypeType.CHAR:
				case DataTypeType.UCHAR:
				case DataTypeType.SHORT:
				case DataTypeType.USHORT:
				case DataTypeType.INT:
				case DataTypeType.UINT:
					// Integer types - round the value
					return Math.round(value);
				case DataTypeType.FLOAT:
				default:
					// Float or unknown - keep as-is
					return value;
			}
		}

		if (typeof value === 'string') {
			return value;
		}

		if (typeof value === 'object' && value !== null) {
			return JSON.stringify(value);
		}

		return JSON.stringify(value);
	}
}
