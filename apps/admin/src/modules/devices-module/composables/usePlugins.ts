import { computed } from 'vue';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DEVICES_MODULE_NAME, type IPluginsComponents, type IPluginsSchemas } from '../index';

import type { IUsePlugins } from './types';

export function usePlugins(): IUsePlugins {
	const pluginsManager = injectPluginsManager();

	const plugins = computed<IPlugin<IPluginsComponents, IPluginsSchemas>[]>((): IPlugin<IPluginsComponents, IPluginsSchemas>[] => {
		const plugins = pluginsManager.getPlugins();

		return plugins.filter((plugin) => plugin.modules?.includes(DEVICES_MODULE_NAME));
	});

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name'] }[]>((): { value: IPlugin['type']; label: IPlugin['name'] }[] => {
		return plugins.value.map((plugin) => ({
			value: plugin.type,
			label: plugin.name,
		}));
	});

	const getByType = (type: IPlugin['type']): IPlugin<IPluginsComponents, IPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	return {
		plugins,
		options,
		getByType,
	};
}
