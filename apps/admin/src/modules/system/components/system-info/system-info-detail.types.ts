import type { ISystemInfo } from '../../store/system-info.store.types';
import type { IThrottleStatus } from '../../store/throttle-status.store.types';

export type ISystemInfoDetailProps = {
	systemInfo: ISystemInfo | null;
	throttleStatus: IThrottleStatus | null;
};
