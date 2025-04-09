import { computed } from 'vue';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { IDataSourcePluginsComponents, IDataSourcePluginsSchemas } from '../dashboard.types';

import type { IUseDataSourcesPlugins } from './types';

export const useDataSourcesPlugins = (): IUseDataSourcesPlugins => {
	const pluginsManager = injectPluginsManager();

	const plugins = computed<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>[]>(
		(): IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>[] => {
			const plugins = pluginsManager.getPlugins();

			return plugins.filter((plugin) => plugin.modules?.includes(DASHBOARD_MODULE_NAME));
		}
	);

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name'] }[]>((): { value: IPlugin['type']; label: IPlugin['name'] }[] => {
		return plugins.value.map((plugin) => ({
			value: plugin.type,
			label: plugin.name,
		}));
	});

	const getByType = (type: IPlugin['type']): IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	return {
		plugins,
		options,
		getByType,
	};
};
