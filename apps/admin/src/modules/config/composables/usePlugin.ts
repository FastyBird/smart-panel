import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { CONFIG_MODULE_PLUGIN_TYPE } from '../config.constants';
import type { IPluginsComponents, IPluginsSchemas } from '../config.types';

import type { IUsePlugin } from './types';
import { usePlugins } from './usePlugins';

interface IUsePluginProps {
	name: IPlugin['type'];
}

export const usePlugin = ({ name }: IUsePluginProps): IUsePlugin => {
	const { getByName } = usePlugins();

	const plugin = computed<IPlugin<IPluginsComponents, IPluginsSchemas> | undefined>((): IPlugin<IPluginsComponents, IPluginsSchemas> | undefined => {
		return getByName(name);
	});

	const element = computed<IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined>(
		(): IPluginElement<IPluginsComponents, IPluginsSchemas> | undefined => {
			return plugin.value?.elements?.find((element) => element.type === CONFIG_MODULE_PLUGIN_TYPE);
		}
	);

	return {
		plugin,
		element,
	};
};
