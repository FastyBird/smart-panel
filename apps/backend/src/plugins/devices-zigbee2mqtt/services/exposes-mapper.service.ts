import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import { ConversionContext, ConverterRegistry } from '../converters';
import {
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	Z2M_GENERIC_TYPES,
	Z2M_SPECIFIC_TYPES,
} from '../devices-zigbee2mqtt.constants';
import { Z2mExpose } from '../interfaces/zigbee2mqtt.interface';
import { ConfigDrivenConverter } from '../mappings/config-driven.converter';

/**
 * Mapped channel structure
 */
export interface MappedChannel {
	identifier: string;
	name: string;
	category: ChannelCategory;
	endpoint?: string;
	properties: MappedProperty[];
	/**
	 * Identifier of the parent channel (for hierarchical relationships like power monitoring per switch)
	 * This is resolved to actual channel ID during creation
	 */
	parentIdentifier?: string;
}

/**
 * Mapped property structure
 */
export interface MappedProperty {
	identifier: string;
	name: string;
	category: PropertyCategory;
	channelCategory: ChannelCategory;
	dataType: DataTypeType;
	permissions: PermissionType[];
	z2mProperty: string;
	unit?: string;
	format?: string[] | number[];
	min?: number;
	max?: number;
	step?: number;
}

/**
 * Exposes Mapper Service
 *
 * Maps Zigbee2MQTT exposes structure to Smart Panel channels and properties.
 *
 * Uses a config-driven converter architecture where all device mappings
 * are defined in YAML configuration files. This allows users to add support
 * for new devices without modifying the source code.
 *
 * YAML mappings are loaded from:
 * - Built-in: src/plugins/devices-zigbee2mqtt/mappings/definitions/
 * - User-defined: var/data/zigbee/mappings/ (higher priority)
 */
@Injectable()
export class Z2mExposesMapperService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'ExposesMapper',
	);

	private readonly converterRegistry: ConverterRegistry;

	constructor(private readonly configDrivenConverter: ConfigDrivenConverter) {
		this.converterRegistry = new ConverterRegistry();
	}

	/**
	 * Initialize and register the config-driven converter
	 */
	onModuleInit(): void {
		this.registerConverters();
	}

	/**
	 * Register the config-driven converter with the registry
	 * All device mappings are now defined in YAML configuration files
	 */
	private registerConverters(): void {
		// Register the config-driven converter (YAML mappings)
		this.converterRegistry.register(this.configDrivenConverter);
		this.logger.log('Config-driven converter registered (YAML mappings enabled)');

		this.converterRegistry.markInitialized();
		this.logger.log('Converter registry initialized with config-driven mappings');
	}

	/**
	 * Map Z2M exposes to channels and properties
	 *
	 * @param exposes - Array of Z2M exposes to convert
	 * @param deviceInfo - Optional device info for context
	 */
	mapExposes(exposes: Z2mExpose[], deviceInfo?: { ieeeAddress?: string; friendlyName?: string }): MappedChannel[] {
		const context: ConversionContext = {
			ieeeAddress: deviceInfo?.ieeeAddress ?? '',
			friendlyName: deviceInfo?.friendlyName ?? '',
			allExposes: exposes,
			mappedProperties: new Set<string>(),
		};

		// First, handle specific exposes (light, switch, etc.) which have features
		const specificExposes = exposes.filter((e) =>
			Z2M_SPECIFIC_TYPES.includes(e.type as (typeof Z2M_SPECIFIC_TYPES)[number]),
		);

		// Then, handle generic exposes (binary, numeric, etc.)
		const genericExposes = exposes.filter((e) =>
			Z2M_GENERIC_TYPES.includes(e.type as (typeof Z2M_GENERIC_TYPES)[number]),
		);

		// Convert specific exposes first (they have higher priority)
		const channels = this.converterRegistry.convertAll(specificExposes, context);

		// Then convert generic exposes, which will merge into existing channels or create new ones
		const genericChannels = this.converterRegistry.convertAll(genericExposes, context);

		// Merge generic channels with specific channels
		for (const channel of genericChannels) {
			const existingChannel = channels.find((c) => c.identifier === channel.identifier);
			if (existingChannel) {
				// Add new properties to existing channel
				for (const prop of channel.properties) {
					if (!existingChannel.properties.some((p) => p.identifier === prop.identifier)) {
						existingChannel.properties.push(prop);
					}
				}
			} else {
				channels.push(channel);
			}
		}

		return channels;
	}

	/**
	 * Get the config-driven converter for runtime transformations
	 */
	getConfigDrivenConverter(): ConfigDrivenConverter {
		return this.configDrivenConverter;
	}
}
