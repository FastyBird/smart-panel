import type { IDevicesModuleSection } from '../schemas/sections.types';

export type IStatsDevicesProps = {
	devicesModuleSection: IDevicesModuleSection | undefined;
	loading: boolean;
};
