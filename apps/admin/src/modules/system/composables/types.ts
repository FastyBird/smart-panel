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

export interface IUseUpdateStatus {
	currentVersion: Ref<string | null>;
	latestVersion: Ref<string | null>;
	updateAvailable: Ref<boolean>;
	updateType: Ref<'patch' | 'minor' | 'major' | null>;
	lastChecked: Ref<Date | null>;
	changelogUrl: Ref<string | null>;
	status: Ref<string>;
	phase: Ref<string | null>;
	progressPercent: Ref<number | null>;
	error: Ref<string | null>;
	loading: Ref<boolean>;
	installing: Ref<boolean>;
	waitingForRestart: Ref<boolean>;
	isUpdating: ComputedRef<boolean>;
	fetchStatus: () => Promise<void>;
	checkForUpdates: () => Promise<void>;
	installUpdate: (allowMajor?: boolean) => Promise<void>;
	applyStatusEvent: (payload: Record<string, unknown>) => void;
}
