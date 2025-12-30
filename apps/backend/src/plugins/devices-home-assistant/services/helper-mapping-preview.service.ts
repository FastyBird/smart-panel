import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import {
	ChannelCategory,
	DataTypeType,
	DeviceCategory,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { getPropertyMetadata } from '../../../modules/devices/utils/schema.utils';
import {
	DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
	ENTITY_MAIN_STATE_ATTRIBUTE,
	HomeAssistantDomain,
} from '../devices-home-assistant.constants';
import { DevicesHomeAssistantNotFoundException } from '../devices-home-assistant.exceptions';
import { HelperMappingPreviewRequestDto } from '../dto/helper-mapping-preview.dto';
import {
	HelperChannelMappingPreviewModel,
	HelperInfoModel,
	HelperMappingPreviewModel,
	HelperMappingWarningModel,
	HelperPropertyMappingPreviewModel,
	SuggestedHelperDeviceModel,
} from '../models/helper-mapping-preview.model';
import { HomeAssistantDiscoveredHelperModel } from '../models/home-assistant.model';

import { findMatchingRule } from './ha-entity-mapping.rules';
import { HomeAssistantHttpService } from './home-assistant.http.service';

/**
 * Service for generating mapping previews for Home Assistant helpers
 */
@Injectable()
export class HelperMappingPreviewService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'HelperMappingPreviewService',
	);

	constructor(private readonly homeAssistantHttpService: HomeAssistantHttpService) {}

	/**
	 * Generate a mapping preview for a Home Assistant helper
	 */
	async generatePreview(
		entityId: string,
		options?: HelperMappingPreviewRequestDto,
	): Promise<HelperMappingPreviewModel> {
		this.logger.debug(`[HELPER MAPPING PREVIEW] Generating preview for helper: ${entityId}`);

		// Fetch helper information
		const helper = await this.homeAssistantHttpService.getDiscoveredHelper(entityId);

		if (!helper) {
			throw new DevicesHomeAssistantNotFoundException(`Home Assistant helper with entity_id ${entityId} not found`);
		}

		const warnings: HelperMappingWarningModel[] = [];
		const domain = helper.domain as HomeAssistantDomain;
		const deviceClass = (helper.state?.attributes?.device_class as string) ?? null;

		// Find matching rule
		const rule = findMatchingRule(domain, deviceClass, entityId);

		// Determine channel category
		const channelCategory = options?.channelCategory ?? rule?.channel_category ?? ChannelCategory.GENERIC;
		const deviceCategory = options?.deviceCategory ?? rule?.device_category_hint ?? DeviceCategory.GENERIC;

		// Generate channels based on domain
		const suggestedChannels: HelperChannelMappingPreviewModel[] = [];

		if (domain === HomeAssistantDomain.CLIMATE) {
			// Climate entities need multiple channels
			suggestedChannels.push(...this.generateClimateChannels(helper, entityId));
		} else if (rule) {
			// Standard single-channel handling
			const suggestedProperties = this.generatePropertiesFromRule(helper, rule, channelCategory, entityId);
			suggestedChannels.push({
				category: channelCategory,
				name: helper.name,
				confidence: 'medium',
				suggestedProperties,
			});
		} else {
			// No matching rule, add generic channel
			suggestedChannels.push({
				category: ChannelCategory.GENERIC,
				name: helper.name,
				confidence: 'low',
				suggestedProperties: [
					{
						category: PropertyCategory.GENERIC,
						name: 'State',
						haAttribute: ENTITY_MAIN_STATE_ATTRIBUTE,
						dataType: DataTypeType.STRING,
						permissions: [PermissionType.READ_WRITE],
						unit: null,
						format: null,
						required: false,
						currentValue: helper.state?.state ?? null,
					},
				],
			});

			warnings.push({
				type: 'no_mapping_rule',
				message: `No specific mapping rule found for domain "${domain}"`,
				suggestion: 'The helper will be mapped with generic properties',
			});
		}

		// Build helper info
		const helperInfo: HelperInfoModel = {
			entityId: helper.entityId,
			name: helper.name,
			domain: helper.domain,
		};

		// Build suggested device
		const suggestedDevice: SuggestedHelperDeviceModel = {
			category: deviceCategory,
			name: helper.name,
			confidence: rule ? 'medium' : 'low',
		};

		// Determine if ready to adopt
		const totalProperties = suggestedChannels.reduce((sum, ch) => sum + ch.suggestedProperties.length, 0);
		const readyToAdopt = totalProperties > 0;

		this.logger.log(
			`[HELPER MAPPING PREVIEW] Summary for helper "${helper.name}" (${entityId}): ` +
				`domain=${domain}, channels=${suggestedChannels.length}, device=${deviceCategory}, ` +
				`properties=${totalProperties}, ready_to_adopt=${readyToAdopt}`,
		);

		const preview = new HelperMappingPreviewModel();
		preview.helper = helperInfo;
		preview.suggestedDevice = suggestedDevice;
		// For backward compatibility, use first channel as suggestedChannel
		preview.suggestedChannel = suggestedChannels[0];
		preview.suggestedChannels = suggestedChannels;
		preview.warnings = warnings;
		preview.readyToAdopt = readyToAdopt;

		return preview;
	}

	/**
	 * Generate channels for climate entities (thermostat)
	 */
	private generateClimateChannels(
		helper: HomeAssistantDiscoveredHelperModel,
		_entityId: string,
	): HelperChannelMappingPreviewModel[] {
		const channels: HelperChannelMappingPreviewModel[] = [];
		const attributes = helper.state?.attributes ?? {};

		// 1. Temperature channel (required) - for current temperature
		if (attributes.current_temperature !== undefined) {
			channels.push({
				category: ChannelCategory.TEMPERATURE,
				name: 'Temperature',
				confidence: 'high',
				suggestedProperties: [
					{
						category: PropertyCategory.TEMPERATURE,
						name: 'Temperature',
						haAttribute: 'current_temperature',
						dataType: DataTypeType.FLOAT,
						permissions: [PermissionType.READ_ONLY],
						unit: '°C',
						format: [0, 100],
						required: true,
						currentValue: attributes.current_temperature as number,
					},
				],
			});
		}

		// 2. Thermostat channel (required) - for mode and active state
		const thermostatProperties: HelperPropertyMappingPreviewModel[] = [];

		// Mode property - uses hvac_modes for format
		const hvacModes = attributes.hvac_modes as string[] | undefined;
		thermostatProperties.push({
			category: PropertyCategory.MODE,
			name: 'Mode',
			haAttribute: ENTITY_MAIN_STATE_ATTRIBUTE,
			dataType: DataTypeType.ENUM,
			permissions: [PermissionType.READ_WRITE],
			unit: null,
			format: hvacModes ?? ['off', 'heat', 'cool', 'auto'],
			required: true,
			currentValue: helper.state?.state ?? null,
		});

		// Active property - derived from hvac_action (spec requires rw permissions)
		const hvacAction = attributes.hvac_action as string | undefined;
		const isActive = hvacAction ? ['heating', 'cooling', 'drying', 'fan'].includes(hvacAction) : false;
		thermostatProperties.push({
			category: PropertyCategory.ACTIVE,
			name: 'Active',
			haAttribute: 'hvac_action',
			dataType: DataTypeType.BOOL,
			permissions: [PermissionType.READ_WRITE],
			unit: null,
			format: null,
			required: true,
			currentValue: isActive,
		});

		channels.push({
			category: ChannelCategory.THERMOSTAT,
			name: 'Thermostat',
			confidence: 'high',
			suggestedProperties: thermostatProperties,
		});

		// 3. Heater channel (optional) - for target temperature if available
		if (attributes.temperature !== undefined) {
			const heaterProperties: HelperPropertyMappingPreviewModel[] = [];

			// On property - derived from hvac mode
			const isHeating = helper.state?.state !== 'off';
			heaterProperties.push({
				category: PropertyCategory.ON,
				name: 'On',
				haAttribute: ENTITY_MAIN_STATE_ATTRIBUTE,
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_WRITE],
				unit: null,
				format: null,
				required: true,
				currentValue: isHeating,
			});

			// Target temperature
			heaterProperties.push({
				category: PropertyCategory.TEMPERATURE,
				name: 'Target Temperature',
				haAttribute: 'temperature',
				dataType: DataTypeType.FLOAT,
				permissions: [PermissionType.READ_WRITE],
				unit: '°C',
				format: [(attributes.min_temp as number) ?? 0, (attributes.max_temp as number) ?? 100],
				required: true,
				currentValue: attributes.temperature as number,
			});

			// Status - derived from hvac_action
			heaterProperties.push({
				category: PropertyCategory.STATUS,
				name: 'Status',
				haAttribute: 'hvac_action',
				dataType: DataTypeType.BOOL,
				permissions: [PermissionType.READ_ONLY],
				unit: null,
				format: null,
				required: true,
				currentValue: hvacAction === 'heating',
			});

			channels.push({
				category: ChannelCategory.HEATER,
				name: 'Heater',
				confidence: 'medium',
				suggestedProperties: heaterProperties,
			});
		}

		return channels;
	}

	/**
	 * Generate properties from mapping rule
	 */
	private generatePropertiesFromRule(
		helper: HomeAssistantDiscoveredHelperModel,
		rule: ReturnType<typeof findMatchingRule>,
		channelCategory: ChannelCategory,
		_entityId: string,
	): HelperPropertyMappingPreviewModel[] {
		if (!rule) return [];

		const suggestedProperties: HelperPropertyMappingPreviewModel[] = [];

		for (const binding of rule.property_bindings) {
			const propertyMetadata = getPropertyMetadata(channelCategory, binding.property_category);

			let currentValue: string | number | boolean | null = null;
			if (binding.ha_attribute === ENTITY_MAIN_STATE_ATTRIBUTE) {
				currentValue = helper.state?.state ?? null;
			} else if (helper.state?.attributes) {
				currentValue = (helper.state.attributes[binding.ha_attribute] as string | number | boolean) ?? null;
			}

			suggestedProperties.push({
				category: binding.property_category,
				name: this.propertyNameFromCategory(binding.property_category),
				haAttribute: binding.ha_attribute,
				dataType: propertyMetadata?.data_type ?? DataTypeType.STRING,
				permissions: propertyMetadata?.permissions ?? [PermissionType.READ_ONLY],
				unit: propertyMetadata?.unit ?? null,
				format:
					this.getFormatFromState(helper.state?.attributes, binding.property_category, helper.domain) ??
					propertyMetadata?.format ??
					null,
				required: propertyMetadata?.required ?? false,
				currentValue,
			});
		}

		return suggestedProperties;
	}

	/**
	 * Convert property category to human-readable name
	 */
	private propertyNameFromCategory(category: PropertyCategory): string {
		return category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/**
	 * Get format values from state attributes
	 */
	private getFormatFromState(
		attributes: Record<string, unknown> | undefined,
		propertyCategory: PropertyCategory,
		domain: string,
	): (string | number)[] | null {
		if (!attributes) {
			return null;
		}

		// For mode properties, check for domain-specific mode attributes
		if (propertyCategory === PropertyCategory.MODE) {
			// Climate entities use hvac_modes
			if (domain === (HomeAssistantDomain.CLIMATE as string)) {
				const hvacModes = attributes.hvac_modes;
				if (Array.isArray(hvacModes) && hvacModes.length > 0) {
					return hvacModes as string[];
				}
			}

			// Select/input_select entities use options
			const options = attributes.options;
			if (Array.isArray(options) && options.length > 0) {
				return options as string[];
			}
		}

		return null;
	}
}
