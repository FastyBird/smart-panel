import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, type IPluginElement, injectPluginsManager } from '../../../common';
import { useConfigPlugins } from '../../config';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import type { IDevicePluginsComponents, IDevicePluginsSchemas } from '../devices.types';

import type { IUseDevicesPlugins } from './types';

export const useDevicesPlugins = (): IUseDevicesPlugins => {
	const pluginsManager = injectPluginsManager();

	const { enabled, fetchConfigPlugins, loaded } = useConfigPlugins();

	const pluginComponents: (keyof IDevicePluginsComponents)[] = ['deviceAddForm', 'deviceEditForm'];

	const pluginSchemas: (keyof IDevicePluginsSchemas)[] = [
		'deviceSchema',
		'deviceAddFormSchema',
		'deviceEditFormSchema',
		'deviceCreateReqSchema',
		'deviceUpdateReqSchema',
	];

	const plugins = computed<IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas>[]>(() => {
		return pluginsManager.getPlugins().filter((plugin) => {
			const pluginModuleEligible = plugin.modules === undefined || plugin.modules.includes(DEVICES_MODULE_NAME);

			if (!pluginModuleEligible) {
				return false;
			}

			return (plugin.elements ?? []).some((el) => {
				const elementModuleEligible = el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME);

				if (!elementModuleEligible) {
					return false;
				}

				const hasComponent =
					pluginComponents.length === 0 || (!!el.components && pluginComponents.some((key) => el.components && key in el.components));

				const hasSchema = pluginSchemas.length === 0 || (!!el.schemas && pluginSchemas.some((key) => el.schemas && key in el.schemas));

				return hasComponent || hasSchema;
			});
		});
	});

	const options = computed<{ value: IPluginElement['type']; label: string; disabled: boolean }[]>(
		(): { value: IPluginElement['type']; label: string; disabled: boolean }[] => {
			const flat: { value: IPluginElement['type']; label: string; disabled: boolean }[] = plugins.value.flatMap((plugin) => {
				return (plugin.elements ?? [])
					.filter((el) => el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME))
					.map((el) => ({
						value: el.type,
						label: el.name?.trim() ? el.name : plugin.name,
						disabled: !enabled(plugin.type),
					}));
			});

			return orderBy(flat, [(o) => o.label], ['asc']);
		}
	);

	const getByName = (type: IPlugin['type']): IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	const getByType = (type: IPluginElement['type']): IPlugin<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined => {
		return plugins.value.find((plugin) =>
			(plugin.elements ?? []).some((el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(DEVICES_MODULE_NAME)))
		);
	};

	const getElement = (type: IPluginElement['type']): IPluginElement<IDevicePluginsComponents, IDevicePluginsSchemas> | undefined => {
		for (const plugin of plugins.value) {
			const element = (plugin.elements ?? []).find(
				(el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(DEVICES_MODULE_NAME))
			);

			if (element) {
				return element;
			}
		}

		return undefined;
	};

	if (!loaded.value) {
		fetchConfigPlugins().catch((): void => {
			// Something went wrong
		});
	}

	return {
		plugins,
		options,
		getByName,
		getByType,
		getElement,
	};
};
