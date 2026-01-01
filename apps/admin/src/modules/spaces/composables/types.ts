import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { FormResultType, SpaceType } from '../spaces.constants';
import type { ISpace, ISpaceEditData } from '../store/spaces.store.types';

import type { SpaceAddFormSchemaType, SpaceEditFormSchemaType } from './schemas';

export interface ISpacesFilter {
	search?: string | undefined;
	type: SpaceType | 'all';
}

export interface IUseSpacesDataSource {
	spaces: ComputedRef<ISpace[]>;
	spacesPaginated: ComputedRef<ISpace[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchSpaces: () => Promise<void>;
	filters: Ref<ISpacesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'type' | 'displayOrder' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseSpace {
	space: ComputedRef<ISpace | null>;
	fetching: ComputedRef<boolean>;
	fetchSpace: () => Promise<ISpace | null>;
	editSpace: (data: ISpaceEditData) => Promise<ISpace>;
	removeSpace: () => Promise<void>;
}

export interface IUseSpaces {
	spaces: ComputedRef<ISpace[]>;
	roomSpaces: ComputedRef<ISpace[]>;
	zoneSpaces: ComputedRef<ISpace[]>;
	floorZoneSpaces: ComputedRef<ISpace[]>;
	fetching: ComputedRef<boolean>;
	firstLoadFinished: ComputedRef<boolean>;
	fetchSpaces: () => Promise<ISpace[]>;
	findById: (id: ISpace['id']) => ISpace | null;
}

export interface IUseSpacesActions {
	remove: (id: ISpace['id']) => Promise<boolean>;
	bulkRemove: (spaces: ISpace[]) => Promise<void>;
}

export type ISpaceAddForm = SpaceAddFormSchemaType;

export type ISpaceEditForm = SpaceEditFormSchemaType;

export interface IUseSpaceAddForm<TForm extends ISpaceAddForm = ISpaceAddForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	createdSpace: Ref<ISpace | null>;
}

export interface IUseSpaceEditForm<TForm extends ISpaceEditForm = ISpaceEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}
