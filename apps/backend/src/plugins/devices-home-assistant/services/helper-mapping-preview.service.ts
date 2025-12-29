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
	async generatePreview(entityId: string, options?: HelperMappingPreviewRequestDto): Promise<HelperMappingPreviewModel> {
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
		let channelCategory = options?.channelCategory ?? rule?.channel_category ?? ChannelCategory.GENERIC;
		let deviceCategory = options?.deviceCategory ?? rule?.device_category_hint ?? DeviceCategory.GENERIC;

		// Generate property mappings
		const suggestedProperties: HelperPropertyMappingPreviewModel[] = [];

		if (rule) {
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
					format: this.getFormatFromState(helper.state?.attributes, binding.property_category) ?? propertyMetadata?.format ?? null,
					required: propertyMetadata?.required ?? false,
					currentValue,
				});
			}
		} else {
			// No matching rule, add generic property for state
			suggestedProperties.push({
				category: PropertyCategory.GENERIC,
				name: 'State',
				haAttribute: ENTITY_MAIN_STATE_ATTRIBUTE,
				dataType: DataTypeType.STRING,
				permissions: [PermissionType.READ_WRITE],
				unit: null,
				format: null,
				required: false,
				currentValue: helper.state?.state ?? null,
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

		// Build suggested channel
		const suggestedChannel: HelperChannelMappingPreviewModel = {
			category: channelCategory,
			name: helper.name,
			confidence: rule ? 'medium' : 'low',
			suggestedProperties,
		};

		// Determine if ready to adopt
		const readyToAdopt = suggestedProperties.length > 0;

		this.logger.log(
			`[HELPER MAPPING PREVIEW] Summary for helper "${helper.name}" (${entityId}): ` +
				`domain=${domain}, channel=${channelCategory}, device=${deviceCategory}, ` +
				`properties=${suggestedProperties.length}, ready_to_adopt=${readyToAdopt}`,
		);

		const preview = new HelperMappingPreviewModel();
		preview.helper = helperInfo;
		preview.suggestedDevice = suggestedDevice;
		preview.suggestedChannel = suggestedChannel;
		preview.warnings = warnings;
		preview.readyToAdopt = readyToAdopt;

		return preview;
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
	): (string | number)[] | null {
		if (!attributes) {
			return null;
		}

		// For select/mode properties, check for options attribute
		if (propertyCategory === PropertyCategory.MODE) {
			const options = attributes.options;
			if (Array.isArray(options) && options.length > 0) {
				return options as string[];
			}
		}

		return null;
	}
}
