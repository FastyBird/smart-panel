import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';
import { ConfigService } from '../../../modules/config/services/config.service';
import { DeviceCategory } from '../../../modules/devices/devices.constants';
import { ChannelsPropertiesService } from '../../../modules/devices/services/channels.properties.service';
import { DevicesService } from '../../../modules/devices/services/devices.service';
import { getAllProperties } from '../../../modules/devices/utils/schema.utils';
import { DEVICES_SIMULATOR_PLUGIN_NAME, DEVICES_SIMULATOR_TYPE } from '../devices-simulator.constants';
import { SimulatorDeviceEntity } from '../entities/devices-simulator.entity';
import { SimulatorConfigModel } from '../models/config.model';
import {
	AirConditionerSimulator,
	FanSimulator,
	HeatingUnitSimulator,
	IDeviceSimulator,
	LightingSimulator,
	LockSimulator,
	OutletSimulator,
	SensorSimulator,
	SimulatedPropertyValue,
	SimulationContext,
	ThermostatSimulator,
	WindowCoveringSimulator,
	createSimulationContext,
} from '../simulators';

/**
 * Configuration options for the simulation service
 */
export interface SimulationServiceConfig {
	/**
	 * Whether to update device values when the service starts
	 * Default: false
	 */
	updateOnStart: boolean;

	/**
	 * Interval in milliseconds for automatic simulation updates
	 * Set to 0 to disable automatic updates
	 * Default: 0 (disabled)
	 */
	simulationInterval: number;

	/**
	 * Latitude for location-based simulation (affects temperature, daylight, etc.)
	 * Default: 50.0 (Central Europe)
	 */
	latitude: number;

	/**
	 * Whether to use smooth transitions for values
	 * Default: true
	 */
	smoothTransitions: boolean;
}

const DEFAULT_CONFIG: SimulationServiceConfig = {
	updateOnStart: false,
	simulationInterval: 0,
	latitude: 50.0,
	smoothTransitions: true,
};

/**
 * Service that orchestrates realistic device simulations.
 * It manages multiple device simulators and provides consistent simulation
 * across all simulator devices.
 */
