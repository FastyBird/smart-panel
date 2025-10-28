import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { z } from 'zod';

import type { IDisplayProfileEditForm } from '../schemas/displays-profiles.types';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import type { IExtension } from '../store/extensions.store.types';
import type { ILogEntry } from '../store/logs-entries.store.types';
import type { ISystemInfo } from '../store/system-info.store.types';
import type { IThrottleStatus } from '../store/throttle-status.store.types';
import type { FormResultType } from '../system.constants';

import { DisplaysProfilesFilterSchema, ExtensionsFilterSchema, SystemLogsFilterSchema } from './schemas';

export type IDisplaysProfilesFilter = z.infer<typeof DisplaysProfilesFilterSchema>;

export type ISystemLogsFilter = z.infer<typeof SystemLogsFilterSchema>;

export type IExtensionsFilter = z.infer<typeof ExtensionsFilterSchema>;

export interface IUseDisplayProfile {
	display: ComputedRef<IDisplayProfile | null>;
	isLoading: ComputedRef<boolean>;
	fetchDisplay: () => Promise<void>;
}

export interface IUseDisplaysProfiles {
	displays: ComputedRef<IDisplayProfile[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDisplays: () => Promise<void>;
	options: ComputedRef<{ value: IDisplayProfile['id']; label: string }[]>;
}

export interface IUseDisplayProfileEditForm {
	model: Reactive<IDisplayProfileEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseDisplaysProfilesActions {
	remove: (id: IDisplayProfile['id']) => Promise<void>;
}

export interface IUseDisplaysProfilesDataSource {
	displays: ComputedRef<IDisplayProfile[]>;
	displaysPaginated: ComputedRef<IDisplayProfile[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDisplays: () => Promise<void>;
	filters: Ref<IDisplaysProfilesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'uid' | 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'rows' | 'cols' | 'primary' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

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

export interface IUseExtension {
	extension: ComputedRef<{ admin?: IExtension; backend?: IExtension } | null>;
	isLoading: ComputedRef<boolean>;
	fetchExtension: () => Promise<void>;
}

export interface IUseExtensions {
	extensions: ComputedRef<{ admin?: IExtension; backend?: IExtension }[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchExtensions: () => Promise<void>;
}

export interface IUseExtensionsDataSource {
	extensions: ComputedRef<{ admin?: IExtension; backend?: IExtension }[]>;
	extensionsPaginated: ComputedRef<{ admin?: IExtension; backend?: IExtension }[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchExtensions: () => Promise<void>;
	filters: Ref<IExtensionsFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'kind' | 'surface' | 'displayName' | 'version' | 'source' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}
