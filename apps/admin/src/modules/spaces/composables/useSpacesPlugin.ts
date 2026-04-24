import { computed, type MaybeRefOrGetter, toValue } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { SPACES_MODULE_NAME } from '../spaces.constants';
import type { ISpacePluginRoutes, ISpacePluginsComponents, ISpacePluginsSchemas } from '../spaces.types';

import type { IUseSpacesPlugin } from './types';
import { useSpacesPlugins } from './useSpacesPlugins';

interface IUsePluginProps {
	type: MaybeRefOrGetter<IPluginElement['type']>;
}

export const useSpacesPlugin = ({ type }: IUsePluginProps): IUseSpacesPlugin => {
	const { getByType } = useSpacesPlugins();

	const plugin = computed<IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined>(
		(): IPlugin<ISpacePluginsComponents, ISpacePluginsSchemas, ISpacePluginRoutes> | undefined => {
			return getByType(toValue(type));
		}
	);

	const element = computed<IPluginElement<ISpacePluginsComponents, ISpacePluginsSchemas> | undefined>(
		(): IPluginElement<ISpacePluginsComponents, ISpacePluginsSchemas> | undefined => {
			const currentType = toValue(type);

			return (plugin.value?.elements ?? []).find(
				(element) => element.type === currentType && (typeof element.modules === 'undefined' || element.modules.includes(SPACES_MODULE_NAME))
			);
		}
	);

	return {
		plugin,
		element,
	};
};