@Injectable()
export class SimulationService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: ExtensionLoggerService = createExtensionLogger(
		DEVICES_SIMULATOR_PLUGIN_NAME,
		'SimulationService',
	);

	private config: SimulationServiceConfig = { ...DEFAULT_CONFIG };
	private simulators: Map<DeviceCategory, IDeviceSimulator> = new Map();
	private previousValues: Map<string, Map<string, string | number | boolean>> = new Map();
	private simulationTimer: ReturnType<typeof setInterval> | null = null;
	private isRunning = false;

	constructor(
		private readonly configService: ConfigService,
		private readonly devicesService: DevicesService,
		private readonly channelsPropertiesService: ChannelsPropertiesService,
	) {
		this.registerSimulators();
	}

	/**
	 * Register all device simulators
	 */
	private registerSimulators(): void {
		const simulatorClasses = [
			SensorSimulator,
			LightingSimulator,
			AirConditionerSimulator,
			HeatingUnitSimulator,
			ThermostatSimulator,
			OutletSimulator,
			FanSimulator,
			LockSimulator,
			WindowCoveringSimulator,
		];

		for (const SimulatorClass of simulatorClasses) {
			const simulator = new SimulatorClass();
			this.simulators.set(simulator.getSupportedCategory(), simulator);
			this.logger.debug(`Registered simulator for category: ${simulator.getSupportedCategory()}`);
		}

		this.logger.log(`Registered ${this.simulators.size} device simulators`);
	}

	async onModuleInit(): Promise<void> {
		this.logger.log('Simulation service initialized');

		// Load persisted plugin configuration
		this.loadPluginConfig();

		if (this.config.updateOnStart) {
			this.logger.log('Running initial simulation on startup...');
			await this.simulateAllDevices();
		}

		if (this.config.simulationInterval > 0) {
			this.startAutoSimulation();
		}
	}

	/**
	 * Load configuration from the persisted plugin config
	 */
	private loadPluginConfig(): void {
		try {
			const pluginConfig = this.configService.getPluginConfig<SimulatorConfigModel>(DEVICES_SIMULATOR_PLUGIN_NAME);

			this.config = {
				updateOnStart: pluginConfig.updateOnStart ?? DEFAULT_CONFIG.updateOnStart,
				simulationInterval: pluginConfig.simulationInterval ?? DEFAULT_CONFIG.simulationInterval,
				latitude: pluginConfig.latitude ?? DEFAULT_CONFIG.latitude,
				smoothTransitions: pluginConfig.smoothTransitions ?? DEFAULT_CONFIG.smoothTransitions,
			};

			this.logger.log('Loaded plugin configuration', { config: this.config });
		} catch (error) {
			this.logger.warn('Failed to load plugin configuration, using defaults', { error: (error as Error).message });
			this.config = { ...DEFAULT_CONFIG };
		}
	}

	onModuleDestroy(): void {
		this.stopAutoSimulation();
	}

	/**
	 * Configure the simulation service
	 */
	configure(config: Partial<SimulationServiceConfig>): void {
		this.config = { ...this.config, ...config };
		this.logger.log('Simulation service configured', { config: this.config });

		// Restart auto-simulation if interval changed
		if (this.simulationTimer) {
			this.stopAutoSimulation();
			if (this.config.simulationInterval > 0) {
				this.startAutoSimulation();
			}
		}
	}

	/**
	 * Get current configuration
	 */
	getConfig(): SimulationServiceConfig {
		return { ...this.config };
	}

	/**
	 * Start automatic simulation updates
	 */
	startAutoSimulation(): void {
		if (this.simulationTimer) {
			this.logger.warn('Auto-simulation already running');
			return;
		}

		if (this.config.simulationInterval <= 0) {
			this.logger.warn('Simulation interval must be greater than 0');
			return;
		}

		this.logger.log(`Starting auto-simulation with interval: ${this.config.simulationInterval}ms`);

		this.simulationTimer = setInterval(() => {
			if (!this.isRunning) {
				void this.simulateAllDevices();
			}
		}, this.config.simulationInterval);
	}

	/**
	 * Stop automatic simulation updates
	 */
	stopAutoSimulation(): void {
		if (this.simulationTimer) {
			clearInterval(this.simulationTimer);
			this.simulationTimer = null;
			this.logger.log('Auto-simulation stopped');
		}
	}

	/**
	 * Check if auto-simulation is running
	 */
	isAutoSimulationRunning(): boolean {
		return this.simulationTimer !== null;
	}

	/**
	 * Simulate all simulator devices
	 */
	async simulateAllDevices(): Promise<{ devicesSimulated: number; propertiesUpdated: number }> {
		if (this.isRunning) {
			this.logger.warn('Simulation already in progress');
			return { devicesSimulated: 0, propertiesUpdated: 0 };
		}

		this.isRunning = true;
		let devicesSimulated = 0;
		let propertiesUpdated = 0;

		try {
			const devices = await this.devicesService.findAll<SimulatorDeviceEntity>(DEVICES_SIMULATOR_TYPE);

			if (devices.length === 0) {
				this.logger.debug('No simulator devices found');
				return { devicesSimulated: 0, propertiesUpdated: 0 };
			}

			this.logger.debug(`Simulating ${devices.length} devices...`);

			const context = createSimulationContext({
				latitude: this.config.latitude,
			});

			for (const device of devices) {
				const result = await this.simulateDevice(device, context);
				if (result.success) {
					devicesSimulated++;
					propertiesUpdated += result.propertiesUpdated;
				}
			}

			this.logger.debug(`Simulation complete: ${devicesSimulated} devices, ${propertiesUpdated} properties`);
		} catch (error) {
			this.logger.error('Error during simulation', error as Error);
		} finally {
			this.isRunning = false;
		}

		return { devicesSimulated, propertiesUpdated };
	}

	/**
	 * Simulate a specific device
	 */
	async simulateDevice(
		device: SimulatorDeviceEntity,
		context?: SimulationContext,
	): Promise<{ success: boolean; propertiesUpdated: number }> {
		const simulator = this.simulators.get(device.category);

		if (!simulator) {
			// No specific simulator, use generic random values
			this.logger.debug(`No specific simulator for category ${device.category}, using generic simulation`);
			return this.simulateGenericDevice(device);
		}

		const ctx = context ?? createSimulationContext({ latitude: this.config.latitude });

		// Get or create previous values map for this device (only if smoothTransitions is enabled)
		let devicePrevValues: Map<string, string | number | boolean> | undefined;
		if (this.config.smoothTransitions) {
			devicePrevValues = this.previousValues.get(device.id);
			if (!devicePrevValues) {
				devicePrevValues = this.loadCurrentValues(device);
				this.previousValues.set(device.id, devicePrevValues);
			}
		} else {
			// Clear any cached values when smooth transitions are disabled
			this.previousValues.delete(device.id);
		}

		try {
			// Generate simulated values
			const simulatedValues = simulator.simulate(device, ctx, devicePrevValues);

			// Apply values to device
			let propertiesUpdated = 0;
			for (const simValue of simulatedValues) {
				const updated = await this.applySimulatedValue(device, simValue);
				if (updated) {
					propertiesUpdated++;

					// Update previous values map
					if (devicePrevValues) {
						const key = `${simValue.channelCategory}:${simValue.propertyCategory}`;
						devicePrevValues.set(key, simValue.value);
					}
				}
			}

			return { success: true, propertiesUpdated };
		} catch (error) {
			this.logger.error(`Error simulating device ${device.id}`, error as Error);
			return { success: false, propertiesUpdated: 0 };
		}
	}

	/**
	 * Simulate a device without a specific simulator (generic random values)
	 */
	private async simulateGenericDevice(
		device: SimulatorDeviceEntity,
	): Promise<{ success: boolean; propertiesUpdated: number }> {
		let propertiesUpdated = 0;

		try {
			for (const channel of device.channels ?? []) {
				const allProperties = getAllProperties(channel.category);

				for (const property of channel.properties ?? []) {
					const propMeta = allProperties.find((p) => p.category === property.category);

					if (propMeta) {
						// Generate a simple random value within bounds
						const value = this.generateGenericValue(propMeta);

						if (value !== null) {
							try {
								await this.channelsPropertiesService.update(property.id, {
									type: property.type,
									value,
								});
								propertiesUpdated++;
							} catch {
								// Continue with other properties
							}
						}
					}
				}
			}

			return { success: true, propertiesUpdated };
		} catch (error) {
			this.logger.error(`Error in generic simulation for device ${device.id}`, error as Error);
			return { success: false, propertiesUpdated: 0 };
		}
	}

	/**
	 * Generate a generic random value for a property
	 */
	private generateGenericValue(propMeta: { data_type: string; format?: unknown }): string | number | boolean | null {
		switch (propMeta.data_type) {
			case 'bool':
				return Math.random() > 0.5;
			case 'enum':
				if (Array.isArray(propMeta.format) && propMeta.format.length > 0) {
					return propMeta.format[Math.floor(Math.random() * propMeta.format.length)] as string;
				}
				return null;
			case 'uchar':
			case 'char':
			case 'ushort':
			case 'short':
			case 'int':
			case 'uint':
				if (Array.isArray(propMeta.format) && propMeta.format.length === 2) {
					const min = propMeta.format[0] as number;
					const max = propMeta.format[1] as number;
					return Math.floor(Math.random() * (max - min + 1)) + min;
				}
				return Math.floor(Math.random() * 100);
			case 'float':
				if (Array.isArray(propMeta.format) && propMeta.format.length === 2) {
					const min = propMeta.format[0] as number;
					const max = propMeta.format[1] as number;
					return Math.round((Math.random() * (max - min) + min) * 100) / 100;
				}
				return Math.round(Math.random() * 100 * 100) / 100;
			default:
				return null;
		}
	}

	/**
	 * Apply a simulated value to a device property
	 */
	private async applySimulatedValue(device: SimulatorDeviceEntity, simValue: SimulatedPropertyValue): Promise<boolean> {
		// Find the channel
		const channel = device.channels?.find((ch) => ch.category === simValue.channelCategory);
		if (!channel) {
			return false;
		}

		// Find the property
		const property = channel.properties?.find((p) => p.category === simValue.propertyCategory);
		if (!property) {
			return false;
		}

		try {
			await this.channelsPropertiesService.update(property.id, {
				type: property.type,
				value: simValue.value,
			});
			return true;
		} catch (error) {
			this.logger.warn(`Failed to update property ${property.id}: ${(error as Error).message}`);
			return false;
		}
	}

	/**
	 * Load current property values from a device (for smooth transitions)
	 */
	private loadCurrentValues(device: SimulatorDeviceEntity): Map<string, string | number | boolean> {
		const values = new Map<string, string | number | boolean>();

		for (const channel of device.channels ?? []) {
			for (const property of channel.properties ?? []) {
				if (property.value !== null && property.value !== undefined) {
					const key = `${channel.category}:${property.category}`;
					values.set(key, property.value);
				}
			}
		}

		return values;
	}

	/**
	 * Clear stored previous values (useful for testing or reset)
	 */
	clearPreviousValues(): void {
		this.previousValues.clear();
		this.logger.debug('Previous values cache cleared');
	}

	/**
	 * Get list of supported device categories
	 */
	getSupportedCategories(): DeviceCategory[] {
		return Array.from(this.simulators.keys());
	}

	/**
	 * Check if a device category has a dedicated simulator
	 */
	hasSimulator(category: DeviceCategory): boolean {
		return this.simulators.has(category);
	}
}
