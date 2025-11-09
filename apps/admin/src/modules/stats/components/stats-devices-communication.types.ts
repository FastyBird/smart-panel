import type { IDevicesModuleSection } from '../schemas/sections.types';

export type IStatsDevicesCommunicationProps = {
	devicesModuleSection: IDevicesModuleSection | undefined;
	loading: boolean;
};
