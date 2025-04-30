import { computed } from 'vue';

import { type IPlugin } from '../../../common';
import type { IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas } from '../devices.types';

import type { IUseChannelsPropertiesPlugin } from './types';
import { useChannelsPropertiesPlugins } from './useChannelsPropertiesPlugins';

interface IUsePluginProps {
	type: IPlugin['type'];
}

export const useChannelsPropertiesPlugin = ({ type }: IUsePluginProps): IUseChannelsPropertiesPlugin => {
	const { getByType } = useChannelsPropertiesPlugins();

	const plugin = computed<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined>(
		(): IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	return {
		plugin,
	};
};
