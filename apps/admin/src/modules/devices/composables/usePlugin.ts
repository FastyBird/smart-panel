import { computed } from 'vue';

import { type IPlugin } from '../../../common';
import type { IPluginsComponents, IPluginsSchemas } from '../index';

import type { IUsePlugin } from './types';
import { usePlugins } from './usePlugins';

export const usePlugin = (type: IPlugin['type']): IUsePlugin => {
	const { getByType } = usePlugins();

	const plugin = computed<IPlugin<IPluginsComponents, IPluginsSchemas> | undefined>((): IPlugin<IPluginsComponents, IPluginsSchemas> | undefined => {
		return getByType(type);
	});

	return {
		plugin,
	};
};
