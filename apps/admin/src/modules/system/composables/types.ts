import type { ComputedRef } from 'vue';

import type { ISystemInfo } from '../store/system-info.store.types';
import type { IThrottleStatus } from '../store/throttle-status.store.types';

export interface IUseSystemInfo {
	systemInfo: ComputedRef<ISystemInfo | null>;
	isLoading: ComputedRef<boolean>;
	fetchSystemInfo: () => Promise<void>;
}

export interface IUseThrottleStatus {
	throttleStatus: ComputedRef<IThrottleStatus | null>;
	isLoading: ComputedRef<boolean>;
	fetchThrottleStatus: () => Promise<void>;
}

export interface IUseSystemActions {
	onRestart: () => void;
	onPowerOff: () => void;
	onFactoryReset: () => void;
}
