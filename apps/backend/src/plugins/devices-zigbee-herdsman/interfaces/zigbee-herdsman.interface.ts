/**
 * Zigbee Herdsman Interfaces
 *
 * Types for direct zigbee-herdsman integration.
 */
import { InterviewStatus, ZigbeeDeviceType } from '../devices-zigbee-herdsman.constants';

// =============================================================================
// Adapter Event Callbacks
// =============================================================================

export interface ZhAdapterCallbacks {
	onDeviceJoined?: (device: ZhDeviceJoinedEvent) => void | Promise<void>;
	onDeviceInterview?: (event: ZhDeviceInterviewEvent) => void | Promise<void>;
	onDeviceLeave?: (event: ZhDeviceLeaveEvent) => void | Promise<void>;
	onDeviceAnnounce?: (event: ZhDeviceAnnounceEvent) => void | Promise<void>;
	onMessage?: (event: ZhMessageEvent) => void | Promise<void>;
	onAdapterDisconnected?: () => void | Promise<void>;
}

// =============================================================================
// Adapter Events
// =============================================================================

export interface ZhDeviceJoinedEvent {
	ieeeAddress: string;
	networkAddress: number;
}

export interface ZhDeviceInterviewEvent {
	ieeeAddress: string;
	status: 'started' | 'successful' | 'failed';
}

export interface ZhDeviceLeaveEvent {
	ieeeAddress: string;
	networkAddress: number;
}

export interface ZhDeviceAnnounceEvent {
	ieeeAddress: string;
	networkAddress: number;
}

export interface ZhMessageEvent {
	ieeeAddress: string;
	type: string;
	cluster: string;
	data: Record<string, unknown>;
	endpoint: number;
	linkquality?: number;
	groupId?: number;
}

// =============================================================================
// Expose Types (from zigbee-herdsman-converters)
// =============================================================================

export interface ZhExposeBase {
	type: string;
	name?: string;
	label?: string;
	property?: string;
	access?: number;
	description?: string;
	category?: 'config' | 'diagnostic';
	endpoint?: string;
}

export interface ZhExposeBinary extends ZhExposeBase {
	type: 'binary';
	value_on: string | boolean;
	value_off: string | boolean;
	value_toggle?: string;
}

export interface ZhExposeNumeric extends ZhExposeBase {
	type: 'numeric';
	value_min?: number;
	value_max?: number;
	value_step?: number;
	unit?: string;
	presets?: ZhPreset[];
}

export interface ZhExposeEnum extends ZhExposeBase {
	type: 'enum';
	values: string[];
}

export interface ZhExposeText extends ZhExposeBase {
	type: 'text';
}

export interface ZhExposeComposite extends ZhExposeBase {
	type: 'composite';
	features: ZhExpose[];
}

export interface ZhExposeList extends ZhExposeBase {
	type: 'list';
	item_type: string;
	length_min?: number;
	length_max?: number;
}

export interface ZhExposeSpecific extends ZhExposeBase {
	type: 'light' | 'switch' | 'fan' | 'cover' | 'lock' | 'climate';
	features: ZhExpose[];
}

export type ZhExpose =
	| ZhExposeBinary
	| ZhExposeNumeric
	| ZhExposeEnum
	| ZhExposeText
	| ZhExposeComposite
	| ZhExposeList
	| ZhExposeSpecific;

export interface ZhPreset {
	name: string;
	value: number;
	description?: string;
}

// =============================================================================
// Device Definition (from zigbee-herdsman-converters)
// =============================================================================

export interface ZhDeviceDefinition {
	model: string;
	vendor: string;
	description: string;
	exposes: ZhExpose[];
	fromZigbee: unknown[];
	toZigbee: unknown[];
	options?: unknown[];
}

// =============================================================================
// Discovered Device Registry
// =============================================================================

export interface ZhDiscoveredDevice {
	ieeeAddress: string;
	networkAddress: number;
	friendlyName: string;
	type: ZigbeeDeviceType;
	manufacturerName: string | null;
	modelId: string | null;
	dateCode: string | null;
	softwareBuildId: string | null;
	interviewStatus: InterviewStatus;
	definition: ZhDeviceDefinition | null;
	powerSource: string | null;
	lastSeen: Date | null;
	available: boolean;
}

// =============================================================================
// Group Types
// =============================================================================

export interface ZhGroup {
	id: number;
	name: string;
	members: ZhGroupMember[];
}

export interface ZhGroupMember {
	ieeeAddress: string;
	endpoint: number;
}

// =============================================================================
// Network Configuration
// =============================================================================

export interface ZhNetworkConfig {
	channel: number;
	panId: number;
	extendedPanId: number[];
	networkKey: number[];
}

// =============================================================================
// Permit Join State
// =============================================================================

export interface ZhPermitJoinState {
	enabled: boolean;
	timeout: number;
	remainingTime: number;
}
