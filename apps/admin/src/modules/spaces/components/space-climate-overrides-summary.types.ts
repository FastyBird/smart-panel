import type { DevicesModuleChannelCategory, DevicesModuleDeviceCategory } from '../../../openapi.constants';
import type { ISpace } from '../store';

export interface IDeviceChannel {
	id: string;
	category: DevicesModuleChannelCategory;
}

export interface IClimateDevice {
	id: string;
	name: string;
	category: DevicesModuleDeviceCategory;
	channels: IDeviceChannel[];
	createdAt: Date;
}

export interface ISpaceClimateOverridesSummaryProps {
	space: ISpace;
}
