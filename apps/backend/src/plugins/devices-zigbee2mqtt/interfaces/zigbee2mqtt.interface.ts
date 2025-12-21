/**
 * Zigbee2MQTT Interfaces
 *
 * Based on Zigbee2MQTT MQTT API documentation.
 * https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html
 */

// =============================================================================
// MQTT Adapter Events
// =============================================================================

export enum Z2mAdapterEventType {
	BRIDGE_ONLINE = 'z2m.bridge.online',
	BRIDGE_OFFLINE = 'z2m.bridge.offline',
	DEVICES_RECEIVED = 'z2m.devices.received',
	DEVICE_STATE_CHANGED = 'z2m.device.state_changed',
	DEVICE_AVAILABILITY_CHANGED = 'z2m.device.availability_changed',
	DEVICE_JOINED = 'z2m.device.joined',
	DEVICE_LEFT = 'z2m.device.left',
	ADAPTER_ERROR = 'z2m.adapter.error',
	ADAPTER_CONNECTED = 'z2m.adapter.connected',
	ADAPTER_DISCONNECTED = 'z2m.adapter.disconnected',
}

export interface Z2mBridgeOnlineEvent {
	timestamp: Date;
}

export interface Z2mBridgeOfflineEvent {
	timestamp: Date;
}

export interface Z2mDevicesReceivedEvent {
	devices: Z2mDevice[];
	timestamp: Date;
}

export interface Z2mDeviceStateChangedEvent {
	friendlyName: string;
	state: Record<string, unknown>;
	timestamp: Date;
}

export interface Z2mDeviceAvailabilityChangedEvent {
	friendlyName: string;
	available: boolean;
	timestamp: Date;
}

export interface Z2mDeviceJoinedEvent {
	ieeeAddress: string;
	friendlyName: string;
	timestamp: Date;
}

export interface Z2mDeviceLeftEvent {
	ieeeAddress: string;
	friendlyName: string;
	timestamp: Date;
}

export interface Z2mAdapterErrorEvent {
	error: Error;
	timestamp: Date;
}

export interface Z2mAdapterConnectedEvent {
	timestamp: Date;
}

export interface Z2mAdapterDisconnectedEvent {
	reason?: string;
	timestamp: Date;
}

// =============================================================================
// Zigbee2MQTT Bridge Messages
// =============================================================================

/**
 * Bridge state message from zigbee2mqtt/bridge/state
 */
export interface Z2mBridgeState {
	state: 'online' | 'offline';
}

/**
 * Bridge event message from zigbee2mqtt/bridge/event
 */
export interface Z2mBridgeEvent {
	type: 'device_joined' | 'device_announce' | 'device_interview' | 'device_leave';
	data: {
		friendly_name?: string;
		ieee_address?: string;
		status?: string;
	};
}

/**
 * Device availability message from zigbee2mqtt/<device>/availability
 */
export interface Z2mDeviceAvailability {
	state: 'online' | 'offline';
}

// =============================================================================
// Zigbee2MQTT Device Registry
// =============================================================================

/**
 * Full device entry from zigbee2mqtt/bridge/devices
 */
export interface Z2mDevice {
	ieee_address: string;
	type: 'Coordinator' | 'Router' | 'EndDevice';
	friendly_name: string;
	network_address: number;
	supported: boolean;
	disabled: boolean;
	definition?: Z2mDeviceDefinition;
	power_source?: string;
	software_build_id?: string;
	model_id?: string;
	date_code?: string;
	interviewing?: boolean;
	interview_completed?: boolean;
}

/**
 * Device definition containing model info and capabilities
 */
export interface Z2mDeviceDefinition {
	model: string;
	vendor: string;
	description: string;
	exposes: Z2mExpose[];
	options?: Z2mOption[];
}

// =============================================================================
// Zigbee2MQTT Exposes
// =============================================================================

/**
 * Base expose structure
 */
