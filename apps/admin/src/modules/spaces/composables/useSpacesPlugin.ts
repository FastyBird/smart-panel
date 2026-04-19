import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { SPACES_MODULE_NAME } from '../spaces.constants';
import type { ISpacePluginRoutes, ISpacePluginsComponents, ISpacePluginsSchemas } from '../spaces.types';

import type { IUseSpacesPlugin } from './types';
import { useSpacesPlugins } from './useSpacesPlugins';

interface IUsePluginProps {
	type: IPluginElement['type'];
}

export const useSpacesPlugin = ({ type }: IUsePluginProps): IUseSpacesPlugin => {
	const { getByType } = useSpacesPlugins();

	const plugin = computed<IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined>(
		(): IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<ISpacePluginsComponents, ISpacePluginsSchemas> | undefined>(
		(): IPluginElement<ISpacePluginsComponents, ISpacePluginsSchemas> | undefined => {
			return (plugin.value?.elements ?? []).find(
				(element) => element.type === type && (typeof element.modules === 'undefined' || element.modules.includes(SPACES_MODULE_NAME))
			);
		}
	);

	return {
		plugin,
		element,
	};
};
