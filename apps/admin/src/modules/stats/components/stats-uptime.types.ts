import type { ISystemModuleSection } from '../schemas/sections.types';

export type IStatsUptimeProps = {
	systemModuleSection: ISystemModuleSection | undefined;
	loading: boolean;
};
