import type { IDashboardModuleSection } from '../schemas/sections.types';

export type IStatsDashboardProps = {
	dashboardModuleSection: IDashboardModuleSection | undefined;
	loading: boolean;
};
