import { computed } from 'vue';

import { type IPlugin, type IPluginElement } from '../../../common';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IDevicePluginsComponents, IDevicePluginsSchemas } from '../devices.types';

import type { IUseDevicesPlugin } from './types';
import { useDevicesPlugins } from './useDevicesPlugins';

interface IUsePluginProps {
	type: IPluginElement['type'];
}

export const useDevicesPlugin = ({ type }: IUsePluginProps): IUseDevicesPlugin => {
	const { getByType } = useDevicesPlugins();

	const plugin = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(
		(): IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined => {
			return getByType(type);
		}
	);

	const element = computed<IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined>(
		(): IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined => {
			return (plugin.value?.elements ?? []).find(
				(element) => element.type === type && (typeof element.modules === 'undefined' || element.modules.includes(DEVICES_MODULE_NAME))
			);
		}
	);

	return {
		plugin,
		element,
	};
};
