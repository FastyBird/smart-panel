import { HomeContextProfile } from '../home-context.constants';

export type HomeTimeseriesBucket = '1m' | '5m' | '15m' | '1h';

export interface HomeDeviceStateQuery {
	deviceId: string;
	profile: HomeContextProfile;
}

export interface HomePropertyTimeseriesQuery {
	propertyId: string;
	from: string;
	to: string;
	bucket: HomeTimeseriesBucket;
	profile: HomeContextProfile;
}

export interface HomeEnergySummaryQuery {
	from?: string;
	to?: string;
	spaceId?: string;
	profile: HomeContextProfile;
}

export interface HomeWeatherQuery {
	locationId?: string;
	profile: HomeContextProfile;
}

export interface HomeSecurityStatusQuery {
	profile: HomeContextProfile;
}
