import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { ChannelSpecModel } from '../../../modules/devices/models/devices.model';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { channelsSchema } from '../../../spec/channels';
import { toInstance } from '../../../common/utils/transform.utils';
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
import { Z2mDevice, Z2mExpose, Z2mRegisteredDevice } from '../interfaces/zigbee2mqtt.interface';
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
	) {}

	/**
	 * Generate a mapping preview for a Z2M device
	 */
	async generatePreview(
		ieeeAddress: string,
		request?: MappingPreviewRequestDto,
	): Promise<Z2mMappingPreviewModel> {
		this.logger.debug(`[MAPPING PREVIEW] Generating preview for device: ${ieeeAddress}`);

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

		// Check if device is already adopted
		const existingDevices = await this.devicesService.findAll<Zigbee2mqttDeviceEntity>(DEVICES_ZIGBEE2MQTT_TYPE);
		const existingDevice = existingDevices.find((d) => d.ieeeAddress === ieeeAddress);

		// Map exposes to channels
		const mappedChannels = this.exposesMapper.mapExposes(z2mDevice.definition.exposes);

		// Apply overrides if provided
		const overriddenChannels = this.applyOverrides(mappedChannels, request);

		// Build expose previews
		const exposePreviews = this.buildExposePreviews(
			z2mDevice.definition.exposes,
			overriddenChannels,
			z2mDevice.currentState,
			request,
		);

		// Determine device category
		const exposeTypes = z2mDevice.definition.exposes.map((e) => e.type);
		const propertyNames = z2mDevice.definition.exposes
			.filter((e) => e.property)
			.map((e) => e.property as string);

		const suggestedCategory = request?.deviceCategory ??
			mapZ2mCategoryToDeviceCategory(exposeTypes, propertyNames);

		// Build suggested device
		const suggestedDevice: Z2mSuggestedDeviceModel = {
			category: suggestedCategory,
			name: z2mDevice.friendlyName.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
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

		this.logger.debug(
			`[MAPPING PREVIEW] Generated preview: ${exposePreviews.length} exposes, ` +
			`${warnings.length} warnings, ready=${readyToAdopt}`,
		);

		return preview;
	}

	/**
	 * Apply user overrides to mapped channels
	 */
	private applyOverrides(
		channels: MappedChannel[],
		request?: MappingPreviewRequestDto,
	): MappedChannel[] {
		if (!request?.exposeOverrides?.length) {
			return channels;
		}

		const overrideMap = new Map(
			request.exposeOverrides.map((o) => [o.exposeName, o]),
		);

		return channels.map((channel) => {
			// Check if any property in this channel has an override
			const updatedProperties = channel.properties.map((prop) => {
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
			}).filter((p): p is MappedProperty => p !== null);

			return {
				...channel,
				properties: updatedProperties,
			};
		}).filter((ch) => ch.properties.length > 0);
	}

	/**
	 * Build expose mapping previews
	 */
	private buildExposePreviews(
		exposes: Z2mExpose[],
		mappedChannels: MappedChannel[],
		currentState: Record<string, unknown>,
		request?: MappingPreviewRequestDto,
	): Z2mExposeMappingPreviewModel[] {
		const previews: Z2mExposeMappingPreviewModel[] = [];

		// Build a map of z2m property to mapped property
		const propertyMap = new Map<string, { channel: MappedChannel; property: MappedProperty }>();
		for (const channel of mappedChannels) {
			for (const prop of channel.properties) {
				propertyMap.set(prop.z2mProperty, { channel, property: prop });
			}
		}

		// Build a set of skipped exposes
		const skippedExposes = new Set(
			request?.exposeOverrides?.filter((o) => o.skip).map((o) => o.exposeName) ?? [],
		);

		// Process each expose
		for (const expose of exposes) {
			const exposeName = expose.property ?? expose.name ?? expose.type;

			// Skip specific types (they have features that are mapped separately)
			if (['light', 'switch', 'fan', 'cover', 'lock', 'climate'].includes(expose.type)) {
				// Process features of specific expose types
				const specificExpose = expose as { features?: Z2mExpose[] };
				if (specificExpose.features) {
					for (const feature of specificExpose.features) {
						const featureName = feature.property ?? feature.name ?? feature.type;
						const mapping = propertyMap.get(featureName);
						const isSkipped = skippedExposes.has(featureName);

						previews.push(this.buildExposePreview(
							feature,
							featureName,
							mapping,
							currentState,
							isSkipped,
						));
					}
				}
				continue;
			}

			const mapping = propertyMap.get(exposeName);
			const isSkipped = skippedExposes.has(exposeName);

			previews.push(this.buildExposePreview(
				expose,
				exposeName,
				mapping,
				currentState,
				isSkipped,
			));
		}

		return previews;
	}

	/**
	 * Build a single expose preview
	 */
	private buildExposePreview(
		expose: Z2mExpose,
		exposeName: string,
		mapping: { channel: MappedChannel; property: MappedProperty } | undefined,
		currentState: Record<string, unknown>,
		isSkipped: boolean,
	): Z2mExposeMappingPreviewModel {
		// Determine status
		let status: 'mapped' | 'partial' | 'unmapped' | 'skipped';
		if (isSkipped) {
			status = 'skipped';
		} else if (mapping) {
			status = 'mapped';
		} else {
			status = 'unmapped';
		}

		// Build suggested channel
		let suggestedChannel: Z2mSuggestedChannelModel | null = null;
		if (mapping && !isSkipped) {
			suggestedChannel = {
				category: mapping.channel.category,
				name: mapping.channel.name,
				confidence: 'high',
			};
		}

		// Build suggested properties
		const suggestedProperties: Z2mPropertyMappingPreviewModel[] = [];
		if (mapping && !isSkipped) {
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
				currentValue: this.getCurrentValue(exposeName, currentState),
			});
		}

		// Check for missing required properties
		const missingRequiredProperties: PropertyCategory[] = [];
		if (mapping && !isSkipped) {
			const channelSpec = this.getChannelSpec(mapping.channel.category);
			if (channelSpec) {
				const requiredProps = channelSpec.properties.filter((p) => p.required);
				const mappedCategories = new Set(suggestedProperties.map((p) => p.category));

				for (const reqProp of requiredProps) {
					if (!mappedCategories.has(reqProp.category)) {
						missingRequiredProperties.push(reqProp.category);
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
	 * Get current value from device state
	 */
	private getCurrentValue(
		propertyName: string,
		state: Record<string, unknown>,
	): string | number | boolean | null {
		const value = state[propertyName];
		if (value === undefined || value === null) {
			return null;
		}
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return value;
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
				properties: 'properties' in rawSchema && rawSchema.properties
					? Object.values(rawSchema.properties)
					: [],
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

		// Check if device is already adopted
		if (existingDevice) {
			warnings.push({
				type: 'device_not_available',
				message: `Device is already adopted as "${existingDevice.name}" (${existingDevice.id})`,
				suggestion: 'Delete the existing device first if you want to re-adopt it',
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
	 * Determine if the device is ready to adopt
	 */
	private isReadyToAdopt(
		exposePreviews: Z2mExposeMappingPreviewModel[],
		warnings: Z2mMappingWarningModel[],
		existingDevice?: Zigbee2mqttDeviceEntity,
	): boolean {
		// Not ready if already adopted
		if (existingDevice) {
			return false;
		}

		// Check if at least one expose is mapped
		const hasMappedExpose = exposePreviews.some((e) => e.status === 'mapped');
		if (!hasMappedExpose) {
			return false;
		}

		// Check for blocking warnings
		const blockingWarnings = warnings.filter((w) =>
			w.type === 'missing_required_channel' || w.type === 'missing_required_property',
		);

		return blockingWarnings.length === 0;
	}

	/**
	 * Calculate device category confidence
	 */
	private calculateDeviceConfidence(
		category: DeviceCategory,
		exposeTypes: string[],
	): 'high' | 'medium' | 'low' {
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
}
