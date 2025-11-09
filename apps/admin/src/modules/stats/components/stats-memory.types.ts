import type { ISystemInfo } from '../../system';
import type { ISystemModuleSection } from '../schemas/sections.types';

export type IStatsMemoryProps = {
	systemModuleSection: ISystemModuleSection | undefined;
	systemInfo: ISystemInfo | null;
	loading: boolean;
};
