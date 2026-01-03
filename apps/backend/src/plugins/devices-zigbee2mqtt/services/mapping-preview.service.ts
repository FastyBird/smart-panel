import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { toInstance } from '../../../common/utils/transform.utils';
import { DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelSpecModel } from '../../../modules/devices/models/devices.model';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { channelsSchema } from '../../../spec/channels';
import {
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	DEVICES_ZIGBEE2MQTT_TYPE,
	mapZ2mCategoryToDeviceCategory,
} from '../devices-zigbee2mqtt.constants';
import {
	DevicesZigbee2mqttNotFoundException,
	DevicesZigbee2mqttValidationException,
} from '../devices-zigbee2mqtt.exceptions';
import { MappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import { Zigbee2mqttDeviceEntity } from '../entities/devices-zigbee2mqtt.entity';
import { Z2mExpose, Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';
import {
	Z2mDeviceInfoModel,
	Z2mExposeMappingPreviewModel,
	Z2mMappingPreviewModel,
	Z2mMappingWarningModel,
	Z2mPropertyMappingPreviewModel,
	Z2mSuggestedChannelModel,
	Z2mSuggestedDeviceModel,
} from '../models/zigbee2mqtt-response.model';

import { MappedChannel, MappedProperty, Z2mExposesMapperService } from './exposes-mapper.service';
import { Z2mVirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext } from './virtual-property.types';
import { Zigbee2mqttService } from './zigbee2mqtt.service';

/**
 * Mapping Preview Service
 *
 * Generates preview of how a Z2M device would be mapped to Smart Panel entities.
 */
@Injectable()
export class Z2mMappingPreviewService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'MappingPreviewService',
	);

	constructor(
		private readonly zigbee2mqttService: Zigbee2mqttService,
		private readonly exposesMapper: Z2mExposesMapperService,
		private readonly devicesService: DevicesService,
		private readonly virtualPropertyService: Z2mVirtualPropertyService,
	) {}

	/**
	 * Generate a mapping preview for a Z2M device
	 */
	async generatePreview(ieeeAddress: string, request?: MappingPreviewRequestDto): Promise<Z2mMappingPreviewModel> {
		// Get device from Z2M registry
		const registeredDevices = this.zigbee2mqttService.getRegisteredDevices();
		const z2mDevice = registeredDevices.find((d) => d.ieeeAddress === ieeeAddress);

		if (!z2mDevice) {
			throw new DevicesZigbee2mqttNotFoundException(
				`Device with IEEE address ${ieeeAddress} not found in Zigbee2MQTT registry`,
			);
		}

		if (!z2mDevice.definition) {
			throw new DevicesZigbee2mqttValidationException(
				`Device with IEEE address ${ieeeAddress} has no definition (unsupported device)`,
			);
		}

		// Get current state from multiple sources:
		// 1. z2mDevice.currentState (from registry)
		// 2. stateCache (global cache that stores ALL state messages)
		// This ensures we have state even if messages arrived before device was registered
		const cachedState = this.zigbee2mqttService.getCachedState(z2mDevice.friendlyName);
		const currentState = { ...cachedState, ...z2mDevice.currentState };

		// If still no state, request it from Z2M and wait briefly
		if (Object.keys(currentState).length === 0) {
			const stateRequested = await this.zigbee2mqttService.requestDeviceState(z2mDevice.friendlyName);

			if (stateRequested) {
				// Wait for state response (Z2M typically responds within 100-500ms)
				await this.delay(500);

				// Get updated state from cache (stateCache is always updated by handleDeviceStateMessage)
				const updatedCachedState = this.zigbee2mqttService.getCachedState(z2mDevice.friendlyName);
				Object.assign(currentState, updatedCachedState);
			}
		}

		// Check if device is already adopted
		const existingDevices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
		const existingDevice = existingDevices.find((d) => d.identifier === ieeeAddress);

		// Map exposes to channels
		const mappedChannels = this.exposesMapper.mapExposes(z2mDevice.definition.exposes);

		// Apply overrides if provided
		const overriddenChannels = this.applyOverrides(mappedChannels, request);

		// Build expose previews
		const exposePreviews = this.buildExposePreviews(
			z2mDevice.definition.exposes,
			overriddenChannels,
			currentState,
			z2mDevice,
			request,
		);

		// Determine device category
		const exposeTypes = z2mDevice.definition.exposes.map((e) => e.type);
		const propertyNames = z2mDevice.definition.exposes
			.filter((e): e is typeof e & { property: string } => !!e.property)
			.map((e) => e.property);

		const suggestedCategory = request?.deviceCategory ?? mapZ2mCategoryToDeviceCategory(exposeTypes, propertyNames);

		// Build suggested device
		// Use user-defined description if available, otherwise format friendlyName
		const suggestedName =
			z2mDevice.description || z2mDevice.friendlyName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

		const suggestedDevice: Z2mSuggestedDeviceModel = {
			category: suggestedCategory,
			name: suggestedName,
			confidence: this.calculateDeviceConfidence(suggestedCategory, exposeTypes),
		};

		// Build Z2M device info
		const z2mDeviceInfo: Z2mDeviceInfoModel = {
			ieeeAddress: z2mDevice.ieeeAddress,
			friendlyName: z2mDevice.friendlyName,
			manufacturer: z2mDevice.definition.vendor ?? null,
			model: z2mDevice.definition.model ?? null,
			description: z2mDevice.definition.description ?? null,
		};

		// Build warnings
		const warnings = this.buildWarnings(exposePreviews, z2mDevice, existingDevice);

		// Determine if ready to adopt
		const readyToAdopt = this.isReadyToAdopt(exposePreviews, warnings, existingDevice);

		const preview: Z2mMappingPreviewModel = {
			z2mDevice: z2mDeviceInfo,
			suggestedDevice,
			exposes: exposePreviews,
			warnings,
			readyToAdopt,
		};

		return preview;
	}

	/**
	 * Apply user overrides to mapped channels
	 */
	private applyOverrides(channels: MappedChannel[], request?: MappingPreviewRequestDto): MappedChannel[] {
		if (!request?.exposeOverrides?.length) {
			return channels;
		}

		const overrideMap = new Map(request.exposeOverrides.map((o) => [o.exposeName, o]));

		return channels
			.map((channel) => {
				// Check if any property in this channel has an override
				const updatedProperties = channel.properties
					.map((prop) => {
						const override = overrideMap.get(prop.z2mProperty);
						if (override) {
							if (override.skip) {
								return null; // Mark for removal
							}
							if (override.channelCategory) {
								return {
									...prop,
									channelCategory: override.channelCategory,
								};
							}
						}
						return prop;
					})
					.filter((p): p is MappedProperty => p !== null);

				return {
					...channel,
					properties: updatedProperties,
				};
			})
			.filter((ch) => ch.properties.length > 0);
	}

	/**
	 * Build expose mapping previews
	 */
	private buildExposePreviews(
		exposes: Z2mExpose[],
		mappedChannels: MappedChannel[],
		currentState: Record<string, unknown>,
		z2mDevice: Z2mRegisteredDevice,
		request?: MappingPreviewRequestDto,
	): Z2mExposeMappingPreviewModel[] {
		const previews: Z2mExposeMappingPreviewModel[] = [];

		// Build a map of z2m property to mapped properties (multiple properties can share same z2mProperty)
		// For example, color composite maps to both hue and saturation, both with z2mProperty="color"
		const propertyMap = new Map<string, Array<{ channel: MappedChannel; property: MappedProperty }>>();
		for (const channel of mappedChannels) {
			for (const prop of channel.properties) {
				const existing = propertyMap.get(prop.z2mProperty) ?? [];
				existing.push({ channel, property: prop });
				propertyMap.set(prop.z2mProperty, existing);
			}
		}

		// Build a map of channel category to all property categories from all exposes
		// This is used to check if a channel has all required properties across ALL exposes
		const channelPropertyCategories = new Map<string, Set<PropertyCategory>>();
		for (const channel of mappedChannels) {
			const categorySet = channelPropertyCategories.get(channel.category) ?? new Set();
			for (const prop of channel.properties) {
				categorySet.add(prop.category);
			}
			channelPropertyCategories.set(channel.category, categorySet);
		}

		// Build a set of skipped exposes
		const skippedExposes = new Set(request?.exposeOverrides?.filter((o) => o.skip).map((o) => o.exposeName) ?? []);

		// Exposes that are automatically managed and should not appear in the preview
		// These are added automatically to device_information channel during adoption
		const hiddenExposes = new Set(['linkquality', 'link_quality']);

		// Process each expose
		for (const expose of exposes) {
			const exposeName = expose.property ?? expose.name ?? expose.type;

			// Skip hidden exposes (auto-managed by the system)
			if (hiddenExposes.has(exposeName)) {
				continue;
			}

			// Skip specific types (they have features that are mapped separately)
			if (['light', 'switch', 'fan', 'cover', 'lock', 'climate'].includes(expose.type)) {
				// Process features of specific expose types
				const specificExpose = expose as { features?: Z2mExpose[] };
				if (specificExpose.features) {
					// Track processed z2m properties to avoid duplicates
					// (e.g., both color_xy and color_hs have property="color")
					const processedProperties = new Set<string>();

					for (const feature of specificExpose.features) {
						const featureName = feature.property ?? feature.name ?? feature.type;
						const featureTypeName = feature.name ?? feature.type;

						// Skip color_xy composite - we prefer color_hs for HSV support
						if (featureTypeName === 'color_xy') {
							continue;
						}

						// Skip if we already processed this z2m property
						// This prevents duplicate entries when both color_xy and color_hs exist
						if (processedProperties.has(featureName)) {
							continue;
						}
						processedProperties.add(featureName);

						const mappings = propertyMap.get(featureName);
						const isSkipped = skippedExposes.has(featureName);

						previews.push(
							this.buildExposePreview(
								feature,
								featureName,
								mappings,
								currentState,
								isSkipped,
								z2mDevice,
								channelPropertyCategories,
							),
						);
					}
				}
				continue;
			}

			const mappings = propertyMap.get(exposeName);
			const isSkipped = skippedExposes.has(exposeName);

			previews.push(
				this.buildExposePreview(
					expose,
					exposeName,
					mappings,
					currentState,
					isSkipped,
					z2mDevice,
					channelPropertyCategories,
				),
			);
		}

		return previews;
	}

	/**
	 * Build a single expose preview
	 * mappings is an array because multiple properties can map to the same z2mProperty
	 * (e.g., hue and saturation both map to "color")
	 */
	private buildExposePreview(
		expose: Z2mExpose,
		exposeName: string,
		mappings: Array<{ channel: MappedChannel; property: MappedProperty }> | undefined,
		currentState: Record<string, unknown>,
		isSkipped: boolean,
		z2mDevice: Z2mRegisteredDevice,
		channelPropertyCategories: Map<string, Set<PropertyCategory>>,
	): Z2mExposeMappingPreviewModel {
		// Get first mapping for channel info (all mappings should be for the same channel)
		const firstMapping = mappings?.[0];

		// Determine status
		let status: 'mapped' | 'partial' | 'unmapped' | 'skipped';
		if (isSkipped) {
			status = 'skipped';
		} else if (firstMapping) {
			status = 'mapped';
		} else {
			status = 'unmapped';
		}

		// Build suggested channel
		let suggestedChannel: Z2mSuggestedChannelModel | null = null;
		if (firstMapping && !isSkipped) {
			suggestedChannel = {
				category: firstMapping.channel.category,
				name: firstMapping.channel.name,
				confidence: 'high',
			};
		}

		// Build suggested properties - include ALL mapped properties
		const suggestedProperties: Z2mPropertyMappingPreviewModel[] = [];
		if (mappings && !isSkipped) {
			for (const mapping of mappings) {
				const prop = mapping.property;

				// Get channel spec to check if property is required
				const channelSpec = this.getChannelSpec(mapping.channel.category);
				const propSpec = channelSpec?.properties?.find((p) => p.category === prop.category);

				suggestedProperties.push({
					category: prop.category,
					name: prop.name,
					z2mProperty: prop.z2mProperty,
					dataType: prop.dataType,
					permissions: prop.permissions,
					unit: prop.unit ?? null,
					format: prop.format ?? null,
					required: propSpec?.required ?? false,
					currentValue: this.getCurrentValue(exposeName, currentState, prop.category),
				});
			}
		}

		// Check for missing required properties and add virtual properties if available
		// Use the aggregated channel properties to check across ALL exposes for this channel
		const missingRequiredProperties: PropertyCategory[] = [];
		if (firstMapping && !isSkipped) {
			const channelSpec = this.getChannelSpec(firstMapping.channel.category);
			if (channelSpec) {
				const requiredProps = channelSpec.properties.filter((p) => p.required);

				// Get ALL property categories mapped to this channel from ALL exposes
				const allChannelCategories = channelPropertyCategories.get(firstMapping.channel.category) ?? new Set();
				const mappedCategories = new Set([...allChannelCategories, ...suggestedProperties.map((p) => p.category)]);

				// Build virtual property context
				const virtualContext: VirtualPropertyContext = {
					state: currentState,
					friendlyName: z2mDevice.friendlyName,
					ieeeAddress: z2mDevice.ieeeAddress,
				};

				for (const reqProp of requiredProps) {
					if (!mappedCategories.has(reqProp.category)) {
						// Check if we can provide this as a virtual property
						const virtualProps = this.virtualPropertyService.getMissingVirtualProperties(
							firstMapping.channel.category,
							Array.from(mappedCategories),
							[reqProp.category],
							virtualContext,
						);

						if (virtualProps.length > 0) {
							// Add virtual property to suggested properties
							for (const vp of virtualProps) {
								suggestedProperties.push({
									category: vp.category,
									name: this.getPropertyName(vp.category),
									z2mProperty: `fb.virtual.${vp.category}`, // Virtual marker
									dataType: vp.dataType,
									permissions: vp.permissions,
									unit: vp.unit ?? null,
									format: vp.format ?? null,
									required: true,
									currentValue: vp.value,
								});
								mappedCategories.add(vp.category);
							}
						} else {
							// Cannot provide virtual property, mark as missing
							missingRequiredProperties.push(reqProp.category);
						}
					}
				}
			}
		}

		return {
			exposeName,
			exposeType: expose.type,
			status,
			suggestedChannel,
			suggestedProperties,
			missingRequiredProperties,
		};
	}

	/**
	 * Get human-readable property name from category
	 */
	private getPropertyName(category: PropertyCategory): string {
		return category
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	}

	/**
	 * Get current value from device state
	 * For composite properties like color, extract the specific value based on property category
	 */
	private getCurrentValue(
		propertyName: string,
		state: Record<string, unknown>,
		propertyCategory?: PropertyCategory,
	): string | number | boolean | null {
		const value = state[propertyName];
		if (value === undefined || value === null) {
			return null;
		}

		// Handle color temperature conversion (mired -> Kelvin)
		// Note: Clamping happens in exposes-mapper based on device's actual range
		if (propertyCategory === PropertyCategory.COLOR_TEMPERATURE && typeof value === 'number' && value > 0) {
			return Math.round(1000000 / value);
		}

		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return value;
		}

		// Handle composite values like color object
		if (typeof value === 'object' && propertyCategory) {
			const objValue = value as Record<string, unknown>;

			// Extract hue from color object
			if (propertyCategory === PropertyCategory.HUE) {
				if ('hue' in objValue && typeof objValue.hue === 'number') {
					return Math.round(objValue.hue);
				}
				if ('h' in objValue && typeof objValue.h === 'number') {
					return Math.round(objValue.h);
				}
				return null;
			}

			// Extract saturation from color object
			if (propertyCategory === PropertyCategory.SATURATION) {
				if ('saturation' in objValue && typeof objValue.saturation === 'number') {
					return Math.round(objValue.saturation);
				}
				if ('s' in objValue && typeof objValue.s === 'number') {
					return Math.round(objValue.s);
				}
				return null;
			}
		}

		return JSON.stringify(value);
	}

	/**
	 * Get channel specification
	 */
	private getChannelSpec(category: string): ChannelSpecModel | null {
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
	 * Build warnings for the mapping
	 */
	private buildWarnings(
		exposePreviews: Z2mExposeMappingPreviewModel[],
		z2mDevice: Z2mRegisteredDevice,
		existingDevice?: Zigbee2mqttDeviceEntity,
	): Z2mMappingWarningModel[] {
		const warnings: Z2mMappingWarningModel[] = [];

		// Check if device is already adopted - this is informational, not blocking
		if (existingDevice) {
			warnings.push({
				type: 'device_already_adopted',
				message: `Device is already adopted as "${existingDevice.name}"`,
				suggestion: 'Continuing will re-adopt the device with the new configuration',
			});
		}

		// Check if device is available
		if (!z2mDevice.available) {
			warnings.push({
				type: 'device_not_available',
				message: 'Device is currently offline',
				suggestion: 'The device will be adopted but may not respond to commands until it comes online',
			});
		}

		// Check for unmapped exposes
		const unmappedExposes = exposePreviews.filter((e) => e.status === 'unmapped');
		for (const expose of unmappedExposes) {
			// Skip diagnostic/config properties
			if (this.isConfigOrDiagnosticProperty(expose.exposeName)) {
				continue;
			}

			warnings.push({
				type: 'unsupported_expose',
				exposeName: expose.exposeName,
				message: `Expose "${expose.exposeName}" (${expose.exposeType}) could not be automatically mapped`,
				suggestion: 'This expose will not be available in Smart Panel',
			});
		}

		// Check for missing required properties in mapped channels
		for (const expose of exposePreviews) {
			if (expose.missingRequiredProperties.length > 0) {
				warnings.push({
					type: 'missing_required_property',
					exposeName: expose.exposeName,
					message: `Channel is missing required properties: ${expose.missingRequiredProperties.join(', ')}`,
					suggestion: 'The channel may not function correctly',
				});
			}
		}

		return warnings;
	}

	/**
	 * Check if property is config or diagnostic (should not warn about)
	 */
	private isConfigOrDiagnosticProperty(name: string): boolean {
		const skipPatterns = [
			'calibration',
			'precision',
			'sensitivity',
			'range',
			'delay',
			'timeout',
			'duration',
			'identify',
			'effect',
			'self_test',
			'test',
			'unit',
		];

		const lowerName = name.toLowerCase();
		return skipPatterns.some((pattern) => lowerName.includes(pattern));
	}

	/**
	 * Determine if the device is ready to adopt (or re-adopt)
	 */
	private isReadyToAdopt(
		exposePreviews: Z2mExposeMappingPreviewModel[],
		warnings: Z2mMappingWarningModel[],
		_existingDevice?: Zigbee2mqttDeviceEntity,
	): boolean {
		// Check if at least one expose is mapped
		const hasMappedExpose = exposePreviews.some((e) => e.status === 'mapped');
		if (!hasMappedExpose) {
			return false;
		}

		// Check for blocking warnings (device_already_adopted is not blocking)
		const blockingWarnings = warnings.filter(
			(w) => w.type === 'missing_required_channel' || w.type === 'missing_required_property',
		);

		return blockingWarnings.length === 0;
	}

	/**
	 * Calculate device category confidence
	 */
	private calculateDeviceConfidence(category: DeviceCategory, exposeTypes: string[]): 'high' | 'medium' | 'low' {
		// High confidence for specific device types
		const specificTypes = ['light', 'switch', 'climate', 'cover', 'lock', 'fan'];
		if (specificTypes.some((t) => exposeTypes.includes(t))) {
			return 'high';
		}

		// Medium confidence for sensors with known properties
		if (category === DeviceCategory.SENSOR) {
			return 'medium';
		}

		// Low confidence for generic devices
		if (category === DeviceCategory.GENERIC) {
			return 'low';
		}

		return 'medium';
	}

	/**
	 * Helper to delay execution
	 */
	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