export interface Z2mExposeBase {
	type: string;
	name?: string;
	label?: string;
	property?: string;
	access?: number;
	description?: string;
	category?: 'config' | 'diagnostic';
	endpoint?: string;
}

/**
 * Binary expose (on/off, true/false)
 */
export interface Z2mExposeBinary extends Z2mExposeBase {
	type: 'binary';
	value_on: string | boolean;
	value_off: string | boolean;
	value_toggle?: string;
}

/**
 * Numeric expose (temperature, brightness, etc.)
 */
export interface Z2mExposeNumeric extends Z2mExposeBase {
	type: 'numeric';
	value_min?: number;
	value_max?: number;
	value_step?: number;
	unit?: string;
	presets?: Z2mPreset[];
}

/**
 * Enum expose (mode selection, etc.)
 */
export interface Z2mExposeEnum extends Z2mExposeBase {
	type: 'enum';
	values: string[];
}

/**
 * Text expose (string values)
 */
export interface Z2mExposeText extends Z2mExposeBase {
	type: 'text';
}

/**
 * Composite expose (nested structure like color)
 */
export interface Z2mExposeComposite extends Z2mExposeBase {
	type: 'composite';
	features: Z2mExpose[];
}

/**
 * List expose (array of items)
 */
export interface Z2mExposeList extends Z2mExposeBase {
	type: 'list';
	item_type: string;
	length_min?: number;
	length_max?: number;
}

/**
 * Specific expose types (light, switch, climate, etc.)
 * These have a features array containing the actual capabilities
 */
export interface Z2mExposeSpecific extends Z2mExposeBase {
	type: 'light' | 'switch' | 'fan' | 'cover' | 'lock' | 'climate';
	features: Z2mExpose[];
}

/**
 * Union type for all expose types
 */
export type Z2mExpose =
	| Z2mExposeBinary
	| Z2mExposeNumeric
	| Z2mExposeEnum
	| Z2mExposeText
	| Z2mExposeComposite
	| Z2mExposeList
	| Z2mExposeSpecific;

/**
 * Preset for numeric values
 */
export interface Z2mPreset {
	name: string;
	value: number;
	description?: string;
}

/**
 * Device option
 */
export interface Z2mOption {
	name: string;
	type: string;
	description?: string;
}

// =============================================================================
// Internal Registry Types
// =============================================================================

/**
 * Internal device registry entry
 */
export interface Z2mRegisteredDevice {
	ieeeAddress: string;
	friendlyName: string;
	type: 'Router' | 'EndDevice';
	supported: boolean;
	disabled: boolean;
	definition?: Z2mDeviceDefinition;
	powerSource?: string;
	modelId?: string;
	available: boolean;
	lastSeen?: Date;
	currentState: Record<string, unknown>;
}

// =============================================================================
// State Update Types
// =============================================================================

/**
 * Payload structure for setting device state
 */
export interface Z2mSetPayload {
	[key: string]: unknown;
}

/**
 * Parsed property value from Z2M state
 */
export interface Z2mParsedProperty {
	identifier: string;
	value: string | number | boolean;
	channelIdentifier: string;
}

// =============================================================================
// Color Types
// =============================================================================

export interface Z2mColorHS {
	hue: number;
	saturation: number;
}

export interface Z2mColorXY {
	x: number;
	y: number;
}

export interface Z2mColorRGB {
	r: number;
	g: number;
	b: number;
}

export type Z2mColor = Z2mColorHS | Z2mColorXY | Z2mColorRGB;

// =============================================================================
// Configuration Types
// =============================================================================

export interface Z2mMqttConfig {
	host: string;
	port: number;
	username?: string;
	password?: string;
	baseTopic: string;
	clientId?: string;
	cleanSession: boolean;
	keepalive: number;
	connectTimeout: number;
	reconnectInterval: number;
	tls?: {
		enabled: boolean;
		rejectUnauthorized: boolean;
		ca?: string;
		cert?: string;
		key?: string;
	};
}
