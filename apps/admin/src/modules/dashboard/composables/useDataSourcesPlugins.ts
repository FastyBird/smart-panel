import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { IDataSourcePluginsComponents, IDataSourcePluginsSchemas } from '../dashboard.types';

import type { IUseDataSourcesPlugins } from './types';

export const useDataSourcesPlugins = (): IUseDataSourcesPlugins => {
	const pluginsManager = injectPluginsManager();

	const pluginComponents: (keyof IDataSourcePluginsComponents)[] = ['dataSourceAddForm', 'dataSourceEditForm'];

	const pluginSchemas: (keyof IDataSourcePluginsSchemas)[] = [
		'dataSourceSchema',
		'dataSourceAddFormSchema',
		'dataSourceEditFormSchema',
		'dataSourceCreateReqSchema',
		'dataSourceUpdateReqSchema',
	];

	const plugins = computed<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>[]>(
		(): IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas>[] => {
			return pluginsManager.getPlugins().filter((plugin) => {
				const hasComponent = pluginComponents.some((key) => plugin.components && key in plugin.components) ?? true;

				const hasSchema = pluginSchemas.some((key) => plugin.schemas && key in plugin.schemas) ?? true;

				return plugin.modules?.includes(DASHBOARD_MODULE_NAME) && (hasComponent || hasSchema);
			});
		}
	);

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name'] }[]>((): { value: IPlugin['type']; label: IPlugin['name'] }[] => {
		return orderBy<IPlugin>(plugins.value, [(plugin) => plugin.name], ['asc']).map((plugin) => ({
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
