/**
 * WLED device state interface
 * Represents the current state of a WLED device
 */
export interface WledState {
	on: boolean;
	brightness: number; // 0-255
	transition: number; // Transition time in 100ms steps
	preset: number; // Currently active preset (-1 if none)
	playlist: number; // Currently active playlist (-1 if none)
	nightlight: {
		on: boolean;
		duration: number;
		mode: number;
		targetBrightness: number;
		remaining: number;
	};
	udp: {
		send: boolean;
		receive: boolean;
	};
	liveOverride: number;
	mainSegment: number;
	segments: WledSegment[];
}

/**
 * WLED segment interface
 * Represents a segment of addressable LEDs
 */
export interface WledSegment {
	id: number;
	start: number;
	stop: number;
	length: number;
	grouping: number;
	spacing: number;
	offset: number;
	colors: number[][]; // Array of colors, each color is [R, G, B, W?]
	effect: number;
	effectSpeed: number; // 0-255
	effectIntensity: number; // 0-255
	palette: number;
	selected: boolean;
	reverse: boolean;
	on: boolean;
	brightness: number; // Segment brightness 0-255
	mirror: boolean;
}

/**
 * WLED device info interface
 * Represents static device information
 */
export interface WledInfo {
	version: string;
	versionId: number;
	ledInfo: {
		count: number;
		fps: number;
		power: number;
		maxPower: number;
		maxSegments: number;
	};
	name: string;
	udpPort: number;
	isLive: boolean;
	liveModeSource: string;
	lm: string;
	sourceIp: string;
	wifi: {
		bssid: string;
		rssi: number;
		channel: number;
	};
	fileSystem: {
		used: number;
		total: number;
		presetsJson: number;
	};
	effectsCount: number;
	palettesCount: number;
	uptime: number;
	architecture: string;
	core: string;
	freeHeap: number;
	brand: string;
	product: string;
	mac: string;
	ip: string;
}

/**
 * WLED effect list item
 */
export interface WledEffect {
	id: number;
	name: string;
}

/**
 * WLED palette list item
 */
export interface WledPalette {
	id: number;
	name: string;
}

/**
 * WLED device context - full device information
 */
export interface WledDeviceContext {
	state: WledState;
	info: WledInfo;
	effects: WledEffect[];
	palettes: WledPalette[];
}

/**
 * State update options for WLED
 */
export interface WledStateUpdate {
	on?: boolean;
	brightness?: number; // 0-255
	transition?: number; // 0-65535 (in 100ms steps)
	preset?: number; // Preset to apply
	segment?: WledSegmentUpdate | WledSegmentUpdate[];
}

/**
 * Segment update options
 */
export interface WledSegmentUpdate {
	id?: number;
	colors?: number[][] | string; // Array of colors or hex string
	effect?: number;
	effectSpeed?: number; // 0-255
	effectIntensity?: number; // 0-255
	palette?: number;
	on?: boolean;
	brightness?: number; // 0-255
}

/**
 * Event types emitted by the WLED adapter
 */
export enum WledAdapterEventType {
	DEVICE_CONNECTED = 'WledAdapter.Device.Connected',
	DEVICE_DISCONNECTED = 'WledAdapter.Device.Disconnected',
	DEVICE_STATE_CHANGED = 'WledAdapter.Device.StateChanged',
	DEVICE_ERROR = 'WledAdapter.Device.Error',
}

/**
 * WLED device connection event
 */
export interface WledDeviceConnectedEvent {
	host: string;
	info: WledInfo;
}

/**
 * WLED device disconnected event
 */
export interface WledDeviceDisconnectedEvent {
	host: string;
	reason?: string;
}

/**
 * WLED device state changed event
 */
export interface WledDeviceStateChangedEvent {
	host: string;
	state: WledState;
	previousState?: WledState;
}

/**
 * WLED device error event
 */
export interface WledDeviceErrorEvent {
	host: string;
	error: Error;
}

/**
 * Registered WLED device in adapter
 */
export interface RegisteredWledDevice {
	host: string;
	identifier: string;
	connected: boolean;
	enabled: boolean;
	context?: WledDeviceContext;
	lastSeen?: Date;
	websocket?: WebSocket;
}

/**
 * WLED preset interface
 */
export interface WledPreset {
	id: number;
	name: string;
}

/**
 * mDNS discovered device
 */
export interface WledMdnsDiscoveredDevice {
	host: string;
	name: string;
	mac?: string;
	port: number;
}

/**
 * mDNS discovery events
 */
export enum WledMdnsEventType {
	DEVICE_DISCOVERED = 'WledMdns.Device.Discovered',
	DEVICE_REMOVED = 'WledMdns.Device.Removed',
}

/**
 * Nightlight update options
 */
export interface WledNightlightUpdate {
	on?: boolean;
	duration?: number; // minutes
	mode?: number; // 0=instant, 1=fade, 2=color fade, 3=sunrise
	targetBrightness?: number;
}

/**
 * UDP sync update options
 */
export interface WledUdpSyncUpdate {
	send?: boolean;
	receive?: boolean;
}

/**
 * Extended state update options for WLED
 */
export interface WledStateUpdateExtended extends WledStateUpdate {
	nightlight?: WledNightlightUpdate;
	udpSync?: WledUdpSyncUpdate;
	liveOverride?: number; // 0=off, 1=until live data ends, 2=until reboot
}
