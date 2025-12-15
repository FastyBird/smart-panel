import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { ITilePluginsComponents, ITilePluginsSchemas } from '../dashboard.types';

import type { IUseTilesPlugin } from './types';
import { useTilesPlugins } from './useTilesPlugins';

interface IUsePluginProps {
	type: IPluginElement['type'];
}

export const useTilesPlugin = ({ type }: IUsePluginProps): IUseTilesPlugin => {
	const { getByType } = useTilesPlugins();

	const plugin = computed<IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(
		(): IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(
		(): IPluginElement<ITilePluginsComponents, ITilePluginsSchemas> | undefined => {
			return (plugin.value?.elements ?? []).find(
				(element) => element.type === type && (typeof element.modules === 'undefined' || element.modules.includes(DASHBOARD_MODULE_NAME))
			);
		}
	);

	return {
		plugin,
		element,
	};
};
