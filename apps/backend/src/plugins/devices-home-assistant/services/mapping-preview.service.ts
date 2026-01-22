import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	DeviceValidationService,
	ValidationIssueType,
} from '../../../modules/devices/services/device-validation.service';
import {
	PropertyMetadata,
	getPropertyMetadata,
	getRequiredProperties,
} from '../../../modules/devices/utils/schema.utils';
import { devicesSchema } from '../../../spec/devices';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { DevicesHomeAssistantNotFoundException } from '../devices-home-assistant.exceptions';
import { MappingPreviewRequestDto } from '../dto/mapping-preview.dto';
import { EntityRole, MappingLoaderService, ResolvedHaMapping, ResolvedPropertyBinding } from '../mappings';
import { TransformerRegistry } from '../mappings/transformers/transformer.registry';
import { HomeAssistantDeviceRegistryResultModel, HomeAssistantStateModel } from '../models/home-assistant.model';
import {
	EntityMappingPreviewModel,
	HaDeviceInfoModel,
	MappingPreviewModel,
	MappingWarningModel,
	PropertyMappingPreviewModel,
	SuggestedDeviceModel,
	ValidationSummaryModel,
} from '../models/mapping-preview.model';

import { HomeAssistantHttpService } from './home-assistant.http.service';
import { HomeAssistantWsService } from './home-assistant.ws.service';
import { LightCapabilityAnalyzer } from './light-capability.analyzer';
import { VirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext } from './virtual-property.types';

/**
 * Service for generating mapping previews for Home Assistant devices
 *
 * This service analyzes a Home Assistant device and its entities,
 * then suggests how they could be mapped to Smart Panel device/channel/property structure.
 */
