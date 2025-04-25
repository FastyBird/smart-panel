import { computed } from 'vue';

import { type IPlugin } from '../../../common';
import type { IPagePluginRoutes, IPagePluginsComponents, IPagePluginsSchemas } from '../dashboard.types';

import type { IUsePagesPlugin } from './types';
import { usePagesPlugins } from './usePagesPlugins';

interface IUsePluginProps {
	type: IPlugin['type'];
}

export const usePagesPlugin = ({ type }: IUsePluginProps): IUsePagesPlugin => {
	const { getByType } = usePagesPlugins();

	const plugin = computed<IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined>(
		(): IPlugin<IPagePluginsComponents, IPagePluginsSchemas, IPagePluginRoutes> | undefined => {
			return getByType(type);
		}
	);

	return {
		plugin,
	};
};
