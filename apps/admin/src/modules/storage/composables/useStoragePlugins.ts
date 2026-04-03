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
			pluginsManager.getPlugins().filter((plugin) => plugin.modules?.includes(STORAGE_MODULE_NAME)),
			[(plugin) => plugin.name],
			['asc'],
		);
	});

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name']; disabled: boolean }[]>(() => {
		return plugins.value.map((plugin) => ({
			value: plugin.type,
			label: plugin.name,
			disabled: !enabled(plugin.type),
		}));
	});

	return { plugins, options };
};
