import type { ComputedRef, Reactive, Ref } from 'vue';

import type { FormInstance } from 'element-plus';

import type { IModule, IModuleElement, IPlugin, IPluginElement } from '../../../common';
// Language, Weather, and System form types removed - these configs are now accessed via modules
import type { FormResultType } from '../config.constants';
import type { IModulesComponents, IModulesSchemas, IPluginsComponents, IPluginsSchemas } from '../config.types';
import type { IConfigModuleEditForm } from '../schemas/modules.types';
import type { IConfigPluginEditForm } from '../schemas/plugins.types';
import type { IConfigApp } from '../store/config-app.store.types';
// Deprecated store types removed - language, weather, system configs are now accessed via modules
import type { IConfigPlugin } from '../store/config-plugins.store.types';
import type { IConfigModule } from '../store/config-modules.store.types';

export interface IUseConfigApp {
	configApp: ComputedRef<IConfigApp | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigApp: () => Promise<void>;
}

// Language, Weather, and System composable interfaces removed - these configs are now accessed via modules

export interface IUseConfigPlugin {
	configPlugin: ComputedRef<IConfigPlugin | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigPlugin: () => Promise<void>;
}

export interface IUseConfigPlugins {
	configPlugins: ComputedRef<IConfigPlugin[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	enabled: (type: IConfigPlugin['type']) => boolean;
	fetchConfigPlugins: (force?: boolean) => Promise<void>;
}

export interface IUseConfigPluginEditForm<TForm extends IConfigPluginEditForm = IConfigPluginEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUsePlugin {
	plugin: ComputedRef<IPlugin<IPluginsComponents, IPluginsSchemas> | undefined>;
	element: ComputedRef<IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined>;
}

export interface IUsePlugins {
	plugins: ComputedRef<IPlugin<IPluginsComponents, IPluginsSchemas>[]>;
	options: ComputedRef<{ value: IPlugin['type']; label: IPlugin['name'] }[]>;
	getByName: (type: IPlugin['type']) => IPlugin<IPluginsComponents, IPluginsSchemas> | undefined;
	getElement: (type: IPlugin['type']) => IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined;
}

export interface IUseConfigModule {
	configModule: ComputedRef<IConfigModule | null>;
	isLoading: ComputedRef<boolean>;
	fetchConfigModule: () => Promise<void>;
}

export interface IUseConfigModules {
	configModules: ComputedRef<IConfigModule[]>;
	areLoading: ComputedRef<boolean>;
	loaded: ComputedRef<boolean>;
	enabled: (type: IConfigModule['type']) => boolean;
	fetchConfigModules: (force?: boolean) => Promise<void>;
}

export interface IUseConfigModuleEditForm<TForm extends IConfigModuleEditForm = IConfigModuleEditForm> {
	model: Reactive<TForm>;
	formEl: Ref<FormInstance | undefined>;
	formChanged: Ref<boolean>;
	submit: () => Promise<'saved'>;
	clear: () => void;
	formResult: Ref<FormResultType>;
}

export interface IUseModule {
	module: ComputedRef<IModule<IModulesComponents, IModulesSchemas> | undefined>;
	element: ComputedRef<IModuleElement<IModulesComponents, IModulesSchemas> | undefined>;
}

export interface IUseModules {
	modules: ComputedRef<IModule<IModulesComponents, IModulesSchemas>[]>;
	options: ComputedRef<{ value: IModule['type']; label: IModule['name'] }[]>;
	getByName: (type: IModule['type']) => IModule<IModulesComponents, IModulesSchemas> | undefined;
	getElement: (type: IModule['type']) => IModuleElement<IModulesComponents, IModulesSchemas> | undefined;
}
