import type { ISystemInfo } from '../../system';
import type { ISystemModuleSection } from '../schemas/sections.types';

export type IStatsCpuProps = {
	systemModuleSection: ISystemModuleSection | undefined;
	systemInfo: ISystemInfo | null;
	loading: boolean;
};
