import { computed } from 'vue';

import { type IPlugin } from '../../../common';
import type { IDevicePluginsComponents, IDevicePluginsSchemas } from '../devices.types';

import type { IUseDevicesPlugin } from './types';
import { useDevicesPlugins } from './useDevicesPlugins';

interface IUsePluginProps {
	type: IPlugin['type'];
}

export const useDevicesPlugin = ({ type }: IUsePluginProps): IUseDevicesPlugin => {
	const { getByType } = useDevicesPlugins();

	const plugin = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(
		(): IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	return {
		plugin,
	};
};
