import type { ISpace } from '../store';

export interface ILightingRoleDevice {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
}

export interface ILightingRoleSummary {
	role: string;
	devices: ILightingRoleDevice[];
}

export interface ISpaceLightingRolesSummaryProps {
	space: ISpace;
}
