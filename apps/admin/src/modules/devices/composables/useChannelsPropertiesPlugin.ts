import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas } from '../devices.types';

import type { IUseChannelsPropertiesPlugin } from './types';
import { useChannelsPropertiesPlugins } from './useChannelsPropertiesPlugins';

interface IUsePluginProps {
	type: IPluginElement['type'];
}

export const useChannelsPropertiesPlugin = ({ type }: IUsePluginProps): IUseChannelsPropertiesPlugin => {
	const { getByType } = useChannelsPropertiesPlugins();

	const plugin = computed<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>(
		(): IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>(
		(): IPluginElement<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined => {
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
