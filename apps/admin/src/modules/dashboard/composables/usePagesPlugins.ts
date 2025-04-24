import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { IPagePluginRoutes, IPagePluginsComponents, IPagePluginsSchemas } from '../dashboard.types';

import type { IUsePagesPlugins } from './types';

export const usePagesPlugins = (): IUsePagesPlugins => {
	const pluginsManager = injectPluginsManager();

	const pluginComponents: (keyof IPagePluginsComponents)[] = ['pageDetail', 'pageAddForm', 'pageEditForm'];

	const pluginSchemas: (keyof IPagePluginsSchemas)[] = [
		'pageSchema',
		'pageAddFormSchema',
		'pageEditFormSchema',
		'pageCreateReqSchema',
		'pageUpdateReqSchema',
	];

	const plugins = computed<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes>[]>(
		(): IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes>[] => {
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

	const getByType = (type: IPlugin['type']): IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	return {
		plugins,
		options,
		getByType,
	};
};
