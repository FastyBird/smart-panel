import type { ISpace } from '../store';

export interface IClimateRoleDevice {
	deviceId: string;
	deviceName: string;
	deviceCategory: string;
}

export interface IClimateRoleSummary {
	role: string;
	devices: IClimateRoleDevice[];
}

export interface ISpaceClimateRolesSummaryProps {
	space: ISpace;
}
