/**
 * Scenario Loader Service
 *
 * Loads, validates, and discovers YAML scenario configuration files.
 * Supports built-in scenarios and user custom scenarios.
 */
import Ajv from 'ajv';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { basename, join } from 'path';
import { parse as parseYaml } from 'yaml';

import { Injectable, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ChannelCategory, DeviceCategory, PropertyCategory } from '../../../modules/devices/devices.constants';
import { getPropertyMetadata, isChannelAllowed } from '../../../modules/devices/utils/schema.utils';
import { DEVICES_SIMULATOR_PLUGIN_NAME } from '../devices-simulator.constants';
import {
	ScenarioChannelDefinition,
	ScenarioConfig,
	ScenarioDeviceDefinition,
	ScenarioFileInfo,
	ScenarioLoadResult,
} from '../scenarios/scenario.types';

@Injectable()
export class ScenarioLoaderService implements OnModuleInit {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'ScenarioLoader',
	);

	private readonly ajv: Ajv;
	private readonly validateSchema: ReturnType<Ajv['compile']>;

	private discoveredScenarios: ScenarioFileInfo[] = [];

	// Paths for scenario files
	private readonly builtinScenariosPath = join(__dirname, '../scenarios/definitions');
	private readonly userScenariosPath =
		process.env.SIMULATOR_SCENARIOS_PATH ?? join(__dirname, '../../../../../../../var/data/simulator/scenarios');

	constructor() {
		this.ajv = new Ajv({ allErrors: true, strict: false });

		// Load JSON schema at runtime
		const schemaPath = join(__dirname, '../scenarios/schema/scenario-schema.json');
		const scenarioSchema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
		this.validateSchema = this.ajv.compile(scenarioSchema);
	}

	onModuleInit(): void {
		this.discoverAllScenarios();
	}

	/**
	 * Discover all available scenarios from builtin and user directories
	 */
	discoverAllScenarios(): void {
		this.discoveredScenarios = [];

		// Discover builtin scenarios
		const builtinScenarios = this.discoverScenariosInDirectory(this.builtinScenariosPath, 'builtin');
		this.discoveredScenarios.push(...builtinScenarios);

		// Discover user scenarios
		if (existsSync(this.userScenariosPath)) {
			const userScenarios = this.discoverScenariosInDirectory(this.userScenariosPath, 'user');
			this.discoveredScenarios.push(...userScenarios);
		}

		this.logger.log(`Discovered ${this.discoveredScenarios.length} scenarios`);
	}

	/**
	 * Discover scenario files in a directory
	 */
	private discoverScenariosInDirectory(dirPath: string, source: 'builtin' | 'user'): ScenarioFileInfo[] {
		const scenarios: ScenarioFileInfo[] = [];

		if (!existsSync(dirPath)) {
			return scenarios;
		}

		try {
			const entries = readdirSync(dirPath, { withFileTypes: true });

			for (const entry of entries) {
				if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
					const fullPath = join(dirPath, entry.name);
					const name = basename(entry.name, entry.name.endsWith('.yaml') ? '.yaml' : '.yml');

					scenarios.push({
						path: fullPath,
						source,
						name,
					});
				}
			}
		} catch (error) {
			this.logger.warn(`Failed to read scenario directory: ${dirPath}`, {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return scenarios;
	}

	/**
	 * Get all discovered scenarios
	 */
	getAvailableScenarios(): ScenarioFileInfo[] {
		return this.discoveredScenarios;
	}

	/**
	 * Find a scenario by name
	 */
	findScenarioByName(name: string): ScenarioFileInfo | undefined {
		return this.discoveredScenarios.find((s) => s.name === name);
	}

	/**
	 * Load a scenario by name
	 */
	loadScenarioByName(name: string): ScenarioLoadResult {
		const scenario = this.findScenarioByName(name);

		if (!scenario) {
			return {
				success: false,
				errors: [`Scenario '${name}' not found`],
				source: name,
			};
		}

		return this.loadScenarioFile(scenario.path);
	}

	/**
	 * Load a scenario from a file path
	 */
	loadScenarioFile(filePath: string): ScenarioLoadResult {
		try {
			// Check file exists
			if (!existsSync(filePath)) {
				return {
					success: false,
					errors: [`File not found: ${filePath}`],
					source: filePath,
				};
			}

			// Read and parse YAML
			const content = readFileSync(filePath, 'utf-8');
			const config = parseYaml(content) as ScenarioConfig;

			// Validate against JSON schema
			const valid = this.validateSchema(config);
			if (!valid) {
				const errors = this.validateSchema.errors?.map((e) => `${e.instancePath}: ${e.message}`) ?? [];
				return {
					success: false,
					errors,
					source: filePath,
				};
			}

			// Semantic validation
			const semanticResult = this.validateSemantics(config);
			if (semanticResult.errors.length > 0) {
				return {
					success: false,
					errors: semanticResult.errors,
					warnings: semanticResult.warnings,
					source: filePath,
				};
			}

			this.logger.log(`Successfully loaded scenario: ${config.name}`);

			return {
				success: true,
				config,
				warnings: semanticResult.warnings.length > 0 ? semanticResult.warnings : undefined,
				source: filePath,
			};
		} catch (error) {
			return {
				success: false,
				errors: [error instanceof Error ? error.message : String(error)],
				source: filePath,
			};
		}
	}

	/**
	 * Validate semantic correctness of a scenario config
	 */
	private validateSemantics(config: ScenarioConfig): { errors: string[]; warnings: string[] } {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Collect room IDs for reference validation
		const roomIds = new Set(config.rooms?.map((r) => r.id) ?? []);

		// Validate each device
		for (let i = 0; i < config.devices.length; i++) {
			const device = config.devices[i];
			const devicePath = `devices[${i}]`;

			// Validate device category
			const deviceCategory = this.resolveDeviceCategory(device.category);
			if (!deviceCategory) {
				errors.push(`${devicePath}: Invalid device category '${device.category}'`);
				continue;
			}

			// Validate room reference
			if (device.room && !roomIds.has(device.room)) {
				warnings.push(`${devicePath}: Room '${device.room}' is not defined in rooms array`);
			}

			// Validate channels
			this.validateDeviceChannels(device, deviceCategory, devicePath, errors, warnings);
		}

		return { errors, warnings };
	}

	/**
	 * Validate channels for a device
	 */
	private validateDeviceChannels(
		device: ScenarioDeviceDefinition,
		deviceCategory: DeviceCategory,
		devicePath: string,
		errors: string[],
		warnings: string[],
	): void {
		for (let j = 0; j < device.channels.length; j++) {
			const channel = device.channels[j];
			const channelPath = `${devicePath}.channels[${j}]`;

			// Validate channel category
			const channelCategory = this.resolveChannelCategory(channel.category);
			if (!channelCategory) {
				errors.push(`${channelPath}: Invalid channel category '${channel.category}'`);
				continue;
			}

			// Check if channel is allowed for this device category
			if (!isChannelAllowed(deviceCategory, channelCategory)) {
				warnings.push(
					`${channelPath}: Channel '${channel.category}' is not typically allowed for device category '${device.category}'`,
				);
			}

			// Validate properties
			this.validateChannelProperties(channel, channelCategory, channelPath, errors, warnings);
		}
	}

	/**
	 * Validate properties for a channel
	 */
	private validateChannelProperties(
		channel: ScenarioChannelDefinition,
		channelCategory: ChannelCategory,
		channelPath: string,
		errors: string[],
		warnings: string[],
	): void {
		for (let k = 0; k < channel.properties.length; k++) {
			const property = channel.properties[k];
			const propertyPath = `${channelPath}.properties[${k}]`;

			// Validate property category
			const propertyCategory = this.resolvePropertyCategory(property.category);
			if (!propertyCategory) {
				errors.push(`${propertyPath}: Invalid property category '${property.category}'`);
				continue;
			}

			// Get property metadata from schema
			const metadata = getPropertyMetadata(channelCategory, propertyCategory);
			if (!metadata) {
				errors.push(
					`${propertyPath}: Property '${property.category}' is not defined for channel '${channel.category}'`,
				);
			}
		}
	}

	/**
	 * Resolve device category string to enum
	 */
	resolveDeviceCategory(category: string): DeviceCategory | null {
		const upperCategory = category.toUpperCase();
		if (upperCategory in DeviceCategory) {
			return DeviceCategory[upperCategory as keyof typeof DeviceCategory];
		}

		// Try lowercase match
		const lowerCategory = category.toLowerCase();
		const values = Object.values(DeviceCategory) as string[];
		const match = values.find((v) => v === lowerCategory);
		return (match as DeviceCategory) ?? null;
	}

	/**
	 * Resolve channel category string to enum
	 */
	resolveChannelCategory(category: string): ChannelCategory | null {
		const upperCategory = category.toUpperCase();
		if (upperCategory in ChannelCategory) {
			return ChannelCategory[upperCategory as keyof typeof ChannelCategory];
		}

		// Try lowercase match
		const lowerCategory = category.toLowerCase();
		const values = Object.values(ChannelCategory) as string[];
		const match = values.find((v) => v === lowerCategory);
		return (match as ChannelCategory) ?? null;
	}

	/**
	 * Resolve property category string to enum
	 */
	resolvePropertyCategory(category: string): PropertyCategory | null {
		const upperCategory = category.toUpperCase();
		if (upperCategory in PropertyCategory) {
			return PropertyCategory[upperCategory as keyof typeof PropertyCategory];
		}

		// Try lowercase match
		const lowerCategory = category.toLowerCase();
		const values = Object.values(PropertyCategory) as string[];
		const match = values.find((v) => v === lowerCategory);
		return (match as PropertyCategory) ?? null;
	}

	/**
	 * Get user scenarios path for external configuration
	 */
	getUserScenariosPath(): string {
		return this.userScenariosPath;
	}

	/**
	 * Get builtin scenarios path
	 */
	getBuiltinScenariosPath(): string {
		return this.builtinScenariosPath;
	}

	/**
	 * Reload all scenarios
	 */
	reload(): void {
		this.logger.log('Reloading scenario configurations...');
		this.discoverAllScenarios();
	}
}
