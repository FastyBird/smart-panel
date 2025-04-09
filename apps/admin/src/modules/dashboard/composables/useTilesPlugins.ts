import { computed } from 'vue';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { ITilePluginsComponents, ITilePluginsSchemas } from '../dashboard.types';

import type { IUseTilesPlugins } from './types';

export const useTilesPlugins = (): IUseTilesPlugins => {
	const pluginsManager = injectPluginsManager();

	const plugins = computed<IPlugin<ITilePluginsComponents, ITilePluginsSchemas>[]>((): IPlugin<ITilePluginsComponents, ITilePluginsSchemas>[] => {
		const plugins = pluginsManager.getPlugins();

		return plugins.filter((plugin) => plugin.modules?.includes(DASHBOARD_MODULE_NAME));
	});

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name'] }[]>((): { value: IPlugin['type']; label: IPlugin['name'] }[] => {
		return plugins.value.map((plugin) => ({
			value: plugin.type,
			label: plugin.name,
		}));
	});

	const getByType = (type: IPlugin['type']): IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	return {
		plugins,
		options,
		getByType,
	};
};
