import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IChannelPluginsComponents, IChannelPluginsSchemas } from '../devices.types';

import type { IUseChannelsPlugin } from './types';
import { useChannelsPlugins } from './useChannelsPlugins';

interface IUsePluginProps {
	type: IPluginElement['type'];
}

export const useChannelsPlugin = ({ type }: IUsePluginProps): IUseChannelsPlugin => {
	const { getByType } = useChannelsPlugins();

	const plugin = computed<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(
		(): IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(
		(): IPluginElement<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined => {
			return plugin.value?.elements.find(
				(element) => element.type === type && (typeof element.modules === 'undefined' || element.modules.includes(DEVICES_MODULE_NAME))
			);
		}
	);

	return {
		plugin,
		element,
	};
};
