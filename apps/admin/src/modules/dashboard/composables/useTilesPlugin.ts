import { computed } from 'vue';

import { type IPlugin } from '../../../common';
import type { ITilePluginsComponents, ITilePluginsSchemas } from '../dashboard.types';

import type { IUseTilesPlugin } from './types';
import { useTilesPlugins } from './useTilesPlugins';

interface IUsePluginProps {
	type: IPlugin['type'];
}

export const useTilesPlugin = ({ type }: IUsePluginProps): IUseTilesPlugin => {
	const { getByType } = useTilesPlugins();

	const plugin = computed<IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined>(
		(): IPlugin<ITilePluginsComponents, ITilePluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	return {
		plugin,
	};
};
