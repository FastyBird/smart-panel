import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';

import {
	CHANNEL_VIRTUAL_PROPERTIES,
	DerivationType,
	DerivedVirtualPropertyDefinition,
	ResolvedVirtualProperty,
	VirtualPropertyContext,
	VirtualPropertyDefinition,
	VirtualPropertyType,
	getVirtualPropertiesForChannel,
} from './virtual-property.types';

/**
 * Virtual Property Service for Z2M
 *
 * Handles creation and resolution of virtual properties that are not directly
 * provided by Zigbee2MQTT but can be derived from available data.
 */
@Injectable()
export class Z2mVirtualPropertyService {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'VirtualPropertyService',
	);

	/**
	 * Get virtual properties that should be added to a channel
	 * based on what required properties are missing
	 */
	getMissingVirtualProperties(
		channelCategory: ChannelCategory,
		existingProperties: PropertyCategory[],
		requiredProperties: PropertyCategory[],
		context: VirtualPropertyContext,
	): ResolvedVirtualProperty[] {
		const virtualDefs = getVirtualPropertiesForChannel(channelCategory);
		const resolved: ResolvedVirtualProperty[] = [];

		for (const def of virtualDefs) {
			// Skip if property already exists
			if (existingProperties.includes(def.property_category)) {
				continue;
			}

			// Only add if it's a required property that's missing
			if (!requiredProperties.includes(def.property_category)) {
				continue;
			}

			// Check if we can provide this virtual property
			if (this.canProvideVirtualProperty(def, context)) {
				const value = this.resolveVirtualPropertyValue(def, context);
				resolved.push({
					category: def.property_category,
					value,
					isVirtual: true,
					virtualType: def.virtual_type,
					dataType: def.data_type,
					permissions: def.permissions,
					format: def.format,
					unit: def.unit,
				});

				this.logger.debug(
					`[VIRTUAL] Added virtual property ${def.property_category} for channel ${channelCategory}, value=${value}`,
				);
			}
		}

		return resolved;
	}

	/**
	 * Check if a virtual property can be provided given the context
	 * Note: We always allow virtual properties to be created even if the source
	 * value isn't available yet - the value will be resolved when data arrives.
	 * This is important for battery-powered devices where the battery value
	 * might not be immediately available when generating the mapping preview.
	 */
	private canProvideVirtualProperty(def: VirtualPropertyDefinition, _context: VirtualPropertyContext): boolean {
		// Virtual properties are always available - they will use default values
		// if the source data isn't available yet
		return def.virtual_type === VirtualPropertyType.STATIC || def.virtual_type === VirtualPropertyType.DERIVED;
	}

	/**
	 * Resolve the value of a virtual property
	 */
	resolveVirtualPropertyValue(
		def: VirtualPropertyDefinition,
		context: VirtualPropertyContext,
	): string | number | boolean | null {
		if (def.virtual_type === VirtualPropertyType.STATIC) {
			return def.static_value;
		}

		if (def.virtual_type === VirtualPropertyType.DERIVED) {
			return this.resolveDerivedValue(def, context);
		}

		return null;
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
				return this.deriveBatteryStatus(definition, context, derivation.params);

			case DerivationType.ILLUMINANCE_LEVEL_FROM_DENSITY:
				return this.deriveIlluminanceLevel(definition, context, derivation.params);

			default:
				this.logger.warn(`[VIRTUAL] Unknown derivation type: ${String(derivation.type)}`);
				return null;
		}
	}

	/**
	 * Derive battery status from percentage
	 * Returns: 'ok' or 'low'
	 */
	private deriveBatteryStatus(
		definition: DerivedVirtualPropertyDefinition,
		context: VirtualPropertyContext,
		params?: Record<string, unknown>,
	): 'ok' | 'low' {
		const lowThreshold = (params?.lowThreshold as number) ?? 20;
		const defaultStatus = (params?.defaultStatus as 'ok' | 'low') ?? 'ok';

		// Get battery percentage from Z2M state
		const sourceProperty = definition.source_property ?? 'battery';
		const batteryValue = context.state[sourceProperty];

		if (batteryValue === undefined || batteryValue === null) {
			return defaultStatus;
		}

		const percentage = Number(batteryValue);
		if (isNaN(percentage)) {
			return defaultStatus;
		}

		return percentage <= lowThreshold ? 'low' : 'ok';
	}

	/**
	 * Derive illuminance level from density (LUX value)
	 * Returns: 'bright', 'moderate', 'dusky', or 'dark'
	 */
	private deriveIlluminanceLevel(
		definition: DerivedVirtualPropertyDefinition,
		context: VirtualPropertyContext,
		params?: Record<string, unknown>,
	): 'bright' | 'moderate' | 'dusky' | 'dark' {
		const brightThreshold = (params?.brightThreshold as number) ?? 1000;
		const moderateThreshold = (params?.moderateThreshold as number) ?? 100;
		const duskyThreshold = (params?.duskyThreshold as number) ?? 10;

		// Get illuminance from Z2M state (try source_property, then common variants)
		const sourceProperty = definition.source_property ?? 'illuminance';
		let luxValue = context.state[sourceProperty];

		// Fallback to illuminance_lux if illuminance not found
		if (luxValue === undefined || luxValue === null) {
			luxValue = context.state['illuminance_lux'] ?? context.state['illuminance'];
		}

		if (luxValue === undefined || luxValue === null) {
			return 'dark';
		}

		const lux = Number(luxValue);
		if (isNaN(lux)) {
			return 'dark';
		}

		if (lux >= brightThreshold) {
			return 'bright';
		}
		if (lux >= moderateThreshold) {
			return 'moderate';
		}
		if (lux >= duskyThreshold) {
			return 'dusky';
		}
		return 'dark';
	}

	/**
	 * Get all virtual property definitions for all channels
	 */
	getAllVirtualPropertyDefinitions(): typeof CHANNEL_VIRTUAL_PROPERTIES {
		return CHANNEL_VIRTUAL_PROPERTIES;
	}
}
