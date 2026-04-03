import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { useConfigPlugins } from '../../config/composables/useConfigPlugins';
import { STORAGE_MODULE_NAME } from '../storage.constants';

export const useStoragePlugins = () => {
	const pluginsManager = injectPluginsManager();
	const { enabled } = useConfigPlugins();

	const plugins = computed<IPlugin[]>((): IPlugin[] => {
		return orderBy(
			pluginsManager.getPlugins().filter((plugin) => plugin.modules?.includes(STORAGE_MODULE_NAME) && enabled(plugin.type)),
			[(plugin) => plugin.name],
			['asc'],
		);
	});

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name'] }[]>(() => {
		return plugins.value.map((plugin) => ({
			value: plugin.type,
			label: plugin.name,
		}));
	});

	return { plugins, options };
};
