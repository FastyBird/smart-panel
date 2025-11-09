import type { IConfigApp } from '../../config';
import type { ISystemInfo } from '../../system';

export type ISystemInformationProps = {
	systemInfo: ISystemInfo | null;
	configApp: IConfigApp | null;
	loading: boolean;
};
