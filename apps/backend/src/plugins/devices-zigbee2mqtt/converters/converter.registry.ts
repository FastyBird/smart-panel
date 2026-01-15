import { Injectable } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } from '../devices-zigbee2mqtt.constants';
import { Z2mExpose } from '../interfaces/zigbee2mqtt.interface';

import { CanHandleResult, ConversionContext, IConverter, MappedChannel } from './converter.interface';

/**
 * Converter match result with priority for sorting
 */
interface ConverterMatch {
	converter: IConverter;
	result: CanHandleResult;
}

/**
 * Converter Registry
 *
 * Central registry for all Z2M expose converters.
 * Converters are registered and queried in priority order
 * to find the best match for each expose.
 *
 * Inspired by homebridge-z2m's BasicServiceCreatorManager pattern.
 */
@Injectable()
export class ConverterRegistry {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		'ConverterRegistry',
	);

	private converters: IConverter[] = [];
	private initialized = false;

	/**
	 * Register a converter with the registry
	 *
	 * @param converter - The converter to register
	 */
	register(converter: IConverter): void {
		// Check for duplicate types
		const existing = this.converters.find((c) => c.type === converter.type);
		if (existing) {
			this.logger.warn(`Converter with type '${converter.type}' already registered, replacing`);
			this.converters = this.converters.filter((c) => c.type !== converter.type);
		}

		this.converters.push(converter);
		this.logger.debug(`Registered converter: ${converter.type}`);
	}

	/**
	 * Register multiple converters at once
	 *
	 * @param converters - Array of converters to register
	 */
	registerAll(converters: IConverter[]): void {
		for (const converter of converters) {
			this.register(converter);
		}
	}

	/**
	 * Find all converters that can handle an expose, sorted by priority
	 *
	 * @param expose - The expose to find converters for
	 * @param context - Optional conversion context with device info
	 * @returns Array of matching converters sorted by priority (highest first)
	 */
	findConverters(expose: Z2mExpose, context?: ConversionContext): ConverterMatch[] {
		const matches: ConverterMatch[] = [];

		for (const converter of this.converters) {
			try {
				const result = converter.canHandle(expose, context);
				if (result.canHandle) {
					matches.push({ converter, result });
				}
			} catch (error) {
				this.logger.error(`Error checking converter '${converter.type}': ${error}`);
			}
		}

		// Sort by priority (highest first)
		matches.sort((a, b) => b.result.priority - a.result.priority);

		return matches;
	}

	/**
	 * Find the best converter for an expose
	 *
	 * @param expose - The expose to find a converter for
	 * @param context - Optional conversion context with device info
	 * @returns The best matching converter or null
	 */
	findBestConverter(expose: Z2mExpose, context?: ConversionContext): IConverter | null {
		const matches = this.findConverters(expose, context);
		return matches.length > 0 ? matches[0].converter : null;
	}

	/**
	 * Convert all exposes to mapped channels
	 *
	 * This is the main entry point for converting a device's exposes
	 * to Smart Panel channels and properties.
	 *
	 * @param exposes - Array of Z2M exposes to convert
	 * @param context - Conversion context with device info
	 * @returns Array of mapped channels
	 */
	convertAll(exposes: Z2mExpose[], context: ConversionContext): MappedChannel[] {
		const channels: MappedChannel[] = [];
		const processedExposes = new Set<string>();

		for (const expose of exposes) {
			const exposeKey = this.getExposeKey(expose);

			// Skip if already processed (e.g., by a specific converter that handled features)
			if (processedExposes.has(exposeKey)) {
				continue;
			}

			const converter = this.findBestConverter(expose, context);
			if (converter) {
				try {
					const mappedChannels = converter.convert(expose, context);

					for (const channel of mappedChannels) {
						// Track which properties have been mapped
						for (const prop of channel.properties) {
							context.mappedProperties.add(prop.z2mProperty);
						}

						// Merge with existing channel if same identifier
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

					processedExposes.add(exposeKey);

					this.logger.debug(
						`Converted expose '${exposeKey}' using '${converter.type}' -> ${mappedChannels.length} channel(s)`,
					);
				} catch (error) {
					this.logger.error(`Error converting expose '${exposeKey}' with '${converter.type}': ${error}`);
				}
			} else {
				this.logger.debug(`No converter found for expose: ${exposeKey} (type: ${expose.type})`);
			}
		}

		return channels;
	}

	/**
	 * Get a unique key for an expose (for tracking)
	 */
	private getExposeKey(expose: Z2mExpose): string {
		const property = expose.property ?? expose.name ?? 'unknown';
		const endpoint = expose.endpoint ? `@${expose.endpoint}` : '';
		return `${expose.type}:${property}${endpoint}`;
	}

	/**
	 * Get all registered converters
	 */
	getConverters(): IConverter[] {
		return [...this.converters];
	}

	/**
	 * Get converter by type
	 */
	getConverter(type: string): IConverter | undefined {
		return this.converters.find((c) => c.type === type);
	}

	/**
	 * Clear all registered converters
	 */
	clear(): void {
		this.converters = [];
		this.initialized = false;
	}

	/**
	 * Check if the registry has been initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Mark the registry as initialized
	 */
	markInitialized(): void {
		this.initialized = true;
		this.logger.log(`Converter registry initialized with ${this.converters.length} converters`);
	}
}
