import type { ComputedRef, Ref } from 'vue';

import { z } from 'zod';

import type { ILogEntry } from '../store/logs-entries.store.types';
import type { ISystemInfo } from '../store/system-info.store.types';
import type { IThrottleStatus } from '../store/throttle-status.store.types';

import { SystemLogsFilterSchema } from './schemas';

export type ISystemLogsFilter = z.infer<typeof SystemLogsFilterSchema>;

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

export interface IUseSystemLogsDataSource {
	systemLogs: ComputedRef<ILogEntry[]>;
	hasMore: Ref<boolean>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchSystemLogs: () => Promise<void>;
	loadMoreSystemLogs: () => Promise<void>;
	filters: Ref<ISystemLogsFilter>;
	filtersActive: ComputedRef<boolean>;
	resetFilter: () => void;
	live: Ref<boolean>;
	refreshSystemLogs: () => Promise<void>;
}

export interface IUseSystemLog {
	systemLog: ComputedRef<ILogEntry | null>;
	isLoading: ComputedRef<boolean>;
}
