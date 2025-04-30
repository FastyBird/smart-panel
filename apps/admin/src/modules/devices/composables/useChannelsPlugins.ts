import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IChannelPluginsComponents, IChannelPluginsSchemas } from '../devices.types';

import type { IUseChannelsPlugins } from './types';

export const useChannelsPlugins = (): IUseChannelsPlugins => {
	const pluginsManager = injectPluginsManager();

	const pluginComponents: (keyof IChannelPluginsComponents)[] = ['channelAddForm', 'channelEditForm'];

	const pluginSchemas: (keyof IChannelPluginsSchemas)[] = [
		'channelSchema',
		'channelAddFormSchema',
		'channelEditFormSchema',
		'channelCreateReqSchema',
		'channelUpdateReqSchema',
	];

	const plugins = computed<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas>[]>(
		(): IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas>[] => {
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

	const getByType = (type: IPlugin['type']): IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	return {
		plugins,
		options,
		getByType,
	};
};
