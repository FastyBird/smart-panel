import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import {
	ChannelCategory,
	DataTypeType,
	PermissionType,
	PropertyCategory,
} from '../../../modules/devices/devices.constants';
import {
	ActionConverter,
	BatterySensorConverter,
	ClimateConverter,
	ContactSensorConverter,
	ConversionContext,
	ConverterRegistry,
	CoverConverter,
	ElectricalConverter,
	FanConverter,
	HumiditySensorConverter,
	IlluminanceSensorConverter,
	LeakSensorConverter,
	LightConverter,
	LockConverter,
	MotionSensorConverter,
	OccupancySensorConverter,
	PressureSensorConverter,
	SmokeSensorConverter,
	SwitchConverter,
	TemperatureSensorConverter,
} from '../converters';
import {
	DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
	Z2M_GENERIC_TYPES,
	Z2M_SPECIFIC_TYPES,
} from '../devices-zigbee2mqtt.constants';
import { Z2mExpose } from '../interfaces/zigbee2mqtt.interface';

/**
 * Mapped channel structure
 */
export interface MappedChannel {
	identifier: string;
	name: string;
	category: ChannelCategory;
	endpoint?: string;
	properties: MappedProperty[];
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
 * Uses a modular converter architecture inspired by homebridge-z2m.
 * Each device type has its own dedicated converter for specialized handling.
 */
@Injectable()
export class Z2mExposesMapperService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'ExposesMapper',
	);

	private readonly converterRegistry: ConverterRegistry;

	constructor() {
		this.converterRegistry = new ConverterRegistry();
	}

	/**
	 * Initialize and register all converters
	 */
	onModuleInit(): void {
		this.registerConverters();
	}

	/**
	 * Register all available converters with the registry
	 */
	private registerConverters(): void {
		// Device converters (highest priority)
		this.converterRegistry.register(new LightConverter());
		this.converterRegistry.register(new SwitchConverter());
		this.converterRegistry.register(new CoverConverter());
		this.converterRegistry.register(new ClimateConverter());
		this.converterRegistry.register(new LockConverter());
		this.converterRegistry.register(new FanConverter());

		// Sensor converters
		this.converterRegistry.register(new TemperatureSensorConverter());
		this.converterRegistry.register(new HumiditySensorConverter());
		this.converterRegistry.register(new OccupancySensorConverter());
		this.converterRegistry.register(new ContactSensorConverter());
		this.converterRegistry.register(new LeakSensorConverter());
		this.converterRegistry.register(new SmokeSensorConverter());
		this.converterRegistry.register(new IlluminanceSensorConverter());
		this.converterRegistry.register(new PressureSensorConverter());
		this.converterRegistry.register(new MotionSensorConverter());
		this.converterRegistry.register(new BatterySensorConverter());

		// Special converters
		this.converterRegistry.register(new ActionConverter());
		this.converterRegistry.register(new ElectricalConverter());

		this.converterRegistry.markInitialized();
		this.logger.log('Converter registry initialized with modular converters');
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
}
