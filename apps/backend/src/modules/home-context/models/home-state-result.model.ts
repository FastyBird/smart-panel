import { HomeSnapshotEnergy, HomeSnapshotSecurity, HomeSnapshotWeather } from './home-context-result.model';

export interface HomeDevicePropertyResult {
	id: string;
	name: string;
	category: string;
	data_type: string;
	unit: string | null;
	value: string | number | boolean | null;
	last_updated: string | null;
	trend: string | null;
}

export interface HomeDeviceChannelResult {
	id: string;
	name: string;
	category: string;
	properties: HomeDevicePropertyResult[];
	properties_truncated: boolean;
}

export interface HomeDeviceStateResult {
	id: string;
	name: string;
	category: string;
	enabled: boolean;
	room_id: string | null;
	zone_ids: string[];
	status: {
		online: boolean;
		state: string;
		last_changed: string | null;
	};
	channels: HomeDeviceChannelResult[];
	channels_truncated: boolean;
}

export interface HomeTimeseriesPointResult {
	time: string;
	value: string | number | boolean | null;
}

export interface HomePropertyTimeseriesResult {
	property_id: string;
	from: string;
	to: string;
	bucket: string | null;
	points: HomeTimeseriesPointResult[];
	truncated: boolean;
}

export type HomeEnergySummaryResult = HomeSnapshotEnergy;

export type HomeWeatherResult = HomeSnapshotWeather;

export type HomeSecurityStatusResult = HomeSnapshotSecurity;
