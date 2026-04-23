import type { ISpace } from '../../../modules/spaces/store';

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
