import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { IPagePluginRoutes, IPagePluginsComponents, IPagePluginsSchemas } from '../dashboard.types';

import type { IUsePagesPlugin } from './types';
import { usePagesPlugins } from './usePagesPlugins';

interface IUsePluginProps {
	type: IPluginElement['type'];
}

export const usePagesPlugin = ({ type }: IUsePluginProps): IUsePagesPlugin => {
	const { getByType } = usePagesPlugins();

	const plugin = computed<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined>(
		(): IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<IPagePluginsComponents, IPagePluginsSchemas> | undefined>(
		(): IPluginElement<IPagePluginsComponents, IPagePluginsSchemas> | undefined => {
			return plugin.value?.elements.find(
				(element) => element.type === type && (typeof element.modules === 'undefined' || element.modules.includes(DASHBOARD_MODULE_NAME))
			);
		}
	);

	return {
		plugin,
		element,
	};
};
