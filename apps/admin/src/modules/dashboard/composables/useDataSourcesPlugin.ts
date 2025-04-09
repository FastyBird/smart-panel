import { computed } from 'vue';

import { type IPlugin } from '../../../common';
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

	return {
		plugin,
	};
};
