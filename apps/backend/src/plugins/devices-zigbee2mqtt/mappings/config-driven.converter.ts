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
import { Z2mExpose, Z2mExposeSpecific } from '../interfaces/zigbee2mqtt.interface';

import { MappingLoaderService } from './mapping-loader.service';
import { ResolvedChannel, ResolvedFeature, ResolvedMapping, ResolvedProperty } from './mapping.types';
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

		// Find matching mapping
		const mapping = this.mappingLoader.findMatchingMapping(exposeType, propertyName, features, deviceProperties);

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

		// Find matching mapping
		const mapping = this.mappingLoader.findMatchingMapping(exposeType, propertyName, features, deviceProperties);

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

		return this.createProperty({
			identifier: featureDef.panel.identifier.toLowerCase(),
			name: featureDef.panel.name ?? this.formatName(featureDef.z2mFeature),
			category: featureDef.panel.identifier,
			channelCategory,
			dataType: featureDef.panel.dataType,
			z2mProperty,
			permissions,
			unit: featureDef.panel.unit,
			format: featureDef.panel.format,
		});
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
					format: propDef.panel.format,
				}),
			];
		}

		return properties;
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
	 * Get the mapping for a specific expose
	 */
	getMappingForExpose(expose: Z2mExpose): ResolvedMapping | undefined {
		const exposeType = expose.type;
		const propertyName = this.getPropertyName(expose);

		let features: string[] | undefined;
		if (this.isSpecificExpose(expose)) {
			features = (expose as Z2mExposeSpecific).features?.map((f) => f.property ?? f.name ?? '').filter(Boolean);
		}

		return this.mappingLoader.findMatchingMapping(exposeType, propertyName, features);
	}

	/**
	 * Get runtime property mappings for a device's expose
	 * Used for value transformations during state updates
	 */
	getRuntimeMappings(expose: Z2mExpose): RuntimePropertyMapping[] {
		const mapping = this.getMappingForExpose(expose);
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
	 */
	transformRead(z2mProperty: string, value: unknown, expose?: Z2mExpose): unknown {
		const mappings = expose ? this.getRuntimeMappings(expose) : [];
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
	 */
	transformWrite(panelIdentifier: string, value: unknown, expose?: Z2mExpose): unknown {
		const mappings = expose ? this.getRuntimeMappings(expose) : [];
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
