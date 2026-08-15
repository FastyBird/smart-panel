export type HomeSnapshotScope = { type: 'home' } | { type: 'space'; id: string; name: string };

export interface HomeSnapshotSpace {
	id: string;
	name: string;
	type: string;
	parent_id: string | null;
	device_count: number;
}

export interface HomeSnapshotDeviceStatus {
	online: boolean;
	state: string;
	last_changed: string | null;
}

export interface HomeSnapshotDevice {
	id: string;
	name: string;
	category: string;
	enabled: boolean;
	room_id: string | null;
	zone_ids: string[];
	status: HomeSnapshotDeviceStatus;
}

export interface HomeSnapshotScene {
	id: string;
	name: string;
	category: string;
	enabled: boolean;
	triggerable: boolean;
	primary_space_id: string | null;
}

export interface HomeSnapshotWeather {
	location_id: string | null;
	location: unknown;
	current: unknown;
	forecast: unknown[];
}

export interface HomeSnapshotEnergyMetrics {
	from: string;
	to: string;
	totalConsumptionKwh: number;
	totalProductionKwh: number;
	totalGridImportKwh: number;
	totalGridExportKwh: number;
	hasGridMetrics: boolean;
	lastUpdatedAt: string | null;
}

export type HomeSnapshotEnergy = HomeSnapshotEnergyMetrics &
	(
		| { scope: { type: 'home' } }
		| { scope: { type: 'space'; id: string }; netKwh: number; netGridKwh: number }
		| { scope: { type: 'space'; id: string }; netKwh?: never; netGridKwh?: never }
	);

export interface HomeSnapshotSecurityAlert {
	id: string;
	type: string;
	severity: string;
	timestamp: string;
	acknowledged: boolean;
	source_device_id: string | undefined;
	message: string | undefined;
}

export interface HomeSnapshotSecurityLastEvent {
	type: string;
	timestamp: string;
	sourceDeviceId?: string;
	severity?: string;
}

export interface HomeSnapshotSecurity {
	armed_state: string | null;
	alarm_state: string | null;
	highest_severity: string;
	active_alerts_count: number;
	has_critical_alert: boolean;
	active_alerts: HomeSnapshotSecurityAlert[];
	alerts_truncated: boolean;
	devices_truncated: boolean;
	channels_truncated: boolean;
	properties_truncated: boolean;
	state_truncated: boolean;
	last_event: HomeSnapshotSecurityLastEvent | null;
}

export interface HomeSnapshotLimits {
	spaces_truncated: boolean;
	devices_truncated: boolean;
	scenes_truncated: boolean;
}

export interface HomeSnapshotResult {
	scope: HomeSnapshotScope;
	spaces: HomeSnapshotSpace[];
	devices: HomeSnapshotDevice[];
	scenes: HomeSnapshotScene[];
	weather: HomeSnapshotWeather | null;
	energy: HomeSnapshotEnergy | null;
	security: HomeSnapshotSecurity | null;
	limits: HomeSnapshotLimits;
}

export interface HomeContextSpaceSummary {
	id: string;
	name: string;
	type: string;
}

export interface HomeContextSpacePageResult {
	spaces: HomeContextSpaceSummary[];
	nextCursor?: string;
}
