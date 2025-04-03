import type { ISystemInfo, IThrottleStatus } from '../store';
import type { LayoutType } from '../system.constants';

export type ISystemInfoDetailProps = {
	systemInfo: ISystemInfo | null;
	throttleStatus: IThrottleStatus | null;
	layout?: LayoutType;
};
