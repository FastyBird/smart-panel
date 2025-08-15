import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IDisplayProfileEditForm } from '../schemas/displays-profiles.types';
import type { IDisplayProfile } from '../store/displays-profiles.store.types';
import type { ISystemInfo } from '../store/system-info.store.types';
import type { IThrottleStatus } from '../store/throttle-status.store.types';
import type { FormResultType } from '../system.constants';

export interface IDisplaysProfilesFilter {
	search: string | undefined;
}

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
	sortBy: Ref<'uid' | 'screenWidth' | 'screenHeight' | 'pixelRatio' | 'rows' | 'cols' | 'primary'>;
	sortDir: Ref<'ascending' | 'descending' | null>;
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
