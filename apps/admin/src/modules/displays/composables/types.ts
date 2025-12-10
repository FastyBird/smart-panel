import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { z } from 'zod';

import type { FormResultType } from '../displays.constants';
import type { IDisplay, IDisplayToken } from '../store/displays.store.types';

import { DisplaysFilterSchema } from './schemas';

export type IDisplaysFilter = z.infer<typeof DisplaysFilterSchema>;

export interface IUseDisplay {
	display: ComputedRef<IDisplay | null>;
	tokens: Ref<IDisplayToken[]>;
	isLoading: ComputedRef<boolean>;
	fetchDisplay: () => Promise<void>;
	fetchTokens: () => Promise<void>;
	revokeToken: () => Promise<boolean>;
}

export interface IUseDisplays {
	displays: ComputedRef<IDisplay[]>;
	isLoading: ComputedRef<boolean>;
	isLoaded: Ref<boolean>;
	fetchDisplays: () => Promise<void>;
	// Added for compatibility with old useDisplaysProfiles interface
	options: ComputedRef<{ value: IDisplay['id']; label: string }[]>;
	areLoading: ComputedRef<boolean>;
	loaded: Ref<boolean>;
}

export interface IUseDisplaysDataSource {
	displays: ComputedRef<IDisplay[]>;
	displaysPaginated: ComputedRef<IDisplay[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchDisplays: () => Promise<void>;
	filters: Ref<IDisplaysFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'version' | 'screenWidth' | 'createdAt' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseDisplaysActions {
	remove: (id: IDisplay['id']) => Promise<void>;
}

export interface IDisplayEditForm {
	id: string;
	name: string | null;
	unitSize: number;
	rows: number;
	cols: number;
	brightness: number;
	screenLockDuration: number;
	darkMode: boolean;
	screenSaver: boolean;
	// Audio settings
	speaker: boolean;
	speakerVolume: number;
	microphone: boolean;
	microphoneVolume: number;
}

export interface IUseDisplayEditForm {
	model: Reactive<IDisplayEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
