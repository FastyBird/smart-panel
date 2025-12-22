import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import {
	DeviceValidationService,
	ValidationIssueType,
} from '../../../modules/devices/services/device-validation.service';
import {
	PropertyMetadata,
	getAllowedChannels,
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

import {
	HaEntityMappingRule,
	HaPropertyBinding,
	findMatchingRule,
	inferDeviceCategory,
} from './ha-entity-mapping.rules';
import { HomeAssistantHttpService } from './home-assistant.http.service';
import { HomeAssistantWsService } from './home-assistant.ws.service';
import { LightCapabilityAnalyzer } from './light-capability.analyzer';
import { VirtualPropertyService } from './virtual-property.service';
import { VirtualPropertyContext, VirtualPropertyDefinition, VirtualPropertyType } from './virtual-property.types';

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
	) {}

	/**
	 * Generate a mapping preview for a Home Assistant device
	 */
	async generatePreview(haDeviceId: string, options?: MappingPreviewRequestDto): Promise<MappingPreviewModel> {
		this.logger.debug(`[MAPPING PREVIEW] Generating preview for HA device: ${haDeviceId}`);

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
			options?.deviceCategory ?? inferDeviceCategory(mappedChannelCategories, entityDomains);

		// Check for missing required channels
		const deviceSpec = devicesSchema[suggestedDeviceCategory as keyof typeof devicesSchema];
		if (deviceSpec && 'channels' in deviceSpec) {
			const requiredChannels = Object.entries(deviceSpec.channels)
				.filter(([, spec]) => (spec as { required?: boolean }).required)
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
		}

		// Fill missing required properties with virtual properties
		const virtualPropertiesAdded = this.fillMissingPropertiesWithVirtuals(
			entityPreviews,
			discoveredDevice.states,
		);

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

		this.logger.log(
			`[MAPPING PREVIEW] Summary for device "${deviceRegistry.name}" (${haDeviceId}): ` +
				`total_entities=${entityPreviews.length}, mapped=${mappedCount}, partial=${partialCount}, ` +
				`unmapped=${unmappedCount}, skipped=${skippedCount}, suggested_category=${suggestedDeviceCategory}, ` +
				`ready_to_adopt=${readyToAdopt}`,
		);

		if (unmappedCount > 0) {
			const unmappedDomains = entityPreviews
				.filter((e) => e.status === 'unmapped')
				.map((e) => `${e.domain}${e.deviceClass ? '.' + e.deviceClass : ''}`)
				.join(', ');
			this.logger.debug(
				`[MAPPING PREVIEW] ${unmappedCount} entities could not be mapped. ` +
					`Consider adding mapping rules for: ${unmappedDomains}`,
			);
		}

		const preview = new MappingPreviewModel();
		preview.haDevice = this.createHaDeviceInfo(deviceRegistry);
		preview.suggestedDevice = this.createSuggestedDevice(
			deviceRegistry,
			suggestedDeviceCategory,
			mappedChannelCategories,
		);
		preview.entities = entityPreviews;
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

		// Find matching rule
		const rule = overrideChannelCategory
			? this.findRuleForChannel(domain, overrideChannelCategory)
			: findMatchingRule(domain, deviceClass);

		if (!rule) {
			return this.createUnmappedEntityPreview(entityId, domain, deviceClass, state);
		}

		// Generate property mappings
		const { suggestedProperties, unmappedAttributes, missingRequired } = this.generatePropertyMappings(
			rule,
			state,
			overrideChannelCategory ?? rule.channel_category,
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
				category: overrideChannelCategory ?? rule.channel_category,
				name: friendlyName ?? this.generateChannelName(entityId, rule.channel_category),
				confidence: overrideChannelCategory ? 'high' : this.determineConfidence(rule, deviceClass),
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

			// Apply brightness transform
			if (propCategory === PropertyCategory.BRIGHTNESS && typeof currentValue === 'number') {
				currentValue = Math.round((currentValue / 255) * 100);
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
	 * Generate property mappings for an entity based on its rule and state
	 */
	private generatePropertyMappings(
		rule: HaEntityMappingRule,
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

		// Apply property bindings from the rule
		for (const binding of rule.property_bindings) {
			const propertyMetadata = getPropertyMetadata(channelCategory, binding.property_category);
			if (!propertyMetadata) {
				// Property not defined in channel spec, skip
				continue;
			}

			// Check if attribute exists in state
			const attributeValue = this.getAttributeValue(binding, state);
			const hasValue = attributeValue !== undefined && attributeValue !== null;

			if (hasValue || propertyMetadata.required) {
				suggestedProperties.push(this.createPropertyPreview(binding, propertyMetadata, attributeValue, entityId));
				mappedAttributes.add(binding.ha_attribute === ENTITY_MAIN_STATE_ATTRIBUTE ? 'state' : binding.ha_attribute);
				mappedPropertyCategories.add(binding.property_category);
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
	 * Get attribute value from state, handling array indices and transforms
	 */
	private getAttributeValue(binding: HaPropertyBinding, state: HomeAssistantStateModel | undefined): unknown {
		if (!state) return undefined;

		let value: unknown;

		if (binding.ha_attribute === ENTITY_MAIN_STATE_ATTRIBUTE) {
			value = state.state;
		} else {
			value = state.attributes?.[binding.ha_attribute];
		}

		// Handle array index
		if (binding.array_index !== undefined && Array.isArray(value)) {
			value = value[binding.array_index];
		}

		// Apply transform
		if (binding.transform && value !== undefined && value !== null) {
			value = this.applyTransform(value, binding.transform);
		}

		return value;
	}

	/**
	 * Apply value transformation
	 */
	private applyTransform(value: unknown, transform: string): unknown {
		switch (transform) {
			case 'brightness_to_percent':
				if (typeof value === 'number') {
					return Math.round((value / 255) * 100);
				}
				break;
			case 'percent_to_brightness':
				if (typeof value === 'number') {
					return Math.round((value / 100) * 255);
				}
				break;
			case 'invert_boolean':
				if (typeof value === 'boolean') {
					return !value;
				}
				if (value === 'on') return false;
				if (value === 'off') return true;
				break;
			case 'kelvin_to_mireds':
				if (typeof value === 'number' && value > 0) {
					return Math.round(1000000 / value);
				}
				break;
		}
		return value;
	}

	/**
	 * Create a property preview model
	 */
	private createPropertyPreview(
		binding: HaPropertyBinding,
		metadata: PropertyMetadata,
		currentValue: unknown,
		entityId?: string,
	): PropertyMappingPreviewModel {
		return {
			category: binding.property_category,
			name: this.propertyNameFromCategory(binding.property_category),
			haAttribute: binding.ha_attribute,
			dataType: metadata.data_type,
			permissions: metadata.permissions,
			unit: metadata.unit,
			format: metadata.format,
			required: metadata.required,
			currentValue: this.normalizeValue(currentValue),
			haEntityId: entityId ?? null,
		};
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
	 * Find a rule that matches a specific channel category
	 */
	private findRuleForChannel(
		domain: HomeAssistantDomain,
		channelCategory: ChannelCategory,
	): HaEntityMappingRule | null {
		const rule = findMatchingRule(domain, null);
		if (rule) {
			// Create a modified rule with the overridden channel category
			return {
				...rule,
				channel_category: channelCategory,
			};
		}
		return null;
	}

	/**
	 * Determine mapping confidence based on rule specificity
	 */
	private determineConfidence(
		rule: HaEntityMappingRule,
		deviceClass: string | null | undefined,
	): 'high' | 'medium' | 'low' {
		if (rule.device_class !== null && deviceClass) {
			return 'high';
		}
		if (rule.device_class === null) {
			return 'medium';
		}
		return 'low';
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
			if (!entityPreview.suggestedChannel || entityPreview.status === 'skipped' || entityPreview.status === 'unmapped') {
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
				const propertyMetadata = getPropertyMetadata(channelCategory, virtualDef.property_category);

				// Create property preview for the virtual property
				const virtualPropertyPreview: PropertyMappingPreviewModel = {
					category: virtualDef.property_category,
					name: this.propertyNameFromCategory(virtualDef.property_category),
					haAttribute: this.virtualPropertyService.getVirtualAttributeMarker(
						virtualDef.property_category,
						virtualDef.virtual_type,
					),
					dataType: virtualDef.data_type,
					permissions: virtualDef.permissions,
					unit: virtualDef.unit ?? propertyMetadata?.unit ?? null,
					format: virtualDef.format ?? propertyMetadata?.format ?? null,
					required: true, // Virtual properties are added to fill required slots
					currentValue: resolved.value,
					haEntityId: entityPreview.entityId,
					isVirtual: true,
					virtualType: virtualDef.virtual_type,
				};

				entityPreview.suggestedProperties.push(virtualPropertyPreview);
				virtualPropertiesAdded++;

				// Remove from missing required properties list
				const missingIndex = entityPreview.missingRequiredProperties.indexOf(virtualDef.property_category);
				if (missingIndex >= 0) {
					entityPreview.missingRequiredProperties.splice(missingIndex, 1);
				}

				this.logger.debug(
					`[MAPPING PREVIEW] Added virtual property: channel=${channelCategory}, ` +
						`property=${virtualDef.property_category}, type=${virtualDef.virtual_type}, ` +
						`value=${resolved.value}`,
				);
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
		const channels = entityPreviews
			.filter((e) => e.suggestedChannel && e.status !== 'skipped' && e.status !== 'unmapped')
			.map((e) => ({
				category: e.suggestedChannel!.category,
				properties: e.suggestedProperties.map((p) => ({
					category: p.category,
					dataType: p.dataType,
					permissions: p.permissions,
				})),
			}));

		// Add device_information channel (auto-created during adoption)
		channels.push({
			category: ChannelCategory.DEVICE_INFORMATION,
			properties: [
				{ category: PropertyCategory.MANUFACTURER },
				{ category: PropertyCategory.MODEL },
				{ category: PropertyCategory.SERIAL_NUMBER },
				{ category: PropertyCategory.FIRMWARE_REVISION },
			],
		});

		// Validate the structure
		const validationResult = this.deviceValidationService.validateDeviceStructure({
			category: deviceCategory,
			channels,
		});

		// Build validation summary
		const missingChannels: string[] = [];
		const missingProperties: Record<string, string[]> = {};
		const autoFilledVirtual: Record<string, string[]> = {};

		for (const issue of validationResult.issues) {
			if (issue.type === ValidationIssueType.MISSING_CHANNEL && issue.channelCategory) {
				missingChannels.push(issue.channelCategory);
			} else if (issue.type === ValidationIssueType.MISSING_PROPERTY && issue.channelCategory && issue.propertyCategory) {
				if (!missingProperties[issue.channelCategory]) {
					missingProperties[issue.channelCategory] = [];
				}
				missingProperties[issue.channelCategory].push(issue.propertyCategory);
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

		return {
			isValid: validationResult.isValid,
			missingChannelsCount: missingChannels.length,
			missingPropertiesCount,
			fillableWithVirtualCount,
			missingChannels,
			missingProperties,
			autoFilledVirtual,
		};
	}
}
