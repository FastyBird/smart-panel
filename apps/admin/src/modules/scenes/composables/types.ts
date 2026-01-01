import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';
import { z } from 'zod';

import type { IPlugin, IPluginElement } from '../../../common';
import type { SpaceType } from '../../spaces/spaces.constants';
import type { ISpace } from '../../spaces/store/spaces.store.types';
import type { ISceneAddForm, ISceneEditForm } from '../schemas/scenes.types';
import type { FormResultType, SceneCategory } from '../scenes.constants';
import type { ISceneActionPluginsComponents, ISceneActionPluginsSchemas } from '../scenes.types';
import type { IScene } from '../store/scenes.store.types';

import { ScenesFilterSchema } from './schemas';

export type IScenesFilter = z.infer<typeof ScenesFilterSchema>;

export interface ISpaceOption {
	value: ISpace['id'];
	label: string;
	icon: string;
}

export interface ISpaceOptionGroup {
	type: SpaceType;
	label: string;
	icon: string;
	options: ISpaceOption[];
}

export interface IUseScene {
	scene: ComputedRef<IScene | null>;
	isLoading: ComputedRef<boolean>;
	fetchScene: () => Promise<void>;
}

export interface IUseSceneIcon {
	icon: ComputedRef<string>;
}

export interface ICategoryOption {
	value: SceneCategory;
	label: string;
	icon: string;
}

export interface IUseSceneAddForm<TForm extends ISceneAddForm = ISceneAddForm> {
	categoriesOptions: ComputedRef<ICategoryOption[]>;
	spacesOptionsGrouped: ComputedRef<ISpaceOptionGroup[]>;
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingSpaces: ComputedRef<boolean>;
	fetchSpaces: () => Promise<ISpace[]>;
}

export interface IUseSceneEditForm<TForm extends ISceneEditForm = ISceneEditForm> {
	categoriesOptions: ComputedRef<ICategoryOption[]>;
	spacesOptionsGrouped: ComputedRef<ISpaceOptionGroup[]>;
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'added' | 'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
	loadingSpaces: ComputedRef<boolean>;
	fetchSpaces: () => Promise<ISpace[]>;
}

export interface IUseScenesDataSource {
	scenes: ComputedRef<IScene[]>;
	scenesPaginated: ComputedRef<IScene[]>;
	totalRows: ComputedRef<number>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	fetchScenes: () => Promise<void>;
	filters: Ref<IScenesFilter>;
	filtersActive: ComputedRef<boolean>;
	paginateSize: Ref<number>;
	paginatePage: Ref<number>;
	sortBy: Ref<'name' | 'category' | 'order' | undefined>;
	sortDir: Ref<'asc' | 'desc' | null>;
	resetFilter: () => void;
}

export interface IUseScenesActions {
	remove: (id: IScene['id']) => Promise<void>;
	trigger: (id: IScene['id'], source?: string) => Promise<void>;
}

export interface IUseScenesActionPlugins {
	plugins: ComputedRef<IPlugin<ISceneActionPluginsComponents, ISceneActionPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPluginElement['type']; label: string; disabled: boolean }[]>;
	getByName: (type: IPlugin['type']) => IPlugin<ISceneActionPluginsComponents, ISceneActionPluginsSchemas> | undefined;
	getByType: (type: IPluginElement['type']) => IPlugin<ISceneActionPluginsComponents, ISceneActionPluginsSchemas> | undefined;
	getElement: (type: IPluginElement['type']) => IPluginElement<ISceneActionPluginsComponents, ISceneActionPluginsSchemas> | undefined;
}
