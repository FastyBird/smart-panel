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

export type HomeMode = 'auto_space' | 'explicit';

export type DisplayRole = 'room' | 'master' | 'entry';

export type TemperatureUnit = 'celsius' | 'fahrenheit';
export type WindSpeedUnit = 'ms' | 'kmh' | 'mph' | 'knots';
export type PressureUnit = 'hpa' | 'mbar' | 'inhg' | 'mmhg';
export type PrecipitationUnit = 'mm' | 'inches';
export type DistanceUnit = 'km' | 'miles' | 'meters' | 'feet';

export interface IDisplayEditForm {
	id: string;
	name: string | null;
	role: DisplayRole;
	// Room assignment (only for role=room displays)
	roomId: string | null;
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
	// Unit overrides (null = use system default)
	temperatureUnit: TemperatureUnit | null;
	windSpeedUnit: WindSpeedUnit | null;
	pressureUnit: PressureUnit | null;
	precipitationUnit: PrecipitationUnit | null;
	distanceUnit: DistanceUnit | null;
}

export interface IUseDisplayEditForm {
	model: Reactive<IDisplayEditForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
