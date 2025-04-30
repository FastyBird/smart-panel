import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, injectPluginsManager } from '../../../common';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IDevicePluginsComponents, IDevicePluginsSchemas } from '../devices.types';

import type { IUseDevicesPlugins } from './types';

export const useDevicesPlugins = (): IUseDevicesPlugins => {
	const pluginsManager = injectPluginsManager();

	const pluginComponents: (keyof IDevicePluginsComponents)[] = ['deviceAddForm', 'deviceEditForm'];

	const pluginSchemas: (keyof IDevicePluginsSchemas)[] = [
		'deviceSchema',
		'deviceAddFormSchema',
		'deviceEditFormSchema',
		'deviceCreateReqSchema',
		'deviceUpdateReqSchema',
	];

	const plugins = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas>[]>(
		(): IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas>[] => {
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

	const getByType = (type: IPlugin['type']): IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	return {
		plugins,
		options,
		getByType,
	};
};
