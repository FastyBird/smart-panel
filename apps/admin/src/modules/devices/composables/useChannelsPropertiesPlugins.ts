import { computed } from 'vue';

import { orderBy } from 'natural-orderby';

import { type IPlugin, type IPluginElement, injectPluginsManager } from '../../../common';
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

	const plugins = computed<IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas>[]>(() => {
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

	const options = computed<{ value: IPluginElement['type']; label: string }[]>((): { value: IPluginElement['type']; label: string }[] => {
		const flat: { value: IPluginElement['type']; label: string }[] = plugins.value.flatMap((plugin) => {
			return (plugin.elements ?? [])
				.filter((el) => el.modules === undefined || el.modules.includes(DEVICES_MODULE_NAME))
				.map((el) => ({
					value: el.type,
					label: el.name?.trim() ? el.name : plugin.name,
				}));
		});

		return orderBy(flat, [(o) => o.label], ['asc']);
	});

	const getByName = (type: IPlugin['type']): IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) => plugin.type === type);
	};

	const getByType = (type: IPluginElement['type']): IPlugin<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined => {
		return plugins.value.find((plugin) =>
			(plugin.elements ?? []).some((el) => el.type === type && (typeof el.modules === 'undefined' || el.modules.includes(DEVICES_MODULE_NAME)))
		);
	};

	const getElement = (
		type: IPluginElement['type']
	): IPluginElement<IChannelPropertyPluginsComponents, IChannelPropertyPluginsSchemas> | undefined => {
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

	return {
		plugins,
		options,
		getByName,
		getByType,
		getElement,
	};
};
