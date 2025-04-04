import { computed } from 'vue';

import { type IPlugin } from '../../../common';
import type { IPluginsComponents, IPluginsSchemas } from '../index';

import type { IUsePlugin } from './types';
import { usePlugins } from './usePlugins';

interface IUsePluginProps {
	type: IPlugin['type'];
}

export const usePlugin = ({ type }: IUsePluginProps): IUsePlugin => {
	const { getByType } = usePlugins();

	const plugin = computed<IPlugin<IPluginsComponents, IPluginsSchemas> | undefined>((): IPlugin<IPluginsComponents, IPluginsSchemas> | undefined => {
		return getByType(type);
	});

	return {
		plugin,
	};
};
