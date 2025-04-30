import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas } from '../devices.types';

import type { IUseChannelsPropertiesPlugins } from './types';

export const useChannelsPropertiesPlugins = (): IUseChannelsPropertiesPlugins => {
	const pluginsManager = injectPluginsManager();

	const pluginComponents: (keyof IChannelPropertyPluginsComponents)[] = ['channelPropertyAddForm', 'channelPropertyEditForm'];

	const pluginSchemas: (keyof IChannelPropertyPluginsSchemas)[] = [
		'channelPropertySchema',
		'channelPropertyAddFormSchema',
		'channelPropertyEditFormSchema',
		'channelPropertyCreateReqSchema',
		'channelPropertyUpdateReqSchema',
	];

	const plugins = computed<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas>[]>(
		(): IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas>[] => {
			return pluginsManager.getPlugins().filter((plugin) => {
				const hasComponent = pluginComponents.some((key) => plugin.components && key in plugin.components) ?? true;

				const hasSchema = pluginSchemas.some((key) => plugin.schemas && key in plugin.schemas) ?? true;

				return plugin.modules?.includes(DEVICES_MODULE_NAME) && (hasComponent || hasSchema);
			});
		}
	);

	const options = computed<{ value: IPlugin['type']; label: IPlugin['name'] }[]>((): { value: IPlugin['type']; label: IPlugin['name'] }[] => {
		return orderBy<IPlugin>(plugins.value, [(plugin) => plugin.name], ['asc']).map((plugin) => ({
			value: plugin.type,
			label: plugin.name,
		}));
	});

	const getByType = (type: IPlugin['type']): IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	return {
		plugins,
		options,
		getByType,
	};
};
