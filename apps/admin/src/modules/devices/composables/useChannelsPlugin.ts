import { computed } from 'vue';

import { type IPlugin } from '../../../common';
import type { IChannelPluginsComponents, IChannelPluginsSchemas } from '../devices.types';

import type { IUseChannelsPlugin } from './types';
import { useChannelsPlugins } from './useChannelsPlugins';

interface IUsePluginProps {
	type: IPlugin['type'];
}

export const useChannelsPlugin = ({ type }: IUsePluginProps): IUseChannelsPlugin => {
	const { getByType } = useChannelsPlugins();

	const plugin = computed<IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined>(
		(): IPlugin<IChannelPluginsComponents, IChannelPluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	return {
		plugin,
	};
};
