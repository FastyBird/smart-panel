import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import type { IDataSourcePluginsComponents, IDataSourcePluginsSchemas } from '../dashboard.types';

import type { IUseDataSourcesPlugin } from './types';
import { useDataSourcesPlugins } from './useDataSourcesPlugins';

interface IUsePluginProps {
	type: IPlugin['type'];
}

export const useDataSourcesPlugin = ({ type }: IUsePluginProps): IUseDataSourcesPlugin => {
	const { getByType } = useDataSourcesPlugins();

	const plugin = computed<IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>(
		(): IPlugin<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined>(
		(): IPluginElement<IDataSourcePluginsComponents, IDataSourcePluginsSchemas> | undefined => {
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
