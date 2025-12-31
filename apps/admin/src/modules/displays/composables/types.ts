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
	options: ComputedRef<{ value: IDisplay['id']; label: string }[]>;
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
	sortBy: Ref<'name' | 'version' | 'screenWidth' | 'status' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseDisplaysActions {
	remove: (id: IDisplay['id']) => Promise<void>;
	bulkRemove: (displays: IDisplay[]) => Promise<void>;
}

export type HomeMode = 'auto_space' | 'explicit' | 'first_page';

export type DisplayRole = 'room' | 'master' | 'entry';

export interface IDisplayEditForm {
	id: string;
	name: string | null;
	role: DisplayRole;
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
	// Home page configuration
	homeMode: HomeMode;
	homePageId: string | null;
}

export interface IUseDisplayEditForm {
	model: Reactive<IDisplayEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
