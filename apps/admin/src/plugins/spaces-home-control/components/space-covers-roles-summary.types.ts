import type { ISpace } from '../../../modules/spaces/store';

export interface ICoversRoleDevice {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
}

export interface ICoversRoleSummary {
	role: string;
	devices: ICoversRoleDevice[];
}

export interface ISpaceCoversRolesSummaryProps {
	space: ISpace;
}
