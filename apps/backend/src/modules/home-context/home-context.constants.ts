export const HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY = 'mcp-compatibility' as const;

export type HomeContextProfile = typeof HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY;

export interface HomeContextLimitProfile {
	spaces: number;
	devices: number;
	scenes: number;
	forecastDays: number;
	securityAlerts: number;
	securityDevices: number;
	securityChannelsPerDevice: number;
	securityPropertiesPerChannel: number;
	channelsPerDevice: number;
	propertiesPerChannel: number;
	timeseriesRangeDays: number;
	timeseriesPoints: number;
	energyRangeDays: number;
}

export const HOME_CONTEXT_LIMIT_PROFILES: Readonly<Record<HomeContextProfile, Readonly<HomeContextLimitProfile>>> =
	Object.freeze({
		[HOME_CONTEXT_PROFILE_MCP_COMPATIBILITY]: Object.freeze({
			spaces: 50,
			devices: 100,
			scenes: 50,
			forecastDays: 5,
			securityAlerts: 20,
			securityDevices: 100,
			securityChannelsPerDevice: 10,
			securityPropertiesPerChannel: 20,
			channelsPerDevice: 20,
			propertiesPerChannel: 40,
			timeseriesRangeDays: 14,
			timeseriesPoints: 500,
			energyRangeDays: 31,
		}),
	});
