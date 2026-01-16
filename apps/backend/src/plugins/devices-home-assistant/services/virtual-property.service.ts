import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { ChannelCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { DEVICES_HOME_ASSISTANT_PLUGIN_NAME } from '../devices-home-assistant.constants';
import {
	AnyDerivation,
	DeviceClassMapDerivation,
	MappingLoaderService,
	ResolvedVirtualProperty,
	StaticDerivation,
	ThresholdDerivation,
	VirtualPropertyType,
} from '../mappings';

import { ResolvedVirtualPropertyValue, VirtualPropertyContext } from './virtual-property.types';

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

	constructor(private readonly mappingLoaderService: MappingLoaderService) {}

	/**
	 * Resolve a virtual property value based on its definition and context
	 */
	resolveVirtualPropertyValue(
		definition: ResolvedVirtualProperty,
		context: VirtualPropertyContext,
	): ResolvedVirtualPropertyValue {
		let value: string | number | boolean | null = null;

		switch (definition.virtualType) {
			case 'static':
				value = this.resolveStaticValue(definition);
				break;

			case 'derived':
				value = this.resolveDerivedValue(definition, context);
				break;

			case 'command':
				// Command properties don't have a readable value
				value = null;
				break;
		}

		return {
			category: definition.propertyCategory,
			value,
			isVirtual: true,
			virtualType: definition.virtualType,
			dataType: definition.dataType,
			permissions: definition.permissions,
			format: definition.format,
			unit: definition.unit,
		};
	}

	/**
	 * Get all virtual properties for a channel category
	 */
	getVirtualPropertiesForChannel(channelCategory: ChannelCategory): ResolvedVirtualProperty[] {
		return this.mappingLoaderService.getVirtualProperties(channelCategory);
	}

	/**
	 * Get missing required virtual properties for a channel
	 * Returns virtual property definitions that can fill gaps in the mapping
	 */
	getMissingVirtualProperties(
		channelCategory: ChannelCategory,
		existingPropertyCategories: Set<PropertyCategory>,
		requiredPropertyCategories: PropertyCategory[],
	): ResolvedVirtualProperty[] {
		const virtualProps = this.mappingLoaderService.getVirtualProperties(channelCategory);
		const missingVirtuals: ResolvedVirtualProperty[] = [];

		for (const required of requiredPropertyCategories) {
			// Skip if already mapped from HA entity
			if (existingPropertyCategories.has(required)) {
				continue;
			}

			// Check if we have a virtual property definition for this
			const virtualDef = virtualProps.find((vp) => vp.propertyCategory === required);
			if (virtualDef) {
				missingVirtuals.push(virtualDef);
			}
		}

		return missingVirtuals;
	}

	/**
	 * Check if a property can be fulfilled by a virtual property
	 */
	canFulfillWithVirtual(channelCategory: ChannelCategory, propertyCategory: PropertyCategory): boolean {
		const virtualProps = this.mappingLoaderService.getVirtualProperties(channelCategory);
		return virtualProps.some((vp) => vp.propertyCategory === propertyCategory);
	}

	/**
	 * Get the virtual property definition for a channel and property
	 */
	getVirtualPropertyDefinition(
		channelCategory: ChannelCategory,
		propertyCategory: PropertyCategory,
	): ResolvedVirtualProperty | null {
		const virtualProps = this.mappingLoaderService.getVirtualProperties(channelCategory);
		return virtualProps.find((vp) => vp.propertyCategory === propertyCategory) ?? null;
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
		const definition = this.getVirtualPropertyDefinition(channelCategory, propertyCategory);

		if (!definition || definition.virtualType !== 'command' || !definition.commandMapping) {
			return null;
		}

		const serviceName = definition.commandMapping.services[commandValue];

		if (!serviceName) {
			this.logger.warn(
				`[VIRTUAL] Unknown command value: channel=${channelCategory}, property=${propertyCategory}, value=${commandValue}`,
			);
			return null;
		}

		return {
			domain: definition.commandMapping.domain,
			service: serviceName,
			entityId,
			data: definition.commandMapping.serviceData,
		};
	}

	/**
	 * Resolve a static virtual property value
	 */
	private resolveStaticValue(definition: ResolvedVirtualProperty): string | number | boolean {
		return definition.staticValue ?? '';
	}

	/**
	 * Resolve a derived virtual property value
	 */
	private resolveDerivedValue(
		definition: ResolvedVirtualProperty,
		context: VirtualPropertyContext,
	): string | number | boolean | null {
		const derivationRule = definition.derivationRule;

		if (!derivationRule) {
			// Try to get derivation by name
			if (definition.derivationName) {
				const namedRule = this.mappingLoaderService.getDerivation(definition.derivationName);
				if (namedRule) {
					return this.applyDerivationRule(namedRule, context);
				}
			}
			this.logger.warn(`[VIRTUAL] No derivation rule found for property: ${definition.propertyCategory}`);
			return null;
		}

		return this.applyDerivationRule(derivationRule, context);
	}

	/**
	 * Apply a derivation rule to resolve a value
	 */
	private applyDerivationRule(rule: AnyDerivation, context: VirtualPropertyContext): string | number | boolean | null {
		switch (rule.type) {
			case 'threshold':
				return this.applyThresholdDerivation(rule, context);

			case 'device_class_map':
				return this.applyDeviceClassMapDerivation(rule, context);

			case 'static':
				return this.applyStaticDerivation(rule);

			default:
				this.logger.warn(`[VIRTUAL] Unknown derivation type: ${(rule as AnyDerivation).type}`);
				return null;
		}
	}

	/**
	 * Apply threshold derivation
	 * Maps numeric ranges to enum values
	 */
	private applyThresholdDerivation(rule: ThresholdDerivation, context: VirtualPropertyContext): string | null {
		// Get the source value (default to state value)
		let sourceValue: number | null = null;

		if (rule.source_property && context.state?.attributes) {
			const attrValue = context.state.attributes[rule.source_property];
			if (typeof attrValue === 'number') {
				sourceValue = attrValue;
			} else if (typeof attrValue === 'string') {
				sourceValue = parseFloat(attrValue);
			}
		}

		// Fall back to main state
		if (sourceValue === null && context.state?.state) {
			sourceValue = parseFloat(String(context.state.state));
		}

		if (sourceValue === null || isNaN(sourceValue)) {
			return rule.default_value ?? null;
		}

		// Find matching threshold (sorted by min/max boundaries)
		for (const threshold of rule.thresholds) {
			const minOk = threshold.min === undefined || sourceValue >= threshold.min;
			const maxOk = threshold.max === undefined || sourceValue <= threshold.max;

			if (minOk && maxOk) {
				return threshold.value;
			}
		}

		return rule.default_value ?? null;
	}

	/**
	 * Apply device class map derivation
	 * Maps HA device class to value
	 */
	private applyDeviceClassMapDerivation(rule: DeviceClassMapDerivation, context: VirtualPropertyContext): string {
		if (context.deviceClass && rule.mapping[context.deviceClass]) {
			return rule.mapping[context.deviceClass];
		}
		return rule.default_value;
	}

	/**
	 * Apply static derivation
	 * Returns a fixed value
	 */
	private applyStaticDerivation(rule: StaticDerivation): string | number | boolean {
		return rule.value;
	}

	/**
	 * Get all virtual properties for a channel with resolved values
	 */
	resolveAllVirtualProperties(
		channelCategory: ChannelCategory,
		context: VirtualPropertyContext,
	): ResolvedVirtualPropertyValue[] {
		const virtualDefs = this.mappingLoaderService.getVirtualProperties(channelCategory);
		return virtualDefs.map((def) => this.resolveVirtualPropertyValue(def, context));
	}

	/**
	 * Check if a virtual property is a command type
	 */
	isCommandProperty(channelCategory: ChannelCategory, propertyCategory: PropertyCategory): boolean {
		const def = this.getVirtualPropertyDefinition(channelCategory, propertyCategory);
		return def?.virtualType === 'command';
	}

	/**
	 * Get the HA attribute name for virtual properties
	 * For virtual properties, this returns a special marker
	 */
	getVirtualAttributeMarker(propertyCategory: PropertyCategory, virtualType: VirtualPropertyType): string {
		return `fb.virtual.${virtualType}.${propertyCategory}`;
	}
}
