/**
 * Config-Driven Converter
 *
 * Converter that uses YAML mapping definitions to convert Z2M exposes
 * to Smart Panel channels and properties.
 */
import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { BaseConverter } from '../converters/base.converter';
import {
	CanHandleResult,
	ConversionContext,
	IConverter,
	MappedChannel,
	MappedProperty,
} from '../converters/converter.interface';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, Z2M_ACCESS } from '../devices-zigbee2mqtt.constants';
import { Z2mExpose, Z2mExposeEnum, Z2mExposeNumeric, Z2mExposeSpecific } from '../interfaces/zigbee2mqtt.interface';

import { MappingLoaderService } from './mapping-loader.service';
import {
	AnyDerivation,
	ResolvedChannel,
	ResolvedDerivedProperty,
	ResolvedFeature,
	ResolvedMapping,
	ResolvedProperty,
	ResolvedStaticProperty,
} from './mapping.types';
import { ITransformer, TransformContext, TransformerRegistry } from './transformers';

/**
 * Property mapping with transformer for runtime use
 */
export interface RuntimePropertyMapping {
	z2mProperty: string;
	panelIdentifier: string;
	panelCategory: PropertyCategory;
	channelCategory: ChannelCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	transformer: ITransformer;
	name?: string;
	unit?: string;
	format?: number[] | string[];
}

/**
 * Config-driven converter that uses YAML mapping definitions
 */
