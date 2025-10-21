import type { StoreInjectionKey } from '../../../common';

import type { IDisplaysProfilesStoreActions, IDisplaysProfilesStoreState } from './displays-profiles.store.types';
import type { ILogsEntriesStoreActions, ILogsEntriesStoreState } from './logs-entries.store.types';
import type { ISystemInfoStoreActions, ISystemInfoStoreState } from './system-info.store.types';
import type { IThrottleStatusStoreActions, IThrottleStatusStoreState } from './throttle-status.store.types';

export const systemInfoStoreKey: StoreInjectionKey<string, ISystemInfoStoreState, object, ISystemInfoStoreActions> =
	Symbol('FB-Module-System-SystemInfo');

export const throttleStatusStoreKey: StoreInjectionKey<string, IThrottleStatusStoreState, object, IThrottleStatusStoreActions> =
	Symbol('FB-Module-System-ThrottleStatus');

export const displaysStoreKey: StoreInjectionKey<string, IDisplaysProfilesStoreState, object, IDisplaysProfilesStoreActions> =
	Symbol('FB-Module-System-Displays');

export const logsEntriesStoreKey: StoreInjectionKey<string, ILogsEntriesStoreState, object, ILogsEntriesStoreActions> =
	Symbol('FB-Module-System-LogsEntries');
