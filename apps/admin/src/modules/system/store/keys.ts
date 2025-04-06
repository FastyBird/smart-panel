import type { StoreInjectionKey } from '../../../common';

import type { ISystemInfoStoreActions, ISystemInfoStoreState } from './system-info.store.types';
import type { IThrottleStatusStoreActions, IThrottleStatusStoreState } from './throttle-status.store.types';

export const systemInfoStoreKey: StoreInjectionKey<string, ISystemInfoStoreState, object, ISystemInfoStoreActions> =
	Symbol('FB-SystemModuleSystemInfo');

export const throttleStatusStoreKey: StoreInjectionKey<string, IThrottleStatusStoreState, object, IThrottleStatusStoreActions> =
	Symbol('FB-SystemModuleThrottleStatus');