@Injectable()
export class ConfigDrivenConverter extends BaseConverter implements IConverter {
	readonly type = 'config-driven';

	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'ConfigDrivenConverter',
	);

	constructor(
		private readonly mappingLoader: MappingLoaderService,
		private readonly transformerRegistry: TransformerRegistry,
	) {
		super();
	}

	canHandle(expose: Z2mExpose, context?: ConversionContext): CanHandleResult {
		const exposeType = expose.type;
		const propertyName = this.getPropertyName(expose);

		// Get features from specific exposes
		let features: string[] | undefined;
		if (this.isSpecificExpose(expose)) {
			features = (expose as Z2mExposeSpecific).features?.map((f) => f.property ?? f.name ?? '').filter(Boolean);
		}

		// Extract all property names from device (for any_property matching)
		const deviceProperties = context?.allExposes
			?.map((e) => e.property ?? e.name)
			.filter((p): p is string => p !== undefined);

		// Determine if this expose is part of a multi-endpoint array
		// (e.g., device has 2 lights with endpoints l1, l2)
		const isListExpose = this.isListExpose(expose, context?.allExposes);

		// Find matching mapping
		const mapping = this.mappingLoader.findMatchingMapping(
			exposeType,
			propertyName,
			features,
			deviceProperties,
			isListExpose,
		);

		if (mapping) {
			// Return priority from mapping
			return this.canHandleWith(mapping.priority);
		}

		return this.cannotHandle();
	}

	convert(expose: Z2mExpose, context: ConversionContext): MappedChannel[] {
		const exposeType = expose.type;
		const propertyName = this.getPropertyName(expose);

		// Get features from specific exposes
		let features: string[] | undefined;
		if (this.isSpecificExpose(expose)) {
			features = (expose as Z2mExposeSpecific).features?.map((f) => f.property ?? f.name ?? '').filter(Boolean);
		}

		// Extract all property names from device (for any_property matching)
		const deviceProperties = context.allExposes
			.map((e) => e.property ?? e.name)
			.filter((p): p is string => p !== undefined);

		// Determine if this expose is part of a multi-endpoint array
		const isListExpose = this.isListExpose(expose, context.allExposes);

		// Find matching mapping
		const mapping = this.mappingLoader.findMatchingMapping(
			exposeType,
			propertyName,
			features,
			deviceProperties,
			isListExpose,
		);

		if (!mapping) {
			return [];
		}

		this.logger.debug(`Converting expose '${propertyName ?? exposeType}' using mapping '${mapping.name}'`);

		const channels: MappedChannel[] = [];

		for (const channelDef of mapping.channels) {
			const channel = this.convertChannel(channelDef, expose, context);
			if (channel && channel.properties.length > 0) {
				channels.push(channel);
			}
		}

		return channels;
	}

	/**
	 * Convert a channel definition to MappedChannel
	 */
	private convertChannel(
		channelDef: ResolvedChannel,
		expose: Z2mExpose,
		context: ConversionContext,
	): MappedChannel | null {
		const endpoint = (expose as Z2mExposeSpecific).endpoint;

		// Handle endpoint in identifier
		let identifier = channelDef.identifier;
		if (endpoint) {
			if (identifier.includes('{endpoint}')) {
				// Replace template if present
				identifier = identifier.replace('{endpoint}', endpoint);
			} else {
				// Append endpoint if no template
				identifier = `${identifier}_${endpoint}`;
			}
		}

		const properties: MappedProperty[] = [];

		// Process features (for structured exposes like light, climate)
		if (channelDef.features && this.isSpecificExpose(expose)) {
			const specificExpose = expose as Z2mExposeSpecific;
			const featureProperties = this.processFeatures(channelDef.features, specificExpose, channelDef.category, context);
			properties.push(...featureProperties);
		}

		// Process properties (for generic exposes like sensors)
		if (channelDef.properties) {
			const propMappings = this.processProperties(channelDef.properties, expose, channelDef.category);
			properties.push(...propMappings);
		}

		// Process static properties (fixed values)
		if (channelDef.staticProperties) {
			const staticProps = this.processStaticProperties(channelDef.staticProperties, channelDef.category);
			properties.push(...staticProps);
		}

		// Process derived properties (calculated from other properties)
		if (channelDef.derivedProperties) {
			const derivedProps = this.processDerivedProperties(channelDef.derivedProperties, channelDef.category, properties);
			properties.push(...derivedProps);
		}

		if (properties.length === 0) {
			return null;
		}

		return this.createChannel({
			identifier,
			name: channelDef.name ?? this.formatName(identifier),
			category: channelDef.category,
			endpoint,
			properties,
			parentIdentifier: channelDef.parentIdentifier,
		});
	}

	/**
	 * Process feature mappings for structured exposes
	 */
	private processFeatures(
		featureDefs: ResolvedFeature[],
		expose: Z2mExposeSpecific,
		channelCategory: ChannelCategory,
		_context: ConversionContext,
	): MappedProperty[] {
		const properties: MappedProperty[] = [];
		const features = expose.features ?? [];
		// Track seen identifiers to prevent duplicates (e.g., occupied_heating_setpoint and
		// current_heating_setpoint both mapping to HEATING_THRESHOLD_TEMPERATURE)
		const seenIdentifiers = new Set<string>();

		for (const featureDef of featureDefs) {
			// Find matching feature in expose
			const feature = this.findFeature({ features }, featureDef.z2mFeature);

			if (!feature) {
				continue;
			}

			// Handle composite features (like color with hue/saturation)
			if (featureDef.type === 'composite' && featureDef.nestedFeatures) {
				const nestedProps = this.processNestedFeatures(
					featureDef.nestedFeatures,
					feature,
					channelCategory,
					seenIdentifiers,
				);
				properties.push(...nestedProps);
				continue;
			}

			// Skip if this panel identifier was already used (first match wins)
			const panelIdentifier = featureDef.panel?.identifier.toLowerCase();
			if (panelIdentifier && seenIdentifiers.has(panelIdentifier)) {
				this.logger.debug(`Skipping duplicate property '${panelIdentifier}' from feature '${featureDef.z2mFeature}'`);
				continue;
			}

			// Create property mapping
			const property = this.createPropertyFromFeature(featureDef, feature, channelCategory);
			if (property) {
				properties.push(property);
				seenIdentifiers.add(property.identifier);
			}
		}

		return properties;
	}

	/**
	 * Process nested features (for composites like color)
	 */
	private processNestedFeatures(
		nestedDefs: ResolvedFeature[],
		parentFeature: Z2mExpose,
		channelCategory: ChannelCategory,
		seenIdentifiers: Set<string>,
	): MappedProperty[] {
		const properties: MappedProperty[] = [];

		// Check if parent has features (composite)
		const parentFeatures = (parentFeature as Z2mExposeSpecific).features ?? [];

		for (const nestedDef of nestedDefs) {
			const nestedFeature = parentFeatures.find(
				(f) => f.property === nestedDef.z2mFeature || f.name === nestedDef.z2mFeature,
			);

			if (!nestedFeature) {
				continue;
			}

			// Skip if this panel identifier was already used (first match wins)
			const panelIdentifier = nestedDef.panel?.identifier.toLowerCase();
			if (panelIdentifier && seenIdentifiers.has(panelIdentifier)) {
				this.logger.debug(
					`Skipping duplicate nested property '${panelIdentifier}' from feature '${nestedDef.z2mFeature}'`,
				);
				continue;
			}

			// For color composite, z2mProperty should be 'color' (parent), not the nested property
			const property = this.createPropertyFromFeature(
				nestedDef,
				nestedFeature,
				channelCategory,
				parentFeature.property,
			);
			if (property) {
				properties.push(property);
				seenIdentifiers.add(property.identifier);
			}
		}

		return properties;
	}

	/**
	 * Create a MappedProperty from a feature definition
	 */
	private createPropertyFromFeature(
		featureDef: ResolvedFeature,
		feature: Z2mExpose,
		channelCategory: ChannelCategory,
		parentProperty?: string,
	): MappedProperty | null {
		// Skip composite features without panel (they use nested_features instead)
		if (!featureDef.panel) {
			return null;
		}

		// Determine permissions based on direction and Z2M access
		const permissions = this.getPermissions(featureDef.direction, feature.access);

		// Determine the z2m property name
		// For nested features (like hue inside color), use the parent property name
		const z2mProperty = parentProperty ?? feature.property ?? feature.name ?? featureDef.z2mFeature;

		// Determine format - derive from device's actual values when available
		let format = featureDef.panel.format;
		if (featureDef.panel.dataType === DataTypeType.ENUM && this.isEnumExpose(feature)) {
			format = this.deriveEnumFormat(feature, featureDef);
		} else if (this.isNumericDataType(featureDef.panel.dataType) && this.isNumericExpose(feature)) {
			format = this.deriveNumericFormat(feature, featureDef);
		}

		return this.createProperty({
			identifier: featureDef.panel.identifier.toLowerCase(),
			name: featureDef.panel.name ?? this.formatName(featureDef.z2mFeature),
			category: featureDef.panel.identifier,
			channelCategory,
			dataType: featureDef.panel.dataType,
			z2mProperty,
			permissions,
			unit: featureDef.panel.unit,
			format,
		});
	}

	/**
	 * Check if an expose is an enum type with values array
	 */
	private isEnumExpose(expose: Z2mExpose): expose is Z2mExposeEnum {
		return expose.type === 'enum' && 'values' in expose && Array.isArray(expose.values);
	}

	/**
	 * Derive enum format from device's actual values, applying transformer if defined
	 */
	private deriveEnumFormat(expose: Z2mExposeEnum, featureDef: ResolvedFeature): string[] {
		const deviceValues = expose.values;

		// If no transformer, use device values as-is
		if (!featureDef.transformerName && !featureDef.inlineTransform) {
			return deviceValues;
		}

		// Get transformer and apply read mapping to each value
		const transformer = this.transformerRegistry.getOrCreate(featureDef.transformerName, featureDef.inlineTransform);
		return deviceValues.map((value) => {
			const transformed = transformer.read(value);
			// Transformer should return string/number/boolean for enums
			if (typeof transformed === 'string') {
				return transformed;
			}
			if (typeof transformed === 'number' || typeof transformed === 'boolean') {
				return String(transformed);
			}
			// Fall back to original value if transformer returns unsupported type
			return value;
		});
	}

	/**
	 * Check if a data type is numeric
	 */
	private isNumericDataType(dataType: DataTypeType): boolean {
		return [
			DataTypeType.CHAR,
			DataTypeType.UCHAR,
			DataTypeType.SHORT,
			DataTypeType.USHORT,
			DataTypeType.INT,
			DataTypeType.UINT,
			DataTypeType.FLOAT,
		].includes(dataType);
	}

	/**
	 * Check if an expose is a numeric type with value_min/value_max
	 */
	private isNumericExpose(expose: Z2mExpose): expose is Z2mExposeNumeric {
		return expose.type === 'numeric';
	}

	/**
	 * Derive numeric format from device's actual range, applying transformer if defined
	 * Returns [min, max] array representing the device's supported range
	 */
	private deriveNumericFormat(expose: Z2mExposeNumeric, featureDef: ResolvedFeature): [number, number] | undefined {
		// If device doesn't specify range, fall back to spec format
		if (expose.value_min === undefined && expose.value_max === undefined) {
			return featureDef.panel.format as [number, number] | undefined;
		}

		// Get device's range (use spec format as fallback for missing bounds)
		const specFormat = featureDef.panel.format as [number, number] | undefined;
		let min = expose.value_min ?? specFormat?.[0];
		let max = expose.value_max ?? specFormat?.[1];

		// If still no bounds, return undefined
		if (min === undefined && max === undefined) {
			return undefined;
		}

		// Apply transformer to the range if defined
		if (featureDef.transformerName || featureDef.inlineTransform) {
			const transformer = this.transformerRegistry.getOrCreate(featureDef.transformerName, featureDef.inlineTransform);
			if (min !== undefined) {
				const transformedMin = transformer.read(min);
				if (typeof transformedMin === 'number') {
					min = transformedMin;
				}
			}
			if (max !== undefined) {
				const transformedMax = transformer.read(max);
				if (typeof transformedMax === 'number') {
					max = transformedMax;
				}
			}
		}

		// Return the range, handling cases where only one bound is defined
		if (min !== undefined && max !== undefined) {
			return [min, max];
		}
		return undefined;
	}

	/**
	 * Process property mappings for generic exposes
	 */
	private processProperties(
		propDefs: ResolvedProperty[],
		expose: Z2mExpose,
		channelCategory: ChannelCategory,
	): MappedProperty[] {
		const properties: MappedProperty[] = [];

		for (const propDef of propDefs) {
			// For generic exposes, check if this property matches
			const exposeProp = expose.property ?? expose.name;
			if (exposeProp !== propDef.z2mProperty) {
				continue;
			}

			const permissions = this.getPermissions(propDef.direction, expose.access);

			// Derive format from device's actual values when available
			let format = propDef.panel.format;
			if (propDef.panel.dataType === DataTypeType.ENUM && this.isEnumExpose(expose)) {
				format = this.deriveEnumFormatForProperty(expose, propDef);
			} else if (this.isNumericDataType(propDef.panel.dataType) && this.isNumericExpose(expose)) {
				format = this.deriveNumericFormatForProperty(expose, propDef);
			}

			return [
				this.createProperty({
					identifier: propDef.panel.identifier.toLowerCase(),
					name: propDef.panel.name ?? this.formatName(propDef.z2mProperty),
					category: propDef.panel.identifier,
					channelCategory,
					dataType: propDef.panel.dataType,
					z2mProperty: propDef.z2mProperty,
					permissions,
					unit: propDef.panel.unit,
					format,
				}),
			];
		}

		return properties;
	}

	/**
	 * Process static properties (fixed values)
	 */
	private processStaticProperties(
		staticDefs: ResolvedStaticProperty[],
		channelCategory: ChannelCategory,
	): MappedProperty[] {
		const properties: MappedProperty[] = [];

		for (const staticDef of staticDefs) {
			properties.push(
				this.createProperty({
					identifier: staticDef.identifier.toLowerCase(),
					name: staticDef.name ?? this.formatName(staticDef.identifier),
					category: staticDef.identifier,
					channelCategory,
					dataType: staticDef.dataType,
					z2mProperty: `__static_${staticDef.identifier.toLowerCase()}`,
					permissions: [PermissionType.READ_ONLY],
					unit: staticDef.unit,
					format: staticDef.format,
					// Store the static value as metadata
					// This will be used during state updates to provide the fixed value
				}),
			);
		}

		return properties;
	}

	/**
	 * Process derived properties (calculated from other properties)
	 */
	private processDerivedProperties(
		derivedDefs: ResolvedDerivedProperty[],
		channelCategory: ChannelCategory,
		existingProperties: MappedProperty[],
	): MappedProperty[] {
		const properties: MappedProperty[] = [];

		for (const derivedDef of derivedDefs) {
			// Check if source property exists in the channel
			const sourceExists = existingProperties.some(
				(p) => p.category.toLowerCase() === derivedDef.sourceProperty.toLowerCase(),
			);

			if (!sourceExists) {
				this.logger.debug(
					`Skipping derived property '${derivedDef.identifier}': source property '${derivedDef.sourceProperty}' not found`,
				);
				continue;
			}

			properties.push(
				this.createProperty({
					identifier: derivedDef.identifier.toLowerCase(),
					name: derivedDef.name ?? this.formatName(derivedDef.identifier),
					category: derivedDef.identifier,
					channelCategory,
					dataType: derivedDef.dataType,
					z2mProperty: `__derived_${derivedDef.identifier.toLowerCase()}`,
					permissions: [PermissionType.READ_ONLY],
					unit: derivedDef.unit,
					format: derivedDef.format,
					// Derivation metadata is stored in the resolved mapping and used at runtime
				}),
			);
		}

		return properties;
	}

	/**
	 * Apply derivation rule to calculate derived value from source value
	 */
	applyDerivation(derivation: AnyDerivation, sourceValue: unknown): string | null {
		switch (derivation.type) {
			case 'threshold':
				return this.applyThresholdDerivation(derivation, sourceValue);
			case 'boolean_map':
				return this.applyBooleanDerivation(derivation, sourceValue);
			case 'position_status':
				return this.applyPositionStatusDerivation(derivation, sourceValue);
			default:
				return null;
		}
	}

	/**
	 * Apply threshold-based derivation
	 */
	private applyThresholdDerivation(
		derivation: { type: 'threshold'; thresholds: { min?: number; max?: number; value: string }[] },
		sourceValue: unknown,
	): string | null {
		if (typeof sourceValue !== 'number') {
			return null;
		}

		for (const threshold of derivation.thresholds) {
			const meetsMin = threshold.min === undefined || sourceValue >= threshold.min;
			const meetsMax = threshold.max === undefined || sourceValue <= threshold.max;

			if (meetsMin && meetsMax) {
				return threshold.value;
			}
		}

		// Return last threshold value as default (threshold with no min/max)
		const defaultThreshold = derivation.thresholds.find((t) => t.min === undefined && t.max === undefined);
		return defaultThreshold?.value ?? null;
	}

	/**
	 * Apply boolean-based derivation
	 */
	private applyBooleanDerivation(
		derivation: { type: 'boolean_map'; true_value: string; false_value: string },
		sourceValue: unknown,
	): string {
		// Coerce to boolean
		const boolValue = Boolean(sourceValue);
		return boolValue ? derivation.true_value : derivation.false_value;
	}

	/**
	 * Apply position-to-status derivation
	 */
	private applyPositionStatusDerivation(
		derivation: { type: 'position_status'; closed_value: string; opened_value: string; partial_value?: string },
		sourceValue: unknown,
	): string {
		if (typeof sourceValue !== 'number') {
			return derivation.closed_value;
		}

		if (sourceValue <= 0) {
			return derivation.closed_value;
		}
		if (sourceValue >= 100) {
			return derivation.opened_value;
		}
		return derivation.partial_value ?? derivation.closed_value;
	}

	/**
	 * Derive enum format for property mapping
	 */
	private deriveEnumFormatForProperty(expose: Z2mExposeEnum, propDef: ResolvedProperty): string[] {
		const deviceValues = expose.values;

		if (!propDef.transformerName && !propDef.inlineTransform) {
			return deviceValues;
		}

		const transformer = this.transformerRegistry.getOrCreate(propDef.transformerName, propDef.inlineTransform);
		return deviceValues.map((value) => {
			const transformed = transformer.read(value);
			if (typeof transformed === 'string') {
				return transformed;
			}
			if (typeof transformed === 'number' || typeof transformed === 'boolean') {
				return String(transformed);
			}
			return value;
		});
	}

	/**
	 * Derive numeric format for property mapping
	 */
	private deriveNumericFormatForProperty(
		expose: Z2mExposeNumeric,
		propDef: ResolvedProperty,
	): [number, number] | undefined {
		if (expose.value_min === undefined && expose.value_max === undefined) {
			return propDef.panel.format as [number, number] | undefined;
		}

		const specFormat = propDef.panel.format as [number, number] | undefined;
		let min = expose.value_min ?? specFormat?.[0];
		let max = expose.value_max ?? specFormat?.[1];

		if (min === undefined && max === undefined) {
			return undefined;
		}

		if (propDef.transformerName || propDef.inlineTransform) {
			const transformer = this.transformerRegistry.getOrCreate(propDef.transformerName, propDef.inlineTransform);
			if (min !== undefined) {
				const transformedMin = transformer.read(min);
				if (typeof transformedMin === 'number') {
					min = transformedMin;
				}
			}
			if (max !== undefined) {
				const transformedMax = transformer.read(max);
				if (typeof transformedMax === 'number') {
					max = transformedMax;
				}
			}
		}

		if (min !== undefined && max !== undefined) {
			return [min, max];
		}
		return undefined;
	}

	/**
	 * Get permissions based on direction and Z2M access bits
	 */
	private getPermissions(direction: string, access?: number): PermissionType[] {
		// First check direction constraints
		if (direction === 'read_only') {
			return [PermissionType.READ_ONLY];
		}
		if (direction === 'write_only') {
			return [PermissionType.WRITE_ONLY];
		}

		// For bidirectional, use Z2M access bits
		return this.mapAccessToPermissions(access ?? Z2M_ACCESS.STATE);
	}

	/**
	 * Check if expose is a specific type (light, switch, etc.)
	 */
	private isSpecificExpose(expose: Z2mExpose): boolean {
		return ['light', 'switch', 'fan', 'cover', 'lock', 'climate'].includes(expose.type);
	}

	/**
	 * Check if an expose is part of a multi-endpoint array
	 * Returns true if the device has multiple exposes of the same type (e.g., 2 lights with endpoints l1, l2)
	 */
	private isListExpose(expose: Z2mExpose, allExposes?: Z2mExpose[]): boolean {
		if (!allExposes) {
			return false;
		}
		const sameTypeExposes = allExposes.filter((e) => e.type === expose.type);
		return sameTypeExposes.length > 1;
	}

	/**
	 * Get the mapping for a specific expose
	 * @param expose - The expose to get mapping for
	 * @param allExposes - Optional array of all device exposes (needed for any_property and is_list conditions)
	 */
	getMappingForExpose(expose: Z2mExpose, allExposes?: Z2mExpose[]): ResolvedMapping | undefined {
		const exposeType = expose.type;
		const propertyName = this.getPropertyName(expose);

		let features: string[] | undefined;
		if (this.isSpecificExpose(expose)) {
			features = (expose as Z2mExposeSpecific).features?.map((f) => f.property ?? f.name ?? '').filter(Boolean);
		}

		// Extract device properties for any_property matching
		const deviceProperties = allExposes?.map((e) => e.property ?? e.name).filter((p): p is string => p !== undefined);

		// Determine if this expose is part of a multi-endpoint array
		const isListExpose = this.isListExpose(expose, allExposes);

		return this.mappingLoader.findMatchingMapping(exposeType, propertyName, features, deviceProperties, isListExpose);
	}

	/**
	 * Get runtime property mappings for a device's expose
	 * Used for value transformations during state updates
	 * @param expose - The expose to get mappings for
	 * @param allExposes - Optional array of all device exposes (needed for any_property and is_list conditions)
	 */
	getRuntimeMappings(expose: Z2mExpose, allExposes?: Z2mExpose[]): RuntimePropertyMapping[] {
		const mapping = this.getMappingForExpose(expose, allExposes);
		if (!mapping) {
			return [];
		}

		const runtimeMappings: RuntimePropertyMapping[] = [];

		for (const channel of mapping.channels) {
			// Process features
			if (channel.features) {
				for (const feature of channel.features) {
					if (feature.type === 'composite' && feature.nestedFeatures) {
						// Handle nested features
						for (const nested of feature.nestedFeatures) {
							// Skip nested features without panel (shouldn't happen, but be safe)
							if (!nested.panel) {
								continue;
							}
							const transformer = this.transformerRegistry.getOrCreate(nested.transformerName, nested.inlineTransform);
							runtimeMappings.push({
								z2mProperty: feature.z2mFeature, // Parent property (e.g., 'color')
								panelIdentifier: nested.panel.identifier.toLowerCase(),
								panelCategory: nested.panel.identifier,
								channelCategory: channel.category,
								dataType: nested.panel.dataType,
								permissions: this.getPermissions(nested.direction, Z2M_ACCESS.STATE | Z2M_ACCESS.SET),
								transformer,
								name: nested.panel.name,
								unit: nested.panel.unit,
								format: nested.panel.format,
							});
						}
					} else {
						// Skip features without panel (composite features without nested_features)
						if (!feature.panel) {
							continue;
						}
						const transformer = this.transformerRegistry.getOrCreate(feature.transformerName, feature.inlineTransform);
						runtimeMappings.push({
							z2mProperty: feature.z2mFeature,
							panelIdentifier: feature.panel.identifier.toLowerCase(),
							panelCategory: feature.panel.identifier,
							channelCategory: channel.category,
							dataType: feature.panel.dataType,
							permissions: this.getPermissions(feature.direction, Z2M_ACCESS.STATE | Z2M_ACCESS.SET),
							transformer,
							name: feature.panel.name,
							unit: feature.panel.unit,
							format: feature.panel.format,
						});
					}
				}
			}

			// Process properties
			if (channel.properties) {
				for (const prop of channel.properties) {
					const transformer = this.transformerRegistry.getOrCreate(prop.transformerName, prop.inlineTransform);
					runtimeMappings.push({
						z2mProperty: prop.z2mProperty,
						panelIdentifier: prop.panel.identifier.toLowerCase(),
						panelCategory: prop.panel.identifier,
						channelCategory: channel.category,
						dataType: prop.panel.dataType,
						permissions: this.getPermissions(prop.direction, Z2M_ACCESS.STATE),
						transformer,
						name: prop.panel.name,
						unit: prop.panel.unit,
						format: prop.panel.format,
					});
				}
			}
		}

		return runtimeMappings;
	}

	/**
	 * Transform a value from Z2M format to Panel format (read)
	 * @param z2mProperty - The Z2M property name
	 * @param value - The value to transform
	 * @param expose - Optional expose for context
	 * @param allExposes - Optional array of all device exposes (needed for any_property and is_list conditions)
	 */
	transformRead(z2mProperty: string, value: unknown, expose?: Z2mExpose, allExposes?: Z2mExpose[]): unknown {
		const mappings = expose ? this.getRuntimeMappings(expose, allExposes) : [];
		const mapping = mappings.find((m) => m.z2mProperty === z2mProperty);

		if (mapping) {
			const context: TransformContext = {
				propertyIdentifier: mapping.panelIdentifier,
				expose: expose ? this.extractExposeMetadata(expose) : undefined,
			};
			return mapping.transformer.read(value, context);
		}

		return value;
	}

	/**
	 * Extract metadata from expose for transform context
	 */
	private extractExposeMetadata(expose: Z2mExpose): TransformContext['expose'] {
		// Use type narrowing for numeric exposes
		if (expose.type === 'numeric') {
			return {
				value_min: expose.value_min,
				value_max: expose.value_max,
				unit: expose.unit,
			};
		}
		// For enum exposes
		if (expose.type === 'enum') {
			return {
				values: expose.values,
			};
		}
		return undefined;
	}

	/**
	 * Transform a value from Panel format to Z2M format (write)
	 * @param panelIdentifier - The Panel property identifier
	 * @param value - The value to transform
	 * @param expose - Optional expose for context
	 * @param allExposes - Optional array of all device exposes (needed for any_property and is_list conditions)
	 */
	transformWrite(panelIdentifier: string, value: unknown, expose?: Z2mExpose, allExposes?: Z2mExpose[]): unknown {
		const mappings = expose ? this.getRuntimeMappings(expose, allExposes) : [];
		const mapping = mappings.find((m) => m.panelIdentifier === panelIdentifier.toLowerCase());

		if (mapping) {
			const context: TransformContext = {
				propertyIdentifier: mapping.panelIdentifier,
			};
			return mapping.transformer.write(value, context);
		}

		return value;
	}
}
