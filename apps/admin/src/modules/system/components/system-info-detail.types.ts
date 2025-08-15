import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import type { ISystemInfo } from '../store/system-info.store.types';
import type { IThrottleStatus } from '../store/throttle-status.store.types';
import type { LayoutType } from '../system.constants';

export type ISystemInfoDetailProps = {
	systemInfo: ISystemInfo | null;
	throttleStatus: IThrottleStatus | null;
	displays: IDisplayProfile[];
	layout?: LayoutType;
};
