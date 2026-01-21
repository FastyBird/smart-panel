import type { ISpace } from '../store';

export interface ISensorRoleAssignment {
	deviceId: string;
	deviceName: string;
	channelId: string;
	channelName: string;
	channelCategory: string;
}

export interface ISensorRoleSummary {
	role: string;
	sensors: ISensorRoleAssignment[];
}

export interface ISpaceSensorRolesSummaryProps {
	space: ISpace;
}
