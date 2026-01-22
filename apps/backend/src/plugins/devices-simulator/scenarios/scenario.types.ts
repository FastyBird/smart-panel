/**
 * Scenario Types
 *
 * TypeScript interfaces for scenario YAML configuration files.
 * Scenarios define predefined device setups for testing environments.
 */

/**
 * Property definition in a scenario channel
 */
export interface ScenarioPropertyDefinition {
	/** Property category (e.g., 'on', 'brightness', 'temperature') */
	category: string;
	/** Optional data type override for multi-datatype properties */
	data_type?: string;
	/** Initial value for the property */
	value?: string | number | boolean;
}

/**
 * Channel definition in a scenario device
 */
export interface ScenarioChannelDefinition {
	/** Channel category (e.g., 'light', 'temperature', 'thermostat') */
	category: string;
	/** Optional custom name for the channel */
	name?: string;
	/** Properties to include in this channel */
	properties: ScenarioPropertyDefinition[];
}

/**
 * Device definition in a scenario
 */
export interface ScenarioDeviceDefinition {
	/** Display name for the device */
	name: string;
	/** Device category (e.g., 'lighting', 'sensor', 'thermostat') */
	category: string;
	/** Reference to room id (from rooms array) */
	room?: string;
	/** Optional description */
	description?: string;
	/** Enable auto-simulation of values */
	auto_simulate?: boolean;
	/** Auto-simulation interval in milliseconds */
	simulate_interval?: number;
	/** Channels to create for this device */
	channels: ScenarioChannelDefinition[];
}

/**
 * Room definition in a scenario
 */
export interface ScenarioRoomDefinition {
	/** Unique identifier for referencing in devices */
	id: string;
	/** Display name for the room */
	name: string;
}

/**
 * Complete scenario configuration loaded from YAML
 */
export interface ScenarioConfig {
	/** Schema version (e.g., '1.0') */
	version: string;
	/** Scenario name for display */
	name: string;
	/** Optional description of the scenario */
	description?: string;
	/** Rooms to create (optional) */
	rooms?: ScenarioRoomDefinition[];
	/** Devices to create */
	devices: ScenarioDeviceDefinition[];
}

/**
 * Information about a discovered scenario file
 */
export interface ScenarioFileInfo {
	/** Full path to the file */
	path: string;
	/** Source type: builtin or user */
	source: 'builtin' | 'user';
	/** Scenario name (from filename) */
	name: string;
}

/**
 * Result of loading a scenario file
 */
export interface ScenarioLoadResult {
	/** Whether loading was successful */
	success: boolean;
	/** Parsed scenario config (if successful) */
	config?: ScenarioConfig;
	/** Validation errors (if failed) */
	errors?: string[];
	/** Validation warnings */
	warnings?: string[];
	/** Source file path */
	source: string;
}

/**
 * Result of executing a scenario
 */
export interface ScenarioExecutionResult {
	/** Whether execution was successful */
	success: boolean;
	/** Number of devices created */
	devicesCreated: number;
	/** Number of rooms created */
	roomsCreated: number;
	/** IDs of created devices */
	deviceIds: string[];
	/** IDs of created rooms */
	roomIds: string[];
	/** Errors encountered during execution */
	errors: string[];
}

/**
 * Options for scenario execution
 */
export interface ScenarioExecutionOptions {
	/** Create rooms defined in the scenario */
	createRooms?: boolean;
	/** Dry run - don't actually create anything */
	dryRun?: boolean;
}
