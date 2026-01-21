import type { ISpace } from '../store';

export interface IMediaRoleDevice {
	deviceId: string;
	deviceName: string;
	deviceCategory: string;
}

export interface IMediaRoleSummary {
	role: string;
	devices: IMediaRoleDevice[];
}

export interface ISpaceMediaRolesSummaryProps {
	space: ISpace;
}