@Injectable()
export class MappingPreviewService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'MappingPreviewService',
	);

	constructor(
		private readonly homeAssistantHttpService: HomeAssistantHttpService,
		private readonly homeAssistantWsService: HomeAssistantWsService,
		private readonly lightCapabilityAnalyzer: LightCapabilityAnalyzer,
		private readonly virtualPropertyService: VirtualPropertyService,
		private readonly deviceValidationService: DeviceValidationService,
		private readonly mappingLoaderService: MappingLoaderService,
		private readonly transformerRegistry: TransformerRegistry,
	) {}

	/**
	 * Generate a mapping preview for a Home Assistant device
	 */
	async generatePreview(haDeviceId: string, options?: MappingPreviewRequestDto): Promise<MappingPreviewModel> {
		// Fetch device information and states
		const [devicesRegistry, entitiesRegistry, discoveredDevice] = await Promise.all([
			this.homeAssistantWsService.getDevicesRegistry(),
			this.homeAssistantWsService.getEntitiesRegistry(),
			this.homeAssistantHttpService.getDiscoveredDevice(haDeviceId),
		]);

		// Find device in registry
		const deviceRegistry = devicesRegistry.find((d) => d.id === haDeviceId);
		if (!deviceRegistry) {
			throw new DevicesHomeAssistantNotFoundException(`Home Assistant device with ID ${haDeviceId} not found`);
		}

		// Find entities for this device
		const deviceEntities = entitiesRegistry.filter((e) => e.deviceId === haDeviceId);
		const entityOverrides = new Map(options?.entityOverrides?.map((o) => [o.entityId, o]) ?? []);

		const warnings: MappingWarningModel[] = [];
		const entityPreviews: EntityMappingPreviewModel[] = [];
		const mappedChannelCategories: ChannelCategory[] = [];

		// Process each entity
		const rawEntityPreviews: EntityMappingPreviewModel[] = [];
		for (const entityRegistry of deviceEntities) {
			const entityState = discoveredDevice.states.find((s) => s.entityId === entityRegistry.entityId);
			const override = entityOverrides.get(entityRegistry.entityId);

			// Skip if explicitly skipped
			if (override?.skip) {
				rawEntityPreviews.push(this.createSkippedEntityPreview(entityRegistry.entityId, entityState));
				continue;
			}

			const entityPreview = this.processEntity(entityRegistry.entityId, entityState, override?.channelCategory);
			rawEntityPreviews.push(entityPreview);

			// Add warnings for unmapped entities
			if (entityPreview.status === 'unmapped') {
				warnings.push({
					type: 'unsupported_entity',
					entityId: entityRegistry.entityId,
					message: `Entity "${entityRegistry.entityId}" could not be automatically mapped`,
					suggestion: 'You can manually select a channel category for this entity',
				});
			}
		}

		// Consolidate entities that map to the same channel category
		// This prevents multiple channels of the same category (e.g., multiple ELECTRICAL_POWER channels)
		const consolidatedPreviews = this.consolidateEntitiesByChannelCategory(rawEntityPreviews, discoveredDevice.states);

		// Separate skipped/unmapped entities from mapped ones for tracking
		for (const preview of consolidatedPreviews) {
			if (preview.status === 'skipped' || preview.status === 'unmapped') {
				entityPreviews.push(preview);
			} else if (preview.suggestedChannel) {
				entityPreviews.push(preview);
				mappedChannelCategories.push(preview.suggestedChannel.category);
			} else {
				entityPreviews.push(preview);
			}
		}

		// Collect entity domains for category inference
		const entityDomains = consolidatedPreviews
			.filter((e) => e.status !== 'skipped' && e.status !== 'unmapped')
			.map((e) => e.domain as HomeAssistantDomain);

		// Determine suggested device category
		const suggestedDeviceCategory =
			options?.deviceCategory ?? this.inferDeviceCategory(mappedChannelCategories, entityDomains);

		// Check for missing required channels and mark incompatible entities
		const deviceSpec = devicesSchema[suggestedDeviceCategory as keyof typeof devicesSchema];
		if (deviceSpec && 'channels' in deviceSpec) {
			const deviceChannels = deviceSpec.channels as Record<string, { category: string; required?: boolean }>;
			const allowedChannelCategories = new Set(Object.keys(deviceChannels) as ChannelCategory[]);

			// Always allow device_information as it's auto-created
			allowedChannelCategories.add(ChannelCategory.DEVICE_INFORMATION);

			const requiredChannels = Object.entries(deviceChannels)
				.filter(([, spec]) => spec.required)
				.map(([key]) => key as ChannelCategory);

			for (const requiredChannel of requiredChannels) {
				// Skip device_information as it's auto-created
				if (requiredChannel === ChannelCategory.DEVICE_INFORMATION) {
					continue;
				}

				if (!mappedChannelCategories.includes(requiredChannel)) {
					warnings.push({
						type: 'missing_required_channel',
						message: `Required channel "${requiredChannel}" is not mapped`,
						suggestion: 'You may need to select an entity to map to this channel',
					});
				}
			}

			// Mark entities as incompatible if their channel is not allowed for this device category
			for (const preview of entityPreviews) {
				// Skip already skipped/unmapped entities
				if (preview.status === 'skipped' || preview.status === 'unmapped' || !preview.suggestedChannel) {
					continue;
				}

				const channelCategory = preview.suggestedChannel.category;

				// Check if this channel category is allowed for the device
				if (!allowedChannelCategories.has(channelCategory)) {
					preview.status = 'incompatible';
					preview.incompatibleReason = `Channel "${channelCategory}" is not supported by device category "${suggestedDeviceCategory}"`;

					// Add warning for incompatible entity
					warnings.push({
						type: 'incompatible_channel',
						entityId: preview.entityId,
						message: `Entity "${preview.entityId}" maps to channel "${channelCategory}" which is not allowed for ${suggestedDeviceCategory} devices`,
						suggestion: 'This entity will be skipped during adoption. You can override the channel category if needed.',
					});
				}
			}
		}

		// Fill missing required properties with virtual properties
		const virtualPropertiesAdded = this.fillMissingPropertiesWithVirtuals(entityPreviews, discoveredDevice.states);

		if (virtualPropertiesAdded > 0) {
			this.logger.log(
				`[MAPPING PREVIEW] Added ${virtualPropertiesAdded} virtual properties to fill missing required properties`,
			);
		}

		// Generate validation summary using DeviceValidationService
		const validation = this.generateValidationSummary(entityPreviews, suggestedDeviceCategory);

		// Determine if ready to adopt based on validation
		// Device is ready if validation passes (all required channels/properties are present)
		const readyToAdopt = validation.isValid;

		// Log mapping summary for observability
		const mappedCount = entityPreviews.filter((e) => e.status === 'mapped').length;
		const partialCount = entityPreviews.filter((e) => e.status === 'partial').length;
		const unmappedCount = entityPreviews.filter((e) => e.status === 'unmapped').length;
		const skippedCount = entityPreviews.filter((e) => e.status === 'skipped').length;
		const incompatibleCount = entityPreviews.filter((e) => e.status === 'incompatible').length;

		this.logger.log(
			`[MAPPING PREVIEW] Summary for device "${deviceRegistry.name}" (${haDeviceId}): ` +
				`total_entities=${entityPreviews.length}, mapped=${mappedCount}, partial=${partialCount}, ` +
				`unmapped=${unmappedCount}, skipped=${skippedCount}, incompatible=${incompatibleCount}, ` +
				`suggested_category=${suggestedDeviceCategory}, ready_to_adopt=${readyToAdopt}`,
		);

		// Filter out only generic channels from the preview
		// - generic channels are fallbacks that shouldn't be adopted
		// - device_information entities (like signal_strength sensors) MUST be kept
		//   so they can be merged into the auto-created device_information channel during adoption
		const filteredEntityPreviews = entityPreviews.filter(
			(e) => !e.suggestedChannel || e.suggestedChannel.category !== ChannelCategory.GENERIC,
		);

		const preview = new MappingPreviewModel();
		preview.haDevice = this.createHaDeviceInfo(deviceRegistry);
		preview.suggestedDevice = this.createSuggestedDevice(
			deviceRegistry,
			suggestedDeviceCategory,
			mappedChannelCategories,
		);
		preview.entities = filteredEntityPreviews;
		preview.warnings = warnings;
		preview.readyToAdopt = readyToAdopt;
		preview.validation = validation;

		return preview;
	}

	/**
	 * Process a single entity and generate its mapping preview
	 */
	private processEntity(
		entityId: string,
		state: HomeAssistantStateModel | undefined,
		overrideChannelCategory?: ChannelCategory,
	): EntityMappingPreviewModel {
		const domain = this.extractDomain(entityId);
		const deviceClass = state?.attributes?.device_class as string | null | undefined;
		const friendlyName = state?.attributes?.friendly_name as string | undefined;

		// Special handling for light entities - use capability analysis
		if (domain === HomeAssistantDomain.LIGHT && state) {
			return this.processLightEntity(entityId, state, overrideChannelCategory, friendlyName);
		}

		// Find matching mapping from YAML configuration
		const mapping = overrideChannelCategory
			? this.findMappingForChannel(domain, overrideChannelCategory)
			: this.mappingLoaderService.findMatchingMapping(domain, deviceClass ?? null, entityId);

		if (!mapping) {
			return this.createUnmappedEntityPreview(entityId, domain, deviceClass, state);
		}

		// Generate property mappings
		const { suggestedProperties, unmappedAttributes, missingRequired } = this.generatePropertyMappingsFromMapping(
			mapping,
			state,
			overrideChannelCategory ?? mapping.channel.category,
			entityId,
		);

		// Determine mapping status
		let status: 'mapped' | 'partial' | 'unmapped' = 'mapped';
		if (missingRequired.length > 0) {
			status = 'partial';
		}

		return {
			entityId,
			domain: domain as string,
			deviceClass: deviceClass ?? null,
			currentState: state?.state ?? null,
			attributes: state?.attributes ?? {},
			status,
			suggestedChannel: {
				category: overrideChannelCategory ?? mapping.channel.category,
				name: friendlyName ?? this.generateChannelName(entityId, mapping.channel.category),
				confidence: overrideChannelCategory ? 'high' : this.determineConfidenceFromMapping(mapping, deviceClass),
			},
			suggestedProperties,
			unmappedAttributes,
			missingRequiredProperties: missingRequired,
		};
	}

	/**
	 * Process light entity with capability-based property detection
	 * This analyzes the supported_color_modes attribute to detect all available properties
	 * even when the light is OFF and color attributes are null
	 */
	private processLightEntity(
		entityId: string,
		state: HomeAssistantStateModel,
		overrideChannelCategory?: ChannelCategory,
		friendlyName?: string,
	): EntityMappingPreviewModel {
		const capabilities = this.lightCapabilityAnalyzer.analyzeCapabilities(state);
		const availableProperties = this.lightCapabilityAnalyzer.getAvailableProperties(capabilities);
		const channelCategory = overrideChannelCategory ?? ChannelCategory.LIGHT;

		// Generate property mappings for ALL available properties based on capabilities
		const suggestedProperties: PropertyMappingPreviewModel[] = [];

		const mappedPropertyCategories = new Set<PropertyCategory>();

		for (const propCategory of availableProperties) {
			const propertyMetadata = getPropertyMetadata(channelCategory, propCategory);
			if (!propertyMetadata) continue;

			const haAttribute = this.lightCapabilityAnalyzer.getHaAttributeForProperty(propCategory, capabilities);

			// Determine transformer for this property
			let transformerName: string | null = null;
			if (propCategory === PropertyCategory.BRIGHTNESS) {
				transformerName = 'brightness_to_percent';
			} else if (propCategory === PropertyCategory.COLOR_TEMPERATURE) {
				transformerName = 'mireds_to_kelvin';
			} else if (propCategory === PropertyCategory.ON) {
				transformerName = 'state_on_off';
			}

			// Get current value if available
			let currentValue: unknown = null;
			if (haAttribute === 'fb.main_state') {
				currentValue = state.state;
			} else if (haAttribute === 'hs_color' && Array.isArray(state.attributes?.hs_color)) {
				const hsColor = state.attributes.hs_color as [number, number];
				currentValue = propCategory === PropertyCategory.HUE ? hsColor[0] : hsColor[1];
			} else if (haAttribute === 'rgb_color' || haAttribute === 'rgbw_color' || haAttribute === 'rgbww_color') {
				// Get RGB value from the appropriate color attribute
				const colorArray = state.attributes?.[haAttribute] as number[] | undefined;
				if (Array.isArray(colorArray)) {
					if (propCategory === PropertyCategory.COLOR_WHITE) {
						// White is at index 3 for rgbw_color and rgbww_color
						currentValue = colorArray[3];
					} else {
						const index =
							propCategory === PropertyCategory.COLOR_RED ? 0 : propCategory === PropertyCategory.COLOR_GREEN ? 1 : 2;
						currentValue = colorArray[index];
					}
				}
			} else if (haAttribute === 'white') {
				currentValue = state.attributes?.white;
			} else {
				currentValue = state.attributes?.[haAttribute];
			}

			// Apply transform for preview display using transformer registry
			if (transformerName && currentValue !== undefined && currentValue !== null) {
				const transformer = this.transformerRegistry.getOrCreate(transformerName);
				if (transformer.canRead()) {
					currentValue = transformer.read(currentValue);
				}
			}

			suggestedProperties.push({
				category: propCategory,
				name: this.propertyNameFromCategory(propCategory),
				haAttribute,
				dataType: propertyMetadata.data_type,
				permissions: propertyMetadata.permissions,
				unit: propertyMetadata.unit,
				format: propertyMetadata.format,
				required: propertyMetadata.required,
				currentValue: this.normalizeValue(currentValue),
				haEntityId: entityId,
				haTransformer: transformerName,
			});

			mappedPropertyCategories.add(propCategory);
		}

		// Check for missing required properties
		const requiredProperties = getRequiredProperties(channelCategory);
		const missingRequired = requiredProperties.filter((prop) => !mappedPropertyCategories.has(prop));

		// Determine mapping status
		let status: 'mapped' | 'partial' | 'unmapped' = 'mapped';
		if (missingRequired.length > 0) {
			status = 'partial';
		}

		return {
			entityId,
			domain: HomeAssistantDomain.LIGHT as string,
			deviceClass: null,
			currentState: state.state,
			attributes: state.attributes ?? {},
			status,
			suggestedChannel: {
				category: channelCategory,
				name: friendlyName ?? this.generateChannelName(entityId, channelCategory),
				confidence: 'high',
			},
			suggestedProperties,
			unmappedAttributes: [],
			missingRequiredProperties: missingRequired,
		};
	}

	/**
	 * Generate property mappings for an entity based on resolved YAML mapping
	 */
	private generatePropertyMappingsFromMapping(
		mapping: ResolvedHaMapping,
		state: HomeAssistantStateModel | undefined,
		channelCategory: ChannelCategory,
		entityId: string,
	): {
		suggestedProperties: PropertyMappingPreviewModel[];
		unmappedAttributes: string[];
		missingRequired: PropertyCategory[];
	} {
		const suggestedProperties: PropertyMappingPreviewModel[] = [];
		const mappedAttributes = new Set<string>();
		const mappedPropertyCategories = new Set<PropertyCategory>();

		// Apply property bindings from the resolved mapping
		for (const binding of mapping.propertyBindings) {
			const propertyMetadata = getPropertyMetadata(channelCategory, binding.propertyCategory);
			if (!propertyMetadata) {
				// Property not defined in channel spec, skip
				continue;
			}

			// Check if attribute exists in state
			const attributeValue = this.getAttributeValueFromBinding(binding, state);
			const hasValue = attributeValue !== undefined && attributeValue !== null;

			if (hasValue || propertyMetadata.required) {
				suggestedProperties.push(
					this.createPropertyPreviewFromBinding(
						binding,
						propertyMetadata,
						attributeValue,
						entityId,
						state,
						channelCategory,
					),
				);
				mappedAttributes.add(binding.haAttribute === ENTITY_MAIN_STATE_ATTRIBUTE ? 'state' : binding.haAttribute);
				mappedPropertyCategories.add(binding.propertyCategory);
			}
		}

		// Find unmapped attributes (excluding internal ones)
		const internalAttributes = [
			'friendly_name',
			'device_class',
			'unit_of_measurement',
			'icon',
			'entity_picture',
			'supported_features',
			'supported_color_modes',
			'color_mode',
			'min_color_temp_kelvin',
			'max_color_temp_kelvin',
			'min_mireds',
			'max_mireds',
			'effect_list',
			'effect',
			'min_temp',
			'max_temp',
			'target_temp_step',
			'hvac_modes',
			'hvac_action',
			'fan_modes',
			'swing_modes',
			'preset_modes',
			'state_class',
			'attribution',
		];

		const unmappedAttributes: string[] = [];
		if (state?.attributes) {
			for (const attr of Object.keys(state.attributes)) {
				if (!mappedAttributes.has(attr) && !internalAttributes.includes(attr)) {
					unmappedAttributes.push(attr);
				}
			}
		}

		// Find missing required properties
		const requiredProperties = getRequiredProperties(channelCategory);
		const missingRequired = requiredProperties.filter((prop) => !mappedPropertyCategories.has(prop));

		return { suggestedProperties, unmappedAttributes, missingRequired };
	}

	/**
	 * Get attribute value from state using resolved binding
	 */
	private getAttributeValueFromBinding(
		binding: ResolvedPropertyBinding,
		state: HomeAssistantStateModel | undefined,
	): unknown {
		if (!state) return undefined;

		let value: unknown;

		if (binding.haAttribute === ENTITY_MAIN_STATE_ATTRIBUTE) {
			value = state.state;
		} else {
			value = state.attributes?.[binding.haAttribute];
		}

		// Handle array index
		if (binding.arrayIndex !== undefined && Array.isArray(value)) {
			value = value[binding.arrayIndex];
		}

		// Apply transform if transformer is specified
		if (binding.transformerName && value !== undefined && value !== null) {
			value = this.applyTransform(value, binding.transformerName);
		}

		return value;
	}

	/**
	 * Create a property preview model from resolved binding
	 */
	private createPropertyPreviewFromBinding(
		binding: ResolvedPropertyBinding,
		metadata: PropertyMetadata,
		currentValue: unknown,
		entityId?: string,
		state?: HomeAssistantStateModel,
		channelCategory?: ChannelCategory,
	): PropertyMappingPreviewModel {
		// Try to get HA-provided format values
		const haProvidedFormat = this.getHaProvidedFormat(binding.propertyCategory, state, channelCategory);

		return {
			category: binding.propertyCategory,
			name: this.propertyNameFromCategory(binding.propertyCategory),
			haAttribute: binding.haAttribute,
			dataType: metadata.data_type,
			permissions: metadata.permissions,
			unit: metadata.unit,
			format: haProvidedFormat ?? metadata.format,
			required: metadata.required,
			currentValue: this.normalizeValue(currentValue),
			haEntityId: entityId ?? null,
			haTransformer: binding.transformerName ?? null,
		};
	}

	/**
	 * Find a mapping that matches a specific channel category
	 */
	private findMappingForChannel(
		domain: HomeAssistantDomain,
		channelCategory: ChannelCategory,
	): ResolvedHaMapping | null {
		const mapping = this.mappingLoaderService.findMatchingMapping(domain, null);
		if (mapping) {
			// Create a modified mapping with the overridden channel category
			return {
				...mapping,
				channel: {
					...mapping.channel,
					category: channelCategory,
				},
			};
		}
		return null;
	}

	/**
	 * Determine mapping confidence based on mapping specificity
	 */
	private determineConfidenceFromMapping(
		mapping: ResolvedHaMapping,
		deviceClass: string | null | undefined,
	): 'high' | 'medium' | 'low' {
		if (mapping.deviceClass !== null && deviceClass) {
			return 'high';
		}
		if (mapping.deviceClass === null) {
			return 'medium';
		}
		return 'low';
	}

	/**
	 * Infer device category based on mapped channels and entity domains
	 */
	private inferDeviceCategory(
		mappedChannelCategories: ChannelCategory[],
		entityDomains: HomeAssistantDomain[],
	): DeviceCategory {
		const resolvedMappings = this.mappingLoaderService.getMappings();

		// If we have domain information, check for primary domains first
		if (entityDomains && entityDomains.length > 0) {
			const primaryDomains = entityDomains.filter(
				(d) => this.mappingLoaderService.getDomainRole(d) === EntityRole.PRIMARY,
			);

			if (primaryDomains.length > 0) {
				// Find the device category hint based on mapped channels for primary domains
				for (const domain of primaryDomains) {
					const matchingRule = resolvedMappings.find(
						(r) =>
							r.domain === domain &&
							mappedChannelCategories.includes(r.channel.category) &&
							r.deviceCategory !== DeviceCategory.GENERIC,
					);

					if (matchingRule) {
						return matchingRule.deviceCategory;
					}

					// Fallback: if no channel-matched rule found, use first non-generic rule for domain
					const fallbackRule = resolvedMappings.find(
						(r) => r.domain === domain && r.deviceCategory !== DeviceCategory.GENERIC,
					);

					if (fallbackRule) {
						return fallbackRule.deviceCategory;
					}
				}
			}
		}

		// Fallback to scoring logic for sensor-only devices
		const hints = new Map<DeviceCategory, number>();

		for (const rule of resolvedMappings) {
			if (mappedChannelCategories.includes(rule.channel.category)) {
				const current = hints.get(rule.deviceCategory) ?? 0;
				hints.set(rule.deviceCategory, current + rule.priority);
			}
		}

		// Return the most common/highest priority hint
		let bestCategory: DeviceCategory = DeviceCategory.GENERIC;
		let bestScore = 0;

		for (const [category, score] of Array.from(hints.entries())) {
			if (score > bestScore) {
				bestScore = score;
				bestCategory = category;
			}
		}

		return bestCategory;
	}

	/**
	 * Apply value transformation using TransformerRegistry
	 */
	private applyTransform(value: unknown, transformerName: string): unknown {
		const transformer = this.transformerRegistry.getOrCreate(transformerName);
		if (transformer.canRead()) {
			return transformer.read(value);
		}
		return value;
	}

	/**
	 * Get HA-provided format values for enum properties
	 * Some HA entities provide available values as attributes (e.g., hvac_modes, fan_modes)
	 * Using these ensures the property format only includes values the device actually supports
	 */
	private getHaProvidedFormat(
		propertyCategory: PropertyCategory,
		state?: HomeAssistantStateModel,
		channelCategory?: ChannelCategory,
	): (string | number)[] | null {
		if (!state?.attributes) {
			return null;
		}

		const attrs = state.attributes;

		// Thermostat mode - use hvac_modes from HA
		if (channelCategory === ChannelCategory.THERMOSTAT && propertyCategory === PropertyCategory.MODE) {
			const hvacModes = attrs.hvac_modes;
			if (Array.isArray(hvacModes) && hvacModes.length > 0) {
				return hvacModes as string[];
			}
		}

		// Fan speed - use speed_list or percentage_step from HA
		if (channelCategory === ChannelCategory.FAN && propertyCategory === PropertyCategory.SPEED) {
			const speedList = attrs.speed_list;
			if (Array.isArray(speedList) && speedList.length > 0) {
				return speedList as string[];
			}
		}

		// Fan mode - use preset_modes or fan_modes from HA
		if (channelCategory === ChannelCategory.FAN && propertyCategory === PropertyCategory.MODE) {
			const fanModes = attrs.fan_modes ?? attrs.preset_modes;
			if (Array.isArray(fanModes) && fanModes.length > 0) {
				return fanModes as string[];
			}
		}

		// Climate fan mode
		if (channelCategory === ChannelCategory.THERMOSTAT && propertyCategory === PropertyCategory.SWING) {
			const swingModes = attrs.swing_modes;
			if (Array.isArray(swingModes) && swingModes.length > 0) {
				return swingModes as string[];
			}
		}

		// Media input source
		if (
			(channelCategory === ChannelCategory.MEDIA_INPUT || channelCategory === ChannelCategory.TELEVISION) &&
			propertyCategory === PropertyCategory.SOURCE
		) {
			const sourceList = attrs.source_list;
			if (Array.isArray(sourceList) && sourceList.length > 0) {
				return sourceList as string[];
			}
		}

		return null;
	}

	/**
	 * Create a skipped entity preview
	 */
	private createSkippedEntityPreview(
		entityId: string,
		state: HomeAssistantStateModel | undefined,
	): EntityMappingPreviewModel {
		const domain = this.extractDomain(entityId);
		const deviceClass = state?.attributes?.device_class as string | null | undefined;

		return {
			entityId,
			domain: domain as string,
			deviceClass: deviceClass ?? null,
			currentState: state?.state ?? null,
			attributes: state?.attributes ?? {},
			status: 'skipped',
			suggestedChannel: null,
			suggestedProperties: [],
			unmappedAttributes: [],
			missingRequiredProperties: [],
		};
	}

	/**
	 * Create an unmapped entity preview
	 */
	private createUnmappedEntityPreview(
		entityId: string,
		domain: HomeAssistantDomain,
		deviceClass: string | null | undefined,
		state: HomeAssistantStateModel | undefined,
	): EntityMappingPreviewModel {
		// Log unmapped entity for observability - helps identify gaps in mapping rules
		this.logger.debug(
			`[MAPPING PREVIEW] Entity could not be automatically mapped: ` +
				`entity_id="${entityId}", domain="${domain}", device_class="${deviceClass ?? 'none'}"`,
			{
				entityId,
				domain,
				deviceClass: deviceClass ?? null,
				availableAttributes: Object.keys(state?.attributes ?? {}),
			},
		);

		return {
			entityId,
			domain: domain as string,
			deviceClass: deviceClass ?? null,
			currentState: state?.state ?? null,
			attributes: state?.attributes ?? {},
			status: 'unmapped',
			suggestedChannel: null,
			suggestedProperties: [],
			unmappedAttributes: Object.keys(state?.attributes ?? {}),
			missingRequiredProperties: [],
		};
	}

	/**
	 * Create HA device info model
	 */
	private createHaDeviceInfo(device: HomeAssistantDeviceRegistryResultModel): HaDeviceInfoModel {
		return {
			id: device.id,
			name: device.nameByUser ?? device.name,
			manufacturer: device.manufacturer ?? null,
			model: device.model ?? null,
		};
	}

	/**
	 * Create suggested device model
	 */
	private createSuggestedDevice(
		device: HomeAssistantDeviceRegistryResultModel,
		category: DeviceCategory,
		mappedChannels: ChannelCategory[],
	): SuggestedDeviceModel {
		// Determine confidence based on mapping coverage
		let confidence: 'high' | 'medium' | 'low' = 'medium';
		if (mappedChannels.length > 0) {
			confidence = 'high';
		}
		if (category === DeviceCategory.GENERIC) {
			confidence = 'low';
		}

		return {
			category,
			name: device.nameByUser ?? device.name,
			confidence,
		};
	}

	/**
	 * Extract domain from entity ID (e.g., 'light.living_room' -> HomeAssistantDomain.LIGHT)
	 */
	private extractDomain(entityId: string): HomeAssistantDomain {
		const domain = entityId.split('.')[0];
		return domain as HomeAssistantDomain;
	}

	/**
	 * Generate a channel name from entity ID
	 */
	private generateChannelName(entityId: string, channelCategory: ChannelCategory): string {
		// Extract the entity name part (after the domain)
		const parts = entityId.split('.');
		if (parts.length > 1) {
			return parts[1].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
		}
		return channelCategory.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * Convert property category to human-readable name
	 */
	private propertyNameFromCategory(category: PropertyCategory): string {
		return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * Normalize value to acceptable types
	 */
	private normalizeValue(value: unknown): string | number | boolean | null {
		if (value === undefined || value === null) {
			return null;
		}
		if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
			return value;
		}
		// For objects/arrays, serialize to JSON string
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value as string | number);
	}

	/**
	 * Consolidate entities that map to the same channel category into a single entity preview
	 * This prevents creating multiple channels of the same category (e.g., multiple ELECTRICAL_POWER channels
	 * from voltage, power, and current entities should be merged into one channel with all properties)
	 */
	private consolidateEntitiesByChannelCategory(
		entityPreviews: EntityMappingPreviewModel[],
		states: HomeAssistantStateModel[],
	): EntityMappingPreviewModel[] {
		// Separate skipped and unmapped entities (these don't need consolidation)
		const skippedOrUnmapped = entityPreviews.filter(
			(e) => e.status === 'skipped' || e.status === 'unmapped' || !e.suggestedChannel,
		);
		const mappableEntities = entityPreviews.filter(
			(e) => e.status !== 'skipped' && e.status !== 'unmapped' && e.suggestedChannel !== null,
		);

		// Group by channel category
		const groupedByCategory = new Map<ChannelCategory, EntityMappingPreviewModel[]>();
		for (const entity of mappableEntities) {
			if (!entity.suggestedChannel) continue;

			const category = entity.suggestedChannel.category;
			const existing = groupedByCategory.get(category) ?? [];
			existing.push(entity);
			groupedByCategory.set(category, existing);
		}

		const consolidated: EntityMappingPreviewModel[] = [];

		// Process each group
		for (const [category, entities] of groupedByCategory.entries()) {
			if (entities.length === 1) {
				// No consolidation needed
				consolidated.push(entities[0]);
				continue;
			}

			// Multiple entities map to the same category - consolidate them
			this.logger.debug(
				`[MAPPING PREVIEW] Consolidating ${entities.length} entities into single channel category: ${category}`,
				{ entityIds: entities.map((e) => e.entityId) },
			);

			// Select primary entity (prefer one with more important properties or first one)
			// For ELECTRICAL_POWER, prefer entity with POWER property
			let primaryEntity = entities[0];
			if (category === ChannelCategory.ELECTRICAL_POWER) {
				const entityWithPower = entities.find((e) =>
					e.suggestedProperties.some((p) => p.category === PropertyCategory.POWER),
				);
				if (entityWithPower) {
					primaryEntity = entityWithPower;
				}
			}

			// Merge properties from all entities
			// Use a map keyed by property category + entity ID to preserve properties from different entities
			// But then consolidate by category (keeping the first one we see, or prefer POWER for ELECTRICAL_POWER)
			const propertyMap = new Map<PropertyCategory, PropertyMappingPreviewModel>();
			const allUnmappedAttributes = new Set<string>();
			const allMissingRequired = new Set<PropertyCategory>();

			for (const entity of entities) {
				// Merge properties, preserving entity ID information
				for (const prop of entity.suggestedProperties) {
					// Ensure property has entity ID set
					if (!prop.haEntityId) {
						prop.haEntityId = entity.entityId;
					}

					// If property category already exists, only override if this is a "better" property
					// (e.g., prefer POWER property for ELECTRICAL_POWER category)
					const existing = propertyMap.get(prop.category);
					if (!existing) {
						propertyMap.set(prop.category, prop);
					} else if (category === ChannelCategory.ELECTRICAL_POWER && prop.category === PropertyCategory.POWER) {
						// Prefer POWER property for ELECTRICAL_POWER channel
						propertyMap.set(prop.category, prop);
					}
					// Otherwise keep existing property (don't override)
				}

				// Collect unmapped attributes
				for (const attr of entity.unmappedAttributes) {
					allUnmappedAttributes.add(attr);
				}

				// Collect missing required properties
				for (const prop of entity.missingRequiredProperties) {
					allMissingRequired.add(prop);
				}
			}

			// Remove properties that are now mapped from missing required
			for (const prop of propertyMap.keys()) {
				allMissingRequired.delete(prop);
			}

			// Determine overall status
			let status: 'mapped' | 'partial' | 'unmapped' = 'mapped';
			if (allMissingRequired.size > 0) {
				status = 'partial';
			}

			// Generate consolidated channel name
			const friendlyNames = entities
				.map((e) => {
					const state = states.find((s) => s.entityId === e.entityId);
					return (state?.attributes?.friendly_name as string | undefined) ?? e.entityId;
				})
				.filter((name, index, arr) => arr.indexOf(name) === index); // Unique names
			const channelName =
				friendlyNames.length === 1 ? friendlyNames[0] : this.generateChannelName(primaryEntity.entityId, category);

			// Create consolidated entity preview
			const consolidatedPreview: EntityMappingPreviewModel = {
				entityId: primaryEntity.entityId, // Use primary entity ID
				domain: primaryEntity.domain,
				deviceClass: primaryEntity.deviceClass,
				currentState: primaryEntity.currentState,
				attributes: { ...primaryEntity.attributes }, // Merge attributes from primary
				status,
				suggestedChannel: {
					category,
					name: channelName,
					confidence: primaryEntity.suggestedChannel?.confidence ?? 'medium',
				},
				suggestedProperties: Array.from(propertyMap.values()),
				unmappedAttributes: Array.from(allUnmappedAttributes),
				missingRequiredProperties: Array.from(allMissingRequired),
			};

			consolidated.push(consolidatedPreview);

			this.logger.debug(
				`[MAPPING PREVIEW] Consolidated ${entities.length} entities into channel "${channelName}" (${category}) with ${consolidatedPreview.suggestedProperties.length} properties`,
			);
		}

		// Return consolidated entities plus skipped/unmapped ones
		return [...consolidated, ...skippedOrUnmapped];
	}

	/**
	 * Fill missing required properties with virtual properties
	 * This ensures devices can be fully adopted even when HA doesn't provide all required properties
	 *
	 * @param entityPreviews - Array of entity previews to update in place
	 * @param states - All HA states for context
	 * @returns Number of virtual properties added
	 */
	private fillMissingPropertiesWithVirtuals(
		entityPreviews: EntityMappingPreviewModel[],
		states: HomeAssistantStateModel[],
	): number {
		let virtualPropertiesAdded = 0;

		for (const entityPreview of entityPreviews) {
			// Skip entities without a suggested channel
			if (
				!entityPreview.suggestedChannel ||
				entityPreview.status === 'skipped' ||
				entityPreview.status === 'unmapped'
			) {
				continue;
			}

			const channelCategory = entityPreview.suggestedChannel.category;
			const existingPropertyCategories = new Set(entityPreview.suggestedProperties.map((p) => p.category));
			const requiredProperties = getRequiredProperties(channelCategory);

			// Find missing required properties that can be filled with virtuals
			const missingVirtuals = this.virtualPropertyService.getMissingVirtualProperties(
				channelCategory,
				existingPropertyCategories,
				requiredProperties,
			);

			// Add virtual properties to the entity preview
			for (const virtualDef of missingVirtuals) {
				const state = states.find((s) => s.entityId === entityPreview.entityId);
				const context: VirtualPropertyContext = {
					entityId: entityPreview.entityId,
					domain: entityPreview.domain as HomeAssistantDomain,
					deviceClass: entityPreview.deviceClass,
					state,
					allStates: states,
				};

				// Resolve the virtual property value
				const resolved = this.virtualPropertyService.resolveVirtualPropertyValue(virtualDef, context);

				// Get property metadata for formatting
				const propertyMetadata = getPropertyMetadata(channelCategory, virtualDef.propertyCategory);

				// Create property preview for the virtual property
				const virtualPropertyPreview: PropertyMappingPreviewModel = {
					category: virtualDef.propertyCategory,
					name: this.propertyNameFromCategory(virtualDef.propertyCategory),
					haAttribute: this.virtualPropertyService.getVirtualAttributeMarker(
						virtualDef.propertyCategory,
						virtualDef.virtualType,
					),
					dataType: virtualDef.dataType,
					permissions: virtualDef.permissions,
					unit: virtualDef.unit ?? propertyMetadata?.unit ?? null,
					format: virtualDef.format ?? propertyMetadata?.format ?? null,
					required: true, // Virtual properties are added to fill required slots
					currentValue: resolved.value,
					haEntityId: entityPreview.entityId,
					isVirtual: true,
					virtualType: virtualDef.virtualType,
				};

				entityPreview.suggestedProperties.push(virtualPropertyPreview);
				virtualPropertiesAdded++;

				// Remove from missing required properties list
				const missingIndex = entityPreview.missingRequiredProperties.indexOf(virtualDef.propertyCategory);
				if (missingIndex >= 0) {
					entityPreview.missingRequiredProperties.splice(missingIndex, 1);
				}
			}

			// Update status if all missing properties are now filled
			if (entityPreview.missingRequiredProperties.length === 0 && entityPreview.status === 'partial') {
				entityPreview.status = 'mapped';
			}
		}

		return virtualPropertiesAdded;
	}

	/**
	 * Generate a validation summary for the current mapping
	 * Uses DeviceValidationService to check if the device structure is valid
	 */
	private generateValidationSummary(
		entityPreviews: EntityMappingPreviewModel[],
		deviceCategory: DeviceCategory,
	): ValidationSummaryModel {
		// Build a device structure from the entity previews
		// Filter out:
		// - device_information (auto-created during adoption, not user-configurable)
		// - generic channels (fallback that shouldn't be adopted)
		// - skipped/unmapped entities
		const channels = entityPreviews
			.filter(
				(e) =>
					e.suggestedChannel &&
					e.status !== 'skipped' &&
					e.status !== 'unmapped' &&
					e.suggestedChannel.category !== ChannelCategory.DEVICE_INFORMATION &&
					e.suggestedChannel.category !== ChannelCategory.GENERIC,
			)
			.map((e) => ({
				category: e.suggestedChannel.category,
				properties: e.suggestedProperties.map((p) => ({
					category: p.category,
					dataType: p.dataType,
					permissions: p.permissions,
				})),
			}));

		// Add device_information channel (auto-created during adoption with HA registry data)
		// This is always added by the plugin, users cannot modify it
		// Must match properties created in device-adoption.service.ts
		channels.push({
			category: ChannelCategory.DEVICE_INFORMATION,
			properties: [
				// Required properties
				{
					category: PropertyCategory.MANUFACTURER,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.MODEL,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.SERIAL_NUMBER,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.FIRMWARE_REVISION,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				// Optional properties (also created by device-adoption.service)
				{
					category: PropertyCategory.HARDWARE_REVISION,
					dataType: DataTypeType.STRING,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.CONNECTION_TYPE,
					dataType: DataTypeType.ENUM,
					permissions: [PermissionType.READ_ONLY],
				},
				{
					category: PropertyCategory.STATUS,
					dataType: DataTypeType.ENUM,
					permissions: [PermissionType.READ_ONLY],
				},
			],
		});

		// Validate the structure using DeviceValidationService
		const validationResult = this.deviceValidationService.validateDeviceStructure({
			category: deviceCategory,
			channels,
		});

		// Build validation summary - categorize all issues
		const missingChannels: string[] = [];
		const missingProperties: Record<string, string[]> = {};
		const autoFilledVirtual: Record<string, string[]> = {};
		const unknownChannels: string[] = [];
		const duplicateChannels: string[] = [];
		const constraintViolations: string[] = [];

		for (const issue of validationResult.issues) {
			switch (issue.type) {
				case ValidationIssueType.MISSING_CHANNEL:
					if (issue.channelCategory) {
						missingChannels.push(issue.channelCategory);
					}
					break;

				case ValidationIssueType.MISSING_PROPERTY:
					if (issue.channelCategory && issue.propertyCategory) {
						if (!missingProperties[issue.channelCategory]) {
							missingProperties[issue.channelCategory] = [];
						}
						missingProperties[issue.channelCategory].push(issue.propertyCategory);
					}
					break;

				case ValidationIssueType.UNKNOWN_CHANNEL:
					if (issue.channelCategory) {
						unknownChannels.push(issue.channelCategory);
						this.logger.warn(
							`[VALIDATION] Channel ${issue.channelCategory} is not allowed for device category ${deviceCategory}`,
						);
					}
					break;

				case ValidationIssueType.DUPLICATE_CHANNEL:
					if (issue.channelCategory) {
						duplicateChannels.push(issue.channelCategory);
						this.logger.warn(
							`[VALIDATION] Channel ${issue.channelCategory} appears multiple times but should be unique`,
						);
					}
					break;

				case ValidationIssueType.CONSTRAINT_ONE_OF_VIOLATION:
				case ValidationIssueType.CONSTRAINT_ONE_OR_MORE_OF_VIOLATION:
				case ValidationIssueType.CONSTRAINT_MUTUALLY_EXCLUSIVE_VIOLATION:
					constraintViolations.push(issue.message);
					this.logger.warn(`[VALIDATION] Constraint violation: ${issue.message}`);
					break;

				case ValidationIssueType.INVALID_DATA_TYPE:
				case ValidationIssueType.INVALID_PERMISSIONS:
				case ValidationIssueType.INVALID_FORMAT:
					// Log these but they're less common in mapping preview
					break;
			}
		}

		// Count virtual properties by channel
		for (const entityPreview of entityPreviews) {
			if (!entityPreview.suggestedChannel) continue;

			const channelCat = entityPreview.suggestedChannel.category;
			const virtualProps = entityPreview.suggestedProperties.filter((p) => p.isVirtual);

			if (virtualProps.length > 0) {
				if (!autoFilledVirtual[channelCat]) {
					autoFilledVirtual[channelCat] = [];
				}
				for (const vp of virtualProps) {
					autoFilledVirtual[channelCat].push(vp.category);
				}
			}
		}

		// Calculate counts
		const missingPropertiesCount = Object.values(missingProperties).reduce((sum, arr) => sum + arr.length, 0);
		const fillableWithVirtualCount = Object.values(autoFilledVirtual).reduce((sum, arr) => sum + arr.length, 0);

		// Log validation summary for observability

		return {
			isValid: validationResult.isValid,
			missingChannelsCount: missingChannels.length,
			missingPropertiesCount,
			fillableWithVirtualCount,
			missingChannels,
			missingProperties,
			autoFilledVirtual,
			unknownChannels,
			duplicateChannels,
			constraintViolations,
		};
	}
}
