import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, type IPluginElement, injectPluginsManager } from '../../../common';
import { CONFIG_MODULE_NAME, CONFIG_MODULE_PLUGIN_TYPE } from '../config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../config.types';

import type { IUsePlugins } from './types';

export const usePlugins = (): IUsePlugins => {
	const pluginsManager = injectPluginsManager();

	const plugins = computed<IPlugin<IPluginsComponents, IPluginsSchemas>[]>((): IPlugin<IPluginsComponents, IPluginsSchemas>[] => {
		const plugins = pluginsManager.getPlugins();

		return plugins.filter((plugin) => plugin.modules?.includes(CONFIG_MODULE_NAME));
	});

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name'] }[]>((): { value: IPlugin['type']; label: IPlugin['name'] }[] => {
		return orderBy<IPlugin>(plugins.value, [(plugin) => plugin.name], ['asc']).map((plugin) => ({
			value: plugin.type,
			label: plugin.name,
		}));
	});

	const getByName = (type: IPlugin['type']): IPlugin<IPluginsComponents, IPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	const getElement = (type: IPlugin['type']): IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type)?.elements?.find((element) => element.type === CONFIG_MODULE_PLUGIN_TYPE);
	};

	return {
		plugins,
		options,
		getByName,
		getElement,
	};
};
