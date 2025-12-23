import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';

import {
	DerivationType,
	DerivedVirtualPropertyDefinition,
	ResolvedVirtualProperty,
	StaticVirtualPropertyDefinition,
	VirtualPropertyContext,
	VirtualPropertyDefinition,
	VirtualPropertyType,
	getVirtualPropertiesForChannel,
	getVirtualPropertyDefinition,
} from './virtual-property.types';

/**
 * Service for resolving virtual property values and handling virtual commands
 *
 * Virtual properties are properties that don't have a direct mapping to a Home Assistant
 * entity attribute, but are required by the Smart Panel device specification.
 *
 * Types of virtual properties:
 * - Static: Returns a fixed value (e.g., battery charging status = "ok")
 * - Derived: Calculates value from other properties (e.g., battery status from percentage)
 * - Command: Maps to HA service calls (e.g., window covering command -> cover.open_cover)
 */
@Injectable()
export class VirtualPropertyService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_HOME_ASSISTANT_PLUGIN_NAME,
		'VirtualPropertyService',
	);

	/**
	 * Resolve a virtual property value based on its definition and context
	 */
	resolveVirtualPropertyValue(
		definition: VirtualPropertyDefinition,
		context: VirtualPropertyContext,
	): ResolvedVirtualProperty {
		let value: string | number | boolean | null = null;

		switch (definition.virtual_type) {
			case VirtualPropertyType.STATIC:
				value = this.resolveStaticValue(definition);
				break;

			case VirtualPropertyType.DERIVED:
				value = this.resolveDerivedValue(definition, context);
				break;

			case VirtualPropertyType.COMMAND:
				// Command properties don't have a readable value
				value = null;
				break;
		}

		return {
			category: definition.property_category,
			value,
			isVirtual: true,
			virtualType: definition.virtual_type,
			dataType: definition.data_type,
			permissions: definition.permissions,
			format: definition.format,
			unit: definition.unit,
		};
	}

	/**
	 * Get missing required virtual properties for a channel
	 * Returns virtual property definitions that can fill gaps in the mapping
	 */
	getMissingVirtualProperties(
		channelCategory: ChannelCategory,
		existingPropertyCategories: Set<PropertyCategory>,
		requiredPropertyCategories: PropertyCategory[],
	): VirtualPropertyDefinition[] {
		const virtualProps = getVirtualPropertiesForChannel(channelCategory);
		const missingVirtuals: VirtualPropertyDefinition[] = [];

		for (const required of requiredPropertyCategories) {
			// Skip if already mapped from HA entity
			if (existingPropertyCategories.has(required)) {
				continue;
			}

			// Check if we have a virtual property definition for this
			const virtualDef = virtualProps.find((vp) => vp.property_category === required);
			if (virtualDef) {
				missingVirtuals.push(virtualDef);
				this.logger.debug(
					`[VIRTUAL] Found virtual property for missing required: channel=${channelCategory}, property=${required}, type=${virtualDef.virtual_type}`,
				);
			}
		}

		return missingVirtuals;
	}

	/**
	 * Check if a property can be fulfilled by a virtual property
	 */
	canFulfillWithVirtual(channelCategory: ChannelCategory, propertyCategory: PropertyCategory): boolean {
		return getVirtualPropertyDefinition(channelCategory, propertyCategory) !== null;
	}

	/**
	 * Get the HA service call for a command virtual property
	 */
	getServiceCallForCommand(
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
		commandValue: string,
		entityId: string,
	): { domain: string; service: string; entityId: string; data?: Record<string, unknown> } | null {
		const definition = getVirtualPropertyDefinition(channelCategory, propertyCategory);

		if (!definition || definition.virtual_type !== VirtualPropertyType.COMMAND) {
			return null;
		}

		const serviceName = definition.command_mapping.value_to_service[commandValue];

		if (!serviceName) {
			this.logger.warn(
				`[VIRTUAL] Unknown command value: channel=${channelCategory}, property=${propertyCategory}, value=${commandValue}`,
			);
			return null;
		}

		return {
			domain: definition.command_mapping.domain,
			service: serviceName,
			entityId,
			data: definition.command_mapping.service_data,
		};
	}

	/**
	 * Resolve a static virtual property value
	 */
	private resolveStaticValue(definition: StaticVirtualPropertyDefinition): string | number | boolean {
		return definition.static_value;
	}

	/**
	 * Resolve a derived virtual property value
	 */
	private resolveDerivedValue(
		definition: DerivedVirtualPropertyDefinition,
		context: VirtualPropertyContext,
	): string | number | boolean | null {
		const { derivation } = definition;

		switch (derivation.type) {
			case DerivationType.BATTERY_STATUS_FROM_PERCENTAGE:
				return this.deriveBatteryStatus(context, derivation.params);

			case DerivationType.WINDOW_COVERING_TYPE_FROM_DEVICE_CLASS:
				return this.deriveWindowCoveringType(context, derivation.params);

			case DerivationType.WINDOW_COVERING_STATUS_FROM_STATE:
				return this.deriveWindowCoveringStatus(context, derivation.params);

			case DerivationType.STATIC_FALLBACK:
				return this.deriveStaticFallback(context, derivation.params);

			case DerivationType.ILLUMINANCE_LEVEL_FROM_DENSITY:
				return this.deriveIlluminanceLevel(context, derivation.params);

			default:
				this.logger.warn(`[VIRTUAL] Unknown derivation type: ${String(derivation.type)}`);
				return null;
		}
	}

	/**
	 * Derive battery status from percentage
	 * Returns: 'ok', 'low', or 'charging'
	 */
	private deriveBatteryStatus(
		context: VirtualPropertyContext,
		params?: Record<string, unknown>,
	): 'ok' | 'low' | 'charging' {
		const lowThreshold = (params?.lowThreshold as number) ?? 20;
		const defaultStatus = (params?.defaultStatus as 'ok' | 'low' | 'charging') ?? 'ok';

		// Try to get percentage from state
		const state = context.state;
		if (!state) {
			return defaultStatus;
		}

		// Check if the state itself is a percentage
		const stateValue = parseFloat(String(state.state));
		if (!isNaN(stateValue)) {
			if (stateValue <= lowThreshold) {
				return 'low';
			}
			return 'ok';
		}

		// Check for battery level attribute
		const batteryLevel = state.attributes?.battery_level;
		if (typeof batteryLevel === 'number') {
			if (batteryLevel <= lowThreshold) {
				return 'low';
			}
			return 'ok';
		}

		return defaultStatus;
	}

	/**
	 * Derive window covering type from HA device class
	 * Returns: 'curtain', 'blind', 'roller', or 'outdoor_blind'
	 */
	private deriveWindowCoveringType(
		context: VirtualPropertyContext,
		params?: Record<string, unknown>,
	): 'curtain' | 'blind' | 'roller' | 'outdoor_blind' {
		const defaultValue = (params?.defaultValue as 'curtain' | 'blind' | 'roller' | 'outdoor_blind') ?? 'blind';
		const deviceClassMapping = (params?.deviceClassMapping as Record<string, string>) ?? {};

		if (!context.deviceClass) {
			return defaultValue;
		}

		const mappedType = deviceClassMapping[context.deviceClass];
		if (mappedType && ['curtain', 'blind', 'roller', 'outdoor_blind'].includes(mappedType)) {
			return mappedType as 'curtain' | 'blind' | 'roller' | 'outdoor_blind';
		}

		return defaultValue;
	}

	/**
	 * Derive window covering status from HA state
	 * Maps HA states to Smart Panel status values
	 */
	private deriveWindowCoveringStatus(
		context: VirtualPropertyContext,
		params?: Record<string, unknown>,
	): 'opened' | 'closed' | 'opening' | 'closing' | 'stopped' {
		const defaultValue = (params?.defaultValue as 'opened' | 'closed' | 'opening' | 'closing' | 'stopped') ?? 'stopped';

		const state = context.state?.state;
		if (state === undefined || state === null) {
			return defaultValue;
		}

		// HA cover states mapping
		const stateMapping: Record<string, 'opened' | 'closed' | 'opening' | 'closing' | 'stopped'> = {
			open: 'opened',
			opened: 'opened',
			closed: 'closed',
			closing: 'closing',
			opening: 'opening',
			stopped: 'stopped',
		};

		return stateMapping[String(state).toLowerCase()] ?? defaultValue;
	}

	/**
	 * Static fallback derivation - uses device class mapping or default
	 */
	private deriveStaticFallback(
		context: VirtualPropertyContext,
		params?: Record<string, unknown>,
	): string | number | boolean {
		const defaultValue = params?.defaultValue;
		const deviceClassMapping = params?.deviceClassMapping as Record<string, unknown> | undefined;

		// Try device class mapping first
		if (deviceClassMapping && context.deviceClass) {
			const mappedValue = deviceClassMapping[context.deviceClass];
			if (mappedValue !== undefined) {
				return mappedValue as string | number | boolean;
			}
		}

		// Fall back to default
		if (defaultValue !== undefined) {
			return defaultValue as string | number | boolean;
		}

		return '';
	}

	/**
	 * Derive illuminance level from density (LUX value)
	 * Returns: 'bright', 'moderate', 'dusky', or 'dark'
	 */
	private deriveIlluminanceLevel(
		context: VirtualPropertyContext,
		params?: Record<string, unknown>,
	): 'bright' | 'moderate' | 'dusky' | 'dark' {
		// Default thresholds in LUX
		const brightThreshold = (params?.brightThreshold as number) ?? 1000;
		const moderateThreshold = (params?.moderateThreshold as number) ?? 100;
		const duskyThreshold = (params?.duskyThreshold as number) ?? 10;

		// Try to get density (LUX) from state
		const state = context.state;
		if (!state) {
			return 'moderate'; // Default when no data
		}

		// The state value should be the LUX reading
		const luxValue = parseFloat(String(state.state));

		if (isNaN(luxValue)) {
			return 'moderate'; // Default when value is invalid
		}

		// Determine level based on thresholds
		if (luxValue >= brightThreshold) {
			return 'bright';
		} else if (luxValue >= moderateThreshold) {
			return 'moderate';
		} else if (luxValue >= duskyThreshold) {
			return 'dusky';
		} else {
			return 'dark';
		}
	}

	/**
	 * Get all virtual properties for a channel with resolved values
	 */
	resolveAllVirtualProperties(
		channelCategory: ChannelCategory,
		context: VirtualPropertyContext,
	): ResolvedVirtualProperty[] {
		const virtualDefs = getVirtualPropertiesForChannel(channelCategory);
		return virtualDefs.map((def) => this.resolveVirtualPropertyValue(def, context));
	}

	/**
	 * Check if a virtual property is a command type
	 */
	isCommandProperty(channelCategory: ChannelCategory, propertyCategory: PropertyCategory): boolean {
		const def = getVirtualPropertyDefinition(channelCategory, propertyCategory);
		return def?.virtual_type === VirtualPropertyType.COMMAND;
	}

	/**
	 * Get the HA attribute name for virtual properties
	 * For virtual properties, this returns a special marker
	 */
	getVirtualAttributeMarker(propertyCategory: PropertyCategory, virtualType: VirtualPropertyType): string {
		return `fb.virtual.${virtualType}.${propertyCategory}`;
	}
}
